import katex from 'katex'

function escapeLatexText(input: string): string {
  return input
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([{}$%#&_])/g, '\\$1')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/~/g, '\\textasciitilde{}')
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function containsHangul(input: string): boolean {
  return /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/.test(input)
}

export function renderLatexLikeHtml(input: string, useMathMode: boolean): string {
  const source = input || ''
  if (!source) return ''

  if (containsHangul(source)) {
    return `<span>${escapeHtml(source)}</span>`
  }

  if (!useMathMode) {
    return katex.renderToString(`\\text{${escapeLatexText(source)}}`, {
      throwOnError: false,
      displayMode: false,
      strict: 'ignore'
    })
  }

  try {
    return katex.renderToString(source, {
      throwOnError: true,
      displayMode: false,
      strict: 'ignore'
    })
  } catch {
    return katex.renderToString(`\\text{${escapeLatexText(source)}}`, {
      throwOnError: false,
      displayMode: false,
      strict: 'ignore'
    })
  }
}

export function toLengthLatex(text: string, withUnit: boolean): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  const mainText = trimmed.replace(/cm$/i, '').trim()
  if (!mainText) return ''
  return withUnit ? `${mainText}\\kern0.5em\\text{cm}` : mainText
}

export function toBlankUnitLatex(): string {
  return '\\text{cm}'
}

export function toBlankAngleLatex(): string {
  return '{}^\\circ'
}

export function toBlankBoxSuffixLatex(mode: 'none' | 'cm' | 'angle'): string {
  if (mode === 'cm') return toBlankUnitLatex()
  if (mode === 'angle') return toBlankAngleLatex()
  return ''
}

export function toAngleLatex(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  if (trimmed.endsWith('°')) {
    return `${trimmed.slice(0, -1).trim()}^\\circ`
  }
  return trimmed
}

export function formatTextGuideDisplayText(text: string): string {
  const source = text ?? ''
  return source.replace(/([0-9A-Za-z)\]}])\s*cm\b/gi, '$1 cm')
}

export function toTextGuideLatex(text: string, useMathMode: boolean): string {
  const source = text ?? ''
  if (!useMathMode) return source
  return source.replace(/([0-9A-Za-z)\]}])\s*cm\b/g, '$1\\kern0.5em\\text{cm}')
}
