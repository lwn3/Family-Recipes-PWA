import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import RecipeImage from './RecipeImage'

function DiscoverRecipeDetail({ recipe, ownerProfile, onBack, onAdd }) {
  const ingredients = useLiveQuery(
    () => db.recipeIngredients.where('recipeId').equals(recipe.id).sortBy('sortOrder'),
    [recipe.id]
  )

  const directions = useLiveQuery(
    () => db.recipeDirections.where('recipeId').equals(recipe.id).sortBy('sortOrder'),
    [recipe.id]
  )

  const tags = useLiveQuery(async () => {
    const links = await db.recipeTags.where('recipeId').equals(recipe.id).toArray()
    const records = await Promise.all(links.map((link) => db.tags.get(link.tagId)))
    return records.filter(Boolean)
  }, [recipe.id])

  return (
    <div className="discover-recipe-detail">
      <div className="recipe-detail-top">
        <button className="primary-button compact" onClick={onBack}>← Back</button>
        <button className="primary-button compact" onClick={onAdd}>Add to My Library</button>
      </div>

      <RecipeImage recipe={recipe} className="discover-detail-image" />

      <div className="recipe-detail-header">
        <p className="eyebrow">Discover</p>
        <h1>{recipe.title}</h1>
        <p className="recipe-artist">By {ownerProfile?.name || 'Another household'}</p>

        {tags?.length > 0 && (
          <div className="chip-list">
            {tags.map((tag) => <span className="tag-chip" key={tag.id}>{tag.name}</span>)}
          </div>
        )}
      </div>

      <div className="recipe-content-grid">
        <div>
          <section className="recipe-section">
            <h2>Ingredients</h2>
            <div className="ingredient-list">
              {ingredients?.map((item) => (
                <div className="recipe-ingredient-row" key={item.id}>
                  <span>{item.originalText || [item.quantity, item.unit, item.parsedIngredientText].filter(Boolean).join(' ')}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="recipe-section">
            <h2>Directions</h2>
            <ol className="direction-list">
              {directions?.map((direction) => <li key={direction.id}>{direction.text}</li>)}
            </ol>
          </section>

          {recipe.notes && (
            <section className="recipe-section">
              <h2>Notes</h2>
              <p>{recipe.notes}</p>
            </section>
          )}
        </div>
      </div>

      <div className="discover-copy-callout">
        <div>
          <strong>Like this track?</strong>
          <span>Add a copy to your library. Their original stays untouched.</span>
        </div>
        <button className="primary-button" onClick={onAdd}>Add to My Library</button>
      </div>
    </div>
  )
}

export default DiscoverRecipeDetail
