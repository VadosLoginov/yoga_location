import { CROWD_ORDER, MODE_ORDER, type Crowd, type Location, type Mode, type SortKey } from "../types"

export function filterLocations(
  items: Location[],
  mode: Mode | "all",
  crowd: Crowd | "all",
) {
  return items.filter((item) => {
    if (mode !== "all" && item.mode !== mode) return false
    if (crowd !== "all" && item.crowd !== crowd) return false
    return true
  })
}

export function sortLocations(items: Location[], sort: SortKey) {
  const copy = [...items]
  copy.sort((a, b) => {
    if (sort === "mode") {
      return MODE_ORDER.indexOf(a.mode) - MODE_ORDER.indexOf(b.mode) || a.name.localeCompare(b.name, "ru")
    }
    if (sort === "crowd") {
      return CROWD_ORDER.indexOf(a.crowd) - CROWD_ORDER.indexOf(b.crowd) || a.name.localeCompare(b.name, "ru")
    }
    if (sort === "name") return a.name.localeCompare(b.name, "ru")
    return b.added.localeCompare(a.added)
  })
  return copy
}

export function formatAdded(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export function formatCoords(lat: number, lng: number) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}
