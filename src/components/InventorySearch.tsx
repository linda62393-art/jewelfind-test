import { useEffect, useRef, useState, type FormEvent } from 'react'
import { rpc, time } from '../services/phase6'

interface Item { sku: string; model: string; product_name: string; consignment_store: string; source_status: string; stock: number | null }
interface Result { items: Item[]; total: number; imported_at: string | null; source_file: string | null }
const input = 'mt-2 min-h-12 w-full rounded-xl border border-champagne-300 bg-white p-3'

export function InventorySearch({ initialSearch = '' }: { initialSearch?: string }) {
  const [text, setText] = useState(initialSearch)
  const [query, setQuery] = useState({ search: initialSearch, page: 0, revision: 0 })
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const generation = useRef(0)
  useEffect(() => {
    const current = ++generation.current
    let active = true
    setLoading(true); setError(''); setResult(null)
    void rpc<Result>(true, 'admin_inventory_search', { p_search: query.search, p_page: query.page })
      .then(data => { if (active && current === generation.current) setResult(data) })
      .catch(e => { if (active && current === generation.current) setError((e as Error).message) })
      .finally(() => { if (active && current === generation.current) setLoading(false) })
    return () => { active = false }
  }, [query])
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setQuery(q => ({ search: text.trim(), page: 0, revision: q.revision + 1 }))
  }
  const pages = Math.max(1, Math.ceil((result?.total || 0) / 6))
  return <section className="rounded-2xl border border-champagne-300 bg-white p-5 sm:p-7" aria-label="商品所在店家查詢">
    <h2 className="font-serif text-2xl">商品查詢</h2>
    <p className="mt-2 text-sm leading-7 text-ink/60">輸入 SKU 或型號，直接查寄售店家，不需要建立看貨需求。</p>
    <form onSubmit={search} className="mt-4 flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1 text-sm">SKU／商品型號<input value={text} onChange={e => setText(e.target.value)} maxLength={100} placeholder="例如：PD837、PD-837 或 DR00017-PD837" className={input} /></label>
      <button disabled={loading} className="min-h-12 rounded-xl bg-champagne-700 px-5 py-3 text-white disabled:opacity-50">{loading ? '查詢中…' : '查詢商品'}</button>
      <button type="button" disabled={loading} onClick={() => { setText(''); setQuery(q => ({ search: '', page: 0, revision: q.revision + 1 })) }} className="min-h-12 px-3 text-sm text-champagne-700 disabled:opacity-50">查看全部</button>
    </form>
    {error && <p role="alert" className="mt-4 text-red-700">{error}</p>}
    {loading && <p role="status" className="mt-4 text-sm text-ink/60">讀取商品資料中…</p>}
    {result && <>
      <p role="status" className="my-4 text-sm text-ink/60">共 {result.total} 筆商品（每頁六筆）</p>
      {!result.total && <p className="rounded-xl bg-ivory p-4 text-sm">查無商品，請確認 SKU 或型號；也可輸入部分型號再查詢。</p>}
      <div className="grid gap-3 sm:grid-cols-2">{result.items.map(item => <article key={item.sku} className="rounded-xl border border-champagne-300 bg-ivory p-4">
        <h3 className="whitespace-pre-line font-medium">{item.product_name || '未填商品名稱'}</h3>
        <dl className="mt-3 space-y-2 text-sm">
          <div><dt className="text-ink/60">SKU</dt><dd className="break-all font-medium">{item.sku}</dd></div>
          <div><dt className="text-ink/60">完整型號</dt><dd className="break-all">{item.model}</dd></div>
          <div><dt className="text-ink/60">寄售店家（總表登記）</dt><dd className="whitespace-pre-line text-lg font-medium text-champagne-700">{item.consignment_store || '尚未登記店家'}</dd></div>
          <div><dt className="text-ink/60">商品狀態／庫存</dt><dd>{item.source_status || '尚未登記狀態'}／{item.stock === null ? '未填庫存' : item.stock}</dd></div>
        </dl>
        <button type="button" className="mt-3 min-h-11 text-sm text-champagne-700" onClick={() => { setText(item.model); setQuery(q => ({ search: item.model, page: 0, revision: q.revision + 1 })) }}>查相同型號</button>
      </article>)}</div>
      {result.total > 6 && <nav aria-label="商品查詢分頁" className="mt-5 flex items-center justify-between gap-3 text-sm">
        <button disabled={loading || query.page === 0} onClick={() => setQuery(q => ({ ...q, page: q.page - 1 }))} className="min-h-11 px-3 text-champagne-700 disabled:opacity-40">上一頁</button>
        <span>{query.page + 1}／{pages}</span>
        <button disabled={loading || query.page + 1 >= pages} onClick={() => setQuery(q => ({ ...q, page: q.page + 1 }))} className="min-h-11 px-3 text-champagne-700 disabled:opacity-40">下一頁</button>
      </nav>}
      <p className="mt-5 text-xs leading-6 text-ink/60">資料來源：{result.source_file || '尚未匯入商品總表'}{result.imported_at && <> · 匯入時間：{time(result.imported_at)}</>}<br />店家與狀態依總表登記顯示；調貨、轉店或售出後，需更新總表再匯入。</p>
    </>}
  </section>
}
