import { useState } from 'react'
import { requestUrl } from '../services/deployment'
import { customerLineMessage, officialLineChat, officialLineUrl } from '../services/lineContact'


export function OfficialLine({ requestId, accessToken }: { requestId?: string; accessToken?: string }) {
  const [notice, setNotice] = useState('')
  const link = requestId && accessToken ? requestUrl(window.location.origin, requestId, accessToken) : ''
  const message = requestId ? customerLineMessage(requestId, link || undefined) : ''
  const chat = requestId ? officialLineChat(message) : officialLineUrl
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
    <p className="mt-3 text-sm leading-7 text-ink/65">{requestId ? '將需求傳到官方 LINE，方便專人核對並回覆進度。開啟對話後，請再按傳送。' : '加入 JEWELFIND｜珠寶看貨顧問，傳送需求編號或商品截圖，由專人協助確認商品、店家與時間。'}送出需求尚未完成預約。</p>
    {requestId && <div className="mt-3"><p className="select-all break-all text-xs leading-6 text-ink/60">需求編號：{requestId}</p><button type="button" onClick={() => void copyId()} className="min-h-11 text-sm text-champagne-700">複製需求編號</button></div>}
    <a href={chat} target="_blank" rel="noopener noreferrer" className="mt-3 flex min-h-14 items-center justify-center rounded-xl bg-[#06C755] px-4 font-medium text-white">{requestId ? '傳送需求到官方 LINE ↗' : '加入官方 LINE 確認看貨 ↗'}</a>
    {requestId && <details className="mt-3 text-xs leading-6 text-ink/60"><summary className="min-h-11 cursor-pointer text-champagne-700">電腦操作／保存連結與換手機查詢</summary><p>手機可帶入訊息；電腦若無法開啟，請複製內容，加入官方帳號後貼上傳送。LINE 通知由專人回覆。</p><button type="button" className="min-h-11 text-champagne-700" onClick={async () => { try { await navigator.clipboard.writeText(message); setNotice('需求訊息已複製，請貼到 JEWELFIND 官方 LINE 並傳送。') } catch { setNotice('無法自動複製，請選取下方內容複製。') } }}>複製需求訊息</button><a href={officialLineUrl} target="_blank" rel="noopener noreferrer" className="ml-4 text-champagne-700">加入官方帳號</a>{link && <><p>請把專屬連結保存在自己的 LINE 對話或書籤；換裝置後開啟，便可找回這筆需求。連結可查看及變更需求，請勿公開分享。</p><button type="button" className="min-h-11 text-champagne-700" onClick={async () => { try { await navigator.clipboard.writeText(link); setNotice('專屬需求連結已複製，請保存到自己的 LINE 或書籤。') } catch { setNotice('無法自動複製，請長按下方專屬連結保存。') } }}>複製專屬查詢連結</button><a className="ml-4 break-all text-champagne-700" href={link}>開啟專屬連結</a></>}<textarea readOnly aria-label="傳給官方 LINE 的需求內容" value={message} rows={5} className="mt-3 w-full rounded-xl border border-champagne-300 bg-white p-3" /></details>}
    <p className="mt-3 text-xs leading-6 text-ink/55">若涉及調貨物流費，會先說明金額與取消、退款規則，經你同意後才安排。此按鈕不會付款或自動完成預約。</p>
    {notice && <p role="status" className="mt-2 text-sm text-champagne-700">{notice}</p>}
  </aside>
}
