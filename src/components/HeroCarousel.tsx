import { useRef, useState } from 'react'
import './HeroCarousel.css'

// User-provided photographs, displayed in full without cropping.
const heroImageSlots: { id: string; src: string | null; alt: string }[] = [
  { id: 'hero-hands-rings-01', src: 'assets/hero/hero-hands-rings-01.png', alt: '女生雙手交疊配戴鑽戒的珠寶情境照片' },
  { id: 'hero-hands-rings-02', src: 'assets/hero/hero-hands-rings-02.png', alt: '男生手戴銀色男戒的珠寶情境照片' },
  { id: 'hero-hands-rings-03', src: 'assets/hero/hero-hands-rings-03.png', alt: '女生雙手拿杯子並配戴鑽戒與手鍊的生活照片' },
]

export function HeroCarousel() {
  const track = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const goTo = (index: number) => {
    const element = track.current
    if (!element) return
    element.scrollTo({ left: index * element.clientWidth, behavior: 'auto' })
  }

  return (
    <div className="my-7" role="region" aria-roledescription="輪播" aria-label="珠寶靈感圖片">
      <div ref={track} className="hero-carousel" tabIndex={0} aria-label="左右滑動瀏覽珠寶圖片"
        onScroll={() => { const el = track.current; if (el?.clientWidth) setActive(Math.max(0, Math.min(heroImageSlots.length - 1, Math.round(el.scrollLeft / el.clientWidth)))) }}
        onKeyDown={event => {
          if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
          event.preventDefault()
          goTo(Math.max(0, Math.min(heroImageSlots.length - 1, active + (event.key === 'ArrowRight' ? 1 : -1))))
        }}>
        {heroImageSlots.map((slot, index) => (
          <div key={slot.id} id={slot.id} className="hero-carousel-slide" role="group" aria-roledescription="投影片" aria-label={`${index + 1} / ${heroImageSlots.length}`}>
            {slot.src ? <img src={`${import.meta.env.BASE_URL}${slot.src}`} alt={slot.alt} width={1500} height={1000} draggable={false} loading={index === 0 ? 'eager' : 'lazy'} className="h-full w-full object-contain p-3" /> : (
              <div className="flex h-full flex-col items-center justify-center gap-2 bg-[#fbf8f1] p-6 text-center">
                <p className="text-xs tracking-[0.18em] text-champagne-700">珠寶情境照片 {String(index + 1).padStart(2, '0')}</p>
                <p className="text-sm leading-6 text-ink/65">雙手配戴戒指</p>
                <p className="text-xs text-ink/45">圖片待補</p>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-center" aria-label="選擇圖片">
        {heroImageSlots.map((slot, index) => <button key={slot.id} type="button" aria-label={`顯示第 ${index + 1} 張珠寶圖片`} aria-current={active === index ? 'true' : undefined} aria-controls={slot.id} onClick={() => goTo(index)} className="flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-champagne-700"><span className={`h-1.5 w-1.5 rounded-full ${active === index ? 'bg-champagne-700' : 'bg-champagne-300'}`} /></button>)}
      </div>
    </div>
  )
}
