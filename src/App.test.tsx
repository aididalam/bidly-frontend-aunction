import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'

const session = 'header.eyJzdWIiOiJ1c2VyLTEiLCJlbWFpbCI6ImFtaW5hQGV4YW1wbGUuY29tIn0.signature'
const product = { id: '1', seller_id: 'seller', title: 'Walnut Lamp', description: 'Warm light', image_key: '', starting_price: 100, current_price: 125, highest_bidder_id: null, auction_end_at: new Date(Date.now() + 86400000).toISOString(), status: 'ACTIVE', created_at: new Date().toISOString() }

beforeEach(() => {
  document.cookie = 'auction_token=; Max-Age=0; Path=/'
  window.BIDLY_CONFIG = undefined
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([product]), { status: 200, headers: { 'Content-Type': 'application/json' } })))
})

afterEach(cleanup)

test('renders marketplace products from the API', async () => {
  render(<App />)
  expect(await screen.findByText('Walnut Lamp')).not.toBeNull()
  expect(screen.getByText(/BDT/)).not.toBeNull()
})

test('uses the runtime S3 URL for product images', async () => {
  window.BIDLY_CONFIG = { S3_PUBLIC_BASE_URL: 'https://images.example.com' }
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([{ ...product, image_key: 'products/lamp.jpg' }]), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  const { container } = render(<App />)
  await screen.findByText('Walnut Lamp')
  expect(container.querySelector('img')?.getAttribute('src')).toBe('https://images.example.com/products/lamp.jpg')
})

test('gives signed-in members profile, password, and logout controls', async () => {
  document.cookie = `auction_token=${session}; Path=/`
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: /Account/ }))
  expect(screen.getByRole('menuitem', { name: 'Profile' })).toHaveAttribute('href', 'http://localhost:5173?view=profile')
  expect(screen.getByRole('menuitem', { name: 'Change password' })).toHaveAttribute('href', 'http://localhost:5173?view=password')
  fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }))
  await waitFor(() => expect(screen.getByRole('link', { name: 'Sign in' })).not.toBeNull())
})
