import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createApp } from './app.js'
import { createStore } from './store.js'
import { brandSettings } from '../src/data/brand.js'

test('品牌样式：旧内容默认缩小 Logo，样式校验、发布、重启持久化不影响作品', async context => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'zhijian-brand-'))
  const token = randomBytes(32).toString('hex')
  const store = await createStore({ DATA_DIR: directory })
  const server = createApp(store, { adminToken: token }).listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  context.after(async () => { await new Promise(resolve => server.close(resolve)); await store.close(); await rm(directory, { recursive: true, force: true }) })
  const base = 'http://127.0.0.1:' + server.address().port
  const response = await fetch(base + '/api/content')
  const original = await response.json()
  assert.equal(original.studio.brandStyle, undefined)
  assert.equal(brandSettings(original.studio).logoScale, 50)
  const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'If-Match': response.headers.get('etag') }
  const changed = structuredClone(original)
  for (const invalid of [{ nameFont: 'url(https://example.com)' }, { nameFontSize: 0 }, { nameFontSize: 65 }, { logoScale: 0 }, { logoScale: 201 }, { logoScale: '50' }, { arbitrary: true }]) {
    changed.studio.brandStyle = invalid
    assert.equal((await fetch(base + '/api/content', { method: 'PUT', headers, body: JSON.stringify(changed) })).status, 400)
  }
  changed.studio.logo = ''
  changed.studio.brandStyle = { nameFont: 'serif', nameFontSize: 24, logoScale: 35 }
  assert.equal((await fetch(base + '/api/content', { method: 'PUT', headers, body: JSON.stringify(changed) })).status, 200)
  const reopened = await createStore({ DATA_DIR: directory })
  const saved = (await reopened.read()).content
  await reopened.close()
  assert.deepEqual(saved.studio.brandStyle, changed.studio.brandStyle)
  assert.equal(saved.studio.logo, '')
  assert.deepEqual(saved.projects, original.projects)
  assert.deepEqual(saved.research, original.research)
  const moduleResponse = await fetch(base + '/admin/brand.js')
  assert.equal(moduleResponse.status, 200)
  assert.match(moduleResponse.headers.get('content-type'), /javascript/)
  assert.match(await moduleResponse.text(), /export const brandDefaults/)
})
