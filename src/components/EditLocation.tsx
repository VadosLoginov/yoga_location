import { useEffect, useRef, useState, type FormEvent } from "react"
import { deleteLocation, updateLocation } from "../api/github"
import { photoUrl } from "../config"
import type { Gps } from "../lib/coords"
import { PointMap } from "./PointMap"
import { blobToBase64, compressPhoto, preparePhoto } from "../lib/image"
import { formatCoords } from "../lib/sort"
import { CROWDS, MODES, locationPhotos, type Crowd, type Location, type Mode, type RepoRef } from "../types"

type DraftPhoto = {
  path: string
  preview: string
  file?: File
}

type Props = {
  location: Location
  token: string
  repo: RepoRef
  onCancel: () => void
  onNeedAccess: () => void
  onSaved: (location: Location) => void
  onDeleted: () => void
}

export function EditLocation({ location, token, repo, onCancel, onNeedAccess, onSaved, onDeleted }: Props) {
  const [name, setName] = useState(location.name)
  const [mode, setMode] = useState<Mode>(location.mode)
  const [crowd, setCrowd] = useState<Crowd>(location.crowd)
  const [point, setPoint] = useState<Gps>({ latitude: location.lat, longitude: location.lng })
  const [photos, setPhotos] = useState<DraftPhoto[]>(() =>
    locationPhotos(location).map((path) => ({ path, preview: photoUrl(repo, path) })),
  )
  const [cover, setCover] = useState(location.photo)
  const [reading, setReading] = useState(false)
  const [sending, setSending] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState("")
  const localPreviews = useRef<string[]>([])

  useEffect(() => {
    const owned = localPreviews
    return () => {
      for (const url of owned.current) URL.revokeObjectURL(url)
    }
  }, [])

  async function addFiles(list: FileList | null) {
    if (!list?.length) return
    setError("")
    setReading(true)
    try {
      const next: DraftPhoto[] = []
      for (const file of list) {
        const opened = await preparePhoto(file)
        const path = `photos/${crypto.randomUUID()}.jpg`
        const preview = URL.createObjectURL(opened)
        localPreviews.current.push(preview)
        next.push({ path, preview, file: opened })
      }
      setPhotos((current) => [...current, ...next])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось открыть фото")
    } finally {
      setReading(false)
    }
  }

  function removePhoto(path: string) {
    setPhotos((current) => {
      if (current.length === 1) return current
      const next = current.filter((item) => item.path !== path)
      const removed = current.find((item) => item.path === path)
      if (removed?.file) {
        URL.revokeObjectURL(removed.preview)
        localPreviews.current = localPreviews.current.filter((url) => url !== removed.preview)
      }
      return next
    })
    setCover((current) => (current === path ? photos.find((item) => item.path !== path)?.path ?? current : current))
  }

  async function removeLocation() {
    setError("")
    if (!token) {
      onNeedAccess()
      return
    }
    setSending(true)
    try {
      await deleteLocation({ repo, token, location })
      onDeleted()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось удалить локацию")
      setSending(false)
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError("")
    if (!token) {
      onNeedAccess()
      return
    }
    const title = name.trim()
    if (!title) {
      setError("Напишите короткое название.")
      return
    }
    if (!point) {
      setError("Нажмите точку на карте.")
      return
    }
    if (photos.length === 0) {
      setError("Оставьте хотя бы одно фото.")
      return
    }
    const ordered = [...photos].sort((a, b) => Number(b.path === cover) - Number(a.path === cover))
    setSending(true)
    try {
      const images = []
      for (const photo of ordered) {
        if (!photo.file) continue
        const jpeg = await compressPhoto(photo.file)
        images.push({ path: photo.path, imageBase64: await blobToBase64(jpeg) })
      }
      const paths = ordered.map((photo) => photo.path)
      const next: Location = {
        ...location,
        name: title,
        lat: point.latitude,
        lng: point.longitude,
        mode,
        crowd,
        photo: paths[0],
        photos: paths,
      }
      await updateLocation({ repo, token, location: next, images })
      onSaved(next)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить локацию")
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Редактирование</h2>
          <p className="muted">{location.name}</p>
        </div>
        <button className="text-button" type="button" onClick={onCancel}>
          Назад
        </button>
      </div>

      {!token ? (
        <div className="notice">
          <p>Чтобы сохранить правки, вставьте токен GitHub в разделе «Доступ».</p>
          <button className="button" type="button" onClick={onNeedAccess}>
            Открыть доступ
          </button>
        </div>
      ) : null}

      <form className="form" onSubmit={(event) => void onSubmit(event)}>
        <div className="thumbs">
          {photos.map((photo) => (
            <div className={photo.path === cover ? "thumb cover" : "thumb"} key={photo.path}>
              <img src={photo.preview} alt="" />
              <button className="text-button" type="button" onClick={() => setCover(photo.path)}>
                {photo.path === cover ? "Обложка" : "Сделать обложкой"}
              </button>
              <button className="text-button danger" type="button" onClick={() => removePhoto(photo.path)} disabled={photos.length === 1}>
                Убрать
              </button>
            </div>
          ))}
        </div>

        <label className="button add-photos">
          {reading ? "Открываем фото…" : "Добавить фото"}
          <input
            type="file"
            accept="image/*,.heic,.heif"
            multiple
            disabled={reading || sending}
            onChange={(event) => {
              void addFiles(event.target.files)
              event.target.value = ""
            }}
          />
        </label>

        <label>
          Название
          <input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
        </label>

        <div className="manual">
          <p>Нажмите на карту, чтобы перенести точку.</p>
          <PointMap point={point} onPick={setPoint} />
          <p className="muted">Точка: {formatCoords(point.latitude, point.longitude)}</p>
        </div>

        <fieldset>
          <legend>Режим съёмки</legend>
          <div className="choices">
            {MODES.map((item) => (
              <label key={item} className={mode === item ? "choice active" : "choice"}>
                <input type="radio" name="edit-mode" value={item} checked={mode === item} onChange={() => setMode(item)} />
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
                <input type="radio" name="edit-crowd" value={item} checked={crowd === item} onChange={() => setCrowd(item)} />
                {item}
              </label>
            ))}
          </div>
        </fieldset>

        {error ? <p className="notice error">{error}</p> : null}

        <button className="button" type="submit" disabled={sending || reading}>
          {sending ? "Сохраняем…" : "Сохранить"}
        </button>
        {confirmDelete ? (
          <div className="notice error">
            <p>Удалить локацию «{location.name}» и все её фото?</p>
            <button className="button danger" type="button" disabled={sending || reading} onClick={() => void removeLocation()}>
              {sending ? "Удаляем…" : "Удалить локацию"}
            </button>
            <button className="text-button" type="button" onClick={() => setConfirmDelete(false)}>
              Отмена
            </button>
          </div>
        ) : (
          <button className="button danger" type="button" disabled={sending || reading} onClick={() => setConfirmDelete(true)}>
            Удалить локацию
          </button>
        )}
      </form>
    </section>
  )
}
