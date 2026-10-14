import { useMemo, useState } from "react"
import { mapsEmbed, mapsLink, photoUrl } from "../config"
import { filterLocations, formatAdded, formatCoords, sortLocations } from "../lib/sort"
import { CROWDS, MODES, locationPhotos, type Crowd, type Location, type Mode, type RepoRef, type SortKey } from "../types"

type Props = {
  locations: Location[]
  repo: RepoRef
  loading: boolean
  error: string
  onRetry: () => void
  onEdit: (location: Location) => void
}

export function LocationBoard({ locations, repo, loading, error, onRetry, onEdit }: Props) {
  const [mode, setMode] = useState<Mode | "all">("all")
  const [crowd, setCrowd] = useState<Crowd | "all">("all")
  const [sort, setSort] = useState<SortKey>("newest")
  const [openId, setOpenId] = useState<string | null>(null)

  const visible = useMemo(
    () => sortLocations(filterLocations(locations, mode, crowd), sort),
    [locations, mode, crowd, sort],
  )

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Локации</h2>
          <p className="muted">
            {loading ? "Загружаем базу…" : `${visible.length} из ${locations.length}`}
          </p>
        </div>
        <button className="text-button" type="button" onClick={onRetry}>
          Обновить
        </button>
      </div>

      <div className="filters">
        <fieldset>
          <legend>Режим съёмки</legend>
          <div className="chips">
            <Chip active={mode === "all"} onClick={() => setMode("all")}>
              Все
            </Chip>
            {MODES.map((item) => (
              <Chip key={item} active={mode === item} onClick={() => setMode(item)}>
                {item}
              </Chip>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Количество людей</legend>
          <div className="chips">
            <Chip active={crowd === "all"} onClick={() => setCrowd("all")}>
              Все
            </Chip>
            {CROWDS.map((item) => (
              <Chip key={item} active={crowd === item} onClick={() => setCrowd(item)}>
                {item}
              </Chip>
            ))}
          </div>
        </fieldset>
        <label className="sort">
          Сортировка
          <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
            <option value="mode">По режиму съёмки</option>
            <option value="crowd">По количеству людей</option>
            <option value="newest">Сначала новые</option>
            <option value="name">По названию</option>
          </select>
        </label>
      </div>

      {error ? (
        <div className="notice error">
          <p>{error}</p>
          <button className="button" type="button" onClick={onRetry}>
            Повторить
          </button>
        </div>
      ) : null}

      {!loading && !error && visible.length === 0 ? (
        <div className="notice">
          <p>
            {locations.length === 0
              ? "Пока нет локаций. Добавьте фото с айфона, название и теги."
              : "По этим тегам ничего нет. Снимите фильтр."}
          </p>
        </div>
      ) : null}

      <div className="grid">
        {visible.map((location) => (
          <LocationCard
            key={location.id}
            location={location}
            repo={repo}
            open={openId === location.id}
            onToggle={() => setOpenId(openId === location.id ? null : location.id)}
            onEdit={() => onEdit(location)}
          />
        ))}
      </div>
    </section>
  )
}

function LocationCard({
  location,
  repo,
  open,
  onToggle,
  onEdit,
}: {
  location: Location
  repo: RepoRef
  open: boolean
  onToggle: () => void
  onEdit: () => void
}) {
  const photos = locationPhotos(location)
  const coverIndex = Math.max(0, photos.indexOf(location.photo))
  const [index, setIndex] = useState(coverIndex)
  const current = photos[index] ?? location.photo

  function step(delta: number) {
    setIndex((value) => (value + delta + photos.length) % photos.length)
  }

  return (
    <article className="card">
      <div className="card-photo">
        <button className="card-open" type="button" aria-expanded={open} onClick={onToggle}>
          <img src={photoUrl(repo, current)} alt={location.name} />
        </button>
        {photos.length > 1 ? (
          <>
            <button className="photo-nav prev" type="button" aria-label="Предыдущее фото" onClick={() => step(-1)}>
              ‹
            </button>
            <button className="photo-nav next" type="button" aria-label="Следующее фото" onClick={() => step(1)}>
              ›
            </button>
            <span className="photo-count">
              {index + 1} / {photos.length}
            </span>
          </>
        ) : null}
      </div>
      <div className="card-body">
        <h3>{location.name}</h3>
        <div className="tags">
          <span className={`tag mode-${modeClass(location.mode)}`}>{location.mode}</span>
          <span className="tag">{location.crowd}</span>
        </div>
        <p className="meta">
          {formatAdded(location.added)} · {formatCoords(location.lat, location.lng)}
        </p>
        <button className="text-button" type="button" onClick={onEdit}>
          Изменить
        </button>
      </div>
      {open ? (
        <div className="card-map">
          <iframe title={`Карта: ${location.name}`} src={mapsEmbed(location.lat, location.lng)} loading="lazy" />
          <a href={mapsLink(location.lat, location.lng)} target="_blank" rel="noreferrer">
            Открыть в Google Картах
          </a>
        </div>
      ) : (
        <div className="card-link">
          <a href={mapsLink(location.lat, location.lng)} target="_blank" rel="noreferrer">
            Открыть в Google Картах
          </a>
        </div>
      )}
    </article>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button className={active ? "chip active" : "chip"} type="button" aria-pressed={active} onClick={onClick}>
      {children}
    </button>
  )
}

function modeClass(mode: Mode) {
  if (mode === "Рассвет") return "dawn"
  if (mode === "День") return "day"
  return "sunset"
}
