import type { Choice, MatchQuestion } from '../types/matching'

export const purposeOptions: Choice[] = [
  { value: 'birthday', label: '生日' },
  { value: 'proposal-wedding', label: '求婚／結婚' },
  { value: 'anniversary', label: '周年' },
  { value: 'self', label: '買給自己' },
  { value: 'sister-friend', label: '姊妹／好友' },
  { value: 'other', label: '其他' },
]

export const categoryOptions: Choice[] = [
  { value: 'ring', label: '戒指' },
  { value: 'earrings', label: '耳環' },
  { value: 'necklace', label: '項鍊' },
  { value: 'bracelet', label: '手鍊' },
  { value: 'mens-ring', label: '男戒' },
  { value: 'couple-ring', label: '對戒' },
  { value: 'other', label: '其他' },
]

// Kept as a config so merchandising can tune price bands without editing UI.
export const budgetOptions: Choice[] = [
  { value: 'under-10000', label: 'NT$ 10,000 以下' },
  { value: '10000-30000', label: 'NT$ 10,000 – 30,000' },
  { value: '30000-60000', label: 'NT$ 30,000 – 60,000' },
  { value: '60000-100000', label: 'NT$ 60,000 – 100,000' },
  { value: '100000-200000', label: 'NT$ 100,000 – 200,000' },
  { value: '200000-500000', label: 'NT$ 200,000 – 500,000' },
  { value: 'over-500000', label: 'NT$ 500,000 以上' },
]

export const styleOptions: Choice[] = [
  { value: 'sweet', label: '甜美' },
  { value: 'refined', label: '精緻' },
  { value: 'bold', label: '霸氣' },
  { value: 'neutral', label: '中性' },
  { value: 'designer', label: '設計感' },
  { value: 'minimal', label: '簡約' },
  { value: 'glamorous', label: '華麗' },
  { value: 'unsure', label: '不確定' },
]

export const materialOptions: Choice[] = [
  { value: '18k-yellow-gold', label: '18K 黃金' },
  { value: '18k-rose-gold', label: '18K 玫瑰金' },
  { value: '18k-white-gold', label: '18K 白金' },
  { value: 'platinum', label: '鉑金' },
  { value: 'silver', label: '純銀' },
  { value: 'pearl', label: '珍珠' },
  { value: 'diamond', label: '鑽石' },
  { value: 'colored-gemstone', label: '彩色寶石' },
]

export const matchQuestions: MatchQuestion[] = [
  { id: 'purpose', eyebrow: '從心意開始', title: '這份珠寶，想為誰而選？', choices: purposeOptions },
  { id: 'product', eyebrow: '選一個方向', title: '你想找哪一類珠寶？', hint: '材質可複選，也可以先不選。', choices: categoryOptions },
  { id: 'budget', eyebrow: '保留剛好的空間', title: '這次的預算範圍是？', choices: budgetOptions },
  { id: 'style', eyebrow: '你的審美線索', title: '哪個風格最接近你？', choices: styleOptions },
  { id: 'image', eyebrow: '最後一點靈感', title: '有喜歡的款式想讓我們看看嗎？', hint: '可上傳一張參考圖，或直接讓我們開始找尋。' },
]
