import { useCallback, useEffect, useState } from "react"
import { fetchLocations } from "./api/github"
import { AccessPanel } from "./components/AccessPanel"
import { AddLocation } from "./components/AddLocation"
import { LocationBoard } from "./components/LocationBoard"
import { loadRepo, loadToken, saveRepo, saveToken } from "./config"
import type { Location, RepoRef, Screen } from "./types"

export function App() {
  const [screen, setScreen] = useState<Screen>("list")
  const [token, setToken] = useState(loadToken)
  const [repo, setRepo] = useState<RepoRef>(loadRepo)
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const reload = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const next = await fetchLocations(repo, token)
      setLocations(next)
    } catch (cause) {
      setLocations([])
      setError(cause instanceof Error ? cause.message : "Не удалось открыть базу")
    } finally {
      setLoading(false)
    }
  }, [repo, token])

  useEffect(() => {
    void reload()
  }, [reload])

  function saveAccess(nextToken: string, nextRepo: RepoRef) {
    saveToken(nextToken)
    saveRepo(nextRepo)
    setToken(nextToken)
    setRepo(nextRepo)
  }

  return (
    <div className="app">
      <header className="top">
        <div>
          <p className="eyebrow">Съёмки</p>
          <h1>База локаций</h1>
        </div>
        <nav className="tabs" aria-label="Разделы">
          <Tab current={screen} id="list" onSelect={setScreen}>
            База
          </Tab>
          <Tab current={screen} id="add" onSelect={setScreen}>
            Добавить
          </Tab>
          <Tab current={screen} id="access" onSelect={setScreen}>
            Доступ
          </Tab>
        </nav>
      </header>

      {screen === "list" ? (
        <LocationBoard
          locations={locations}
          repo={repo}
          loading={loading}
          error={error}
          onRetry={() => void reload()}
        />
      ) : null}
      {screen === "add" ? (
        <AddLocation
          token={token}
          repo={repo}
          onNeedAccess={() => setScreen("access")}
          onSaved={(location) => {
            setLocations((current) => [location, ...current.filter((item) => item.id !== location.id)])
            setScreen("list")
          }}
        />
      ) : null}
      {screen === "access" ? <AccessPanel token={token} repo={repo} onSave={saveAccess} /> : null}

      <nav className="dock" aria-label="Разделы">
        <Tab current={screen} id="list" onSelect={setScreen}>
          База
        </Tab>
        <Tab current={screen} id="add" onSelect={setScreen}>
          Добавить
        </Tab>
        <Tab current={screen} id="access" onSelect={setScreen}>
          Доступ
        </Tab>
      </nav>
    </div>
  )
}

function Tab({
  current,
  id,
  onSelect,
  children,
}: {
  current: Screen
  id: Screen
  onSelect: (screen: Screen) => void
  children: string
}) {
  return (
    <button type="button" className={current === id ? "tab active" : "tab"} aria-current={current === id ? "page" : undefined} onClick={() => onSelect(id)}>
      {children}
    </button>
  )
}
