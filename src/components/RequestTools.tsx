import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { rpc } from '../services/phase6'

interface Meta { display_label: string; is_test: boolean; archived: boolean; version: number }
export function RequestTools({ requestId, onChange }: { requestId: string; onChange: () => void }) {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => { try { setMeta(await rpc<Meta>(true, 'admin_request_meta', { p_id: requestId })); setError('') } catch (e) { setError((e as Error).message) } }, [requestId])
  useEffect(() => { void load() }, [load])
  async function save(isTest: boolean, label: string, archived: boolean) {
    if (!meta || busy) return; setBusy(true); setError(''); setNotice('')
    try { await rpc(true, 'admin_save_request_meta', { p_id: requestId, p_version: meta.version, p_is_test: isTest, p_label: label.trim(), p_archived: archived }); setNotice(archived ? '需求已刪除，可在「查看已刪除需求」復原。' : '需求標記已儲存。'); await load(); onChange() } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  async function archive() {
    if (!meta || busy) return; setBusy(true); setError('')
    try { await rpc(true, 'admin_archive_request', { p_id: requestId, p_version: meta.version, p_archived: !meta.archived }); setNotice(meta.archived ? '需求已復原。' : '需求已移到已刪除清單，可復原。'); await load(); onChange() } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  async function edit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); await save(form.get('is_test') === 'on', String(form.get('display_label') || ''), false) }
  return <details className="rounded-xl border border-champagne-300 p-4"><summary className="min-h-11 cursor-pointer text-champagne-700">整理／刪除這筆需求</summary>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}{notice && <p role="status" className="text-sm">{notice}</p>}{meta && <><form key={meta.version} onSubmit={edit} className="space-y-3 text-sm"><label className="flex min-h-11 items-center gap-2"><input name="is_test" type="checkbox" defaultChecked={meta.is_test} disabled={meta.archived} />這是一筆測試需求</label><label className="block">管理清單顯示名稱（選填）<input name="display_label" defaultValue={meta.display_label} maxLength={100} className="mt-2 min-h-12 w-full rounded-xl border border-champagne-300 p-3" /></label><p className="text-xs leading-6 text-ink/60">可編輯管理清單名稱與測試標記；客戶原始資料保留。已刪除需求請先復原，再改名稱。正式與測試需求都可刪除後復原；看貨安排不會因此取消。</p><button disabled={busy || meta.archived} className="min-h-12 rounded-xl bg-champagne-700 px-4 text-white">儲存名稱與標記</button></form>{<button disabled={busy} onClick={() => void archive()} className="mt-3 min-h-12 rounded-xl border border-red-200 px-4 text-sm text-red-700">{meta.archived ? '復原需求' : '刪除需求'}</button>}</>}</details>
}
