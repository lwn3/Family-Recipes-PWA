const textDecoder = new TextDecoder('utf-8')

function findEndOfCentralDirectory(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const min = Math.max(0, bytes.length - 65557)

  for (let offset = bytes.length - 22; offset >= min; offset--) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      return offset
    }
  }

  throw new Error('This file does not appear to be a valid .mcb/ZIP archive.')
}

async function inflateRaw(data) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser cannot unpack .mcb files. Please use a current version of Chrome, Edge, or another modern browser.')
  }

  const stream = new Blob([data])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'))

  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function readZipEntries(file) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const eocdOffset = findEndOfCentralDirectory(bytes)
  const entryCount = view.getUint16(eocdOffset + 10, true)
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true)

  const entries = new Map()
  let offset = centralDirectoryOffset

  for (let index = 0; index < entryCount; index++) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error('The .mcb archive directory is damaged or unsupported.')
    }

    const compressionMethod = view.getUint16(offset + 10, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const fileNameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const localHeaderOffset = view.getUint32(offset + 42, true)

    const fileNameBytes = bytes.slice(offset + 46, offset + 46 + fileNameLength)
    const fileName = textDecoder.decode(fileNameBytes)

    if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) {
      throw new Error(`The archive entry ${fileName} has an invalid local header.`)
    }

    const localNameLength = view.getUint16(localHeaderOffset + 26, true)
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true)
    const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength
    const compressedData = bytes.slice(dataOffset, dataOffset + compressedSize)

    let data

    if (compressionMethod === 0) {
      data = compressedData
    } else if (compressionMethod === 8) {
      data = await inflateRaw(compressedData)
    } else {
      throw new Error(`The archive uses unsupported ZIP compression method ${compressionMethod}.`)
    }

    entries.set(fileName, data)
    offset += 46 + fileNameLength + extraLength + commentLength
  }

  return entries
}

function text(node, selector) {
  return node.querySelector(selector)?.textContent?.trim() || ''
}

function listText(node, selector) {
  return Array.from(node.querySelectorAll(selector))
    .map((item) => item.textContent?.trim() || '')
    .filter(Boolean)
}

function directTextList(node, tagName) {
  return Array.from(node.children)
    .filter((child) => child.tagName.toLowerCase() === tagName.toLowerCase())
    .map((child) => child.textContent?.trim() || '')
    .filter(Boolean)
}

function parseServings(value) {
  const match = String(value || '').match(/\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : null
}

function guessMealType(tags) {
  const normalized = tags.map((tag) => tag.toLowerCase())
  const options = [
    ['breakfast', 'Breakfast'],
    ['lunch', 'Lunch'],
    ['dinner', 'Dinner'],
    ['side', 'Side'],
    ['dessert', 'Dessert'],
    ['snack', 'Snack'],
    ['drink', 'Drink'],
  ]

  for (const [needle, label] of options) {
    if (normalized.some((tag) => tag === needle || tag.includes(needle))) {
      return label
    }
  }

  return null
}

function unique(values) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function mimeTypeForPath(path) {
  const lower = path.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  return 'image/jpeg'
}

export function parseMyCookBookXml(xmlText) {
  const parser = new DOMParser()
  const document = parser.parseFromString(xmlText, 'application/xml')

  if (document.querySelector('parsererror')) {
    throw new Error('The cookbook XML could not be read.')
  }

  const recipeNodes = Array.from(document.querySelectorAll('cookbook > recipe'))

  if (!recipeNodes.length) {
    throw new Error('No My CookBook recipes were found in this file.')
  }

  return recipeNodes.map((recipe, index) => {
    const tags = unique([
      ...directTextList(recipe, 'tag'),
      ...directTextList(recipe, 'category'),
      ...directTextList(recipe, 'group'),
    ])

    const directions = listText(recipe, 'recipetext > li')
    const ingredients = listText(recipe, 'ingredient > li')
    const description = listText(recipe, 'description > li').join('\n\n')
    const nutritionText = listText(recipe, 'nutrition > li').join('\n')
    const sourceName = listText(recipe, 'source > li').join(', ')

    return {
      importKey: `mcb-${index}`,
      title: text(recipe, 'title') || `Untitled Recipe ${index + 1}`,
      servings: parseServings(text(recipe, 'quantity')),
      servingsText: text(recipe, 'quantity'),
      prepTime: text(recipe, 'preptime'),
      cookTime: text(recipe, 'cooktime'),
      totalTime: text(recipe, 'totaltime'),
      description,
      ingredients,
      directions,
      sourceUrl: text(recipe, 'url'),
      sourceName,
      nutritionText,
      imagePath: text(recipe, 'imagepath'),
      imageUrl: text(recipe, 'imageurl'),
      tags,
      mealType: guessMealType(tags),
      missingDirections: directions.length === 0,
      missingIngredients: ingredients.length === 0,
      imageBlob: null,
    }
  })
}

export async function parseMyCookBookFile(file) {
  const lowerName = file.name.toLowerCase()

  if (lowerName.endsWith('.xml')) {
    return parseMyCookBookXml(await file.text())
  }

  if (!lowerName.endsWith('.mcb')) {
    throw new Error('Choose a My CookBook .mcb or .xml export for this importer.')
  }

  const entries = await readZipEntries(file)
  const xmlEntry = [...entries.entries()].find(([name]) => name.toLowerCase().endsWith('.xml'))

  if (!xmlEntry) {
    throw new Error('The .mcb archive does not contain a cookbook XML file.')
  }

  const recipes = parseMyCookBookXml(textDecoder.decode(xmlEntry[1]))

  for (const recipe of recipes) {
    if (!recipe.imagePath) continue

    const imageBytes = entries.get(recipe.imagePath)
    if (!imageBytes) continue

    recipe.imageBlob = new Blob([imageBytes], {
      type: mimeTypeForPath(recipe.imagePath),
    })
  }

  return recipes
}
