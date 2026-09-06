import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import UsdaNutritionLookup from './UsdaNutritionLookup'

const UNIT_GROUPS = {
  oz: 'weight',
  lb: 'weight',
  g: 'weight',
  kg: 'weight',

  ml: 'volume',
  l: 'volume',
  'fl oz': 'volume',
  tsp: 'volume',
  tbsp: 'volume',
  cup: 'volume',

  count: 'count',
  slice: 'count',
  can: 'count',
  package: 'count',
  clove: 'count',
  stick: 'count',
}

const CONVERSION_UNITS = [
  { value: 'tsp', label: 'tsp' },
  { value: 'tbsp', label: 'tbsp' },
  { value: 'cup', label: 'cup' },
  { value: 'fl oz', label: 'fl oz' },

  { value: 'ml', label: 'ml' },
  { value: 'l', label: 'L' },

  { value: 'oz', label: 'oz' },
  { value: 'lb', label: 'lb' },
  { value: 'g', label: 'g' },
  { value: 'kg', label: 'kg' },

  { value: 'count', label: 'count' },
  { value: 'slice', label: 'slice' },
  { value: 'can', label: 'can' },
  { value: 'package', label: 'package' },
  { value: 'clove', label: 'clove' },
  { value: 'stick', label: 'stick' },
]

function toBaseUnit(size, unit) {
  if (!size || !unit) return null

  switch (unit) {
    case 'oz':
      return size

    case 'lb':
      return size * 16

    case 'g':
      return size / 28.3495

    case 'kg':
      return (size * 1000) / 28.3495

    case 'ml':
      return size

    case 'l':
      return size * 1000

    case 'fl oz':
      return size * 29.5735

    case 'tsp':
      return size * 4.92892

    case 'tbsp':
      return size * 14.7868

    case 'cup':
      return size * 236.588

    case 'count':
    case 'slice':
    case 'can':
    case 'package':
    case 'clove':
    case 'stick':
      return size

    default:
      return null
  }
}

function formatMoney(value) {
  if (value == null || Number.isNaN(value)) {
    return ''
  }

  return value.toFixed(2)
}

function IngredientDetail({
  ingredient,
  onBack,
}) {
  const [name, setName] =
    useState(ingredient.name)

  const [staple, setStaple] =
    useState(Boolean(ingredient.staple))

  const [isIngredient, setIsIngredient] =
    useState(
      ingredient.isIngredient ?? true
    )

  const [
    isPreparedItem,
    setIsPreparedItem,
  ] = useState(
    ingredient.isPreparedItem ?? false
  )

  const [
    categoryInput,
    setCategoryInput,
  ] = useState('')

  const [
    variantInput,
    setVariantInput,
  ] = useState('')

  const [
    showNutrition,
    setShowNutrition,
  ] = useState(false)

  const categories = useLiveQuery(
    () =>
      db.ingredientCategories
        .where('ingredientId')
        .equals(ingredient.id)
        .toArray(),
    [ingredient.id]
  )

  const variants = useLiveQuery(
    () =>
      db.ingredientVariants
        .where('ingredientId')
        .equals(ingredient.id)
        .toArray(),
    [ingredient.id]
  )

  const packages = useLiveQuery(
    () =>
      db.ingredientPackages
        .where('ingredientId')
        .equals(ingredient.id)
        .toArray(),
    [ingredient.id]
  )

  const conversions = useLiveQuery(
    () =>
      db.ingredientConversions
        .where('ingredientId')
        .equals(ingredient.id)
        .toArray(),
    [ingredient.id]
  )

  const nutrition = useLiveQuery(
    () =>
      db.ingredientNutrition
        .where('ingredientId')
        .equals(ingredient.id)
        .first(),
    [ingredient.id]
  )

  useEffect(() => {
    setName(ingredient.name)
    setStaple(
      Boolean(ingredient.staple)
    )

    setIsIngredient(
      ingredient.isIngredient ?? true
    )

    setIsPreparedItem(
      ingredient.isPreparedItem ??
        false
    )
  }, [ingredient])

  const highestActualUnitCostByGroup =
    useMemo(() => {
      if (!packages?.length) {
        return {}
      }

      const result = {}

      for (const pkg of packages) {
        if (
          pkg.priceType !== 'actual' ||
          pkg.price == null ||
          pkg.size == null ||
          pkg.size <= 0
        ) {
          continue
        }

        const group =
          UNIT_GROUPS[pkg.unit]

        if (!group) continue

        const baseSize =
          toBaseUnit(
            pkg.size,
            pkg.unit
          )

        if (!baseSize || baseSize <= 0) {
          continue
        }

        const unitCost =
          pkg.price / baseSize

        if (
          result[group] == null ||
          unitCost > result[group]
        ) {
          result[group] = unitCost
        }
      }

      return result
    }, [packages])

  async function applyUsdaNutrition(data) {
  let id = nutrition?.id

  const nutritionData = {
    ingredientId:
      ingredient.id,

    basisType: 'weight',
    basisAmount: 100,
    basisUnit: 'g',

    calories: data.calories,
    protein: data.protein,
    carbohydrates:
      data.carbohydrates,
    fat: data.fat,
    saturatedFat:
      data.saturatedFat,
    fiber: data.fiber,
    sugar: data.sugar,
    sodium: data.sodium,

    source: 'USDA',
    sourceId: data.fdcId,
    sourceName:
      data.sourceName,

    updatedAt:
      new Date().toISOString(),
  }

  if (!id) {
    id =
      await db.ingredientNutrition.add({
        ...nutritionData,

        createdAt:
          new Date().toISOString(),
      })
  } else {
    await db.ingredientNutrition.update(
      id,
      nutritionData
    )
  }

  const oldUsdaConversions =
    await db.ingredientConversions
      .where('ingredientId')
      .equals(ingredient.id)
      .filter(
        (item) =>
          item.source === 'USDA'
      )
      .toArray()

  for (
    const conversion of
      oldUsdaConversions
  ) {
    await db.ingredientConversions.delete(
      conversion.id
    )
  }

  for (
    const conversion of
      data.conversions || []
  ) {
    await db.ingredientConversions.add({
      ingredientId:
        ingredient.id,

      fromQuantity:
        conversion.fromQuantity,

      fromUnit:
        conversion.fromUnit,

      toQuantity:
        conversion.toQuantity,

      toUnit:
        conversion.toUnit,

      source: 'USDA',

      createdAt:
        new Date().toISOString(),

      updatedAt:
        new Date().toISOString(),
    })
  }
}

  async function saveBasics() {
    if (
      !isIngredient &&
      !isPreparedItem
    ) {
      alert(
        'Choose at least one item role.'
      )
      return
    }

    await db.ingredients.update(
      ingredient.id,
      {
        name:
          name.trim() ||
          ingredient.name,

        staple,
        isIngredient,
        isPreparedItem,

        updatedAt:
          new Date().toISOString(),
      }
    )
  }

  async function addCategory() {
    const cleaned =
      categoryInput.trim()

    if (!cleaned) return

    const exists =
      await db.ingredientCategories
        .where('ingredientId')
        .equals(ingredient.id)
        .filter(
          (item) =>
            item.categoryName
              .toLowerCase() ===
            cleaned.toLowerCase()
        )
        .first()

    if (!exists) {
      await db.ingredientCategories.add({
        ingredientId:
          ingredient.id,

        categoryName: cleaned,
      })
    }

    setCategoryInput('')
  }

  async function removeCategory(id) {
    await db.ingredientCategories.delete(
      id
    )
  }

  async function addVariant() {
    const cleaned =
      variantInput.trim()

    if (!cleaned) return

    const exists =
      await db.ingredientVariants
        .where('ingredientId')
        .equals(ingredient.id)
        .filter(
          (item) =>
            item.name.toLowerCase() ===
            cleaned.toLowerCase()
        )
        .first()

    if (!exists) {
      await db.ingredientVariants.add({
        ingredientId:
          ingredient.id,

        name: cleaned,
      })
    }

    setVariantInput('')
  }

  async function removeVariant(id) {
    await db.ingredientVariants.delete(
      id
    )
  }

  async function addPackage() {
    const now =
      new Date().toISOString()

    await db.ingredientPackages.add({
      ingredientId:
        ingredient.id,

      variantId: null,

      size: 0,
      unit: 'oz',

      price: null,
      priceType: 'estimated',

      createdAt: now,
      updatedAt: now,
    })
  }

  async function updatePackage(
    id,
    field,
    value
  ) {
    const updates = {
      updatedAt:
        new Date().toISOString(),
    }

    if (field === 'size') {
      updates.size =
        value === ''
          ? null
          : Number(value)
    }

    if (field === 'unit') {
      updates.unit = value
    }

    if (field === 'price') {
      updates.price =
        value === ''
          ? null
          : Number(value)

      if (value !== '') {
        updates.priceType =
          'actual'
      }
    }

    await db.ingredientPackages.update(
      id,
      updates
    )
  }

  async function clearPackagePrice(
    id
  ) {
    await db.ingredientPackages.update(
      id,
      {
        price: null,

        priceType:
          'estimated',

        updatedAt:
          new Date().toISOString(),
      }
    )
  }

  async function removePackage(id) {
    await db.ingredientPackages.delete(
      id
    )
  }

  function getEstimatedPrice(pkg) {
    if (
      pkg.priceType === 'actual' &&
      pkg.price != null
    ) {
      return null
    }

    if (
      pkg.size == null ||
      pkg.size <= 0 ||
      !pkg.unit
    ) {
      return null
    }

    const group =
      UNIT_GROUPS[pkg.unit]

    if (!group) return null

    const unitCost =
      highestActualUnitCostByGroup[
        group
      ]

    if (unitCost == null) {
      return null
    }

    const baseSize =
      toBaseUnit(
        pkg.size,
        pkg.unit
      )

    if (!baseSize) return null

    return unitCost * baseSize
  }

  async function addConversion() {
    const now =
      new Date().toISOString()

    await db.ingredientConversions.add({
      ingredientId:
        ingredient.id,

      fromQuantity: 1,
      fromUnit: 'tbsp',

      toQuantity: null,
      toUnit: 'g',

      createdAt: now,
      updatedAt: now,
    })
  }

  async function updateConversion(
    id,
    field,
    value
  ) {
    const numericFields = [
      'fromQuantity',
      'toQuantity',
    ]

    await db.ingredientConversions.update(
      id,
      {
        [field]:
          numericFields.includes(field)
            ? value === ''
              ? null
              : Number(value)
            : value,

        updatedAt:
          new Date().toISOString(),
      }
    )
  }

  async function removeConversion(id) {
    await db.ingredientConversions.delete(
      id
    )
  }

  async function ensureNutritionRecord() {
    if (nutrition) {
      return nutrition.id
    }

    return db.ingredientNutrition.add({
      ingredientId: ingredient.id,
      basisType: 'weight',
      basisAmount: 100,
      basisUnit: 'g',

      calories: null,
      protein: null,
      carbohydrates: null,
      fat: null,
      saturatedFat: null,
      fiber: null,
      sugar: null,
      sodium: null,

      source: 'manual',
      sourceId: null,
      sourceName: null,

      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }

  async function updateNutrition(
    field,
    value
  ) {
    const id =
      await ensureNutritionRecord()

    const numericFields = [
      'basisAmount',
      'calories',
      'protein',
      'carbohydrates',
      'fat',
      'saturatedFat',
      'fiber',
      'sugar',
      'sodium',
    ]

    await db.ingredientNutrition.update(
      id,
      {
        [field]:
          numericFields.includes(field)
            ? value === ''
              ? null
              : Number(value)
            : value,

        updatedAt:
          new Date().toISOString(),
      }
    )
  }

  return (
    <div className="ingredient-detail">
      <div className="recipe-detail-top">
        <button
          className="text-button"
          onClick={onBack}
        >
          ← Back
        </button>

        <button
          className="primary-button compact"
          onClick={saveBasics}
        >
          Save
        </button>
      </div>

      <div className="ingredient-detail-header">
        <div className="ingredient-avatar large">
          {name
            .charAt(0)
            .toUpperCase()}
        </div>

        <div>
          <p className="eyebrow">
            Master Item
          </p>

          <h2>{name}</h2>
        </div>
      </div>

      <section className="ingredient-detail-section">
        <label>
          Item name

          <input
            type="text"
            value={name}
            onChange={(event) =>
              setName(
                event.target.value
              )
            }
          />
        </label>

        <div className="item-role-card">
          <strong>
            How can this item be used?
          </strong>

          <label className="role-checkbox">
            <input
              type="checkbox"
              checked={isIngredient}
              onChange={(event) =>
                setIsIngredient(
                  event.target.checked
                )
              }
            />

            <span>
              <strong>
                Ingredient
              </strong>

              <small>
                Can be used inside
                recipes.
              </small>
            </span>
          </label>

          <label className="role-checkbox">
            <input
              type="checkbox"
              checked={
                isPreparedItem
              }
              onChange={(event) =>
                setIsPreparedItem(
                  event.target.checked
                )
              }
            />

            <span>
              <strong>
                Prepared grocery item
              </strong>

              <small>
                Can be used as an
                optional side or
                ready-made item.
              </small>
            </span>
          </label>
        </div>

        <label className="toggle-row">
          <div>
            <strong>
              Staple / Check First
            </strong>

            <span>
              Ask whether this is
              already on hand before
              adding it to a grocery
              list.
            </span>
          </div>

          <input
            type="checkbox"
            checked={staple}
            onChange={(event) =>
              setStaple(
                event.target.checked
              )
            }
          />
        </label>
      </section>

      <section className="ingredient-detail-section">
        <div className="section-heading">
          <h3>
            Grocery Categories
          </h3>
        </div>

        <div className="chip-list">
          {categories?.map(
            (category) => (
              <button
                key={category.id}
                className="editable-chip"
                onClick={() =>
                  removeCategory(
                    category.id
                  )
                }
              >
                {category.categoryName}{' '}
                ×
              </button>
            )
          )}
        </div>

        <div className="inline-add-row">
          <input
            type="text"
            value={categoryInput}
            onChange={(event) =>
              setCategoryInput(
                event.target.value
              )
            }
            placeholder="Dairy, Frozen, Dessert/Snack..."
            onKeyDown={(event) => {
              if (
                event.key === 'Enter'
              ) {
                event.preventDefault()
                addCategory()
              }
            }}
          />

          <button
            type="button"
            onClick={addCategory}
          >
            Add
          </button>
        </div>
      </section>

      <section className="ingredient-detail-section">
        <div className="section-heading">
          <h3>Variants</h3>
        </div>

        <div className="chip-list">
          {variants?.map(
            (variant) => (
              <button
                key={variant.id}
                className="editable-chip"
                onClick={() =>
                  removeVariant(
                    variant.id
                  )
                }
              >
                {variant.name} ×
              </button>
            )
          )}
        </div>

        <div className="inline-add-row">
          <input
            type="text"
            value={variantInput}
            onChange={(event) =>
              setVariantInput(
                event.target.value
              )
            }
            placeholder="Mild, Medium, Sharp..."
            onKeyDown={(event) => {
              if (
                event.key === 'Enter'
              ) {
                event.preventDefault()
                addVariant()
              }
            }}
          />

          <button
            type="button"
            onClick={addVariant}
          >
            Add
          </button>
        </div>
      </section>

      <section className="ingredient-detail-section">
        <div className="section-heading">
          <div>
            <h3>
              Package Sizes & Pricing
            </h3>

            <p className="field-help">
              Missing prices are
              estimated using the
              highest known actual
              cost per comparable unit.
            </p>
          </div>

          <button
            className="text-button"
            onClick={addPackage}
          >
            + Package
          </button>
        </div>

        {!packages?.length ? (
          <div className="empty-detail-block">
            <strong>
              No package sizes yet
            </strong>

            <span>
              Add common package
              sizes and prices when
              you know them.
            </span>
          </div>
        ) : (
          <div className="package-list">
            {packages.map((pkg) => {
              const estimatedPrice =
                getEstimatedPrice(pkg)

              const shownPrice =
                pkg.priceType ===
                'actual'
                  ? pkg.price
                  : estimatedPrice

              return (
                <div
                  className={`package-row ${
                    pkg.priceType ===
                    'estimated'
                      ? 'estimated-package'
                      : ''
                  }`}
                  key={pkg.id}
                >
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      pkg.size ?? ''
                    }
                    onChange={(event) =>
                      updatePackage(
                        pkg.id,
                        'size',
                        event.target.value
                      )
                    }
                    placeholder="16"
                  />

                  <select
                    value={
                      pkg.unit || 'oz'
                    }
                    onChange={(event) =>
                      updatePackage(
                        pkg.id,
                        'unit',
                        event.target.value
                      )
                    }
                  >
                    <option value="oz">
                      oz
                    </option>

                    <option value="lb">
                      lb
                    </option>

                    <option value="g">
                      g
                    </option>

                    <option value="kg">
                      kg
                    </option>

                    <option value="ml">
                      ml
                    </option>

                    <option value="l">
                      L
                    </option>

                    <option value="fl oz">
                      fl oz
                    </option>

                    <option value="count">
                      count
                    </option>
                  </select>

                  <div className="price-input-wrap">
                    <span>$</span>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        pkg.priceType ===
                        'actual'
                          ? pkg.price ?? ''
                          : shownPrice !=
                              null
                            ? formatMoney(
                                shownPrice
                              )
                            : ''
                      }
                      onChange={(event) =>
                        updatePackage(
                          pkg.id,
                          'price',
                          event.target.value
                        )
                      }
                      placeholder="3.00"
                    />
                  </div>

                  <div className="price-status">
                    {pkg.priceType ===
                    'actual' ? (
                      <>
                        <strong>
                          Actual
                        </strong>

                        <button
                          type="button"
                          className="text-button small"
                          onClick={() =>
                            clearPackagePrice(
                              pkg.id
                            )
                          }
                        >
                          Clear
                        </button>
                      </>
                    ) : (
                      <>
                        <strong>
                          Estimated
                        </strong>

                        {shownPrice ==
                          null && (
                          <span>
                            Add an actual
                            price to
                            estimate this
                            size.
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  <button
                    className="remove-row-button"
                    onClick={() =>
                      removePackage(
                        pkg.id
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="ingredient-detail-section">
        <div className="section-heading">
          <div>
            <h3>
              Custom Conversions
            </h3>

            <p className="field-help">
              Normal US and metric
              conversions happen
              automatically. Add a
              custom conversion only
              when this specific food
              needs one, such as
              1 tbsp peanut butter =
              16 g.
            </p>
          </div>

          <button
            className="text-button"
            onClick={addConversion}
          >
            + Conversion
          </button>
        </div>

        {!conversions?.length ? (
          <div className="empty-detail-block">
            <strong>
              No custom conversions
            </strong>

            <span>
              You only need these
              when normal metric/US
              conversion is not
              enough.
            </span>
          </div>
        ) : (
          <div className="conversion-list">
            {conversions.map(
              (conversion) => (
                <div
                  className="conversion-row"
                  key={conversion.id}
                >
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      conversion.fromQuantity ??
                      ''
                    }
                    onChange={(event) =>
                      updateConversion(
                        conversion.id,
                        'fromQuantity',
                        event.target.value
                      )
                    }
                  />

                  <select
                    value={
                      conversion.fromUnit
                    }
                    onChange={(event) =>
                      updateConversion(
                        conversion.id,
                        'fromUnit',
                        event.target.value
                      )
                    }
                  >
                    {CONVERSION_UNITS.map(
                      (unit) => (
                        <option
                          key={unit.value}
                          value={unit.value}
                        >
                          {unit.label}
                        </option>
                      )
                    )}
                  </select>

                  <span className="conversion-equals">
                    =
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      conversion.toQuantity ??
                      ''
                    }
                    onChange={(event) =>
                      updateConversion(
                        conversion.id,
                        'toQuantity',
                        event.target.value
                      )
                    }
                    placeholder="16"
                  />

                  <select
                    value={
                      conversion.toUnit
                    }
                    onChange={(event) =>
                      updateConversion(
                        conversion.id,
                        'toUnit',
                        event.target.value
                      )
                    }
                  >
                    {CONVERSION_UNITS.map(
                      (unit) => (
                        <option
                          key={unit.value}
                          value={unit.value}
                        >
                          {unit.label}
                        </option>
                      )
                    )}
                  </select>

                  <button
                    className="remove-row-button"
                    onClick={() =>
                      removeConversion(
                        conversion.id
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              )
            )}
          </div>
        )}
      </section>

      <section className="ingredient-detail-section">
        <button
          className="nutrition-expander"
          onClick={() =>
            setShowNutrition(
              (current) => !current
            )
          }
        >
          <span>
            <strong>
              Nutrition Data
            </strong>

            <small>
              Used to calculate
              estimated nutrition for
              recipes.
            </small>
          </span>

          <span>
            {showNutrition
              ? '▲'
              : '▼'}
          </span>
        </button>

        {showNutrition && (
          <div className="nutrition-panel">
            <UsdaNutritionLookup
              ingredientName={name}
              onSelect={applyUsdaNutrition}
            />

            <div className="nutrition-editor-grid">
              <label>
                Basis amount

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    nutrition?.basisAmount ??
                    100
                  }
                  onChange={(event) =>
                    updateNutrition(
                      'basisAmount',
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Basis unit

                <select
                  value={
                    nutrition?.basisUnit ??
                    'g'
                  }
                  onChange={(event) =>
                    updateNutrition(
                      'basisUnit',
                      event.target.value
                    )
                  }
                >
                  <option value="g">
                    g
                  </option>

                  <option value="ml">
                    ml
                  </option>

                  <option value="count">
                    count
                  </option>
                </select>
              </label>

              <label>
                Calories

                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={
                    nutrition?.calories ??
                    ''
                  }
                  onChange={(event) =>
                    updateNutrition(
                      'calories',
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Protein (g)

                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={
                    nutrition?.protein ??
                    ''
                  }
                  onChange={(event) =>
                    updateNutrition(
                      'protein',
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Carbohydrates (g)

                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={
                    nutrition?.carbohydrates ??
                    ''
                  }
                  onChange={(event) =>
                    updateNutrition(
                      'carbohydrates',
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Fat (g)

                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={
                    nutrition?.fat ??
                    ''
                  }
                  onChange={(event) =>
                    updateNutrition(
                      'fat',
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Saturated fat (g)

                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={
                    nutrition?.saturatedFat ??
                    ''
                  }
                  onChange={(event) =>
                    updateNutrition(
                      'saturatedFat',
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Fiber (g)

                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={
                    nutrition?.fiber ??
                    ''
                  }
                  onChange={(event) =>
                    updateNutrition(
                      'fiber',
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Sugar (g)

                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={
                    nutrition?.sugar ??
                    ''
                  }
                  onChange={(event) =>
                    updateNutrition(
                      'sugar',
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Sodium (mg)

                <input
                  type="number"
                  min="0"
                  step="1"
                  value={
                    nutrition?.sodium ??
                    ''
                  }
                  onChange={(event) =>
                    updateNutrition(
                      'sodium',
                      event.target.value
                    )
                  }
                />
              </label>
            </div>

            <p className="nutrition-source-note">
              Source:{' '}
              <strong>
                {nutrition?.sourceName ||
                  nutrition?.source ||
                  'Manual'}
              </strong>
            </p>
          </div>
        )}
      </section>
    </div>
  )
}

export default IngredientDetail