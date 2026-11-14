export const workCarouselDefaults = Object.freeze({ autoplay: true, intervalSeconds: 3 })
export function workCarouselSettings(settings) { return { ...workCarouselDefaults, ...settings } }
