const WEIGHT_TO_GRAMS = {
  g: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
}

const VOLUME_TO_ML = {
  ml: 1,
  l: 1000,
  'fl oz': 29.5735,
  tsp: 4.92892,
  tbsp: 14.7868,
  cup: 236.588,
}

const COUNT_UNITS = new Set([
  'count',
  'slice',
  'can',
  'package',
  'clove',
  'stick',
])

function getUnitFamily(unit) {
  if (WEIGHT_TO_GRAMS[unit]) {
    return 'weight'
  }

  if (VOLUME_TO_ML[unit]) {
    return 'volume'
  }

  if (COUNT_UNITS.has(unit)) {
    return 'count'
  }

  return null
}

function toBaseQuantity(quantity, unit) {
  const family =
    getUnitFamily(unit)

  if (family === 'weight') {
    return (
      quantity *
      WEIGHT_TO_GRAMS[unit]
    )
  }

  if (family === 'volume') {
    return (
      quantity *
      VOLUME_TO_ML[unit]
    )
  }

  if (family === 'count') {
    return quantity
  }

  return null
}

function convertWithinFamily(
  quantity,
  fromUnit,
  toUnit
) {
  const fromFamily =
    getUnitFamily(fromUnit)

  const toFamily =
    getUnitFamily(toUnit)

  if (
    !fromFamily ||
    fromFamily !== toFamily
  ) {
    return null
  }

  const baseAmount =
    toBaseQuantity(
      quantity,
      fromUnit
    )

  const targetBase =
    toBaseQuantity(
      1,
      toUnit
    )

  if (
    baseAmount == null ||
    targetBase == null
  ) {
    return null
  }

  return baseAmount / targetBase
}

function convertUsingRule(
  quantity,
  fromUnit,
  targetUnit,
  rule
) {
  if (
    !rule.fromQuantity ||
    !rule.toQuantity
  ) {
    return null
  }

  const sourceFamily =
    getUnitFamily(fromUnit)

  const ruleFromFamily =
    getUnitFamily(rule.fromUnit)

  const ruleToFamily =
    getUnitFamily(rule.toUnit)

  const targetFamily =
    getUnitFamily(targetUnit)

  // Forward:
  // recipe -> rule.fromUnit
  // then rule -> rule.toUnit
  // then to desired target unit
  if (
    sourceFamily ===
      ruleFromFamily &&
    ruleToFamily ===
      targetFamily
  ) {
    const amountInRuleUnit =
      convertWithinFamily(
        quantity,
        fromUnit,
        rule.fromUnit
      )

    if (amountInRuleUnit != null) {
      const converted =
        amountInRuleUnit *
        (rule.toQuantity /
          rule.fromQuantity)

      return convertWithinFamily(
        converted,
        rule.toUnit,
        targetUnit
      )
    }
  }

  // Reverse direction
  if (
    sourceFamily ===
      ruleToFamily &&
    ruleFromFamily ===
      targetFamily
  ) {
    const amountInRuleUnit =
      convertWithinFamily(
        quantity,
        fromUnit,
        rule.toUnit
      )

    if (amountInRuleUnit != null) {
      const converted =
        amountInRuleUnit *
        (rule.fromQuantity /
          rule.toQuantity)

      return convertWithinFamily(
        converted,
        rule.fromUnit,
        targetUnit
      )
    }
  }

  return null
}

function convertQuantity(
  quantity,
  fromUnit,
  targetUnit,
  conversions
) {
  if (
    quantity == null ||
    !fromUnit ||
    !targetUnit
  ) {
    return null
  }

  if (fromUnit === targetUnit) {
    return quantity
  }

  const direct =
    convertWithinFamily(
      quantity,
      fromUnit,
      targetUnit
    )

  if (direct != null) {
    return direct
  }

  for (const rule of conversions) {
    const converted =
      convertUsingRule(
        quantity,
        fromUnit,
        targetUnit,
        rule
      )

    if (converted != null) {
      return converted
    }
  }

  return null
}

const NUTRIENT_FIELDS = [
  'calories',
  'protein',
  'carbohydrates',
  'fat',
  'saturatedFat',
  'fiber',
  'sugar',
  'sodium',
]

export function calculateRecipeNutrition({
  recipeIngredients,
  nutritionByIngredient,
  conversionsByIngredient,
  scaleFactor = 1,
}) {
  const totals = {
    calories: 0,
    protein: 0,
    carbohydrates: 0,
    fat: 0,
    saturatedFat: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
  }

  let calculatedCount = 0
  let missingCount = 0

  for (
    const item of recipeIngredients
  ) {
    const nutrition =
      nutritionByIngredient[
        item.ingredientId
      ]

    if (
      !nutrition ||
      item.quantity == null ||
      !item.unit
    ) {
      missingCount++
      continue
    }

    if (
      !nutrition.basisAmount ||
      !nutrition.basisUnit
    ) {
      missingCount++
      continue
    }

    const quantity =
      item.quantity *
      scaleFactor

    const conversions =
      conversionsByIngredient[
        item.ingredientId
      ] || []

    const nutritionQuantity =
      convertQuantity(
        quantity,
        item.unit,
        nutrition.basisUnit,
        conversions
      )

    if (
      nutritionQuantity == null
    ) {
      missingCount++
      continue
    }

    const multiplier =
      nutritionQuantity /
      nutrition.basisAmount

    for (
      const field of NUTRIENT_FIELDS
    ) {
      const nutrient =
        nutrition[field]

      if (
        nutrient != null &&
        !Number.isNaN(
          Number(nutrient)
        )
      ) {
        totals[field] +=
          Number(nutrient) *
          multiplier
      }
    }

    calculatedCount++
  }

  return {
    totals,
    calculatedCount,
    missingCount,
    partial:
      missingCount > 0,
  }
}