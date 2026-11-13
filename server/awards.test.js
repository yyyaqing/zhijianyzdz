import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createApp } from './app.js'
import { createStore } from './store.js'
import { contentSchema } from './schema.js'
import { demoContent } from '../src/data/content.js'

test('奖项配置：兼容旧内容、限制图片数量与地址，标题有默认值', () => {
  const old = structuredClone(demoContent)
  delete old.studio.awards
  delete old.uiText.studio.awards
  const parsed = contentSchema.parse(old)
  assert.deepEqual(parsed.studio.awards, [])
  assert.equal(parsed.uiText.studio.awards, 'AWARDS')
  const image = { image: '/static/images/house.jpg', alt: '奖项证书' }
  old.studio.awards = Array.from({ length: 50 }, () => ({ ...image }))
  assert.equal(contentSchema.safeParse(old).success, true)
  for (const invalid of [Array(51).fill(image), [{ image: 'javascript:alert(1)' }], [{ image: 'http://example.com/award.png' }], [{ image: '/static/images/house.jpg', arbitrary: true }], [{ ...image, display: 'invalid' }], 'invalid']) {
    old.studio.awards = invalid
    assert.equal(contentSchema.safeParse(old).success, false)
  }
  old.studio.awards = [{ image: image.image }]
  assert.equal(contentSchema.parse(old).studio.awards[0].alt, '')
  assert.equal(contentSchema.parse(old).studio.awards[0].display, 'photo')
  old.studio.awards = [{ ...image, display: 'logo' }, { ...image, display: 'photo' }]
  assert.deepEqual(contentSchema.parse(old).studio.awards, old.studio.awards)
})

test('奖项配置：多图上传、保存、排序、删除与重启持久化保留原有作品', async context => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'zhijian-awards-'))
  const legacy = structuredClone(demoContent)
  delete legacy.studio.awards
  delete legacy.uiText.studio.awards
  await writeFile(path.join(directory, 'content.json'), JSON.stringify({ content: legacy, revision: 1 }))
  const token = randomBytes(32).toString('hex')
  const store = await createStore({ DATA_DIR: directory })
  const server = createApp(store, { adminToken: token }).listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  context.after(async () => { await new Promise(resolve => server.close(resolve)); await store.close(); await rm(directory, { recursive: true, force: true }) })
  const base = 'http://127.0.0.1:' + server.address().port
  const response = await fetch(base + '/api/content')
  const changed = await response.json()
  assert.deepEqual(changed.studio.awards, [])
  let etag = response.headers.get('etag')
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64')
  for (let index = 0; index < 3; index++) {
    const uploaded = await fetch(base + '/api/media', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'image/png' }, body: png })
    assert.equal(uploaded.status, 201)
    const { url } = await uploaded.json()
    changed.studio.awards.push({ image: url, alt: `奖项 ${index + 1}`, display: index === 0 ? 'logo' : 'photo' })
  }
  changed.uiText.studio.awards = 'AWARDS'
  const publish = async () => {
    const result = await fetch(base + '/api/content', { method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'If-Match': etag }, body: JSON.stringify(changed) })
    assert.equal(result.status, 200)
    etag = result.headers.get('etag')
  }
  await publish()
  const removed = changed.studio.awards[1]
  changed.studio.awards = [changed.studio.awards[2], changed.studio.awards[0]]
  await publish()
  const reopened = await createStore({ DATA_DIR: directory })
  const saved = (await reopened.read()).content
  assert.deepEqual(saved.studio.awards, changed.studio.awards)
  assert.deepEqual(saved.projects, legacy.projects)
  assert.deepEqual(saved.research, legacy.research)
  assert.deepEqual(saved.studio.slides, legacy.studio.slides)
  assert.deepEqual((await reopened.readMedia(removed.image.split('/').pop())).data, png)
  await reopened.close()
  for (const award of saved.studio.awards) assert.deepEqual(Buffer.from(await (await fetch(base + award.image)).arrayBuffer()), png)
  assert.match(await (await fetch(base + '/admin/')).text(), /data-section="awards"/)
  changed.studio.awards = []
  await publish()
  assert.deepEqual((await (await fetch(base + '/api/content')).json()).studio.awards, [])
})
