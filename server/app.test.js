import test from 'node:test'
import { randomBytes } from 'node:crypto'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createApp } from './app.js'
import { createStore } from './store.js'
import { demoContent } from '../src/data/content.js'
const token = randomBytes(32).toString('hex')
test('内容 API：读取、鉴权、校验、并发冲突、持久化与不重置内容', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'zhijian-api-'))
  const store = await createStore({ DATA_DIR: dir })
  const server = createApp(store, { adminToken: token }).listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  const base = 'http://127.0.0.1:' + server.address().port
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await store.close(); await rm(dir, { recursive: true, force: true }) })
  const health = await fetch(base + '/healthz'); assert.equal(health.status, 200)
  const res = await fetch(base + '/api/content'); assert.equal(res.status, 200); assert.equal(res.headers.get('etag'), '"1"')
  assert.equal((await res.json()).studio.name, '纸间营造')
  const put = (body, headers = {}) => fetch(base + '/api/content', { method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })
  assert.equal((await put(demoContent)).status, 401)
  assert.equal((await put(demoContent, { Authorization: 'Bearer ' + token })).status, 428)
  for (const value of ['*', 'W/1', '"1", "2"']) assert.equal((await put(demoContent, { Authorization: 'Bearer ' + token, 'If-Match': value })).status, 428)
  const auth = { Authorization: 'Bearer ' + token, 'If-Match': '"1"' }
  assert.equal((await put({ ...demoContent, projects: [{ ...demoContent.projects[0], cover: 'javascript:alert(1)' }] }, auth)).status, 400)
  assert.equal((await put({ ...demoContent, projects: [demoContent.projects[0], demoContent.projects[0]] }, auth)).status, 400)
  const changed = structuredClone(demoContent); changed.studio.intro = '持久化验证'
  const writes = await Promise.all([put(changed, auth), put(changed, { ...auth, 'If-Match': 'W/"1"' })])
  assert.deepEqual(writes.map(r => r.status).sort(), [200, 409])
  assert.equal((await put(changed, { ...auth, 'If-Match': 'W/"1"' })).status, 409)
  const weakWrite = await put(changed, { ...auth, 'If-Match': 'W/"2"' })
  assert.equal(weakWrite.status, 200); assert.equal(weakWrite.headers.get('etag'), '"3"')
  const reopened = await createStore({ DATA_DIR: dir }); const saved = await reopened.read(); assert.equal(saved.revision, 3); assert.equal(saved.content.studio.intro, '持久化验证'); await reopened.close()
  assert.equal((await fetch(base + '/missing')).status, 404)
})
test('生产环境禁止使用容器本地文件持久化', async () => { await assert.rejects(() => createStore({ NODE_ENV: 'production' }), /MySQL/) })
test('后台会话、CSRF 校验、图片鉴权与跨重启持久化', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'zhijian-admin-'))
  const store = await createStore({ DATA_DIR: dir })
  const server = createApp(store, { adminToken: token, secureCookies: false }).listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  const base = 'http://127.0.0.1:' + server.address().port
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await store.close(); await rm(dir, { recursive: true, force: true }) })
  assert.equal((await fetch(base + '/admin/')).status, 200)
  const login = value => fetch(base + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: value }) })
  assert.equal((await login('wrong')).status, 401)
  const response = await login(token)
  assert.equal(response.status, 200)
  const cookie = response.headers.get('set-cookie').split(';')[0]
  assert.match(response.headers.get('set-cookie'), /HttpOnly/)
  assert.match(response.headers.get('set-cookie'), /SameSite=Strict/)
  assert.equal((await fetch(base + '/api/admin/session', { headers: { Cookie: cookie } })).status, 200)
  assert.equal((await fetch(base + '/api/admin/session', { headers: { Cookie: cookie + 'tampered' } })).status, 401)
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64')
  const upload = (data, headers = {}) => fetch(base + '/api/media', { method: 'POST', headers: { 'Content-Type': 'image/png', ...headers }, body: data })
  assert.equal((await upload(png)).status, 401)
  assert.equal((await upload(png, { Cookie: cookie })).status, 403)
  const auth = { Cookie: cookie, 'X-Admin-Request': '1' }
  assert.equal((await upload(Buffer.from('<script>bad</script>'), auth)).status, 400)
  const uploaded = await upload(png, auth); assert.equal(uploaded.status, 201)
  const { url } = await uploaded.json()
  const image = await fetch(base + url); assert.equal(image.headers.get('content-type'), 'image/png'); assert.deepEqual(Buffer.from(await image.arrayBuffer()), png)
  const changed = structuredClone(demoContent); changed.projects[0].images = [url]; changed.research[0].description = '研究详情保存验证'
  const saved = await fetch(base + '/api/content', { method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json', 'If-Match': '"1"' }, body: JSON.stringify(changed) }); assert.equal(saved.status, 200)
  const reopened = await createStore({ DATA_DIR: dir }); assert.deepEqual((await reopened.readMedia(url.split('/').pop())).data, png); assert.equal((await reopened.read()).content.research[0].description, changed.research[0].description); await reopened.close()
  assert.equal((await fetch(base + '/api/media/invalid')).status, 404)
})
