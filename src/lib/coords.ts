export type Gps = { latitude: number; longitude: number }

function point(latitude: number, longitude: number): Gps | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
  return { latitude, longitude }
}

function decimal(value: string) {
  return Number(value.trim().replace(",", "."))
}

export function parseCoordinatePair(latitude: string, longitude: string): Gps | null {
  if (!latitude.trim() || !longitude.trim()) return null
  return point(decimal(latitude), decimal(longitude))
}

export function parseCoordinates(input: string): Gps | null {
  const text = input.trim()
  if (!text) return null

  const at = text.match(/@(-?\d+(?:[.,]\d+)?),\s*(-?\d+(?:[.,]\d+)?)/)
  if (at) return point(decimal(at[1]), decimal(at[2]))

  const query = text.match(/[?&](?:q|query)=(-?\d+(?:[.,]\d+)?),\s*(-?\d+(?:[.,]\d+)?)/)
  if (query) return point(decimal(query[1]), decimal(query[2]))

  const place = text.match(/!3d(-?\d+(?:[.,]\d+)?)!4d(-?\d+(?:[.,]\d+)?)/)
  if (place) return point(decimal(place[1]), decimal(place[2]))

  const pair = text.match(/(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)/)
  if (pair) return point(decimal(pair[1]), decimal(pair[2]))
  return null
}
