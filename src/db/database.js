import Dexie from 'dexie'

export const db = new Dexie('FamilyRecipesDB')

db.version(9).stores({
  profiles: '++id, name, createdAt, updatedAt',
  recipes: '++id, profileId, title, mealType, createdAt, updatedAt, deletedAt',
  recipeIngredients: '++id, recipeId, ingredientId, variantId, sortOrder',
  recipeIngredientSubstitutions: '++id, recipeIngredientId, substituteIngredientId, substituteVariantId, sortOrder',
  recipeDirections: '++id, recipeId, sortOrder',
  recipeAddOns: '++id, recipeId, ingredientId, sortOrder',
  ingredients: '++id, name, isIngredient, isPreparedItem, staple, createdAt, updatedAt',
  ingredientVariants: '++id, ingredientId, name',
  ingredientPackages: '++id, ingredientId, variantId, size, unit, priceType',
  ingredientCategories: '++id, ingredientId, categoryName',
  ingredientConversions: '++id, ingredientId, variantId, fromUnit, toUnit',
  ingredientNutrition: '++id, ingredientId, variantId, basisType, basisAmount, basisUnit, source',
  tags: '++id, name, createdAt',
  recipeTags: '++id, recipeId, tagId',
  favorites: '++id, profileId, recipeId, createdAt',
  mealPlans: '++id, profileId, name, startDate, endDate, createdAt, updatedAt',
  mealPlanItems: '++id, mealPlanId, recipeId, plannedDate, mealType, status',
  cookingHistory: '++id, profileId, recipeId, cookedAt',
  settings: 'key'
})

db.version(10)
  .stores({
    profiles: '++id, name, createdAt, updatedAt',
    recipes: '++id, profileId, title, mealType, createdAt, updatedAt, deletedAt',
    recipeIngredients: '++id, recipeId, ingredientId, variantId, sortOrder',
    recipeIngredientSubstitutions: '++id, recipeIngredientId, substituteIngredientId, substituteVariantId, sortOrder',
    recipeDirections: '++id, recipeId, sortOrder',
    recipeAddOns: '++id, recipeId, ingredientId, sortOrder',
    ingredients: '++id, name, isIngredient, isPreparedItem, staple, createdAt, updatedAt',
    ingredientVariants: '++id, ingredientId, name',
    ingredientPackages: '++id, ingredientId, variantId, size, unit, priceType',
    ingredientCategories: '++id, ingredientId, categoryName',
    ingredientConversions: '++id, ingredientId, variantId, fromUnit, toUnit',
    ingredientNutrition: '++id, ingredientId, variantId, basisType, basisAmount, basisUnit, source',
    ingredientProfiles: '++id, [profileId+ingredientId], profileId, ingredientId, visible, reviewPending',
    variantProfiles: '++id, [profileId+variantId], profileId, variantId, visible',
    tags: '++id, name, createdAt',
    recipeTags: '++id, recipeId, tagId',
    favorites: '++id, profileId, recipeId, createdAt',
    mealPlans: '++id, profileId, name, startDate, endDate, createdAt, updatedAt',
    mealPlanItems: '++id, mealPlanId, recipeId, plannedDate, mealType, status',
    cookingHistory: '++id, profileId, recipeId, cookedAt',
    settings: 'key'
  })
  .upgrade(async (tx) => {
    const profiles = await tx.table('profiles').toArray()
    const ingredients = await tx.table('ingredients').toArray()
    const variants = await tx.table('ingredientVariants').toArray()

    if (!profiles.length) return

    const primaryProfile = [...profiles].sort((a, b) => a.id - b.id)[0]
    const now = new Date().toISOString()

    for (const ingredient of ingredients) {
      await tx.table('ingredientProfiles').add({
        profileId: primaryProfile.id,
        ingredientId: ingredient.id,
        visible: true,
        reviewPending: Boolean(ingredient.importReviewPending),
        hiddenAt: null,
        createdAt: now,
        updatedAt: now,
      })
    }

    for (const variant of variants) {
      await tx.table('variantProfiles').add({
        profileId: primaryProfile.id,
        variantId: variant.id,
        visible: true,
        hiddenAt: null,
        createdAt: now,
        updatedAt: now,
      })
    }
  })
