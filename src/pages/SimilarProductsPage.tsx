import { Link, useParams } from 'react-router'
import { ProductCard } from '../components/products/ProductCard'
import { mockProducts } from '../configs/products'
import { useViewing } from '../hooks/useViewing'
import { getSimilarProducts } from '../services/matchingService'
import { MissingProduct } from './ProductDetailPage'

export function SimilarProductsPage() {
  const { productId } = useParams()
  const reference = mockProducts.find(p => p.id === productId)
  const { saved, toggleSave } = useViewing()
  if (!reference) return <MissingProduct />
  const result = getSimilarProducts(mockProducts, reference)
  return <section className="px-5 pb-8 pt-7"><Link to={`/products/${reference.id}`} className="inline-block min-h-11 text-sm text-champagne-700">← 返回原款式</Link><h1 className="mt-5 font-serif text-3xl">幫我找相似款</h1><div className="mt-5 flex gap-4 rounded-2xl bg-white p-4"><img src={reference.images[0]} alt={reference.name} className="h-24 w-24 rounded-xl object-contain" /><div><p className="font-serif">{reference.name}</p><p className="mt-2 text-sm text-ink/60">以這件的款式作為參考</p></div></div><p className="mt-4 text-sm leading-6 text-ink/60">依商品資料的主石、戒台與設計特徵找款，以下商品目前可提出看貨需求；實際庫存與店家安排仍須確認。</p><h2 className="mt-6 font-serif text-xl">{result.matched ? '設計特徵相近的款式' : '目前沒有明確相近款，先參考同類商品'}</h2><div className="mt-4 space-y-5">{result.products.map(product => <ProductCard key={product.id} product={product} saved={saved.includes(product.id)} onToggleSave={() => toggleSave(product.id)} />)}</div>{!result.products.length && <p className="mt-4 rounded-2xl bg-white p-5 text-sm leading-6">目前沒有同類別的可看貨商品，歡迎聯繫平台協助找款。</p>}<Link to="/contact" className="mt-6 flex min-h-12 items-center justify-center rounded-xl border border-champagne-300 bg-white text-champagne-700">仍想找相同款式，聯繫平台</Link></section>
}
