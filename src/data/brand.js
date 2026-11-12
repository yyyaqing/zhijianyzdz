export const brandDefaults = Object.freeze({ nameFont: 'sans', nameFontSize: 14, logoScale: 50 })
export const brandFonts = Object.freeze({
  sans: { label: '现代黑体', family: '"Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif' },
  serif: { label: '经典宋体', family: '"Songti SC", "STSong", "SimSun", serif' },
  kai: { label: '书写楷体', family: '"Kaiti SC", "STKaiti", "KaiTi", serif' },
})
export function brandSettings(studio) { return { ...brandDefaults, ...studio.brandStyle } }
