import jsPDF from 'jspdf'
import type { Ref } from 'vue'
import type { Point, Shape, ShapeGuideItemStyle } from '@/types'
import { GRID_CONFIG } from '@/types'
import { OPEN_SHAPE_TYPES } from '@/constants/shapeRules'
import { useCanvasStore } from '@/stores/canvas'
import { useToolStore } from '@/stores/tool'
import { containsHangulText, renderLatexLikeHtml, toAngleLatex, toBlankAngleLatex, toBlankBoxSuffixLatex, toBlankUnitLatex, toLengthLatex, toTextGuideLatex } from '@/utils/latexText'
import { createLatexCanvasSprite } from '@/utils/latexCanvas'
import katexCssRaw from 'katex/dist/katex.min.css?raw'
import katexMainRegularUrl from 'katex/dist/fonts/KaTeX_Main-Regular.woff2?url'
import katexMainBoldUrl from 'katex/dist/fonts/KaTeX_Main-Bold.woff2?url'
import katexMainItalicUrl from 'katex/dist/fonts/KaTeX_Main-Italic.woff2?url'
import katexMainBoldItalicUrl from 'katex/dist/fonts/KaTeX_Main-BoldItalic.woff2?url'
import katexMathItalicUrl from 'katex/dist/fonts/KaTeX_Math-Italic.woff2?url'
import katexMathBoldItalicUrl from 'katex/dist/fonts/KaTeX_Math-BoldItalic.woff2?url'
import katexAmsRegularUrl from 'katex/dist/fonts/KaTeX_AMS-Regular.woff2?url'
import katexCaligraphicRegularUrl from 'katex/dist/fonts/KaTeX_Caligraphic-Regular.woff2?url'
import katexCaligraphicBoldUrl from 'katex/dist/fonts/KaTeX_Caligraphic-Bold.woff2?url'
import katexFrakturRegularUrl from 'katex/dist/fonts/KaTeX_Fraktur-Regular.woff2?url'
import katexFrakturBoldUrl from 'katex/dist/fonts/KaTeX_Fraktur-Bold.woff2?url'
import katexSansSerifRegularUrl from 'katex/dist/fonts/KaTeX_SansSerif-Regular.woff2?url'
import katexSansSerifItalicUrl from 'katex/dist/fonts/KaTeX_SansSerif-Italic.woff2?url'
import katexSansSerifBoldUrl from 'katex/dist/fonts/KaTeX_SansSerif-Bold.woff2?url'
import katexScriptRegularUrl from 'katex/dist/fonts/KaTeX_Script-Regular.woff2?url'
import katexTypewriterRegularUrl from 'katex/dist/fonts/KaTeX_Typewriter-Regular.woff2?url'
import katexSize1RegularUrl from 'katex/dist/fonts/KaTeX_Size1-Regular.woff2?url'
import katexSize2RegularUrl from 'katex/dist/fonts/KaTeX_Size2-Regular.woff2?url'
import katexSize3RegularUrl from 'katex/dist/fonts/KaTeX_Size3-Regular.woff2?url'
import katexSize4RegularUrl from 'katex/dist/fonts/KaTeX_Size4-Regular.woff2?url'

type ExportFormat = 'png' | 'pdf' | 'svg'
type ShapeGuideKey = 'length' | 'angle' | 'pointName' | 'height'
type ShapeGuideVisibilityKey = ShapeGuideKey | 'radius' | 'point'

type PointLike = { x: number, y: number }
const MM_TO_PX = 96 / 25.4
const SVG_ANGLE_FONT_SCALE = 0.94
const SVG_POINT_NAME_FONT_SCALE = 1.04

function getBlankBoxUnitMode(guide: { blankUnitMode?: 'none' | 'cm' | 'angle' }): 'none' | 'cm' | 'angle' {
  return guide.blankUnitMode === 'cm' || guide.blankUnitMode === 'angle' ? guide.blankUnitMode : 'none'
}

function getBlankBoxSuffixText(guide: { blankUnitMode?: 'none' | 'cm' | 'angle' }): string {
  const mode = getBlankBoxUnitMode(guide)
  if (mode === 'cm') return 'cm'
  if (mode === 'angle') return '°'
  return ''
}

function getBlankBoxSuffixLatexOffset(mode: 'none' | 'cm' | 'angle'): { x: number, y: number } {
  if (mode === 'angle') {
    return { x: -3, y: -3 }
  }
  return { x: 0, y: 0 }
}

interface ExportOptions {
  fileName?: string
  includeBackground?: boolean
  grayscale?: boolean
  embedFonts?: boolean
}

interface ShapeColors {
  stroke: string
  fill?: string
  point: string
  label?: string
  rightAngle?: string
}

interface GuideBlankRect {
  x: number
  y: number
  width: number
  height: number
  cornerRadius: number
}

interface ShapeHeightGuide {
  apex: PointLike
  foot: PointLike
  baseA: PointLike
  baseB: PointLike
  t: number
}

interface RightAngleMarker {
  p1: PointLike
  corner: PointLike
  p2: PointLike
}

interface SvgRenderOptions {
  stageWidth: Readonly<Ref<number>>
  stageHeight: Readonly<Ref<number>>
  gridMinorOpacity: number
  gridMajorOpacity: number
  gridMinorLineWidth: number
  gridMajorLineWidth: number
  gridDotOpacity: number
  gridDotRadius: number
  defaultTextFontFamily: string
  defaultTextFontSize: number
  defaultTextColor: string
  lengthGuideDefaultColor: string
  angleGuideDefaultColor: string
  heightGuideDefaultColor: string
  defaultGuideLinePx: number
  defaultHeightGuideLinePx: number
  blankBorderColor: string
  blankBorderWidthPx: number
  guideRightAngleMarkerSize: number
  ptToPx: number
  getColors: (shape: Shape) => ShapeColors
  getShapeStrokeWidthPx: (shape: Shape) => number
  calculateDistancePixels: (a: Point, b: Point) => number
  getArrowShaftPoints: (shape: Shape) => number[]
  getArrowHeadPoints: (shape: Shape) => number[]
  getExtendedRayPoints: (points: Point[]) => number[]
  getArrowHeadPointsByTangent: (from: PointLike, tip: PointLike) => number[]
  getRenderedShapePoints: (shape: Shape) => number[]
  isShapePointVisible: (shape: Shape, pointIndex: number) => boolean
  isShapeGuideVisible: (shape: Shape, key: ShapeGuideVisibilityKey) => boolean
  getShapeAutoLengthIndices: (shape: Shape) => number[]
  isShapeGuideItemVisible: (shape: Shape, key: ShapeGuideKey, index: number) => boolean
  getShapeGuideItemStyle: (shape: Shape, key: ShapeGuideKey, index: number) => ShapeGuideItemStyle
  getShapeLengthCurveSegments: (shape: Shape, index: number) => number[][]
  isShapeGuideItemBlank: (shape: Shape, key: ShapeGuideKey, index: number) => boolean
  getShapeGuideLabelWorldPos: (shape: Shape, key: ShapeGuideKey, index: number) => PointLike
  getShapeLengthValueText: (shape: Shape, index: number) => string
  getShapeLengthTextOffsetX: (shape: Shape, index: number, text: string, fontSize: number, withUnit: boolean) => number
  getShapeLengthUnitX: (shape: Shape, index: number, anchorX: number, mainText: string, fontSize: number, withUnit: boolean) => number
  getShapeGuideTextColor: (shape: Shape, key: ShapeGuideKey, index: number, fallback: string) => string
  getShapeGuideFallbackTextColor: (shape: Shape, key: ShapeGuideKey, index: number) => string
  getShapeGuideBlankTextPos: (shape: Shape, key: 'length' | 'angle' | 'height', index: number, kind: 'unit' | 'suffix') => PointLike
  getShapeGuideBlankRect: (shape: Shape, key: ShapeGuideKey, index: number) => GuideBlankRect
  getCircleLengthEndpoints: (shape: Shape) => { p1: PointLike, p2: PointLike }
  getCircleLengthCurveSegments: (shape: Shape) => number[][]
  getCircleLengthLabelWorldPos: (shape: Shape) => PointLike
  getCircleLengthValueText: (shape: Shape) => string
  getShapeHeightGuide: (shape: Shape) => ShapeHeightGuide | null
  getShapeHeightRightAngleMarkerPoints: (shape: Shape) => number[]
  getShapeHeightLengthGuideSegments: (shape: Shape) => number[][]
  getShapeHeightValueText: (shape: Shape) => string
  getShapeAutoAngleIndices: (shape: Shape, mode: 'right' | 'all') => number[]
  isRightAngleAt: (shape: Shape, index: number) => boolean
  getRightAngleMarkerPoints: (points: Point[], index: number) => RightAngleMarker | null
  getShapeAngleArcPolyline: (shape: Shape, index: number) => number[]
  getShapeAngleValueText: (shape: Shape, index: number) => string
  shouldRenderShapeAngleText: (shape: Shape, index: number, mode: 'right' | 'all') => boolean
  getShapeAngleTextOffsetX: (shape: Shape, index: number, text: string, fontSize: number) => number
  getShapeAngleTextOffsetY: (shape: Shape, index: number, fontSize: number) => number
  getShapePointNameTextPos: (shape: Shape, index: number) => PointLike
  getShapeGuideItemOffset: (shape: Shape, key: ShapeGuideKey, index: number) => PointLike
  getGlobalPointLabel: (shapeId: string, pointIndex: number) => string
  getLengthGuideCurvePoints: (guide: { points: PointLike[] }) => number[]
  getLengthGuideLabelPos: (guide: { points: PointLike[] }) => PointLike
  isRightAngleGuide: (points: PointLike[]) => boolean
  getRightAngleGuideMarkerPoints: (p1: PointLike, p2: PointLike, p3: PointLike, size: number) => RightAngleMarker
  getAngleArcPoints: (points: PointLike[]) => number[]
  stripGuideUnit: (text: string) => string
  getLengthUnitGapPx: () => number
  getTextWidthPx: (text: string, fontSize: number) => number
  getUnitYFromCenteredText: (centerY: number, fontSize: number) => number
  getTextGuideAnchor: (guide: { points: Point[] }) => PointLike
  getTextGuideFontSize: (guide: { fontSize?: number }) => number
  getTextGuideRotation: (guide: { rotation?: number }) => number
  formatMathText: (text: string) => string
  formatLengthGuideText: (text: string | undefined) => string
}

interface UseCanvasExportOptions {
  stageRef: Ref<any>
  canvasWidth: number
  canvasHeight: number
  alertRenderFailure: () => void
  svg: SvgRenderOptions
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  link.click()
}

function sanitizeFilename(input: string): string {
  const trimmed = input.trim()
  const fallback = `mathcut-${Date.now()}`
  if (!trimmed) return fallback
  return trimmed.replace(/[\\/:*?"<>|]+/g, '_')
}

async function fetchFontAsBase64(url: string): Promise<string> {
  const res = await fetch(url)
  const buf = await res.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return `data:font/woff2;base64,${btoa(bin)}`
}

function svgEsc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function svgPts(flat: number[]): string {
  const pts: string[] = []
  for (let i = 0; i + 1 < flat.length; i += 2) {
    pts.push(`${flat[i].toFixed(2)},${flat[i + 1].toFixed(2)}`)
  }
  return pts.join(' ')
}

function svgBlankRectEl(
  svg: SvgRenderOptions,
  shape: Shape,
  key: ShapeGuideKey,
  index: number
): string {
  const r = svg.getShapeGuideBlankRect(shape, key, index)
  return `<rect x="${r.x.toFixed(2)}" y="${r.y.toFixed(2)}" width="${r.width.toFixed(2)}" height="${r.height.toFixed(2)}" rx="${r.cornerRadius.toFixed(2)}" fill="white" stroke="${svg.blankBorderColor}" stroke-width="${svg.blankBorderWidthPx.toFixed(2)}"/>`
}

function svgKonvaTextEl(
  text: string,
  x: number,
  y: number,
  fontSize: number,
  fill: string,
  ff: string,
  options?: {
    offsetX?: number
    offsetY?: number
    rotation?: number
    rotationOriginX?: number
    rotationOriginY?: number
    extraAttrs?: string
  }
): string {
  const drawX = x - (options?.offsetX ?? 0)
  const drawY = y - (options?.offsetY ?? 0)
  const base = `text-anchor="start" dominant-baseline="hanging" font-family="${svgEsc(ff)}" font-size="${fontSize}" fill="${fill}" font-weight="normal"${options?.extraAttrs ?? ''}`
  const rotation = options?.rotation
    ? ` transform="rotate(${options.rotation} ${(options.rotationOriginX ?? x).toFixed(2)} ${(options.rotationOriginY ?? y).toFixed(2)})"`
    : ''
  return `<text x="${drawX.toFixed(2)}" y="${drawY.toFixed(2)}" ${base}${rotation}>${svgEsc(text)}</text>`
}

function svgHtmlEsc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

async function svgForeignObjectKatexEl(
  html: string,
  x: number,
  y: number,
  _width: number,
  _height: number,
  color: string,
  fontSize: number,
  fontFamily: string,
  options?: {
    rotation?: number
    originX?: number
    originY?: number
    align?: 'left' | 'center'
    baselineShiftPx?: number
  }
): Promise<string> {
  const align = options?.align || 'left'
  const baselineShiftPx = options?.baselineShiftPx ?? 0
  const sprite = await createLatexCanvasSprite({
    html,
    color,
    fontSize,
    fontFamily
  })
  const drawX = (align === 'center' ? x - (sprite.contentWidth * 0.5) : x) - sprite.insetX
  const drawY = (y + baselineShiftPx) - sprite.insetY
  const rotation = options?.rotation !== undefined
    ? ` transform="rotate(${options.rotation} ${(options.originX ?? x).toFixed(2)} ${(options.originY ?? y).toFixed(2)})"`
    : ''
  return `<image x="${drawX.toFixed(2)}" y="${drawY.toFixed(2)}" width="${sprite.width.toFixed(2)}" height="${sprite.height.toFixed(2)}" href="${svgHtmlEsc(sprite.image.src)}"${rotation}/>`
}

async function svgTextGuideSpriteEl(
  html: string,
  anchorX: number,
  anchorY: number,
  color: string,
  fontSize: number,
  fontFamily: string,
  rotation?: number
): Promise<string> {
  const sprite = await createLatexCanvasSprite({
    html,
    color,
    fontSize,
    fontFamily
  })
  const x = anchorX - ((sprite.contentWidth * 0.5) + sprite.insetX)
  const y = (anchorY - (fontSize * 0.9)) - sprite.insetY
  const transform = rotation !== undefined
    ? ` transform="rotate(${rotation} ${anchorX.toFixed(2)} ${anchorY.toFixed(2)})"`
    : ''
  return `<image x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${sprite.width.toFixed(2)}" height="${sprite.height.toFixed(2)}" href="${svgHtmlEsc(sprite.image.src)}"${transform}/>`
}

let katexSvgCssPromise: Promise<string> | null = null

async function getKatexSvgCss(embedFonts: boolean): Promise<string> {
  if (katexSvgCssPromise) return katexSvgCssPromise
  katexSvgCssPromise = (async () => {
    if (!embedFonts) return katexCssRaw
    const fontSources = [
      ['KaTeX_AMS-Regular.woff2', katexAmsRegularUrl],
      ['KaTeX_Caligraphic-Bold.woff2', katexCaligraphicBoldUrl],
      ['KaTeX_Caligraphic-Regular.woff2', katexCaligraphicRegularUrl],
      ['KaTeX_Fraktur-Bold.woff2', katexFrakturBoldUrl],
      ['KaTeX_Fraktur-Regular.woff2', katexFrakturRegularUrl],
      ['KaTeX_Main-Bold.woff2', katexMainBoldUrl],
      ['KaTeX_Main-BoldItalic.woff2', katexMainBoldItalicUrl],
      ['KaTeX_Main-Italic.woff2', katexMainItalicUrl],
      ['KaTeX_Main-Regular.woff2', katexMainRegularUrl],
      ['KaTeX_Math-BoldItalic.woff2', katexMathBoldItalicUrl],
      ['KaTeX_Math-Italic.woff2', katexMathItalicUrl],
      ['KaTeX_SansSerif-Bold.woff2', katexSansSerifBoldUrl],
      ['KaTeX_SansSerif-Italic.woff2', katexSansSerifItalicUrl],
      ['KaTeX_SansSerif-Regular.woff2', katexSansSerifRegularUrl],
      ['KaTeX_Script-Regular.woff2', katexScriptRegularUrl],
      ['KaTeX_Size1-Regular.woff2', katexSize1RegularUrl],
      ['KaTeX_Size2-Regular.woff2', katexSize2RegularUrl],
      ['KaTeX_Size3-Regular.woff2', katexSize3RegularUrl],
      ['KaTeX_Size4-Regular.woff2', katexSize4RegularUrl],
      ['KaTeX_Typewriter-Regular.woff2', katexTypewriterRegularUrl],
    ] as const
    const fontEntries = await Promise.all(
      fontSources.map(async ([fileName, url]) => [fileName, await fetchFontAsBase64(url)] as const)
    )
    let css = katexCssRaw
    for (const [fileName, dataUrl] of fontEntries) {
      css = css.replace(new RegExp(`fonts/${fileName.replace('.', '\\.')}`, 'g'), dataUrl)
    }
    return css
  })()
  return katexSvgCssPromise
}

async function generateVectorSVG(
  exportW: number,
  exportH: number,
  includeBackground: boolean,
  grayscale: boolean,
  embedFonts: boolean,
  svg: SvgRenderOptions
): Promise<string> {
  const canvasStore = useCanvasStore()
  const toolStore = useToolStore()
  const sw = svg.stageWidth.value
  const sh = svg.stageHeight.value
  const els: string[] = []
  const ff = svg.defaultTextFontFamily
  const fs = svg.defaultTextFontSize

  if (includeBackground) {
    const bgColor = toolStore.gridBackgroundColor || '#ffffff'
    els.push(`<rect x="0" y="0" width="${sw}" height="${sh}" fill="${bgColor}"/>`)
    if (toolStore.gridMode === 'grid') {
      const gs = GRID_CONFIG.size
      const major = GRID_CONFIG.majorInterval
      const lc = toolStore.gridLineColor || '#009FE3'
      const numC = Math.ceil(sw / gs) + 1
      const numR = Math.ceil(sh / gs) + 1
      for (let c = 0; c <= numC; c++) {
        const x = c * gs
        const isMaj = c % major === 0
        els.push(`<line x1="${x}" y1="0" x2="${x}" y2="${sh}" stroke="${lc}" stroke-width="${isMaj ? svg.gridMajorLineWidth : svg.gridMinorLineWidth}" opacity="${isMaj ? svg.gridMajorOpacity : svg.gridMinorOpacity}"/>`)
      }
      for (let r = 0; r <= numR; r++) {
        const y = r * gs
        const isMaj = r % major === 0
        els.push(`<line x1="0" y1="${y}" x2="${sw}" y2="${y}" stroke="${lc}" stroke-width="${isMaj ? svg.gridMajorLineWidth : svg.gridMinorLineWidth}" opacity="${isMaj ? svg.gridMajorOpacity : svg.gridMinorOpacity}"/>`)
      }
    } else if (toolStore.gridMode === 'dots') {
      const gs = GRID_CONFIG.size
      const lc = toolStore.gridLineColor || '#009FE3'
      const numC = Math.ceil(sw / gs)
      const numR = Math.ceil(sh / gs)
      for (let r = 0; r <= numR; r++) {
        for (let c = 0; c <= numC; c++) {
          els.push(`<circle cx="${c * gs}" cy="${r * gs}" r="${svg.gridDotRadius}" fill="${lc}" opacity="${svg.gridDotOpacity}"/>`)
        }
      }
    }
  } else {
    els.push(`<rect x="0" y="0" width="${sw}" height="${sh}" fill="#ffffff"/>`)
  }

  for (const shape of canvasStore.shapes) {
    if (shape.visible === false) continue
    const colors = svg.getColors(shape)
    const strokeW = svg.getShapeStrokeWidthPx(shape)
    const fillVal = colors.fill || 'none'

    if (shape.type === 'point' || shape.type === 'point-on-object') {
      const p = shape.points[0]
      if (!p) continue
      els.push(`<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="3" fill="${colors.point}"/>`)
    } else if (shape.type === 'circle') {
      if (shape.points.length < 2) continue
      const cp = shape.points[0]
      const r = svg.calculateDistancePixels(cp, shape.points[1])
      els.push(`<circle cx="${cp.x.toFixed(2)}" cy="${cp.y.toFixed(2)}" r="${r.toFixed(2)}" fill="${fillVal}" stroke="${colors.stroke}" stroke-width="${strokeW}"/>`)
    } else if (shape.type === 'arrow' || shape.type === 'arrow-curve') {
      const shaft = svg.getArrowShaftPoints(shape)
      const head = svg.getArrowHeadPoints(shape)
      if (shaft.length >= 4) {
        if (shape.type === 'arrow-curve' && shaft.length > 4) {
          els.push(`<polyline points="${svgPts(shaft)}" fill="none" stroke="${colors.stroke}" stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round"/>`)
        } else {
          els.push(`<line x1="${shaft[0].toFixed(2)}" y1="${shaft[1].toFixed(2)}" x2="${shaft[shaft.length - 2].toFixed(2)}" y2="${shaft[shaft.length - 1].toFixed(2)}" stroke="${colors.stroke}" stroke-width="${strokeW}"/>`)
        }
      }
      if (head.length >= 6) {
        els.push(`<polygon points="${svgPts(head)}" fill="${colors.stroke}" stroke="${colors.stroke}" stroke-width="${strokeW}" stroke-linejoin="round"/>`)
      }
    } else if (shape.type === 'ray') {
      const rayPts = svg.getExtendedRayPoints(shape.points)
      if (rayPts.length >= 4) {
        els.push(`<line x1="${rayPts[0].toFixed(2)}" y1="${rayPts[1].toFixed(2)}" x2="${rayPts[2].toFixed(2)}" y2="${rayPts[3].toFixed(2)}" stroke="${colors.stroke}" stroke-width="${strokeW}"/>`)
        const tipFrom = { x: (rayPts[0] + rayPts[2]) / 2, y: (rayPts[1] + rayPts[3]) / 2 }
        const tip = { x: rayPts[2], y: rayPts[3] }
        const head = svg.getArrowHeadPointsByTangent(tipFrom, tip)
        if (head.length >= 6) {
          els.push(`<polygon points="${svgPts(head)}" fill="${colors.stroke}" stroke="${colors.stroke}" stroke-width="${strokeW}"/>`)
        }
      }
    } else {
      const pts = svg.getRenderedShapePoints(shape)
      if (pts.length < 4) continue
      if (OPEN_SHAPE_TYPES.has(shape.type)) {
        els.push(`<polyline points="${svgPts(pts)}" fill="none" stroke="${colors.stroke}" stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round"/>`)
      } else {
        els.push(`<polygon points="${svgPts(pts)}" fill="${fillVal}" stroke="${colors.stroke}" stroke-width="${strokeW}" stroke-linejoin="round"/>`)
      }
    }

    for (let pi = 0; pi < shape.points.length; pi++) {
      if (!svg.isShapePointVisible(shape, pi)) continue
      const p = shape.points[pi]
      els.push(`<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="3" fill="${colors.point}"/>`)
    }

    if (shape.type !== 'circle' && toolStore.showLength && svg.isShapeGuideVisible(shape, 'length')) {
      for (const pi of svg.getShapeAutoLengthIndices(shape)) {
        if (!svg.isShapeGuideItemVisible(shape, 'length', pi)) continue
        const gSt = svg.getShapeGuideItemStyle(shape, 'length', pi)
        const lc = gSt.lineColor || svg.lengthGuideDefaultColor
        for (const seg of svg.getShapeLengthCurveSegments(shape, pi)) {
          if (seg.length >= 4) {
            els.push(`<polyline points="${svgPts(seg)}" fill="none" stroke="${lc}" stroke-width="${svg.defaultGuideLinePx}" stroke-dasharray="2 2"/>`)
          }
        }
        if (!svg.isShapeGuideItemBlank(shape, 'length', pi)) {
          const pos = svg.getShapeGuideLabelWorldPos(shape, 'length', pi)
          const text = svg.getShapeLengthValueText(shape, pi)
          const mainText = svg.stripGuideUnit(text)
          const fontSize = gSt.fontSize || fs
          const tc = svg.getShapeGuideTextColor(shape, 'length', pi, svg.getShapeGuideFallbackTextColor(shape, 'length', pi))
          if (text) {
            const displayText = toolStore.showGuideUnit ? `${mainText} cm` : mainText
            const width = svg.getTextWidthPx(displayText, fontSize) + 8
            els.push(await svgForeignObjectKatexEl(
              renderLatexLikeHtml(toLengthLatex(text, toolStore.showGuideUnit), true),
              pos.x,
              pos.y - fontSize * 0.45,
              width,
              fontSize * 2,
              tc,
              fontSize,
              svg.defaultTextFontFamily,
              { align: 'center' }
            ))
          }
        } else {
          els.push(svgBlankRectEl(svg, shape, 'length', pi))
          if (toolStore.showGuideUnit) {
            const upos = svg.getShapeGuideBlankTextPos(shape, 'length', pi, 'unit')
            const tc = svg.getShapeGuideTextColor(shape, 'length', pi, svg.getShapeGuideFallbackTextColor(shape, 'length', pi))
            const fontSize = gSt.fontSize || fs
            els.push(await svgForeignObjectKatexEl(
              renderLatexLikeHtml(toBlankUnitLatex(), true),
              upos.x,
              upos.y,
              fontSize * 3,
              fontSize * 2,
              tc,
              fontSize,
              svg.defaultTextFontFamily
            ))
          }
        }
      }
    }

    if (shape.type === 'circle' && toolStore.showLength && svg.isShapeGuideVisible(shape, 'radius') && svg.isShapeGuideItemVisible(shape, 'length', 0)) {
      const gSt = svg.getShapeGuideItemStyle(shape, 'length', 0)
      const { p1, p2 } = svg.getCircleLengthEndpoints(shape)
      const mainLineColor = gSt.lineColor || gSt.color || svg.defaultTextColor
      const mainLineWidth = gSt.lineWidth || svg.defaultGuideLinePx
      const lc = gSt.measureLineColor || gSt.lineColor || gSt.color || svg.lengthGuideDefaultColor
      els.push(`<line x1="${p1.x.toFixed(2)}" y1="${p1.y.toFixed(2)}" x2="${p2.x.toFixed(2)}" y2="${p2.y.toFixed(2)}" stroke="${mainLineColor}" stroke-width="${mainLineWidth}"/>`)
      for (const seg of svg.getCircleLengthCurveSegments(shape)) {
        if (seg.length >= 4) {
          els.push(`<polyline points="${svgPts(seg)}" fill="none" stroke="${lc}" stroke-width="${svg.defaultGuideLinePx}" stroke-dasharray="2 2"/>`)
        }
      }
      if (!svg.isShapeGuideItemBlank(shape, 'length', 0)) {
        const pos = svg.getCircleLengthLabelWorldPos(shape)
        const text = svg.getCircleLengthValueText(shape)
        const mainText = svg.stripGuideUnit(text)
        const fontSize = gSt.fontSize || fs
        const tc = svg.getShapeGuideTextColor(shape, 'length', 0, svg.getShapeGuideFallbackTextColor(shape, 'length', 0))
        if (text) {
          const displayText = toolStore.showGuideUnit ? `${mainText} cm` : mainText
          const width = svg.getTextWidthPx(displayText, fontSize) + 8
          els.push(await svgForeignObjectKatexEl(
            renderLatexLikeHtml(toLengthLatex(text, toolStore.showGuideUnit), true),
            pos.x,
            pos.y - fontSize * 0.45,
            width,
            fontSize * 2,
            tc,
            fontSize,
            svg.defaultTextFontFamily,
            { align: 'center' }
          ))
        }
      } else {
        els.push(svgBlankRectEl(svg, shape, 'length', 0))
        if (toolStore.showGuideUnit) {
          const upos = svg.getShapeGuideBlankTextPos(shape, 'length', 0, 'unit')
          const tc = svg.getShapeGuideTextColor(shape, 'length', 0, svg.getShapeGuideFallbackTextColor(shape, 'length', 0))
          const fontSize = gSt.fontSize || fs
          els.push(await svgForeignObjectKatexEl(
            renderLatexLikeHtml(toBlankUnitLatex(), true),
            upos.x,
            upos.y,
            fontSize * 3,
            fontSize * 2,
            tc,
            fontSize,
            svg.defaultTextFontFamily
          ))
        }
      }
    }

    if (toolStore.showHeight && svg.isShapeGuideVisible(shape, 'height') && svg.isShapeGuideItemVisible(shape, 'height', 0)) {
      const hg = svg.getShapeHeightGuide(shape)
      if (hg) {
        const hSt = svg.getShapeGuideItemStyle(shape, 'height', 0)
        const hc = hSt.heightLineColor || svg.heightGuideDefaultColor
        const hLW = hSt.heightLineWidth ? hSt.heightLineWidth * svg.ptToPx : svg.defaultHeightGuideLinePx
        const mc = hSt.measureLineColor || svg.lengthGuideDefaultColor
        els.push(`<line x1="${hg.apex.x.toFixed(2)}" y1="${hg.apex.y.toFixed(2)}" x2="${hg.foot.x.toFixed(2)}" y2="${hg.foot.y.toFixed(2)}" stroke="${hc}" stroke-width="${hLW}" stroke-dasharray="2 2"/>`)
        if (hg.t < 0 || hg.t > 1) {
          const anchor = hg.t < 0 ? hg.baseA : hg.baseB
          els.push(`<line x1="${anchor.x.toFixed(2)}" y1="${anchor.y.toFixed(2)}" x2="${hg.foot.x.toFixed(2)}" y2="${hg.foot.y.toFixed(2)}" stroke="${hc}" stroke-width="${hLW}" stroke-dasharray="2 2"/>`)
        }
        const marker = svg.getShapeHeightRightAngleMarkerPoints(shape)
        if (marker.length >= 6) {
          els.push(`<polyline points="${svgPts(marker)}" fill="none" stroke="${svg.angleGuideDefaultColor}" stroke-width="${svg.defaultGuideLinePx}"/>`)
        }
        for (const seg of svg.getShapeHeightLengthGuideSegments(shape)) {
          if (seg.length >= 4) {
            els.push(`<polyline points="${svgPts(seg)}" fill="none" stroke="${mc}" stroke-width="${svg.defaultGuideLinePx}" stroke-dasharray="2 2"/>`)
          }
        }
        if (!svg.isShapeGuideItemBlank(shape, 'height', 0)) {
          const pos = svg.getShapeGuideLabelWorldPos(shape, 'height', 0)
          const text = svg.getShapeHeightValueText(shape)
          const mainText = svg.stripGuideUnit(text)
          const fontSize = hSt.fontSize || fs
          const tc = svg.getShapeGuideTextColor(shape, 'height', 0, svg.getShapeGuideFallbackTextColor(shape, 'height', 0))
          if (text) {
            const displayText = toolStore.showGuideUnit ? `${mainText} cm` : mainText
            const width = svg.getTextWidthPx(displayText, fontSize) + 8
            els.push(await svgForeignObjectKatexEl(
              renderLatexLikeHtml(toLengthLatex(text, toolStore.showGuideUnit), true),
              pos.x,
              pos.y - fontSize * 0.45,
              width,
              fontSize * 2,
              tc,
              fontSize,
              svg.defaultTextFontFamily,
              { align: 'center' }
            ))
          }
        } else {
          els.push(svgBlankRectEl(svg, shape, 'height', 0))
          if (toolStore.showGuideUnit) {
            const upos = svg.getShapeGuideBlankTextPos(shape, 'height', 0, 'unit')
            const tc = svg.getShapeGuideTextColor(shape, 'height', 0, svg.getShapeGuideFallbackTextColor(shape, 'height', 0))
            const fontSize = hSt.fontSize || fs
            els.push(await svgForeignObjectKatexEl(
              renderLatexLikeHtml(toBlankUnitLatex(), true),
              upos.x,
              upos.y,
              fontSize * 3,
              fontSize * 2,
              tc,
              fontSize,
              svg.defaultTextFontFamily
            ))
          }
        }
      }
    }

    if (toolStore.showAngle && svg.isShapeGuideVisible(shape, 'angle')) {
      for (const ai of svg.getShapeAutoAngleIndices(shape, toolStore.angleDisplayMode)) {
        if (!svg.isShapeGuideItemVisible(shape, 'angle', ai)) continue
        const aSt = svg.getShapeGuideItemStyle(shape, 'angle', ai)
        const lc = aSt.lineColor || svg.angleGuideDefaultColor
        const gLW = aSt.lineWidth ? aSt.lineWidth * svg.ptToPx : svg.defaultGuideLinePx
        if (svg.isRightAngleAt(shape, ai)) {
          const mp = svg.getRightAngleMarkerPoints(shape.points, ai)
          if (mp) {
            els.push(`<polyline points="${mp.p1.x.toFixed(2)},${mp.p1.y.toFixed(2)} ${mp.corner.x.toFixed(2)},${mp.corner.y.toFixed(2)} ${mp.p2.x.toFixed(2)},${mp.p2.y.toFixed(2)}" fill="none" stroke="${lc}" stroke-width="${gLW}"/>`)
          }
        } else if (toolStore.angleDisplayMode === 'all' || shape.type === 'angle-line') {
          const arcPts = svg.getShapeAngleArcPolyline(shape, ai)
          if (arcPts.length >= 4) {
            els.push(`<polyline points="${svgPts(arcPts)}" fill="none" stroke="${lc}" stroke-width="${gLW}"/>`)
          }
        }
        if (!svg.isShapeGuideItemBlank(shape, 'angle', ai)) {
          const pos = svg.getShapeGuideLabelWorldPos(shape, 'angle', ai)
          const fontSize = aSt.fontSize || fs
          const exportFontSize = Number((fontSize * SVG_ANGLE_FONT_SCALE).toFixed(2))
          if (svg.shouldRenderShapeAngleText(shape, ai, toolStore.angleDisplayMode)) {
            const text = svg.getShapeAngleValueText(shape, ai)
            const tc = svg.getShapeGuideTextColor(shape, 'angle', ai, svg.getShapeGuideFallbackTextColor(shape, 'angle', ai))
            const width = svg.getTextWidthPx(text.replace(/°$/, '') + '°', exportFontSize) + 8
            els.push(await svgForeignObjectKatexEl(
              renderLatexLikeHtml(toAngleLatex(text), true),
              pos.x,
              pos.y - svg.getShapeAngleTextOffsetY(shape, ai, exportFontSize),
              width,
              exportFontSize * 2,
              tc,
              exportFontSize,
              svg.defaultTextFontFamily,
              { align: 'center' }
            ))
          }
        } else {
          els.push(svgBlankRectEl(svg, shape, 'angle', ai))
          const spos = svg.getShapeGuideBlankTextPos(shape, 'angle', ai, 'suffix')
          const tc = svg.getShapeGuideTextColor(shape, 'angle', ai, svg.getShapeGuideFallbackTextColor(shape, 'angle', ai))
          const fontSize = aSt.fontSize || fs
          const exportFontSize = Number((fontSize * SVG_ANGLE_FONT_SCALE).toFixed(2))
          els.push(await svgForeignObjectKatexEl(
            renderLatexLikeHtml(toBlankAngleLatex(), true),
            spos.x - 3,
            spos.y - 3,
            exportFontSize * 2,
            exportFontSize * 2,
            tc,
            exportFontSize,
            svg.defaultTextFontFamily
          ))
        }
      }
    }

    if (toolStore.showPointName && svg.isShapeGuideVisible(shape, 'pointName')) {
      for (let pi = 0; pi < shape.points.length; pi++) {
        if (!svg.isShapeGuideItemVisible(shape, 'pointName', pi)) continue
        if (svg.isShapeGuideItemBlank(shape, 'pointName', pi)) {
          els.push(svgBlankRectEl(svg, shape, 'pointName', pi))
          continue
        }
        const pos = svg.getShapePointNameTextPos(shape, pi)
        const label = svg.getGlobalPointLabel(shape.id, pi)
        const tc = svg.getShapeGuideTextColor(shape, 'pointName', pi, svg.getShapeGuideFallbackTextColor(shape, 'pointName', pi))
        const pSt = svg.getShapeGuideItemStyle(shape, 'pointName', pi)
        const fontSize = pSt.fontSize || fs
        const exportFontSize = Number((fontSize * SVG_POINT_NAME_FONT_SCALE).toFixed(2))
        if (containsHangulText(label)) {
          els.push(svgKonvaTextEl(label, pos.x, pos.y, exportFontSize, tc, ff))
          continue
        }
        const width = Math.max(svg.getTextWidthPx(label, exportFontSize) + 24, exportFontSize * 4)
        els.push(await svgForeignObjectKatexEl(
          renderLatexLikeHtml(label, true),
          pos.x,
          pos.y,
          width,
          exportFontSize * 2,
          tc,
          exportFontSize,
          svg.defaultTextFontFamily
        ))
      }
    }
  }

  for (const guide of canvasStore.guides) {
    if (guide.visible === false) continue
    if (guide.type === 'text' && guide.text) {
      const gfs = guide.fontSize || fs
      const gc = guide.color || svg.defaultTextColor
      const anchor = svg.getTextGuideAnchor(guide)
      const rotation = svg.getTextGuideRotation(guide)
      if (!guide.useLatex && containsHangulText(guide.text)) {
        const displayText = svg.formatMathText(guide.text)
        const width = svg.getTextWidthPx(displayText, gfs)
        els.push(svgKonvaTextEl(displayText, anchor.x, anchor.y - (gfs * 0.45), gfs, gc, ff, {
          offsetX: width * 0.5,
          rotation,
          rotationOriginX: anchor.x,
          rotationOriginY: anchor.y
        }))
        continue
      }
      els.push(await svgTextGuideSpriteEl(
        renderLatexLikeHtml(toTextGuideLatex(guide.text, !!guide.useLatex), !!guide.useLatex),
        anchor.x,
        anchor.y,
        gc,
        gfs,
        svg.defaultTextFontFamily,
        rotation
      ))
    } else if (guide.type === 'blank-box' && guide.points.length >= 2) {
      const centerX = (guide.points[0].x + guide.points[1].x) / 2
      const centerY = (guide.points[0].y + guide.points[1].y) / 2
      const widthMm = Number(guide.blankWidthMm)
      const width = Math.max(8, (Number.isFinite(widthMm) ? widthMm : 7) * MM_TO_PX)
      const height = 7 * MM_TO_PX
      const x = centerX - width / 2
      const y = centerY - height / 2
      const cornerRadius = Math.min(height * 0.22, 8)
      els.push(`<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${width.toFixed(2)}" height="${height.toFixed(2)}" rx="${cornerRadius.toFixed(2)}" fill="#FFFFFF" stroke="${svg.blankBorderColor}" stroke-width="${svg.blankBorderWidthPx.toFixed(2)}"/>`)
      const suffixText = getBlankBoxSuffixText(guide)
      if (suffixText) {
        const unitMode = getBlankBoxUnitMode(guide)
        const gap = unitMode === 'cm' ? GRID_CONFIG.size / 2 : 4
        const fontSize = guide.fontSize || fs
        const latexOffset = getBlankBoxSuffixLatexOffset(unitMode)
        const suffixX = x + width + gap + latexOffset.x
        const suffixY = y + (height / 2) - (fontSize * 0.45) + latexOffset.y
        const suffixLatex = toBlankBoxSuffixLatex(unitMode)
        if (suffixLatex) {
          els.push(await svgForeignObjectKatexEl(
            renderLatexLikeHtml(suffixLatex, true),
            suffixX,
            suffixY,
            Math.max(fontSize * 3, 24),
            fontSize * 2,
            svg.defaultTextColor,
            fontSize,
            svg.defaultTextFontFamily
          ))
        } else {
          els.push(svgKonvaTextEl(suffixText, suffixX, suffixY, fontSize, svg.defaultTextColor, ff))
        }
      }
    } else if (guide.type === 'length' && guide.points.length >= 2 && toolStore.showLength) {
      const gc = guide.color || svg.lengthGuideDefaultColor
      const gLW = guide.lineWidth ? guide.lineWidth * svg.ptToPx : svg.defaultGuideLinePx
      for (const seg of [svg.getLengthGuideCurvePoints(guide)]) {
        if (seg.length >= 4) {
          els.push(`<polyline points="${svgPts(seg)}" fill="none" stroke="${gc}" stroke-width="${gLW}" stroke-dasharray="2 2"/>`)
        }
      }
      if (guide.text) {
        const lp = svg.getLengthGuideLabelPos(guide)
        els.push(svgKonvaTextEl(svg.formatMathText(svg.formatLengthGuideText(guide.text)), lp.x, lp.y - 16, guide.fontSize || fs, gc, ff, {
          offsetX: 20
        }))
      }
    } else if (guide.type === 'angle' && guide.points.length >= 3 && toolStore.showAngle) {
      const gc = guide.color || svg.angleGuideDefaultColor
      const gLW = guide.lineWidth ? guide.lineWidth * svg.ptToPx : svg.defaultGuideLinePx
      if (svg.isRightAngleGuide(guide.points)) {
        const marker = svg.getRightAngleGuideMarkerPoints(guide.points[0], guide.points[1], guide.points[2], svg.guideRightAngleMarkerSize)
        els.push(`<polyline points="${marker.p1.x.toFixed(2)},${marker.p1.y.toFixed(2)} ${marker.corner.x.toFixed(2)},${marker.corner.y.toFixed(2)} ${marker.p2.x.toFixed(2)},${marker.p2.y.toFixed(2)}" fill="none" stroke="${gc}" stroke-width="${gLW}"/>`)
      } else {
        const arcPts = svg.getAngleArcPoints(guide.points)
        if (arcPts.length >= 4) {
          els.push(`<polyline points="${svgPts(arcPts)}" fill="none" stroke="${gc}" stroke-width="${gLW}"/>`)
        }
      }
      if (guide.text) {
        const tp = guide.points[1]
        els.push(svgKonvaTextEl(svg.formatMathText(guide.text), tp.x + 24, tp.y - 18, guide.fontSize || fs, gc, ff))
      }
    }
  }

  const defsItems: string[] = []
  const styleItems: string[] = []
  try {
    styleItems.push(`<style>${svgEsc(await getKatexSvgCss(embedFonts))}</style>`)
  } catch (e) {
    console.warn('[SVG] katex css embedding failed, using fallback:', e)
  }
  if (grayscale) {
    defsItems.push(`<filter id="gs"><feColorMatrix type="saturate" values="0"/></filter>`)
  }
  const defsStr = defsItems.length ? `<defs>\n${defsItems.join('\n')}\n</defs>` : ''
  const body = grayscale
    ? `<g filter="url(#gs)">\n${els.join('\n')}\n</g>`
    : els.join('\n')
  const inner = [defsStr, ...styleItems, body].filter(Boolean).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${exportW}" height="${exportH}" viewBox="0 0 ${sw} ${sh}">\n${inner}\n</svg>`
}

export function useCanvasExport(options: UseCanvasExportOptions) {
  const {
    stageRef,
    canvasWidth,
    canvasHeight,
    alertRenderFailure,
    svg,
  } = options

  async function createPngDataUrl(
    width: number,
    height: number,
    exportOptions?: Pick<ExportOptions, 'includeBackground' | 'grayscale'>
  ): Promise<string | null> {
    const stage = stageRef.value?.getNode?.()
    if (!stage) return null

    const w = Math.max(100, width || canvasWidth)
    const h = Math.max(100, height || canvasHeight)
    const includeBackground = exportOptions?.includeBackground !== false
    const grayscale = exportOptions?.grayscale === true
    const pixelRatio = Math.max(w / canvasWidth, h / canvasHeight, 0.2)
    const backgroundNode = stage.findOne('.export-bg') as any
    const gridLayer = backgroundNode ? (backgroundNode.getLayer?.() ?? null) : null
    const prevGridLayerVisible = gridLayer ? gridLayer.visible() : true

    if (gridLayer && !includeBackground) {
      gridLayer.visible(false)
      stage.draw()
    }

    const prevSX = stage.scaleX()
    const prevSY = stage.scaleY()
    const prevSPX = stage.x()
    const prevSPY = stage.y()
    const prevSW = stage.width()
    const prevSH = stage.height()

    stage.width(canvasWidth)
    stage.height(canvasHeight)
    stage.scale({ x: 1, y: 1 })
    stage.position({ x: 0, y: 0 })

    try {
      const sourceCanvas = stage.toCanvas({ pixelRatio })
      const outputCanvas = document.createElement('canvas')
      outputCanvas.width = w
      outputCanvas.height = h
      const outputCtx = outputCanvas.getContext('2d')
      if (!outputCtx) throw new Error('2d context unavailable')
      outputCtx.imageSmoothingEnabled = true
      outputCtx.imageSmoothingQuality = 'high'
      outputCtx.clearRect(0, 0, w, h)
      if (!includeBackground) {
        outputCtx.fillStyle = '#FFFFFF'
        outputCtx.fillRect(0, 0, w, h)
      }
      const srcW = Math.round(canvasWidth * pixelRatio)
      const srcH = Math.round(canvasHeight * pixelRatio)
      outputCtx.drawImage(sourceCanvas, 0, 0, srcW, srcH, 0, 0, w, h)

      if (grayscale) {
        const imageData = outputCtx.getImageData(0, 0, w, h)
        const d = imageData.data
        for (let i = 0; i < d.length; i += 4) {
          const luma = Math.round(d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722)
          d[i] = luma
          d[i + 1] = luma
          d[i + 2] = luma
        }
        outputCtx.putImageData(imageData, 0, 0)
      }

      return outputCanvas.toDataURL('image/png')
    } catch (err) {
      console.error('[createPngDataUrl] render failed:', err)
      alertRenderFailure()
      return null
    } finally {
      stage.width(prevSW)
      stage.height(prevSH)
      stage.scale({ x: prevSX, y: prevSY })
      stage.position({ x: prevSPX, y: prevSPY })
      if (gridLayer && !includeBackground) {
        gridLayer.visible(prevGridLayerVisible)
        stage.draw()
      }
    }
  }

  async function exportImage(
    format: ExportFormat,
    width: number,
    height: number,
    dpi: number = 300,
    exportOptions?: ExportOptions
  ): Promise<boolean> {
    const w = Math.max(100, width || canvasWidth)
    const h = Math.max(100, height || canvasHeight)
    const dpiScale = Math.max(1, dpi / 96)
    const includeBackground = exportOptions?.includeBackground !== false
    const grayscale = exportOptions?.grayscale === true
    const embedFonts = format === 'svg'
      ? exportOptions?.embedFonts !== false
      : exportOptions?.embedFonts === true
    const baseName = sanitizeFilename(exportOptions?.fileName || '')
    const renderWidth = dpiScale > 1 ? Math.round(canvasWidth * dpiScale) : w
    const renderHeight = dpiScale > 1 ? Math.round(canvasHeight * dpiScale) : h
    const pngDataUrl = await createPngDataUrl(renderWidth, renderHeight, { includeBackground, grayscale })
    if (!pngDataUrl) return false

    if (format === 'png') {
      downloadDataUrl(pngDataUrl, `${baseName}.png`)
      return true
    }

    if (format === 'pdf') {
      const pxToMm = 1 / 3.7795
      const pdf = new jsPDF({
        orientation: w > h ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [w * pxToMm, h * pxToMm]
      })
      pdf.addImage(pngDataUrl, 'PNG', 0, 0, w * pxToMm, h * pxToMm)
      pdf.save(`${baseName}.pdf`)
      return true
    }

    const svgContent = await generateVectorSVG(w, h, includeBackground, grayscale, embedFonts, svg)
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${baseName}.svg`
    link.click()
    URL.revokeObjectURL(url)
    return true
  }

  return { exportImage, createPngDataUrl }
}


