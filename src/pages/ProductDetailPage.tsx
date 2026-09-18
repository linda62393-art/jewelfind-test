import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { mockProducts } from '../configs/products'
import { materialOptions } from '../configs/matching'
import { useViewing } from '../hooks/useViewing'

export function MissingProduct() {
  return <section className="px-5 py-16 text-center"><h1 className="font-serif text-2xl">找不到這件商品</h1><Link className="mt-6 inline-block text-champagne-700" to="/recommendations">回到推薦商品 →</Link></section>
}
export function ProductDetailPage() {
  const { productId } = useParams()
  const product = mockProducts.find(item => item.id === productId)
  const [selected, setSelected] = useState(0)
  const { saved, toggleSave } = useViewing()
  if (!product) return <MissingProduct />
  const isSaved = saved.includes(product.id)
  const stones = product.materials.filter(value => ['diamond', 'colored-gemstone', 'pearl'].includes(value))
  const label = (value: string) => materialOptions.find(option => option.value === value)?.label ?? value
  return <section className="px-5 pb-8 pt-7">
    <Link to="/recommendations" className="inline-block min-h-11 text-sm text-ink/60">← 返回推薦</Link>
    <div className="overflow-hidden rounded-3xl bg-white"><img src={product.images[selected] ?? product.images[0]} alt={`${product.name}，商品圖片 ${selected + 1}`} className="aspect-square w-full object-contain" /></div>
    <div className="mt-3 flex gap-3" aria-label="商品圖片">{product.images.map((src, index) => <button key={src} onClick={() => setSelected(index)} aria-label={`查看第 ${index + 1} 張圖片`} aria-pressed={selected === index} className={`overflow-hidden rounded-xl border-2 bg-white ${selected === index ? 'border-champagne-700' : 'border-transparent'}`}><img src={src} alt="" className="h-20 w-20 object-contain" /></button>)}</div>
    <p className="mt-7 text-xs tracking-[0.2em] text-rose-400">A CLOSER LOOK</p>
    <h1 className="mt-2 font-serif text-3xl">{product.name}</h1>
    <p className="mt-3 text-sm leading-7 text-ink/60">{product.description}</p>
    <p className="mt-5 text-2xl text-champagne-700">NT$ {product.price.toLocaleString('zh-TW')}</p>
    <p className="mt-2 text-xs text-ink/50">展示商品資料與參考價格，實際規格及報價以確認為準。</p>
    <dl className="my-6 divide-y divide-champagne-100 rounded-2xl bg-white px-5">{[['主石', stones.length ? stones.map(label).join('、') : '無主石'], ['材質', product.materials.filter(value => !stones.includes(value)).map(label).join('、')], ['規格', product.specifications], ['試營運看貨地區', '台北市、新北市（實際店家與調貨安排待確認）']].map(([title, value]) => <div key={title} className="py-4"><dt className="text-xs text-ink/50">{title}</dt><dd className="mt-1 text-sm leading-6">{value}</dd></div>)}</dl>
    <div className="sticky bottom-0 flex gap-3 bg-ivory py-3"><button onClick={() => toggleSave(product.id)} aria-pressed={isSaved} className="min-h-14 rounded-2xl border border-champagne-300 bg-white px-5 text-champagne-700">{isSaved ? '♥ 已收藏' : '♡ 收藏'}</button><Link to={`/products/${product.id}/viewing`} className="flex min-h-14 flex-1 items-center justify-center rounded-2xl bg-champagne-700 text-white">我想看這件</Link></div>
  </section>
}
