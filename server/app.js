import express from 'express'
import helmet from 'helmet'
import { randomUUID } from 'node:crypto'
import { adminAuth } from './auth.js'
import { fileURLToPath } from 'node:url'
import { contentSchema } from './schema.js'
export function createApp(store, { adminToken = '', allowedOrigin = '', secureCookies = process.env.NODE_ENV === 'production' } = {}) {
  const app = express()
  app.disable('x-powered-by')
  app.use(helmet({ contentSecurityPolicy: { directives: {
    imgSrc: ["'self'", 'data:', 'https:'],
    mediaSrc: ["'self'", 'https:', 'blob:'],
  } } }))
  app.use((req, res, next) => { if (allowedOrigin && req.headers.origin === allowedOrigin) { res.setHeader('Access-Control-Allow-Origin', allowedOrigin); res.setHeader('Vary', 'Origin'); res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, If-Match'); res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS'); res.setHeader('Access-Control-Expose-Headers', 'ETag') } if (req.method === 'OPTIONS') return res.sendStatus(204); next() })
  const auth = adminAuth(adminToken, secureCookies)
  app.use(express.json({ limit: '2mb' }))
  auth.install(app)
  app.get('/admin/brand.js', (req, res) => res.sendFile(fileURLToPath(new URL('../src/data/brand.js', import.meta.url))))
  app.get('/admin/video-links.js', (req, res) => res.sendFile(fileURLToPath(new URL('../src/data/video-links.js', import.meta.url))))
  app.get('/admin/home-carousel.js', (req, res) => res.sendFile(fileURLToPath(new URL('../src/data/home-carousel.js', import.meta.url))))
  app.get('/admin/work-carousel.js', (req, res) => res.sendFile(fileURLToPath(new URL('../src/data/work-carousel.js', import.meta.url))))
  app.get('/admin/ui-text.js', (req, res) => res.sendFile(fileURLToPath(new URL('../src/data/ui-text.js', import.meta.url))))
  app.use('/admin', express.static(fileURLToPath(new URL('./admin', import.meta.url)), { maxAge: 0 }))
  app.get('/', (req, res) => res.redirect('/admin/'))
  app.post('/api/media', auth.guard, express.raw({ type: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'], limit: '10mb' }), async (req, res, next) => {
    const data = req.body, type = req.headers['content-type']
    const image = type?.startsWith('image/')
    const valid = Buffer.isBuffer(data) && data.length > 12 && ((type === 'image/jpeg' && data.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) || (type === 'image/png' && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) || (type === 'image/webp' && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') || (type === 'video/mp4' && data.toString('ascii', 4, 8) === 'ftyp'))
    if (!valid || (image && data.length > 4 * 1024 * 1024)) return res.status(400).json({ error: '请上传有效的 JPG、PNG、WebP（最大 4 MB）或 MP4 视频（最大 10 MB）' })
    try { const id = randomUUID(); await store.saveMedia(id, type, data); res.status(201).json({ url: '/api/media/' + id }) } catch (error) { next(error) }
  })
  app.get('/api/media/:id', async (req, res, next) => {
    if (!/^[a-f0-9-]{36}$/.test(req.params.id)) return res.sendStatus(404)
    try {
      const media = await store.readMedia(req.params.id); if (!media) return res.sendStatus(404)
      res.set('Cross-Origin-Resource-Policy', 'cross-origin').set('Cache-Control', 'public, max-age=31536000, immutable').type(media.type)
      if (media.type === 'video/mp4') {
        const size = media.data.length
        res.set('Accept-Ranges', 'bytes')
        if (req.headers.range) {
          const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range)
          if (!match || (!match[1] && !match[2])) return res.status(416).set('Content-Range', `bytes */${size}`).end()
          let start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]))
          let end = match[1] && match[2] ? Number(match[2]) : size - 1
          if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || start > end || (!match[1] && Number(match[2]) === 0)) return res.status(416).set('Content-Range', `bytes */${size}`).end()
          end = Math.min(end, size - 1)
          return res.status(206).set('Content-Range', `bytes ${start}-${end}/${size}`).send(media.data.subarray(start, end + 1))
        }
      }
      res.send(media.data)
    } catch (error) { next(error) }
  })
  app.get('/healthz', async (req, res) => { try { await store.read(); res.json({ status: 'ok' }) } catch { res.status(503).json({ error: '内容存储不可用' }) } })
  app.use('/static/images', express.static(fileURLToPath(new URL('../src/static/images', import.meta.url)), { maxAge: '1d', dotfiles: 'deny', setHeaders: res => res.set('Cross-Origin-Resource-Policy', 'cross-origin') }))
  app.get('/api/content', async (req, res, next) => { try { const result = await store.read(); res.set('Cache-Control', 'no-cache').set('ETag', '"' + result.revision + '"').json(result.content) } catch (error) { next(error) } })
  app.put('/api/content', auth.guard, async (req, res, next) => {
    // 云托管压缩响应时会将 ETag 改为弱标记；这里比较的是内容版本号。
    const revision = /^(?:W\/)?"(\d+)"$/.exec(req.headers['if-match'] || '')
    if (!revision) return res.status(428).json({ error: '请携带上次读取的 ETag 作为 If-Match，避免覆盖其他修改' })
    const parsed = contentSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: '内容校验失败', details: parsed.error.issues })
    try {
      const written = await store.write(parsed.data, Number(revision[1]))
      if (!written) return res.status(409).json({ error: '内容已更新，请重新读取后再提交' })
      res.set('ETag', '"' + (Number(revision[1]) + 1) + '"').json({ ok: true })
    } catch (error) { next(error) }
  })
  app.use((req, res) => res.status(404).json({ error: '接口不存在' }))
  app.use((error, req, res, next) => { const status = error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : 500; if (status === 500) console.error('API error:', error.code || error.name); res.status(status).json({ error: status === 413 ? '内容超过大小限制' : status === 400 ? 'JSON 格式有误' : '服务暂不可用，请稍后再试' }) })
  return app
}
