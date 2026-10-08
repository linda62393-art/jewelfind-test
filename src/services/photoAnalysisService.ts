import type { JewelryCategory } from '../types/matching'
import { photoFeatureOptions } from './matchingService'

const allowedFeatures: Set<string> = new Set(Object.values(photoFeatureOptions).flat().map(option => option.value))

async function makePreview(file: File): Promise<string> {
  if (!file.type.startsWith('image/') || file.size > 12 * 1024 * 1024) throw new Error('invalid image')
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.76)
  } finally {
    bitmap.close()
  }
}

export async function analyzeJewelryPhoto(file: File, category?: JewelryCategory): Promise<string[]> {
  const backend = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!backend || !anonKey) throw new Error('photo analysis unavailable')
  const image = await makePreview(file)
  if (image.length > 1_400_000) throw new Error('image too large')
  const response = await fetch(`${backend}/functions/v1/analyze-jewelry-photo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ image, category }),
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) throw new Error('photo analysis failed')
  const data: unknown = await response.json()
  if (!data || typeof data !== 'object' || !('features' in data) || !Array.isArray(data.features)) throw new Error('invalid analysis')
  return data.features.filter((value): value is string => typeof value === 'string' && allowedFeatures.has(value))
}
