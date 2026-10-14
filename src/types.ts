export const MODES = ["Рассвет", "День", "Закат"] as const
export const CROWDS = ["Мало", "Средне", "Много"] as const

export type Mode = (typeof MODES)[number]
export type Crowd = (typeof CROWDS)[number]
export type SortKey = "mode" | "crowd" | "newest" | "name"
export type Screen = "list" | "add" | "access"

export type Location = {
  id: string
  name: string
  lat: number
  lng: number
  mode: Mode
  crowd: Crowd
  photo: string
  photos: string[]
  added: string
}

export function locationPhotos(location: { photo: string; photos?: string[] }) {
  const listed = (location.photos ?? []).filter((item) => item.length > 0)
  const photos = listed.length > 0 ? [...new Set(listed)] : [location.photo]
  if (!photos.includes(location.photo)) photos.unshift(location.photo)
  return photos
}

export type RepoRef = {
  owner: string
  name: string
  branch: string
}

export const MODE_ORDER: Mode[] = ["Рассвет", "День", "Закат"]
export const CROWD_ORDER: Crowd[] = ["Мало", "Средне", "Много"]

export function isMode(value: string): value is Mode {
  return (MODES as readonly string[]).includes(value)
}

export function isCrowd(value: string): value is Crowd {
  return (CROWDS as readonly string[]).includes(value)
}
