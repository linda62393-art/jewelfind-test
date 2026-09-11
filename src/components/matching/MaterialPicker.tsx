import type { Choice } from '../../types/matching'

interface MaterialPickerProps {
  choices: Choice[]
  values: string[]
  onChange: (values: string[]) => void
}

export function MaterialPicker({ choices, values, onChange }: MaterialPickerProps) {
  function toggle(value: string) {
    onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value])
  }

  return <div className="mt-6 border-t border-champagne-100 pt-5">
    <p className="mb-3 text-sm text-ink/55">偏好的材質 <span className="text-ink/35">（可複選）</span></p>
    <div className="flex flex-wrap gap-2">
      {choices.map((choice) => {
        const selected = values.includes(choice.value)
        return <button key={choice.value} type="button" onClick={() => toggle(choice.value)} className={`min-h-10 rounded-full border px-4 text-sm transition ${selected ? 'border-champagne-500 bg-champagne-100 text-champagne-700' : 'border-champagne-100 bg-white text-ink/70'}`}>
          {choice.label}
        </button>
      })}
    </div>
  </div>
}
