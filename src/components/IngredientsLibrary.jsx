import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import IngredientDetail from './IngredientDetail'
import {
  ensureIngredientForProfile,
  hideIngredientForProfile,
  markIngredientReviewed,
  mergeIngredients,
} from '../utils/profileIngredients'

function IngredientsLibrary({ activeProfile }) {
  const [selectedIngredient, setSelectedIngredient] = useState(null)
  const [showOthers, setShowOthers] = useState(false)
  const [mergeSourceId, setMergeSourceId] = useState(null)
  const [mergeTargetId, setMergeTargetId] = useState('')

  const data = useLiveQuery(async () => {
    const profileRecipes = await db.recipes
      .where('profileId')
      .equals(activeProfile.id)
      .filter((recipe) => !recipe.deletedAt)
      .toArray()

    for (const recipe of profileRecipes) {
      const recipeIngredients = await db.recipeIngredients
        .where('recipeId')
        .equals(recipe.id)
        .toArray()

      for (const row of recipeIngredients) {
        if (!row.ingredientId) continue

        const existingMembership = await db.ingredientProfiles
          .where('[profileId+ingredientId]')
          .equals([activeProfile.id, row.ingredientId])
          .first()

        if (!existingMembership || existingMembership.visible === false) {
          const ingredient = await db.ingredients.get(row.ingredientId)
          const reviewPending = Boolean(
            ingredient?.importBatchId &&
            recipe.importBatchId &&
            ingredient.importBatchId === recipe.importBatchId
          )

          await ensureIngredientForProfile(activeProfile.id, row.ingredientId, { reviewPending })
        }
      }
    }

    const items = await db.ingredients.orderBy('name').toArray()
    const memberships = await db.ingredientProfiles
      .where('profileId')
      .equals(activeProfile.id)
      .toArray()

    return { items, memberships }
  }, [activeProfile.id])

  if (selectedIngredient) {
    return (
      <IngredientDetail
        ingredient={selectedIngredient}
        onBack={() => setSelectedIngredient(null)}
      />
    )
  }

  const membershipsByIngredient = useMemo(() => {
    const map = new Map()
    for (const row of data?.memberships || []) map.set(row.ingredientId, row)
    return map
  }, [data])

  const visibleItems = (data?.items || []).filter(
    (item) => membershipsByIngredient.has(item.id) && membershipsByIngredient.get(item.id)?.visible !== false
  )
  const otherItems = (data?.items || []).filter(
    (item) => !membershipsByIngredient.has(item.id) || membershipsByIngredient.get(item.id)?.visible === false
  )
  const pendingItems = visibleItems.filter((item) => membershipsByIngredient.get(item.id)?.reviewPending)
  const normalItems = visibleItems.filter((item) => !membershipsByIngredient.get(item.id)?.reviewPending)
  const ingredients = normalItems.filter((item) => item.isIngredient !== false)
  const preparedItems = normalItems.filter((item) => item.isPreparedItem === true)

  async function removeFromProfile(item) {
    if (!window.confirm(`Remove "${item.name}" from ${activeProfile.name}?\n\nExisting recipes will keep working. The ingredient will stop showing for this profile until you add it again or a recipe needs it.`)) return
    await hideIngredientForProfile(activeProfile.id, item.id)
  }

  async function addToProfile(item) {
    await ensureIngredientForProfile(activeProfile.id, item.id)
  }

  async function markReviewed(item) {
    await markIngredientReviewed(activeProfile.id, item.id)
  }

  async function markAllReviewed() {
    for (const item of pendingItems) await markIngredientReviewed(activeProfile.id, item.id)
  }

  async function performMerge(source) {
    const targetId = Number(mergeTargetId)
    const target = (data?.items || []).find((item) => item.id === targetId)
    if (!target || target.id === source.id) return

    if (!window.confirm(`Merge "${source.name}" into "${target.name}"?\n\nRecipe links, profile visibility, variants, nutrition and pricing will be moved to ${target.name}. This cannot be undone automatically.`)) return

    await mergeIngredients(source.id, target.id)
    setMergeSourceId(null)
    setMergeTargetId('')
  }

  function renderItem(item, options = {}) {
    const isPending = options.pending
    const isOther = options.other
    const merging = mergeSourceId === item.id

    return (
      <div className="ingredient-library-row" key={item.id}>
        <button className="ingredient-library-item" onClick={() => setSelectedIngredient(item)}>
          <div className="ingredient-avatar">{item.name.charAt(0).toUpperCase()}</div>
          <div>
            <strong>{item.name}</strong>
            <span>
              {isPending
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

        <div className="ingredient-row-actions">
          {isPending && (
            <button className="text-button small" onClick={() => markReviewed(item)}>✓ Reviewed</button>
          )}
          {isOther ? (
            <button className="text-button small" onClick={() => addToProfile(item)}>+ Add to profile</button>
          ) : (
            <button className="text-button small danger-text" onClick={() => removeFromProfile(item)}>Remove</button>
          )}
          <button
            className="text-button small"
            onClick={() => {
              setMergeSourceId(merging ? null : item.id)
              setMergeTargetId('')
            }}
          >
            Merge
          </button>
        </div>

        {merging && (
          <div className="ingredient-merge-panel">
            <span>Merge <strong>{item.name}</strong> into:</span>
            <select value={mergeTargetId} onChange={(event) => setMergeTargetId(event.target.value)}>
              <option value="">Choose ingredient…</option>
              {(data?.items || [])
                .filter((candidate) => candidate.id !== item.id)
                .map((candidate) => (
                  <option value={candidate.id} key={candidate.id}>{candidate.name}</option>
                ))}
            </select>
            <button className="primary-button compact" disabled={!mergeTargetId} onClick={() => performMerge(item)}>
              Merge
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="ingredients-library">
      <div className="library-heading">
        <div>
          <p className="eyebrow">{activeProfile.name}</p>
          <h2>Ingredients</h2>
        </div>

        <button className="text-button" onClick={() => setShowOthers((value) => !value)}>
          {showOthers ? 'Show My Ingredients' : 'Other Profiles'}
        </button>
      </div>

      {showOthers ? (
        <section className="master-library-section">
          <div className="section-heading">
            <div>
              <h3>Other Profiles</h3>
              <p className="field-help">Shared master ingredients hidden or not yet used by {activeProfile.name}.</p>
            </div>
            <span className="section-count">{otherItems.length}</span>
          </div>

          {!otherItems.length ? (
            <div className="empty-library"><strong>No other ingredients yet</strong></div>
          ) : (
            <div className="ingredient-library-list">
              {otherItems.map((item) => renderItem(item, { other: true }))}
            </div>
          )}
        </section>
      ) : (
        <>
          {pendingItems.length > 0 && (
            <section className="master-library-section import-review-section">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Import review</p>
                  <h3>New Ingredients to Review</h3>
                  <p className="field-help">Clean up names, nutrition, variants, pricing, or merge duplicates before filing them into your regular list.</p>
                </div>
                <button className="text-button small" onClick={markAllReviewed}>Mark all reviewed</button>
              </div>
              <div className="ingredient-library-list">{pendingItems.map((item) => renderItem(item, { pending: true }))}</div>
            </section>
          )}

          <section className="master-library-section">
            <div className="section-heading"><h3>Ingredients</h3><span className="section-count">{ingredients.length}</span></div>
            {!ingredients.length ? (
              <div className="empty-library"><strong>No ingredients yet</strong></div>
            ) : (
              <div className="ingredient-library-list">{ingredients.map((item) => renderItem(item))}</div>
            )}
          </section>

          <section className="master-library-section">
            <div className="section-heading"><h3>Prepared Grocery Items</h3><span className="section-count">{preparedItems.length}</span></div>
            {!preparedItems.length ? (
              <div className="empty-library"><strong>No prepared grocery items yet</strong><p>Things like frozen fries, garlic bread, chips, or bagged salad will appear here.</p></div>
            ) : (
              <div className="ingredient-library-list">{preparedItems.map((item) => renderItem(item))}</div>
            )}
          </section>
        </>
      )}

      <style>{`
        .ingredient-library-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px; align-items:center; }
        .ingredient-row-actions { display:flex; gap:8px; align-items:center; flex-wrap:wrap; justify-content:flex-end; }
        .danger-text { color:var(--danger); }
        .ingredient-merge-panel { grid-column:1 / -1; display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:8px; align-items:center; padding:10px; border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--surface-soft); }
        .import-review-section { padding:16px; border:1px solid var(--border-strong); border-radius:var(--radius-md); background:var(--primary-soft); }
        @media (max-width:700px) {
          .ingredient-library-row { grid-template-columns:1fr; }
          .ingredient-row-actions { justify-content:flex-start; padding-left:4px; }
          .ingredient-merge-panel { grid-template-columns:1fr; }
        }
      `}</style>
    </div>
  )
}

export default IngredientsLibrary
