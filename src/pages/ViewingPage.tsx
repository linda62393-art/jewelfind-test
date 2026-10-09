import { consumerViewingDistricts, viewingMinutes } from '../configs/viewing'
import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { mockProducts } from '../configs/products'
import { useViewing } from '../hooks/useViewing'
import { useMatchAnswers } from '../hooks/useMatchAnswers'
import { viewingService, type MatchRequestInput } from '../services/viewingService'
import { MissingProduct } from './ProductDetailPage'
import { saveRequest, savedRequests, requestLink } from '../services/phase6'
import { ViewingLimitNotice } from '../components/ViewingLimitNotice'

export function ViewingPage() {
  const { productId } = useParams()
  const product = mockProducts.find(item => item.id === productId)
  const { drafts, setDraft, complete } = useViewing()
  const { answers } = useMatchAnswers()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  if (!product) return <MissingProduct />
  if (!product.available) return <section className="p-6"><h1 className="font-serif text-2xl">此商品目前暫不提供看貨媒合</h1><Link to="/recommendations" className="mt-4 inline-block text-champagne-700">返回推薦</Link></section>
  const draft: MatchRequestInput = drafts[product.id] ?? { productId: product.id, customer: { name: '', phone: '', line: '', region: '' }, preferredTime: '' }
  function update(field: keyof MatchRequestInput['customer'], value: string) { setDraft({ ...draft, customer: { ...draft.customer, [field]: value } }) }
  async function submit(event: FormEvent) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget as HTMLFormElement)
    const value = (key: string) => String(fields.get(key) ?? '').trim()
    if (submitting.current) return
    submitting.current = true
    setBusy(true)
    setError('')
    try {
      const receipt = await viewingService.submit({ ...draft, viewingRegion: value('viewingRegion'), preferredTime: value('preferredTime'), customer: { name: value('name'), phone: value('phone').replace(/[\s-]/g, ''), line: value('line'), region: value('region') } }, answers)
      saveRequest(receipt)
      complete(receipt)
      navigate(`/viewing/success/${receipt.id}`, { replace: true })
    } catch (reason) { setError(reason instanceof Error ? reason.message : '暫時無法送出，請再試一次。') }
    finally { submitting.current = false; setBusy(false) }
  }
  const now = new Date()
  const localMin = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  const [date = '', clock = ''] = draft.preferredTime.split('T')
  const [hour = '', minute = ''] = clock.split(':')
  function updateTime(part: 'date' | 'hour' | 'minute', value: string) {
    const parts = { date, hour, minute, [part]: value }
    setDraft({ ...draft, preferredTime: `${parts.date}T${parts.hour}:${parts.minute}` })
  }
  return <section className="px-5 pb-10 pt-7"><Link to={`/products/${product.id}`} className="inline-block min-h-11 text-sm text-ink/60">← 返回商品詳情</Link>
    <p className="mt-5 text-xs tracking-[0.2em] text-rose-400">LET’S MEET YOUR JEWEL</p><h1 className="mt-3 font-serif text-3xl">讓喜歡，更靠近一點。</h1><p className="mt-3 text-sm leading-6 text-ink/60">留下看貨需求，為心動的珠寶安排一次相遇。</p>
    <div className="my-6 flex items-center gap-4 rounded-2xl bg-white p-3"><img src={product.images[0]} alt={product.name} className="h-20 w-20 rounded-xl object-contain" /><div><p className="font-serif text-lg">{product.name}</p><p className="mt-2 text-xs text-ink/50">雙北看貨媒合 · 店家待確認</p></div></div>
    <ViewingLimitNotice />
    <form onSubmit={submit} className="space-y-5">
      {([{ key: 'name', label: '姓名', autoComplete: 'name', placeholder: '怎麼稱呼你', required: true }, { key: 'phone', label: '手機', autoComplete: 'tel', placeholder: '09xxxxxxxx', required: true }, { key: 'line', label: 'LINE ID（選填）', autoComplete: 'off', placeholder: '你的 LINE ID', required: false }, { key: 'region', label: '所在地區', autoComplete: 'address-level1', placeholder: '例如：新北市板橋區', required: true }] as const).map(field => <label key={field.key} className="block text-sm">{field.label}{field.required && ' *'}<input name={field.key} type={field.key === 'phone' ? 'tel' : 'text'} autoComplete={field.autoComplete} required={field.required} maxLength={field.key === 'phone' ? 20 : 100} value={draft.customer[field.key]} onChange={event => update(field.key, event.target.value)} placeholder={field.placeholder} className="mt-2 min-h-14 w-full rounded-xl border border-champagne-300 bg-white px-4" /></label>)}
      <label className="block text-sm">看貨地區 *<select name="viewingRegion" required value={Object.entries(consumerViewingDistricts).some(([city, districts]) => districts.some(district => city + district === draft.viewingRegion)) ? draft.viewingRegion : ''} onChange={event => setDraft({ ...draft, viewingRegion: event.target.value })} className="mt-2 min-h-14 w-full rounded-xl border border-champagne-300 bg-white px-4"><option value="">請選擇看貨地區</option>{Object.entries(consumerViewingDistricts).map(([city, districts]) => <optgroup key={city} label={city}>{districts.map(district => <option key={city + district} value={city + district}>{city} {district}</option>)}</optgroup>)}</select><span className="mt-2 block text-xs text-ink/60">請選擇方便前往的行政區，我們會優先確認該區或鄰近地區的合作珠寶店；實際店家確認後通知。</span></label>
      <fieldset><legend className="text-sm">希望看貨時間 *</legend><div className="mt-2 grid grid-cols-2 gap-3"><label className="col-span-2 text-sm">日期<input type="date" required min={localMin} value={date} onChange={event => updateTime('date', event.target.value)} className="mt-2 min-h-14 w-full min-w-0 rounded-xl border border-champagne-300 bg-white px-4" /></label><label className="text-sm">小時<select required value={hour} onChange={event => updateTime('hour', event.target.value)} className="mt-2 min-h-14 w-full rounded-xl border border-champagne-300 bg-white px-4"><option value="">請選擇</option>{Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => <option key={h} value={h}>{h} 時</option>)}</select></label><label className="text-sm">分鐘<select required value={viewingMinutes.includes(minute as '00' | '30') ? minute : ''} onChange={event => updateTime('minute', event.target.value)} className="mt-2 min-h-14 w-full rounded-xl border border-champagne-300 bg-white px-4"><option value="">請選擇</option>{viewingMinutes.map(m => <option key={m} value={m}>{m} 分</option>)}</select></label></div><input type="hidden" name="preferredTime" value={draft.preferredTime} /></fieldset>
      <p className="text-xs leading-6 text-ink/55">送出後將保存你的聯絡資料、珠寶偏好與參考照片，用於確認商品及聯繫看貨安排。希望時間不代表已完成預約。</p>
      {error && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-red-700"><p>{error}</p>{error.includes('商品不存在') && <Link to="/recommendations" className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-champagne-700 px-4 font-medium text-champagne-700">← 返回選商品</Link>}{error.includes('3 筆') && <Link to="/my-requests" className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-champagne-700 px-4 font-medium text-champagne-700">查看我的看貨需求 →</Link>}</div>}
      <button disabled={busy} className="min-h-14 w-full rounded-2xl bg-champagne-700 text-white disabled:opacity-50">{busy ? '送出中…' : '送出看貨需求'}</button>
    </form></section>
}

export function ViewingSuccessPage() {
  const { requestId } = useParams()
  const { receipts } = useViewing()
  const receipt = [...receipts, ...savedRequests()].find(item => item.id === requestId)
  const product = mockProducts.find(item => item.id === receipt?.productId)
  if (!receipt) return <section className="px-5 py-16 text-center"><h1 className="font-serif text-2xl">目前無法顯示這筆需求摘要</h1><p className="mt-4 text-sm text-ink/60">本頁摘要已清除，不代表已送出的需求被刪除；請勿因此重複送出。</p><Link to="/recommendations" className="mt-6 inline-block text-champagne-700">返回推薦 →</Link></section>
  return <section className="px-6 py-16 text-center"><div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-rose-50 text-3xl text-rose-400">✓</div><p className="mt-7 text-xs tracking-[0.2em] text-rose-400">ONE STEP CLOSER</p><h1 className="mt-3 font-serif text-3xl">需求已送出</h1><p className="mt-4 text-sm leading-7 text-ink/60">{receipt.isNewCustomer ? '已為你建立專屬帳號' : '已加入你的最新看貨需求'}<br />我們正在確認商品與適合的看貨地點，確認後會通知你。</p><div className="my-8 rounded-3xl bg-white p-6 text-left"><p className="font-serif text-xl">{product?.name}</p><p className="mt-3 text-sm text-ink/60">希望看貨時間：{new Date(receipt.preferredTime).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })}</p><p className="mt-3 break-all text-xs text-ink/40">需求編號：{receipt.id}</p></div>{receipt.accessToken && <Link to={requestLink(receipt)} className="mb-4 block rounded-2xl border border-champagne-700 px-5 py-4 text-champagne-700">查看看貨進度與 App 通知 →</Link>}<Link to="/recommendations" className="block rounded-2xl bg-champagne-700 px-5 py-4 text-white">繼續探索推薦</Link><Link to={`/products/${receipt.productId}`} className="mt-5 inline-block text-sm text-champagne-700">返回這件商品</Link></section>
}
