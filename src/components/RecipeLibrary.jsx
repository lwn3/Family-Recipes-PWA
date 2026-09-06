import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import AddRecipeForm from './AddRecipeForm'
import RecipeDetail from './RecipeDetail'

function RecipeLibrary({ activeProfile }) {
  const [addingRecipe, setAddingRecipe] = useState(false)

  const [selectedRecipe, setSelectedRecipe] = useState(null)

  const [editingRecipe, setEditingRecipe] = useState(null)

  const recipes = useLiveQuery(
    () =>
      db.recipes
        .where('profileId')
        .equals(activeProfile.id)
        .filter((recipe) => !recipe.deletedAt)
        .sortBy('title'),
    [activeProfile.id]
  )

  if (editingRecipe) {
    return (
        <AddRecipeForm
        activeProfile={activeProfile}
        recipe={editingRecipe}
        onSaved={() => {
            setEditingRecipe(null)
            setSelectedRecipe(null)
        }}
        onCancel={() => setEditingRecipe(null)}
        />
    )
    }

  if (selectedRecipe) {
  return (
    <RecipeDetail
      recipe={selectedRecipe}
      activeProfile={activeProfile}
      onBack={() => setSelectedRecipe(null)}
      onEdit={() => setEditingRecipe(selectedRecipe)}
    />
  )
}

  if (addingRecipe) {
    return (
      <AddRecipeForm
        activeProfile={activeProfile}
        onSaved={() => setAddingRecipe(false)}
        onCancel={() => setAddingRecipe(false)}
      />
    )
  }

  return (
  <div className="recipe-library">
      <div className="library-heading">
        <div>
          <p className="eyebrow">Your library</p>
          <h2>Recipes</h2>
        </div>

        <button
          className="primary-button compact"
          onClick={() => setAddingRecipe(true)}
        >
          + Add Recipe
        </button>
      </div>

      {!recipes?.length ? (
        <div className="empty-library">
          <strong>No recipes yet</strong>
          <p>Add your first recipe to get started.</p>
        </div>
      ) : (
        <div className="recipe-grid">
          {recipes.map((recipe) => (
            <article
                className="recipe-card"
                key={recipe.id}
                onClick={() => setSelectedRecipe(recipe)}
                >
              <div className="recipe-image-placeholder">
                <span>{recipe.title.charAt(0).toUpperCase()}</span>
              </div>

              <div className="recipe-card-body">
                <h3>{recipe.title}</h3>

                <button className="recipe-profile">
                  {activeProfile.name}
                </button>

                <div className="recipe-meta">
                  {recipe.mealType && <span>{recipe.mealType}</span>}
                  {recipe.servings && (
                    <span>{recipe.servings} servings</span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

export default RecipeLibrary