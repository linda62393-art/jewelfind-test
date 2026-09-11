import { Link } from 'react-router'
import type { JewelryProduct } from '../../types/product'

interface ProductCardProps { product: JewelryProduct; saved: boolean; onToggleSave: () => void }

const formatter = new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 })

export function ProductCard({ product, saved, onToggleSave }: ProductCardProps) {
  return <article className="overflow-hidden rounded-[1.5rem] bg-white shadow-jewel">
    <Link to={`/products/${product.id}`} className="block"><img className="aspect-video w-full object-cover" src={product.images[0]} alt={product.name} /></Link>
    <div className="p-4"><div className="flex items-start justify-between gap-3"><Link to={`/products/${product.id}`} className="font-serif text-xl leading-snug">{product.name}</Link><button type="button" onClick={onToggleSave} aria-pressed={saved} aria-label={`${saved ? '取消收藏' : '收藏'} ${product.name}`} className={`min-h-10 min-w-10 rounded-full border text-lg ${saved ? 'border-rose-400 bg-rose-50 text-rose-400' : 'border-champagne-100 text-ink/45'}`}>{saved ? '♥' : '♡'}</button></div><p className="mt-2 text-sm text-ink/55">{product.specifications}</p><div className="mt-4 flex items-end justify-between gap-3"><div><p className="font-medium text-champagne-700">{formatter.format(product.price)}</p><p className="mt-1 text-xs text-ink/45">可看貨：{product.availableLocations.join('、')}</p></div><Link to={`/products/${product.id}`} className="rounded-xl bg-champagne-100 px-3 py-2 text-sm text-champagne-700">看這件</Link></div></div>
  </article>
}

