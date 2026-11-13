// 默认内容，作品与联系方式可通过后台维护。
import workMaterials from './work-materials.js'
import { resolveUiText } from './ui-text.js'
const image = (name) => `/static/images/${name}.jpg`
export const demoContent = {
  schemaVersion: 1,
  isDemo: false,
  uiText: resolveUiText(),
  studio: {
    name: '纸间营造', subtitle: '大曾', logo: '/static/images/zen-logo.png',
    awards: [],
    intro: '以纸为始，向空间生长。我们关注建筑、室内与材料之间的联系，在日常观察与反复实践中，探索空间的更多可能。',
    services: '建筑 / 室内 / 材料研究', email: '', phone: '', qrCodes: [],
    slides: [
      { id: 's1', image: image('stair'), alt: '建筑立面与天空' },
      { id: 's2', image: image('interior'), alt: '自然光中的室内空间' },
      { id: 's3', image: image('facade'), alt: '建筑结构与天空' },
      { id: 's4', image: image('house'), alt: '庭院与居住空间' },
    ],
  },
  projects: [
    { id: 'quiet-room', title: '光的居所', category: 'interior', location: '空间习作', year: '2026', cover: image('interior'), ratio: 0.88, description: '从一束自然光出发，观察空间、家具与人的关系。通过材质和尺度的变化，记录一天之中光线的移动。', images: [image('interior'), image('light'), image('house')] },
    { id: 'courtyard', title: '院落之间', category: 'architecture', location: '建筑习作', year: '2026', cover: image('atrium'), ratio: 0.8, description: '以院落组织空间，让行走成为与环境相遇的过程。实体与空隙共同构成建筑的秩序。', images: [image('atrium'), image('facade'), image('stair')] },
    { id: 'grain', title: '材料的温度', category: 'material', location: '材料习作', year: '2026', cover: image('material'), ratio: 1.2, description: '记录木材的纹理、触感与时间。材料不是表面装饰，而是空间体验的一部分。', images: [image('material'), image('gallery')] },
    { id: 'concrete', title: '几何与光', category: 'architecture', location: '建筑习作', year: '2026', cover: image('stair'), ratio: 0.78, description: '在几何的转折中寻找光。混凝土的质地与简洁的结构，让空间回到最基本的体验。', images: [image('stair'), image('facade')] },
    { id: 'daily-space', title: '日常的尺度', category: 'interior', location: '空间习作', year: '2026', cover: image('house'), ratio: 1.05, description: '将设计放回日常，从居住的细节理解空间。开放的边界让室内与室外彼此延伸。', images: [image('house'), image('light')] },
    { id: 'structure', title: '结构的表达', category: 'material', location: '材料习作', year: '2026', cover: image('facade'), ratio: 0.82, description: '结构、材料与构造共同参与空间的形成。通过局部研究，理解整体秩序。', images: [image('facade'), image('material')] },
  ],
  researchIntro: '在观察、制作与实践之间展开研究。通过对材料、构造和空间的反复试验，记录从最初的想法到具体呈现的每一个过程。',
  research: [
    { id: 'r001', code: 'ZJ-001', title: '材料观察', cover: image('material'), description: '从材料本身出发，观察纹理、尺度与光的变化。', steps: [
      { id: 'a1', title: '观察与采集', text: '记录材料在不同光线下的色泽与纹理，建立最初的样本档案。', type: 'image', src: image('material') },
      { id: 'a2', title: '局部与整体', text: '把局部细节放回空间，观察材料与周围环境的联系。', type: 'image', src: image('gallery') },
      { id: 'a3', title: '影像记录', text: '以影像记录材料观察与空间研究的过程。', type: 'video', src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', poster: '' },
    ] },
    { id: 'r002', code: 'ZJ-002', title: '光的路径', cover: image('light'), description: '以光为线索，理解空间的边界与层次。', steps: [
      { id: 'b1', title: '现场观察', text: '记录自然光进入空间的方向，观察明暗交界的位置。', type: 'image', src: image('light') },
      { id: 'b2', title: '空间试验', text: '通过不同开口与尺度，探索光线对空间感受的影响。', type: 'image', src: image('stair') },
    ] },
    { id: 'r003', code: 'ZJ-003', title: '空间构成', cover: image('atrium'), description: '在实体与空隙之间，寻找空间的秩序。', steps: [{ id: 'c1', title: '体块关系', text: '以基本的几何关系建立空间，观察体量之间的距离。', type: 'image', src: image('atrium') }, { id: 'c2', title: '结构推演', text: '从立面与结构的关系理解空间。', type: 'image', src: image('facade') }] },
    { id: 'r004', code: 'ZJ-004', title: '居住原型', cover: image('interior'), description: '从日常出发，重新理解居住。', steps: [{ id: 'd1', title: '日常记录', text: '通过观察行为与动线，建立空间原型。', type: 'image', src: image('interior') }, { id: 'd2', title: '尺度验证', text: '在场景中验证尺度与材料的关系。', type: 'image', src: image('house') }] },
    { id: 'r005', code: 'ZJ-005', title: '表面与触感', cover: image('gallery'), description: '记录表面细节与人的感知。', steps: [{ id: 'e1', title: '细部采样', text: '收集表面与连接方式，形成细节研究。', type: 'image', src: image('gallery') }] },
    { id: 'r006', code: 'ZJ-006', title: '构造练习', cover: image('facade'), description: '在制作中理解构造，在构造中理解空间。', steps: [{ id: 'f1', title: '连接与支撑', text: '研究材料的连接逻辑与结构表达。', type: 'image', src: image('facade') }, { id: 'f2', title: '回到空间', text: '把构造细节放回空间，重新检验最初的想法。', type: 'image', src: image('stair') }] },
  ],
}
demoContent.projects.push(...workMaterials)
