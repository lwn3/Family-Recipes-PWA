import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import IngredientDetail from './IngredientDetail'

function IngredientsLibrary() {
  const [selectedIngredient, setSelectedIngredient] =
    useState(null)

  const items = useLiveQuery(
    () => db.ingredients.orderBy('name').toArray(),
    []
  )

  if (selectedIngredient) {
    return (
      <IngredientDetail
        ingredient={selectedIngredient}
        onBack={() => setSelectedIngredient(null)}
      />
    )
  }

  const ingredients =
    items?.filter(
      (item) => item.isIngredient !== false
    ) || []

  const preparedItems =
    items?.filter(
      (item) => item.isPreparedItem === true
    ) || []

  function renderItem(item) {
    return (
      <button
        className="ingredient-library-item"
        key={item.id}
        onClick={() => setSelectedIngredient(item)}
      >
        <div className="ingredient-avatar">
          {item.name.charAt(0).toUpperCase()}
        </div>

        <div>
          <strong>{item.name}</strong>

          <span>
            {item.staple
              ? 'Staple · Check first'
              : item.isIngredient && item.isPreparedItem
                ? 'Ingredient · Prepared item'
                : item.isPreparedItem
                  ? 'Prepared grocery item'
                  : 'Ingredient'}
          </span>
        </div>
      </button>
    )
  }

  return (
  <div className="ingredients-library">
      <div className="library-heading">
        <div>
          <p className="eyebrow">Master library</p>
          <h2>Ingredients</h2>
        </div>
      </div>

      <section className="master-library-section">
        <div className="section-heading">
          <h3>Ingredients</h3>
          <span className="section-count">
            {ingredients.length}
          </span>
        </div>

        {!ingredients.length ? (
          <div className="empty-library">
            <strong>No ingredients yet</strong>
          </div>
        ) : (
          <div className="ingredient-library-list">
            {ingredients.map(renderItem)}
          </div>
        )}
      </section>

      <section className="master-library-section">
        <div className="section-heading">
          <h3>Prepared Grocery Items</h3>
          <span className="section-count">
            {preparedItems.length}
          </span>
        </div>

        {!preparedItems.length ? (
          <div className="empty-library">
            <strong>No prepared grocery items yet</strong>
            <p>
              Things like frozen fries, garlic bread, chips,
              or bagged salad will appear here.
            </p>
          </div>
        ) : (
          <div className="ingredient-library-list">
            {preparedItems.map(renderItem)}
          </div>
        )}
      </section>
    </div>
  )
}

export default IngredientsLibrary