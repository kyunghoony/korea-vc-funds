import { useEffect, useMemo, useRef, useState } from "react";

/* ─── SVG ICONS ─── */
const IconSearch = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);
const IconChevronDown = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);
const IconList = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);
const IconGrid = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
  </svg>
);
const IconDatabase = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
  </svg>
);

/* ─── TYPES ─── */
type Route =
  | { page: "funds"; params: URLSearchParams }
  | { page: "fund"; id: string }
  | { page: "vcs"; params: URLSearchParams }
  | { page: "vc"; id: string };

type ViewType = "table" | "card";
type SortDir = "asc" | "desc";
type FundSortKey = "fund_name" | "company_name" | "amount_억" | "registered_date";
type VcSortKey = "name" | "fund_count" | "total_aum" | "active_count";
type FilterKey = "stage" | "sector" | "size";

type Fund = {
  asct_id: string;
  fund_name: string;
  company_name: string;
  amount_억: number;
  registered_date?: string;
  lifecycle?: string;
  sector_tags?: string[];
};

type FundStats = { total_funds: number; active_funds: number; active_aum: number; total_vcs: number };
type Vc = { name: string; total_funds: number; active_funds: number; total_aum: number; sectors: string[] };
type VcStats = { total_vcs: number; active_vcs: number; total_aum: number; avg_aum_per_vc: number; top_sectors?: { sector: string }[] };
type Paging = { total: number; page: number; pages: number; limit: number };

/* ─── CONSTANTS ─── */
const STAGE_OPTIONS = ["적극투자기", "중기", "후기/회수기"];
const FUND_SIZE_OPTIONS = ["~100억", "100~500억", "500~1000억", "1000억~"];
const VC_SIZE_OPTIONS = ["~500억", "500~2000억", "2000억~"];

const NAV_ITEMS = [
  { label: "Funds", hash: "/", page: "funds" },
  { label: "VCs", hash: "/vcs", page: "vcs" },
] as const;

/* ─── UTILITIES ─── */
function parseRoute(): Route {
  const hash = window.location.hash || "#/";
  const [pathPart, query = ""] = hash.replace(/^#/, "").split("?");
  const parts = pathPart.split("/").filter(Boolean);
  if (parts[0] === "fund" && parts[1]) return { page: "fund", id: decodeURIComponent(parts[1]) };
  if (parts[0] === "vcs") return { page: "vcs", params: new URLSearchParams(query) };
  if (parts[0] === "vc" && parts[1]) return { page: "vc", id: decodeURIComponent(parts[1]) };
  return { page: "funds", params: new URLSearchParams(query) };
}

function navigate(path: string) { window.location.hash = path; }

function useDebounce<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

function formatAmount(value?: number) {
  if (value === undefined || value === null) return "-";
  return value.toLocaleString();
}

function formatDate(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatJo(억: number) {
  const jo = 억 / 10000;
  if (jo >= 1) return { value: jo.toFixed(1), unit: "조원" };
  return { value: 억.toLocaleString(), unit: "억" };
}

function amountClass(value?: number) {
  if (!value) return "amount-low";
  if (value >= 3000) return "amount-high";
  if (value >= 1000) return "amount-mid";
  return "amount-low";
}

function lifecycleClass(lifecycle?: string) {
  if (lifecycle === "적극투자기") return "lifecycle-active";
  if (lifecycle === "중기") return "lifecycle-mid";
  return "lifecycle-late";
}

function fundSizeToRange(size: string) {
  if (size === "~100억") return { min: undefined, max: 100 };
  if (size === "100~500억") return { min: 100, max: 500 };
  if (size === "500~1000억") return { min: 500, max: 1000 };
  if (size === "1000억~") return { min: 1000, max: undefined };
  return { min: undefined, max: undefined };
}

function vcSizeToRange(size: string) {
  if (size === "~500억") return { min: undefined, max: 500 };
  if (size === "500~2000억") return { min: 500, max: 2000 };
  if (size === "2000억~") return { min: 2000, max: undefined };
  return { min: undefined, max: undefined };
}

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2) pages.push("...");
  if (total > 1) pages.push(total);
  return pages;
}

/* ─── APP ─── */
function App() {
  const [route, setRoute] = useState<Route>(parseRoute());

  useEffect(() => {
    const onChange = () => setRoute(parseRoute());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return (
    <div className="app">
      <nav className="main-nav">
        <div className="nav-inner">
          <button className="nav-logo" onClick={() => navigate("/")}>
            <span className="dot" />
            Korea VC Funds
          </button>
          <div className="nav-tabs">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.label}
                className={`nav-tab ${route.page === item.page || (route.page === "fund" && item.page === "funds") || (route.page === "vc" && item.page === "vcs") ? "active" : ""}`}
                onClick={() => navigate(item.hash)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {route.page === "funds" && <FundsPage params={route.params} />}
      {route.page === "fund" && <FundDetailPage id={route.id} />}
      {route.page === "vcs" && <VcsPage params={route.params} />}
      {route.page === "vc" && <VcDetailPage id={route.id} />}
    </div>
  );
}

/* ─── FUNDS PAGE ─── */
function FundsPage({ params }: { params: URLSearchParams }) {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loadingTable, setLoadingTable] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [stats, setStats] = useState<FundStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [pagination, setPagination] = useState<Paging>({ total: 0, page: Number(params.get("page") || 1), pages: 1, limit: 50 });
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [view, setView] = useState<ViewType>((params.get("view") as ViewType) || "table");
  const [sortBy, setSortBy] = useState<FundSortKey>((params.get("sortBy") as FundSortKey) || "amount_억");
  const [sortDir, setSortDir] = useState<SortDir>((params.get("sortDir") as SortDir) || "desc");
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [sectors, setSectors] = useState<string[]>([]);
  const [filters, setFilters] = useState<Record<FilterKey, string[]>>({
    stage: params.getAll("stage"),
    sector: params.getAll("sector"),
    size: params.getAll("size"),
  });

  const filterRef = useRef<HTMLDivElement>(null);
  const debouncedQ = useDebounce(query, 300);

  // Fetch stats + sectors once
  useEffect(() => {
    fetch("/api/fund-stats")
      .then((r) => r.json())
      .then((data) => setStats(data.overview || data))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));

    fetch("/api/funds?type=sectors")
      .then((r) => r.json())
      .then((data) => setSectors((data.sectors || []).slice(0, 40)))
      .catch(() => setSectors([]));
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setOpenFilter(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch funds
  useEffect(() => {
    const sortMap: Record<FundSortKey, string> = {
      fund_name: `fund_name_${sortDir}`,
      company_name: `company_${sortDir}`,
      amount_억: `amount_${sortDir}`,
      registered_date: `registered_${sortDir}`,
    };

    const range = filters.size[0] ? fundSizeToRange(filters.size[0]) : { min: undefined, max: undefined };
    const sp = new URLSearchParams();
    sp.set("limit", "50");
    sp.set("page", String(pagination.page));
    sp.set("sort", sortMap[sortBy]);
    if (debouncedQ.trim()) sp.set("search", debouncedQ.trim());
    if (filters.stage[0]) sp.set("lifecycle", filters.stage[0]);
    if (filters.sector[0]) sp.set("sector", filters.sector[0]);
    if (range.min !== undefined) sp.set("min_amount", String(range.min));
    if (range.max !== undefined) sp.set("max_amount", String(range.max));

    setLoadingTable(true);
    fetch(`/api/funds?${sp.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setFunds(data.funds || []);
        setPagination(data.pagination || { total: 0, page: 1, pages: 1, limit: 50 });
      })
      .catch(() => {
        setFunds([]);
        setPagination({ total: 0, page: 1, pages: 1, limit: 50 });
      })
      .finally(() => { setLoadingTable(false); setInitialLoad(false); });
  }, [debouncedQ, filters, sortBy, sortDir, pagination.page]);

  // Sync URL
  useEffect(() => {
    const sp = new URLSearchParams();
    if (query) sp.set("q", query);
    if (view !== "table") sp.set("view", view);
    sp.set("sortBy", sortBy);
    sp.set("sortDir", sortDir);
    sp.set("page", String(pagination.page));
    (Object.keys(filters) as FilterKey[]).forEach((key) =>
      filters[key].forEach((value) => sp.append(key, value)),
    );
    navigate(`/?${sp.toString()}`);
  }, [query, view, sortBy, sortDir, pagination.page, filters]);

  const toggleFilter = (key: FilterKey, value: string) => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    setFilters((prev) => {
      const exists = prev[key].includes(value);
      return { ...prev, [key]: exists ? prev[key].filter((v) => v !== value) : [...prev[key], value] };
    });
  };

  const resetFilters = () => {
    setQuery("");
    setPagination((prev) => ({ ...prev, page: 1 }));
    setFilters({ stage: [], sector: [], size: [] });
  };

  const hasFilters = query || filters.stage.length || filters.sector.length || filters.size.length;

  const statCards = useMemo(() => {
    if (!stats) return null;
    const aum = formatJo(stats.active_aum || 0);
    return [
      { label: "Total Funds", value: stats.total_funds?.toLocaleString() || "0", unit: "" },
      { label: "Active Funds", value: stats.active_funds?.toLocaleString() || "0", unit: "" },
      { label: "총 운용규모", value: aum.value, unit: aum.unit },
      { label: "VC사", value: stats.total_vcs?.toLocaleString() || "0", unit: "" },
    ];
  }, [stats]);

  const setSort = (key: FundSortKey) => {
    if (sortBy === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortBy(key); setSortDir("desc"); }
  };

  return (
    <>
      <StatBar cards={statCards} loading={statsLoading} />
      <div className="content">
        <div className="toolbar" ref={filterRef}>
          <div className="search-row">
            <span className="search-icon"><IconSearch /></span>
            <input
              className="search-input"
              value={query}
              onChange={(e) => { setPagination((prev) => ({ ...prev, page: 1 })); setQuery(e.target.value); }}
              placeholder="펀드명, VC명, 키워드 검색..."
            />
            <span className="search-count">{pagination.total.toLocaleString()}개</span>
          </div>
          <div className="filter-row">
            <FilterDropdown
              title="투자단계"
              options={STAGE_OPTIONS}
              selected={filters.stage}
              isOpen={openFilter === "stage"}
              onOpen={() => setOpenFilter(openFilter === "stage" ? null : "stage")}
              onToggle={(v) => toggleFilter("stage", v)}
            />
            <FilterDropdown
              title="섹터"
              options={sectors}
              selected={filters.sector}
              isOpen={openFilter === "sector"}
              onOpen={() => setOpenFilter(openFilter === "sector" ? null : "sector")}
              onToggle={(v) => toggleFilter("sector", v)}
            />
            <FilterDropdown
              title="규모"
              options={FUND_SIZE_OPTIONS}
              selected={filters.size}
              isOpen={openFilter === "size"}
              onOpen={() => setOpenFilter(openFilter === "size" ? null : "size")}
              onToggle={(v) => toggleFilter("size", v)}
            />
            <span className="filter-spacer" />
            {hasFilters ? <button className="filter-reset" onClick={resetFilters}>초기화</button> : null}
            <div className="view-toggle">
              <button className={`view-btn ${view === "table" ? "active" : ""}`} onClick={() => setView("table")}><IconList /></button>
              <button className={`view-btn ${view === "card" ? "active" : ""}`} onClick={() => setView("card")}><IconGrid /></button>
            </div>
          </div>
        </div>

        {initialLoad ? (
          view === "table" ? <TableSkeleton /> : <CardSkeleton />
        ) : funds.length === 0 ? (
          <EmptyState onReset={resetFilters} />
        ) : view === "table" ? (
          <div className={`table-wrap ${loadingTable && !initialLoad ? "loading-overlay" : ""}`}>
            <table className="funds-table">
              <thead>
                <tr>
                  <SortHeader label="펀드명" active={sortBy === "fund_name"} dir={sortDir} onClick={() => setSort("fund_name")} />
                  <SortHeader label="운용사" active={sortBy === "company_name"} dir={sortDir} onClick={() => setSort("company_name")} />
                  <SortHeader label="규모" active={sortBy === "amount_억"} dir={sortDir} onClick={() => setSort("amount_억")} />
                  <th className="no-sort">섹터</th>
                  <SortHeader label="설립일" active={sortBy === "registered_date"} dir={sortDir} onClick={() => setSort("registered_date")} />
                  <th className="no-sort">상태</th>
                </tr>
              </thead>
              <tbody>
                {funds.map((fund) => (
                  <tr key={fund.asct_id} onClick={() => navigate(`/fund/${encodeURIComponent(fund.asct_id)}`)}>
                    <td><div className="fund-name">{fund.fund_name}</div></td>
                    <td><span className="company-name">{fund.company_name}</span></td>
                    <td><span className={`amount ${amountClass(fund.amount_억)}`}>{formatAmount(fund.amount_억)}<span className="amount-unit">억</span></span></td>
                    <td>
                      <div className="tag-wrap">
                        {(fund.sector_tags || []).slice(0, 2).map((tag) => <span key={tag} className="tag">{tag}</span>)}
                      </div>
                    </td>
                    <td><span className="date">{formatDate(fund.registered_date)}</span></td>
                    <td><span className={`lifecycle-badge ${lifecycleClass(fund.lifecycle)}`}>{fund.lifecycle || "-"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationBar page={pagination.page} pages={pagination.pages} total={pagination.total} limit={pagination.limit} onPage={(p) => setPagination((prev) => ({ ...prev, page: p }))} />
          </div>
        ) : (
          <>
            <div className={`cards-grid ${loadingTable && !initialLoad ? "loading-overlay" : ""}`}>
              {funds.map((fund) => (
                <article key={fund.asct_id} className="fund-card" onClick={() => navigate(`/fund/${encodeURIComponent(fund.asct_id)}`)}>
                  <div className="card-header">
                    <div>
                      <div className="card-fund-name">{fund.fund_name}</div>
                      <div className="card-company">{fund.company_name}</div>
                    </div>
                    <span className={`lifecycle-badge ${lifecycleClass(fund.lifecycle)}`}>{fund.lifecycle || "-"}</span>
                  </div>
                  <div className="card-amount">{formatAmount(fund.amount_억)}<span className="unit">억</span></div>
                  <div className="card-meta">
                    {(fund.sector_tags || []).slice(0, 3).map((tag) => <span key={tag} className="tag">{tag}</span>)}
                  </div>
                </article>
              ))}
            </div>
            <div className="cards-pagination">
              <span className="page-info">
                {((pagination.page - 1) * pagination.limit + 1).toLocaleString()} – {Math.min(pagination.page * pagination.limit, pagination.total).toLocaleString()} of {pagination.total.toLocaleString()}
              </span>
              <div className="page-btns">
                <button className="page-btn" disabled={pagination.page <= 1} onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}>←</button>
                {getPageNumbers(pagination.page, pagination.pages).map((p, i) =>
                  p === "..." ? (
                    <span key={`e${i}`} className="page-btn" style={{ cursor: "default", borderColor: "transparent" }}>...</span>
                  ) : (
                    <button key={p} className={`page-btn ${p === pagination.page ? "active" : ""}`} onClick={() => setPagination((prev) => ({ ...prev, page: p as number }))}>{p}</button>
                  ),
                )}
                <button className="page-btn" disabled={pagination.page >= pagination.pages} onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}>→</button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* ─── VCS PAGE ─── */
function VcsPage({ params }: { params: URLSearchParams }) {
  const [list, setList] = useState<Vc[]>([]);
  const [loadingTable, setLoadingTable] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [stats, setStats] = useState<VcStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [vcSectors, setVcSectors] = useState<string[]>([]);
  const [pagination, setPagination] = useState<Paging>({ total: 0, page: Number(params.get("page") || 1), pages: 1, limit: 50 });
  const [query, setQuery] = useState(params.get("q") || "");
  const [view, setView] = useState<ViewType>((params.get("view") as ViewType) || "table");
  const [sortBy, setSortBy] = useState<VcSortKey>("total_aum");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, string[]>>({
    sector: params.getAll("sector"),
    size: params.getAll("size"),
  });

  const filterRef = useRef<HTMLDivElement>(null);
  const debouncedQ = useDebounce(query, 300);

  // Fetch stats once
  useEffect(() => {
    fetch("/api/vc-stats")
      .then((r) => r.json())
      .then((data) => {
        const payload = data.data || data;
        setStats(payload);
        if (payload.top_sectors) setVcSectors(payload.top_sectors.map((s: { sector: string }) => s.sector).slice(0, 30));
      })
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setOpenFilter(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch VCs
  useEffect(() => {
    const range = filters.size?.[0] ? vcSizeToRange(filters.size[0]) : { min: undefined, max: undefined };
    const sp = new URLSearchParams({ limit: "50", page: String(pagination.page), sort: sortBy, order: sortDir });
    if (debouncedQ) sp.set("search", debouncedQ);
    if (filters.sector?.[0]) sp.set("sector", filters.sector[0]);
    if (range.min !== undefined) sp.set("min_aum", String(range.min));
    if (range.max !== undefined) sp.set("max_aum", String(range.max));

    setLoadingTable(true);
    fetch(`/api/vcs?${sp.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        const payload = data.data || data;
        setList(payload.vcs || []);
        setPagination((prev) => ({ ...prev, total: payload.total || 0, pages: payload.pages || 1 }));
      })
      .catch(() => setList([]))
      .finally(() => { setLoadingTable(false); setInitialLoad(false); });
  }, [debouncedQ, filters, sortBy, sortDir, pagination.page]);

  // Sync URL
  useEffect(() => {
    const sp = new URLSearchParams();
    if (query) sp.set("q", query);
    if (view !== "table") sp.set("view", view);
    sp.set("page", String(pagination.page));
    Object.entries(filters).forEach(([key, vals]) => vals.forEach((v) => sp.append(key, v)));
    navigate(`/vcs?${sp.toString()}`);
  }, [query, view, pagination.page, filters]);

  const toggleFilter = (key: string, value: string) => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    setFilters((prev) => {
      const exists = (prev[key] || []).includes(value);
      return { ...prev, [key]: exists ? prev[key].filter((v) => v !== value) : [...(prev[key] || []), value] };
    });
  };

  const resetFilters = () => {
    setQuery("");
    setPagination((prev) => ({ ...prev, page: 1 }));
    setFilters({ sector: [], size: [] });
  };

  const hasFilters = query || (filters.sector?.length || 0) > 0 || (filters.size?.length || 0) > 0;

  const setSort = (key: VcSortKey) => {
    if (sortBy === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortBy(key); setSortDir("desc"); }
  };

  const statCards = useMemo(() => {
    if (!stats) return null;
    const aum = formatJo(stats.total_aum || 0);
    return [
      { label: "총 VC사", value: stats.total_vcs?.toLocaleString() || "0", unit: "" },
      { label: "활성 VC사", value: stats.active_vcs?.toLocaleString() || "0", unit: "" },
      { label: "총 운용총액", value: aum.value, unit: aum.unit },
      { label: "평균 AUM/VC", value: formatAmount(stats.avg_aum_per_vc), unit: "억" },
    ];
  }, [stats]);

  return (
    <>
      <StatBar cards={statCards} loading={statsLoading} />
      <div className="content">
        <div className="toolbar" ref={filterRef}>
          <div className="search-row">
            <span className="search-icon"><IconSearch /></span>
            <input
              className="search-input"
              value={query}
              onChange={(e) => { setPagination((prev) => ({ ...prev, page: 1 })); setQuery(e.target.value); }}
              placeholder="VC 이름 검색..."
            />
            <span className="search-count">{pagination.total.toLocaleString()}개</span>
          </div>
          <div className="filter-row">
            <FilterDropdown
              title="섹터"
              options={vcSectors}
              selected={filters.sector || []}
              isOpen={openFilter === "sector"}
              onOpen={() => setOpenFilter(openFilter === "sector" ? null : "sector")}
              onToggle={(v) => toggleFilter("sector", v)}
            />
            <FilterDropdown
              title="규모"
              options={VC_SIZE_OPTIONS}
              selected={filters.size || []}
              isOpen={openFilter === "size"}
              onOpen={() => setOpenFilter(openFilter === "size" ? null : "size")}
              onToggle={(v) => toggleFilter("size", v)}
            />
            <span className="filter-spacer" />
            {hasFilters ? <button className="filter-reset" onClick={resetFilters}>초기화</button> : null}
            <div className="view-toggle">
              <button className={`view-btn ${view === "table" ? "active" : ""}`} onClick={() => setView("table")}><IconList /></button>
              <button className={`view-btn ${view === "card" ? "active" : ""}`} onClick={() => setView("card")}><IconGrid /></button>
            </div>
          </div>
        </div>

        {initialLoad ? (
          view === "table" ? <TableSkeleton /> : <CardSkeleton />
        ) : list.length === 0 ? (
          <EmptyState onReset={resetFilters} />
        ) : view === "table" ? (
          <div className={`table-wrap ${loadingTable && !initialLoad ? "loading-overlay" : ""}`}>
            <table className="vcs-table">
              <thead>
                <tr>
                  <SortHeader label="VC명" active={sortBy === "name"} dir={sortDir} onClick={() => setSort("name")} />
                  <SortHeader label="펀드 수" active={sortBy === "fund_count"} dir={sortDir} onClick={() => setSort("fund_count")} />
                  <SortHeader label="총 AUM" active={sortBy === "total_aum"} dir={sortDir} onClick={() => setSort("total_aum")} />
                  <SortHeader label="활성 펀드" active={sortBy === "active_count"} dir={sortDir} onClick={() => setSort("active_count")} />
                  <th className="no-sort">주요 섹터</th>
                </tr>
              </thead>
              <tbody>
                {list.map((vc) => (
                  <tr key={vc.name} onClick={() => navigate(`/vc/${encodeURIComponent(vc.name)}`)}>
                    <td><div className="fund-name">{vc.name}</div></td>
                    <td><span className="amount amount-mid">{vc.total_funds.toLocaleString()}</span></td>
                    <td><span className={`amount ${amountClass(vc.total_aum)}`}>{formatAmount(vc.total_aum)}<span className="amount-unit">억</span></span></td>
                    <td><span className="amount amount-mid">{vc.active_funds}/{vc.total_funds}</span></td>
                    <td>
                      <div className="tag-wrap">
                        {vc.sectors.slice(0, 3).map((s) => <span key={s} className="tag">{s}</span>)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationBar page={pagination.page} pages={pagination.pages} total={pagination.total} limit={pagination.limit} onPage={(p) => setPagination((prev) => ({ ...prev, page: p }))} />
          </div>
        ) : (
          <>
            <div className={`cards-grid ${loadingTable && !initialLoad ? "loading-overlay" : ""}`}>
              {list.map((vc) => (
                <article key={vc.name} className="fund-card" onClick={() => navigate(`/vc/${encodeURIComponent(vc.name)}`)}>
                  <div className="card-header">
                    <div>
                      <div className="card-fund-name">{vc.name}</div>
                      <div className="card-company">펀드 {vc.total_funds}개 · 활성 {vc.active_funds}개</div>
                    </div>
                  </div>
                  <div className="card-amount">{formatAmount(vc.total_aum)}<span className="unit">억</span></div>
                  <div className="card-meta">
                    {vc.sectors.slice(0, 3).map((s) => <span key={s} className="tag">{s}</span>)}
                  </div>
                </article>
              ))}
            </div>
            <div className="cards-pagination">
              <span className="page-info">
                {((pagination.page - 1) * pagination.limit + 1).toLocaleString()} – {Math.min(pagination.page * pagination.limit, pagination.total).toLocaleString()} of {pagination.total.toLocaleString()}
              </span>
              <div className="page-btns">
                <button className="page-btn" disabled={pagination.page <= 1} onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}>←</button>
                {getPageNumbers(pagination.page, pagination.pages).map((p, i) =>
                  p === "..." ? (
                    <span key={`e${i}`} className="page-btn" style={{ cursor: "default", borderColor: "transparent" }}>...</span>
                  ) : (
                    <button key={p} className={`page-btn ${p === pagination.page ? "active" : ""}`} onClick={() => setPagination((prev) => ({ ...prev, page: p as number }))}>{p}</button>
                  ),
                )}
                <button className="page-btn" disabled={pagination.page >= pagination.pages} onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}>→</button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* ─── FUND DETAIL PAGE ─── */
function FundDetailPage({ id }: { id: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/fund-detail?id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((result) => setData(result))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="content" style={{ marginTop: 24 }}>
      <TableSkeleton />
    </div>
  );

  if (!data?.fund) return (
    <div className="content" style={{ marginTop: 24 }}>
      <button className="back-btn" onClick={() => navigate("/")}>← 펀드 목록</button>
      <EmptyState onReset={() => navigate("/")} />
    </div>
  );

  const fund = data.fund;

  return (
    <div className="content" style={{ marginTop: 24 }}>
      <button className="back-btn" onClick={() => navigate("/")}>← 펀드 목록</button>

      <div className="detail-layout">
        <div className="detail-card">
          <h1>{fund.fund_name}</h1>
          <div className="detail-company">{fund.company_name}</div>
          <div className="detail-row">
            <span className="label">규모</span>
            <span className={`value amount ${amountClass(fund.amount_억)}`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {formatAmount(fund.amount_억)}억
            </span>
          </div>
          <div className="detail-row">
            <span className="label">설립일</span>
            <span className="value mono">{formatDate(fund.registered_date)}</span>
          </div>
          <div className="detail-row">
            <span className="label">만기일</span>
            <span className="value mono">{formatDate(fund.maturity_date)}</span>
          </div>
          {fund.fund_manager_name && (
            <div className="detail-row">
              <span className="label">펀드매니저</span>
              <span className="value">{fund.fund_manager_name}</span>
            </div>
          )}
        </div>

        <div className="detail-card">
          <div className="detail-row">
            <span className="label">상태</span>
            <span className={`lifecycle-badge ${lifecycleClass(fund.lifecycle)}`}>{fund.lifecycle || "-"}</span>
          </div>
          <div className="detail-row" style={{ flexDirection: "column", gap: 8 }}>
            <span className="label">섹터</span>
            <div className="tag-wrap">
              {(fund.sector_tags || []).map((tag: string) => <span key={tag} className="tag">{tag}</span>)}
            </div>
          </div>
          <div className="detail-row">
            <span className="label">정부매칭</span>
            <span className="value">{fund.is_govt_matched ? "예" : "아니오"}</span>
          </div>
          {fund.account_type && (
            <div className="detail-row">
              <span className="label">계정유형</span>
              <span className="value">{fund.account_type}</span>
            </div>
          )}
        </div>
      </div>

      {data.relatedFunds?.length > 0 && (
        <>
          <div className="detail-section-title" style={{ marginBottom: 12 }}>같은 운용사 펀드</div>
          <div className="table-wrap">
            <table className="funds-table">
              <thead>
                <tr>
                  <th className="no-sort">펀드명</th>
                  <th className="no-sort">규모</th>
                  <th className="no-sort">설립일</th>
                  <th className="no-sort">상태</th>
                </tr>
              </thead>
              <tbody>
                {data.relatedFunds.map((rf: any) => (
                  <tr key={rf.asct_id} onClick={() => navigate(`/fund/${encodeURIComponent(rf.asct_id)}`)}>
                    <td><div className="fund-name">{rf.fund_name}</div></td>
                    <td><span className={`amount ${amountClass(rf.amount_억)}`}>{formatAmount(rf.amount_억)}<span className="amount-unit">억</span></span></td>
                    <td><span className="date">{formatDate(rf.registered_date)}</span></td>
                    <td><span className={`lifecycle-badge ${lifecycleClass(rf.lifecycle)}`}>{rf.lifecycle || "-"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── VC DETAIL PAGE ─── */
function VcDetailPage({ id }: { id: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/vc-detail?name=${encodeURIComponent(id)}&format=stats`)
      .then((r) => r.json())
      .then((result) => setData(result.data || result))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="content" style={{ marginTop: 24 }}>
      <TableSkeleton />
    </div>
  );

  if (!data) return (
    <div className="content" style={{ marginTop: 24 }}>
      <button className="back-btn" onClick={() => navigate("/vcs")}>← VC 목록</button>
      <EmptyState onReset={() => navigate("/vcs")} />
    </div>
  );

  return (
    <div className="content" style={{ marginTop: 24 }}>
      <button className="back-btn" onClick={() => navigate("/vcs")}>← VC 목록</button>

      <div className="vc-header-card">
        <h1>{data.name}</h1>
        <div className="vc-stats-row">
          <div className="vc-stat-item">
            <div className="vc-stat-label">총 AUM</div>
            <div className="vc-stat-value">{formatAmount(data.total_aum)}<span className="stat-unit">억</span></div>
          </div>
          <div className="vc-stat-item">
            <div className="vc-stat-label">펀드 수</div>
            <div className="vc-stat-value">{data.total_funds}</div>
          </div>
          <div className="vc-stat-item">
            <div className="vc-stat-label">활성 펀드</div>
            <div className="vc-stat-value">{data.active_funds}</div>
          </div>
        </div>
      </div>

      {(data.funds || []).length > 0 && (
        <div className="table-wrap">
          <table className="funds-table">
            <thead>
              <tr>
                <th className="no-sort">펀드명</th>
                <th className="no-sort">규모</th>
                <th className="no-sort">결성일</th>
                <th className="no-sort">상태</th>
              </tr>
            </thead>
            <tbody>
              {(data.funds || []).map((fund: any) => (
                <tr key={fund.id} onClick={() => navigate(`/fund/${encodeURIComponent(fund.id)}`)}>
                  <td><div className="fund-name">{fund.fund_name}</div></td>
                  <td><span className={`amount ${amountClass(fund.total_amount)}`}>{formatAmount(fund.total_amount)}<span className="amount-unit">억</span></span></td>
                  <td><span className="date">{formatDate(fund.formation_date)}</span></td>
                  <td><span className={`lifecycle-badge ${lifecycleClass(fund.lifecycle)}`}>{fund.lifecycle || "-"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── SHARED: SORT HEADER ─── */
function SortHeader({ label, active, dir, onClick }: { label: string; active: boolean; dir: SortDir; onClick: () => void }) {
  return (
    <th className={active ? "sorted" : ""} onClick={onClick}>
      {label} <span className="sort-arrow">{active ? (dir === "asc" ? "↑" : "↓") : "↕"}</span>
    </th>
  );
}

/* ─── SHARED: FILTER DROPDOWN ─── */
function FilterDropdown({
  title, options, selected, isOpen, onOpen, onToggle,
}: {
  title: string; options: string[]; selected: string[]; isOpen: boolean; onOpen: () => void; onToggle: (value: string) => void;
}) {
  return (
    <div className="filter-group">
      <button className={`filter-btn ${selected.length ? "has-selection" : ""}`} onClick={onOpen}>
        <span>{title}{selected.length > 0 ? ` (${selected.length})` : ""}</span>
        <IconChevronDown />
      </button>
      {isOpen && (
        <div className="filter-dropdown">
          {options.length === 0 ? (
            <span style={{ color: "var(--text-muted)", fontSize: 12, padding: 8 }}>옵션 없음</span>
          ) : (
            options.map((opt) => (
              <button key={opt} className={`filter-chip ${selected.includes(opt) ? "selected" : ""}`} onClick={() => onToggle(opt)}>
                {opt}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ─── SHARED: PAGINATION BAR (inside table) ─── */
function PaginationBar({ page, pages, total, limit, onPage }: { page: number; pages: number; total: number; limit: number; onPage: (p: number) => void }) {
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="pagination">
      <span className="page-info">{start.toLocaleString()} – {end.toLocaleString()} of {total.toLocaleString()}</span>
      <div className="page-btns">
        <button className="page-btn" disabled={page <= 1} onClick={() => onPage(page - 1)}>←</button>
        {getPageNumbers(page, pages).map((p, i) =>
          p === "..." ? (
            <span key={`e${i}`} className="page-btn" style={{ cursor: "default", borderColor: "transparent" }}>...</span>
          ) : (
            <button key={p} className={`page-btn ${p === page ? "active" : ""}`} onClick={() => onPage(p as number)}>{p}</button>
          ),
        )}
        <button className="page-btn" disabled={page >= pages} onClick={() => onPage(page + 1)}>→</button>
      </div>
    </div>
  );
}

/* ─── SHARED: STAT BAR ─── */
function StatBar({ cards, loading }: { cards: { label: string; value: string; unit: string }[] | null; loading: boolean }) {
  return (
    <div className="stats-bar">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="stat-card">
          <div className="stat-label">{cards?.[i]?.label || "\u00A0"}</div>
          {loading ? (
            <div className="skeleton skeleton-stat" />
          ) : (
            <div className="stat-value">
              {cards?.[i]?.value || "-"}
              {cards?.[i]?.unit ? <span className="stat-unit">{cards[i].unit}</span> : null}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── SHARED: SKELETONS ─── */
function TableSkeleton() {
  return (
    <div className="table-wrap">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="skeleton skeleton-row" />
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="cards-grid">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton skeleton-card" />
      ))}
    </div>
  );
}

/* ─── SHARED: EMPTY STATE ─── */
function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><IconDatabase /></div>
      <div className="empty-title">검색 결과가 없습니다</div>
      <div className="empty-desc">다른 검색어나 필터를 시도해보세요</div>
      <button className="empty-reset" onClick={onReset}>초기화</button>
    </div>
  );
}

export default App;
