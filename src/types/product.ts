import type { JewelryCategory } from './matching'

export interface JewelryProduct {
  id: string
  name: string
  category: JewelryCategory
  materials: string[]
  styleTags: string[]
  price: number
  images: string[]
  description: string
  specifications: string
  availableLocations: string[]
}
