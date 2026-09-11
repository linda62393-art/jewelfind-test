import { useState } from 'react'
import { Link } from 'react-router'
import { ProductCard } from '../components/products/ProductCard'
import { mockProducts } from '../configs/products'
import { useMatchAnswers } from '../hooks/useMatchAnswers'
import { getRecommendations } from '../services/matchingService'

export function RecommendationsPage() {
  const { answers } = useMatchAnswers()
  const [batches, setBatches] = useState(() => [getRecommendations(mockProducts, answers)])
  const [saved, setSaved] = useState<string[]>([])
  const batch = batches.at(-1) ?? []
  const refreshCount = batches.length - 1
  const exhausted = refreshCount >= 2

  function refresh() { setBatches((current) => [...current, getRecommendations(mockProducts, answers, current.flatMap((items) => items.map((item) => item.id)))]) }
  return <section className="min-h-dvh px-5 pb-8 pt-7"><header className="flex items-center justify-between"><Link to="/match" className="min-h-11 py-2 text-sm text-ink/60">← 修改偏好</Link><p className="font-serif tracking-[0.14em] text-champagne-700">蘊選</p></header><p className="mt-7 text-sm tracking-[0.18em] text-rose-400">CURATED FOR YOU</p><h1 className="mt-2 font-serif text-3xl">這 5 件，值得先看看。</h1><p className="mt-3 text-sm leading-6 text-ink/55">依照你的選擇，我們先為你精選這一批作品。</p><div className="mt-7 space-y-5">{batch.map((product) => <ProductCard key={product.id} product={product} saved={saved.includes(product.id)} onToggleSave={() => setSaved((items) => items.includes(product.id) ? items.filter((id) => id !== product.id) : [...items, product.id])} />)}</div>{exhausted ? <div className="mt-7 rounded-3xl bg-rose-50 p-5 text-center"><p className="font-serif text-xl">還沒遇見對的那件？</p><p className="mt-2 text-sm leading-6 text-ink/55">重新選擇風格，讓我們再精準一些。</p><Link to="/match" className="mt-4 inline-block rounded-xl bg-champagne-700 px-5 py-3 text-sm text-white">重新選擇風格</Link></div> : <button type="button" onClick={refresh} className="mt-7 min-h-14 w-full rounded-2xl border border-champagne-300 bg-white text-champagne-700">換一批看看</button>}</section>
}
