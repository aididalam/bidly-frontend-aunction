import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { ArrowRight, ChevronDown, Clock, Gavel, KeyRound, LogIn, LogOut, Plus, Search, Tag, UserRound, X } from 'lucide-react'
import { api, clearToken, identity, token, type Product } from './api'

declare global {
  interface Window {
    BIDLY_CONFIG?: { S3_PUBLIC_BASE_URL?: string }
  }
}

const authUrl = import.meta.env.VITE_AUTH_APP_URL ?? 'http://localhost:5173'
const imageBase = () => window.BIDLY_CONFIG?.S3_PUBLIC_BASE_URL ?? ''
function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: currency === 'JPY' ? 0 : 2 }).format(value)
  } catch {
    return `${currency} ${value.toFixed(2)}`
  }
}

function remaining(end: string) {
  const milliseconds = new Date(end).getTime() - Date.now()
  if (milliseconds <= 0) return 'Ended'
  const hours = Math.floor(milliseconds / 36e5)
  return hours > 24 ? `${Math.floor(hours / 24)} days left` : `${hours}h left`
}

export default function App() {
  const [products, setProducts] = useState<Product[]>([])
  const [view, setView] = useState<'market' | 'mine' | 'create'>('market')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Product | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [me, setMe] = useState(identity)
  const [accountOpen, setAccountOpen] = useState(false)
  const publicImageBase = imageBase()

  async function load() {
    setBusy(true)
    setError('')
    try {
      setProducts(view === 'mine' && token() ? await api.mine() : await api.products())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { void load() }, [view])

  async function logout() {
    try {
      await api.logout()
    } catch {
      // Clearing the local session still signs the member out of this browser.
    } finally {
      clearToken()
      setMe(null)
      setAccountOpen(false)
      setSelected(null)
      setView('market')
    }
  }

  const shown = useMemo(() => products.filter(product => product.title.toLowerCase().includes(query.toLowerCase())), [products, query])

  return <main>
    <header>
      <a className="brand" href="/"><i><Gavel /></i>Bidly</a>
      <nav><button className={view === 'market' ? 'active' : ''} onClick={() => setView('market')}>Discover</button>{me && <button className={view === 'mine' ? 'active' : ''} onClick={() => setView('mine')}>My listings</button>}</nav>
      {me ? <>
        <div className="account-wrap">
          <button className="account-trigger" onClick={() => setAccountOpen(open => !open)} aria-expanded={accountOpen} aria-haspopup="menu"><span className="avatar">{me.email.slice(0, 1).toUpperCase()}</span>Account<ChevronDown /></button>
          {accountOpen && <div className="account-menu" role="menu">
            <a role="menuitem" href={`${authUrl}?view=profile`}><UserRound />Profile</a>
            <a role="menuitem" href={`${authUrl}?view=password`}><KeyRound />Change password</a>
            <button role="menuitem" onClick={() => void logout()}><LogOut />Log out</button>
          </div>}
        </div>
          <button className="sell" onClick={() => setView('create')}><Plus />Sell an item</button>
      </> : <a className="login" href={authUrl}><LogIn />Sign in</a>}
    </header>
    {view === 'create' ? <Create onDone={() => setView('mine')} onClose={() => setView('market')} /> : <>
      <section className="hero"><span>LIVE MARKETPLACE</span><h1>{view === 'mine' ? 'Your collection,' : 'Objects with a story.'}<br /><em>{view === 'mine' ? 'beautifully managed.' : 'Yours to discover.'}</em></h1><p>{view === 'mine' ? 'Review interest, close auctions, and make room for what comes next.' : 'Considered pieces from independent sellers. Bid with confidence.'}</p></section>
      <section className="toolbar"><div><Search /><input aria-label="Search auctions" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search the collection" /></div><span>{shown.length} {shown.length === 1 ? 'piece' : 'pieces'}</span></section>
      {error && <div className="notice">{error}<button onClick={() => void load()}>Try again</button></div>}
      {busy ? <div className="loading">Curating the collection…</div> : <section className="grid">{shown.map(product => <article key={product.id} onClick={() => setSelected(product)}><div className="image">{product.image_key && publicImageBase ? <img src={`${publicImageBase}/${product.image_key}`} alt="" /> : <Tag />}<span>{product.status}</span></div><div className="meta"><small><Clock />{remaining(product.auction_end_at)}</small><h2>{product.title}</h2><p>{product.description}</p><div><span>Current bid<strong>{money(product.current_price, product.currency)}</strong></span><button aria-label={`View ${product.title}`}><ArrowRight /></button></div></div></article>)}{!shown.length && <div className="empty">No pieces found. A quieter shelf can be a lovely thing.</div>}</section>}
    </>}
    {selected && <Detail product={selected} mine={selected.seller_id === me?.sub} onClose={() => setSelected(null)} onChange={() => { setSelected(null); void load() }} />}
  </main>
}

function Detail({ product, mine, onClose, onChange }: { product: Product; mine: boolean; onClose: () => void; onChange: () => void }) {
  const [amount, setAmount] = useState(product.current_price + 1)
  const [message, setMessage] = useState('')
  async function act(kind: 'bid' | 'sell' | 'cancel') {
    setMessage('')
    try {
      if (kind === 'bid') await api.bid(product.id, amount)
      if (kind === 'sell') await api.sell(product.id)
      if (kind === 'cancel') await api.cancel(product.id)
      onChange()
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Unable to continue') }
  }
  return <div className="overlay" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className="detail"><button className="close" onClick={onClose}><X /></button><small>{product.status} · {remaining(product.auction_end_at)}</small><h2>{product.title}</h2><p>{product.description}</p><div className="price"><span>Current bid</span><strong>{money(product.current_price, product.currency)}</strong></div>{message && <div className="notice">{message}</div>}{mine ? <div className="actions"><button className="primary" onClick={() => void act('sell')}>Sell to highest bidder</button><button onClick={() => void act('cancel')}>Cancel listing</button></div> : token() ? <form onSubmit={event => { event.preventDefault(); void act('bid') }}><label>Your bid ({product.currency})<input aria-label="Your bid" type="number" min={product.current_price + .01} step=".01" value={amount} onChange={event => setAmount(Number(event.target.value))} /></label><button className="primary">Place bid</button></form> : <a className="primary link" href={authUrl}>Sign in to bid</a>}</section></div>
}

function Create({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sourceImage, setSourceImage] = useState<string | null>(null)
  const [croppedImage, setCroppedImage] = useState<File | null>(null)
  const [cropOpen, setCropOpen] = useState(false)

  function chooseImage(file: File | null) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setSourceImage(String(reader.result))
      setCroppedImage(null)
      setCropOpen(true)
    }
    reader.readAsDataURL(file)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const file = croppedImage
    if (!file) {
      setError('Crop your image to the required 16:9 format before publishing.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const upload = await api.presign(file.name, file.type)
      const put = await fetch(upload.upload_url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
      if (!put.ok) throw new Error('Image upload failed')
      await api.create({ title: form.get('title'), description: form.get('description'), image_key: upload.image_key, currency: form.get('currency'), starting_price: Number(form.get('price')), auction_end_at: new Date(String(form.get('end'))).toISOString() })
      onDone()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to create listing') } finally { setBusy(false) }
  }
  return <section className="create"><button className="close" onClick={onClose}><X /></button><small>SELL WITH BIDLY</small><h1>Give it a new story.</h1><p>Thoughtful details make confident bidders.</p><form onSubmit={submit}><label>Title<input name="title" maxLength={200} required placeholder="Vintage brass desk lamp" /></label><label>Description<textarea name="description" maxLength={1000} required placeholder="Share its condition, history, and character." /><small className="field-note">Up to 1,000 characters</small></label><div className="row"><label>Currency<select name="currency" required defaultValue=""><option value="" disabled>Choose currency</option><option value="USD">USD — US dollar</option><option value="EUR">EUR — Euro</option><option value="GBP">GBP — Pound sterling</option><option value="BDT">BDT — Bangladeshi taka</option><option value="INR">INR — Indian rupee</option><option value="JPY">JPY — Japanese yen</option><option value="AUD">AUD — Australian dollar</option><option value="CAD">CAD — Canadian dollar</option><option value="SGD">SGD — Singapore dollar</option><option value="AED">AED — UAE dirham</option></select></label><label>Starting price<input name="price" type="number" min="0.01" step="0.01" required /></label><label>Auction ends<input name="end" type="datetime-local" required /></label></div><label>Photograph<input name="image" type="file" accept="image/jpeg,image/png,image/webp" required onChange={event => chooseImage(event.target.files?.[0] ?? null)} /><small className="field-note">A 16:9 crop is required before upload.</small></label>{croppedImage && <div className="crop-ready">16:9 crop ready <button type="button" onClick={() => setCropOpen(true)}>Adjust crop</button></div>}{error && <div className="notice">{error}</div>}<button className="primary" disabled={busy}>{busy ? 'Creating listing…' : 'Publish auction'}</button></form>{cropOpen && sourceImage && <ImageCropper source={sourceImage} onCancel={() => setCropOpen(false)} onComplete={file => { setCroppedImage(file); setCropOpen(false) }} />}</section>
}

function ImageCropper({ source, onCancel, onComplete }: { source: string; onCancel: () => void; onComplete: (file: File) => void }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const onCropComplete = useCallback((_area: Area, pixels: Area) => setArea(pixels), [])

  async function apply() {
    if (!area) return
    setBusy(true)
    setError('')
    try {
      onComplete(await cropToSixteenByNine(source, area))
    } catch {
      setError('Unable to crop this image. Please choose another image.')
      setBusy(false)
    }
  }

  return <div className="overlay crop-overlay" role="dialog" aria-modal="true" aria-label="Crop photograph"><section className="crop-dialog"><button className="close" onClick={onCancel} aria-label="Close cropper"><X /></button><small>PREPARE PHOTOGRAPH</small><h2>Crop to 16:9</h2><p>Position the image within the frame. We’ll optimize it for the marketplace.</p><div className="crop-stage"><Cropper image={source} crop={crop} zoom={zoom} aspect={16 / 9} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} showGrid={false} /></div><label>Zoom<input aria-label="Crop zoom" className="zoom" type="range" min="1" max="3" step="0.05" value={zoom} onChange={event => setZoom(Number(event.target.value))} /></label>{error && <div className="notice">{error}</div>}<div className="crop-actions"><button type="button" onClick={onCancel}>Cancel</button><button type="button" className="primary" disabled={busy} onClick={() => void apply()}>{busy ? 'Preparing image…' : 'Use 16:9 crop'}</button></div></section></div>
}

async function cropToSixteenByNine(source: string, area: Area): Promise<File> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image()
    element.onload = () => resolve(element)
    element.onerror = reject
    element.src = source
  })
  const canvas = document.createElement('canvas')
  canvas.width = 1600
  canvas.height = 900
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is unavailable')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Unable to encode image')), 'image/jpeg', .9))
  return new File([blob], `auction-${Date.now()}.jpg`, { type: 'image/jpeg' })
}
