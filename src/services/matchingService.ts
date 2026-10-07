import type { MatchAnswers } from '../types/matching'
import type { JewelryProduct } from '../types/product'

const budgets: Record<string, [number, number]> = { 'under-10000': [0, 10000], '10000-30000': [10000, 30000], '30000-60000': [30000, 60000], '60000-100000': [60000, 100000], '100000-200000': [100000, 200000], '200000-500000': [200000, 500000], 'over-500000': [500000, Infinity] }

function score(product: JewelryProduct, answers: MatchAnswers) {
  let value = 0
  if (product.category === answers.category) value += 10
  if (answers.materials.some((material) => product.materials.includes(material))) value += 5
  if (answers.style && answers.style !== 'unsure' && product.styleTags.includes(answers.style)) value += 6
  if (answers.budget && product.price !== null) { const [min, max] = budgets[answers.budget]; value += product.price >= min && product.price <= max ? 7 : 1 }
  if (answers.purpose === 'proposal-wedding' && ['ring', 'couple-ring'].includes(product.category)) value += 4
  if (answers.purpose === 'self' && ['earrings', 'necklace', 'bracelet'].includes(product.category)) value += 2
  return value
}

export function getRecommendations(products: JewelryProduct[], answers: MatchAnswers, excludedIds: string[] = []) {
  return products.filter((product) => product.available && !excludedIds.includes(product.id)).map((product) => ({ product, score: score(product, answers) })).sort((a, b) => b.score - a.score || (a.product.price ?? Infinity) - (b.product.price ?? Infinity)).slice(0, 5).map(({ product }) => product)
}

// These are visible merchandising clues in the catalog copy, not an automatic diagnosis of an uploaded image.
export const photoFeatureOptions = {
  stone: [
    { value: 'prong', label: '單鑽／爪鑲', pattern: /單鑽|單石|四爪|六爪|爪鑲/iu },
    { value: 'halo', label: '花形／群鑲', pattern: /花形|花簇|花朵|花瓣|群鑲|光環|halo/iu },
    { value: 'bezel', label: '包鑲', pattern: /包鑲/iu },
    { value: 'pave', label: '排鑽／密鑲', pattern: /排鑽|線戒|滿鑽|密鑲|鋪鑲|半圈/iu },
  ],
  band: [
    { value: 'slim', label: '細戒台', pattern: /纖細|細戒|細緻線條/iu },
    { value: 'wide', label: '寬戒台', pattern: /寬版|寬戒/iu },
    { value: 'cross', label: '交叉戒台', pattern: /交叉|交織/iu },
    { value: 'layered', label: '多排／V 形', pattern: /雙排|三排|多排|V\s*形|波浪/iu },
  ],
  design: [
    { value: 'flower', label: '花朵', pattern: /花形|花朵|花語|花瓣|花簇/iu },
    { value: 'heart', label: '愛心', pattern: /愛心|心形|心型/iu },
    { value: 'geometric', label: '幾何線條', pattern: /幾何|方形|方框|六角/iu },
    { value: 'simple', label: '簡約經典', pattern: /簡約|經典|單鑽|單石/iu },
  ],
} as const

export function getDesignMatches(products: JewelryProduct[], answers: MatchAnswers): JewelryProduct[] {
  const selected = (answers.photoFeatures ?? []).flatMap(feature => Object.values(photoFeatureOptions).flat().filter(option => option.value === feature))
  if (!answers.uploadedImage || !selected.length) return []
  return products.filter(product => product.available && (!answers.category || answers.category === 'other' || product.category === answers.category))
    .map(product => {
      const copy = [product.name, product.description, product.specifications, ...product.featureTags].join(' ')
      const matches = selected.filter(option => option.pattern.test(copy)).length
      return { product, matches, preferenceScore: score(product, answers) }
    })
    .filter(result => result.matches > 0)
    .sort((a, b) => b.matches - a.matches || b.preferenceScore - a.preferenceScore)
    .slice(0, 5)
    .map(result => result.product)
}
