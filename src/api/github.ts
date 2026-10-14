import { isCrowd, isMode, type Location, type RepoRef } from "../types"

const API = "https://api.github.com"

export class GitHubError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "GitHubError"
    this.status = status
  }
}

type ContentFile = {
  text: string
  sha: string
}

function headers(token: string, json = false) {
  const result: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  }
  if (token) result.Authorization = `Bearer ${token}`
  if (json) result["Content-Type"] = "application/json"
  return result
}

async function readError(response: Response) {
  let message = `GitHub ответил ${response.status}`
  try {
    const body = (await response.json()) as { message?: string }
    if (body.message) message = body.message
  } catch {
    // Тело ошибки не всегда JSON.
  }
  if (response.status === 401) {
    return new GitHubError(401, "Токен не подошёл. Вставьте новый в разделе «Доступ».")
  }
  if (response.status === 403) {
    if (message.toLowerCase().includes("rate limit")) {
      return new GitHubError(
        403,
        "GitHub временно ограничил запросы. Вставьте токен в разделе «Доступ» или подождите немного.",
      )
    }
    return new GitHubError(403, "У токена нет права менять файлы этого репозитория.")
  }
  if (response.status === 409) {
    return new GitHubError(409, "База обновилась одновременно с другой отправкой. Попробуйте ещё раз.")
  }
  if (response.status === 404) {
    return new GitHubError(404, "Репозиторий не найден. Проверьте владельца в разделе «Доступ».")
  }
  return new GitHubError(response.status, message)
}

function decodeBase64(content: string) {
  const binary = atob(content.replace(/\s/g, ""))
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeUtf8Base64(text: string) {
  const bytes = new TextEncoder().encode(text)
  let binary = ""
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

function parseLocations(text: string): Location[] {
  const data: unknown = JSON.parse(text)
  if (!Array.isArray(data)) throw new Error("Файл базы повреждён")
  return data.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const row = item as Partial<Location>
    if (
      typeof row.id !== "string" ||
      typeof row.name !== "string" ||
      typeof row.lat !== "number" ||
      typeof row.lng !== "number" ||
      typeof row.mode !== "string" ||
      typeof row.crowd !== "string" ||
      typeof row.photo !== "string" ||
      typeof row.added !== "string" ||
      !isMode(row.mode) ||
      !isCrowd(row.crowd)
    ) {
      return []
    }
    return [row as Location]
  })
}

async function request(repoPath: string, token: string, init?: RequestInit) {
  return fetch(`${API}${repoPath}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...headers(token, init?.body != null),
      ...(init?.headers ?? {}),
    },
  })
}

export async function ensureRepo(repo: RepoRef, token: string) {
  const response = await request(`/repos/${repo.owner}/${repo.name}`, token)
  if (!response.ok) throw await readError(response)
}

async function readContent(repo: RepoRef, token: string, path: string): Promise<ContentFile | null> {
  const response = await request(
    `/repos/${repo.owner}/${repo.name}/contents/${path}?ref=${encodeURIComponent(repo.branch)}`,
    token,
  )
  if (response.status === 404) return null
  if (!response.ok) throw await readError(response)
  const body = (await response.json()) as { content?: string; sha?: string; encoding?: string }
  if (!body.content || !body.sha) throw new Error("GitHub не вернул файл базы")
  return { text: decodeBase64(body.content), sha: body.sha }
}

async function putContent(options: {
  repo: RepoRef
  token: string
  path: string
  contentBase64: string
  message: string
  sha?: string
}) {
  const response = await request(
    `/repos/${options.repo.owner}/${options.repo.name}/contents/${options.path}`,
    options.token,
    {
      method: "PUT",
      body: JSON.stringify({
        message: options.message,
        content: options.contentBase64,
        branch: options.repo.branch,
        sha: options.sha,
      }),
    },
  )
  if (!response.ok) throw await readError(response)
}

export async function fetchLocations(repo: RepoRef, token: string) {
  await ensureRepo(repo, token)
  const file = await readContent(repo, token, "data/locations.json")
  if (!file) return []
  return parseLocations(file.text)
}

export async function publishLocation(options: {
  repo: RepoRef
  token: string
  location: Location
  imageBase64: string
}) {
  const { repo, token, location, imageBase64 } = options
  await putContent({
    repo,
    token,
    path: location.photo,
    contentBase64: imageBase64,
    message: `Добавлено фото: ${location.name}`,
  })

  let conflict: GitHubError | null = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const file = await readContent(repo, token, "data/locations.json")
    const list = file ? parseLocations(file.text) : []
    if (!list.some((item) => item.id === location.id)) list.push(location)
    try {
      await putContent({
        repo,
        token,
        path: "data/locations.json",
        contentBase64: encodeUtf8Base64(`${JSON.stringify(list, null, 2)}\n`),
        message: `Добавлена локация: ${location.name}`,
        sha: file?.sha,
      })
      return
    } catch (error) {
      if (error instanceof GitHubError && error.status === 409) {
        conflict = error
        continue
      }
      throw error
    }
  }
  throw conflict ?? new Error("База обновилась одновременно с другой отправкой. Попробуйте ещё раз.")
}
