import { useEffect, useRef, useState, type FormEvent } from "react"
import exifr from "exifr"
import { publishLocation } from "../api/github"
import { mapsLink } from "../config"
import type { Gps } from "../lib/coords"
import { blobToBase64, compressPhoto, preparePhoto } from "../lib/image"
import { formatCoords } from "../lib/sort"
import { CROWDS, MODES, type Crowd, type Location, type Mode, type RepoRef } from "../types"
import { PointMap } from "./PointMap"

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
  const [picked, setPicked] = useState<Gps | null>(null)
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

  const gps = picked ?? photoGps

  function replacePreview(next: string) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = next
    setPreview(next)
  }

  async function onFile(next: File | null) {
    setFile(null)
    setPhotoGps(null)
    setPicked(null)
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
        photos: [`photos/${id}.jpg`],
        added: new Date().toISOString(),
      }
      await publishLocation({ repo, token, location, imageBase64 })
      setFile(null)
      setPhotoGps(null)
      setPicked(null)
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
        {file && !reading ? (
          <div className="manual">
            <p>
              {picked
                ? "Точка стоит на карте. Нажмите ещё раз, чтобы сдвинуть."
                : photoGps
                  ? "Точка взята из фото. Нажмите на карту, если её нужно сдвинуть."
                  : "Нажмите на карту в месте съёмки."}
            </p>
            <PointMap point={gps} onPick={setPicked} />
            {gps ? (
              <p>
                Точка: {formatCoords(gps.latitude, gps.longitude)}.{" "}
                <a href={mapsLink(gps.latitude, gps.longitude)} target="_blank" rel="noreferrer">
                  Открыть в Google Картах
                </a>
              </p>
            ) : null}
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
