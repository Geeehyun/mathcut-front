/**
 * MathCut 인쇄-safe 색상 팔레트
 * 교과서 CMYK 4도 인쇄 기준으로 설계
 * CMYK → RGB 변환: R=255*(1-C/100)*(1-K/100), G=255*(1-M/100)*(1-K/100), B=255*(1-Y/100)*(1-K/100)
 */

export interface PaletteColor {
  id: string
  name: string
  hex: string
  cmyk: [number, number, number, number]  // C M Y K (0~100)
}

/** 선(stroke) 팔레트 — 진한 계열, 인쇄 선명도 우선 */
export const STROKE_PALETTE: PaletteColor[] = [
  { "id": "black", "name": "검정(K100)", "hex": "#231815", "cmyk": [0, 0, 0, 100] },
  { "id": "gray", "name": "회색(K45)", "hex": "#939598", "cmyk": [0, 0, 0, 45] },
  { "id": "magenta100", "name": "자홍(M100)", "hex": "#E6007E", "cmyk": [0, 100, 0, 0] },
  { "id": "cyan100", "name": "청록(C100)", "hex": "#009FE3", "cmyk": [100, 0, 0, 0] },
  { "id": "red-my100", "name": "빨강(M100 Y100)", "hex": "#E60012", "cmyk": [0, 100, 100, 0] },
  { "id": "yellow100", "name": "노랑(Y100)", "hex": "#FFF100", "cmyk": [0, 0, 100, 0] }
]

/** 채우기(fill) 팔레트 — 파스텔 계열, 텍스트 가독성 유지 */
export const FILL_PALETTE: PaletteColor[] = [
    { "id": "fill-cyan-20", "name": "파스텔 청록(C20)", "hex": "#CFEAF7", "cmyk": [20, 0, 0, 0] },
    { "id": "fill-sky", "name": "파스텔 하늘(C25 M5)", "hex": "#C3E6F8", "cmyk": [25, 5, 0, 0] },
    { "id": "fill-blue", "name": "파스텔 블루(C35 M20)", "hex": "#ADBEF0", "cmyk": [35, 20, 0, 0] },
    { "id": "fill-mint", "name": "파스텔 민트(C25 Y15)", "hex": "#C4E9D6", "cmyk": [25, 0, 15, 0] },
    { "id": "fill-green", "name": "파스텔 그린(C30 Y30)", "hex": "#BBDCB5", "cmyk": [30, 0, 30, 0] },
    { "id": "fill-lime", "name": "파스텔 라임(C15 Y35)", "hex": "#E4F0B5", "cmyk": [15, 0, 35, 0] },
    { "id": "fill-yellow-20", "name": "파스텔 노랑(Y20)", "hex": "#FFF9CC", "cmyk": [0, 0, 20, 0] },
    { "id": "fill-peach", "name": "파스텔 피치(M15 Y30)", "hex": "#FCE7C9", "cmyk": [0, 15, 30, 0] },
    { "id": "fill-orange", "name": "파스텔 오렌지(M25 Y40)", "hex": "#FAD7B2", "cmyk": [0, 25, 40, 0] },
    { "id": "fill-pink", "name": "파스텔 핑크(M25 Y10)", "hex": "#F9D3E3", "cmyk": [0, 25, 10, 0] },
    { "id": "fill-magenta-20", "name": "파스텔 자홍(M20)", "hex": "#F9DBEB", "cmyk": [0, 20, 0, 0] },
    { "id": "fill-lavender", "name": "파스텔 라벤더(C10 M20)", "hex": "#E7D8F0", "cmyk": [10, 20, 0, 0] },
    { "id": "fill-purple", "name": "파스텔 퍼플(C15 M25)", "hex": "#DFCFE9", "cmyk": [15, 25, 0, 0] },
    { "id": "fill-white", "name": "White (K0)", "hex": "#FFFFFF", "cmyk": [0, 0, 0, 0] },
    { "id": "fill-gray", "name": "파스텔 회색(K8)", "hex": "#EEEEEE", "cmyk": [0, 0, 0, 8] }
]

/** 채우기 없음 */
export const FILL_NONE = 'none'

/** hex → CMYK 표시 문자열 (툴팁용) */
export function cmykTooltip(color: PaletteColor): string {
  const [c, m, y, k] = color.cmyk
  return `${color.name}  C:${c} M:${m} Y:${y} K:${k}`
}
