import { useViewing } from '../hooks/useViewing'
import type { JewelryProduct } from '../types/product'
import { useState } from 'react'
import { Link } from 'react-router'
import { ProductCard } from '../components/products/ProductCard'
import { mockProducts } from '../configs/products'
import { useMatchAnswers } from '../hooks/useMatchAnswers'
import { getDesignMatches, getRecommendations } from '../services/matchingService'

const cachedBatches = new Map<string, JewelryProduct[][]>()

export function RecommendationsPage() {
  const { answers } = useMatchAnswers()
  const cacheKey = JSON.stringify(answers)
  const matched = getDesignMatches(mockProducts, answers)
  const [batches, setBatches] = useState(() => cachedBatches.get(cacheKey) ?? [getRecommendations(mockProducts, answers, matched.map(item => item.id))])
  const { saved, toggleSave } = useViewing()
  const batch = batches.at(-1) ?? []
  const refreshCount = batches.length - 1
  const shownIds = [...matched, ...batches.flat()].map(item => item.id)
  const hasMore = mockProducts.some(product => product.available && !shownIds.includes(product.id))

  function refresh() {
    if (!hasMore) return
    const next = [...batches, getRecommendations(mockProducts, answers, shownIds)]
    cachedBatches.set(cacheKey, next)
    setBatches(next)
  }
  return <section className="min-h-dvh px-5 pb-8 pt-7">
    <header className="flex items-center justify-between"><Link to="/match" className="min-h-11 py-2 text-sm text-ink/60">← 修改偏好</Link><p className="font-serif tracking-[0.14em] text-champagne-700">蘊選</p></header>
    <p className="mt-7 text-sm tracking-[0.18em] text-rose-400">CURATED FOR YOU</p><h1 className="mt-2 font-serif text-3xl">看看適合你的珠寶</h1>
    {answers.uploadedImage && <p className="mt-3 text-sm leading-6 text-ink/60">{matched.length ? '依你標記的主石、戒台或設計特徵，找到以下可參考的款式；照片也會隨看貨需求提供給我們。' : '目前沒有符合所選特徵的現貨款式，先看看同類別與預算接近的參考商品。照片會在送出看貨需求時提供給我們。'}</p>}
    {matched.length > 0 && refreshCount === 0 && <><h2 className="mt-6 font-serif text-xl">設計特徵相近</h2><div className="mt-4 space-y-5">{matched.map(product => <ProductCard key={product.id} product={product} saved={saved.includes(product.id)} onToggleSave={() => toggleSave(product.id)} />)}</div></>}
    <h2 className="mt-7 font-serif text-xl">{matched.length && refreshCount === 0 ? '其他參考款式' : '可以參考的款式'}</h2>
    {batch.length ? <div className="mt-4 space-y-5">{batch.map(product => <ProductCard key={product.id} product={product} saved={saved.includes(product.id)} onToggleSave={() => toggleSave(product.id)} />)}</div> : <p className="mt-4 rounded-2xl bg-rose-50 p-5 text-sm leading-6">目前沒有可安排看貨的商品，歡迎重新選擇偏好。</p>}
    {hasMore ? <button type="button" onClick={refresh} className="mt-7 min-h-14 w-full rounded-2xl border border-champagne-300 bg-white text-champagne-700">換一批參考款式</button> : <div className="mt-7 rounded-3xl bg-rose-50 p-5 text-center"><p className="font-serif text-xl">已看完目前可提供的款式</p><Link to="/match" className="mt-4 inline-block rounded-xl bg-champagne-700 px-5 py-3 text-sm text-white">重新選擇偏好</Link></div>}
  </section>
}
