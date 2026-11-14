import test from 'node:test'
import assert from 'node:assert/strict'
import { videoLinkKind, channelActivityFor } from '../src/data/video-links.js'
import { contentSchema } from './schema.js'
import { demoContent } from '../src/data/content.js'

test('直链、视频号分享页和其他平台分享页分流，签名视频与相似域名不误判', () => {
  for (const src of ['/api/media/7307e157-8b0d-4428-951c-e8c9222ffc5e', 'https://cdn.example.com/video.mp4?token=abc', 'https://cdn.example.com/play?id=12', 'https://v.qq.com.example.com/video.mp4']) assert.equal(videoLinkKind(src), 'direct')
  for (const src of ['https://weixin.qq.com/sph/AvCtNF5Q8I', 'https://channels.weixin.qq.com/finder-preview/pages/sph?id=AvCtNF5Q8I']) assert.equal(videoLinkKind(src), 'channels')
  assert.equal(videoLinkKind('https://www.bilibili.com/video/BV123'), 'page')
  assert.equal(videoLinkKind('https://v.douyin.com/abcd/'), 'page')
})

test('只有完整且匹配链接的视频号参数可以调用原生入口，视频排序不改变关联', () => {
  const src = 'https://weixin.qq.com/sph/AvCtNF5Q8I'
  const project = { videos: [src, 'https://example.com/v.mp4'], channelActivities: [{ url: src, finderUserName: 'sphExample', feedId: '1234567890123456789' }] }
  const expected = { finderUserName: 'sphExample', feedId: '1234567890123456789' }
  assert.deepEqual(channelActivityFor(project, src), expected)
  project.videos.reverse()
  assert.deepEqual(channelActivityFor(project, src), expected)
  assert.equal(channelActivityFor(project, project.videos[0]), null)
  project.channelActivities[0].feedId = ''
  assert.equal(channelActivityFor(project, src), null)
  assert.equal(channelActivityFor({}, src), null)
})

test('在线图片、签名视频地址和可选视频号参数通过内容校验，危险地址和不完整参数被拒绝', () => {
  const content = structuredClone(demoContent)
  const project = content.projects[0], share = 'https://weixin.qq.com/sph/AvCtNF5Q8I'
  project.cover = 'https://images.example.com/photo.jpg?size=800'
  project.videos = ['https://cdn.example.com/video.mp4?signature=abc', share]
  project.channelActivities = [{ url: share, finderUserName: 'sphExample', feedId: '1234567890123456789' }]
  assert.equal(contentSchema.safeParse(content).success, true)
  for (const invalid of ['', 'javascript:alert(1)']) {
    project.channelActivities[0].feedId = invalid
    assert.equal(contentSchema.safeParse(content).success, false)
  }
  delete project.channelActivities
  project.cover = 'javascript:alert(1)'
  assert.equal(contentSchema.safeParse(content).success, false)
})
