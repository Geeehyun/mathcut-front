const tokenMap: Record<string, string> = {
  '\\alpha': 'α',
  '\\beta': 'β',
  '\\gamma': 'γ',
  '\\delta': 'δ',
  '\\theta': 'θ',
  '\\lambda': 'λ',
  '\\mu': 'μ',
  '\\pi': 'π',
  '\\sigma': 'σ',
  '\\phi': 'φ',
  '\\omega': 'ω',
  '\\Delta': 'Δ',
  '\\Theta': 'Θ',
  '\\Lambda': 'Λ',
  '\\Pi': 'Π',
  '\\Sigma': 'Σ',
  '\\Phi': 'Φ',
  '\\Omega': 'Ω',
  '\\sqrt': '√',
  '\\times': '×',
  '\\cdot': '·',
  '\\pm': '±',
  '\\neq': '≠',
  '\\leq': '≤',
  '\\geq': '≥',
  '\\infty': '∞',
  '\\angle': '∠',
  '\\triangle': '△',
  '\\perp': '⊥'
}

const superMap: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  'n': 'ⁿ', 'i': 'ⁱ'
}

const subMap: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ',
  'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ',
  'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ',
  'v': 'ᵥ', 'x': 'ₓ'
}

function mapChars(value: string, table: Record<string, string>): string {
  return [...value].map((ch) => table[ch] ?? ch).join('')
}

/**
 * Lightweight LaTeX-like formatter for canvas text.
 * Note: This is not full LaTeX rendering.
 */
export function formatMathText(input: string): string {
  let out = input ?? ''

  for (const [k, v] of Object.entries(tokenMap)) {
    out = out.split(k).join(v)
  }

  out = out.replace(/\^\{([^}]+)\}/g, (_, g1: string) => mapChars(g1, superMap))
  out = out.replace(/\^([A-Za-z0-9+\-=()])/g, (_, g1: string) => mapChars(g1, superMap))
  out = out.replace(/_\{([^}]+)\}/g, (_, g1: string) => mapChars(g1, subMap))
  out = out.replace(/_([A-Za-z0-9+\-=()])/g, (_, g1: string) => mapChars(g1, subMap))

  return out
}
