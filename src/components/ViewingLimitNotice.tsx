import { Link } from 'react-router'

export function ViewingLimitNotice() {
  return <aside aria-label="商品調貨申請上限" className="my-5 rounded-2xl border border-champagne-300 bg-white/80 p-4 text-sm leading-7">
    <p className="font-medium text-champagne-700">每位客人同時最多可申請 3 件商品調貨</p>
    <p className="mt-1 text-ink/65">以節省商品調度時間並維持服務量能，請先選出最想看的款式。完成或取消現有需求後，可再新增。實際店家與同次看貨安排由平台確認。</p>
    <Link to="/my-requests" className="mt-2 inline-flex min-h-11 items-center text-champagne-700">查看我的看貨需求 →</Link>
  </aside>
}
