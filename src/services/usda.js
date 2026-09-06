const BASE_URL = 'https://api.nal.usda.gov/fdc/v1'
const API_KEY = 'DEMO_KEY'

export async function searchUsdaFoods(query) {
  const response = await fetch(
    `${BASE_URL}/foods/search?api_key=${API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        pageSize: 12,
        dataType: [
          'Foundation',
          'SR Legacy',
          'Survey (FNDDS)',
        ],
      }),
    }
  )

  if (!response.ok) {
    throw new Error('USDA food search failed')
  }

  const data = await response.json()

  return data.foods || []
}

export async function getUsdaFood(fdcId) {
  const response = await fetch(
    `${BASE_URL}/food/${fdcId}?api_key=${API_KEY}`
  )

  if (!response.ok) {
    throw new Error('USDA food lookup failed')
  }

  return response.json()
}

function findNutrient(food, names, preferredUnit = null) {
  const nutrients = food.foodNutrients || []

  const matches = nutrients.filter((item) => {
    const nutrientName =
      item.nutrient?.name ||
      item.nutrientName ||
      ''

    return names.some(
      (name) =>
        nutrientName.toLowerCase() ===
        name.toLowerCase()
    )
  })

  if (!matches.length) {
    return null
  }

  if (preferredUnit) {
    const preferred = matches.find((item) => {
      const unit =
        item.nutrient?.unitName ||
        item.unitName ||
        ''

      return (
        unit.toLowerCase() ===
        preferredUnit.toLowerCase()
      )
    })

    if (preferred) {
      return (
        preferred.amount ??
        preferred.value ??
        null
      )
    }
  }

  return (
    matches[0]?.amount ??
    matches[0]?.value ??
    null
  )
}

function normalizePortionUnit(portion) {
  const measureName =
    portion.measureUnit?.name
      ?.toLowerCase()
      ?.trim() || ''

  const modifier =
    portion.modifier
      ?.toLowerCase()
      ?.trim() || ''

  const description =
    portion.portionDescription
      ?.toLowerCase()
      ?.trim() || ''

  const combined =
    `${measureName} ${modifier} ${description}`

  if (
    combined.includes('tablespoon') ||
    combined.includes('tbsp')
  ) {
    return 'tbsp'
  }

  if (
    combined.includes('teaspoon') ||
    combined.includes('tsp')
  ) {
    return 'tsp'
  }

  if (combined.includes('cup')) {
    return 'cup'
  }

  if (
    combined.includes('fluid ounce') ||
    combined.includes('fl oz')
  ) {
    return 'fl oz'
  }

  if (combined.includes('slice')) {
    return 'slice'
  }

  if (combined.includes('clove')) {
    return 'clove'
  }

  if (combined.includes('stick')) {
    return 'stick'
  }

  if (combined.includes('can')) {
    return 'can'
  }

  if (
    combined.includes('piece') ||
    combined.includes('each') ||
    combined.includes('item') ||
    combined.includes('unit')
  ) {
    return 'count'
  }

  return null
}

function extractPortionConversions(food) {
  const portions = food.foodPortions || []

  const conversions = []

  for (const portion of portions) {
    const unit =
      normalizePortionUnit(portion)

    const gramWeight =
      Number(portion.gramWeight)

    const amount =
      Number(portion.amount) || 1

    if (
      !unit ||
      !gramWeight ||
      gramWeight <= 0 ||
      amount <= 0
    ) {
      continue
    }

    conversions.push({
      fromQuantity: amount,
      fromUnit: unit,
      toQuantity: gramWeight,
      toUnit: 'g',
      source: 'USDA',
    })
  }

  return conversions
}

export function extractNutrition(food) {
  return {
    calories: findNutrient(
      food,
      ['Energy'],
      'kcal'
    ),

    protein: findNutrient(food, [
      'Protein',
    ]),

    carbohydrates: findNutrient(food, [
      'Carbohydrate, by difference',
    ]),

    fat: findNutrient(food, [
      'Total lipid (fat)',
    ]),

    saturatedFat: findNutrient(food, [
      'Fatty acids, total saturated',
    ]),

    fiber: findNutrient(food, [
      'Fiber, total dietary',
    ]),

    sugar: findNutrient(food, [
      'Sugars, total including NLEA',
      'Sugars, total',
    ]),

    sodium: findNutrient(food, [
      'Sodium, Na',
    ]),

    conversions:
      extractPortionConversions(food),
  }
}