import { useEffect, useRef, useState, type FormEvent } from "react"
import exifr from "exifr"
import { publishLocation } from "../api/github"
import { mapsEmbed, mapsLink } from "../config"
import { parseCoordinatePair, parseCoordinates, type Gps } from "../lib/coords"
import { blobToBase64, compressPhoto, preparePhoto } from "../lib/image"
import { formatCoords } from "../lib/sort"
import { CROWDS, MODES, type Crowd, type Location, type Mode, type RepoRef } from "../types"

type Props = {
  token: string
  repo: RepoRef
  onSaved: (location: Location) => void
  onNeedAccess: () => void
}

export function AddLocation({ token, repo, onSaved, onNeedAccess }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const [preview, setPreview] = useState("")
  const previewRef = useRef("")
  const [photoGps, setPhotoGps] = useState<Gps | null>(null)
  const [manualGps, setManualGps] = useState<Gps | null>(null)
  const [paste, setPaste] = useState("")
  const [latText, setLatText] = useState("")
  const [lngText, setLngText] = useState("")
  const [reading, setReading] = useState(false)
  const [name, setName] = useState("")
  const [mode, setMode] = useState<Mode>("День")
  const [crowd, setCrowd] = useState<Crowd>("Средне")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    }
  }, [])

  const gps = photoGps ?? manualGps

  function clearManualPoint() {
    setManualGps(null)
    setPaste("")
    setLatText("")
    setLngText("")
  }

  function updateManualFields(latitude: string, longitude: string) {
    setLatText(latitude)
    setLngText(longitude)
    setManualGps(parseCoordinatePair(latitude, longitude))
  }

  function applyPaste(value: string) {
    setPaste(value)
    const point = parseCoordinates(value)
    if (!point) return
    setLatText(String(point.latitude))
    setLngText(String(point.longitude))
    setManualGps(point)
  }

  function replacePreview(next: string) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = next
    setPreview(next)
  }

  async function onFile(next: File | null) {
    setFile(null)
    setPhotoGps(null)
    clearManualPoint()
    setError("")
    replacePreview("")
    if (!next) return
    setReading(true)
    try {
      const [point, opened] = await Promise.all([
        exifr.gps(next).catch(() => undefined) as Promise<Gps | undefined>,
        preparePhoto(next),
      ])
      replacePreview(URL.createObjectURL(opened))
      setFile(opened)
      if (point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)) {
        setPhotoGps(point)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось открыть фото")
    } finally {
      setReading(false)
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError("")
    if (!token) {
      onNeedAccess()
      return
    }
    if (!file || !gps) return
    const title = name.trim()
    if (!title) {
      setError("Напишите короткое название.")
      return
    }
    setSending(true)
    try {
      const image = await compressPhoto(file)
      const imageBase64 = await blobToBase64(image)
      const id = crypto.randomUUID()
      const location: Location = {
        id,
        name: title,
        lat: gps.latitude,
        lng: gps.longitude,
        mode,
        crowd,
        photo: `photos/${id}.jpg`,
        added: new Date().toISOString(),
      }
      await publishLocation({ repo, token, location, imageBase64 })
      setFile(null)
      setPhotoGps(null)
      clearManualPoint()
      setName("")
      setFileKey((current) => current + 1)
      replacePreview("")
      onSaved(location)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось отправить локацию")
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Новая локация</h2>
          <p className="muted">Фото, название, режим съёмки и количество людей.</p>
        </div>
      </div>

      {!token ? (
        <div className="notice">
          <p>Чтобы отправить точку в базу, один раз вставьте токен GitHub. Он останется только в этом браузере.</p>
          <button className="button" type="button" onClick={onNeedAccess}>
            Открыть доступ
          </button>
        </div>
      ) : null}

      <form className="form" onSubmit={onSubmit}>
        <label className="file">
          <input
            key={fileKey}
            type="file"
            accept="image/*,.heic,.heif"
            onChange={(event) => void onFile(event.target.files?.[0] ?? null)}
          />
          {preview ? (
            <img src={preview} alt="Выбранное фото" />
          ) : (
            <span>{reading ? "Открываем фото…" : "Выбрать фото с айфона"}</span>
          )}
        </label>

        {reading ? <p className="muted">Открываем фото…</p> : null}
        {file && !reading && !photoGps ? (
          <div className="manual">
            <p>В этом фото нет координат. Впишите точку или вставьте ссылку Google Карт.</p>
            <label>
              Ссылка или координаты
              <input
                value={paste}
                placeholder="38.52497, -0.17359"
                onChange={(event) => applyPaste(event.target.value)}
              />
            </label>
            <div className="coord-row">
              <label>
                Широта
                <input
                  inputMode="decimal"
                  value={latText}
                  placeholder="38.52497"
                  onChange={(event) => updateManualFields(event.target.value, lngText)}
                />
              </label>
              <label>
                Долгота
                <input
                  inputMode="decimal"
                  value={lngText}
                  placeholder="-0.17359"
                  onChange={(event) => updateManualFields(latText, event.target.value)}
                />
              </label>
            </div>
            {(paste.trim() || (latText.trim() && lngText.trim())) && !manualGps ? (
              <p className="notice error">Не получилось прочитать координаты. Пример: 38.52497, -0.17359</p>
            ) : null}
          </div>
        ) : null}
        {gps ? (
          <div className="point">
            <p>Точка: {formatCoords(gps.latitude, gps.longitude)}</p>
            <iframe title="Точка на карте" src={mapsEmbed(gps.latitude, gps.longitude)} />
            <a href={mapsLink(gps.latitude, gps.longitude)} target="_blank" rel="noreferrer">
              Открыть в Google Картах
            </a>
          </div>
        ) : null}

        <label>
          Название
          <input
            value={name}
            maxLength={80}
            placeholder="Например, набережная у моста"
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <fieldset>
          <legend>Режим съёмки</legend>
          <div className="choices">
            {MODES.map((item) => (
              <label key={item} className={mode === item ? "choice active" : "choice"}>
                <input
                  type="radio"
                  name="mode"
                  value={item}
                  checked={mode === item}
                  onChange={() => setMode(item)}
                />
                {item}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Количество людей</legend>
          <div className="choices">
            {CROWDS.map((item) => (
              <label key={item} className={crowd === item ? "choice active" : "choice"}>
                <input
                  type="radio"
                  name="crowd"
                  value={item}
                  checked={crowd === item}
                  onChange={() => setCrowd(item)}
                />
                {item}
              </label>
            ))}
          </div>
        </fieldset>

        {error ? <p className="notice error">{error}</p> : null}

        <button className="button" type="submit" disabled={!file || !gps || sending || reading}>
          {sending ? "Отправляем…" : "Отправить в базу"}
        </button>
      </form>
    </section>
  )
}
