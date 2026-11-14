import { homeCarouselSettings } from './home-carousel.js'
import { workCarouselSettings } from './work-carousel.js'
import { videoLinkKind, channelActivityFor } from './video-links.js'
import { brandDefaults, brandFonts, brandSettings } from './brand.js'
import { uiTextGroups, resolveUiText } from './ui-text.js'
const $ = selector => document.querySelector(selector)
let content, etag, section = 'studio', selected = null, dirty = false, busy = false
const titles = { studio: '工作室', slides: '轮播与二维码', awards: '奖项展示', projects: '作品管理', research: '产品管理', uiText: '界面文字' }
const category = { architecture: '建筑', interior: '室内', material: '材料' }
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const uid = () => 'item_' + crypto.randomUUID().replaceAll('-', '').slice(0, 16)
const fallback = '/static/images/house.jpg'
function note(message = '') { $('#notice').hidden = !message; $('#notice').textContent = message }
function changed() { dirty = true; $('#save').disabled = busy; $('#save-state').textContent = '有未发布的修改'; $('#save-state').className = 'dirty' }
function status(message) { $('#save-state').textContent = message; $('#save-state').className = '' }
async function api(url, options = {}) {
  const response = await fetch(url, { signal: AbortSignal.timeout(options.body instanceof File ? 180000 : 30000), ...options, headers: { 'X-Admin-Request': '1', ...options.headers } })
  if (response.status === 401 && url !== '/api/admin/login') { $('#workspace').hidden = true; $('#login').hidden = false; throw Error('登录已过期，请重新输入管理口令；当前修改保留在页面中。') }
  if (!response.ok) { const data = await response.json().catch(() => ({})); const details = data.details?.slice(0, 4).map(i => `${i.path.join(' › ')}：${i.message}`).join('\n'); throw Error((data.error || '请求失败，请稍后重试') + (details ? '\n' + details : '')) }
  return response
}
function field(label, path, value, type = 'text', hint = '', limits = {}) {
  const attrs = `data-path="${esc(path)}"`
  return `<label>${esc(label)}${type === 'textarea' ? `<textarea ${attrs}>${esc(value)}</textarea>` : `<input ${attrs} type="${type}" value="${esc(value)}" ${type === 'number' ? `min="${limits.min ?? .3}" max="${limits.max ?? 3}" step="${limits.step ?? .01}"` : ''}>`}${hint ? `<p class="hint">${esc(hint)}</p>` : ''}</label>`
}
function brandEditor(studio) {
  const settings = brandSettings(studio)
  return `<div class="editor-section">${heading('名称与 Logo 样式', '文字名称与图片 Logo 分别设置，修改后可在右侧预览。')}<div class="brand-settings"><div><label>名称字体<select data-path="studio.brandStyle.nameFont">${Object.entries(brandFonts).map(([key, font]) => `<option value="${key}" ${settings.nameFont === key ? 'selected' : ''}>${font.label}</option>`).join('')}</select><p class="hint">系统字体随设备适配；上传 Logo 后，字体设置会在清空 Logo、显示文字时生效。</p></label>${field('名称字号（px）', 'studio.brandStyle.nameFontSize', settings.nameFontSize, 'number', '10–64，以 375px 手机宽度为基准，其他屏幕等比例适配。', { min: 10, max: 64, step: 1 })}${field('Logo 展示比例（%）', 'studio.brandStyle.logoScale', settings.logoScale, 'number', '10–200。50% 为原尺寸的一半；保留图片比例与透明背景。', { min: 10, max: 200, step: 1 })}</div><div><div class="brand-preview" aria-label="首页品牌预览"><div class="brand-preview-content"><img id="brand-preview-logo" alt="名称 Logo 预览"><div id="brand-preview-text"><div class="brand-preview-name"></div><div class="brand-preview-subtitle"></div></div></div></div><p class="brand-preview-note">首页效果预览 · 保存并发布后同步到小程序</p></div></div></div>`
}
function updateBrandPreview() {
  document.querySelectorAll('[data-tab-preview]').forEach(el => { el.textContent = content.uiText.navigation[el.dataset.tabPreview] })
  const preview = $('.brand-preview')
  if (!preview) return
  const studio = content.studio, settings = brandSettings(studio)
  const scale = preview.clientWidth / 375, logo = $('#brand-preview-logo'), text = $('#brand-preview-text')
  const background = studio.slides[0]?.image
  preview.style.backgroundImage = background ? `url(${JSON.stringify(background)})` : ''
  logo.hidden = !studio.logo; text.hidden = !!studio.logo
  if (studio.logo) logo.src = studio.logo
  logo.style.width = 180 * settings.logoScale / 100 * scale + 'px'
  logo.style.height = 96.5 * settings.logoScale / 100 * scale + 'px'
  const name = $('.brand-preview-name')
  name.textContent = studio.name; name.style.fontFamily = brandFonts[settings.nameFont].family; name.style.fontSize = settings.nameFontSize * scale + 'px'
  name.style.letterSpacing = 3 * scale + 'px'; name.style.paddingLeft = 3 * scale + 'px'
  const subtitle = $('.brand-preview-subtitle'); subtitle.textContent = studio.subtitle; subtitle.style.fontSize = 9 * scale + 'px'; subtitle.style.letterSpacing = 4 * scale + 'px'; subtitle.style.paddingLeft = 4 * scale + 'px'
}
function channelEditor(path, value) {
  const match = /^projects\.(\d+)\./.exec(path)
  if (!match || videoLinkKind(value) !== 'channels') return ''
  const activity = content.projects[Number(match[1])].channelActivities?.find(item => item.url === value) || {}
  return `<details class="media-links"><summary>视频号原生跳转设置（选填）</summary><p class="hint">仅填写分享短链时，小程序提供复制观看链接。补充以下两项后可直接打开视频号。视频号 ID 从视频号助手获取；feedId 为该条视频的 ID，不是分享短链后缀。</p>${['finderUserName', 'feedId'].map(key => `<label>${key === 'finderUserName' ? '视频号 ID（sph 开头）' : '视频 feedId'}<input data-channel-for="${esc(path)}" data-channel-field="${key}" value="${esc(activity[key] || '')}"></label>`).join('')}</details>`
}
function media(label, path, value, video = false) {
  const kind = video ? videoLinkKind(value) : 'direct'
  const preview = video ? (value ? (kind === 'direct' ? `<video class="media-preview video-preview" src="${esc(value)}" controls preload="metadata" playsinline aria-label="${esc(label)}预览"></video>` : `<div class="media-preview video-preview share-preview"><strong>${kind === 'channels' ? '视频号分享链接' : '视频平台分享链接'}</strong><p>请前往原平台观看</p><a href="${esc(value)}" target="_blank" rel="noopener noreferrer">打开链接 ↗</a></div>`) : '<div class="media-preview video-preview">待上传视频</div>') : (value ? `<img class="media-preview" src="${esc(value)}" alt="${esc(label)}预览">` : '<div class="media-preview video-preview">待上传图片</div>')
  return `<div class="media-field ${video ? 'is-video' : ''}">${preview}<div><p class="media-title">${esc(label)}</p><label class="media-upload">${value ? '替换' : '上传'}${video ? '视频' : '图片'}<input type="file" accept="${video ? 'video/mp4' : 'image/jpeg,image/png,image/webp'}" data-upload="${esc(path)}" data-video="${video}" aria-label="上传${esc(label)}"></label><p class="hint">${video ? '支持 MP4，最大 10 MB；HTTPS 视频直链可在左侧播放。视频号等分享页以观看链接展示。' : '支持 JPG、PNG、WebP，最大 4 MB。'}</p><details class="media-links"><summary>${video ? '粘贴在线视频地址' : '粘贴在线图片地址'}</summary>${field(video ? '视频链接' : '图片链接', path, value, 'text', video ? '可填写 HTTPS 视频直链或视频号分享链接；分享页不会在播放器内播放。' : '填写可公开访问、无需登录的 HTTPS 图片地址。')}<button type="button" data-preview-link="${esc(path)}">预览链接</button></details>${video ? channelEditor(path, value) : ''}</div></div>`
}
function projectCoverEditor(item, p) {
  const video = item.coverType === 'video'
  return `<label>封面类型<select data-path="${p}.coverType" data-render><option value="image" ${!video ? 'selected' : ''}>图片封面</option><option value="video" ${video ? 'selected' : ''}>视频封面</option></select><p class="hint">图片封面：详情顶部显示所选图片。视频封面：列表显示预览图和播放标识，详情顶部播放指定视频。</p></label>${media(video ? '视频封面预览图' : '封面图片', `${p}.cover`, item.cover)}${video ? media('封面视频', `${p}.coverVideo`, item.coverVideo || '', true) : ''}`
}
function controls(path, index, length) {
  return `<div class="row-actions"><button data-move="${path}" data-index="${index}" data-delta="-1" aria-label="上移第 ${index + 1} 项" ${index === 0 ? 'disabled' : ''}>↑</button><button data-move="${path}" data-index="${index}" data-delta="1" aria-label="下移第 ${index + 1} 项" ${index === length - 1 ? 'disabled' : ''}>↓</button><button class="danger" data-remove="${path}" data-index="${index}">删除</button></div>`
}
const heading = (title, text, button = '') => `<div class="section-heading"><div><h2>${title}</h2><p>${text}</p></div>${button}</div>`
const add = (path, text) => `<button data-add="${path}">＋ ${text}</button>`
function get(path) { return path.split('.').reduce((o, k) => o[k], content) }
function set(path, value) { const keys = path.split('.'), key = keys.pop(); keys.reduce((o, k) => o[k], content)[key] = value }
function render() {
  $('#page-title').textContent = titles[section]
  document.querySelectorAll('nav button').forEach(b => b.setAttribute('aria-current', b.dataset.section === section ? 'page' : 'false'))
  let html = ''
  if (section === 'uiText') {
    html = `<div class="editor-section">${heading('底部 Tab 预览', '修改后点击保存并发布，小程序重新进入页面时读取新文字。')}<div class="tab-preview" aria-label="底部 Tab 文字预览">${['studioTab', 'workTab', 'productTab'].map(key => `<span data-tab-preview="${key}"></span>`).join('')}</div><p class="hint">首页窗口标题和默认分享标题留空时使用工作室名称。品牌、介绍、联系方式、作品及产品正文在对应管理页编辑。</p></div>`
    html += uiTextGroups.map((group, index) => `<details class="text-group" ${index === 0 ? 'open' : ''}><summary>${esc(group.label)}<small>${group.fields.length} 项</small></summary><div class="form-grid">${group.fields.map(([key, label]) => { const value = content.uiText[group.key][key], tokens = [...new Set(value.match(/\{\w+\}/g) || [])]; return field(label, `uiText.${group.key}.${key}`, value, 'text', tokens.length ? '保留 ' + tokens.join('、') + '，显示时自动替换为对应编号或标题。' : '') }).join('')}</div></details>`).join('')
  } else if (section === 'studio') {
    const s = content.studio
    html = `<div class="editor-section">${heading('工作室信息', '对应 about 页的品牌、简介和服务内容。')}<div class="form-grid">${field('工作室名称', 'studio.name', s.name)}${field('副标题 / 主理人', 'studio.subtitle', s.subtitle)}<div class="full">${media('名称 Logo（留空显示文字）', 'studio.logo', s.logo)}</div></div>${brandEditor(s)}${field('工作室介绍', 'studio.intro', s.intro, 'textarea')}${field('服务范围', 'studio.services', s.services, 'textarea')}</div><div class="editor-section">${heading('联系信息', '访客可在小程序 about 页面联系你。')}<div class="form-grid">${field('电子邮箱', 'studio.email', s.email, 'email')}${field('联系电话', 'studio.phone', s.phone, 'tel')}</div></div>`
  } else if (section === 'awards') {
    html = heading('AWARDS · 奖项展示', '显示在 about 页 Services 与 Contact 之间；可先放奖项 Logo，再放领奖照片。按顺序展示，点击可放大。最多 50 张，未配置图片时隐藏此栏目。', add('studio.awards', '新增奖项图片'))
    html += `<div class="editor-section">${field('栏目标题', 'uiText.studio.awards', content.uiText.studio.awards)}<label>批量上传奖项图片<input type="file" accept="image/jpeg,image/png,image/webp" multiple data-awards-upload aria-label="批量上传奖项图片"><p class="hint">可一次选择多张 JPG、PNG、WebP，每张不超过 4 MB。上传后点击「保存并发布」。</p></label></div>`
    html += content.studio.awards.length ? content.studio.awards.map((award, i, a) => `<article class="panel">${heading(`奖项图片 ${i + 1}`, '', controls('studio.awards', i, a.length))}<label>展示方式<select data-path="studio.awards.${i}.display"><option value="logo" ${award.display === 'logo' ? 'selected' : ''}>Logo · 居中展示</option><option value="photo" ${award.display !== 'logo' ? 'selected' : ''}>照片 · 按原比例铺满内容宽度</option></select></label>${media('奖项图片', `studio.awards.${i}.image`, award.image)}${field('图片说明（选填）', `studio.awards.${i}.alt`, award.alt)}</article>`).join('') : '<div class="empty">还没有奖项图片，点击「新增奖项图片」逐张添加，或在上方批量上传。</div>'
  } else if (section === 'slides') {
    html = heading('首页轮播', '按显示顺序排列，最多 20 张。', add('studio.slides', '添加轮播')) + `<div class="editor-section"><div class="form-grid"><label class="toggle-field"><input type="checkbox" data-path="homeCarousel.autoplay" ${content.homeCarousel.autoplay ? 'checked' : ''}>自动轮播（默认开启）</label>${field('切换间隔（秒）', 'homeCarousel.intervalSeconds', content.homeCarousel.intervalSeconds, 'number', '默认每 3 秒切换下一张，可设置 1–60 秒；与 Work 轮播独立。', { min: 1, max: 60, step: 1 })}</div></div>` + content.studio.slides.map((s, i, a) => `<article class="panel">${heading(`轮播 ${String(i + 1).padStart(2, '0')}`, '', controls('studio.slides', i, a.length))}${media('轮播图片', `studio.slides.${i}.image`, s.image)}${field('图片说明', `studio.slides.${i}.alt`, s.alt)}</article>`).join('')
    html += `<div class="editor-section">${heading('联系二维码', '支持微信、公众号等二维码，最多 4 个。', add('studio.qrCodes', '添加二维码'))}${content.studio.qrCodes.map((s, i, a) => `<article class="panel">${heading(`二维码 ${i + 1}`, '', controls('studio.qrCodes', i, a.length))}${media('二维码图片', `studio.qrCodes.${i}.image`, s.image)}${field('显示名称', `studio.qrCodes.${i}.label`, s.label)}</article>`).join('')}</div>`
  } else if (selected !== null) {
    const item = content[section][selected], p = `${section}.${selected}`, isProject = section === 'projects'
    html = `<button class="back" data-back>← 返回${isProject ? '作品' : '产品'}列表</button><div class="detail-top"><div><h2>${esc(item.title || '未命名内容')}</h2><p>编辑列表封面及详情页内容</p></div><small class="muted">ID · ${esc(item.id)}</small></div><div class="panel"><div class="form-grid">${field('标题', `${p}.title`, item.title)}${isProject ? `<label>作品分类<select data-path="${p}.category">${Object.entries(content.uiText.work).filter(([key]) => key in category).map(([v, t]) => `<option value="${v}" ${item.category === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>${field('项目地点', `${p}.location`, item.location)}${field('年份', `${p}.year`, item.year)}` : field('产品编号', `${p}.code`, item.code)}</div>${isProject ? projectCoverEditor(item, p) : media('封面图片', `${p}.cover`, item.cover)}${isProject ? field('列表图片宽高比', `${p}.ratio`, item.ratio, 'number', '宽度 ÷ 高度；可填 0.3–3，例如 1.5。') : ''}${field('详情介绍', `${p}.description`, item.description, 'textarea')}</div>`
    if (isProject) html += heading('详情图片', '按阅读顺序排列，最多 80 张。', add(`${p}.images`, '添加图片')) + item.images.map((image, i, a) => `<article class="panel">${heading(`图片 ${i + 1}`, '', controls(`${p}.images`, i, a.length) + `<button data-cover-image="${i}">${item.coverType !== 'video' && item.cover === image ? '当前图片封面' : '设为图片封面'}</button>`)}${media('详情图片', `${p}.images.${i}`, image)}</article>`).join('')
    if (isProject) html += heading('作品视频', '按顺序展示在作品详情中，最多 20 个；请先上传视频或填写地址。', add(`${p}.videos`, '添加视频')) + item.videos.map((video, i, a) => `<article class="panel">${heading(`视频 ${i + 1}`, '', controls(`${p}.videos`, i, a.length) + `<button data-cover-video="${i}" ${!video ? 'disabled' : ''}>${item.coverType === 'video' && item.coverVideo === video ? '当前视频封面' : '设为视频封面'}</button>`)}${media('作品视频', `${p}.videos.${i}`, video, true)}</article>`).join('')
    else html += heading('产品步骤', '每个步骤支持图片或 HTTPS 视频，最多 100 步。', add(`${p}.steps`, '添加步骤')) + item.steps.map((step, i, a) => `<article class="panel">${heading(`步骤 ${String(i + 1).padStart(2, '0')}`, '', controls(`${p}.steps`, i, a.length))}<div class="form-grid">${field('步骤标题', `${p}.steps.${i}.title`, step.title)}<label>媒体类型<select data-path="${p}.steps.${i}.type" data-render><option value="image" ${step.type === 'image' ? 'selected' : ''}>图片</option><option value="video" ${step.type === 'video' ? 'selected' : ''}>视频</option></select></label></div>${field('步骤说明', `${p}.steps.${i}.text`, step.text, 'textarea')}${media(step.type === 'video' ? '视频地址' : '步骤图片', `${p}.steps.${i}.src`, step.src, step.type === 'video')}${step.type === 'video' ? media('视频封面（选填）', `${p}.steps.${i}.poster`, step.poster || '') : ''}</article>`).join('')
  } else {
    const isProject = section === 'projects', items = content[section]
    if (isProject) html += `<div class="editor-section">${heading('Work · 分类作品轮播', '用于建筑、室内、材料等分类中的左右切换；All 保持作品列表。')}<div class="form-grid"><label class="toggle-field"><input type="checkbox" data-path="workCarousel.autoplay" ${content.workCarousel.autoplay ? 'checked' : ''}>自动轮播（默认开启）</label>${field('切换间隔（秒）', 'workCarousel.intervalSeconds', content.workCarousel.intervalSeconds, 'number', '默认每 3 秒切换下一作品，可设置 1–60 秒。', { min: 1, max: 60, step: 1 })}</div></div>`
    if (!isProject) html += field('Product 页面介绍', 'researchIntro', content.researchIntro, 'textarea')
    html += heading(isProject ? '作品列表' : '产品列表', `共 ${items.length} 项 · 点击编辑维护详情，使用箭头调整前端顺序。`, add(section, isProject ? '新建作品' : '新建产品'))
    html += items.length ? `<div class="item-list">${items.map((item, i) => `<article class="list-row"><span class="row-number">${String(i + 1).padStart(2, '0')}</span><img class="cover" src="${esc(item.cover)}" alt="${esc(item.title)}封面"><div class="row-info"><strong>${esc(item.title || '未命名内容')}</strong><small>${esc(isProject ? [content.uiText.work[item.category], item.location, item.year].filter(Boolean).join(' / ') : item.code)} · ${isProject ? item.images.length + ' 张详情图片' : item.steps.length + ' 个步骤'}</small></div><div class="list-actions"><button data-edit="${i}">编辑详情 ↗</button>${controls(section, i, items.length)}</div></article>`).join('')}</div>` : '<div class="empty">还没有内容，点击右上方新建。</div>'
  }
  $('#editor').innerHTML = html
  updateBrandPreview()
}
async function load() {
  note(); busy = true; $('#save').disabled = true
  try { const res = await api('/api/content'); content = await res.json(); content.uiText = resolveUiText(content.uiText); content.workCarousel = workCarouselSettings(content.workCarousel); content.homeCarousel = homeCarouselSettings(content.homeCarousel); content.studio.logo ??= '/static/images/zen-logo.png'; content.studio.awards ??= []; content.studio.brandStyle = { ...brandDefaults, ...content.studio.brandStyle }; content.projects.forEach(item => { item.videos ??= []; item.coverType ??= 'image'; item.coverVideo ??= '' }); etag = res.headers.get('etag'); selected = null; dirty = false; $('#revision').textContent = '内容版本 ' + etag.replaceAll('"', ''); status('已与线上内容同步'); render() } finally { busy = false; $('#save').disabled = !dirty }
}
async function uploadAwards(input) {
  if (busy) return
  const files = Array.from(input.files || [])
  if (!files.length) return
  if (content.studio.awards.length + files.length > 50) { note('最多支持 50 张奖项图片，请减少选择数量。'); input.value = ''; return }
  if (files.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024)) { note('请选择 JPG、PNG、WebP 图片，每张不超过 4 MB。'); input.value = ''; return }
  busy = true; $('#save').disabled = true; $('#editor').setAttribute('aria-busy', 'true'); note()
  let uploaded = 0
  try {
    for (const file of files) {
      status(`正在上传奖项图片 ${uploaded + 1} / ${files.length}…`)
      const response = await api('/api/media', { method: 'POST', headers: { 'Content-Type': file.type }, body: file })
      const data = await response.json()
      content.studio.awards.push({ image: data.url, alt: '', display: content.studio.awards.length === 0 ? 'logo' : 'photo' }); uploaded++; changed()
    }
    note(`已上传 ${uploaded} 张奖项图片，可调整顺序后保存并发布。`)
  } catch (error) { note(`已上传 ${uploaded} / ${files.length} 张，已成功的图片已保留。${error.message}；请重新选择其余图片上传。`) }
  finally { busy = false; render(); $('#editor').removeAttribute('aria-busy'); $('#save').disabled = !dirty; if (dirty) changed(); else status('图片未更新') }
}
async function enter() { $('#login').hidden = true; $('#workspace').hidden = false; if (content && dirty) { render(); return } await load() }
$('#login-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.submitter; button.disabled = true; $('#login-error').textContent = ''
  try { await api('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: $('#token').value }) }); $('#token').value = ''; await enter() } catch (error) { $('#login-error').textContent = error.message } finally { button.disabled = false }
})
$('nav').addEventListener('click', e => { const b = e.target.closest('[data-section]'); if (!b || busy) return; section = b.dataset.section; selected = null; render(); note() })
$('#editor').addEventListener('play', event => { if (event.target.tagName === 'VIDEO') document.querySelectorAll('#editor video').forEach(video => { if (video !== event.target) video.pause() }) }, true)
$('#editor').addEventListener('input', e => { const el = e.target; if (el.dataset.channelFor) { const project = content.projects[Number(el.dataset.channelFor.split('.')[1])], url = get(el.dataset.channelFor); project.channelActivities ??= []; let entry = project.channelActivities.find(item => item.url === url); if (!entry) { entry = { url, finderUserName: '', feedId: '' }; project.channelActivities.push(entry) } entry[el.dataset.channelField] = el.value.trim(); project.channelActivities = project.channelActivities.filter(item => item.finderUserName || item.feedId); changed(); return } if (!el.dataset.path) return; set(el.dataset.path, el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value); changed(); updateBrandPreview() })
$('#editor').addEventListener('change', async e => {
  const el = e.target
  if (el.dataset.awardsUpload !== undefined) { await uploadAwards(el); return }
  if (el.dataset.path) { if (el.closest('.media-field') && el.type === 'text') el.value = el.value.trim(); set(el.dataset.path, el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value); changed(); if (el.dataset.render !== undefined) render(); else if (el.closest('.media-field') && el.closest('.media-field').classList.contains('is-video')) render(); else if (el.closest('.media-field')) { const preview = el.closest('.media-field').querySelector('img, video'); if (preview) preview.src = el.value; else render() } updateBrandPreview() }
  if (!el.dataset.upload || !el.files[0]) return
  const file = el.files[0]
  const isVideo = el.dataset.video === 'true', limit = isVideo ? 10 : 4
  if (file.size > limit * 1024 * 1024) { note(`${isVideo ? '视频' : '图片'}超过 ${limit} MB，请压缩后再上传。`); el.value = ''; return }
  if (isVideo && file.type !== 'video/mp4') { note('请选择 MP4 视频。'); el.value = ''; return }
  busy = true; $('#save').disabled = true; $('#editor').setAttribute('aria-busy', 'true'); status(isVideo ? '正在上传视频…' : '正在上传图片…')
  try { const res = await api('/api/media', { method: 'POST', headers: { 'Content-Type': file.type }, body: file }); const data = await res.json(); set(el.dataset.upload, data.url); changed(); render(); note() } catch (error) { note(error.message) } finally { busy = false; $('#editor').removeAttribute('aria-busy'); $('#save').disabled = !dirty; if (dirty) changed(); else status(isVideo ? '视频未更新' : '图片未更新') }
})
$('#editor').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || busy) return
  if (b.dataset.previewLink) { const value = get(b.dataset.previewLink); if (!/^https:\/\/[^\s]+$/.test(value) && !/^\/(?:api\/media|static\/images)\//.test(value)) return note('请粘贴可公开访问、无需登录的 HTTPS 图片或视频地址。'); render(); note('链接预览已更新，点击「保存并发布」后同步到小程序。'); return }
  if (b.dataset.coverImage !== undefined || b.dataset.coverVideo !== undefined) {
    const item = content.projects[selected], video = b.dataset.coverVideo !== undefined
    if (video) { item.coverType = 'video'; item.coverVideo = item.videos[Number(b.dataset.coverVideo)] }
    else { item.coverType = 'image'; item.cover = item.images[Number(b.dataset.coverImage)] }
    changed(); render(); window.scrollTo(0, 0); note('封面已选定，点击「保存并发布」后同步到小程序。'); return
  }
  if (b.dataset.edit !== undefined) { selected = Number(b.dataset.edit); render(); window.scrollTo(0, 0) }
  if (b.dataset.back !== undefined) { selected = null; render() }
  if (b.dataset.move) { const a = get(b.dataset.move), i = Number(b.dataset.index), j = i + Number(b.dataset.delta); [a[i], a[j]] = [a[j], a[i]]; changed(); render() }
  if (b.dataset.remove && confirm('删除这一项？保存并发布后将同步到小程序。')) { get(b.dataset.remove).splice(Number(b.dataset.index), 1); changed(); render() }
  if (b.dataset.add) {
    const path = b.dataset.add, a = get(path), max = path === 'studio.slides' ? 20 : path === 'studio.awards' ? 50 : path === 'studio.qrCodes' ? 4 : path.endsWith('.images') ? 80 : path.endsWith('.videos') ? 20 : path.endsWith('.steps') ? 100 : 500
    if (a.length >= max) return note(`最多支持 ${max} 项。`)
    const cover = content.studio.slides[0]?.image || content.projects[0]?.cover || fallback
    let item = path === 'studio.awards' ? { image: '', alt: '', display: a.length === 0 ? 'logo' : 'photo' } : path === 'projects' ? { id: uid(), title: '新作品', category: 'architecture', location: '', year: '', cover, ratio: 1.5, description: '', coverType: 'image', coverVideo: '', images: [], videos: [] } : path === 'research' ? { id: uid(), code: '', title: '新产品', cover, description: '', steps: [] } : path === 'studio.slides' ? { id: uid(), image: cover, alt: '' } : path === 'studio.qrCodes' ? { image: cover, label: '联系微信' } : path.endsWith('.images') ? cover : path.endsWith('.videos') ? '' : { id: uid(), title: '', text: '', type: 'image', src: cover }
    a.push(item); if (path === 'projects' || path === 'research') selected = a.length - 1; changed(); render()
    if (path === 'studio.awards') { const input = document.querySelector(`[data-upload="studio.awards.${a.length - 1}.image"]`); input?.closest('.panel').scrollIntoView({ block: 'center', behavior: 'smooth' }); input?.focus({ preventScroll: true }) }
  }
})
$('#save').addEventListener('click', async () => {
  if (busy || !dirty) return
  const invalid = Array.from($('#editor').querySelectorAll('input[type="number"]')).find(input => !input.value || !input.reportValidity())
  if (invalid) { invalid.focus(); return note('请填写有效的数值，范围见输入框下方说明。') }
  const missingCover = content.projects.findIndex(item => item.coverType === 'video' && !item.coverVideo?.trim())
  if (missingCover !== -1) { section = 'projects'; selected = missingCover; render(); document.querySelector(`[data-upload="projects.${missingCover}.coverVideo"]`)?.focus(); return note('请上传封面视频、填写 HTTPS 视频地址，或在作品视频中点击「设为视频封面」。') }
  const missingChannel = content.projects.findIndex(item => item.channelActivities?.some(entry => !channelActivityFor(item, entry.url)))
  if (missingChannel !== -1) { section = 'projects'; selected = missingChannel; render(); return note('视频号原生跳转需要同时填写有效的视频号 ID 和 feedId；留空两项则仅保留分享链接。') }
  const missingAward = content.studio.awards.findIndex(award => !award.image.trim())
  if (missingAward !== -1) { section = 'awards'; selected = null; render(); document.querySelector(`[data-upload="studio.awards.${missingAward}.image"]`)?.focus(); return note(`请先为奖项图片 ${missingAward + 1} 上传图片或填写 HTTPS 地址；不需要的空项可以删除。`) }
  busy = true; $('#save').disabled = true; $('#editor').setAttribute('aria-busy', 'true'); status('正在发布…'); note()
  try { const res = await api('/api/content', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'If-Match': etag }, body: JSON.stringify(content) }); etag = res.headers.get('etag'); dirty = false; $('#revision').textContent = '内容版本 ' + etag.replaceAll('"', ''); status('已发布 · ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })) } catch (error) { note(error.message + '\n当前修改仍保留；若内容已被他人更新，请先备份当前修改，再点击重新读取。'); changed() } finally { busy = false; $('#save').disabled = !dirty; $('#editor').removeAttribute('aria-busy') }
})
$('#reload').addEventListener('click', () => { if (busy || dirty && !confirm('重新读取会丢弃当前未发布的修改，是否继续？')) return; load().catch(e => note(e.message)) })
$('#logout').addEventListener('click', async () => { if (dirty && !confirm('还有未发布的修改，退出会丢弃，是否继续？')) return; await api('/api/admin/logout', { method: 'POST' }); content = null; dirty = false; $('#workspace').hidden = true; $('#login').hidden = false })
window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = '' } })
window.addEventListener('resize', updateBrandPreview)
api('/api/admin/session').then(enter).catch(() => { $('#login').hidden = false }).finally(() => { $('#loading').hidden = true })
