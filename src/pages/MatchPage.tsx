import { useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { matchQuestions, materialOptions } from '../configs/matching'
import { ChoiceGrid } from '../components/matching/ChoiceGrid'
import { MaterialPicker } from '../components/matching/MaterialPicker'
import { ProgressBar } from '../components/matching/ProgressBar'
import { useMatchAnswers } from '../hooks/useMatchAnswers'
import type { JewelryCategory, MatchQuestionId } from '../types/matching'
import { photoFeatureOptions } from '../services/matchingService'
import { analyzeJewelryPhoto } from '../services/photoAnalysisService'

const requiredQuestions: MatchQuestionId[] = ['purpose', 'product', 'budget', 'style']

export function MatchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedStep = Number(searchParams.get('step') ?? 0)
  const step = Number.isInteger(requestedStep) ? Math.max(0, Math.min(requestedStep, matchQuestions.length - 1)) : 0
  function setStep(value: number) {
    setSearchParams(current => {
      const next = new URLSearchParams(current)
      next.set('step', String(value))
      return next
    }, { replace: true })
  }
  const { answers, updateAnswers } = useMatchAnswers()
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [photoMessage, setPhotoMessage] = useState('')
  const analysisRequest = useRef(0)
  const question = matchQuestions[step]
  const isLastStep = step === matchQuestions.length - 1

  function isAnswered(id: MatchQuestionId) {
    if (id === 'purpose') return Boolean(answers.purpose)
    if (id === 'product') return Boolean(answers.category)
    if (id === 'budget') return Boolean(answers.budget)
    if (id === 'style') return Boolean(answers.style)
    return true
  }

  function selectChoice(id: MatchQuestionId, value: string) {
    if (id === 'purpose') updateAnswers({ purpose: value })
    if (id === 'product') updateAnswers({ category: value as JewelryCategory })
    if (id === 'budget') updateAnswers({ budget: value })
    if (id === 'style') updateAnswers({ style: value })
  }

  function next() {
    if (isLastStep) { navigate('/recommendations'); return }
    setStep(step + 1)
  }

  async function chooseImage(file?: File) {
    if (!file) return
    const request = ++analysisRequest.current
    if (answers.uploadedImagePreview) URL.revokeObjectURL(answers.uploadedImagePreview)
    updateAnswers({ uploadedImage: file, uploadedImagePreview: URL.createObjectURL(file), photoFeatures: [], photoAnalysis: undefined })
    setAnalyzing(true)
    setPhotoMessage('正在辨識照片中的設計…')
    try {
      const features = await analyzeJewelryPhoto(file, answers.category)
      if (request !== analysisRequest.current) return
      updateAnswers({ photoFeatures: features, photoAnalysis: 'complete' })
      setPhotoMessage(features.length ? '已辨識設計特徵，可自行調整下方選項。' : '照片中沒有足夠清楚的設計特徵，仍可參考相近類別商品。')
    } catch {
      if (request !== analysisRequest.current) return
      updateAnswers({ photoAnalysis: 'failed' })
      setPhotoMessage('暫時無法自動辨識；可選擇下方特徵，或直接看參考款式。')
    } finally {
      if (request === analysisRequest.current) setAnalyzing(false)
    }
  }

  function findDirectly() {
    ++analysisRequest.current
    if (answers.uploadedImagePreview) URL.revokeObjectURL(answers.uploadedImagePreview)
    updateAnswers({ uploadedImage: undefined, uploadedImagePreview: undefined, photoFeatures: [], photoAnalysis: undefined })
    navigate('/recommendations')
  }

  const canContinue = !requiredQuestions.includes(question.id) || isAnswered(question.id)

  return <section className="flex min-h-dvh flex-col px-6 pb-7 pt-7">
    <header>
      <div className="mb-7 flex items-center justify-between">
        <button type="button" onClick={() => step === 0 ? navigate('/') : setStep(step - 1)} className="-ml-2 min-h-11 px-2 text-sm text-ink/60">← 返回</button>
        <p className="font-serif tracking-[0.14em] text-champagne-700">蘊選</p>
      </div>
      <ProgressBar current={step + 1} total={matchQuestions.length} />
    </header>

    <div className="flex flex-1 flex-col pt-10">
      <p className="text-sm tracking-[0.18em] text-rose-400">{question.eyebrow}</p>
      <h1 className="mt-3 font-serif text-3xl leading-snug text-ink">{question.title}</h1>
      {question.hint && <p className="mt-3 text-sm leading-6 text-ink/50">{question.hint}</p>}

      <div className="mt-8">
        {question.choices && <ChoiceGrid choices={question.choices} value={question.id === 'purpose' ? answers.purpose : question.id === 'product' ? answers.category : question.id === 'budget' ? answers.budget : answers.style} onChange={(value) => selectChoice(question.id, value)} />}
        {question.id === 'product' && <MaterialPicker choices={materialOptions} values={answers.materials} onChange={(materials) => updateAnswers({ materials })} />}
        {question.id === 'image' && <div>
          <input ref={fileInput} className="hidden" type="file" accept="image/*" onChange={(event) => chooseImage(event.target.files?.[0])} />
          {answers.uploadedImagePreview ? <><div className="overflow-hidden rounded-3xl border border-champagne-100 bg-white"><img className="aspect-video w-full object-cover" src={answers.uploadedImagePreview} alt="已選擇的參考珠寶" /><button type="button" onClick={() => fileInput.current?.click()} className="min-h-12 w-full text-sm text-champagne-700">換一張照片</button></div><p role="status" className="mt-4 text-sm leading-6 text-ink/60">{photoMessage || '可以調整設計特徵，幫你找相近款式。'}</p>{(answers.category === 'ring' || answers.category === 'mens-ring' || answers.category === 'couple-ring' ? [['主石鑲法', photoFeatureOptions.stone], ['戒台形狀', photoFeatureOptions.band], ['設計', photoFeatureOptions.design]] as const : [['設計', photoFeatureOptions.design]] as const).map(([title, options]) => <fieldset key={title} className="mt-4"><legend className="text-sm font-medium">{title}（可複選）</legend><div className="mt-2 flex flex-wrap gap-2">{options.map(option => { const checked = answers.photoFeatures?.includes(option.value) ?? false; return <button type="button" key={option.value} aria-pressed={checked} onClick={() => updateAnswers({ photoFeatures: checked ? answers.photoFeatures?.filter(value => value !== option.value) : [...(answers.photoFeatures ?? []), option.value] })} className={`min-h-11 rounded-xl border px-3 text-sm ${checked ? 'border-champagne-700 bg-champagne-100 text-champagne-700' : 'border-champagne-300 bg-white text-ink/70'}`}>{option.label}</button> })}</div></fieldset>)}</> : <button type="button" onClick={() => fileInput.current?.click()} className="flex aspect-video w-full flex-col items-center justify-center rounded-3xl border border-dashed border-champagne-300 bg-white/60 text-champagne-700"><span className="text-2xl">＋</span><span className="mt-2 text-sm">上傳喜歡的珠寶照片</span><span className="mt-1 text-xs text-ink/40">JPG、PNG 皆可</span></button>}
          <button type="button" onClick={findDirectly} className="mt-4 flex min-h-24 w-full items-center justify-between gap-4 rounded-3xl border border-champagne-300 bg-white px-5 py-5 text-left text-champagne-700 transition hover:bg-champagne-100">
            <span><span className="block font-medium">直接找尋</span><span className="mt-1 block text-xs leading-5 text-ink/50">不上傳照片，依照前面的偏好為我推薦</span></span>
            <span aria-hidden="true" className="text-xl">→</span>
          </button>
        </div>}
      </div>
    </div>

    <button type="button" disabled={!canContinue || analyzing} onClick={next} className="mt-6 min-h-14 w-full rounded-2xl bg-champagne-700 px-5 font-medium text-white shadow-jewel transition enabled:hover:bg-champagne-500 disabled:cursor-not-allowed disabled:bg-champagne-300">
      {analyzing ? '正在辨識照片…' : isLastStep ? '為我精選珠寶' : '繼續'}
    </button>
  </section>
}
