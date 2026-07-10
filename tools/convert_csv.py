#!/usr/bin/env python3
"""식물 CSV를 UTF-8 JSON/JavaScript 데이터 파일로 변환합니다."""

from __future__ import annotations

import argparse
import csv
import io
import json
import math
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any

EXPECTED_COLUMNS = [
    "Common_Name",
    "Genus",
    "Species",
    "ItemCoordX",
    "ItemCoordY",
    "origin",
]
ENCODING_CANDIDATES = ("utf-8-sig", "cp949", "euc-kr")


def decode_csv(path: Path) -> tuple[str, str]:
    raw = path.read_bytes()
    errors: list[str] = []
    for encoding in ENCODING_CANDIDATES:
        try:
            return raw.decode(encoding), encoding
        except UnicodeDecodeError as exc:
            errors.append(f"{encoding}: {exc}")
    raise UnicodeError("지원 인코딩으로 CSV를 읽을 수 없습니다. " + " | ".join(errors))


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    return unicodedata.normalize("NFC", str(value).strip())


def parse_coordinate(value: str, minimum: float, maximum: float) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number) or not minimum <= number <= maximum:
        return None
    return number


def compact_number(value: float) -> float:
    # 원본 정밀도를 보존하면서 불필요한 부동소수점 표현만 줄입니다.
    return float(f"{value:.10f}")


def convert(input_csv: Path, output_json: Path, output_js: Path, summary_path: Path) -> dict[str, Any]:
    csv_text, detected_encoding = decode_csv(input_csv)
    reader = csv.DictReader(io.StringIO(csv_text, newline=""))

    if reader.fieldnames is None:
        raise ValueError("CSV 헤더를 찾을 수 없습니다.")

    normalized_headers = [clean_text(name) for name in reader.fieldnames]
    missing_headers = [name for name in EXPECTED_COLUMNS if name not in normalized_headers]
    if missing_headers:
        raise ValueError("필수 열이 없습니다: " + ", ".join(missing_headers))

    valid_plants: list[dict[str, Any]] = []
    invalid_rows: list[dict[str, Any]] = []
    full_row_counter: Counter[tuple[str, ...]] = Counter()
    coordinate_counter: Counter[tuple[float, float]] = Counter()
    missing_values: Counter[str] = Counter()

    total_rows = 0
    for line_number, raw_row in enumerate(reader, start=2):
        total_rows += 1
        row = {key: clean_text(raw_row.get(key, "")) for key in EXPECTED_COLUMNS}
        full_row_counter[tuple(row[key] for key in EXPECTED_COLUMNS)] += 1

        for key, value in row.items():
            if not value:
                missing_values[key] += 1

        latitude = parse_coordinate(row["ItemCoordX"], -90, 90)
        longitude = parse_coordinate(row["ItemCoordY"], -180, 180)
        if latitude is None or longitude is None:
            invalid_rows.append(
                {
                    "line": line_number,
                    "latitude": row["ItemCoordX"],
                    "longitude": row["ItemCoordY"],
                    "reason": "좌표가 숫자가 아니거나 허용 범위를 벗어남",
                }
            )
            continue

        latitude = compact_number(latitude)
        longitude = compact_number(longitude)
        coordinate_counter[(latitude, longitude)] += 1
        valid_plants.append(
            {
                "commonName": row["Common_Name"],
                "genus": row["Genus"],
                "species": row["Species"],
                "latitude": latitude,
                "longitude": longitude,
                "origin": row["origin"],
            }
        )

    if not valid_plants:
        raise ValueError("유효한 좌표가 한 건도 없습니다.")

    duplicate_row_excess = sum(count - 1 for count in full_row_counter.values() if count > 1)
    duplicate_row_groups = sum(1 for count in full_row_counter.values() if count > 1)
    same_coordinate_excess = sum(count - 1 for count in coordinate_counter.values() if count > 1)
    same_coordinate_groups = sum(1 for count in coordinate_counter.values() if count > 1)

    summary: dict[str, Any] = {
        "sourceFile": input_csv.name,
        "detectedEncoding": detected_encoding,
        "totalRows": total_rows,
        "validRows": len(valid_plants),
        "invalidRows": len(invalid_rows),
        "duplicateIdenticalRows": duplicate_row_excess,
        "duplicateIdenticalGroups": duplicate_row_groups,
        "sameCoordinateAdditionalRows": same_coordinate_excess,
        "sameCoordinateGroups": same_coordinate_groups,
        "maxPlantsAtSameCoordinate": max(coordinate_counter.values(), default=0),
        "missingValues": dict(missing_values),
        "containsReplacementCharacter": "\ufffd" in csv_text,
        "bounds": {
            "south": min(item["latitude"] for item in valid_plants),
            "north": max(item["latitude"] for item in valid_plants),
            "west": min(item["longitude"] for item in valid_plants),
            "east": max(item["longitude"] for item in valid_plants),
        },
        "invalidRowSamples": invalid_rows[:100],
    }

    output_json.parent.mkdir(parents=True, exist_ok=True)
    output_js.parent.mkdir(parents=True, exist_ok=True)
    summary_path.parent.mkdir(parents=True, exist_ok=True)

    compact_json = json.dumps(valid_plants, ensure_ascii=False, separators=(",", ":"))
    output_json.write_text(compact_json, encoding="utf-8")
    output_js.write_text(
        "/* 자동 생성 파일: tools/convert_csv.py로 다시 만드세요. */\n"
        f"window.PLANT_DATA={compact_json};\n"
        f"window.PLANT_DATA_META={json.dumps(summary, ensure_ascii=False, separators=(',', ':'))};\n",
        encoding="utf-8",
    )
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    return summary


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="CP949/UTF-8 식물 CSV를 정적 웹앱용 데이터로 변환합니다.")
    parser.add_argument("input_csv", nargs="?", default="source/필요정보.csv", type=Path)
    parser.add_argument("--json", dest="output_json", default="data/plants.json", type=Path)
    parser.add_argument("--js", dest="output_js", default="data/plants-data.js", type=Path)
    parser.add_argument("--summary", dest="summary_path", default="data/data-summary.json", type=Path)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        summary = convert(args.input_csv, args.output_json, args.output_js, args.summary_path)
    except Exception as exc:
        print(f"변환 실패: {exc}")
        return 1

    print(f"인코딩: {summary['detectedEncoding']}")
    print(f"전체 데이터: {summary['totalRows']:,}개")
    print(f"정상 좌표: {summary['validRows']:,}개")
    print(f"제외된 좌표: {summary['invalidRows']:,}개")
    print(f"완전 동일 중복 행(추가분): {summary['duplicateIdenticalRows']:,}개")
    print(f"동일 좌표 추가 개체: {summary['sameCoordinateAdditionalRows']:,}개")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
