// 分享页不能作为 <video> 的媒体源；不带扩展名的 CDN 签名地址仍交给播放器。
export function videoLinkKind(src = '') {
  const match = /^https:\/\/([^/?#]+)([^?#]*)/i.exec(src)
  if (!match) return 'direct'
  const host = match[1].toLowerCase(), path = match[2]
  if ((host === 'weixin.qq.com' && /^\/sph\//.test(path)) || host === 'channels.weixin.qq.com') return 'channels'
  const platforms = ['bilibili.com', 'b23.tv', 'douyin.com', 'iesdouyin.com', 'youku.com', 'v.qq.com', 'ixigua.com', 'xiaohongshu.com', 'xhslink.com']
  return platforms.some(domain => host === domain || host.endsWith('.' + domain)) ? 'page' : 'direct'
}

export function channelActivityFor(project, src) {
  if (videoLinkKind(src) !== 'channels') return null
  const entry = project?.channelActivities?.find(item => item.url === src)
  if (!entry || !/^sph[\w-]+$/.test(entry.finderUserName || '') || !/^[\w+=/-]{1,512}$/.test(entry.feedId || '')) return null
  return { finderUserName: entry.finderUserName, feedId: entry.feedId }
}
