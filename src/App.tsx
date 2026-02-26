import { useEffect, useMemo, useRef, useState } from "react";

type Route =
  | { page: "funds"; params: URLSearchParams }
  | { page: "fund"; id: string }
  | { page: "vcs"; params: URLSearchParams }
  | { page: "vc"; id: string };

type ViewType = "table" | "card";
type SortDir = "asc" | "desc";
type SortKey = "fund_name" | "company_name" | "amount_억" | "registered_date";
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

type FundStats = {
  total_funds: number;
  active_funds: number;
  active_aum: number;
  total_vcs: number;
};

type Vc = {
  name: string;
  total_funds: number;
  active_funds: number;
  total_aum: number;
  sectors: string[];
};

type VcStats = {
  total_vcs: number;
  active_vcs: number;
  total_aum: number;
  avg_aum_per_vc: number;
};

const STAGE_OPTIONS = ["적극투자기", "중기", "후기/회수기"];
const SIZE_OPTIONS = ["~100억", "100~500억", "500~1000억", "1000억~"];

const navItems = [
  { label: "Funds", hash: "/", page: "funds" },
  { label: "VCs", hash: "/vcs", page: "vcs" },
] as const;

function parseRoute(): Route {
  const hash = window.location.hash || "#/";
  const [pathPart, query = ""] = hash.replace(/^#/, "").split("?");
  const parts = pathPart.split("/").filter(Boolean);

  if (parts[0] === "fund" && parts[1]) return { page: "fund", id: decodeURIComponent(parts[1]) };
  if (parts[0] === "vcs") return { page: "vcs", params: new URLSearchParams(query) };
  if (parts[0] === "vc" && parts[1]) return { page: "vc", id: decodeURIComponent(parts[1]) };
  return { page: "funds", params: new URLSearchParams(query) };
}

function navigate(path: string) {
  window.location.hash = path;
}

function useDebounce<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

const formatAmount = (value?: number) => (value || value === 0 ? `${value.toLocaleString()}억` : "-");
const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString("ko-KR") : "-");

function amountTone(value?: number) {
  if (!value) return "num-muted";
  if (value >= 3000) return "num-blue";
  if (value >= 1000) return "num-white";
  return "num-muted";
}

function lifecycleTone(lifecycle?: string) {
  if (lifecycle === "적극투자기") return "badge-emerald";
  if (lifecycle === "중기") return "badge-blue";
  return "badge-amber";
}

function sizeToRange(size: string) {
  if (size === "~100억") return { min: undefined, max: 100 };
  if (size === "100~500억") return { min: 100, max: 500 };
  if (size === "500~1000억") return { min: 500, max: 1000 };
  if (size === "1000억~") return { min: 1000, max: undefined };
  return { min: undefined, max: undefined };
}

function App() {
  const [route, setRoute] = useState<Route>(parseRoute());

  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <div className="app-shell">
      <header className="sticky-nav">
        <div className="container nav-inner">
          <button className="brand" onClick={() => navigate("/")}> 
            <span className="brand-dot" />
            <span>Korea VC Funds</span>
          </button>

          <nav className="pill-tabs">
            {navItems.map((item) => {
              const active = route.page === item.page;
              return (
                <button
                  key={item.label}
                  className={`pill-tab ${active ? "active" : ""}`}
                  onClick={() => navigate(item.hash)}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="container main-space">
        {route.page === "funds" && <FundsPage params={route.params} />}
        {route.page === "fund" && <FundDetailPage id={route.id} />}
        {route.page === "vcs" && <VcsPage params={route.params} />}
        {route.page === "vc" && <VcDetailPage id={route.id} />}
      </main>
    </div>
  );
}

function FundsPage({ params }: { params: URLSearchParams }) {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loadingTable, setLoadingTable] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [stats, setStats] = useState<FundStats | null>(null);
  const [pagination, setPagination] = useState({ total: 0, page: Number(params.get("page") || 1), pages: 1, limit: 50 });
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [view, setView] = useState<ViewType>((params.get("view") as ViewType) || "table");
  const [sortBy, setSortBy] = useState<SortKey>((params.get("sortBy") as SortKey) || "amount_억");
  const [sortDir, setSortDir] = useState<SortDir>((params.get("sortDir") as SortDir) || "desc");
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);
  const [sectors, setSectors] = useState<string[]>([]);
  const [filters, setFilters] = useState<Record<FilterKey, string[]>>({
    stage: params.getAll("stage"),
    sector: params.getAll("sector"),
    size: params.getAll("size"),
  });

  const filterWrapRef = useRef<HTMLDivElement>(null);
  const debouncedQ = useDebounce(query, 300);

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

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (filterWrapRef.current && !filterWrapRef.current.contains(event.target as Node)) {
        setOpenFilter(null);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    const sortMap: Record<SortKey, string> = {
      fund_name: `fund_name_${sortDir}`,
      company_name: `company_${sortDir}`,
      amount_억: `amount_${sortDir}`,
      registered_date: `registered_${sortDir}`,
    };

    const selectedSize = filters.size[0];
    const range = selectedSize ? sizeToRange(selectedSize) : { min: undefined, max: undefined };

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
      .finally(() => setLoadingTable(false));
  }, [debouncedQ, filters, sortBy, sortDir, pagination.page]);

  useEffect(() => {
    const sp = new URLSearchParams();
    if (query) sp.set("q", query);
    if (view !== "table") sp.set("view", view);
    sp.set("sortBy", sortBy);
    sp.set("sortDir", sortDir);
    sp.set("page", String(pagination.page));
    (Object.keys(filters) as FilterKey[]).forEach((key) => filters[key].forEach((value) => sp.append(key, value)));
    navigate(`/?${sp.toString()}`);
  }, [query, view, sortBy, sortDir, pagination.page, filters]);

  const cards = useMemo(
    () => [
      { label: "Total", value: stats?.total_funds?.toLocaleString() || "-" },
      { label: "Active", value: stats?.active_funds?.toLocaleString() || "-" },
      { label: "총운용규모", value: formatAmount(stats?.active_aum) },
      { label: "VC사", value: stats?.total_vcs?.toLocaleString() || "-" },
    ],
    [stats],
  );

  const toggleFilter = (key: FilterKey, value: string) => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    setFilters((prev) => {
      const exists = prev[key].includes(value);
      const next = exists ? prev[key].filter((v) => v !== value) : [...prev[key], value];
      return { ...prev, [key]: next };
    });
  };

  const resetFilters = () => {
    setQuery("");
    setPagination((prev) => ({ ...prev, page: 1 }));
    setFilters({ stage: [], sector: [], size: [] });
  };

  return (
    <section className="page-space">
      <StatGrid cards={cards} loading={statsLoading} />

      <section className="glass panel-space">
        <div className="toolbar">
          <input
            className="search-input"
            value={query}
            onChange={(e) => {
              setPagination((prev) => ({ ...prev, page: 1 }));
              setQuery(e.target.value);
            }}
            placeholder="펀드명 · 운용사 검색"
          />

          <div className="view-toggle">
            <button className={`mini-pill ${view === "table" ? "active" : ""}`} onClick={() => setView("table")}>Table</button>
            <button className={`mini-pill ${view === "card" ? "active" : ""}`} onClick={() => setView("card")}>Card</button>
          </div>
        </div>

        <div className="filters" ref={filterWrapRef}>
          <FilterDropdown
            title="투자단계"
            isOpen={openFilter === "stage"}
            onOpen={() => setOpenFilter(openFilter === "stage" ? null : "stage")}
            options={STAGE_OPTIONS}
            selected={filters.stage}
            onToggle={(value) => toggleFilter("stage", value)}
          />
          <FilterDropdown
            title="섹터"
            isOpen={openFilter === "sector"}
            onOpen={() => setOpenFilter(openFilter === "sector" ? null : "sector")}
            options={sectors}
            selected={filters.sector}
            onToggle={(value) => toggleFilter("sector", value)}
          />
          <FilterDropdown
            title="규모"
            isOpen={openFilter === "size"}
            onOpen={() => setOpenFilter(openFilter === "size" ? null : "size")}
            options={SIZE_OPTIONS}
            selected={filters.size}
            onToggle={(value) => toggleFilter("size", value)}
          />
          <button className="reset-btn" onClick={resetFilters}>초기화</button>
        </div>
      </section>

      {loadingTable ? (
        view === "table" ? <TableSkeleton /> : <CardSkeleton />
      ) : funds.length === 0 ? (
        <EmptyState label="조건에 맞는 펀드가 없습니다." onReset={resetFilters} />
      ) : view === "table" ? (
        <FundsTable funds={funds} sortBy={sortBy} sortDir={sortDir} setSortBy={setSortBy} setSortDir={setSortDir} />
      ) : (
        <FundCards funds={funds} />
      )}

      <Pagination
        page={pagination.page}
        pages={pagination.pages}
        total={pagination.total}
        onPage={(page) => setPagination((prev) => ({ ...prev, page }))}
      />
    </section>
  );
}

function FundsTable({
  funds,
  sortBy,
  sortDir,
  setSortBy,
  setSortDir,
}: {
  funds: Fund[];
  sortBy: SortKey;
  sortDir: SortDir;
  setSortBy: (key: SortKey) => void;
  setSortDir: (value: SortDir) => void;
}) {
  const setSort = (key: SortKey) => {
    if (sortBy === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortBy(key);
      setSortDir("desc");
    }
  };

  return (
    <div className="glass overflow-wrap">
      <table className="fund-table">
        <thead>
          <tr>
            <HeaderCell active={sortBy === "fund_name"} label="펀드명" onClick={() => setSort("fund_name")} />
            <HeaderCell active={sortBy === "company_name"} label="운용사" onClick={() => setSort("company_name")} />
            <HeaderCell active={sortBy === "amount_억"} label="규모" onClick={() => setSort("amount_억")} />
            <th>섹터</th>
            <HeaderCell active={sortBy === "registered_date"} label="설립일" onClick={() => setSort("registered_date")} />
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          {funds.map((fund) => (
            <tr key={fund.asct_id} onClick={() => navigate(`/fund/${encodeURIComponent(fund.asct_id)}`)}>
              <td className="fund-title">{fund.fund_name}</td>
              <td>{fund.company_name}</td>
              <td className={`number ${amountTone(fund.amount_억)}`}>{formatAmount(fund.amount_억)}</td>
              <td>
                <div className="tag-wrap">
                  {(fund.sector_tags || []).slice(0, 2).map((tag) => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
              </td>
              <td>{formatDate(fund.registered_date)}</td>
              <td>
                <span className={`badge ${lifecycleTone(fund.lifecycle)}`}>{fund.lifecycle || "-"}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FundCards({ funds }: { funds: Fund[] }) {
  return (
    <div className="fund-grid">
      {funds.map((fund) => (
        <article key={fund.asct_id} className="glass fund-card" onClick={() => navigate(`/fund/${encodeURIComponent(fund.asct_id)}`)}>
          <h3>{fund.fund_name}</h3>
          <p className="muted">{fund.company_name}</p>
          <p className={`number ${amountTone(fund.amount_억)}`}>{formatAmount(fund.amount_억)}</p>
          <div className="tag-wrap">
            {(fund.sector_tags || []).slice(0, 3).map((tag) => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
          <div className="card-footer">
            <span>{formatDate(fund.registered_date)}</span>
            <span className={`badge ${lifecycleTone(fund.lifecycle)}`}>{fund.lifecycle || "-"}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

function FundDetailPage({ id }: { id: string }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    fetch(`/api/fund-detail?id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((result) => setData(result))
      .catch(() => setData(null));
  }, [id]);

  if (!data?.fund) return <TableSkeleton />;
  const fund = data.fund;

  return (
    <section className="page-space">
      <button className="reset-btn" onClick={() => navigate("/")}>← 뒤로가기</button>
      <article className="glass detail-main">
        <h1>{fund.fund_name}</h1>
        <p className="muted">{fund.company_name}</p>
        <p className={`number ${amountTone(fund.amount_억)}`}>{formatAmount(fund.amount_억)}</p>
        <p className="muted">설립 {formatDate(fund.registered_date)} · 만기 {formatDate(fund.maturity_date)}</p>
      </article>
      <div className="detail-grid">
        <article className="glass meta-card"><h3>섹터</h3><div className="tag-wrap">{(fund.sector_tags || []).map((tag: string) => <span key={tag} className="tag">{tag}</span>)}</div></article>
        <article className="glass meta-card"><h3>태그</h3><div className="tag-wrap">{(fund.all_tags || []).slice(0, 12).map((tag: string) => <span key={tag} className="tag">{tag}</span>)}</div></article>
      </div>
    </section>
  );
}

function VcsPage({ params }: { params: URLSearchParams }) {
  const [stats, setStats] = useState<VcStats | null>(null);
  const [list, setList] = useState<Vc[]>([]);
  const [q, setQ] = useState(params.get("q") || "");
  const [pagination, setPagination] = useState({ page: Number(params.get("page") || 1), pages: 1, total: 0 });
  const debouncedQ = useDebounce(q, 300);

  useEffect(() => {
    fetch("/api/vc-stats")
      .then((r) => r.json())
      .then((data) => setStats(data.data || data))
      .catch(() => setStats(null));
  }, []);

  useEffect(() => {
    const sp = new URLSearchParams({ limit: "50", page: String(pagination.page), sort: "total_aum", order: "desc" });
    if (debouncedQ) sp.set("search", debouncedQ);

    fetch(`/api/vcs?${sp.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        const payload = data.data || data;
        setList(payload.vcs || []);
        setPagination((prev) => ({ ...prev, total: payload.total || 0, pages: payload.pages || 1 }));
      })
      .catch(() => setList([]));
  }, [debouncedQ, pagination.page]);

  useEffect(() => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    sp.set("page", String(pagination.page));
    navigate(`/vcs?${sp.toString()}`);
  }, [q, pagination.page]);

  return (
    <section className="page-space">
      <StatGrid
        loading={!stats}
        cards={[
          { label: "총VC사", value: stats?.total_vcs?.toLocaleString() || "-" },
          { label: "활성", value: stats?.active_vcs?.toLocaleString() || "-" },
          { label: "총AUM", value: formatAmount(stats?.total_aum) },
          { label: "평균AUM", value: formatAmount(stats?.avg_aum_per_vc) },
        ]}
      />

      <section className="glass panel-space">
        <input
          className="search-input"
          value={q}
          onChange={(e) => {
            setPagination((prev) => ({ ...prev, page: 1 }));
            setQ(e.target.value);
          }}
          placeholder="VC 이름 검색"
        />
      </section>

      <div className="glass overflow-wrap">
        <table className="fund-table">
          <thead><tr><th>VC명</th><th>펀드수</th><th>총AUM</th><th>활성펀드</th><th>주요섹터</th></tr></thead>
          <tbody>
            {list.map((vc) => (
              <tr key={vc.name} onClick={() => navigate(`/vc/${encodeURIComponent(vc.name)}`)}>
                <td className="fund-title">{vc.name}</td>
                <td className="number num-white">{vc.total_funds.toLocaleString()}</td>
                <td className={`number ${amountTone(vc.total_aum)}`}>{formatAmount(vc.total_aum)}</td>
                <td className="number num-white">{vc.active_funds.toLocaleString()}</td>
                <td><div className="tag-wrap">{vc.sectors.slice(0, 3).map((s) => <span key={s} className="tag">{s}</span>)}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} onPage={(page) => setPagination((prev) => ({ ...prev, page }))} />
    </section>
  );
}

function VcDetailPage({ id }: { id: string }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    fetch(`/api/vc-detail?name=${encodeURIComponent(id)}&format=stats`)
      .then((r) => r.json())
      .then((result) => setData(result.data || result))
      .catch(() => setData(null));
  }, [id]);

  if (!data) return <TableSkeleton />;

  return (
    <section className="page-space">
      <button className="reset-btn" onClick={() => navigate("/vcs")}>← 뒤로가기</button>
      <article className="glass detail-main">
        <h1>{data.name}</h1>
        <p className="muted">펀드 {data.total_funds}개 · 활성 {data.active_funds}개</p>
        <p className={`number ${amountTone(data.total_aum)}`}>{formatAmount(data.total_aum)}</p>
      </article>

      <div className="glass overflow-wrap">
        <table className="fund-table">
          <thead><tr><th>펀드명</th><th>규모</th><th>결성일</th><th>라이프사이클</th></tr></thead>
          <tbody>
            {(data.funds || []).map((fund: any) => (
              <tr key={fund.id} onClick={() => navigate(`/fund/${encodeURIComponent(fund.id)}`)}>
                <td className="fund-title">{fund.fund_name}</td>
                <td className={`number ${amountTone(fund.total_amount)}`}>{formatAmount(fund.total_amount)}</td>
                <td>{formatDate(fund.formation_date)}</td>
                <td><span className={`badge ${lifecycleTone(fund.lifecycle)}`}>{fund.lifecycle || "-"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FilterDropdown({
  title,
  isOpen,
  onOpen,
  options,
  selected,
  onToggle,
}: {
  title: string;
  isOpen: boolean;
  onOpen: () => void;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="dropdown-wrap">
      <button className={`filter-pill ${selected.length ? "active" : ""}`} onClick={onOpen}>{title}</button>
      {isOpen && (
        <div className="dropdown-panel">
          {options.length === 0 ? (
            <p className="muted">옵션 없음</p>
          ) : (
            options.map((option) => (
              <button key={option} className={`option-chip ${selected.includes(option) ? "active" : ""}`} onClick={() => onToggle(option)}>
                {option}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function HeaderCell({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <th>
      <button className={`header-btn ${active ? "active" : ""}`} onClick={onClick}>{label}</button>
    </th>
  );
}

function Pagination({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (page: number) => void }) {
  return (
    <div className="pagination">
      <button className="mini-pill" disabled={page <= 1} onClick={() => onPage(page - 1)}>이전</button>
      <span className="muted">{page} / {pages} · {total.toLocaleString()}개</span>
      <button className="mini-pill" disabled={page >= pages} onClick={() => onPage(page + 1)}>다음</button>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="glass panel-space">
      {Array.from({ length: 8 }).map((_, idx) => <div key={idx} className="skeleton-row" />)}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="fund-grid">
      {Array.from({ length: 6 }).map((_, idx) => <div key={idx} className="glass skeleton-card" />)}
    </div>
  );
}

function EmptyState({ label, onReset }: { label: string; onReset: () => void }) {
  return (
    <article className="glass empty-state">
      <p>{label}</p>
      <button className="mini-pill active" onClick={onReset}>필터 초기화</button>
    </article>
  );
}

function StatGrid({ cards, loading }: { cards: { label: string; value: string }[]; loading: boolean }) {
  return (
    <section className="stats-grid">
      {cards.map((card) => (
        <article key={card.label} className="glass stat-card">
          <p className="muted">{card.label}</p>
          {loading ? <div className="skeleton-row" /> : <p className="number num-white">{card.value}</p>}
        </article>
      ))}
    </section>
  );
}


export default App;
