import { useState, type FormEvent } from "react"
import type { RepoRef } from "../types"

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
  const [saved, setSaved] = useState(false)

  function submit(event: FormEvent) {
    event.preventDefault()
    onSave(draftToken.trim(), {
      owner: owner.trim(),
      name: name.trim(),
      branch: branch.trim(),
    })
    setSaved(true)
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
            placeholder="github_pat_…"
            onChange={(event) => {
              setDraftToken(event.target.value)
              setSaved(false)
            }}
          />
        </label>
        <p className="help">
          Создайте fine-grained token для репозитория {repo.owner}/{repo.name} с правом Contents: Read and write.
          Токен хранится в этом браузере и в код не попадает.
        </p>
        <p className="help">
          <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
            Создать токен
          </a>
        </p>
        <label>
          Владелец
          <input value={owner} onChange={(event) => { setOwner(event.target.value); setSaved(false) }} />
        </label>
        <label>
          Репозиторий
          <input value={name} onChange={(event) => { setName(event.target.value); setSaved(false) }} />
        </label>
        <label>
          Ветка
          <input value={branch} onChange={(event) => { setBranch(event.target.value); setSaved(false) }} />
        </label>
        <button className="button" type="submit">
          Сохранить на этом устройстве
        </button>
        {saved ? <p className="muted">Сохранено в этом браузере.</p> : null}
        {draftToken ? (
          <button
            className="text-button danger"
            type="button"
            onClick={() => {
              setDraftToken("")
              setSaved(false)
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
