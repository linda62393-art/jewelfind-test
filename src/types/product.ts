import type { JewelryCategory } from './matching'

export interface JewelryProduct {
  id: string
  sku: string
  name: string
  category: JewelryCategory
  materials: string[]
  styleTags: string[]
  price: number | null
  images: string[]
  featureTags: string[]
  description: string
  specifications: string
  availableLocations: string[]
  mainStone: string | null
  mainStoneWeight: string | null
  accentStone: string | null
  accentStoneWeight: string | null
  metal: string | null
  chainMetal: string | null
  stock: number | null
  sourceStatus: string | null
  available: boolean
  unavailableReason: string | null
}
