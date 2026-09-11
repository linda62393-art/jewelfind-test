import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

void i18n.use(initReactI18next).init({
  lng: 'zh-TW',
  fallbackLng: 'zh-TW',
  resources: {
    'zh-TW': {
      translation: {
        home: {
          title: '找到那件，剛好像你的珠寶。',
          subtitle: '告訴我們一些心意與偏好，讓私人珠寶顧問為你精選值得相遇的作品。',
          cta: '幫我找珠寶',
        },
      },
    },
  },
  interpolation: { escapeValue: false },
})

export default i18n
