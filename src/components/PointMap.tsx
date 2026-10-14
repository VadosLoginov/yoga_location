import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import type { Gps } from "../lib/coords"

const DEFAULT_CENTER: L.LatLngExpression = [38.52, -0.17]
const PIN = L.divIcon({
  className: "point-pin",
  iconSize: [22, 22],
  iconAnchor: [11, 22],
})

type Props = {
  point: Gps | null
  onPick: (point: Gps) => void
}

export function PointMap({ point, onPick }: Props) {
  const nodeRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const onPickRef = useRef(onPick)
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState("")
  onPickRef.current = onPick

  useEffect(() => {
    const node = nodeRef.current
    if (!node) return
    const start = point
    const map = L.map(node, { scrollWheelZoom: false }).setView(
      start ? [start.latitude, start.longitude] : DEFAULT_CENTER,
      start ? 16 : 13,
    )
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map)
    map.on("click", (event) => {
      onPickRef.current({ latitude: event.latlng.lat, longitude: event.latlng.lng })
    })
    mapRef.current = map
    const frame = requestAnimationFrame(() => map.invalidateSize())
    return () => {
      cancelAnimationFrame(frame)
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!point) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }
    const latlng = L.latLng(point.latitude, point.longitude)
    if (!markerRef.current) {
      markerRef.current = L.marker(latlng, { icon: PIN }).addTo(map)
      map.setView(latlng, Math.max(map.getZoom(), 16))
      return
    }
    markerRef.current.setLatLng(latlng)
  }, [point])

  function locate() {
    if (!navigator.geolocation) {
      setLocateError("Этот браузер не отдаёт координаты. Нажмите точку на карте.")
      return
    }
    setLocating(true)
    setLocateError("")
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = { latitude: position.coords.latitude, longitude: position.coords.longitude }
        onPickRef.current(next)
        mapRef.current?.setView([next.latitude, next.longitude], 16)
        setLocating(false)
      },
      () => {
        setLocateError("Не удалось определить место. Нажмите точку на карте.")
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  return (
    <div className="picker">
      <div ref={nodeRef} className="point-map" />
      <button className="text-button" type="button" onClick={locate} disabled={locating}>
        {locating ? "Ищем, где вы…" : "Поставить, где я сейчас"}
      </button>
      {locateError ? <p className="notice error">{locateError}</p> : null}
    </div>
  )
}
