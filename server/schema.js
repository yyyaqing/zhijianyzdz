import { z } from 'zod'
const text = z.string().max(10000)
const media = z.string().max(2048).refine(value => /^https:\/\/[^\s]+$/.test(value) || /^\/api\/media\/[a-f0-9-]{36}$/.test(value) || /^\/static\/images\/[\w.-]+$/.test(value), '媒体必须使用 HTTPS 或内置图片路径')
const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/)
const step = z.object({ id: identifier, title: text, text, type: z.enum(['image', 'video']), src: media, poster: z.union([media, z.literal('')]).optional() }).strict()
export const contentSchema = z.object({
  schemaVersion: z.literal(1),
  isDemo: z.boolean(),
  studio: z.object({ name: text, subtitle: text, logo: z.union([media, z.literal('')]).optional(), intro: text, services: text,
    email: z.union([z.string().email(), z.literal('')]), phone: z.string().max(40).regex(/^[+\d\s()-]*$/),
    qrCodes: z.array(z.object({ image: media, label: text }).strict()).max(4),
    slides: z.array(z.object({ id: identifier, image: media, alt: text }).strict()).max(20),
  }).strict(),
  projects: z.array(z.object({ id: identifier, title: text, category: z.enum(['architecture', 'interior', 'material']), location: text, year: z.string().max(20), cover: media, ratio: z.number().min(.3).max(3), description: text, images: z.array(media).max(80), videos: z.array(media).max(20).optional() }).strict()).max(500),
  researchIntro: text,
  research: z.array(z.object({ id: identifier, code: text, title: text, cover: media, description: text, steps: z.array(step).max(100).superRefine((items, context) => { if (new Set(items.map(s => s.id)).size !== items.length) context.addIssue({ code: 'custom', message: '步骤 ID 不可重复' }) }) }).strict()).max(500),
}).strict().superRefine((data, context) => {
  for (const key of ['projects', 'research']) if (new Set(data[key].map(item => item.id)).size !== data[key].length) context.addIssue({ code: 'custom', path: [key], message: 'ID 不可重复' })
})
