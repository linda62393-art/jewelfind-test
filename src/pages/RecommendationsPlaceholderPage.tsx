import { Link } from 'react-router'

export function RecommendationsPlaceholderPage() {
  return <section className="flex min-h-dvh flex-col items-center justify-center px-6 text-center"><p className="text-sm tracking-[0.18em] text-rose-400">MATCHING COMPLETE</p><h1 className="mt-3 font-serif text-3xl">你的偏好已記下來了</h1><p className="mt-4 leading-7 text-ink/55">推薦商品將在 Phase 3 接上。</p><Link className="mt-8 rounded-2xl bg-champagne-700 px-6 py-4 text-white" to="/match">重新填寫</Link></section>
}
