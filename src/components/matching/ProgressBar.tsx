interface ProgressBarProps { current: number; total: number }

export function ProgressBar({ current, total }: ProgressBarProps) {
  return <div>
    <div className="mb-2 flex justify-between text-xs tracking-wide text-ink/45"><span>你的珠寶偏好</span><span>{current} / {total}</span></div>
    <div className="h-1 overflow-hidden rounded-full bg-champagne-100"><div className="h-full rounded-full bg-champagne-500 transition-all duration-500" style={{ width: `${(current / total) * 100}%` }} /></div>
  </div>
}
