const unicodeFractions = [
  { value: 0.125, text: '⅛' },
  { value: 0.25, text: '¼' },
  { value: 1 / 3, text: '⅓' },
  { value: 0.375, text: '⅜' },
  { value: 0.5, text: '½' },
  { value: 0.625, text: '⅝' },
  { value: 2 / 3, text: '⅔' },
  { value: 0.75, text: '¾' },
  { value: 0.875, text: '⅞' },
]

function nearlyEqual(a, b, tolerance = 0.03) {
  return Math.abs(a - b) <= tolerance
}

export function formatQuantity(value) {
  if (value == null || Number.isNaN(value)) return ''

  const rounded = Math.round(value * 1000) / 1000
  const whole = Math.floor(rounded)
  const decimal = rounded - whole

  if (nearlyEqual(decimal, 0)) {
    return String(whole)
  }

  const fraction = unicodeFractions.find((item) =>
    nearlyEqual(decimal, item.value)
  )

  if (fraction) {
    return whole > 0
      ? `${whole}${fraction.text}`
      : fraction.text
  }

  return String(Math.round(rounded * 100) / 100)
}

function convertToMetric(quantity, unit) {
  if (quantity == null || !unit) {
    return { quantity, unit }
  }

  switch (unit) {
    case 'tsp':
      return {
        quantity: quantity * 4.92892,
        unit: 'ml',
      }

    case 'tbsp':
      return {
        quantity: quantity * 14.7868,
        unit: 'ml',
      }

    case 'cup':
      return {
        quantity: quantity * 236.588,
        unit: 'ml',
      }

    case 'oz':
      return {
        quantity: quantity * 28.3495,
        unit: 'g',
      }

    case 'lb':
      return {
        quantity: quantity * 453.592,
        unit: 'g',
      }

    default:
      return { quantity, unit }
  }
}

function convertToUS(quantity, unit) {
  if (quantity == null || !unit) {
    return { quantity, unit }
  }

  switch (unit) {
    case 'ml':
      if (quantity >= 236.588) {
        return {
          quantity: quantity / 236.588,
          unit: 'cup',
        }
      }

      if (quantity >= 14.7868) {
        return {
          quantity: quantity / 14.7868,
          unit: 'tbsp',
        }
      }

      return {
        quantity: quantity / 4.92892,
        unit: 'tsp',
      }

    case 'l':
      return {
        quantity: quantity * 4.22675,
        unit: 'cup',
      }

    case 'g':
      if (quantity >= 453.592) {
        return {
          quantity: quantity / 453.592,
          unit: 'lb',
        }
      }

      return {
        quantity: quantity / 28.3495,
        unit: 'oz',
      }

    case 'kg':
      return {
        quantity: quantity * 2.20462,
        unit: 'lb',
      }

    default:
      return { quantity, unit }
  }
}

function normalizeMetric(quantity, unit) {
  if (quantity == null || !unit) {
    return { quantity, unit }
  }

  if (unit === 'ml' && quantity >= 1000) {
    return {
      quantity: quantity / 1000,
      unit: 'l',
    }
  }

  if (unit === 'g' && quantity >= 1000) {
    return {
      quantity: quantity / 1000,
      unit: 'kg',
    }
  }

  return { quantity, unit }
}

function normalizeUS(quantity, unit) {
  if (quantity == null || !unit) {
    return { quantity, unit }
  }

  if (unit === 'tsp' && quantity >= 3) {
    const tbsp = quantity / 3

    if (tbsp >= 4) {
      return {
        quantity: tbsp / 16,
        unit: 'cup',
      }
    }

    return {
      quantity: tbsp,
      unit: 'tbsp',
    }
  }

  if (unit === 'tbsp' && quantity >= 4) {
    return {
      quantity: quantity / 16,
      unit: 'cup',
    }
  }

  if (unit === 'oz' && quantity >= 16) {
    return {
      quantity: quantity / 16,
      unit: 'lb',
    }
  }

  return { quantity, unit }
}

export function displayUnit(unit, quantity) {
  if (!unit) return ''

  const plural = quantity !== 1

  const labels = {
    tsp: 'tsp',
    tbsp: 'tbsp',

    cup: plural ? 'cups' : 'cup',

    oz: 'oz',
    lb: 'lb',

    g: 'g',
    kg: 'kg',

    ml: 'ml',
    l: 'L',

    can: plural ? 'cans' : 'can',
    package: plural ? 'packages' : 'package',
    slice: plural ? 'slices' : 'slice',
    clove: plural ? 'cloves' : 'clove',
    stick: plural ? 'sticks' : 'stick',
  }

  return labels[unit] || unit
}

export function scaleIngredient(
  item,
  scaleFactor,
  measurementSystem = 'original'
) {
  if (item.quantity == null) {
    return {
      quantityText: '',
      unitText: '',
      ingredientText:
        item.parsedIngredientText || item.originalText,
      scalable: false,
    }
  }

  let quantity = item.quantity * scaleFactor
  let unit = item.unit

  if (measurementSystem === 'metric') {
    const converted = convertToMetric(quantity, unit)
    quantity = converted.quantity
    unit = converted.unit

    const normalized = normalizeMetric(quantity, unit)
    quantity = normalized.quantity
    unit = normalized.unit
  }

  if (measurementSystem === 'us') {
    const converted = convertToUS(quantity, unit)
    quantity = converted.quantity
    unit = converted.unit

    const normalized = normalizeUS(quantity, unit)
    quantity = normalized.quantity
    unit = normalized.unit
  }

  if (measurementSystem === 'original') {
    const normalized =
      unit === 'ml' ||
      unit === 'l' ||
      unit === 'g' ||
      unit === 'kg'
        ? normalizeMetric(quantity, unit)
        : normalizeUS(quantity, unit)

    quantity = normalized.quantity
    unit = normalized.unit
  }

  return {
    quantityText: formatQuantity(quantity),
    unitText: displayUnit(unit, quantity),
    ingredientText:
      item.parsedIngredientText || item.originalText,
    scalable: true,
  }
}