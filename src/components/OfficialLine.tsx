import { useState } from 'react'

export const officialLineUrl = 'https://lin.ee/XK1Ap0v'

export function OfficialLine({ requestId }: { requestId?: string }) {
  const [notice, setNotice] = useState('')
  async function copyId() {
    try {
      await navigator.clipboard.writeText(requestId!)
      setNotice('需求編號已複製，加入 LINE 後請貼上傳送。')
    } catch {
      setNotice('無法自動複製，請長按下方需求編號複製。')
    }
  }
  return <aside className="my-5 rounded-2xl border border-champagne-300 bg-white p-5 text-left">
    <h2 className="font-serif text-xl">透過官方 LINE 確認看貨</h2>
    <p className="mt-3 text-sm leading-7 text-ink/65">加入 JEWELFIND｜珠寶看貨顧問，傳送需求編號或商品截圖，由專人協助確認商品、店家與時間。送出需求尚未完成預約。</p>
    {requestId && <div className="mt-3"><p className="select-all break-all text-xs leading-6 text-ink/60">需求編號：{requestId}</p><button type="button" onClick={() => void copyId()} className="min-h-11 text-sm text-champagne-700">複製需求編號</button></div>}
    <a href={officialLineUrl} target="_blank" rel="noopener noreferrer" className="mt-3 flex min-h-14 items-center justify-center rounded-xl bg-[#06C755] px-4 font-medium text-white">加入官方 LINE 確認看貨 ↗</a>
    <p className="mt-3 text-xs leading-6 text-ink/55">若涉及調貨物流費，會先說明金額與取消、退款規則，經你同意後才安排。此按鈕不會付款或自動完成預約。</p>
    {notice && <p role="status" className="mt-2 text-sm text-champagne-700">{notice}</p>}
  </aside>
}
