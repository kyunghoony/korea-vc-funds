import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FilterKey, Fund, FundSortKey, FundStats, Paging, SortDir, ViewType } from "../types";
import { DEBOUNCE_MS, DEFAULT_PAGING, FUND_SIZE_OPTIONS, MAX_FUND_SECTORS, MAX_TAGS_CARD, MAX_TAGS_TABLE, STAGE_OPTIONS } from "../utils/constants";
import { amountClass, formatAmount, formatDate, formatJo, lifecycleClass } from "../utils/formatting";
import { navigate } from "../utils/routing";
import { fundSizeToRange } from "../utils/filters";
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

export function FundsPage({ params }: { params: URLSearchParams }) {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loadingTable, setLoadingTable] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<FundStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [pagination, setPagination] = useState<Paging>({ ...DEFAULT_PAGING, page: Number(params.get("page") || 1) });
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
  const debouncedQ = useDebounce(query, DEBOUNCE_MS);

  const closeFilter = useCallback(() => setOpenFilter(null), []);
  useOutsideClick(filterRef, closeFilter);

  // Fetch stats + sectors once
  useEffect(() => {
    fetch("/api/fund-stats")
      .then((r) => r.json())
      .then((data) => setStats(data.overview || data))
      .catch((e) => {
        console.error("Failed to fetch fund stats:", e);
        setStats(null);
      })
      .finally(() => setStatsLoading(false));

    fetch("/api/funds?type=sectors")
      .then((r) => r.json())
      .then((data) => setSectors((data.sectors || []).map((s: { sector: string } | string) => typeof s === "string" ? s : s.sector).slice(0, MAX_FUND_SECTORS)))
      .catch((e) => {
        console.error("Failed to fetch sectors:", e);
        setSectors([]);
      });
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
    sp.set("limit", String(DEFAULT_PAGING.limit));
    sp.set("page", String(pagination.page));
    sp.set("sort", sortMap[sortBy]);
    if (debouncedQ.trim()) sp.set("search", debouncedQ.trim());
    if (filters.stage[0]) sp.set("lifecycle", filters.stage[0]);
    if (filters.sector[0]) sp.set("sector", filters.sector[0]);
    if (range.min !== undefined) sp.set("min_amount", String(range.min));
    if (range.max !== undefined) sp.set("max_amount", String(range.max));

    setLoadingTable(true);
    setError(null);
    fetch(`/api/funds?${sp.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setFunds(data.funds || []);
        setPagination(data.pagination || { ...DEFAULT_PAGING });
      })
      .catch((e) => {
        console.error("Failed to fetch funds:", e);
        setError("펀드 데이터를 불러오는 데 실패했습니다");
        setFunds([]);
        setPagination({ ...DEFAULT_PAGING });
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

  const toggleFilter = useCallback((key: FilterKey, value: string) => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    setFilters((prev) => {
      const exists = prev[key].includes(value);
      return { ...prev, [key]: exists ? [] : [value] };
    });
  }, []);

  const resetFilters = useCallback(() => {
    setQuery("");
    setPagination((prev) => ({ ...prev, page: 1 }));
    setFilters({ stage: [], sector: [], size: [] });
    setError(null);
  }, []);

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

  const setSort = useCallback((key: FundSortKey) => {
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

  const handleOpenStage = useCallback(() => setOpenFilter((prev) => prev === "stage" ? null : "stage"), []);
  const handleOpenSector = useCallback(() => setOpenFilter((prev) => prev === "sector" ? null : "sector"), []);
  const handleOpenSize = useCallback(() => setOpenFilter((prev) => prev === "size" ? null : "size"), []);
  const handleToggleStage = useCallback((v: string) => toggleFilter("stage", v), [toggleFilter]);
  const handleToggleSector = useCallback((v: string) => toggleFilter("sector", v), [toggleFilter]);
  const handleToggleSize = useCallback((v: string) => toggleFilter("size", v), [toggleFilter]);

  const pageNumbers = useMemo(() => getPageNumbers(pagination.page, pagination.pages), [pagination.page, pagination.pages]);

  return (
    <>
      <StatBar cards={statCards} loading={statsLoading} />
      <main className="content" id="main-content">
        <div className="toolbar" ref={filterRef}>
          <div className="search-row">
            <label htmlFor="funds-search" className="search-icon"><IconSearch /></label>
            <input
              id="funds-search"
              className="search-input"
              value={query}
              onChange={(e) => { setPagination((prev) => ({ ...prev, page: 1 })); setQuery(e.target.value); }}
              placeholder="펀드명, VC명, 키워드 검색..."
            />
            <span className="search-count" aria-live="polite">{pagination.total.toLocaleString()}개</span>
          </div>
          <div className="filter-row">
            <FilterDropdown
              title="투자단계"
              options={STAGE_OPTIONS}
              selected={filters.stage}
              isOpen={openFilter === "stage"}
              onOpen={handleOpenStage}
              onToggle={handleToggleStage}
            />
            <FilterDropdown
              title="섹터"
              options={sectors}
              selected={filters.sector}
              isOpen={openFilter === "sector"}
              onOpen={handleOpenSector}
              onToggle={handleToggleSector}
            />
            <FilterDropdown
              title="규모"
              options={FUND_SIZE_OPTIONS}
              selected={filters.size}
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
                  <th className="no-sort" scope="col">섹터</th>
                  <SortHeader label="설립일" active={sortBy === "registered_date"} dir={sortDir} onClick={() => setSort("registered_date")} />
                  <th className="no-sort" scope="col">상태</th>
                </tr>
              </thead>
              <tbody>
                {funds.map((fund) => (
                  <tr
                    key={fund.asct_id}
                    onClick={() => navigate(`/fund/${encodeURIComponent(fund.asct_id)}`)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/fund/${encodeURIComponent(fund.asct_id)}`); } }}
                    tabIndex={0}
                    role="link"
                    aria-label={`${fund.fund_name} 상세보기`}
                  >
                    <td><div className="fund-name">{fund.fund_name}</div></td>
                    <td><span className="company-name">{fund.company_name}</span></td>
                    <td><span className={`amount ${amountClass(fund.amount_억)}`}>{formatAmount(fund.amount_억)}<span className="amount-unit">억</span></span></td>
                    <td>
                      <div className="tag-wrap">
                        {(fund.sector_tags || []).slice(0, MAX_TAGS_TABLE).map((tag) => <span key={`${fund.asct_id}-${tag}`} className="tag">{tag}</span>)}
                      </div>
                    </td>
                    <td><span className="date">{formatDate(fund.registered_date)}</span></td>
                    <td><span className={`lifecycle-badge ${lifecycleClass(fund.lifecycle)}`}>{fund.lifecycle || "-"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationBar page={pagination.page} pages={pagination.pages} total={pagination.total} limit={pagination.limit} onPage={handlePage} />
          </div>
        ) : (
          <>
            <div className={`cards-grid ${loadingTable && !initialLoad ? "loading-overlay" : ""}`}>
              {funds.map((fund) => (
                <article
                  key={fund.asct_id}
                  className="fund-card"
                  onClick={() => navigate(`/fund/${encodeURIComponent(fund.asct_id)}`)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/fund/${encodeURIComponent(fund.asct_id)}`); } }}
                  tabIndex={0}
                  role="link"
                  aria-label={`${fund.fund_name} 상세보기`}
                >
                  <div className="card-header">
                    <div>
                      <div className="card-fund-name">{fund.fund_name}</div>
                      <div className="card-company">{fund.company_name}</div>
                    </div>
                    <span className={`lifecycle-badge ${lifecycleClass(fund.lifecycle)}`}>{fund.lifecycle || "-"}</span>
                  </div>
                  <div className="card-amount">{formatAmount(fund.amount_억)}<span className="unit">억</span></div>
                  <div className="card-meta">
                    {(fund.sector_tags || []).slice(0, MAX_TAGS_CARD).map((tag) => <span key={`${fund.asct_id}-${tag}`} className="tag">{tag}</span>)}
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
