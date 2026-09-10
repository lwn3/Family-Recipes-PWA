import { useEffect, useState } from 'react'

function RecipeImage({ recipe, className = '', alt = '' }) {
  const [blobUrl, setBlobUrl] = useState(null)

  useEffect(() => {
    if (!recipe?.imageBlob) {
      setBlobUrl(null)
      return undefined
    }

    const url = URL.createObjectURL(recipe.imageBlob)
    setBlobUrl(url)

    return () => URL.revokeObjectURL(url)
  }, [recipe?.imageBlob])

  const src = blobUrl || recipe?.imageUrl || null

  if (!src) {
    return (
      <div className={`recipe-image-placeholder ${className}`.trim()}>
        <span>{recipe?.title?.charAt(0)?.toUpperCase() || 'R'}</span>
      </div>
    )
  }

  return (
    <div className={`recipe-image-frame ${className}`.trim()}>
      <img
        src={src}
        alt={alt || recipe?.title || 'Recipe'}
        loading="lazy"
        onError={(event) => {
          event.currentTarget.style.display = 'none'
          event.currentTarget.parentElement?.classList.add('image-failed')
        }}
      />
      <span className="recipe-image-fallback">
        {recipe?.title?.charAt(0)?.toUpperCase() || 'R'}
      </span>
    </div>
  )
}

export default RecipeImage
