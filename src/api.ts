export type Product = {
  id: string
  seller_id: string
  title: string
  description: string
  image_key: string
  currency: string
  starting_price: number
  current_price: number
  highest_bidder_id: string | null
  auction_end_at: string
  status: string
  created_at: string
}

export type Bid = { id: string; bidder_id: string; amount: number; created_at: string }

const base = import.meta.env.VITE_AUCTION_API_URL ?? ''

export function token() {
  return document.cookie.split('; ').find(value => value.startsWith('auction_token='))?.split('=')[1] || ''
}

export function clearToken() {
  document.cookie = 'auction_token=; Max-Age=0; Path=/'
}

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const sessionToken = token()
  const response = await fetch(base + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}), ...options.headers }
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(body?.error?.message || 'Request failed')
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}

export const api = {
  products: () => req<Product[]>('/api/products'),
  mine: () => req<Product[]>('/api/me/products'),
  create: (value: object) => req<Product>('/api/products', { method: 'POST', body: JSON.stringify(value) }),
  cancel: (id: string) => req<void>(`/api/products/${id}`, { method: 'DELETE' }),
  bid: (id: string, amount: number) => req(`/api/products/${id}/bids`, { method: 'POST', body: JSON.stringify({ amount }) }),
  bids: (id: string) => req<Bid[]>(`/api/products/${id}/bids`),
  sell: (id: string) => req(`/api/products/${id}/sell`, { method: 'POST' }),
  presign: (filename: string, content_type: string) => req<{ upload_url: string; image_key: string; image_url: string }>('/api/uploads/presigned-url', { method: 'POST', body: JSON.stringify({ filename, content_type }) }),
  logout: () => req<void>('/api/auth/logout', { method: 'POST' })
}

export function identity() {
  try {
    return JSON.parse(atob(token().split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { sub: string; email: string }
  } catch {
    return null
  }
}
