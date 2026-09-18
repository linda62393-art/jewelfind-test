// External links must include both the Pages base and the hash-router path.
export function requestUrl(origin: string, id: string, token: string) {
  const route = `/my-requests/${encodeURIComponent(id)}#key=${encodeURIComponent(token)}`
  return import.meta.env.MODE === 'pages'
    ? `${origin}${import.meta.env.BASE_URL}#${route}`
    : `${origin}${route}`
}
