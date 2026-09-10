const unicodeFractions = {
  '¼': 0.25,
  '½': 0.5,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875,
}

const unitAliases = {
  teaspoon: 'tsp', teaspoons: 'tsp', tsp: 'tsp',
  tablespoon: 'tbsp', tablespoons: 'tbsp', tbsp: 'tbsp',
  cup: 'cup', cups: 'cup',
  ounce: 'oz', ounces: 'oz', oz: 'oz',
  pound: 'lb', pounds: 'lb', lb: 'lb', lbs: 'lb',
  gram: 'g', grams: 'g', g: 'g',
  kilogram: 'kg', kilograms: 'kg', kg: 'kg',
  milliliter: 'ml', milliliters: 'ml', ml: 'ml',
  liter: 'l', liters: 'l', l: 'l',
  can: 'can', cans: 'can',
  package: 'package', packages: 'package', pkg: 'package',
  slice: 'slice', slices: 'slice',
  piece: 'count', pieces: 'count', count: 'count',
  clove: 'clove', cloves: 'clove',
  stick: 'stick', sticks: 'stick',
}

const multiWordUnits = {
  'fl oz': 'fl oz',
  'fluid ounce': 'fl oz',
  'fluid ounces': 'fl oz',
}

const prepNoteWords = new Set([
  'sliced', 'diced', 'chopped', 'minced', 'halved', 'quartered',
  'drained', 'rinsed', 'softened', 'melted', 'divided', 'peeled',
  'seeded', 'shredded', 'grated', 'crushed', 'beaten', 'whisked',
  'cubed', 'trimmed', 'thawed', 'cooled', 'warmed', 'toasted',
  'packed', 'zested', 'juiced',
])

const superscriptDigits = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
}

const subscriptDigits = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
  '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
}

function normalizeFractionCharacters(value) {
  return String(value || '')
    .replace(/⁄/g, '/')
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (char) => superscriptDigits[char])
    .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (char) => subscriptDigits[char])
}

function parseFraction(value) {
  if (!value) return null
  const normalized = normalizeFractionCharacters(value)

  if (unicodeFractions[normalized]) return unicodeFractions[normalized]

  if (normalized.includes('/')) {
    const [top, bottom] = normalized.split('/').map(Number)
    if (bottom) return top / bottom
  }

  const number = Number(normalized)
  return Number.isNaN(number) ? null : number
}

function parseQuantity(tokens) {
  if (!tokens.length) return { quantity: null, consumed: 0 }

  const first = normalizeFractionCharacters(tokens[0])
  const second = normalizeFractionCharacters(tokens[1])
  const whole = Number(first)

  if (
    !Number.isNaN(whole) &&
    second &&
    (second.includes('/') || unicodeFractions[second])
  ) {
    const fraction = parseFraction(second)
    if (fraction !== null) return { quantity: whole + fraction, consumed: 2 }
  }

  const mixedUnicode = first.match(/^(\d+)([¼½¾⅓⅔⅛⅜⅝⅞])$/)
  if (mixedUnicode) {
    return {
      quantity: Number(mixedUnicode[1]) + unicodeFractions[mixedUnicode[2]],
      consumed: 1,
    }
  }

  const parsed = parseFraction(first)
  if (parsed !== null) return { quantity: parsed, consumed: 1 }

  return { quantity: null, consumed: 0 }
}

function looksLikePrepNote(value) {
  const cleaned = value.trim().toLowerCase().replace(/[.;]+$/g, '')
  if (!cleaned || cleaned.length > 60) return false

  const words = cleaned
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z-]/g, ''))
    .filter(Boolean)

  if (!words.length || words.length > 7) return false
  if (words.some((word) => prepNoteWords.has(word))) return true

  return /^(cut|slice|chop|dice|mince|drain|rinse|peel|seed|shred|grate|crush|beat|whisk|cube|trim|thaw|cool|warm|toast|zest|juice)(ed|d)?\b/.test(cleaned)
}

export function splitIngredientNote(originalText) {
  const cleaned = normalizeFractionCharacters(originalText).trim().replace(/\s+/g, ' ')
  if (!cleaned.includes(',')) return { ingredientLine: cleaned, note: '' }

  const parts = cleaned.split(',')
  const candidate = parts[parts.length - 1].trim()

  if (!looksLikePrepNote(candidate)) {
    return { ingredientLine: cleaned, note: '' }
  }

  const ingredientLine = parts.slice(0, -1).join(',').trim()
  if (!ingredientLine) return { ingredientLine: cleaned, note: '' }

  return {
    ingredientLine,
    note: candidate.replace(/[.;]+$/g, '').trim(),
  }
}

export function parseIngredientLine(originalText) {
  const original = normalizeFractionCharacters(originalText).trim().replace(/\s+/g, ' ')
  const { ingredientLine, note } = splitIngredientNote(original)
  const tokens = ingredientLine.split(' ')
  const quantityResult = parseQuantity(tokens)

  let position = quantityResult.consumed
  let unit = null

  const twoWordCandidate = tokens
    .slice(position, position + 2)
    .join(' ')
    .toLowerCase()
    .replace(/[.,]/g, '')

  if (multiWordUnits[twoWordCandidate]) {
    unit = multiWordUnits[twoWordCandidate]
    position += 2
  } else {
    const possibleUnit = tokens[position]?.toLowerCase().replace(/[.,]/g, '')
    if (possibleUnit && unitAliases[possibleUnit]) {
      unit = unitAliases[possibleUnit]
      position += 1
    }
  }

  const ingredientText = tokens.slice(position).join(' ').trim()

  return {
    originalText: original,
    ingredientLine,
    quantity: quantityResult.quantity,
    unit,
    ingredientText,
    note,
  }
}

export function parseIngredientAlternatives(originalText) {
  const cleaned = normalizeFractionCharacters(originalText).trim().replace(/\s+/g, ' ')
  const pieces = cleaned.split(/\s+or\s+/i)

  if (pieces.length !== 2) {
    return { primary: parseIngredientLine(cleaned), substitute: null }
  }

  const rightStartsLikeAmount = /^(?:\d|[¼½¾⅓⅔⅛⅜⅝⅞])/.test(pieces[1].trim())
  if (!rightStartsLikeAmount) {
    return { primary: parseIngredientLine(cleaned), substitute: null }
  }

  const primary = parseIngredientLine(pieces[0])
  const substitute = parseIngredientLine(pieces[1])

  if (!primary.ingredientText || !substitute.ingredientText) {
    return { primary: parseIngredientLine(cleaned), substitute: null }
  }

  return { primary, substitute }
}
