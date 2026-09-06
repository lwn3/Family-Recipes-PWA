import { useState } from 'react'
import {
  searchUsdaFoods,
  getUsdaFood,
  extractNutrition,
} from '../services/usda'

function UsdaNutritionLookup({
  ingredientName,
  onSelect,
}) {
  const [query, setQuery] =
    useState(ingredientName)

  const [results, setResults] =
    useState([])

  const [loading, setLoading] =
    useState(false)

  const [error, setError] =
    useState('')

  async function handleSearch() {
    const cleaned = query.trim()

    if (!cleaned) return

    setLoading(true)
    setError('')

    try {
      const foods =
        await searchUsdaFoods(cleaned)

      setResults(foods)
    } catch (err) {
      console.error(err)

      setError(
        'Could not search USDA right now.'
      )
    } finally {
      setLoading(false)
    }
  }

  async function chooseFood(food) {
    setLoading(true)
    setError('')

    try {
      const details =
        await getUsdaFood(food.fdcId)

      const nutrients =
        extractNutrition(details)

      onSelect({
        ...nutrients,

        fdcId: food.fdcId,

        sourceName:
          food.description,

        dataType:
          food.dataType,
      })
    } catch (err) {
      console.error(err)

      setError(
        'Could not load nutrition details.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="usda-lookup">
      <div className="inline-add-row">
        <input
          type="text"
          value={query}
          onChange={(event) =>
            setQuery(event.target.value)
          }
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              handleSearch()
            }
          }}
        />

        <button
          type="button"
          onClick={handleSearch}
          disabled={loading}
        >
          {loading ? 'Searching…' : 'Search USDA'}
        </button>
      </div>

      {error && (
        <p className="lookup-error">
          {error}
        </p>
      )}

      {results.length > 0 && (
        <div className="usda-results">
          {results.map((food) => (
            <button
              key={food.fdcId}
              type="button"
              className="usda-result"
              onClick={() =>
                chooseFood(food)
              }
            >
              <strong>
                {food.description}
              </strong>

              <span>
                {food.dataType}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default UsdaNutritionLookup