import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { HeroCarousel } from '../components/HeroCarousel'

export function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <section className="relative flex min-h-dvh flex-col overflow-hidden px-6 pb-8 pt-8">
      <div className="absolute -right-16 top-10 h-56 w-56 rounded-full bg-champagne-100/60 blur-3xl" />
      <div className="absolute -left-24 bottom-16 h-48 w-48 rounded-full bg-rose-100/50 blur-3xl" />

      <header className="relative flex items-center justify-between">
        <p className="font-serif text-xl tracking-[0.16em] text-champagne-700">蘊選</p>
        <span className="rounded-full border border-champagne-300/70 bg-white/50 px-3 py-1 text-xs tracking-widest text-champagne-700">JEWELRY MATCH</span>
      </header>

      <div className="relative flex flex-1 flex-col justify-center pt-10">
        <p className="mb-3 text-sm tracking-[0.16em] text-rose-400">用幾個簡單問題</p>
        <h1 className="font-serif text-[clamp(1.75rem,7.5vw,2rem)] leading-[1.5] text-ink">{t('home.title')}</h1>
        <p className="mt-4 max-w-sm text-base leading-7 text-ink/65">{t('home.subtitle')}</p>
        <HeroCarousel />
      </div>

      <button type="button" onClick={() => navigate('/match')} className="relative min-h-14 w-full rounded-2xl bg-champagne-700 px-5 font-medium tracking-wide text-white shadow-jewel transition duration-300 hover:-translate-y-0.5 hover:bg-champagne-500 active:translate-y-0">
        {t('home.cta')}
      </button>
      <div className="relative mt-5 rounded-2xl border border-champagne-300 bg-white/70 p-4 text-sm leading-7"><h2 className="font-medium text-champagne-700">JEWELFIND 雙北試營運中</h2><p>目前提供台北、新北地區珠寶找品與合作店家看貨媒合服務。</p><p className="mt-2 text-ink/65">告訴我們你正在找什麼，我們幫你尋找適合的珠寶，並安排合適的看貨地點。</p></div>
      <div className="relative mt-4 flex justify-between text-sm text-champagne-700"><button onClick={() => navigate('/my-requests')}>我的看貨需求與通知</button><button onClick={() => navigate('/admin')}>管理員入口</button></div>
    </section>
  )
}
