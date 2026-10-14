import { isCrowd, isMode, locationPhotos, type Location, type RepoRef } from "../types"

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

export function normalizeToken(token: string) {
  return token.trim().replace(/^bearer\s+/i, "").replace(/^token\s+/i, "").replace(/\s+/g, "")
}

function headers(token: string, json = false) {
  const value = normalizeToken(token)
  const result: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  }
  if (value) result.Authorization = `Bearer ${value}`
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
    return new GitHubError(
      403,
      "У токена нет права менять файлы. В разделе «Доступ» создайте classic token с галочкой public_repo и вставьте его заново.",
    )
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
    const rawPhotos = Array.isArray((item as { photos?: unknown }).photos)
      ? (item as { photos: unknown[] }).photos
      : []
    const photos = rawPhotos.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
    const gallery = locationPhotos({ photo: row.photo, photos })
    return [{ ...(row as Location), photo: gallery.includes(row.photo) ? row.photo : gallery[0], photos: gallery }]
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

async function readSha(repo: RepoRef, token: string, path: string) {
  const response = await request(
    `/repos/${repo.owner}/${repo.name}/contents/${path}?ref=${encodeURIComponent(repo.branch)}`,
    token,
  )
  if (response.status === 404) return null
  if (!response.ok) throw await readError(response)
  const body = (await response.json()) as { sha?: string }
  return body.sha ?? null
}

async function deleteContent(options: { repo: RepoRef; token: string; path: string; sha: string; message: string }) {
  const response = await request(
    `/repos/${options.repo.owner}/${options.repo.name}/contents/${options.path}`,
    options.token,
    {
      method: "DELETE",
      body: JSON.stringify({
        message: options.message,
        sha: options.sha,
        branch: options.repo.branch,
      }),
    },
  )
  if (response.status === 404) return
  if (!response.ok) throw await readError(response)
}

export async function inspectToken(repo: RepoRef, token: string) {
  const value = normalizeToken(token)
  if (!value) throw new GitHubError(401, "Вставьте токен.")
  const userResponse = await request("/user", value)
  if (userResponse.status === 401) {
    throw new GitHubError(401, "Токен не подошёл. Скопируйте его целиком, без слова Bearer.")
  }
  if (!userResponse.ok) throw await readError(userResponse)
  const user = (await userResponse.json()) as { login?: string }
  const login = user.login ?? "GitHub"
  const repoResponse = await request(`/repos/${repo.owner}/${repo.name}`, value)
  if (repoResponse.status === 404) {
    throw new GitHubError(
      404,
      `Токен аккаунта ${login} не видит ${repo.owner}/${repo.name}. В настройках токена выберите этот репозиторий.`,
    )
  }
  if (!repoResponse.ok) throw await readError(repoResponse)
  const body = (await repoResponse.json()) as { permissions?: { push?: boolean } }
  if (!body.permissions?.push) {
    throw new GitHubError(
      403,
      `Токен ${login} открывает репозиторий, но не может записывать файлы. Создайте classic token с галочкой public_repo либо в fine-grained токене поставьте Contents: Read and write для ${repo.name}.`,
    )
  }
  return `Токен ${login} может записывать в ${repo.owner}/${repo.name}.`
}

export async function fetchLocations(repo: RepoRef, token: string) {
  await ensureRepo(repo, token)
  const file = await readContent(repo, token, "data/locations.json")
  if (!file) return []
  return parseLocations(file.text)
}

async function writeLocations(
  repo: RepoRef,
  token: string,
  message: string,
  change: (list: Location[]) => Location[],
) {
  let conflict: GitHubError | null = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const file = await readContent(repo, token, "data/locations.json")
    const list = change(file ? parseLocations(file.text) : [])
    try {
      await putContent({
        repo,
        token,
        path: "data/locations.json",
        contentBase64: encodeUtf8Base64(`${JSON.stringify(list, null, 2)}\n`),
        message,
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

async function uploadImages(
  repo: RepoRef,
  token: string,
  name: string,
  images: { path: string; imageBase64: string }[],
) {
  for (const image of images) {
    await putContent({
      repo,
      token,
      path: image.path,
      contentBase64: image.imageBase64,
      message: `Добавлено фото: ${name}`,
    })
  }
}

export async function publishLocation(options: {
  repo: RepoRef
  token: string
  location: Location
  imageBase64: string
}) {
  const { repo, token, location, imageBase64 } = options
  const stored = {
    ...location,
    photos: location.photos.length > 0 ? location.photos : [location.photo],
  }
  await uploadImages(repo, token, stored.name, [{ path: stored.photo, imageBase64 }])
  await writeLocations(repo, token, `Добавлена локация: ${stored.name}`, (list) => {
    if (list.some((item) => item.id === stored.id)) return list
    return [...list, stored]
  })
}

export async function updateLocation(options: {
  repo: RepoRef
  token: string
  location: Location
  images: { path: string; imageBase64: string }[]
}) {
  const { repo, token, location, images } = options
  const photos = locationPhotos(location)
  const stored = { ...location, photo: photos[0], photos }
  await uploadImages(repo, token, stored.name, images)
  await writeLocations(repo, token, `Обновлена локация: ${stored.name}`, (list) => {
    const index = list.findIndex((item) => item.id === stored.id)
    if (index < 0) return [...list, stored]
    const next = [...list]
    next[index] = stored
    return next
  })
}

export async function deleteLocation(options: { repo: RepoRef; token: string; location: Location }) {
  const { repo, token, location } = options
  await writeLocations(repo, token, `Удалена локация: ${location.name}`, (list) =>
    list.filter((item) => item.id !== location.id),
  )
  for (const path of locationPhotos(location)) {
    const sha = await readSha(repo, token, path)
    if (!sha) continue
    await deleteContent({
      repo,
      token,
      path,
      sha,
      message: `Удалено фото: ${location.name}`,
    })
  }
}
