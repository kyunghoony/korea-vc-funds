import type { Route } from "../types";

export function parseRoute(): Route {
  const hash = window.location.hash || "#/";
  const [pathPart, query = ""] = hash.replace(/^#/, "").split("?");
  const parts = pathPart.split("/").filter(Boolean);
  if (parts[0] === "fund" && parts[1]) return { page: "fund", id: decodeURIComponent(parts[1]) };
  if (parts[0] === "vcs") return { page: "vcs", params: new URLSearchParams(query) };
  if (parts[0] === "vc" && parts[1]) return { page: "vc", id: decodeURIComponent(parts[1]) };
  return { page: "funds", params: new URLSearchParams(query) };
}

export function navigate(path: string) {
  window.location.hash = path;
}
