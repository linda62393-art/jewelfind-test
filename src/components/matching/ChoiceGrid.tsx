import type { Choice } from '../../types/matching'

interface ChoiceGridProps {
  choices: Choice[]
  value?: string
  onChange: (value: string) => void
}

export function ChoiceGrid({ choices, value, onChange }: ChoiceGridProps) {
  return <div className="grid grid-cols-2 gap-3">
    {choices.map((choice) => {
      const selected = value === choice.value
      return <button key={choice.value} type="button" onClick={() => onChange(choice.value)} className={`min-h-20 rounded-2xl border px-4 text-left text-base transition ${selected ? 'border-champagne-500 bg-champagne-100 text-champagne-700 shadow-sm' : 'border-champagne-100 bg-white/70 text-ink hover:border-champagne-300'}`}>
        {choice.label}
      </button>
    })}
  </div>
}
