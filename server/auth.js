import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
const equal = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y) }
export function adminAuth(token, secure) {
  const sign = value => createHmac('sha256', token).update(value).digest('hex')
  const cookieOptions = { httpOnly: true, secure, sameSite: 'strict', path: '/api', maxAge: 8 * 3600 * 1000 }
  const authenticated = req => {
    if (!token) return false
    if (req.headers.authorization?.startsWith('Bearer ') && equal(req.headers.authorization.slice(7), token)) return true
    const cookie = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('portfolio_session='))?.slice(18) || ''
    const [expires, nonce, signature] = cookie.split('.')
    return !!signature && Number(expires) > Date.now() && equal(signature, sign(expires + '.' + nonce))
  }
  return {
    authenticated,
    guard(req, res, next) {
      if (!authenticated(req)) return res.status(401).json({ error: '请先登录管理后台' })
      if (!req.headers.authorization && req.headers['x-admin-request'] !== '1') return res.status(403).json({ error: '请求来源校验失败' })
      next()
    },
    install(app) {
      const attempts = new Map()
      app.post('/api/admin/login', (req, res) => {
        const now = Date.now(), key = req.ip
        for (const [ip, entry] of attempts) if (entry.until < now) attempts.delete(ip)
        const entry = attempts.get(key) || { count: 0, until: now + 15 * 60000 }
        if (entry.count >= 30) return res.status(429).json({ error: '尝试过于频繁，请 15 分钟后重试' })
        if (!token || typeof req.body.token !== 'string' || !equal(req.body.token, token)) { entry.count++; attempts.set(key, entry); return res.status(401).json({ error: '管理口令不正确' }) }
        attempts.delete(key)
        const value = (now + cookieOptions.maxAge) + '.' + randomBytes(16).toString('hex')
        res.cookie('portfolio_session', value + '.' + sign(value), cookieOptions).set('Cache-Control', 'no-store').json({ ok: true })
      })
      app.get('/api/admin/session', (req, res) => res.set('Cache-Control', 'no-store').status(authenticated(req) ? 200 : 401).json({ authenticated: authenticated(req) }))
      app.post('/api/admin/logout', (req, res) => res.clearCookie('portfolio_session', cookieOptions).json({ ok: true }))
    },
  }
}
