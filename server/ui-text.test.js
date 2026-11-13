import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createApp } from './app.js'
import { createStore } from './store.js'
import { demoContent } from '../src/data/content.js'
import { uiTextGroups, uiTextDefaults, resolveUiText, formatText } from '../src/data/ui-text.js'

test('界面文字：旧数据补齐、全部字段发布与重启持久化，保留现有内容', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'zhijian-text-'))
  const legacy = structuredClone(demoContent)
  delete legacy.uiText
  await writeFile(path.join(dir, 'content.json'), JSON.stringify({ content: legacy, revision: 9 }))
  const store = await createStore({ DATA_DIR: dir })
  const token = randomBytes(32).toString('hex')
  const server = createApp(store, { adminToken: token }).listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await store.close(); await rm(dir, { recursive: true, force: true }) })
  const base = 'http://127.0.0.1:' + server.address().port
  const response = await fetch(base + '/api/content')
  assert.equal(response.headers.get('etag'), '"9"')
  const original = await response.json()
  assert.deepEqual(original.uiText, uiTextDefaults)
  assert.equal(original.uiText.product.heading, 'Product')
  assert.equal(original.uiText.navigation.productTab, 'product')
  assert.equal(JSON.parse(await readFile(path.join(dir, 'content.json'), 'utf8')).content.uiText, undefined)
  const changed = structuredClone(original)
  for (const group of uiTextGroups) for (const [key] of group.fields) changed.uiText[group.key][key] = `自定义 ${group.key}.${key} <&> "`
  changed.uiText.studio.contactEmpty = ''
  const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'If-Match': '"9"' }
  const put = body => fetch(base + '/api/content', { method: 'PUT', headers, body: JSON.stringify(body) })
  for (const invalid of [{ ...changed.uiText, unknown: {} }, { ...changed.uiText, navigation: { ...changed.uiText.navigation, productTab: 123 } }, { ...changed.uiText, work: { ...changed.uiText.work, heading: 'a'.repeat(501) } }]) {
    assert.equal((await put({ ...changed, uiText: invalid })).status, 400)
  }
  assert.equal((await put(changed)).status, 200)
  assert.equal((await put(original)).status, 409)
  const published = await (await fetch(base + '/api/content')).json()
  assert.deepEqual(published.uiText, changed.uiText)
  const reopened = await createStore({ DATA_DIR: dir })
  const saved = await reopened.read()
  await reopened.close()
  assert.equal(saved.revision, 10)
  assert.deepEqual(saved.content.uiText, changed.uiText)
  delete saved.content.uiText
  assert.deepEqual(saved.content, legacy)
  const module = await fetch(base + '/admin/ui-text.js')
  assert.equal(module.status, 200)
  assert.match(module.headers.get('content-type'), /javascript/)
  assert.match(await module.text(), /export const uiTextGroups/)
})

test('部分文字配置兼容默认值，空文本保留，动态说明安全插值', () => {
  const text = resolveUiText({ navigation: { productTab: '产品' }, studio: { contactEmpty: '' } })
  assert.equal(text.navigation.productTab, '产品')
  assert.equal(text.product.heading, 'Product')
  assert.equal(text.studio.contactEmpty, '')
  assert.equal(formatText(text.accessibility.jumpStep, { index: 3, title: '木材 <&> {index}' }), '跳转步骤3 木材 <&> {index}')
  assert.equal(uiTextDefaults.navigation.productTab, 'product')
})
