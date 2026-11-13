import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createApp } from './app.js'
import { createStore } from './store.js'

test('作品封面：兼容旧内容、校验视频选择、独立保存封面并保留媒体顺序', async context => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'zhijian-cover-'))
  const token = randomBytes(32).toString('hex')
  const store = await createStore({ DATA_DIR: directory })
  const server = createApp(store, { adminToken: token }).listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  context.after(async () => { await new Promise(resolve => server.close(resolve)); await store.close(); await rm(directory, { recursive: true, force: true }) })
  const base = 'http://127.0.0.1:' + server.address().port
  const response = await fetch(base + '/api/content')
  const original = await response.json()
  const changed = structuredClone(original)
  const item = changed.projects[0]
  assert.equal(item.coverType, undefined)
  let etag = response.headers.get('etag')
  const publish = () => fetch(base + '/api/content', { method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'If-Match': etag }, body: JSON.stringify(changed) })
  item.coverType = 'video'
  for (const invalid of [undefined, '', 'javascript:alert(1)', 'http://example.com/video.mp4']) {
    item.coverVideo = invalid
    assert.equal((await publish()).status, 400)
  }
  item.videos = ['https://example.com/first.mp4', 'https://example.com/second.mp4']
  item.coverVideo = item.videos[1]
  let saved = await publish()
  assert.equal(saved.status, 200)
  etag = saved.headers.get('etag')
  let reopened = await createStore({ DATA_DIR: directory })
  assert.deepEqual((await reopened.read()).content, changed)
  await reopened.close()
  // 排序不能更换已指定的视频封面。
  item.videos.reverse()
  saved = await publish()
  assert.equal(saved.status, 200)
  etag = saved.headers.get('etag')
  // 也可以单独上传封面视频，不必把它加入正文视频。
  item.coverVideo = 'https://example.com/cover-only.mp4'
  saved = await publish()
  assert.equal(saved.status, 200)
  etag = saved.headers.get('etag')
  item.coverType = 'image'
  item.cover = item.images[0]
  assert.equal((await publish()).status, 200)
  reopened = await createStore({ DATA_DIR: directory })
  const content = (await reopened.read()).content
  await reopened.close()
  assert.deepEqual(content.projects[0], item)
  assert.deepEqual(content.projects.slice(1), original.projects.slice(1))
  assert.deepEqual(content.research, original.research)
  assert.deepEqual(content.studio, original.studio)
})
