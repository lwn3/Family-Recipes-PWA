import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import IngredientDetail from './IngredientDetail'

function IngredientsLibrary() {
  const [selectedIngredient, setSelectedIngredient] = useState(null)

  const items = useLiveQuery(
    () => db.ingredients.orderBy('name').toArray(),
    []
  )

  async function markReviewed(id) {
    await db.ingredients.update(id, {
      importReviewPending: false,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }

  async function markAllReviewed() {
    const pending = (items || []).filter(
      (item) => item.importReviewPending === true
    )

    const now = new Date().toISOString()

    await db.transaction('rw', db.ingredients, async () => {
      for (const item of pending) {
        await db.ingredients.update(item.id, {
          importReviewPending: false,
          reviewedAt: now,
          updatedAt: now,
        })
      }
    })
  }

  if (selectedIngredient) {
    return (
      <IngredientDetail
        ingredient={selectedIngredient}
        onBack={() => setSelectedIngredient(null)}
      />
    )
  }

  const reviewItems =
    items?.filter(
      (item) => item.importReviewPending === true
    ) || []

  const reviewedItems =
    items?.filter(
      (item) => item.importReviewPending !== true
    ) || []

  const ingredients =
    reviewedItems.filter(
      (item) => item.isIngredient !== false
    )

  const preparedItems =
    reviewedItems.filter(
      (item) => item.isPreparedItem === true
    )

  function renderItem(item, showReviewButton = false) {
    return (
      <div className="ingredient-review-wrapper" key={item.id}>
        <button
          className="ingredient-library-item"
          onClick={() => setSelectedIngredient(item)}
        >
          <div className="ingredient-avatar">
            {item.name.charAt(0).toUpperCase()}
          </div>

          <div>
            <strong>{item.name}</strong>

            <span>
              {showReviewButton
                ? 'Imported · Needs review'
                : item.staple
                  ? 'Staple · Check first'
                  : item.isIngredient && item.isPreparedItem
                    ? 'Ingredient · Prepared item'
                    : item.isPreparedItem
                      ? 'Prepared grocery item'
                      : 'Ingredient'}
            </span>
          </div>
        </button>

        {showReviewButton && (
          <button
            className="review-done-button"
            onClick={() => markReviewed(item.id)}
          >
            ✓ Reviewed
          </button>
        )}
      </div>
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

      {reviewItems.length > 0 && (
        <section className="master-library-section import-review-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Import review</p>
              <h3>New Ingredients to Review</h3>
              <p className="field-help">
                These were created automatically from imported recipes. Check names, categories, variants, package sizes, and nutrition before moving them into the regular library.
              </p>
            </div>

            <span className="section-count">
              {reviewItems.length}
            </span>
          </div>

          <div className="import-review-actions">
            <button
              className="text-button small"
              onClick={markAllReviewed}
            >
              Mark all reviewed
            </button>
          </div>

          <div className="ingredient-library-list">
            {reviewItems.map((item) => renderItem(item, true))}
          </div>
        </section>
      )}

      <section className="master-library-section">
        <div className="section-heading">
          <h3>Ingredients</h3>
          <span className="section-count">
            {ingredients.length}
          </span>
        </div>

        {!ingredients.length ? (
          <div className="empty-library">
            <strong>No reviewed ingredients yet</strong>
          </div>
        ) : (
          <div className="ingredient-library-list">
            {ingredients.map((item) => renderItem(item))}
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
            {preparedItems.map((item) => renderItem(item))}
          </div>
        )}
      </section>

      <style>{`
        .import-review-section {
          padding: 16px;
          border: 1px solid var(--border-strong);
          border-radius: var(--radius-md);
          background: var(--primary-soft);
        }

        .import-review-actions {
          display: flex;
          justify-content: flex-end;
          margin: -4px 0 10px;
        }

        .ingredient-review-wrapper {
          position: relative;
          display: grid;
          gap: 6px;
        }

        .review-done-button {
          justify-self: end;
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 5px 9px;
          background: var(--surface);
          color: var(--primary);
          font-size: 0.7rem;
          font-weight: 800;
        }
      `}</style>
    </div>
  )
}

export default IngredientsLibrary
