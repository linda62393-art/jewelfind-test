export const viewingDistricts: Record<string, string[]> = {
  "台北市": [
    "中正區",
    "大同區",
    "中山區",
    "松山區",
    "大安區",
    "萬華區",
    "信義區",
    "士林區",
    "北投區",
    "內湖區",
    "南港區",
    "文山區"
  ],
  "新北市": [
    "板橋區",
    "三重區",
    "中和區",
    "永和區",
    "新莊區",
    "新店區",
    "土城區",
    "蘆洲區",
    "樹林區",
    "汐止區",
    "鶯歌區",
    "三峽區",
    "淡水區",
    "瑞芳區",
    "五股區",
    "泰山區",
    "林口區",
    "深坑區",
    "石碇區",
    "坪林區",
    "三芝區",
    "石門區",
    "八里區",
    "平溪區",
    "雙溪區",
    "貢寮區",
    "金山區",
    "萬里區",
    "烏來區"
  ]
}

export const viewingMinutes = ['00', '30'] as const

// Temporary consumer-facing availability only. Keep the complete district list
// above for existing requests, validation and administration records.
const hiddenNewTaipeiViewingDistricts = new Set([
  '瑞芳區', '深坑區', '石碇區', '坪林區', '三芝區', '石門區', '八里區',
  '平溪區', '雙溪區', '貢寮區', '金山區', '萬里區', '烏來區',
])

export const consumerViewingDistricts: Record<string, string[]> = Object.fromEntries(
  Object.entries(viewingDistricts).map(([city, districts]) => [
    city,
    districts.filter(district => city !== '新北市' || !hiddenNewTaipeiViewingDistricts.has(district)),
  ]),
)

export const viewingHours = Array.from({ length: 15 }, (_, index) => String(index + 9).padStart(2, '0'))
