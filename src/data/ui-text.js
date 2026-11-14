// 后台表单、接口校验与小程序共用同一份文字目录。
export const uiTextGroups = [
  { key: 'navigation', label: '底部 Tab 与页面标题', fields: [
    ['studioTab', '第一个 Tab', 'about'], ['workTab', '第二个 Tab', 'work'], ['productTab', '第三个 Tab', 'product'],
    ['homeTitle', '首页窗口标题', ''], ['workTitle', '作品详情窗口标题', 'Work'], ['productTitle', '产品详情窗口标题', 'Product'],
    ['shareTitle', '默认分享标题', ''], ['back', '详情顶部返回按钮', 'Back'],
  ] },
  { key: 'studio', label: '工作室页面', fields: [
    ['intro', '介绍栏目标题', 'Intro'], ['services', '服务栏目标题', 'Services'], ['awards', '奖项栏目标题', 'AWARDS'], ['contact', '联系栏目标题', 'Contact'],
    ['email', '邮箱前缀', 'Email:'], ['phone', '电话前缀', 'Tel:'], ['contactEmpty', '联系方式为空时的提示', '联系方式即将更新'],
  ] },
  { key: 'work', label: '作品页面与详情', fields: [
    ['heading', '作品栏目标题', 'Typologies'], ['all', '全部分类', 'All'], ['architecture', '建筑分类', '建筑'],
    ['interior', '室内分类', '室内'], ['material', '材料分类', '材料'],
    ['empty', '作品列表为空', '作品正在整理中'], ['categoryEmpty', '分类列表为空', '这个分类的作品正在整理中'],
    ['loading', '详情加载中', '正在加载作品…'], ['unpublished', '详情未发布', '作品暂未发布'],
    ['back', '返回作品列表', '返回作品'], ['next', '下一作品按钮', 'Next project'],
  ] },
  { key: 'product', label: '产品页面与详情', fields: [
    ['heading', '产品栏目标题', 'Product'], ['empty', '产品列表为空', '产品内容正在整理中'],
    ['loading', '详情加载中', '正在加载产品…'], ['unpublished', '详情未发布', '产品暂未发布'],
    ['back', '返回产品列表', '返回产品'], ['backToList', '详情底部返回按钮', 'Back to product'],
  ] },
  { key: 'status', label: '加载、媒体与连接提示', fields: [
    ['retry', '连接重试按钮', '重试'], ['reload', '重新加载按钮', '重新加载'], ['imageFailed', '图片加载失败', '图片暂未加载'],
    ['videoFailed', '视频播放失败', '视频暂时无法播放，请检查网络或视频地址后重试'], ['replay', '重新播放按钮', '重新播放'],
    ['channelVideo', '视频号链接标题', '视频号视频'], ['externalVideo', '外部视频链接标题', '视频链接'],
    ['watchChannel', '打开视频号按钮', '前往视频号观看'], ['copyVideoLink', '复制视频链接按钮', '复制观看链接'],
    ['channelLinkHint', '视频号短链提示', '复制链接后，可发到微信聊天中打开观看'],
    ['externalLinkHint', '外部视频链接提示', '此视频需在原平台观看，可复制链接打开'],
    ['copiedVideoLink', '视频链接已复制提示', '链接已复制，可发到微信聊天中打开'],
    ['copyLinkFailed', '复制视频链接失败提示', '复制失败，请稍后重试'], ['openChannelFailed', '视频号打开失败提示', '暂时无法打开视频号，可复制链接观看'],
    ['loadFailed', '内容请求失败', '内容暂时无法加载'], ['connectionFailed', '连接失败', '无法连接工作室，请稍后重试'],
    ['cloudUnsupported', '微信版本不支持', '当前微信版本不支持云托管，请更新微信'], ['invalidContent', '内容格式异常', '内容格式有误，请联系工作室'],
  ] },
  { key: 'accessibility', label: '朗读与图片说明', fields: [
    ['navigation', '主要导航说明', '主要导航'], ['loading', '内容加载说明', '正在加载内容'], ['slides', '轮播切换说明', '首页图片切换'],
    ['viewSlide', '切换轮播图片', '查看第{index}张图片'], ['categories', '作品分类说明', '作品分类'],
    ['viewWork', '打开作品', '查看作品：{title}'], ['hasVideo', '视频标识说明', '含视频'],
    ['previousWork', '上一张作品', '上一张作品'], ['nextWork', '下一张作品', '下一张作品'],
    ['enlargeImage', '放大详情图片', '放大第{index}张图片'], ['imageAlt', '详情图片说明', '{title} 图片{index}'],
    ['steps', '产品步骤导航', '产品步骤'], ['jumpStep', '跳转步骤', '跳转步骤{index} {title}'], ['enlargeStep', '放大步骤图片', '放大：{title}'],
  ] },
]

export const uiTextDefaults = Object.fromEntries(uiTextGroups.map(group => [group.key, Object.fromEntries(group.fields.map(([key, , value]) => [key, value]))]))
export function resolveUiText(value = {}) {
  return Object.fromEntries(uiTextGroups.map(group => [group.key, Object.fromEntries(group.fields.map(([key, , fallback]) => [key, typeof value?.[group.key]?.[key] === 'string' ? value[group.key][key] : fallback]))]))
}
export function formatText(template, values = {}) {
  return template.replace(/\{(\w+)\}/g, (match, key) => values[key] === undefined ? match : String(values[key]))
}
