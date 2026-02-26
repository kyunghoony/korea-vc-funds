import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Paging, SortDir, Vc, VcSortKey, VcStats, ViewType } from "../types";
import { DEBOUNCE_MS, DEFAULT_PAGING, MAX_SECTORS_TABLE, MAX_VC_SECTORS, VC_SIZE_OPTIONS } from "../utils/constants";
import { amountClass, formatAmount, formatJo, lifecycleClass } from "../utils/formatting";
import { navigate } from "../utils/routing";
import { vcSizeToRange } from "../utils/filters";
import { getPageNumbers } from "../utils/pagination";
import { useDebounce } from "../hooks/useDebounce";
import { useOutsideClick } from "../hooks/useOutsideClick";
import { IconSearch, IconList, IconGrid } from "../components/icons";
import { FilterDropdown } from "../components/FilterDropdown";
import { SortHeader } from "../components/SortHeader";
import { StatBar } from "../components/StatBar";
import { PaginationBar } from "../components/PaginationBar";
import { TableSkeleton, CardSkeleton } from "../components/Skeletons";
import { EmptyState, ErrorState } from "../components/EmptyState";

export function VcsPage({ params }: { params: URLSearchParams }) {
  const [list, setList] = useState<Vc[]>([]);
  const [loadingTable, setLoadingTable] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<VcStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [vcSectors, setVcSectors] = useState<string[]>([]);
  const [pagination, setPagination] = useState<Paging>({ ...DEFAULT_PAGING, page: Number(params.get("page") || 1) });
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
  const debouncedQ = useDebounce(query, DEBOUNCE_MS);

  const closeFilter = useCallback(() => setOpenFilter(null), []);
  useOutsideClick(filterRef, closeFilter);

  // Fetch stats once
  useEffect(() => {
    fetch("/api/vc-stats")
      .then((r) => r.json())
      .then((data) => {
        const payload = data.data || data;
        setStats(payload);
        if (payload.top_sectors) setVcSectors(payload.top_sectors.map((s: { sector: string }) => s.sector).slice(0, MAX_VC_SECTORS));
      })
      .catch((e) => {
        console.error("Failed to fetch VC stats:", e);
        setStats(null);
      })
      .finally(() => setStatsLoading(false));
  }, []);

  // Fetch VCs
  useEffect(() => {
    const range = filters.size?.[0] ? vcSizeToRange(filters.size[0]) : { min: undefined, max: undefined };
    const sp = new URLSearchParams({ limit: String(DEFAULT_PAGING.limit), page: String(pagination.page), sort: sortBy, order: sortDir });
    if (debouncedQ) sp.set("search", debouncedQ);
    if (filters.sector?.[0]) sp.set("sector", filters.sector[0]);
    if (range.min !== undefined) sp.set("min_aum", String(range.min));
    if (range.max !== undefined) sp.set("max_aum", String(range.max));

    setLoadingTable(true);
    setError(null);
    fetch(`/api/vcs?${sp.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        const payload = data.data || data;
        setList(payload.vcs || []);
        setPagination((prev) => ({ ...prev, total: payload.total || 0, pages: payload.pages || 1 }));
      })
      .catch((e) => {
        console.error("Failed to fetch VCs:", e);
        setError("VC 데이터를 불러오는 데 실패했습니다");
        setList([]);
      })
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

  const toggleFilter = useCallback((key: string, value: string) => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    setFilters((prev) => {
      const exists = (prev[key] || []).includes(value);
      return { ...prev, [key]: exists ? [] : [value] };
    });
  }, []);

  const resetFilters = useCallback(() => {
    setQuery("");
    setPagination((prev) => ({ ...prev, page: 1 }));
    setFilters({ sector: [], size: [] });
    setError(null);
  }, []);

  const hasFilters = query || (filters.sector?.length || 0) > 0 || (filters.size?.length || 0) > 0;

  const setSort = useCallback((key: VcSortKey) => {
    setSortBy((prev) => {
      if (prev === key) {
        setSortDir((d) => d === "asc" ? "desc" : "asc");
        return prev;
      }
      setSortDir("desc");
      return key;
    });
  }, []);

  const handlePage = useCallback((p: number) => {
    setPagination((prev) => ({ ...prev, page: p }));
  }, []);

  const handleOpenSector = useCallback(() => setOpenFilter((prev) => prev === "sector" ? null : "sector"), []);
  const handleOpenSize = useCallback(() => setOpenFilter((prev) => prev === "size" ? null : "size"), []);
  const handleToggleSector = useCallback((v: string) => toggleFilter("sector", v), [toggleFilter]);
  const handleToggleSize = useCallback((v: string) => toggleFilter("size", v), [toggleFilter]);

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

  const pageNumbers = useMemo(() => getPageNumbers(pagination.page, pagination.pages), [pagination.page, pagination.pages]);

  return (
    <>
      <StatBar cards={statCards} loading={statsLoading} />
      <main className="content" id="main-content">
        <div className="toolbar" ref={filterRef}>
          <div className="search-row">
            <label htmlFor="vcs-search" className="search-icon"><IconSearch /></label>
            <input
              id="vcs-search"
              className="search-input"
              value={query}
              onChange={(e) => { setPagination((prev) => ({ ...prev, page: 1 })); setQuery(e.target.value); }}
              placeholder="VC 이름 검색..."
            />
            <span className="search-count" aria-live="polite">{pagination.total.toLocaleString()}개</span>
          </div>
          <div className="filter-row">
            <FilterDropdown
              title="섹터"
              options={vcSectors}
              selected={filters.sector || []}
              isOpen={openFilter === "sector"}
              onOpen={handleOpenSector}
              onToggle={handleToggleSector}
            />
            <FilterDropdown
              title="규모"
              options={VC_SIZE_OPTIONS}
              selected={filters.size || []}
              isOpen={openFilter === "size"}
              onOpen={handleOpenSize}
              onToggle={handleToggleSize}
            />
            <span className="filter-spacer" />
            {hasFilters ? <button className="filter-reset" onClick={resetFilters}>초기화</button> : null}
            <div className="view-toggle" role="group" aria-label="보기 방식">
              <button className={`view-btn ${view === "table" ? "active" : ""}`} onClick={() => setView("table")} aria-label="테이블 보기" aria-pressed={view === "table"}><IconList /></button>
              <button className={`view-btn ${view === "card" ? "active" : ""}`} onClick={() => setView("card")} aria-label="카드 보기" aria-pressed={view === "card"}><IconGrid /></button>
            </div>
          </div>
        </div>

        {error ? (
          <ErrorState onRetry={resetFilters} message={error} />
        ) : initialLoad ? (
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
                  <th className="no-sort" scope="col">주요 섹터</th>
                </tr>
              </thead>
              <tbody>
                {list.map((vc) => (
                  <tr
                    key={vc.name}
                    onClick={() => navigate(`/vc/${encodeURIComponent(vc.name)}`)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/vc/${encodeURIComponent(vc.name)}`); } }}
                    tabIndex={0}
                    role="link"
                    aria-label={`${vc.name} 상세보기`}
                  >
                    <td><div className="fund-name">{vc.name}</div></td>
                    <td><span className="amount amount-mid">{vc.total_funds.toLocaleString()}</span></td>
                    <td><span className={`amount ${amountClass(vc.total_aum)}`}>{formatAmount(vc.total_aum)}<span className="amount-unit">억</span></span></td>
                    <td><span className="amount amount-mid">{vc.active_funds}/{vc.total_funds}</span></td>
                    <td>
                      <div className="tag-wrap">
                        {vc.sectors.slice(0, MAX_SECTORS_TABLE).map((s) => <span key={`${vc.name}-${s}`} className="tag">{s}</span>)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationBar page={pagination.page} pages={pagination.pages} total={pagination.total} limit={pagination.limit} onPage={handlePage} />
          </div>
        ) : (
          <>
            <div className={`cards-grid ${loadingTable && !initialLoad ? "loading-overlay" : ""}`}>
              {list.map((vc) => (
                <article
                  key={vc.name}
                  className="fund-card"
                  onClick={() => navigate(`/vc/${encodeURIComponent(vc.name)}`)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/vc/${encodeURIComponent(vc.name)}`); } }}
                  tabIndex={0}
                  role="link"
                  aria-label={`${vc.name} 상세보기`}
                >
                  <div className="card-header">
                    <div>
                      <div className="card-fund-name">{vc.name}</div>
                      <div className="card-company">펀드 {vc.total_funds}개 · 활성 {vc.active_funds}개</div>
                    </div>
                  </div>
                  <div className="card-amount">{formatAmount(vc.total_aum)}<span className="unit">억</span></div>
                  <div className="card-meta">
                    {vc.sectors.slice(0, MAX_SECTORS_TABLE).map((s) => <span key={`${vc.name}-${s}`} className="tag">{s}</span>)}
                  </div>
                </article>
              ))}
            </div>
            <nav className="cards-pagination" aria-label="페이지 네비게이션">
              <span className="page-info">
                {((pagination.page - 1) * pagination.limit + 1).toLocaleString()} – {Math.min(pagination.page * pagination.limit, pagination.total).toLocaleString()} of {pagination.total.toLocaleString()}
              </span>
              <div className="page-btns">
                <button className="page-btn" disabled={pagination.page <= 1} onClick={() => handlePage(pagination.page - 1)} aria-label="이전 페이지">←</button>
                {pageNumbers.map((p, i) =>
                  p === "..." ? (
                    <span key={`e${i}`} className="page-btn" style={{ cursor: "default", borderColor: "transparent" }}>...</span>
                  ) : (
                    <button key={p} className={`page-btn ${p === pagination.page ? "active" : ""}`} onClick={() => handlePage(p as number)} aria-label={`${p} 페이지`} aria-current={p === pagination.page ? "page" : undefined}>{p}</button>
                  ),
                )}
                <button className="page-btn" disabled={pagination.page >= pagination.pages} onClick={() => handlePage(pagination.page + 1)} aria-label="다음 페이지">→</button>
              </div>
            </nav>
          </>
        )}
      </main>
    </>
  );
}
