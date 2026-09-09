import Dexie from 'dexie'

export const db = new Dexie('FamilyRecipesDB')

db.version(9).stores({
  profiles:
    '++id, name, createdAt, updatedAt',

  recipes:
    '++id, profileId, title, mealType, createdAt, updatedAt, deletedAt',

  recipeIngredients:
    '++id, recipeId, ingredientId, variantId, sortOrder',

  recipeIngredientSubstitutions:
    '++id, recipeIngredientId, substituteIngredientId, substituteVariantId, sortOrder',

  recipeDirections:
    '++id, recipeId, sortOrder',

  recipeAddOns:
    '++id, recipeId, ingredientId, sortOrder',

  ingredients:
    '++id, name, isIngredient, isPreparedItem, staple, createdAt, updatedAt',

  ingredientVariants:
    '++id, ingredientId, name',

  ingredientPackages:
    '++id, ingredientId, variantId, size, unit, priceType',

  ingredientCategories:
    '++id, ingredientId, categoryName',

  ingredientConversions:
    '++id, ingredientId, variantId, fromUnit, toUnit',

  ingredientNutrition:
    '++id, ingredientId, variantId, basisType, basisAmount, basisUnit, source',

  tags:
    '++id, name, createdAt',

  recipeTags:
    '++id, recipeId, tagId',

  favorites:
    '++id, profileId, recipeId, createdAt',

  mealPlans:
    '++id, profileId, name, startDate, endDate, createdAt, updatedAt',

  mealPlanItems:
    '++id, mealPlanId, recipeId, plannedDate, mealType, status',

  cookingHistory:
    '++id, profileId, recipeId, cookedAt',

  settings:
    'key'
})