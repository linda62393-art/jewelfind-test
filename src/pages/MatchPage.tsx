import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { matchQuestions, materialOptions } from '../configs/matching'
import { ChoiceGrid } from '../components/matching/ChoiceGrid'
import { MaterialPicker } from '../components/matching/MaterialPicker'
import { ProgressBar } from '../components/matching/ProgressBar'
import { useMatchAnswers } from '../hooks/useMatchAnswers'
import type { JewelryCategory, MatchQuestionId } from '../types/matching'

const requiredQuestions: MatchQuestionId[] = ['purpose', 'product', 'budget', 'style']

export function MatchPage() {
  const [step, setStep] = useState(0)
  const { answers, updateAnswers } = useMatchAnswers()
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)
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
    setStep((current) => current + 1)
  }

  function chooseImage(file?: File) {
    if (!file) return
    updateAnswers({ uploadedImage: file, uploadedImagePreview: URL.createObjectURL(file) })
  }

  const canContinue = !requiredQuestions.includes(question.id) || isAnswered(question.id)

  return <section className="flex min-h-dvh flex-col px-6 pb-7 pt-7">
    <header>
      <div className="mb-7 flex items-center justify-between">
        <button type="button" onClick={() => step === 0 ? navigate('/') : setStep((current) => current - 1)} className="-ml-2 min-h-11 px-2 text-sm text-ink/60">← 返回</button>
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
          {answers.uploadedImagePreview ? <div className="overflow-hidden rounded-3xl border border-champagne-100 bg-white"><img className="aspect-video w-full object-cover" src={answers.uploadedImagePreview} alt="已選擇的參考珠寶" /><button type="button" onClick={() => fileInput.current?.click()} className="min-h-12 w-full text-sm text-champagne-700">換一張照片</button></div> : <button type="button" onClick={() => fileInput.current?.click()} className="flex aspect-video w-full flex-col items-center justify-center rounded-3xl border border-dashed border-champagne-300 bg-white/60 text-champagne-700"><span className="text-2xl">＋</span><span className="mt-2 text-sm">上傳喜歡的珠寶照片</span><span className="mt-1 text-xs text-ink/40">JPG、PNG 皆可</span></button>}
        </div>}
      </div>
    </div>

    <button type="button" disabled={!canContinue} onClick={next} className="min-h-14 w-full rounded-2xl bg-champagne-700 px-5 font-medium text-white shadow-jewel transition enabled:hover:bg-champagne-500 disabled:cursor-not-allowed disabled:bg-champagne-300">
      {isLastStep ? '為我精選珠寶' : '繼續'}
    </button>
    {isLastStep && <button type="button" onClick={next} className="mt-3 min-h-10 w-full text-sm text-ink/55">直接找尋</button>}
  </section>
}
