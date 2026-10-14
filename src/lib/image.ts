const MAX_EDGE = 1600
const START_QUALITY = 0.82
const SIZE_LIMIT = 1_400_000
const HEIC_BRANDS = new Set(["mif1", "msf1", "heic", "heix", "hevc", "hevx"])

function looksLikeHeic(file: File) {
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()
  return name.endsWith(".heic") || name.endsWith(".heif") || type === "image/heic" || type === "image/heif"
}

async function fileIsHeic(file: File) {
  if (looksLikeHeic(file)) return true
  if (file.size < 12) return false
  const brand = new TextDecoder()
    .decode(await file.slice(8, 12).arrayBuffer())
    .replace("\0", " ")
    .trim()
  return HEIC_BRANDS.has(brand)
}

async function decodeToBitmap(file: File) {
  if (await fileIsHeic(file)) {
    try {
      return await createImageBitmap(file)
    } catch {
      const { heicTo } = await import("heic-to")
      return heicTo({ blob: file, type: "bitmap" })
    }
  }
  return createImageBitmap(file)
}

function bitmapToJpeg(bitmap: ImageBitmap, quality: number) {
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Браузер не смог подготовить фото")
  context.drawImage(bitmap, 0, 0, width, height)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error("Не удалось сжать фото"))
    }, "image/jpeg", quality)
  })
}

export async function preparePhoto(file: File) {
  let bitmap: ImageBitmap
  try {
    bitmap = await decodeToBitmap(file)
  } catch {
    throw new Error("Не удалось открыть фото. Выберите снимок ещё раз.")
  }
  try {
    const jpeg = await bitmapToJpeg(bitmap, 0.92)
    const base = file.name.replace(/\.[^.]+$/, "") || "photo"
    return new File([jpeg], `${base}.jpg`, { type: "image/jpeg" })
  } finally {
    bitmap.close()
  }
}

async function renderJpeg(file: Blob, quality: number) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")
  if (!context) {
    bitmap.close()
    throw new Error("Браузер не смог подготовить фото")
  }
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality)
  })
  if (!blob) throw new Error("Не удалось сжать фото")
  return blob
}

export async function compressPhoto(file: Blob) {
  try {
    let quality = START_QUALITY
    let blob = await renderJpeg(file, quality)
    while (blob.size > SIZE_LIMIT && quality > 0.5) {
      quality = Math.round((quality - 0.1) * 10) / 10
      blob = await renderJpeg(file, quality)
    }
    return blob
  } catch {
    throw new Error("Не удалось подготовить фото. Выберите снимок ещё раз.")
  }
}

export function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== "string") {
        reject(new Error("Не удалось прочитать фото"))
        return
      }
      const comma = result.indexOf(",")
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(new Error("Не удалось прочитать фото"))
    reader.readAsDataURL(blob)
  })
}
