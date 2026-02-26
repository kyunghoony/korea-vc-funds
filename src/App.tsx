import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";


type Fund = {
  asct_id: string;
  fund_name: string;
  company_name: string;
  amount_억?: number;
  registered_date?: string;
  maturity_date?: string;
  lifecycle?: string;
  sector_tags?: string[];
  all_tags?: string[];
  [key: string]: unknown;
};

type Vc = {
  name: string;
  total_aum: number;
  total_funds: number;
  active_funds: number;
  sectors: string[];
};

type VcDashboardStats = {
  total_vcs: number;
  active_vcs: number;
  total_aum: number;
  avg_aum_per_vc: number;
};

type Route =
  | { page: "home"; params: URLSearchParams }
  | { page: "fund"; id: string }
  | { page: "vcs"; params: URLSearchParams }
  | { page: "vc"; id: string }
  | { page: "match" };

type ViewType = "table" | "card";
type SortDir = "asc" | "desc";

type SortKey = "fund_name" | "company_name" | "amount_억" | "registered_date";


function Icon({ path, className = "", size = 16 }: { path: string; className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} width={size} height={size} aria-hidden>
      <path d={path} />
    </svg>
  );
}


const navItems = [
  { label: "Funds", hash: "/", page: "home" },
  { label: "VCs", hash: "/vcs", page: "vcs" },
  { label: "Match", hash: "/match", page: "match" },
] as const;

function parseRoute(): Route {
  const hash = window.location.hash || "#/";
  const [pathPart, query = ""] = hash.replace(/^#/, "").split("?");
  const parts = pathPart.split("/").filter(Boolean);

  if (parts[0] === "fund" && parts[1]) return { page: "fund", id: decodeURIComponent(parts[1]) };
  if (parts[0] === "vcs") return { page: "vcs", params: new URLSearchParams(query) };
  if (parts[0] === "vc" && parts[1]) return { page: "vc", id: decodeURIComponent(parts[1]) };
  if (parts[0] === "match") return { page: "match" };
  return { page: "home", params: new URLSearchParams(query) };
}

function navigate(path: string) {
  window.location.hash = path;
}

function debounce<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

function formatAmount(v?: number) {
  if (!v && v !== 0) return "-";
  return `${v.toLocaleString()}억`;
}

function formatJo(v?: number) {
  if (!v && v !== 0) return "-";
  return `${(v / 10000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}조`;
}

function highlight(text: string, q: string) {
  if (!q.trim()) return text;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "ig");
  return text.split(regex).map((part, i) => (part.toLowerCase() === q.toLowerCase() ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>));
}

function App() {
  const [route, setRoute] = useState<Route>(parseRoute());

  useEffect(() => {
    const onHash = () => setRoute(parseRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#09090b]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
          <button onClick={() => navigate("/")} className="text-lg font-semibold tracking-tight">Korea VC Funds</button>
          <nav className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            {navItems.map((item) => {
              const active = route.page === item.page;
              return (
                <button
                  key={item.label}
                  onClick={() => navigate(item.hash)}
                  className={`rounded-lg px-4 py-1.5 text-sm transition ${active ? "bg-blue-500/20 text-blue-300" : "text-white/60 hover:text-white hover:bg-white/5"}`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
          <button className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/70 hover:text-white">
            <Icon path="m21 21-4.3-4.3M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14" size={16} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-8 md:py-8">
        {route.page === "home" && <FundsPage params={route.params} />}
        {route.page === "fund" && <FundDetailPage id={route.id} />}
        {route.page === "vcs" && <VcsPage params={route.params} />}
        {route.page === "vc" && <VcDetailPage id={route.id} />}
        {route.page === "match" && <MatchPage />}
      </main>
    </div>
  );
}

function FundsPage({ params }: { params: URLSearchParams }) {
  const ITEMS_PER_PAGE = 50;
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [view, setView] = useState<ViewType>((params.get("view") as ViewType) ?? "table");
  const [sortBy, setSortBy] = useState<SortKey>((params.get("sortBy") as SortKey) ?? "fund_name");
  const [sortDir, setSortDir] = useState<SortDir>((params.get("sortDir") as SortDir) ?? "asc");
  const [filters, setFilters] = useState<Record<string, string[]>>({
    stage: params.getAll("stage"),
    sector: params.getAll("sector"),
    region: params.getAll("region"),
    size: params.getAll("size"),
  });
  const [openFilter, setOpenFilter] = useState<"stage" | "sector" | "region" | "size" | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const filterRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = debounce(query, 300);

  useEffect(() => {
    const sortMap: Record<SortKey, string> = {
      fund_name: `fund_name_${sortDir}`,
      company_name: `company_${sortDir}`,
      amount_억: `amount_${sortDir}`,
      registered_date: `registered_${sortDir}`,
    };

    const fetchAllFunds = async () => {
      const chunkSize = 50;
      let page = 1;
      let hasMore = true;
      const allFunds: Fund[] = [];

      while (hasMore) {
        const response = await fetch(`/api/funds?page=${page}&limit=${chunkSize}&sort=${sortMap[sortBy] || "amount_desc"}`);
        const data = await response.json();
        const chunk = data.funds || [];
        allFunds.push(...chunk);
        hasMore = chunk.length === chunkSize;
        page += 1;
      }

      return allFunds;
    };

    setLoading(true);
    fetchAllFunds()
      .then((allFunds) => setFunds(allFunds))
      .catch(() => setFunds([]))
      .finally(() => setLoading(false));
  }, [sortBy, sortDir]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setOpenFilter(null);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedQuery, filters, view]);

  useEffect(() => {
    const sp = new URLSearchParams();
    if (query) sp.set("q", query);
    if (view !== "table") sp.set("view", view);
    sp.set("sortBy", sortBy);
    sp.set("sortDir", sortDir);
    Object.entries(filters).forEach(([k, vals]) => vals.forEach((v) => sp.append(k, v)));
    navigate(`/?${sp.toString()}`);
  }, [query, view, sortBy, sortDir, filters]);

  const options = useMemo(() => {
    const stageSet = new Set<string>();
    const sectorSet = new Set<string>();
    const regionSet = new Set<string>();
    funds.forEach((f) => {
      (f.all_tags || []).forEach((v) => stageSet.add(v));
      (f.sector_tags || []).forEach((v) => {
        sectorSet.add(v);
        if (v.includes("권") || v.includes("지역")) regionSet.add(v);
      });
    });
    return {
      stage: [...stageSet].slice(0, 10),
      sector: [...sectorSet].slice(0, 20),
      region: [...regionSet].slice(0, 10),
      size: ["~300억", "300~1000억", "1000억~"],
    };
  }, [funds]);

  const filtered = useMemo(() => {
    return funds.filter((f) => {
      const searchable = `${f.fund_name} ${f.company_name} ${(f.sector_tags || []).join(" ")} ${(f.all_tags || []).join(" ")}`.toLowerCase();
      if (debouncedQuery && !searchable.includes(debouncedQuery.toLowerCase())) return false;

      const sizeBucket = (f.amount_억 || 0) < 300 ? "~300억" : (f.amount_억 || 0) < 1000 ? "300~1000억" : "1000억~";
      const checks: Record<string, boolean> = {
        stage: filters.stage.length === 0 || filters.stage.some((v) => (f.all_tags || []).includes(v)),
        sector: filters.sector.length === 0 || filters.sector.some((v) => (f.sector_tags || []).includes(v)),
        region: filters.region.length === 0 || filters.region.some((v) => (f.sector_tags || []).includes(v)),
        size: filters.size.length === 0 || filters.size.includes(sizeBucket),
      };
      return Object.values(checks).every(Boolean);
    });
  }, [funds, debouncedQuery, filters]);

  const toggle = (k: string, v: string) => {
    setFilters((prev) => ({ ...prev, [k]: prev[k].includes(v) ? prev[k].filter((x) => x !== v) : [...prev[k], v] }));
  };

  const resetFilters = () => {
    setFilters({ stage: [], sector: [], region: [], size: [] });
    setQuery("");
    setCurrentPage(1);
  };
  const activeFilters = Object.entries(filters).flatMap(([k, vals]) => vals.map((v) => ({ key: k, value: v })));
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginatedFunds = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const filterLabel: Record<"stage" | "sector" | "region" | "size", string> = {
    stage: "투자단계",
    sector: "섹터",
    region: "지역",
    size: "규모",
  };

  return (
    <section className="space-y-4">
      <div className="glass-card p-4 md:p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-72 flex-1">
            <Icon path="m21 21-4.3-4.3M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="펀드명, VC명, 키워드 검색..."
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white outline-none ring-blue-500/40 placeholder:text-white/40 focus:ring"
            />
          </div>
          <span className="rounded-full bg-blue-500/20 px-3 py-1 text-sm text-blue-300">{filtered.length.toLocaleString()}개 펀드</span>
        </div>

        <div ref={filterRef} className="relative z-10 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
          {(["stage", "sector", "region", "size"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setOpenFilter((prev) => (prev === k ? null : k))}
              className="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              {filterLabel[k]}
            </button>
          ))}
          <button className="ml-auto text-sm text-white/40 transition hover:text-white" onClick={resetFilters}>전체 초기화</button>
        </div>

          {openFilter && (
            <div className="w-full rounded-2xl border border-white/10 bg-[#111117]/95 p-3 backdrop-blur-xl">
              <div className="mb-2 text-xs text-white/40">{filterLabel[openFilter]} 선택</div>
              <div className="flex flex-wrap gap-2">
                {options[openFilter].map((o) => (
                  <button
                    key={o}
                    onClick={() => toggle(openFilter, o)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                      filters[openFilter].includes(o)
                        ? "border-blue-500/30 bg-blue-500/20 text-blue-300"
                        : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
            {activeFilters.map((item) => (
              <button
                key={`${item.key}-${item.value}`}
                onClick={() => toggle(item.key, item.value)}
                className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/20 px-3 py-1 text-xs text-blue-300"
              >
                {item.key}: {item.value}
                <Icon path="M18 6 6 18M6 6l12 12" size={12} />
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-white/10 pt-3">
          <span className="text-xs uppercase tracking-widest text-white/40">View</span>
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
            <IconToggle active={view === "table"} onClick={() => setView("table")}><Icon path="M3 10h18M3 3h18v18H3zM3 17h18M12 3v18" size={15} /></IconToggle>
            <IconToggle active={view === "card"} onClick={() => setView("card")}><Icon path="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z" size={15} /></IconToggle>
          </div>
        </div>
      </div>

      {loading ? (
        view === "table" ? <TableSkeleton /> : <CardSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState onReset={resetFilters} buttonLabel="초기화" />
      ) : view === "table" ? (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-white/40">
                <SortableHeader current={sortBy} dir={sortDir} setSortBy={setSortBy} setSortDir={setSortDir} column="fund_name" label="펀드명" />
                <SortableHeader current={sortBy} dir={sortDir} setSortBy={setSortBy} setSortDir={setSortDir} column="company_name" label="운용사" />
                <SortableHeader className="hidden md:table-cell" current={sortBy} dir={sortDir} setSortBy={setSortBy} setSortDir={setSortDir} column="amount_억" label="규모(억)" />
                <SortableHeader className="hidden md:table-cell" current={sortBy} dir={sortDir} setSortBy={setSortBy} setSortDir={setSortDir} column="registered_date" label="설립일" />
              </tr>
            </thead>
            <tbody>
              {paginatedFunds.map((f) => (
                <tr key={f.asct_id} className="cursor-pointer border-b border-white/5 transition hover:bg-white/[0.03]" onClick={() => navigate(`/fund/${encodeURIComponent(f.asct_id)}`)}>
                  <td className="p-4 font-medium text-white">
                    {highlight(f.fund_name, debouncedQuery)}
                    <div className="mt-1 text-xs text-white/60 md:hidden">{highlight(f.company_name, debouncedQuery)}</div>
                  </td>
                  <td className="hidden p-4 text-white/60 md:table-cell">{highlight(f.company_name, debouncedQuery)}</td>
                  <td className="hidden p-4 font-mono text-blue-300 md:table-cell">{f.amount_억?.toLocaleString() || "-"}</td>
                  <td className="hidden p-4 text-white/60 md:table-cell">{f.registered_date?.slice(0, 10) || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {paginatedFunds.map((f) => (
            <article
              key={f.asct_id}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 transition hover:border-blue-500/20 hover:shadow-lg hover:shadow-blue-500/5 cursor-pointer"
              onClick={() => navigate(`/fund/${encodeURIComponent(f.asct_id)}`)}
            >
              <h3 className="font-semibold text-white">{highlight(f.fund_name, debouncedQuery)}</h3>
              <p className="mt-1 text-sm text-white/60">{f.company_name}</p>
              <p className="mt-4 font-mono text-sm text-blue-300">{formatAmount(f.amount_억)}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {(f.sector_tags || []).slice(0, 5).map((tag) => (
                  <span key={tag} className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-1 text-xs text-emerald-300">{tag}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70 disabled:cursor-not-allowed disabled:opacity-40"
          >
            이전
          </button>
          {Array.from({ length: totalPages }).slice(Math.max(0, currentPage - 3), Math.max(0, currentPage - 3) + 5).map((_, idx) => {
            const pageNum = Math.max(1, currentPage - 2) + idx;
            if (pageNum > totalPages) return null;
            return (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={`rounded-lg px-3 py-1.5 text-sm ${pageNum === currentPage ? "bg-blue-500/25 text-blue-300" : "border border-white/10 bg-white/5 text-white/70"}`}
              >
                {pageNum}
              </button>
            );
          })}
          <button
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70 disabled:cursor-not-allowed disabled:opacity-40"
          >
            다음
          </button>
        </div>
      )}
    </section>
  );
}

function FundDetailPage({ id }: { id: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/fund-detail?id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="glass-card p-6">Loading...</div>;
  if (!data) return <EmptyState onReset={() => navigate("/")} label="상세 정보를 찾을 수 없습니다" buttonLabel="목록으로" />;

  const fund = data.fund || data;
  return (
    <section className="space-y-4">
      <button onClick={() => navigate("/")} className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white">
        <Icon path="m12 19-7-7 7-7M19 12H5" size={14} /> 뒤로 가기
      </button>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass-card p-6 lg:col-span-2 space-y-4">
          <h2 className="text-2xl font-semibold">{fund.fund_name}</h2>
          <div className="grid gap-3 md:grid-cols-2 text-sm">
            <Info label="운용사" value={fund.company_name} />
            <Info label="규모" value={formatAmount(fund.amount_억)} mono />
            <Info label="설립일" value={fund.registered_date?.slice(0, 10)} />
            <Info label="만기일" value={fund.maturity_date?.slice(0, 10)} />
          </div>
        </div>
        <div className="space-y-4">
          <MetaCard title="투자 단계" items={fund.all_tags || []} tone="blue" />
          <MetaCard title="섹터" items={fund.sector_tags || []} tone="emerald" />
        </div>
      </div>
    </section>
  );
}

function VcsPage({ params }: { params: URLSearchParams }) {
  const [q, setQ] = useState(params.get("q") ?? "");
  const [list, setList] = useState<Vc[]>([]);
  const [totalVCs, setTotalVCs] = useState(0);
  const [stats, setStats] = useState<VcDashboardStats | null>(null);
  const debounced = debounce(q, 300);

  useEffect(() => {
    fetch(`/api/vcs?limit=1000&search=${encodeURIComponent(debounced)}`)
      .then((r) => r.json())
      .then((d) => {
        const rows = (d.data?.vcs || d.vcs || []).map((v: any) => ({
          name: v.name || v.company_name,
          total_aum: v.total_aum || 0,
          total_funds: v.total_funds || v.fund_count || 0,
          active_funds: v.active_funds || v.active_count || 0,
          sectors: v.sectors || [],
        }));
        setList(rows);
        setTotalVCs(Number(d.data?.total || rows.length));
      })
      .catch(() => {
        setList([]);
        setTotalVCs(0);
      });
  }, [debounced]);

  useEffect(() => {
    fetch('/api/vc-stats')
      .then((r) => r.json())
      .then((d) => setStats(d.data || d))
      .catch(() => setStats(null));
  }, []);

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="glass-card p-4">
          <p className="text-sm text-white/60">총 VC사</p>
          <p className="mt-1 text-2xl font-semibold">{stats?.total_vcs?.toLocaleString() ?? "-"}</p>
        </article>
        <article className="glass-card p-4">
          <p className="text-sm text-white/60">활성 VC사</p>
          <p className="mt-1 text-2xl font-semibold">{stats?.active_vcs?.toLocaleString() ?? "-"}</p>
        </article>
        <article className="glass-card p-4">
          <p className="text-sm text-white/60">총 운용총액</p>
          <p className="mt-1 text-2xl font-semibold">{formatJo(stats?.total_aum)}</p>
        </article>
        <article className="glass-card p-4">
          <p className="text-sm text-white/60">평균 AUM / VC</p>
          <p className="mt-1 text-2xl font-semibold">{formatAmount(stats?.avg_aum_per_vc)}</p>
        </article>
      </div>

      <div className="glass-card p-4 flex gap-3 items-center">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="VC 검색" className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm" />
        <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-sm text-emerald-300">{totalVCs.toLocaleString()} VCs</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((vc) => (
          <article key={vc.name} className="glass-card p-4 cursor-pointer transition hover:border-blue-500/20" onClick={() => navigate(`/vc/${encodeURIComponent(vc.name)}`)}>
            <h3 className="font-semibold">{vc.name}</h3>
            <p className="text-sm text-white/60">AUM {formatAmount(vc.total_aum)} · 펀드 {vc.total_funds}개</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function VcDetailPage({ id }: { id: string }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    fetch(`/api/vc-detail?name=${encodeURIComponent(id)}&format=stats`)
      .then((r) => r.json())
      .then((d) => setData(d.data || d))
      .catch(() => setData(null));
  }, [id]);
  if (!data) return <div className="glass-card p-6">Loading...</div>;
  return (
    <section className="space-y-4">
      <div className="glass-card p-6">
        <h2 className="text-2xl font-semibold">{data.name}</h2>
        <p className="text-sm text-white/60">총 펀드 {data.total_funds} · 운용규모 {formatAmount(data.total_aum)}</p>
      </div>
      <div className="glass-card p-4">
        <h3 className="mb-2">운용 펀드</h3>
        <ul className="space-y-2 text-sm text-white/70">{(data.funds || []).map((f: any) => <li key={f.id}>{f.fund_name} · {formatAmount(f.total_amount)}</li>)}</ul>
      </div>
    </section>
  );
}

function MatchPage() {
  return (
    <section className="glass-card p-8 text-center">
      <h2 className="text-xl font-semibold">Match</h2>
      <p className="mt-2 text-sm text-white/60">VC-펀드 매칭 뷰가 곧 제공됩니다.</p>
    </section>
  );
}

function SortableHeader({
  className = "",
  current,
  dir,
  setSortBy,
  setSortDir,
  column,
  label,
}: {
  className?: string;
  current: SortKey;
  dir: SortDir;
  setSortBy: (value: SortKey) => void;
  setSortDir: (value: SortDir) => void;
  column: SortKey;
  label: string;
}) {
  const active = current === column;
  return (
    <th className={`p-4 ${className}`}>
      <button
        className="inline-flex items-center gap-1 text-left"
        onClick={() => {
          if (active) setSortDir(dir === "asc" ? "desc" : "asc");
          setSortBy(column);
        }}
      >
        {label}
        {active ? dir === "asc" ? <Icon path="m18 15-6-6-6 6" size={12} /> : <Icon path="m6 9 6 6 6-6" size={12} /> : null}
      </button>
    </th>
  );
}

function IconToggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-full p-2 transition ${active ? "bg-blue-500/25 text-blue-300" : "text-white/50 hover:text-white hover:bg-white/10"}`}>
      {children}
    </button>
  );
}

function EmptyState({ onReset, label = "검색 결과가 없습니다", buttonLabel = "필터 초기화" }: { onReset: () => void; label?: string; buttonLabel?: string }) {
  return (
    <div className="glass-card p-10 text-center">
      <Icon path="M12 3C7 3 3 4.8 3 7v10c0 2.2 4 4 9 4s9-1.8 9-4V7c0-2.2-4-4-9-4Zm0 0c5 0 9 1.8 9 4s-4 4-9 4-9-1.8-9-4 4-4 9-4Zm-9 9c0 2.2 4 4 9 4s9-1.8 9-4" className="mx-auto text-white/30" size={20} />
      <p className="mt-3 font-medium">{label}</p>
      <button className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 hover:text-white" onClick={onReset}>
        {buttonLabel}
      </button>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="glass-card p-4 animate-pulse space-y-3">
      {Array.from({ length: 8 }).map((_, idx) => (
        <div key={idx} className="h-10 rounded-lg bg-white/5" />
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 animate-pulse">
      {Array.from({ length: 6 }).map((_, idx) => (
        <div key={idx} className="glass-card p-6 space-y-3">
          <div className="h-5 rounded bg-white/10" />
          <div className="h-4 w-2/3 rounded bg-white/5" />
          <div className="h-4 w-1/3 rounded bg-blue-500/20" />
        </div>
      ))}
    </div>
  );
}

function MetaCard({ title, items, tone }: { title: string; items: string[]; tone: "blue" | "emerald" }) {
  const toneClass = tone === "blue" ? "border-blue-500/30 bg-blue-500/15 text-blue-300" : "border-emerald-500/30 bg-emerald-500/15 text-emerald-300";
  return (
    <div className="glass-card p-4">
      <h3 className="mb-3 text-sm text-white/60">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {items.length ? items.map((item) => <span key={item} className={`rounded-full border px-2.5 py-1 text-xs ${toneClass}`}>{item}</span>) : <span className="text-sm text-white/40">-</span>}
      </div>
    </div>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="text-xs text-white/40">{label}</div>
      <div className={mono ? "font-mono text-blue-300" : "text-white/90"}>{value || "-"}</div>
    </div>
  );
}

export default App;
