const MAX_EDGE = 1600
const TARGET_BYTES = 700_000

export async function compressReceipt(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file')

  const bitmap = await createImageBitmap(file)
  try {
    let scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    let quality = 0.8
    let blob: Blob | null = null

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const width = Math.max(1, Math.round(bitmap.width * scale))
      const height = Math.max(1, Math.round(bitmap.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) return file
      context.drawImage(bitmap, 0, 0, width, height)
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', quality),
      )
      if (!blob || blob.size <= TARGET_BYTES) break
      if (quality > 0.55) quality -= 0.1
      else scale *= 0.8
    }

    if (!blob) return file
    if (file.size <= TARGET_BYTES && blob.size >= file.size) return file
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'receipt'}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  } finally {
    bitmap.close()
  }
}
