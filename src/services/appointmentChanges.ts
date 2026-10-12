import { viewingHours, viewingMinutes } from '../configs/viewing'

export function appointmentTime(date: string, hour: string, minute: string, now = Date.now()): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !viewingHours.includes(hour) || !viewingMinutes.includes(minute as '00' | '30')) throw new Error('請選擇有效日期、時段及 00 或 30 分。')
  const [year, month, day] = date.split('-').map(Number)
  const calendar = new Date(Date.UTC(year, month - 1, day))
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) throw new Error('請選擇有效日期。')
  const value = `${date}T${hour}:${minute}:00+08:00`
  if (new Date(value).getTime() <= now) throw new Error('請選擇尚未到來的看貨時間。')
  return value
}
