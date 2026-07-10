식물 위성 지도 - Mapbox / GitHub Pages 실행 안내
================================================

1. 가장 먼저 할 일: 토큰 한 줄 입력
-----------------------------------
이 프로젝트에서 일반 사용자가 수정할 파일은 프로젝트 최상단의 다음 파일 하나뿐입니다.

  MAPBOX_TOKEN.js

텍스트 편집기로 MAPBOX_TOKEN.js를 열고 아래 줄의 안내 문구만 Mapbox 공개 토큰으로 교체합니다.

변경 전
  window.MAPBOX_ACCESS_TOKEN = "여기에_pk.로_시작하는_Mapbox_공개_토큰을_입력하세요";

변경 후 예시
  window.MAPBOX_ACCESS_TOKEN = "pk.eyJ1Ijo...사용자의_실제_토큰...";

따옴표, 등호, 세미콜론은 그대로 두고 따옴표 안의 내용만 교체하세요.
반드시 pk.로 시작하는 공개 토큰을 사용해야 합니다.
sk.로 시작하는 비밀 토큰은 절대로 입력하거나 GitHub에 올리지 마세요.

assets/js/config.js, assets/js/map.js 등 다른 설정 파일은 수정할 필요가 없습니다.


2. Mapbox 공개 토큰 준비
-----------------------
1) Mapbox 계정에 로그인합니다.
2) Access Tokens 화면에서 이 지도 전용 공개 토큰을 만듭니다.
3) pk.로 시작하는 토큰을 복사합니다.
4) 가능하면 기본 공개 토큰 대신 프로젝트 전용 공개 토큰을 사용합니다.
5) 토큰의 Allowed URLs에 GitHub Pages 도메인을 등록합니다.

GitHub Pages 주소가 다음과 같다면
  https://USERNAME.github.io/REPOSITORY/

Allowed URLs에는 다음처럼 등록할 수 있습니다.
  https://USERNAME.github.io

허용된 도메인의 하위 경로도 허용되므로 저장소 경로에서 실행할 수 있습니다.
사용자 지정 도메인을 사용한다면 해당 도메인도 별도로 등록하세요.

주의
- Mapbox URL 제한은 와일드카드를 사용하지 않습니다.
- 기본 공개 토큰에는 URL 제한을 추가할 수 없으므로 새 공개 토큰을 만드는 것이 좋습니다.
- 로컬 테스트용 토큰이 필요하면 운영 토큰과 분리하고 http://localhost:8000 을 Allowed URLs에 등록하세요.
- Brave Shields, Ghostery 등 Referer를 차단하는 기능은 제한된 토큰 요청을 403으로 만들 수 있습니다.


3. GitHub Pages에 배포
---------------------
1) MAPBOX_TOKEN.js에 토큰을 입력하고 저장합니다.
2) plant-satellite-map 폴더 안의 전체 파일을 GitHub 저장소에 올립니다.
3) 저장소에서 Settings > Pages로 이동합니다.
4) Deploy from a branch를 선택합니다.
5) 배포 브랜치와 /(root) 또는 실제 게시 폴더를 선택합니다.
6) 배포가 완료되면 다음 형식의 HTTPS 주소를 엽니다.

  https://USERNAME.github.io/REPOSITORY/

Git 명령을 사용하는 경우 예시
  git add .
  git commit -m "Mapbox 토큰 및 위성 지도 적용"
  git push

기존 GitHub Pages 사이트에 교체하는 경우에도 폴더 구조를 유지한 채 전체 파일을 업로드하세요.


4. 배포 후 지도 실행
-------------------
사이트를 열면 다음 순서로 동작합니다.

1) 로컬 식물 데이터 12,142개를 불러옵니다.
2) 모든 유효 좌표가 보이도록 지도 범위를 맞춥니다.
3) Mapbox Satellite 위성 타일을 인터넷에서 불러옵니다.
4) 줌 아웃 상태에서는 마커 클러스터를 표시합니다.
5) 확대할수록 클러스터 반경이 줄어 서로 다른 좌표가 개별 마커로 분리됩니다.
6) 검색 결과를 선택하면 줌 22까지 이동합니다.
7) 줌 22에서도 완전히 같거나 매우 가까운 좌표만 작은 클러스터로 남으며, 누르면 Spiderfy 방식으로 펼쳐집니다.

검색 가능 항목
- 국명
- 속명
- 종소명
- 전체 학명
- 표찰번호

현재 위치 버튼은 HTTPS 환경에서 브라우저 위치 권한을 요청합니다.
전체 범위 버튼은 모든 유효한 식물 좌표가 보이는 화면으로 돌아갑니다.


5. Mapbox 지도 설정
------------------
지도 공급자와 줌 설정은 이미 적용되어 있습니다.
일반 사용자는 다음 값을 수정할 필요가 없습니다.

- Mapbox Satellite Raster Tiles
- 최대 줌 22
- 고해상도 @2x JPEG 타일
- Mapbox 및 Maxar 저작권 표시
- 검색 결과 이동 줌 22
- 확대 단계에 따라 클러스터 반경 자동 축소
- 줌 22에서 동일·초근접 좌표만 클러스터 유지 후 클릭 시 Spiderfy

Mapbox 타일만 외부 네트워크에서 불러옵니다.
식물 데이터, 검색 인덱스, CSS, JavaScript, Leaflet과 MarkerCluster는 프로젝트 파일에서 불러옵니다.


6. 변경 후에도 이전 지도가 보일 때
---------------------------------
이 프로젝트는 서비스 워커를 사용하므로 이전 캐시가 남을 수 있습니다.

먼저 다음 방법으로 강력 새로고침합니다.
- Windows: Ctrl + Shift + R
- macOS: Command + Shift + R

그래도 바뀌지 않으면 Chrome 또는 Edge에서 다음 순서로 삭제합니다.
1) 개발자 도구를 엽니다.
2) Application > Service Workers에서 Unregister를 누릅니다.
3) Application > Storage에서 Clear site data를 누릅니다.
4) 탭을 닫고 GitHub Pages 주소를 다시 엽니다.

스마트폰에서는 브라우저 설정에서 해당 사이트의 저장 데이터와 캐시를 삭제한 뒤 다시 접속합니다.


7. 오류 해결
------------
화면에 "Mapbox 공개 토큰이 설정되지 않았습니다"가 표시됨
- 프로젝트 최상단의 MAPBOX_TOKEN.js를 엽니다.
- 따옴표 안에 pk.로 시작하는 실제 공개 토큰을 입력합니다.
- 파일 이름과 위치를 변경하지 마세요.
- GitHub에 다시 업로드하고 Pages 재배포를 기다립니다.

401 Unauthorized
- 토큰이 잘못되었거나 삭제되었는지 확인합니다.
- 토큰이 pk.로 시작하는지 확인합니다.
- 토큰 앞뒤에 불필요한 공백이 없는지 확인합니다.

403 Forbidden
- Mapbox 토큰의 Allowed URLs에 GitHub Pages 도메인이 등록되었는지 확인합니다.
- https/http가 실제 주소와 일치하는지 확인합니다.
- 브라우저 확장 프로그램이 Referer를 차단하는지 확인합니다.
- 기본 공개 토큰이 아닌 새 프로젝트 공개 토큰을 사용했는지 확인합니다.

429 Too Many Requests
- 짧은 시간의 Mapbox 요청량이 많거나 사용 한도에 도달한 경우입니다.
- Mapbox Statistics 및 결제/사용량 설정을 확인합니다.

마커는 보이지만 위성 배경만 보이지 않음
- 식물 데이터와 앱은 정상이며 Mapbox 요청만 실패한 상태입니다.
- 인터넷 연결, 토큰, Allowed URLs와 브라우저 Network 탭의 상태 코드를 확인합니다.

최대 확대에서도 일부 마커가 겹침
- 완전히 같은 좌표 또는 매우 가까운 좌표는 지도 해상도와 관계없이 겹칠 수 있습니다.
- 최대 확대에서 해당 위치를 누르면 Spiderfy 방식으로 마커가 펼쳐집니다.

현재 위치가 동작하지 않음
- GitHub Pages의 HTTPS 주소에서 실행하세요.
- 브라우저의 위치 권한을 허용하세요.


8. 로컬 시험 실행
----------------
GitHub Pages에 올리기 전에 PC에서 시험하려면 Python이 설치된 환경에서 프로젝트 폴더를 열고 다음 명령을 실행합니다.

  python -m http.server 8000

브라우저에서 다음 주소를 엽니다.

  http://localhost:8000

URL 제한이 있는 운영 토큰은 localhost에서 차단될 수 있습니다.
로컬 시험용 별도 공개 토큰을 만들고 Allowed URLs에 http://localhost:8000 을 등록하는 방법을 권장합니다.

file:// 방식으로 index.html을 직접 열면 Mapbox URL 제한, 현재 위치, 서비스 워커가 정상 동작하지 않을 수 있습니다.
GitHub Pages HTTPS 실행이 기본 방식입니다.


9. 식물 데이터와 개인정보
------------------------
- 식물 데이터는 data/plants-data.js와 data/plants.json에 들어 있습니다.
- 검색어는 Mapbox 또는 다른 외부 서비스로 전송하지 않습니다.
- GPS 위치를 저장하거나 서버로 전송하지 않습니다.
- 광고와 분석 스크립트가 없습니다.
- Mapbox 타일 요청 시에는 일반적인 웹 요청 정보와 접속 위치의 지도 범위가 Mapbox에 전달될 수 있습니다.
- GitHub Pages 저장소가 공개이면 식물 데이터 파일도 공개적으로 다운로드할 수 있습니다.


10. CSV 데이터 교체
------------------
새 CSV는 다음 헤더를 정확히 포함해야 합니다.

  Common_Name,Genus,Species,ItemCoordX,ItemCoordY,origin

좌표 규칙
- ItemCoordX = 위도(latitude)
- ItemCoordY = 경도(longitude)
- Leaflet 좌표 순서 = [ItemCoordX, ItemCoordY]

교체 절차
1) 새 CSV를 source/필요정보.csv로 저장합니다.
2) 프로젝트 폴더에서 다음 명령을 실행합니다.

  python tools/convert_csv.py

3) 다음 파일이 다시 생성됩니다.
- data/plants.json
- data/plants-data.js
- data/data-summary.json

4) 변경된 파일을 GitHub에 올립니다.
5) 배포 후 브라우저 캐시를 강력 새로고침합니다.

변환 스크립트는 UTF-8 BOM, CP949, EUC-KR을 순서대로 확인하고 좌표 범위, 빈 값, 중복 행, 동일 좌표와 깨진 한글을 검사합니다.


11. 주요 파일
-------------
- MAPBOX_TOKEN.js: 사용자가 토큰 한 줄만 입력하는 파일
- index.html: 지도 애플리케이션
- start.html: 실행 전 안내 페이지
- assets/js/config.js: 수정할 필요 없는 내부 지도/줌 설정
- assets/js/map.js: Leaflet 지도, 클러스터와 라벨 처리
- assets/js/search.js: 로컬 검색 인덱스
- data/plants-data.js: 직접 로딩용 실제 식물 데이터
- data/plants.json: UTF-8 JSON 식물 데이터
- source/필요정보.csv: 원본 CSV
- tools/convert_csv.py: CSV 재변환 스크립트
- tools/validate_project.py: 배포 전 정적 검사
- TEST-RESULTS.txt: 데이터와 프로젝트 테스트 결과


12. 포함 라이브러리
------------------
- Leaflet 1.9.4
- Leaflet.markercluster 1.5.3

두 라이브러리는 assets/vendor 폴더에 포함되어 CDN에 의존하지 않습니다.
위성 영상만 Mapbox에서 네트워크로 불러옵니다.
