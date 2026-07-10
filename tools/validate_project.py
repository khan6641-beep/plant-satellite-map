#!/usr/bin/env python3
"""배포 전 프로젝트 구조와 데이터 정합성을 검사합니다."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPECTED_COUNT = 12142
REQUIRED_FILES = [
    "index.html",
    "start.html",
    "manifest.webmanifest",
    "MAPBOX_TOKEN.js",
    "service-worker.js",
    "README.txt",
    "TEST-RESULTS.txt",
    "assets/css/style.css",
    "assets/js/config.js",
    "assets/js/utils.js",
    "assets/js/search.js",
    "assets/js/map.js",
    "assets/js/app.js",
    "assets/vendor/leaflet/leaflet.css",
    "assets/vendor/leaflet/leaflet.js",
    "assets/vendor/markercluster/MarkerCluster.css",
    "assets/vendor/markercluster/MarkerCluster.Default.css",
    "assets/vendor/markercluster/leaflet.markercluster.js",
    "assets/icons/icon.svg",
    "assets/icons/icon-192.png",
    "assets/icons/icon-512.png",
    "data/plants.json",
    "data/plants-data.js",
    "data/data-summary.json",
    "source/필요정보.csv",
    "tools/convert_csv.py",
]


def check(condition: bool, message: str, failures: list[str]) -> None:
    if condition:
        print(f"[통과] {message}")
    else:
        failures.append(message)
        print(f"[실패] {message}")


def main() -> int:
    failures: list[str] = []

    for relative in REQUIRED_FILES:
        check((ROOT / relative).is_file(), f"필수 파일 존재: {relative}", failures)

    plants = json.loads((ROOT / "data/plants.json").read_text(encoding="utf-8"))
    meta = json.loads((ROOT / "data/data-summary.json").read_text(encoding="utf-8"))
    check(isinstance(plants, list), "plants.json 최상위 배열", failures)
    check(len(plants) == EXPECTED_COUNT, f"식물 데이터 {EXPECTED_COUNT:,}건", failures)
    check(meta.get("totalRows") == EXPECTED_COUNT, "요약 전체 건수 일치", failures)
    check(meta.get("validRows") == EXPECTED_COUNT and meta.get("invalidRows") == 0, "유효/제외 좌표 통계 일치", failures)
    check(meta.get("detectedEncoding") == "cp949", "원본 CSV CP949 감지", failures)
    check(meta.get("containsReplacementCharacter") is False, "깨진 한글 대체 문자 없음", failures)

    coordinates_ok = all(
        isinstance(item.get("latitude"), (int, float))
        and isinstance(item.get("longitude"), (int, float))
        and -90 <= item["latitude"] <= 90
        and -180 <= item["longitude"] <= 180
        for item in plants
    )
    check(coordinates_ok, "전체 좌표 숫자 및 범위 유효", failures)

    first = plants[0]
    check(first.get("commonName") == "참느릅나무", "첫 행 한글 국명 보존", failures)
    check(first.get("genus") == "Ulmus" and first.get("species") == "parvifolia", "속명·종소명 보존", failures)
    check(first.get("latitude") == 36.02931022 and first.get("longitude") == 126.7181814, "ItemCoordX=위도, ItemCoordY=경도 순서", failures)
    check(first.get("origin") == "12-L-00001", "표찰번호 보존", failures)

    data_js = (ROOT / "data/plants-data.js").read_text(encoding="utf-8")
    try:
        embedded_json = data_js.split("window.PLANT_DATA=", 1)[1].split(";\nwindow.PLANT_DATA_META=", 1)[0]
        embedded_plants = json.loads(embedded_json)
    except Exception:
        embedded_plants = None
    check(embedded_plants == plants, "file://용 JavaScript 데이터와 JSON 동일", failures)

    manifest = json.loads((ROOT / "manifest.webmanifest").read_text(encoding="utf-8"))
    check(manifest.get("start_url") == "./index.html", "매니페스트 시작 URL 상대 경로", failures)
    for icon in manifest.get("icons", []):
        check((ROOT / icon["src"].removeprefix("./")).is_file(), f"매니페스트 아이콘 존재: {icon['src']}", failures)

    index_text = (ROOT / "index.html").read_text(encoding="utf-8")
    refs = re.findall(r"(?:src|href)=[\"']([^\"']+)[\"']", index_text)
    local_refs = [ref for ref in refs if not re.match(r"^(?:https?:|data:|#)", ref)]
    for ref in local_refs:
        check((ROOT / ref.removeprefix("./")).exists(), f"index.html 참조 존재: {ref}", failures)

    sw_text = (ROOT / "service-worker.js").read_text(encoding="utf-8")
    asset_block_match = re.search(r"const CORE_ASSETS = \[(.*?)\];", sw_text, re.S)
    sw_assets = re.findall(r'[\"\'](\./[^\"\']*)[\"\']', asset_block_match.group(1) if asset_block_match else "")
    check(bool(sw_assets), "서비스 워커 캐시 목록 파싱", failures)
    for ref in sw_assets:
        if ref == "./":
            continue
        check((ROOT / ref.removeprefix("./")).is_file(), f"서비스 워커 캐시 파일 존재: {ref}", failures)

    runtime_text = "\n".join((ROOT / relative).read_text(encoding="utf-8") for relative in [
        "index.html", "start.html", "MAPBOX_TOKEN.js", "assets/js/config.js", "assets/js/utils.js",
        "assets/js/search.js", "assets/js/map.js", "assets/js/app.js", "service-worker.js"
    ])
    local_absolute_patterns = [r"[A-Za-z]:\\(?:Users|Documents|Desktop)\\", r"/(?:Users|home)/[^/\s]+/"]
    check(not any(re.search(pattern, runtime_text) for pattern in local_absolute_patterns), "런타임 파일에 특정 PC 절대 경로 없음", failures)

    app_scripts = "\n".join((ROOT / f"assets/js/{name}").read_text(encoding="utf-8") for name in ["config.js", "utils.js", "search.js", "map.js", "app.js"])
    check("fetch(" not in app_scripts, "직접 실행 앱이 식물 데이터 fetch에 의존하지 않음", failures)
    urls = re.findall(r"https?://[^\"'\s]+", app_scripts)
    mapbox_urls = [url for url in urls if url.startswith("https://api.mapbox.com/")]
    check(len(mapbox_urls) == 1 and "mapbox.satellite" in mapbox_urls[0], "런타임 외부 지도 URL은 Mapbox Satellite뿐", failures)

    token_text = (ROOT / "MAPBOX_TOKEN.js").read_text(encoding="utf-8")
    check("window.MAPBOX_ACCESS_TOKEN" in token_text, "Mapbox 토큰 전용 입력 변수 존재", failures)
    check("sk." not in re.sub(r"/\*.*?\*/|//.*", "", token_text, flags=re.S), "실행 토큰 값에 비밀 토큰 없음", failures)
    check("strict-origin-when-cross-origin" in index_text and "no-referrer" not in index_text, "Mapbox URL 제한용 Referrer Policy", failures)

    if failures:
        print(f"\n총 {len(failures)}개 항목이 실패했습니다.")
        return 1
    print("\n모든 프로젝트 검사가 통과했습니다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
