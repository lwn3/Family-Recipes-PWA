import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { parseIngredientLine } from '../utils/parseIngredient'

function blankSubstitution() {
  return {
    ingredientName: '',
    variantId: null,
    note: '',
  }
}

function blankIngredient() {
  return {
    text: '',
    ingredientName: '',
    ingredientNameManual: false,
    variantId: null,
    substitutions: [],
    showSubstitutions: false,
  }
}

function AddRecipeForm({
  activeProfile,
  recipe = null,
  onSaved,
  onCancel,
}) {
  const [title, setTitle] =
    useState(recipe?.title || '')

  const [mealType, setMealType] =
    useState(recipe?.mealType || '')

  const [servings, setServings] =
    useState(recipe?.servings || '')

  const [tags, setTags] =
    useState('')

  const [sourceUrl, setSourceUrl] =
    useState(recipe?.sourceUrl || '')

  const [notes, setNotes] =
    useState(recipe?.notes || '')

  const [ingredients, setIngredients] =
    useState([blankIngredient()])

  const [directions, setDirections] =
    useState([{ text: '' }])

  const [addOns, setAddOns] =
    useState([{ ingredientName: '' }])

  const masterIngredients =
    useLiveQuery(
      () =>
        db.ingredients
          .orderBy('name')
          .toArray(),
      []
    )

  const masterVariants =
    useLiveQuery(
      () =>
        db.ingredientVariants
          .toArray(),
      []
    )

  useEffect(() => {
    async function loadRecipeData() {
      if (!recipe) return

      const ingredientRows =
        await db.recipeIngredients
          .where('recipeId')
          .equals(recipe.id)
          .sortBy('sortOrder')

      const loadedIngredients =
        await Promise.all(
          ingredientRows.map(
            async (row) => {
              const master =
                row.ingredientId
                  ? await db.ingredients.get(
                      row.ingredientId
                    )
                  : null

              const substitutionRows =
                await db
                  .recipeIngredientSubstitutions
                  .where(
                    'recipeIngredientId'
                  )
                  .equals(row.id)
                  .sortBy('sortOrder')

              const substitutions =
                await Promise.all(
                  substitutionRows.map(
                    async (sub) => {
                      const substitute =
                        sub.substituteIngredientId
                          ? await db.ingredients.get(
                              sub.substituteIngredientId
                            )
                          : null

                      return {
                        ingredientName:
                          substitute?.name || '',
                        variantId:
                          sub.substituteVariantId ??
                          null,
                        note:
                          sub.note || '',
                      }
                    }
                  )
                )

              return {
                text:
                  row.originalText || '',
                ingredientName:
                  master?.name || '',
                ingredientNameManual:
                  Boolean(master?.name),
                variantId:
                  row.variantId ?? null,
                substitutions,
                showSubstitutions:
                  substitutions.length > 0,
              }
            }
          )
        )

      const directionRows =
        await db.recipeDirections
          .where('recipeId')
          .equals(recipe.id)
          .sortBy('sortOrder')

      const addOnRows =
        await db.recipeAddOns
          .where('recipeId')
          .equals(recipe.id)
          .sortBy('sortOrder')

      const loadedAddOns =
        await Promise.all(
          addOnRows.map(async (row) => {
            const master =
              row.ingredientId
                ? await db.ingredients.get(
                    row.ingredientId
                  )
                : null

            return {
              ingredientName:
                master?.name || '',
            }
          })
        )

      const tagLinks =
        await db.recipeTags
          .where('recipeId')
          .equals(recipe.id)
          .toArray()

      const tagRecords =
        await Promise.all(
          tagLinks.map((link) =>
            db.tags.get(link.tagId)
          )
        )

      setIngredients(
        loadedIngredients.length
          ? loadedIngredients
          : [blankIngredient()]
      )

      setDirections(
        directionRows.length
          ? directionRows.map(
              (row) => ({
                text: row.text,
              })
            )
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

  function findMasterByName(name) {
    return masterIngredients?.find(
      (item) =>
        item.name.toLowerCase() ===
        name.trim().toLowerCase()
    )
  }

  function variantsForName(name) {
    const master =
      findMasterByName(name)

    if (!master) return []

    return (
      masterVariants?.filter(
        (variant) =>
          variant.ingredientId ===
          master.id
      ) || []
    )
  }

  function updateIngredient(
    index,
    field,
    value
  ) {
    setIngredients((current) => {
      const updated =
        current.map((item) => ({
          ...item,
          substitutions:
            item.substitutions.map(
              (sub) => ({ ...sub })
            ),
        }))

      updated[index][field] = value

      if (field === 'ingredientName') {
        updated[
          index
        ].ingredientNameManual = true

        updated[index].variantId = null
      }

      if (
        field === 'text' &&
        !updated[index]
          .ingredientNameManual
      ) {
        const parsed =
          parseIngredientLine(value)

        updated[index].ingredientName =
          parsed.ingredientText.replace(
            /\b\w/g,
            (letter) =>
              letter.toUpperCase()
          )

        updated[index].variantId = null
      }

      return updated
    })
  }

  function addIngredient() {
    setIngredients((current) => [
      ...current,
      blankIngredient(),
    ])
  }

  function removeIngredient(index) {
    setIngredients((current) =>
      current.filter(
        (_, itemIndex) =>
          itemIndex !== index
      )
    )
  }

  function toggleSubstitutions(index) {
    setIngredients((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              showSubstitutions:
                !item.showSubstitutions,
            }
          : item
      )
    )
  }

  function addSubstitution(index) {
    setIngredients((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              showSubstitutions: true,
              substitutions: [
                ...item.substitutions,
                blankSubstitution(),
              ],
            }
          : item
      )
    )
  }

  function updateSubstitution(
    ingredientIndex,
    substitutionIndex,
    field,
    value
  ) {
    setIngredients((current) =>
      current.map((item, itemIndex) => {
        if (
          itemIndex !==
          ingredientIndex
        ) {
          return item
        }

        const substitutions =
          item.substitutions.map(
            (sub, subIndex) => {
              if (
                subIndex !==
                substitutionIndex
              ) {
                return sub
              }

              const updated = {
                ...sub,
                [field]: value,
              }

              if (
                field ===
                'ingredientName'
              ) {
                updated.variantId =
                  null
              }

              return updated
            }
          )

        return {
          ...item,
          substitutions,
        }
      })
    )
  }

  function removeSubstitution(
    ingredientIndex,
    substitutionIndex
  ) {
    setIngredients((current) =>
      current.map((item, itemIndex) =>
        itemIndex === ingredientIndex
          ? {
              ...item,
              substitutions:
                item.substitutions.filter(
                  (_, subIndex) =>
                    subIndex !==
                    substitutionIndex
                ),
            }
          : item
      )
    )
  }

  function updateDirection(
    index,
    value
  ) {
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
      directions.filter(
        (_, itemIndex) =>
          itemIndex !== index
      )
    )
  }

  function updateAddOn(index, value) {
    const updated = [...addOns]

    updated[index].ingredientName =
      value

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
      addOns.filter(
        (_, itemIndex) =>
          itemIndex !== index
      )
    )
  }

  async function findOrCreateIngredient(
    name,
    itemType = 'ingredient'
  ) {
    const cleanedName = name.trim()

    if (!cleanedName) return null

    const existing =
      await db.ingredients
        .filter(
          (item) =>
            item.name.toLowerCase() ===
            cleanedName.toLowerCase()
        )
        .first()

    if (existing) {
      if (
        itemType === 'ingredient' &&
        existing.isIngredient !== true
      ) {
        await db.ingredients.update(
          existing.id,
          {
            isIngredient: true,
            updatedAt:
              new Date().toISOString(),
          }
        )
      }

      if (
        itemType === 'prepared' &&
        existing.isPreparedItem !== true
      ) {
        await db.ingredients.update(
          existing.id,
          {
            isPreparedItem: true,
            updatedAt:
              new Date().toISOString(),
          }
        )
      }

      return existing.id
    }

    const now =
      new Date().toISOString()

    return db.ingredients.add({
      name: cleanedName,
      staple: false,
      isIngredient:
        itemType === 'ingredient',
      isPreparedItem:
        itemType === 'prepared',
      createdAt: now,
      updatedAt: now,
    })
  }

  async function deleteOldRecipeIngredients(
    recipeId
  ) {
    const oldRows =
      await db.recipeIngredients
        .where('recipeId')
        .equals(recipeId)
        .toArray()

    for (const row of oldRows) {
      await db
        .recipeIngredientSubstitutions
        .where('recipeIngredientId')
        .equals(row.id)
        .delete()
    }

    await db.recipeIngredients
      .where('recipeId')
      .equals(recipeId)
      .delete()
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const trimmedTitle =
      title.trim()

    if (!trimmedTitle) return

    const now =
      new Date().toISOString()

    let recipeId

    if (recipe) {
      recipeId = recipe.id

      await db.recipes.update(
        recipeId,
        {
          title: trimmedTitle,
          mealType:
            mealType || null,
          servings: servings
            ? Number(servings)
            : null,
          sourceUrl:
            sourceUrl.trim() ||
            null,
          notes:
            notes.trim() || null,
          updatedAt: now,
        }
      )

      await deleteOldRecipeIngredients(
        recipeId
      )

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
      recipeId =
        await db.recipes.add({
          profileId:
            activeProfile.id,
          title: trimmedTitle,
          mealType:
            mealType || null,
          servings: servings
            ? Number(servings)
            : null,
          sourceUrl:
            sourceUrl.trim() ||
            null,
          notes:
            notes.trim() || null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        })
    }

    const cleanIngredients =
      ingredients.filter(
        (item) => item.text.trim()
      )

    for (
      let index = 0;
      index < cleanIngredients.length;
      index++
    ) {
      const item =
        cleanIngredients[index]

      const ingredientId =
        item.ingredientName.trim()
          ? await findOrCreateIngredient(
              item.ingredientName,
              'ingredient'
            )
          : null

      const parsed =
        parseIngredientLine(
          item.text.trim()
        )

      const recipeIngredientId =
        await db.recipeIngredients.add({
          recipeId,
          originalText:
            item.text.trim(),
          quantity:
            parsed.quantity,
          unit: parsed.unit,
          parsedIngredientText:
            parsed.ingredientText,
          ingredientId,
          variantId:
            item.variantId
              ? Number(item.variantId)
              : null,
          sortOrder: index,
        })

      const cleanSubs =
        item.substitutions.filter(
          (sub) =>
            sub.ingredientName.trim()
        )

      for (
        let subIndex = 0;
        subIndex < cleanSubs.length;
        subIndex++
      ) {
        const sub =
          cleanSubs[subIndex]

        const substituteIngredientId =
          await findOrCreateIngredient(
            sub.ingredientName,
            'ingredient'
          )

        await db
          .recipeIngredientSubstitutions
          .add({
            recipeIngredientId,
            substituteIngredientId,
            substituteVariantId:
              sub.variantId
                ? Number(
                    sub.variantId
                  )
                : null,
            note:
              sub.note.trim() ||
              null,
            sortOrder: subIndex,
          })
      }
    }

    const cleanDirections =
      directions
        .map((item) =>
          item.text.trim()
        )
        .filter(Boolean)

    for (
      let index = 0;
      index < cleanDirections.length;
      index++
    ) {
      await db.recipeDirections.add({
        recipeId,
        text:
          cleanDirections[index],
        sortOrder: index,
      })
    }

    const cleanAddOns =
      addOns
        .map((item) =>
          item.ingredientName.trim()
        )
        .filter(Boolean)

    for (
      let index = 0;
      index < cleanAddOns.length;
      index++
    ) {
      const ingredientId =
        await findOrCreateIngredient(
          cleanAddOns[index],
          'prepared'
        )

      await db.recipeAddOns.add({
        recipeId,
        ingredientId,
        sortOrder: index,
      })
    }

    const tagNames =
      tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)

    for (const tagName of tagNames) {
      let tag =
        await db.tags
          .filter(
            (item) =>
              item.name.toLowerCase() ===
              tagName.toLowerCase()
          )
          .first()

      let tagId

      if (tag) {
        tagId = tag.id
      } else {
        tagId =
          await db.tags.add({
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
    <form
      className="recipe-form"
      onSubmit={handleSubmit}
    >
      <div className="form-heading">
        <div>
          <p className="eyebrow">
            {recipe
              ? 'Editing recipe'
              : 'New recipe'}
          </p>

          <h2>
            {recipe
              ? 'Edit Recipe'
              : 'Add Recipe'}
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
          onChange={(event) =>
            setTitle(
              event.target.value
            )
          }
          placeholder="Sloppy Joes"
        />
      </label>

      <label>
        Genre

        <select
          value={mealType}
          onChange={(event) =>
            setMealType(
              event.target.value
            )
          }
        >
          <option value="">
            Choose meal type
          </option>
          <option value="Breakfast">
            Breakfast
          </option>
          <option value="Lunch">
            Lunch
          </option>
          <option value="Dinner">
            Dinner
          </option>
          <option value="Side">
            Side
          </option>
          <option value="Dessert">
            Dessert
          </option>
          <option value="Snack">
            Snack
          </option>
          <option value="Drink">
            Drink
          </option>
        </select>
      </label>

      <label>
        Default servings

        <input
          type="number"
          min="1"
          value={servings}
          onChange={(event) =>
            setServings(
              event.target.value
            )
          }
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

        {ingredients.map(
          (ingredient, index) => {
            const variants =
              variantsForName(
                ingredient.ingredientName
              )

            return (
              <div
                className="ingredient-editor"
                key={index}
              >
                <input
                  type="text"
                  value={
                    ingredient.text
                  }
                  onChange={(event) =>
                    updateIngredient(
                      index,
                      'text',
                      event.target.value
                    )
                  }
                  placeholder="2 tbsp peanut butter"
                />

                <div className="linked-ingredient-line">
                  <span className="linked-ingredient-badge">
                    <span>Linked</span>
                    <span>Ingredient</span>
                  </span>

                  <input
                    type="text"
                    list="master-ingredients"
                    value={
                      ingredient.ingredientName
                    }
                    onChange={(event) =>
                      updateIngredient(
                        index,
                        'ingredientName',
                        event.target.value
                      )
                    }
                    placeholder="Peanut Butter"
                  />

                  {ingredients.length >
                    1 && (
                    <button
                      type="button"
                      className="remove-row-button"
                      onClick={() =>
                        removeIngredient(
                          index
                        )
                      }
                    >
                      ×
                    </button>
                  )}
                </div>

                {variants.length > 0 && (
                  <div className="variant-default-row">
                    <span>
                      Default variety
                    </span>

                    <select
                      value={
                        ingredient.variantId ||
                        ''
                      }
                      onChange={(event) =>
                        updateIngredient(
                          index,
                          'variantId',
                          event.target.value
                        )
                      }
                    >
                      <option value="">
                        Base / unspecified
                      </option>

                      {variants.map(
                        (variant) => (
                          <option
                            key={
                              variant.id
                            }
                            value={
                              variant.id
                            }
                          >
                            {
                              variant.name
                            }
                          </option>
                        )
                      )}
                    </select>
                  </div>
                )}

                <div className="substitution-editor-row">
                  <button
                    type="button"
                    className="quiet-pill-button"
                    onClick={() =>
                      toggleSubstitutions(
                        index
                      )
                    }
                  >
                    Substitutions
                    {ingredient
                      .substitutions
                      .length > 0
                      ? ` (${ingredient.substitutions.length})`
                      : ''}
                  </button>
                </div>

                {ingredient.showSubstitutions && (
                  <div className="substitution-editor-panel">
                    <div className="substitution-panel-heading">
                      <div>
                        <strong>
                          Allowed
                          substitutions
                        </strong>

                        <span>
                          Optional
                          alternatives for
                          this recipe only.
                        </span>
                      </div>

                      <button
                        type="button"
                        className="text-button"
                        onClick={() =>
                          addSubstitution(
                            index
                          )
                        }
                      >
                        + Add
                      </button>
                    </div>

                    {!ingredient
                      .substitutions
                      .length && (
                      <div className="empty-substitution-note">
                        No substitutions
                        added.
                      </div>
                    )}

                    {ingredient.substitutions.map(
                      (
                        substitution,
                        subIndex
                      ) => {
                        const subVariants =
                          variantsForName(
                            substitution.ingredientName
                          )

                        return (
                          <div
                            className="substitution-editor-item"
                            key={
                              subIndex
                            }
                          >
                            <div className="substitution-main-row">
                              <input
                                type="text"
                                list="master-ingredients"
                                value={
                                  substitution.ingredientName
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateSubstitution(
                                    index,
                                    subIndex,
                                    'ingredientName',
                                    event
                                      .target
                                      .value
                                  )
                                }
                                placeholder="Margarine, Jam, Banana..."
                              />

                              <button
                                type="button"
                                className="remove-row-button"
                                onClick={() =>
                                  removeSubstitution(
                                    index,
                                    subIndex
                                  )
                                }
                              >
                                ×
                              </button>
                            </div>

                            {subVariants.length >
                              0 && (
                              <select
                                value={
                                  substitution.variantId ||
                                  ''
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateSubstitution(
                                    index,
                                    subIndex,
                                    'variantId',
                                    event
                                      .target
                                      .value
                                  )
                                }
                              >
                                <option value="">
                                  Any / base
                                  variety
                                </option>

                                {subVariants.map(
                                  (
                                    variant
                                  ) => (
                                    <option
                                      key={
                                        variant.id
                                      }
                                      value={
                                        variant.id
                                      }
                                    >
                                      {
                                        variant.name
                                      }
                                    </option>
                                  )
                                )}
                              </select>
                            )}

                            <input
                              type="text"
                              value={
                                substitution.note
                              }
                              onChange={(
                                event
                              ) =>
                                updateSubstitution(
                                  index,
                                  subIndex,
                                  'note',
                                  event
                                    .target
                                    .value
                                )
                              }
                              placeholder="Optional note, e.g. use equal amount"
                            />
                          </div>
                        )
                      }
                    )}
                  </div>
                )}
              </div>
            )
          }
        )}

        <datalist id="master-ingredients">
          {masterIngredients?.map(
            (ingredient) => (
              <option
                key={ingredient.id}
                value={ingredient.name}
              />
            )
          )}
        </datalist>
      </div>

      <div className="form-section">
        <div className="section-heading">
          <div>
            <h3>
              Suggested Sides
            </h3>

            <p className="field-help">
              Optional prepared items
              such as fries, chips,
              garlic bread, or bagged
              salad.
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

        {addOns.map(
          (addOn, index) => (
            <div
              className="dynamic-row"
              key={index}
            >
              <input
                type="text"
                list="master-ingredients"
                value={
                  addOn.ingredientName
                }
                onChange={(event) =>
                  updateAddOn(
                    index,
                    event.target.value
                  )
                }
                placeholder="Garlic Bread"
              />

              {addOns.length > 1 && (
                <button
                  type="button"
                  className="remove-row-button"
                  onClick={() =>
                    removeAddOn(index)
                  }
                >
                  ×
                </button>
              )}
            </div>
          )
        )}
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

        {directions.map(
          (direction, index) => (
            <div
              className="dynamic-row"
              key={index}
            >
              <div className="step-number">
                {index + 1}
              </div>

              <textarea
                rows="2"
                value={
                  direction.text
                }
                onChange={(event) =>
                  updateDirection(
                    index,
                    event.target.value
                  )
                }
                placeholder="Describe this step..."
              />

              {directions.length >
                1 && (
                <button
                  type="button"
                  className="remove-row-button"
                  onClick={() =>
                    removeDirection(
                      index
                    )
                  }
                >
                  ×
                </button>
              )}
            </div>
          )
        )}
      </div>

      <label>
        Albums / tags

        <input
          type="text"
          value={tags}
          onChange={(event) =>
            setTags(
              event.target.value
            )
          }
          placeholder="Ground Beef, Party Food, Instant Pot"
        />
      </label>

      <label>
        Source URL

        <input
          type="url"
          value={sourceUrl}
          onChange={(event) =>
            setSourceUrl(
              event.target.value
            )
          }
          placeholder="https://..."
        />
      </label>

      <label>
        Track Notes

        <textarea
          value={notes}
          onChange={(event) =>
            setNotes(
              event.target.value
            )
          }
          placeholder="Family notes, changes, reminders..."
        />
      </label>

      <div className="recipe-action-row">
        <button
          type="submit"
          className="primary-button"
        >
          {recipe
            ? 'Save Changes'
            : 'Add Recipe'}
        </button>

        <button
          type="button"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

export default AddRecipeForm