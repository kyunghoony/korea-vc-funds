export function fundSizeToRange(size: string) {
  if (size === "~100억") return { min: undefined, max: 100 };
  if (size === "100~500억") return { min: 100, max: 500 };
  if (size === "500~1000억") return { min: 500, max: 1000 };
  if (size === "1000억~") return { min: 1000, max: undefined };
  return { min: undefined, max: undefined };
}

export function vcSizeToRange(size: string) {
  if (size === "~500억") return { min: undefined, max: 500 };
  if (size === "500~2000억") return { min: 500, max: 2000 };
  if (size === "2000억~") return { min: 2000, max: undefined };
  return { min: undefined, max: undefined };
}
