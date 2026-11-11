import { createApp } from './app.js'
import { createStore } from './store.js'
const store = await createStore()
if (process.env.NODE_ENV === 'production' && (process.env.ADMIN_TOKEN || '').length < 32) throw new Error('生产环境 ADMIN_TOKEN 至少需要 32 个字符')
const app = createApp(store, { adminToken: process.env.ADMIN_TOKEN, allowedOrigin: process.env.ALLOWED_ORIGIN })
const server = app.listen(Number(process.env.PORT || 8080), '0.0.0.0', () => console.log('Portfolio API listening on port ' + (process.env.PORT || 8080)))
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { server.close(async () => { await store.close(); process.exit(0) }); setTimeout(() => process.exit(1), 10000).unref() })
