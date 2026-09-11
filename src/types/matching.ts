export type JewelryCategory = 'ring' | 'earrings' | 'necklace' | 'bracelet' | 'mens-ring' | 'couple-ring' | 'other'

export interface MatchAnswers {
  purpose?: string
  category?: JewelryCategory
  materials: string[]
  budget?: string
  style?: string
  uploadedImage?: File
  uploadedImagePreview?: string
}

export type MatchQuestionId = 'purpose' | 'product' | 'budget' | 'style' | 'image'

export interface Choice {
  value: string
  label: string
  description?: string
}

export interface MatchQuestion {
  id: MatchQuestionId
  eyebrow: string
  title: string
  hint?: string
  choices?: Choice[]
}
