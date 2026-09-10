import { useMemo, useState } from 'react'
import { db } from '../db/database'
import { parseIngredientLine } from '../utils/parseIngredient'
import { parseMyCookBookFile } from '../utils/mcbImporter'
import { ensureIngredientForProfile } from '../utils/profileIngredients'
import './ImportRecipes.css'

function normalize(value) {
  return String(value || '').trim().toLowerCase()
}

function titleCaseIngredient(value) {
  return String(value || '').trim().replace(/\b\w/g, (letter) => letter.toUpperCase())
}

async function findOrCreateIngredient(name, importBatchId, profileId) {
  const cleanedName = String(name || '').trim()
  if (!cleanedName) return null

  let existing = await db.ingredients
    .filter((item) => normalize(item.name) === normalize(cleanedName))
    .first()

  const now = new Date().toISOString()

  if (!existing) {
    const id = await db.ingredients.add({
      name: cleanedName,
      staple: false,
      isIngredient: true,
      isPreparedItem: false,
      importReviewPending: true,
      importBatchId,
      importedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    existing = await db.ingredients.get(id)
  } else if (existing.isIngredient !== true) {
    await db.ingredients.update(existing.id, {
      isIngredient: true,
      updatedAt: now,
    })
  }

  await ensureIngredientForProfile(profileId, existing.id, {
    reviewPending: existing.importBatchId === importBatchId,
  })

  return existing.id
}

async function findOrCreateTag(name, now) {
  const cleanedName = String(name || '').trim()
  if (!cleanedName) return null

  const existing = await db.tags
    .filter((item) => normalize(item.name) === normalize(cleanedName))
    .first()

  if (existing) return existing.id
  return db.tags.add({ name: cleanedName, createdAt: now })
}

function ImportRecipes({ activeProfile, onDone, onCancel }) {
  const [fileName, setFileName] = useState('')
  const [recipes, setRecipes] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [duplicates, setDuplicates] = useState(new Set())
  const [expanded, setExpanded] = useState(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const selectedCount = selected.size
  const warningCount = useMemo(
    () => recipes.filter((recipe) => recipe.missingDirections || recipe.missingIngredients).length,
    [recipes]
  )

  async function chooseFile(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setBusy(true)
    setError('')
    setStatus('Reading cookbook...')
    setRecipes([])
    setSelected(new Set())
    setDuplicates(new Set())
    setFileName(file.name)

    try {
      const parsed = await parseMyCookBookFile(file)
      const existing = await db.recipes
        .where('profileId')
        .equals(activeProfile.id)
        .filter((recipe) => !recipe.deletedAt)
        .toArray()

      const duplicateKeys = new Set()

      parsed.forEach((recipe) => {
        const duplicate = existing.some((item) => {
          const sameTitle = normalize(item.title) === normalize(recipe.title)
          const sameUrl = recipe.sourceUrl && item.sourceUrl && normalize(item.sourceUrl) === normalize(recipe.sourceUrl)
          return sameTitle || sameUrl
        })
        if (duplicate) duplicateKeys.add(recipe.importKey)
      })

      setRecipes(parsed)
      setDuplicates(duplicateKeys)
      setSelected(new Set(parsed.filter((recipe) => !duplicateKeys.has(recipe.importKey)).map((recipe) => recipe.importKey)))
      setStatus(`${parsed.length} recipes found.`)
    } catch (caughtError) {
      console.error(caughtError)
      setError(caughtError.message || 'The cookbook could not be read.')
      setStatus('')
    } finally {
      setBusy(false)
      event.target.value = ''
    }
  }

  function toggleRecipe(importKey) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(importKey)) next.delete(importKey)
      else next.add(importKey)
      return next
    })
  }

  async function importSelected() {
    const chosen = recipes.filter((recipe) => selected.has(recipe.importKey))
    if (!chosen.length) return

    setBusy(true)
    setError('')

    try {
      let imported = 0
      const importBatchId = `import-${Date.now()}`

      for (const recipe of chosen) {
        setStatus(`Importing ${imported + 1} of ${chosen.length}: ${recipe.title}`)
        const now = new Date().toISOString()

        const recipeId = await db.recipes.add({
          profileId: activeProfile.id,
          title: recipe.title,
          mealType: recipe.mealType,
          servings: recipe.servings,
          sourceUrl: recipe.sourceUrl || null,
          notes: recipe.description || null,
          prepTime: recipe.prepTime || null,
          cookTime: recipe.cookTime || null,
          totalTime: recipe.totalTime || null,
          sourceName: recipe.sourceName || null,
          importedNutritionText: recipe.nutritionText || null,
          importedServingsText: recipe.servingsText || null,
          imageBlob: recipe.imageBlob || null,
          imageUrl: recipe.imageUrl || null,
          importSource: 'My CookBook',
          importFileName: fileName,
          importBatchId,
          importWarnings: [
            recipe.missingDirections ? 'Directions missing from source file' : null,
            recipe.missingIngredients ? 'Ingredients missing from source file' : null,
          ].filter(Boolean),
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        })

        for (let index = 0; index < recipe.ingredients.length; index++) {
          const originalText = recipe.ingredients[index]
          const parsed = parseIngredientLine(originalText)
          const ingredientName = titleCaseIngredient(parsed.ingredientText)
          const ingredientId = await findOrCreateIngredient(
            ingredientName,
            importBatchId,
            activeProfile.id
          )

          await db.recipeIngredients.add({
            recipeId,
            originalText: parsed.ingredientLine || originalText,
            sourceOriginalText: originalText,
            quantity: parsed.quantity,
            unit: parsed.unit,
            parsedIngredientText: parsed.ingredientText,
            ingredientId,
            variantId: null,
            note: parsed.note || null,
            sortOrder: index,
          })
        }

        for (let index = 0; index < recipe.directions.length; index++) {
          await db.recipeDirections.add({ recipeId, text: recipe.directions[index], sortOrder: index })
        }

        for (const tagName of recipe.tags) {
          const tagId = await findOrCreateTag(tagName, now)
          if (tagId) await db.recipeTags.add({ recipeId, tagId })
        }

        imported++
      }

      setStatus(`${imported} recipe${imported === 1 ? '' : 's'} imported. New ingredients are waiting in Ingredients > Import Review.`)
      setTimeout(() => onDone(), 900)
    } catch (caughtError) {
      console.error(caughtError)
      setError(caughtError.message || 'The recipes could not be imported.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="recipe-importer">
      <div className="form-heading">
        <div><p className="eyebrow">Bring your cookbook with you</p><h2>Import Recipes</h2></div>
        <button type="button" className="text-button" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>

      <section className="import-upload-card">
        <div>
          <strong>Choose a cookbook file</strong>
          <p>My CookBook <b>.mcb</b> and <b>.xml</b> are supported now.</p>
        </div>
        <label className="primary-button compact import-file-button">
          Choose File
          <input type="file" accept=".mcb,.xml,application/xml,text/xml" onChange={chooseFile} disabled={busy} />
        </label>
      </section>

      {fileName && <p className="import-file-name">File: <strong>{fileName}</strong></p>}
      {status && <p className="import-status">{status}</p>}
      {error && <div className="import-error">{error}</div>}

      {recipes.length > 0 && (
        <>
          <div className="import-summary-card">
            <div><strong>{recipes.length}</strong><span>Found</span></div>
            <div><strong>{selectedCount}</strong><span>Selected</span></div>
            <div><strong>{duplicates.size}</strong><span>Possible duplicates</span></div>
            <div><strong>{warningCount}</strong><span>Need review</span></div>
          </div>

          <div className="import-toolbar">
            <div>
              <button type="button" className="text-button small" onClick={() => setSelected(new Set(recipes.map((recipe) => recipe.importKey)))}>Select all</button>
              <button type="button" className="text-button small" onClick={() => setSelected(new Set())}>Select none</button>
            </div>
            <button type="button" className="primary-button compact" onClick={importSelected} disabled={busy || selectedCount === 0}>Import {selectedCount || ''} Selected</button>
          </div>

          <div className="import-preview-list">
            {recipes.map((recipe) => {
              const isDuplicate = duplicates.has(recipe.importKey)
              const isExpanded = expanded === recipe.importKey

              return (
                <article className="import-preview-card" key={recipe.importKey}>
                  <div className="import-preview-main">
                    <input className="import-checkbox" type="checkbox" checked={selected.has(recipe.importKey)} onChange={() => toggleRecipe(recipe.importKey)} aria-label={`Import ${recipe.title}`} />
                    <div className="import-preview-copy">
                      <strong>{recipe.title}</strong>
                      <span>{recipe.ingredients.length} ingredients · {recipe.directions.length} steps{recipe.servingsText ? ` · ${recipe.servingsText}` : ''}</span>
                      <div className="import-badges">
                        {isDuplicate && <span className="import-badge duplicate">Possible duplicate</span>}
                        {recipe.missingDirections && <span className="import-badge warning">Directions missing</span>}
                        {recipe.missingIngredients && <span className="import-badge warning">Ingredients missing</span>}
                        {recipe.imageBlob && <span className="import-badge">Image included</span>}
                      </div>
                    </div>
                    <button type="button" className="text-button small" onClick={() => setExpanded(isExpanded ? null : recipe.importKey)}>{isExpanded ? 'Hide' : 'Review'}</button>
                  </div>

                  {isExpanded && (
                    <div className="import-expanded">
                      {recipe.description && <div><strong>Description</strong><p>{recipe.description}</p></div>}
                      <div><strong>Ingredients</strong>{recipe.ingredients.length ? <ul>{recipe.ingredients.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p>None found in source file.</p>}</div>
                      <div><strong>Directions</strong>{recipe.directions.length ? <ol>{recipe.directions.map((item, index) => <li key={index}>{item}</li>)}</ol> : <p>None found in source file.</p>}</div>
                      {recipe.tags.length > 0 && <div><strong>Tags</strong><p>{recipe.tags.join(', ')}</p></div>}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export default ImportRecipes
