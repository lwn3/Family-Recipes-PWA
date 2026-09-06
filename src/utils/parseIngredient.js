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
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  tsp: 'tsp',

  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  tbsp: 'tbsp',

  cup: 'cup',
  cups: 'cup',

  ounce: 'oz',
  ounces: 'oz',
  oz: 'oz',

  pound: 'lb',
  pounds: 'lb',
  lb: 'lb',
  lbs: 'lb',

  gram: 'g',
  grams: 'g',
  g: 'g',

  kilogram: 'kg',
  kilograms: 'kg',
  kg: 'kg',

  milliliter: 'ml',
  milliliters: 'ml',
  ml: 'ml',

  liter: 'l',
  liters: 'l',
  l: 'l',

  can: 'can',
  cans: 'can',

  package: 'package',
  packages: 'package',
  pkg: 'package',

  slice: 'slice',
  slices: 'slice',

  piece: 'count',
  pieces: 'count',
  count: 'count',

  clove: 'clove',
  cloves: 'clove',

  stick: 'stick',
  sticks: 'stick',
}

const multiWordUnits = {
  'fl oz': 'fl oz',
  'fluid ounce': 'fl oz',
  'fluid ounces': 'fl oz',
}

function parseFraction(value) {
  if (!value) return null

  if (unicodeFractions[value]) {
    return unicodeFractions[value]
  }

  if (value.includes('/')) {
    const [top, bottom] = value.split('/').map(Number)

    if (bottom) {
      return top / bottom
    }
  }

  const number = Number(value)

  return Number.isNaN(number) ? null : number
}

function parseQuantity(tokens) {
  if (!tokens.length) {
    return {
      quantity: null,
      consumed: 0,
    }
  }

  const first = tokens[0]
  const second = tokens[1]

  const whole = Number(first)

  if (
    !Number.isNaN(whole) &&
    second &&
    (second.includes('/') || unicodeFractions[second])
  ) {
    const fraction = parseFraction(second)

    if (fraction !== null) {
      return {
        quantity: whole + fraction,
        consumed: 2,
      }
    }
  }

  const mixedUnicode = first.match(
    /^(\d+)([¼½¾⅓⅔⅛⅜⅝⅞])$/
  )

  if (mixedUnicode) {
    return {
      quantity:
        Number(mixedUnicode[1]) +
        unicodeFractions[mixedUnicode[2]],
      consumed: 1,
    }
  }

  const parsed = parseFraction(first)

  if (parsed !== null) {
    return {
      quantity: parsed,
      consumed: 1,
    }
  }

  return {
    quantity: null,
    consumed: 0,
  }
}

export function parseIngredientLine(originalText) {
  const cleaned = originalText
    .trim()
    .replace(/\s+/g, ' ')

  const tokens = cleaned.split(' ')

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
    const possibleUnit = tokens[position]
      ?.toLowerCase()
      .replace(/[.,]/g, '')

    if (possibleUnit && unitAliases[possibleUnit]) {
      unit = unitAliases[possibleUnit]
      position += 1
    }
  }

  const ingredientText = tokens
    .slice(position)
    .join(' ')
    .trim()

  return {
    originalText: cleaned,
    quantity: quantityResult.quantity,
    unit,
    ingredientText,
  }
}