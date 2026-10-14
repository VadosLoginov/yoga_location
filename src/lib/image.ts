const MAX_EDGE = 1600
const START_QUALITY = 0.82
const SIZE_LIMIT = 1_400_000

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
    throw new Error("Это фото браузер не открыл. Выберите JPEG с айфона.")
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
