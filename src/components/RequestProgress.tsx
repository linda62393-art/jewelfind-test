const time = (value: string) => new Date(value).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
import { progressEvents, type ProgressEvent } from '../services/requestOrganizer'

export function RequestProgress({ createdAt, events, onShowHistory }: { createdAt: string; events: ProgressEvent[]; onShowHistory?: () => void }) {
  const entries = progressEvents(createdAt, events)
  const render = (event: ProgressEvent) => <li key={event.id} className="relative ml-2 border-l border-champagne-300 pb-4 pl-5 last:pb-0"><span className="absolute -left-1 top-1 h-2 w-2 rounded-full bg-champagne-700" /><p className="text-xs text-ink/60"><time dateTime={event.occurred_at}>{time(event.occurred_at)}</time></p><p className="mt-1 text-sm leading-6">{event.message}</p></li>
  return <section className="mt-5 border-t border-champagne-100 pt-4"><h3 className="mb-4 font-medium">需求進度</h3><ol>{entries.slice(0, 3).map(render)}</ol>{entries.length > 3 && <details className="mt-3" onToggle={e => { if (e.currentTarget.open) onShowHistory?.() }}><summary className="min-h-11 cursor-pointer text-sm text-champagne-700">查看較早紀錄（{entries.length - 3}）</summary><ol className="mt-2">{entries.slice(3).map(render)}</ol></details>}</section>
}
