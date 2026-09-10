import { db } from '../db/database'
import { ensureIngredientForProfile } from './profileIngredients'

export async function copyRecipeToProfile(sourceRecipe, targetProfileId) {
  if (!sourceRecipe || !targetProfileId) return null

  const existingCopy = await db.recipes
    .where('profileId')
    .equals(targetProfileId)
    .filter(
      (recipe) =>
        !recipe.deletedAt &&
        (recipe.sourceRecipeId === sourceRecipe.id ||
          (recipe.title?.trim().toLowerCase() === sourceRecipe.title?.trim().toLowerCase() &&
            recipe.sourceProfileId === sourceRecipe.profileId))
    )
    .first()

  if (existingCopy) return existingCopy.id

  const now = new Date().toISOString()
  const {
    id: _id,
    profileId: _profileId,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    deletedAt: _deletedAt,
    ...copyableRecipe
  } = sourceRecipe

  const newRecipeId = await db.recipes.add({
    ...copyableRecipe,
    profileId: targetProfileId,
    sourceRecipeId: sourceRecipe.id,
    sourceProfileId: sourceRecipe.profileId,
    copiedAt: now,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  })

  const ingredientRows = await db.recipeIngredients
    .where('recipeId')
    .equals(sourceRecipe.id)
    .sortBy('sortOrder')

  for (const row of ingredientRows) {
    const { id: _rowId, recipeId: _oldRecipeId, ...rowData } = row
    const newRowId = await db.recipeIngredients.add({
      ...rowData,
      recipeId: newRecipeId,
    })

    if (row.ingredientId) {
      await ensureIngredientForProfile(targetProfileId, row.ingredientId)
    }

    const substitutions = await db.recipeIngredientSubstitutions
      .where('recipeIngredientId')
      .equals(row.id)
      .sortBy('sortOrder')

    for (const substitution of substitutions) {
      const {
        id: _subId,
        recipeIngredientId: _oldIngredientId,
        ...subData
      } = substitution

      await db.recipeIngredientSubstitutions.add({
        ...subData,
        recipeIngredientId: newRowId,
      })

      if (substitution.substituteIngredientId) {
        await ensureIngredientForProfile(
          targetProfileId,
          substitution.substituteIngredientId
        )
      }
    }
  }

  const directions = await db.recipeDirections
    .where('recipeId')
    .equals(sourceRecipe.id)
    .sortBy('sortOrder')

  for (const direction of directions) {
    const { id: _directionId, recipeId: _oldRecipeId, ...directionData } = direction
    await db.recipeDirections.add({
      ...directionData,
      recipeId: newRecipeId,
    })
  }

  const addOns = await db.recipeAddOns
    .where('recipeId')
    .equals(sourceRecipe.id)
    .sortBy('sortOrder')

  for (const addOn of addOns) {
    const { id: _addOnId, recipeId: _oldRecipeId, ...addOnData } = addOn
    await db.recipeAddOns.add({
      ...addOnData,
      recipeId: newRecipeId,
    })

    if (addOn.ingredientId) {
      await ensureIngredientForProfile(targetProfileId, addOn.ingredientId)
    }
  }

  const tagLinks = await db.recipeTags
    .where('recipeId')
    .equals(sourceRecipe.id)
    .toArray()

  for (const link of tagLinks) {
    await db.recipeTags.add({
      recipeId: newRecipeId,
      tagId: link.tagId,
    })
  }

  return newRecipeId
}
