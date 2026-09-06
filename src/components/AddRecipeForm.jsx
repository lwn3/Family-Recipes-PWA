import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { parseIngredientLine } from '../utils/parseIngredient'

function AddRecipeForm({
  activeProfile,
  recipe = null,
  onSaved,
  onCancel,
}) {
  const [title, setTitle] = useState(recipe?.title || '')
  const [mealType, setMealType] = useState(recipe?.mealType || '')
  const [servings, setServings] = useState(recipe?.servings || '')
  const [tags, setTags] = useState('')
  const [sourceUrl, setSourceUrl] = useState(recipe?.sourceUrl || '')
  const [notes, setNotes] = useState(recipe?.notes || '')

  const [ingredients, setIngredients] = useState([
    {
      text: '',
      ingredientName: '',
      ingredientNameManual: false,
    },
  ])

  const [directions, setDirections] = useState([
    { text: '' },
  ])

  const [addOns, setAddOns] = useState([
    { ingredientName: '' },
  ])

  const masterIngredients = useLiveQuery(
    () => db.ingredients.orderBy('name').toArray(),
    []
  )

  useEffect(() => {
    async function loadRecipeData() {
      if (!recipe) return

      const ingredientRows = await db.recipeIngredients
        .where('recipeId')
        .equals(recipe.id)
        .sortBy('sortOrder')

      const loadedIngredients = await Promise.all(
        ingredientRows.map(async (row) => {
          const master = row.ingredientId
            ? await db.ingredients.get(row.ingredientId)
            : null

          return {
            text: row.originalText || '',
            ingredientName: master?.name || '',
            ingredientNameManual: Boolean(master?.name),
          }
        })
      )

      const directionRows = await db.recipeDirections
        .where('recipeId')
        .equals(recipe.id)
        .sortBy('sortOrder')

      const addOnRows = await db.recipeAddOns
        .where('recipeId')
        .equals(recipe.id)
        .sortBy('sortOrder')

      const loadedAddOns = await Promise.all(
        addOnRows.map(async (row) => {
          const master = row.ingredientId
            ? await db.ingredients.get(row.ingredientId)
            : null

          return {
            ingredientName: master?.name || '',
          }
        })
      )

      const tagLinks = await db.recipeTags
        .where('recipeId')
        .equals(recipe.id)
        .toArray()

      const tagRecords = await Promise.all(
        tagLinks.map((link) => db.tags.get(link.tagId))
      )

      setIngredients(
        loadedIngredients.length
          ? loadedIngredients
          : [
              {
                text: '',
                ingredientName: '',
                ingredientNameManual: false,
              },
            ]
      )

      setDirections(
        directionRows.length
          ? directionRows.map((row) => ({
              text: row.text,
            }))
          : [{ text: '' }]
      )

      setAddOns(
        loadedAddOns.length
          ? loadedAddOns
          : [{ ingredientName: '' }]
      )

      setTags(
        tagRecords
          .filter(Boolean)
          .map((tag) => tag.name)
          .join(', ')
      )
    }

    loadRecipeData()
  }, [recipe])

  function updateIngredient(index, field, value) {
    const updated = [...ingredients]

    updated[index][field] = value

    if (field === 'ingredientName') {
      updated[index].ingredientNameManual = true
    }

    if (
      field === 'text' &&
      !updated[index].ingredientNameManual
    ) {
      const parsed = parseIngredientLine(value)

      updated[index].ingredientName = parsed.ingredientText
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    }

    setIngredients(updated)
  }

  function addIngredient() {
    setIngredients([
      ...ingredients,
      {
        text: '',
        ingredientName: '',
        ingredientNameManual: false,
      },
    ])
  }

  function removeIngredient(index) {
    setIngredients(
      ingredients.filter((_, itemIndex) => itemIndex !== index)
    )
  }

  function updateDirection(index, value) {
    const updated = [...directions]
    updated[index].text = value
    setDirections(updated)
  }

  function addDirection() {
    setDirections([
      ...directions,
      { text: '' },
    ])
  }

  function removeDirection(index) {
    setDirections(
      directions.filter((_, itemIndex) => itemIndex !== index)
    )
  }

  function updateAddOn(index, value) {
    const updated = [...addOns]
    updated[index].ingredientName = value
    setAddOns(updated)
  }

  function addAddOn() {
    setAddOns([
      ...addOns,
      { ingredientName: '' },
    ])
  }

  function removeAddOn(index) {
    setAddOns(
      addOns.filter((_, itemIndex) => itemIndex !== index)
    )
  }

  async function findOrCreateIngredient(name, itemType = 'ingredient') {
    const cleanedName = name.trim()
    if (!cleanedName) return null

    const existing = await db.ingredients
      .filter(
        (item) =>
          item.name.toLowerCase() === cleanedName.toLowerCase()
      )
      .first()

    if (existing) {
  if (
    itemType === 'ingredient' &&
    existing.isIngredient !== true
  ) {
    await db.ingredients.update(existing.id, {
      isIngredient: true,
      updatedAt: new Date().toISOString(),
    })
  }

  if (
    itemType === 'prepared' &&
    existing.isPreparedItem !== true
  ) {
    await db.ingredients.update(existing.id, {
      isPreparedItem: true,
      updatedAt: new Date().toISOString(),
    })
  }

  return existing.id
}

    const now = new Date().toISOString()

    return db.ingredients.add({
      name: cleanedName,
      staple: false,
      isIngredient: itemType === 'ingredient',
      isPreparedItem: itemType === 'prepared',
      createdAt: now,
      updatedAt: now,
    })
      }

  async function handleSubmit(event) {
    event.preventDefault()

    const trimmedTitle = title.trim()
    if (!trimmedTitle) return

    const now = new Date().toISOString()

    let recipeId

    if (recipe) {
      recipeId = recipe.id

      await db.recipes.update(recipeId, {
        title: trimmedTitle,
        mealType: mealType || null,
        servings: servings ? Number(servings) : null,
        sourceUrl: sourceUrl.trim() || null,
        notes: notes.trim() || null,
        updatedAt: now,
      })

      await db.recipeIngredients
        .where('recipeId')
        .equals(recipeId)
        .delete()

      await db.recipeDirections
        .where('recipeId')
        .equals(recipeId)
        .delete()

      await db.recipeTags
        .where('recipeId')
        .equals(recipeId)
        .delete()

      await db.recipeAddOns
        .where('recipeId')
        .equals(recipeId)
        .delete()
    } else {
      recipeId = await db.recipes.add({
        profileId: activeProfile.id,
        title: trimmedTitle,
        mealType: mealType || null,
        servings: servings ? Number(servings) : null,
        sourceUrl: sourceUrl.trim() || null,
        notes: notes.trim() || null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      })
    }

    const cleanIngredients = ingredients
      .map((item) => ({
        text: item.text.trim(),
        ingredientName: item.ingredientName.trim(),
      }))
      .filter((item) => item.text)

    for (let index = 0; index < cleanIngredients.length; index++) {
      const item = cleanIngredients[index]

      const ingredientId = item.ingredientName
        ? await findOrCreateIngredient(
            item.ingredientName,
            'ingredient'
          )
        : null

      const parsed = parseIngredientLine(item.text)

      await db.recipeIngredients.add({
        recipeId,
        originalText: item.text,
        quantity: parsed.quantity,
        unit: parsed.unit,
        parsedIngredientText: parsed.ingredientText,
        ingredientId,
        variantId: null,
        sortOrder: index,
      })
    }

    const cleanDirections = directions
      .map((item) => item.text.trim())
      .filter(Boolean)

    for (let index = 0; index < cleanDirections.length; index++) {
      await db.recipeDirections.add({
        recipeId,
        text: cleanDirections[index],
        sortOrder: index,
      })
    }

    const cleanAddOns = addOns
      .map((item) => item.ingredientName.trim())
      .filter(Boolean)

    for (let index = 0; index < cleanAddOns.length; index++) {
      const addOnName = cleanAddOns[index]

      const ingredientId = await findOrCreateIngredient(
        addOnName,
        'prepared'
      )

      await db.recipeAddOns.add({
        recipeId,
        ingredientId,
        sortOrder: index,
      })
    }

    const tagNames = tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)

    for (const tagName of tagNames) {
      let tag = await db.tags
        .filter(
          (item) =>
            item.name.toLowerCase() === tagName.toLowerCase()
        )
        .first()

      let tagId

      if (tag) {
        tagId = tag.id
      } else {
        tagId = await db.tags.add({
          name: tagName,
          createdAt: now,
        })
      }

      await db.recipeTags.add({
        recipeId,
        tagId,
      })
    }

    onSaved()
  }

  return (
    <form className="recipe-form" onSubmit={handleSubmit}>
      <div className="form-heading">
        <div>
          <p className="eyebrow">
            {recipe ? 'Editing recipe' : 'New recipe'}
          </p>

          <h2>
            {recipe ? 'Edit Recipe' : 'Add Recipe'}
          </h2>
        </div>

        <button
          type="button"
          className="text-button"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>

      <label>
        Recipe name

        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Sloppy Joes"
        />
      </label>

      <label>
        Genre

        <select
          value={mealType}
          onChange={(event) => setMealType(event.target.value)}
        >
          <option value="">Choose meal type</option>
          <option value="Breakfast">Breakfast</option>
          <option value="Lunch">Lunch</option>
          <option value="Dinner">Dinner</option>
          <option value="Side">Side</option>
          <option value="Dessert">Dessert</option>
          <option value="Snack">Snack</option>
          <option value="Drink">Drink</option>
        </select>
      </label>

      <label>
        Default servings

        <input
          type="number"
          min="1"
          value={servings}
          onChange={(event) => setServings(event.target.value)}
          placeholder="4"
        />
      </label>

      <div className="form-section">
        <div className="section-heading">
          <h3>Lyrics</h3>

          <button
            type="button"
            className="text-button"
            onClick={addIngredient}
          >
            + Ingredient
          </button>
        </div>

        {ingredients.map((ingredient, index) => (
          <div className="ingredient-editor" key={index}>
            <input
              type="text"
              value={ingredient.text}
              onChange={(event) =>
                updateIngredient(
                  index,
                  'text',
                  event.target.value
                )
              }
              placeholder="2 tbsp peanut butter"
            />

            <div className="ingredient-link-row">
              <input
                type="text"
                list="master-ingredients"
                value={ingredient.ingredientName}
                onChange={(event) =>
                  updateIngredient(
                    index,
                    'ingredientName',
                    event.target.value
                  )
                }
                placeholder="Linked ingredient"
              />

              {ingredients.length > 1 && (
                <button
                  type="button"
                  className="remove-row-button"
                  onClick={() => removeIngredient(index)}
                >
                  ×
                </button>
              )}
            </div>
          </div>
        ))}

        <datalist id="master-ingredients">
          {masterIngredients?.map((ingredient) => (
            <option
              key={ingredient.id}
              value={ingredient.name}
            />
          ))}
        </datalist>
      </div>

      <div className="form-section">
        <div className="section-heading">
          <div>
            <h3>Suggested Sides</h3>
            <p className="field-help">
              Optional prepared items such as fries, chips,
              garlic bread, or bagged salad.
            </p>
          </div>

          <button
            type="button"
            className="text-button"
            onClick={addAddOn}
          >
            + Side
          </button>
        </div>

        {addOns.map((addOn, index) => (
          <div className="dynamic-row" key={index}>
            <input
              type="text"
              list="master-ingredients"
              value={addOn.ingredientName}
              onChange={(event) =>
                updateAddOn(index, event.target.value)
              }
              placeholder="Garlic Bread"
            />

            {addOns.length > 1 && (
              <button
                type="button"
                className="remove-row-button"
                onClick={() => removeAddOn(index)}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="form-section">
        <div className="section-heading">
          <h3>Directions</h3>

          <button
            type="button"
            className="text-button"
            onClick={addDirection}
          >
            + Step
          </button>
        </div>

        {directions.map((direction, index) => (
          <div className="dynamic-row" key={index}>
            <div className="step-number">
              {index + 1}
            </div>

            <textarea
              rows="2"
              value={direction.text}
              onChange={(event) =>
                updateDirection(
                  index,
                  event.target.value
                )
              }
              placeholder="Describe this step..."
            />

            {directions.length > 1 && (
              <button
                type="button"
                className="remove-row-button"
                onClick={() => removeDirection(index)}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      <label>
        Albums / tags

        <input
          type="text"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          placeholder="Ground Beef, Party Food, Instant Pot"
        />
      </label>

      <label>
        Source URL

        <input
          type="url"
          value={sourceUrl}
          onChange={(event) => setSourceUrl(event.target.value)}
          placeholder="https://..."
        />
      </label>

      <label>
        Track Notes

        <textarea
          rows="4"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Anything you want to remember..."
        />
      </label>

      <button
        className="primary-button"
        type="submit"
      >
        Save Recipe
      </button>
    </form>
  )
}

export default AddRecipeForm