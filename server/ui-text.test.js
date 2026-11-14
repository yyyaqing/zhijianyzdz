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
import { contentSchema } from './schema.js'

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
  assert.deepEqual(saved.content, { ...legacy, homeCarousel: { autoplay: true, intervalSeconds: 3 }, workCarousel: { autoplay: true, intervalSeconds: 3 } })
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

test('旧提示文字兼容读取，后台配置目录与发布结果不再包含提示字段', () => {
  const legacy = structuredClone(demoContent)
  legacy.isDemo = true
  for (const key of ['studio', 'work', 'product']) legacy.uiText[key].demo = '旧提示文字'
  const parsed = contentSchema.parse(legacy)
  for (const key of ['studio', 'work', 'product']) {
    assert.equal(parsed.uiText[key].demo, undefined)
    assert.equal(resolveUiText(legacy.uiText)[key].demo, undefined)
  }
  assert.equal(uiTextGroups.some(group => group.fields.some(([key]) => key === 'demo')), false)
  assert.deepEqual(parsed.projects, legacy.projects)
})

test('仅清理旧的预置占位内容，保留自定义地点、作品介绍与媒体', () => {
  const legacy = structuredClone(demoContent)
  legacy.projects[0].location = '素材演示'
  legacy.projects[0].description += '\n本条为 Pexels 摄影素材展示，用于预览排版，不代表工作室实际设计项目。'
  legacy.research[0].steps[2].text = '此处为视频播放器演示，正式版本替换为自己的研究过程视频。'
  const parsed = contentSchema.parse(legacy)
  assert.equal(parsed.projects[0].location, '')
  assert.equal(parsed.projects[0].description, demoContent.projects[0].description)
  assert.equal(parsed.research[0].steps[2].text, '')
  assert.deepEqual(parsed.projects[0].images, legacy.projects[0].images)
  assert.deepEqual(parsed.projects.slice(1), legacy.projects.slice(1))
})
