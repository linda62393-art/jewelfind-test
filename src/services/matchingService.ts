import type { MatchAnswers } from '../types/matching'
import type { JewelryProduct } from '../types/product'

const budgets: Record<string, [number, number]> = { 'under-10000': [0, 10000], '10000-30000': [10000, 30000], '30000-60000': [30000, 60000], '60000-100000': [60000, 100000], '100000-200000': [100000, 200000], '200000-500000': [200000, 500000], 'over-500000': [500000, Infinity] }

function score(product: JewelryProduct, answers: MatchAnswers) {
  let value = 0
  if (product.category === answers.category) value += 10
  if (answers.materials.some((material) => product.materials.includes(material))) value += 5
  if (answers.style && answers.style !== 'unsure' && product.styleTags.includes(answers.style)) value += 6
  if (answers.budget) { const [min, max] = budgets[answers.budget]; value += product.price >= min && product.price <= max ? 7 : 1 }
  if (answers.purpose === 'proposal-wedding' && ['ring', 'couple-ring'].includes(product.category)) value += 4
  if (answers.purpose === 'self' && ['earrings', 'necklace', 'bracelet'].includes(product.category)) value += 2
  return value
}

export function getRecommendations(products: JewelryProduct[], answers: MatchAnswers, excludedIds: string[] = []) {
  return products.filter((product) => !excludedIds.includes(product.id)).map((product) => ({ product, score: score(product, answers) })).sort((a, b) => b.score - a.score || a.product.price - b.product.price).slice(0, 5).map(({ product }) => product)
}
