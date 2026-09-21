import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

void i18n.use(initReactI18next).init({
  lng: 'zh-TW',
  fallbackLng: 'zh-TW',
  resources: {
    'zh-TW': {
      translation: {
        home: {
          title: '找到最適合你的珠寶',
          subtitle: '告訴我們你的需求與喜好，為你推薦適合的珠寶。',
          cta: '幫我找珠寶',
        },
      },
    },
  },
  interpolation: { escapeValue: false },
})

export default i18n
