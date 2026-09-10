import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import AddRecipeForm from './AddRecipeForm'
import RecipeDetail from './RecipeDetail'
import ImportRecipes from './ImportRecipes'
import RecipeImage from './RecipeImage'

function RecipeLibrary({ activeProfile }) {
  const [addingRecipe, setAddingRecipe] = useState(false)
  const [importingRecipes, setImportingRecipes] = useState(false)
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

  if (importingRecipes) {
    return (
      <ImportRecipes
        activeProfile={activeProfile}
        onDone={() => setImportingRecipes(false)}
        onCancel={() => setImportingRecipes(false)}
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

        <div className="library-actions">
          <button
            className="text-button"
            onClick={() => setImportingRecipes(true)}
          >
            Import Recipes
          </button>

          <button
            className="primary-button compact"
            onClick={() => setAddingRecipe(true)}
          >
            + Add Recipe
          </button>
        </div>
      </div>

      {!recipes?.length ? (
        <div className="empty-library">
          <strong>No recipes yet</strong>
          <p>Add your first recipe or import an old cookbook to get started.</p>
        </div>
      ) : (
        <div className="recipe-grid">
          {recipes.map((recipe) => (
            <article
              className="recipe-card"
              key={recipe.id}
              onClick={() => setSelectedRecipe(recipe)}
            >
              <RecipeImage recipe={recipe} />

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
                  {recipe.importSource && <span>Imported</span>}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <style>{`
        .library-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .recipe-image-frame {
          height: 150px;
          position: relative;
          overflow: hidden;
          border-radius: var(--radius-sm);
          background: var(--primary-soft);
        }

        .recipe-image-frame img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .recipe-image-fallback {
          display: none;
          width: 100%;
          height: 100%;
          place-items: center;
          color: var(--primary);
          font-size: 2rem;
          font-weight: 800;
        }

        .recipe-image-frame.image-failed .recipe-image-fallback {
          display: grid;
        }

        @media (max-width: 600px) {
          .library-heading {
            align-items: flex-start;
          }

          .library-actions {
            flex-direction: column-reverse;
            align-items: flex-end;
            gap: 5px;
          }

          .recipe-image-frame {
            height: 130px;
          }
        }
      `}</style>
    </div>
  )
}

export default RecipeLibrary
