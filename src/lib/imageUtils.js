/**
 * Utilitaire de compression d'image côté client
 * Utilise Canvas API (natif navigateur, 0 dépendance)
 */

/**
 * Compresse et redimensionne une image avant upload
 * @param {File} file - Fichier image original
 * @param {number} maxWidth - Largeur maximale en pixels (défaut: 1200)
 * @param {number} quality - Qualité JPEG 0-1 (défaut: 0.7)
 * @returns {Promise<Blob>} Image compressée en JPEG
 */
export async function compressImage(file, maxWidth = 1200, quality = 0.7) {
  // Validation taille maximale avant compression
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Fichier trop volumineux (max 10 MB)')
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl) // Libérer la mémoire

      const canvas = document.createElement('canvas')
      let { width, height } = img

      // Redimensionner si nécessaire (garder le ratio)
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width)
        width = maxWidth
      }

      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Compression échouée'))
          }
        },
        'image/jpeg',
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Image invalide'))
    }

    img.src = objectUrl
  })
}
