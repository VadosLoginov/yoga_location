import type { RepoRef } from "./types"

export const DEFAULT_REPO: RepoRef = {
  owner: "VadosLoginov",
  name: "yoga_location",
  branch: "main",
}

export const TOKEN_KEY = "yoga_location_token"
export const OWNER_KEY = "yoga_location_owner"
export const REPO_KEY = "yoga_location_repo"
export const BRANCH_KEY = "yoga_location_branch"

export function loadRepo(): RepoRef {
  return {
    owner: localStorage.getItem(OWNER_KEY) || DEFAULT_REPO.owner,
    name: localStorage.getItem(REPO_KEY) || DEFAULT_REPO.name,
    branch: localStorage.getItem(BRANCH_KEY) || DEFAULT_REPO.branch,
  }
}

export function saveRepo(repo: RepoRef) {
  localStorage.setItem(OWNER_KEY, repo.owner.trim())
  localStorage.setItem(REPO_KEY, repo.name.trim())
  localStorage.setItem(BRANCH_KEY, repo.branch.trim())
}

export function loadToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? ""
}

export function saveToken(token: string) {
  const value = token.trim()
  if (value) localStorage.setItem(TOKEN_KEY, value)
  else localStorage.removeItem(TOKEN_KEY)
}

export function mapsLink(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`
}

export function mapsEmbed(lat: number, lng: number) {
  return `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`
}

export function photoUrl(repo: RepoRef, photo: string) {
  const path = photo
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")
  return `https://raw.githubusercontent.com/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/${encodeURIComponent(repo.branch)}/${path}`
}
