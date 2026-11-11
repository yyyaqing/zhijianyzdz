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
  const auth = { Authorization: 'Bearer ' + token, 'If-Match': '"1"' }
  assert.equal((await put({ ...demoContent, projects: [{ ...demoContent.projects[0], cover: 'javascript:alert(1)' }] }, auth)).status, 400)
  assert.equal((await put({ ...demoContent, projects: [demoContent.projects[0], demoContent.projects[0]] }, auth)).status, 400)
  const changed = structuredClone(demoContent); changed.studio.intro = '持久化验证'
  const writes = await Promise.all([put(changed, auth), put(changed, auth)])
  assert.deepEqual(writes.map(r => r.status).sort(), [200, 409])
  const reopened = await createStore({ DATA_DIR: dir }); const saved = await reopened.read(); assert.equal(saved.revision, 2); assert.equal(saved.content.studio.intro, '持久化验证'); await reopened.close()
  assert.equal((await fetch(base + '/missing')).status, 404)
})
test('生产环境禁止使用容器本地文件持久化', async () => { await assert.rejects(() => createStore({ NODE_ENV: 'production' }), /MySQL/) })
