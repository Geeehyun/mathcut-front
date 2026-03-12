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

export interface LatexCanvasSprite {
  image: HTMLImageElement
  width: number
  height: number
  contentWidth: number
  contentHeight: number
  insetX: number
  insetY: number
}

interface LatexCanvasSpriteOptions {
  html: string
  fontSize: number
  fontFamily: string
  color: string
}

const runtimeCss = (() => {
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

  let css = katexCssRaw
  for (const [fileName, url] of fontSources) {
    css = css.replace(new RegExp(`fonts/${fileName.replace('.', '\\.')}`, 'g'), url)
  }
  return css
})()

let measureHost: HTMLDivElement | null = null
const spritePromiseCache = new Map<string, Promise<LatexCanvasSprite>>()

function getMeasureHost(): HTMLDivElement {
  if (measureHost) return measureHost
  const host = document.createElement('div')
  host.style.position = 'fixed'
  host.style.left = '-100000px'
  host.style.top = '0'
  host.style.visibility = 'hidden'
  host.style.pointerEvents = 'none'
  host.style.whiteSpace = 'nowrap'
  host.style.zIndex = '-1'
  document.body.appendChild(host)
  measureHost = host
  return host
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function measureLatexHtml(options: LatexCanvasSpriteOptions): { width: number, height: number } {
  const wrapper = document.createElement('div')
  wrapper.style.display = 'inline-block'
  wrapper.style.color = options.color
  wrapper.style.fontSize = `${options.fontSize}px`
  wrapper.style.fontFamily = options.fontFamily
  wrapper.style.lineHeight = '1'
  wrapper.style.whiteSpace = 'nowrap'
  wrapper.style.textRendering = 'geometricPrecision'
  ;(wrapper.style as CSSStyleDeclaration & { webkitFontSmoothing?: string }).webkitFontSmoothing = 'antialiased'
  wrapper.innerHTML = options.html

  const host = getMeasureHost()
  host.appendChild(wrapper)
  const rect = wrapper.getBoundingClientRect()
  host.removeChild(wrapper)

  return {
    width: Math.max(1, Math.ceil(rect.width)),
    height: Math.max(1, Math.ceil(rect.height))
  }
}

function buildSvgMarkup(
  options: LatexCanvasSpriteOptions,
  width: number,
  height: number,
  insetX: number,
  insetY: number
): string {
  const contentLiftPx = Number((options.fontSize * 0.18).toFixed(2))
  const yLiftPx = Number((options.fontSize * 0.58).toFixed(2))
  const wrapperStyle = [
    'display:inline-block',
    'position:relative',
    `top:-${contentLiftPx}px`,
    `color:${options.color}`,
    `font-size:${options.fontSize}px`,
    `font-family:${options.fontFamily}`,
    'line-height:1',
    'white-space:nowrap',
    'text-rendering:geometricPrecision',
    '-webkit-font-smoothing:antialiased'
  ].join(';')

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    '<style>',
    escapeXml(runtimeCss),
    '</style>',
    `<foreignObject x="${insetX}" y="${Number((insetY - yLiftPx).toFixed(2))}" width="${Math.max(1, width - insetX * 2)}" height="${Math.max(1, height - insetY * 2)}" overflow="visible">`,
    `<div xmlns="http://www.w3.org/1999/xhtml" style="${escapeXml(wrapperStyle)}">${options.html}</div>`,
    '</foreignObject>',
    '</svg>'
  ].join('')
}

export function createLatexCanvasSprite(options: LatexCanvasSpriteOptions): Promise<LatexCanvasSprite> {
  const cacheKey = JSON.stringify(options)
  const cached = spritePromiseCache.get(cacheKey)
  if (cached) return cached

  const promise = new Promise<LatexCanvasSprite>((resolve, reject) => {
    const { width: contentWidth, height: contentHeight } = measureLatexHtml(options)
    const insetX = Math.max(2, Math.ceil(options.fontSize * 0.35))
    const insetY = Math.max(2, Math.ceil(options.fontSize * 0.85))
    const width = contentWidth + insetX * 2
    const height = contentHeight + insetY * 2
    const svg = buildSvgMarkup(options, width, height, insetX, insetY)
    const image = new Image()
    image.onload = () => resolve({
      image,
      width,
      height,
      contentWidth,
      contentHeight,
      insetX,
      insetY
    })
    image.onerror = (error) => reject(error)
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })

  spritePromiseCache.set(cacheKey, promise)
  return promise
}
