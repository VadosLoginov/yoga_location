import { useMemo, useState } from "react"
import { mapsEmbed, mapsLink, photoUrl } from "../config"
import { filterLocations, formatAdded, formatCoords, sortLocations } from "../lib/sort"
import { CROWDS, MODES, type Crowd, type Location, type Mode, type RepoRef, type SortKey } from "../types"

type Props = {
  locations: Location[]
  repo: RepoRef
  loading: boolean
  error: string
  onRetry: () => void
}

export function LocationBoard({ locations, repo, loading, error, onRetry }: Props) {
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
        {visible.map((location) => {
          const open = openId === location.id
          return (
            <article className="card" key={location.id}>
              <button
                className="card-open"
                type="button"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : location.id)}
              >
                <img src={photoUrl(repo, location.photo)} alt={location.name} />
                <div className="card-body">
                  <h3>{location.name}</h3>
                  <div className="tags">
                    <span className={`tag mode-${modeClass(location.mode)}`}>{location.mode}</span>
                    <span className="tag">{location.crowd}</span>
                  </div>
                  <p className="meta">
                    {formatAdded(location.added)} · {formatCoords(location.lat, location.lng)}
                  </p>
                </div>
              </button>
              {open ? (
                <div className="card-map">
                  <iframe
                    title={`Карта: ${location.name}`}
                    src={mapsEmbed(location.lat, location.lng)}
                    loading="lazy"
                  />
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
        })}
      </div>
    </section>
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
