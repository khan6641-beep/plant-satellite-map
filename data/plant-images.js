/*
 * 식물 대표 이미지 연결 파일입니다.
 * 이미지 파일은 assets/images/plants/ 폴더에 넣고 아래 예시처럼 등록하세요.
 * 우선순위: 표찰번호 > 국명 > 학명 > 기본 이미지
 *
 * 예시:
 * byOrigin: {
 *   "12-L-00001": {
 *     src: "./assets/images/plants/12-L-00001.jpg",
 *     alt: "참느릅나무 대표 이미지",
 *     credit: "촬영: 홍길동",
 *     license: "국립생태원 내부 활용"
 *   }
 * }
 */
window.PLANT_IMAGE_MAP = {
  byOrigin: {},
  byCommonName: {},
  byScientificName: {}
};
