export const officialLineId = '@144jtspf'
export const officialLineUrl = 'https://lin.ee/XK1Ap0v'
export const lineManagerUrl = 'https://chat.line.biz/'

export function officialLineChat(message: string) {
  return `https://line.me/R/oaMessage/${encodeURIComponent(officialLineId)}/?${encodeURIComponent(message)}`
}

export function customerLineMessage(requestId: string, link?: string) {
  return ['您好，我已送出 JEWELFIND 看貨需求，請協助確認並透過此對話通知我。', `需求編號：${requestId}`, ...(link ? [`我的專屬需求連結：${link}`] : [])].join('\n')
}

export function progressLineMessage(requestId: string, product: string, message: string, link: string) {
  return ['JEWELFIND 看貨進度通知', `商品：${product}`, `需求編號：${requestId}`, '', message, '', `查看最新進度、取消或提出改約：${link}`, '這是您的專屬連結，請妥善保存；換手機也可由此開啟。'].join('\n')
}
