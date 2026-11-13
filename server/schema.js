import { z } from 'zod'
import { brandFonts } from '../src/data/brand.js'
import { uiTextGroups } from '../src/data/ui-text.js'
const text = z.string().max(10000)
const uiTextSchema = z.object(Object.fromEntries(uiTextGroups.map(group => {
  const fields = Object.fromEntries(group.fields.map(([key, , fallback]) => [key, z.string().max(500).default(fallback)]))
  if (['studio', 'work', 'product'].includes(group.key)) fields.demo = z.string().max(500).optional()
  return [group.key, z.object(fields).strict().transform(({ demo, ...visible }) => visible).default({})]
}))).strict().default({})
const media = z.string().max(2048).refine(value => /^https:\/\/[^\s]+$/.test(value) || /^\/api\/media\/[a-f0-9-]{36}$/.test(value) || /^\/static\/images\/[\w.-]+$/.test(value), '媒体必须使用 HTTPS 或内置图片路径')
const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/)
const step = z.object({ id: identifier, title: text, text: text.transform(value => value === '此处为视频播放器演示，正式版本替换为自己的研究过程视频。' ? '' : value), type: z.enum(['image', 'video']), src: media, poster: z.union([media, z.literal('')]).optional() }).strict()
export const contentSchema = z.object({
  schemaVersion: z.literal(1),
  isDemo: z.boolean(),
  uiText: uiTextSchema,
  studio: z.object({ name: text, subtitle: text, logo: z.union([media, z.literal('')]).optional(), intro: text, services: text,
    brandStyle: z.object({ nameFont: z.enum(Object.keys(brandFonts)).optional(), nameFontSize: z.number().min(10).max(64).optional(), logoScale: z.number().min(10).max(200).optional() }).strict().optional(),
    email: z.union([z.string().email(), z.literal('')]), phone: z.string().max(40).regex(/^[+\d\s()-]*$/),
    qrCodes: z.array(z.object({ image: media, label: text }).strict()).max(4),
    awards: z.array(z.object({ image: media, alt: text.default(''), display: z.enum(['logo', 'photo']).default('photo') }).strict()).max(50).default([]),
    slides: z.array(z.object({ id: identifier, image: media, alt: text }).strict()).max(20),
  }).strict(),
  projects: z.array(z.object({ id: identifier, title: text, category: z.enum(['architecture', 'interior', 'material']), location: text.transform(value => value === '素材演示' ? '' : value), year: z.string().max(20), cover: media, coverType: z.enum(['image', 'video']).optional(), coverVideo: z.union([media, z.literal('')]).optional(), ratio: z.number().min(.3).max(3), description: text.transform(value => value.replace('\n本条为 Pexels 摄影素材展示，用于预览排版，不代表工作室实际设计项目。', '')), images: z.array(media).max(80), videos: z.array(media).max(20).optional() }).strict()).max(500),
  researchIntro: text,
  research: z.array(z.object({ id: identifier, code: text, title: text, cover: media, description: text, steps: z.array(step).max(100).superRefine((items, context) => { if (new Set(items.map(s => s.id)).size !== items.length) context.addIssue({ code: 'custom', message: '步骤 ID 不可重复' }) }) }).strict()).max(500),
}).strict().superRefine((data, context) => {
  data.projects.forEach((project, index) => { if (project.coverType === 'video' && !project.coverVideo) context.addIssue({ code: 'custom', path: ['projects', index, 'coverVideo'], message: '视频封面需要指定视频' }) })
  for (const key of ['projects', 'research']) if (new Set(data[key].map(item => item.id)).size !== data[key].length) context.addIssue({ code: 'custom', path: [key], message: 'ID 不可重复' })
})
