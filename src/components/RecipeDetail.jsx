import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import {
  scaleIngredient,
} from '../utils/scaleIngredient'
import {
  calculateIngredientCost,
} from '../utils/costIngredient'
import {
  calculateRecipeNutrition,
} from '../utils/calculateRecipeNutrition'

function money(value) {
  if (
    value == null ||
    Number.isNaN(value)
  ) {
    return '—'
  }

  return `$${value.toFixed(2)}`
}

function number(value, digits = 1) {
  if (
    value == null ||
    Number.isNaN(value)
  ) {
    return '—'
  }

  return value.toFixed(digits)
}

function RecipeDetail({
  recipe,
  activeProfile,
  onBack,
  onEdit,
}) {
  const [servings, setServings] =
    useState(recipe.servings || 1)

  const [
    measurementMode,
    setMeasurementMode,
  ] = useState('original')

  const [
    selectedAddOns,
    setSelectedAddOns,
  ] = useState({})

  const ingredients = useLiveQuery(
    () =>
      db.recipeIngredients
        .where('recipeId')
        .equals(recipe.id)
        .sortBy('sortOrder'),
    [recipe.id]
  )

  const directions = useLiveQuery(
    () =>
      db.recipeDirections
        .where('recipeId')
        .equals(recipe.id)
        .sortBy('sortOrder'),
    [recipe.id]
  )

  const addOns = useLiveQuery(
    () =>
      db.recipeAddOns
        .where('recipeId')
        .equals(recipe.id)
        .sortBy('sortOrder'),
    [recipe.id]
  )

  const recipeTags =
    useLiveQuery(
      async () => {
        const links =
          await db.recipeTags
            .where('recipeId')
            .equals(recipe.id)
            .toArray()

        const tags =
          await Promise.all(
            links.map((link) =>
              db.tags.get(link.tagId)
            )
          )

        return tags.filter(Boolean)
      },
      [recipe.id]
    )

  const favorite =
    useLiveQuery(
      () =>
        db.favorites
          .where('profileId')
          .equals(activeProfile.id)
          .filter(
            (item) =>
              item.recipeId ===
              recipe.id
          )
          .first(),
      [
        activeProfile.id,
        recipe.id,
      ]
    )

  const ingredientRecords =
    useLiveQuery(
      async () => {
        if (!ingredients?.length) {
          return {}
        }

        const result = {}

        for (const item of ingredients) {
          const ingredient =
            await db.ingredients.get(
              item.ingredientId
            )

          if (ingredient) {
            result[item.ingredientId] =
              ingredient
          }
        }

        return result
      },
      [ingredients]
    )

  const addOnRecords =
    useLiveQuery(
      async () => {
        if (!addOns?.length) {
          return {}
        }

        const result = {}

        for (const item of addOns) {
          const ingredient =
            await db.ingredients.get(
              item.ingredientId
            )

          if (ingredient) {
            result[item.ingredientId] =
              ingredient
          }
        }

        return result
      },
      [addOns]
    )

  const scaleFactor =
    servings /
    (recipe.servings || 1)

  const costSummary =
    useLiveQuery(
      async () => {
        if (!ingredients?.length) {
          return null
        }

        let usedCost = 0
        let storeCost = 0
        let usableCount = 0
        let missingCount = 0

        for (const item of ingredients) {
          const packages =
            await db.ingredientPackages
              .where('ingredientId')
              .equals(
                item.ingredientId
              )
              .toArray()

          const conversions =
            await db.ingredientConversions
              .where('ingredientId')
              .equals(
                item.ingredientId
              )
              .toArray()

          const result =
            calculateIngredientCost(
              item,
              packages,
              conversions,
              scaleFactor
            )

          if (!result.usable) {
            missingCount++
            continue
          }

          usedCost +=
            result.usedCost || 0

          storeCost +=
            result.storeCost || 0

          usableCount++
        }

        return {
          usedCost,
          storeCost,
          usableCount,
          missingCount,
        }
      },
      [ingredients, scaleFactor]
    )

  const nutritionSummary =
    useLiveQuery(
      async () => {
        if (!ingredients?.length) {
          return null
        }

        const nutritionByIngredient =
          {}

        const conversionsByIngredient =
          {}

        for (const item of ingredients) {
          const nutrition =
            await db.ingredientNutrition
              .where('ingredientId')
              .equals(
                item.ingredientId
              )
              .first()

          if (nutrition) {
            nutritionByIngredient[
              item.ingredientId
            ] = nutrition
          }

          const conversions =
            await db.ingredientConversions
              .where('ingredientId')
              .equals(
                item.ingredientId
              )
              .toArray()

          conversionsByIngredient[
            item.ingredientId
          ] = conversions
        }

        return calculateRecipeNutrition({
          recipeIngredients:
            ingredients,
          nutritionByIngredient,
          conversionsByIngredient,
          scaleFactor,
        })
      },
      [ingredients, scaleFactor]
    )

  const perServingNutrition =
    useMemo(() => {
      if (
        !nutritionSummary ||
        !servings
      ) {
        return null
      }

      const result = {}

      for (const [
        key,
        value,
      ] of Object.entries(
        nutritionSummary.totals
      )) {
        result[key] =
          value / servings
      }

      return result
    }, [
      nutritionSummary,
      servings,
    ])

  async function toggleFavorite() {
    if (favorite) {
      await db.favorites.delete(
        favorite.id
      )

      return
    }

    await db.favorites.add({
      profileId:
        activeProfile.id,

      recipeId:
        recipe.id,

      createdAt:
        new Date().toISOString(),
    })
  }

  function adjustServings(amount) {
    setServings((current) =>
      Math.max(
        0.5,
        current + amount
      )
    )
  }

  function setServingMultiplier(
    multiplier
  ) {
    setServings(
      (recipe.servings || 1) *
        multiplier
    )
  }

  function toggleAddOn(id) {
    setSelectedAddOns(
      (current) => ({
        ...current,
        [id]: !current[id],
      })
    )
  }

  return (
    <div className="recipe-detail">
      <div className="recipe-detail-top">
        <button
          className="text-button"
          onClick={onBack}
        >
          ← Back
        </button>

        <button
          className="favorite-button"
          onClick={toggleFavorite}
          aria-label="Favorite recipe"
        >
          {favorite ? '♥' : '♡'}
        </button>
      </div>

      <div className="recipe-detail-header">
        <p className="eyebrow">
          {recipe.mealType ||
            'Recipe'}
        </p>

        <h1>{recipe.title}</h1>

        <p className="recipe-artist">
          {activeProfile.name}
        </p>

        {recipeTags?.length > 0 && (
          <div className="chip-list">
            {recipeTags.map(
              (tag) => (
                <span
                  className="tag-chip"
                  key={tag.id}
                >
                  {tag.name}
                </span>
              )
            )}
          </div>
        )}
      </div>

      <section className="recipe-control-card">
        <div>
          <span className="control-label">
            Servings
          </span>

          <div className="serving-control">
            <button
              onClick={() =>
                adjustServings(-0.5)
              }
            >
              −
            </button>

            <strong>
              {servings}
            </strong>

            <button
              onClick={() =>
                adjustServings(0.5)
              }
            >
              +
            </button>
          </div>
        </div>

        <div className="serving-presets">
          {[0.5, 1, 1.5, 2].map(
            (multiplier) => (
              <button
                key={multiplier}
                onClick={() =>
                  setServingMultiplier(
                    multiplier
                  )
                }
              >
                {multiplier}×
              </button>
            )
          )}
        </div>

        <div>
          <span className="control-label">
            Measurements
          </span>

          <div className="measurement-toggle">
            {[
              'original',
              'us',
              'metric',
            ].map((mode) => (
              <button
                key={mode}
                className={
                  measurementMode ===
                  mode
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  setMeasurementMode(
                    mode
                  )
                }
              >
                {mode === 'original'
                  ? 'Original'
                  : mode === 'us'
                    ? 'US'
                    : 'Metric'}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="recipe-cost-card">
        <div className="section-heading">
          <div>
            <h3>
              Estimated Cost
            </h3>

            <p className="field-help">
              Based on saved package
              prices.
            </p>
          </div>
        </div>

        <div className="cost-grid">
          <div>
            <span>
              Per serving
            </span>

            <strong>
              {money(
                costSummary?.usedCost /
                  servings
              )}
            </strong>
          </div>

          <div>
            <span>
              Meal / batch
            </span>

            <strong>
              {money(
                costSummary?.usedCost
              )}
            </strong>
          </div>

          <div>
            <span>
              Store cost
            </span>

            <strong>
              {money(
                costSummary?.storeCost
              )}
            </strong>
          </div>
        </div>

        {costSummary?.missingCount >
          0 && (
          <p className="estimate-warning">
            Partial estimate —{' '}
            {
              costSummary.missingCount
            }{' '}
            ingredient
            {costSummary.missingCount ===
            1
              ? ''
              : 's'}{' '}
            could not be priced.
          </p>
        )}
      </section>

      <section className="recipe-nutrition-card">
        <div className="section-heading">
          <div>
            <h3>
              Estimated Nutrition
            </h3>

            <p className="field-help">
              Calculated from saved
              ingredient nutrition.
            </p>
          </div>
        </div>

        <div className="nutrition-summary">
          <div className="nutrition-summary-column">
            <h4>Per serving</h4>

            <div>
              <span>Calories</span>
              <strong>
                {number(
                  perServingNutrition?.calories,
                  0
                )}
              </strong>
            </div>

            <div>
              <span>Protein</span>
              <strong>
                {number(
                  perServingNutrition?.protein
                )}{' '}
                g
              </strong>
            </div>

            <div>
              <span>Carbs</span>
              <strong>
                {number(
                  perServingNutrition?.carbohydrates
                )}{' '}
                g
              </strong>
            </div>

            <div>
              <span>Fat</span>
              <strong>
                {number(
                  perServingNutrition?.fat
                )}{' '}
                g
              </strong>
            </div>

            <div>
              <span>
                Saturated fat
              </span>
              <strong>
                {number(
                  perServingNutrition?.saturatedFat
                )}{' '}
                g
              </strong>
            </div>

            <div>
              <span>Fiber</span>
              <strong>
                {number(
                  perServingNutrition?.fiber
                )}{' '}
                g
              </strong>
            </div>

            <div>
              <span>Sugar</span>
              <strong>
                {number(
                  perServingNutrition?.sugar
                )}{' '}
                g
              </strong>
            </div>

            <div>
              <span>Sodium</span>
              <strong>
                {number(
                  perServingNutrition?.sodium,
                  0
                )}{' '}
                mg
              </strong>
            </div>
          </div>

          <div className="nutrition-summary-column">
            <h4>Whole recipe</h4>

            <div>
              <span>Calories</span>
              <strong>
                {number(
                  nutritionSummary?.totals
                    .calories,
                  0
                )}
              </strong>
            </div>

            <div>
              <span>Protein</span>
              <strong>
                {number(
                  nutritionSummary?.totals
                    .protein
                )}{' '}
                g
              </strong>
            </div>

            <div>
              <span>Carbs</span>
              <strong>
                {number(
                  nutritionSummary?.totals
                    .carbohydrates
                )}{' '}
                g
              </strong>
            </div>

            <div>
              <span>Fat</span>
              <strong>
                {number(
                  nutritionSummary?.totals
                    .fat
                )}{' '}
                g
              </strong>
            </div>

            <div>
              <span>
                Saturated fat
              </span>
              <strong>
                {number(
                  nutritionSummary?.totals
                    .saturatedFat
                )}{' '}
                g
              </strong>
            </div>

            <div>
              <span>Fiber</span>
              <strong>
                {number(
                  nutritionSummary?.totals
                    .fiber
                )}{' '}
                g
              </strong>
            </div>

            <div>
              <span>Sugar</span>
              <strong>
                {number(
                  nutritionSummary?.totals
                    .sugar
                )}{' '}
                g
              </strong>
            </div>

            <div>
              <span>Sodium</span>
              <strong>
                {number(
                  nutritionSummary?.totals
                    .sodium,
                  0
                )}{' '}
                mg
              </strong>
            </div>
          </div>
        </div>

        {nutritionSummary?.partial && (
          <p className="estimate-warning">
            Partial estimate —{' '}
            {
              nutritionSummary.missingCount
            }{' '}
            ingredient
            {nutritionSummary.missingCount ===
            1
              ? ''
              : 's'}{' '}
            could not be calculated.
          </p>
        )}
      </section>

      <div className="recipe-content-grid">
        <div>
          <section className="recipe-section">
            <h2>Ingredients</h2>

            <div className="ingredient-list">
              {ingredients?.map(
                (item) => {
                  const ingredient =
                    ingredientRecords?.[
                      item.ingredientId
                    ]

                  const scaled =
                    scaleIngredient(
                      item,
                      scaleFactor,
                      measurementMode
                    )

                  return (
                    <div
                      className="recipe-ingredient-row"
                      key={item.id}
                    >
                      <span>
                        {[
                          scaled.quantityText,
                          scaled.unitText,
                          scaled.ingredientText,
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      </span>

                    </div>
                  )
                }
              )}
            </div>
          </section>

          <section className="recipe-section">
            <h2>Directions</h2>

            <ol className="direction-list">
              {directions?.map(
                (direction) => (
                  <li
                    key={direction.id}
                  >
                    {
                      direction.text
                    }
                  </li>
                )
              )}
            </ol>
          </section>

          {recipe.notes && (
            <section className="recipe-section">
              <h2>Notes</h2>

              <p>{recipe.notes}</p>
            </section>
          )}
        </div>

        {addOns?.length > 0 && (
          <aside className="recipe-addons">
            <h3>Suggested Sides</h3>

            {addOns.map((addOn) => {
              const item =
                addOnRecords?.[
                  addOn.ingredientId
                ]

              if (!item) {
                return null
              }

              return (
                <label
                  className="addon-row"
                  key={addOn.id}
                >
                  <input
                    type="checkbox"
                    checked={
                      selectedAddOns[
                        addOn.id
                      ] || false
                    }
                    onChange={() =>
                      toggleAddOn(
                        addOn.id
                      )
                    }
                  />

                  <span>
                    {item.name}
                  </span>
                </label>
              )
            })}
          </aside>
        )}
      </div>

      <div className="recipe-action-row">
        <button
          className="primary-button"
          onClick={onEdit}
        >
          Edit
        </button>

        <button>
          Print
        </button>

        <button>
          Cook
        </button>
      </div>
    </div>
  )
}

export default RecipeDetail