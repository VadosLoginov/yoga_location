import { useState, type FormEvent } from "react"
import { inspectToken, normalizeToken } from "../api/github"
import type { RepoRef } from "../types"

const CLASSIC_TOKEN_URL =
  "https://github.com/settings/tokens/new?scopes=public_repo&description=yoga_location"

type Props = {
  token: string
  repo: RepoRef
  onSave: (token: string, repo: RepoRef) => void
}

export function AccessPanel({ token, repo, onSave }: Props) {
  const [draftToken, setDraftToken] = useState(token)
  const [owner, setOwner] = useState(repo.owner)
  const [name, setName] = useState(repo.name)
  const [branch, setBranch] = useState(repo.branch)
  const [status, setStatus] = useState("")
  const [statusError, setStatusError] = useState(false)
  const [checking, setChecking] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const nextToken = normalizeToken(draftToken)
    const nextRepo = {
      owner: owner.trim(),
      name: name.trim(),
      branch: branch.trim(),
    }
    setDraftToken(nextToken)
    onSave(nextToken, nextRepo)
    if (!nextToken) {
      setStatus("Токен удалён с этого устройства.")
      setStatusError(false)
      return
    }
    setChecking(true)
    setStatus("Проверяем право записи…")
    setStatusError(false)
    try {
      setStatus(await inspectToken(nextRepo, nextToken))
    } catch (cause) {
      setStatusError(true)
      setStatus(cause instanceof Error ? cause.message : "Не удалось проверить токен")
    } finally {
      setChecking(false)
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Доступ</h2>
          <p className="muted">Токен нужен только для отправки. Смотреть базу можно без него.</p>
        </div>
      </div>

      <form className="form" onSubmit={submit}>
        <label>
          Токен GitHub
          <input
            type="password"
            autoComplete="off"
            value={draftToken}
            placeholder="ghp_… или github_pat_…"
            onChange={(event) => {
              setDraftToken(event.target.value)
              setStatus("")
            }}
          />
        </label>
        <ol className="steps">
          <li>
            <a href={CLASSIC_TOKEN_URL} target="_blank" rel="noreferrer">
              Создайте classic token
            </a>
            . Галочка <strong>public_repo</strong> уже отмечена.
          </li>
          <li>Нажмите Generate token и скопируйте строку ghp_… целиком.</li>
          <li>Вставьте её сюда и сохраните. Токен останется только в этом браузере.</li>
        </ol>
        <p className="help">
          Если токен начинается с github_pat_: откройте его настройки, выберите репозиторий {name || repo.name},
          затем Repository permissions → Contents → <strong>Read and write</strong>. После смены прав вставьте токен заново.
        </p>
        <label>
          Владелец
          <input value={owner} onChange={(event) => { setOwner(event.target.value); setStatus("") }} />
        </label>
        <label>
          Репозиторий
          <input value={name} onChange={(event) => { setName(event.target.value); setStatus("") }} />
        </label>
        <label>
          Ветка
          <input value={branch} onChange={(event) => { setBranch(event.target.value); setStatus("") }} />
        </label>
        <button className="button" type="submit" disabled={checking}>
          {checking ? "Проверяем…" : "Сохранить на этом устройстве"}
        </button>
        {status ? <p className={statusError ? "notice error" : "muted"}>{status}</p> : null}
        {draftToken ? (
          <button
            className="text-button danger"
            type="button"
            onClick={() => {
              setDraftToken("")
              setStatus("")
              onSave("", { owner: owner.trim(), name: name.trim(), branch: branch.trim() })
            }}
          >
            Удалить токен
          </button>
        ) : null}
      </form>
    </section>
  )
}
