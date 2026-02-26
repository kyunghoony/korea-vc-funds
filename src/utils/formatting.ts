export function formatAmount(value?: number) {
  if (value === undefined || value === null) return "-";
  return value.toLocaleString();
}

export function formatDate(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatJo(억: number) {
  const jo = 억 / 10000;
  if (jo >= 1) return { value: jo.toFixed(1), unit: "조원" };
  return { value: 억.toLocaleString(), unit: "억" };
}

export function amountClass(value?: number) {
  if (!value) return "amount-low";
  if (value >= 3000) return "amount-high";
  if (value >= 1000) return "amount-mid";
  return "amount-low";
}

export function lifecycleClass(lifecycle?: string) {
  if (lifecycle === "적극투자기") return "lifecycle-active";
  if (lifecycle === "중기") return "lifecycle-mid";
  return "lifecycle-late";
}
