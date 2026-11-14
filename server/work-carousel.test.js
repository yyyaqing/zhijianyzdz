import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { contentSchema } from './schema.js'
import { demoContent } from '../src/data/content.js'
import { workCarouselSettings } from '../src/data/work-carousel.js'
import { createApp } from './app.js'
import { createStore } from './store.js'

test('旧内容默认开启 Work 自动轮播，3 秒间隔；拒绝无效间隔及开关', () => {
  assert.deepEqual(contentSchema.parse(demoContent).workCarousel, { autoplay: true, intervalSeconds: 3 })
  assert.deepEqual(workCarouselSettings(), { autoplay: true, intervalSeconds: 3 })
  assert.deepEqual(workCarouselSettings({ autoplay: false }), { autoplay: false, intervalSeconds: 3 })
  for (const workCarousel of [{ autoplay: 'false' }, { intervalSeconds: 0 }, { intervalSeconds: 61 }, { intervalSeconds: 2.5 }, { intervalSeconds: '3' }]) {
    assert.equal(contentSchema.safeParse({ ...demoContent, workCarousel }).success, false)
  }
})

test('后台轮播设置可发布、关闭、修改间隔并跨重启保留，作品及首页媒体不变', async context => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'zhijian-carousel-'))
  const token = randomBytes(32).toString('hex')
  const store = await createStore({ DATA_DIR: directory })
  const server = createApp(store, { adminToken: token }).listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  context.after(async () => { await new Promise(resolve => server.close(resolve)); await store.close(); await rm(directory, { recursive: true, force: true }) })
  const base = 'http://127.0.0.1:' + server.address().port
  const original = await fetch(base + '/api/content'), content = await original.json()
  const media = structuredClone({ studio: content.studio, projects: content.projects, research: content.research })
  let etag = original.headers.get('etag')
  for (const settings of [{ autoplay: false, intervalSeconds: 7 }, { autoplay: true, intervalSeconds: 3 }]) {
    content.workCarousel = settings
    const saved = await fetch(base + '/api/content', { method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'If-Match': etag }, body: JSON.stringify(content) })
    assert.equal(saved.status, 200)
    etag = saved.headers.get('etag')
    const reopened = await createStore({ DATA_DIR: directory }), result = (await reopened.read()).content
    await reopened.close()
    assert.deepEqual(result.workCarousel, settings)
    assert.deepEqual({ studio: result.studio, projects: result.projects, research: result.research }, media)
  }
})
