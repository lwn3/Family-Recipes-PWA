import { db } from '../db/database'

function now() {
  return new Date().toISOString()
}

export async function ensureIngredientForProfile(profileId, ingredientId, options = {}) {
  if (!profileId || !ingredientId) return null

  const existing = await db.ingredientProfiles
    .where('[profileId+ingredientId]')
    .equals([profileId, ingredientId])
    .first()

  const timestamp = now()

  if (existing) {
    await db.ingredientProfiles.update(existing.id, {
      visible: true,
      reviewPending: options.reviewPending ?? existing.reviewPending ?? false,
      hiddenAt: null,
      updatedAt: timestamp,
    })
    return existing.id
  }

  return db.ingredientProfiles.add({
    profileId,
    ingredientId,
    visible: true,
    reviewPending: Boolean(options.reviewPending),
    hiddenAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
}

export async function hideIngredientForProfile(profileId, ingredientId) {
  const existing = await db.ingredientProfiles
    .where('[profileId+ingredientId]')
    .equals([profileId, ingredientId])
    .first()

  const timestamp = now()

  if (existing) {
    await db.ingredientProfiles.update(existing.id, {
      visible: false,
      reviewPending: false,
      hiddenAt: timestamp,
      updatedAt: timestamp,
    })
    return
  }

  await db.ingredientProfiles.add({
    profileId,
    ingredientId,
    visible: false,
    reviewPending: false,
    hiddenAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
}

export async function markIngredientReviewed(profileId, ingredientId) {
  const existing = await db.ingredientProfiles
    .where('[profileId+ingredientId]')
    .equals([profileId, ingredientId])
    .first()

  if (!existing) return

  await db.ingredientProfiles.update(existing.id, {
    reviewPending: false,
    updatedAt: now(),
  })
}

export async function visibleIngredientIds(profileId) {
  const rows = await db.ingredientProfiles
    .where('profileId')
    .equals(profileId)
    .filter((row) => row.visible !== false)
    .toArray()

  return new Set(rows.map((row) => row.ingredientId))
}

export async function mergeIngredients(sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) return

  await db.transaction(
    'rw',
    db.ingredients,
    db.ingredientProfiles,
    db.ingredientVariants,
    db.variantProfiles,
    db.recipeIngredients,
    db.recipeIngredientSubstitutions,
    db.recipeAddOns,
    db.ingredientPackages,
    db.ingredientCategories,
    db.ingredientConversions,
    db.ingredientNutrition,
    async () => {
      const source = await db.ingredients.get(sourceId)
      const target = await db.ingredients.get(targetId)
      if (!source || !target) throw new Error('One of the ingredients no longer exists.')

      await db.recipeIngredients.where('ingredientId').equals(sourceId).modify({ ingredientId: targetId })
      await db.recipeIngredientSubstitutions.where('substituteIngredientId').equals(sourceId).modify({ substituteIngredientId: targetId })
      await db.recipeAddOns.where('ingredientId').equals(sourceId).modify({ ingredientId: targetId })

      const sourceProfiles = await db.ingredientProfiles.where('ingredientId').equals(sourceId).toArray()
      for (const row of sourceProfiles) {
        const targetRow = await db.ingredientProfiles
          .where('[profileId+ingredientId]')
          .equals([row.profileId, targetId])
          .first()

        if (targetRow) {
          await db.ingredientProfiles.update(targetRow.id, {
            visible: targetRow.visible !== false || row.visible !== false,
            reviewPending: Boolean(targetRow.reviewPending || row.reviewPending),
            hiddenAt: null,
            updatedAt: now(),
          })
          await db.ingredientProfiles.delete(row.id)
        } else {
          await db.ingredientProfiles.update(row.id, { ingredientId: targetId, updatedAt: now() })
        }
      }

      const sourceVariants = await db.ingredientVariants.where('ingredientId').equals(sourceId).toArray()
      const targetVariants = await db.ingredientVariants.where('ingredientId').equals(targetId).toArray()

      for (const variant of sourceVariants) {
        const match = targetVariants.find((item) => item.name.trim().toLowerCase() === variant.name.trim().toLowerCase())
        if (match) {
          await db.recipeIngredients.where('variantId').equals(variant.id).modify({ variantId: match.id })
          await db.recipeIngredientSubstitutions.where('substituteVariantId').equals(variant.id).modify({ substituteVariantId: match.id })
          await db.ingredientPackages.where('variantId').equals(variant.id).modify({ ingredientId: targetId, variantId: match.id })
          await db.ingredientConversions.where('variantId').equals(variant.id).modify({ ingredientId: targetId, variantId: match.id })
          await db.ingredientNutrition.where('variantId').equals(variant.id).modify({ ingredientId: targetId, variantId: match.id })
          await db.variantProfiles.where('variantId').equals(variant.id).modify({ variantId: match.id })
          await db.ingredientVariants.delete(variant.id)
        } else {
          await db.ingredientVariants.update(variant.id, { ingredientId: targetId })
          await db.ingredientPackages.where('variantId').equals(variant.id).modify({ ingredientId: targetId })
          await db.ingredientConversions.where('variantId').equals(variant.id).modify({ ingredientId: targetId })
          await db.ingredientNutrition.where('variantId').equals(variant.id).modify({ ingredientId: targetId })
        }
      }

      await db.ingredientPackages.where('ingredientId').equals(sourceId).modify({ ingredientId: targetId })
      await db.ingredientCategories.where('ingredientId').equals(sourceId).modify({ ingredientId: targetId })
      await db.ingredientConversions.where('ingredientId').equals(sourceId).modify({ ingredientId: targetId })
      await db.ingredientNutrition.where('ingredientId').equals(sourceId).modify({ ingredientId: targetId })

      await db.ingredients.update(targetId, {
        isIngredient: Boolean(target.isIngredient || source.isIngredient),
        isPreparedItem: Boolean(target.isPreparedItem || source.isPreparedItem),
        staple: Boolean(target.staple || source.staple),
        updatedAt: now(),
      })

      await db.ingredients.delete(sourceId)
    }
  )
}
