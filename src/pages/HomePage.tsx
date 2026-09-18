import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

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

      <div className="relative flex flex-1 flex-col justify-center">
        <p className="mb-4 text-sm tracking-[0.22em] text-rose-400">YOUR PRIVATE JEWELRY EDIT</p>
        <h1 className="max-w-xs font-serif text-4xl leading-[1.35] text-ink">{t('home.title')}</h1>
        <p className="mt-5 max-w-sm text-base leading-8 text-ink/65">{t('home.subtitle')}</p>

        <div className="relative mt-10 aspect-[16/10] overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#e9dac0] via-[#fbf8f1] to-[#dca69b] shadow-jewel">
          <div className="absolute left-[34%] top-[18%] h-[64%] w-[32%] rotate-[32deg] rounded-[44%] border-[11px] border-champagne-500/80 shadow-[0_18px_35px_rgba(103,73,30,0.18)]" />
          <div className="absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-lg bg-white/90 shadow-[0_0_22px_rgba(255,255,255,0.9)]" />
          <span className="absolute bottom-4 right-5 font-serif text-xs tracking-[0.28em] text-ink/45">FIND YOUR PIECE</span>
        </div>
      </div>

      <button type="button" onClick={() => navigate('/match')} className="relative min-h-14 w-full rounded-2xl bg-champagne-700 px-5 font-medium tracking-wide text-white shadow-jewel transition duration-300 hover:-translate-y-0.5 hover:bg-champagne-500 active:translate-y-0">
        {t('home.cta')}
      </button>
      <div className="relative mt-5 rounded-2xl border border-champagne-300 bg-white/70 p-4 text-sm leading-7"><h2 className="font-medium text-champagne-700">JEWELFIND 雙北試營運中</h2><p>目前提供台北、新北地區珠寶找品與合作店家看貨媒合服務。</p><p className="mt-2 text-ink/65">告訴我們你正在找什麼，我們幫你尋找適合的珠寶，並安排合適的看貨地點。</p></div>
      <div className="relative mt-4 flex justify-between text-sm text-champagne-700"><button onClick={() => navigate('/my-requests')}>我的看貨需求與通知</button><button onClick={() => navigate('/admin')}>管理員入口</button></div>
    </section>
  )
}
