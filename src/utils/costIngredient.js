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
  if (WEIGHT_TO_GRAMS[unit]) return 'weight'
  if (VOLUME_TO_ML[unit]) return 'volume'
  if (COUNT_UNITS.has(unit)) return 'count'

  return null
}

function toBaseQuantity(quantity, unit) {
  const family = getUnitFamily(unit)

  if (family === 'weight') {
    return quantity * WEIGHT_TO_GRAMS[unit]
  }

  if (family === 'volume') {
    return quantity * VOLUME_TO_ML[unit]
  }

  if (family === 'count') {
    return quantity
  }

  return null
}

function convertUsingCustomRules(
  quantity,
  fromUnit,
  targetFamily,
  conversions
) {
  for (const rule of conversions) {
    if (
      rule.fromUnit === fromUnit &&
      rule.fromQuantity > 0 &&
      rule.toQuantity > 0
    ) {
      const toFamily = getUnitFamily(rule.toUnit)

      if (toFamily !== targetFamily) {
        continue
      }

      const multiplier =
        quantity / rule.fromQuantity

      return {
        quantity:
          multiplier * rule.toQuantity,
        unit: rule.toUnit,
      }
    }

    if (
      rule.toUnit === fromUnit &&
      rule.fromQuantity > 0 &&
      rule.toQuantity > 0
    ) {
      const fromFamily = getUnitFamily(rule.fromUnit)

      if (fromFamily !== targetFamily) {
        continue
      }

      const multiplier =
        quantity / rule.toQuantity

      return {
        quantity:
          multiplier * rule.fromQuantity,
        unit: rule.fromUnit,
      }
    }
  }

  return null
}

function getUsablePackages(
  packages,
  recipeQuantity,
  recipeUnit,
  conversions
) {
  const recipeFamily = getUnitFamily(recipeUnit)

  return packages
    .map((pkg) => {
      if (
        pkg.size == null ||
        pkg.size <= 0
      ) {
        return null
      }

      const packageFamily =
        getUnitFamily(pkg.unit)

      if (!packageFamily) {
        return null
      }

      let requiredAmountInPackageFamily = null

      if (packageFamily === recipeFamily) {
        requiredAmountInPackageFamily =
          toBaseQuantity(
            recipeQuantity,
            recipeUnit
          )
      } else {
        const converted =
          convertUsingCustomRules(
            recipeQuantity,
            recipeUnit,
            packageFamily,
            conversions
          )

        if (!converted) {
          return null
        }

        requiredAmountInPackageFamily =
          toBaseQuantity(
            converted.quantity,
            converted.unit
          )
      }

      const baseSize =
        toBaseQuantity(
          pkg.size,
          pkg.unit
        )

      if (
        requiredAmountInPackageFamily == null ||
        baseSize == null
      ) {
        return null
      }

      return {
        ...pkg,
        baseSize,
        requiredAmount:
          requiredAmountInPackageFamily,
        usablePrice:
          pkg.priceType === 'actual' &&
          pkg.price != null
            ? pkg.price
            : null,
      }
    })
    .filter(Boolean)
}

function getHighestActualUnitCost(packages) {
  const valid = packages.filter(
    (pkg) =>
      pkg.usablePrice != null &&
      pkg.baseSize > 0
  )

  if (!valid.length) {
    return null
  }

  return Math.max(
    ...valid.map(
      (pkg) =>
        pkg.usablePrice /
        pkg.baseSize
    )
  )
}

function calculateStoreCost(
  requiredAmount,
  packages
) {
  const priced = packages.filter(
    (pkg) =>
      pkg.usablePrice != null &&
      pkg.baseSize > 0
  )

  if (!priced.length) {
    return null
  }

  let bestCost = Infinity

  function search(
    index,
    amount,
    cost
  ) {
    if (amount >= requiredAmount) {
      bestCost = Math.min(
        bestCost,
        cost
      )
      return
    }

    if (
      index >= priced.length ||
      cost >= bestCost
    ) {
      return
    }

    const pkg = priced[index]

    const maxNeeded =
      Math.ceil(
        (requiredAmount - amount) /
          pkg.baseSize
      ) + 1

    const maxCount = Math.min(
      Math.max(maxNeeded, 0),
      20
    )

    for (
      let count = 0;
      count <= maxCount;
      count++
    ) {
      search(
        index + 1,
        amount +
          pkg.baseSize * count,
        cost +
          pkg.usablePrice * count
      )
    }
  }

  search(0, 0, 0)

  return Number.isFinite(bestCost)
    ? bestCost
    : null
}

export function calculateIngredientCost(
  recipeIngredient,
  packages,
  conversions = [],
  scaleFactor = 1
) {
  if (
    recipeIngredient.quantity == null ||
    !recipeIngredient.unit
  ) {
    return {
      usable: false,
      reason: 'No measurable quantity',
      usedCost: null,
      storeCost: null,
    }
  }

  const scaledQuantity =
    recipeIngredient.quantity *
    scaleFactor

  const usablePackages =
    getUsablePackages(
      packages,
      scaledQuantity,
      recipeIngredient.unit,
      conversions
    )

  if (!usablePackages.length) {
    return {
      usable: false,
      reason:
        'No compatible package units or custom conversion',
      usedCost: null,
      storeCost: null,
    }
  }

  const highestUnitCost =
    getHighestActualUnitCost(
      usablePackages
    )

  if (highestUnitCost == null) {
    return {
      usable: false,
      reason:
        'No compatible actual package price',
      usedCost: null,
      storeCost: null,
    }
  }

  const requiredAmount =
    usablePackages[0].requiredAmount

  return {
    usable: true,

    usedCost:
      requiredAmount *
      highestUnitCost,

    storeCost:
      calculateStoreCost(
        requiredAmount,
        usablePackages
      ),

    requiredAmount,
  }
}