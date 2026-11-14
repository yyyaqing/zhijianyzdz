export const homeCarouselDefaults = Object.freeze({ autoplay: true, intervalSeconds: 3 })
export function homeCarouselSettings(settings) { return { ...homeCarouselDefaults, ...settings } }
