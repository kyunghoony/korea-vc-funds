/* ─── DISPLAY LIMITS ─── */
export const MAX_TAGS_TABLE = 2;
export const MAX_TAGS_CARD = 3;
export const MAX_SECTORS_TABLE = 3;
export const MAX_FUND_SECTORS = 40;
export const MAX_VC_SECTORS = 30;

/* ─── PAGINATION ─── */
export const ITEMS_PER_PAGE = 50;
export const DEFAULT_PAGING = { total: 0, page: 1, pages: 1, limit: ITEMS_PER_PAGE } as const;

/* ─── TIMING ─── */
export const DEBOUNCE_MS = 300;

/* ─── FILTER OPTIONS ─── */
export const STAGE_OPTIONS = ["적극투자기", "중기", "후기/회수기"];
export const FUND_SIZE_OPTIONS = ["~100억", "100~500억", "500~1000억", "1000억~"];
export const VC_SIZE_OPTIONS = ["~500억", "500~2000억", "2000억~"];

/* ─── NAV ─── */
export const NAV_ITEMS = [
  { label: "Funds", hash: "/", page: "funds" },
  { label: "VCs", hash: "/vcs", page: "vcs" },
] as const;
