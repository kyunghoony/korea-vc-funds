import { useEffect, useMemo, useState } from "react";

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

type Route =
  | { page: "home"; params: URLSearchParams }
  | { page: "fund"; id: string }
  | { page: "vcs"; params: URLSearchParams }
  | { page: "vc"; id: string };

const chipClass = "px-3 py-1.5 rounded-full text-xs border border-white/15 hover:border-blue-400/60 transition";

function parseRoute(): Route {
  const hash = window.location.hash || "#/";
  const [pathPart, query = ""] = hash.replace(/^#/, "").split("?");
  const parts = pathPart.split("/").filter(Boolean);

  if (parts[0] === "fund" && parts[1]) return { page: "fund", id: decodeURIComponent(parts[1]) };
  if (parts[0] === "vcs") return { page: "vcs", params: new URLSearchParams(query) };
  if (parts[0] === "vc" && parts[1]) return { page: "vc", id: decodeURIComponent(parts[1]) };
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

function highlight(text: string, q: string) {
  if (!q.trim()) return text;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "ig");
  return text.split(regex).map((part, i) => (regex.test(part) ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>));
}

function App() {
  const [route, setRoute] = useState<Route>(parseRoute());

  useEffect(() => {
    const onHash = () => setRoute(parseRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-100">
      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        <header className="glass-card p-4 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="text-xl font-semibold tracking-tight">Korea VC Funds</button>
          <nav className="flex gap-2 text-sm">
            <button className={chipClass} onClick={() => navigate("/")}>Funds</button>
            <button className={chipClass} onClick={() => navigate("/vcs")}>VCs</button>
          </nav>
        </header>
        {route.page === "home" && <FundsPage params={route.params} />}
        {route.page === "fund" && <FundDetailPage id={route.id} />}
        {route.page === "vcs" && <VcsPage params={route.params} />}
        {route.page === "vc" && <VcDetailPage id={route.id} />}
      </div>
    </div>
  );
}

function FundsPage({ params }: { params: URLSearchParams }) {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [view, setView] = useState(params.get("view") ?? "table");
  const [sortBy, setSortBy] = useState(params.get("sortBy") ?? "fund_name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">((params.get("sortDir") as "asc" | "desc") ?? "asc");
  const [filters, setFilters] = useState<Record<string, string[]>>({
    stage: params.getAll("stage"),
    sector: params.getAll("sector"),
    region: params.getAll("region"),
    size: params.getAll("size"),
  });
  const debouncedQuery = debounce(query, 300);

  useEffect(() => {
    const sortMap: Record<string, string> = {
      fund_name: `fund_name_${sortDir}`,
      amount_억: `amount_${sortDir}`,
      registered_date: `registered_${sortDir}`,
    };
    fetch(`/api/funds?limit=200&sort=${sortMap[sortBy] || "amount_desc"}`)
      .then((res) => res.json())
      .then((data) => setFunds(data.funds || []))
      .catch(() => setFunds([]));
  }, [sortBy, sortDir]);

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

  return (
    <section className="space-y-4">
      <div className="glass-card p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="펀드명 / VC명 / 키워드 검색" className="flex-1 min-w-64 px-4 py-2 rounded-xl bg-white/5 border border-white/10" />
          <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-200 text-sm">{filtered.length} funds</span>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {(["stage", "sector", "region", "size"] as const).map((k) => (
            <details key={k} className="glass-card px-3 py-2">
              <summary className="cursor-pointer text-sm capitalize">{k}</summary>
              <div className="mt-2 flex flex-wrap gap-2 max-w-xl">
                {options[k].map((o) => (
                  <button key={o} onClick={() => toggle(k, o)} className={`${chipClass} ${filters[k].includes(o) ? "bg-emerald-500/30 border-emerald-300/60" : ""}`}>{o}</button>
                ))}
              </div>
            </details>
          ))}
          <button className="ml-auto text-sm text-red-300" onClick={() => setFilters({ stage: [], sector: [], region: [], size: [] })}>전체 초기화</button>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {Object.entries(filters).flatMap(([k, vals]) => vals.map((v) => (
            <button key={`${k}-${v}`} onClick={() => toggle(k, v)} className="px-2.5 py-1 rounded-full bg-white/10 text-xs">{k}:{v} ✕</button>
          )))}
        </div>
        <div className="flex gap-2">
          <button className={`${chipClass} ${view === "table" ? "bg-blue-500/30" : ""}`} onClick={() => setView("table")}>Table</button>
          <button className={`${chipClass} ${view === "card" ? "bg-blue-500/30" : ""}`} onClick={() => setView("card")}>Card</button>
        </div>
      </div>

      {view === "table" ? (
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-300">
              <tr className="border-b border-white/10">
                {[
                  ["fund_name", "펀드명"],
                  ["company_name", "운용사"],
                  ["amount_억", "규모"],
                  ["registered_date", "설립일"],
                ].map(([k, label]) => (
                  <th key={k} className="p-3">
                    <button className="flex items-center gap-1" onClick={() => {
                      if (k === sortBy) setSortDir(sortDir === "asc" ? "desc" : "asc");
                      setSortBy(k);
                    }}>{label}{sortBy === k ? (sortDir === "asc" ? "↑" : "↓") : ""}</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <tr key={f.asct_id} className="border-b border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => navigate(`/fund/${encodeURIComponent(f.asct_id)}`)}>
                  <td className="p-3">{highlight(f.fund_name, debouncedQuery)}</td>
                  <td className="p-3">{highlight(f.company_name, debouncedQuery)}</td>
                  <td className="p-3">{formatAmount(f.amount_억)}</td>
                  <td className="p-3">{f.registered_date?.slice(0, 10) || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((f) => (
            <article key={f.asct_id} className="glass-card p-4 space-y-2 cursor-pointer" onClick={() => navigate(`/fund/${encodeURIComponent(f.asct_id)}`)}>
              <h3 className="font-semibold">{highlight(f.fund_name, debouncedQuery)}</h3>
              <p className="text-sm text-slate-300">{f.company_name}</p>
              <p className="text-blue-300">{formatAmount(f.amount_억)}</p>
              <div className="flex flex-wrap gap-1.5">{(f.sector_tags || []).slice(0, 5).map((tag) => <span key={tag} className="text-xs px-2 py-1 rounded-full bg-white/10">{tag}</span>)}</div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function FundDetailPage({ id }: { id: string }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    fetch(`/api/fund-detail?id=${encodeURIComponent(id)}`).then((r) => r.json()).then(setData).catch(() => setData(null));
  }, [id]);
  if (!data) return <div className="glass-card p-6">Loading...</div>;
  const fund = data.fund || data;
  return (
    <section className="glass-card p-6 space-y-4">
      <h2 className="text-2xl font-semibold">{fund.fund_name}</h2>
      <div className="grid md:grid-cols-2 gap-3 text-sm">
        <Info label="운용사" value={fund.company_name} />
        <Info label="규모" value={formatAmount(fund.amount_억)} />
        <Info label="설립일" value={fund.registered_date?.slice(0, 10)} />
        <Info label="만기일" value={fund.maturity_date?.slice(0, 10)} />
        <Info label="투자 단계" value={(fund.all_tags || []).join(", ")} />
        <Info label="섹터" value={(fund.sector_tags || []).join(", ")} />
      </div>
      <h3 className="text-lg">운용 펀드</h3>
      <ul className="space-y-2">
        {(data.relatedFunds || []).map((f: any) => <li key={f.asct_id} className="text-sm text-slate-300">{f.fund_name} · {formatAmount(f.amount_억)}</li>)}
      </ul>
    </section>
  );
}

function VcsPage({ params }: { params: URLSearchParams }) {
  const [q, setQ] = useState(params.get("q") ?? "");
  const [list, setList] = useState<Vc[]>([]);
  const debounced = debounce(q, 300);

  useEffect(() => {
    fetch(`/api/vcs?limit=200&search=${encodeURIComponent(debounced)}`)
      .then((r) => r.json())
      .then((d) => setList((d.data?.vcs || d.vcs || []).map((v: any) => ({
        name: v.name || v.company_name,
        total_aum: v.total_aum || 0,
        total_funds: v.total_funds || v.fund_count || 0,
        active_funds: v.active_funds || v.active_count || 0,
        sectors: v.sectors || [],
      }))))
      .catch(() => setList([]));
  }, [debounced]);

  return (
    <section className="space-y-4">
      <div className="glass-card p-4 flex gap-3 items-center">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="VC 검색" className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10" />
        <span className="text-sm text-emerald-300">{list.length} VCs</span>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {list.map((vc) => (
          <article key={vc.name} className="glass-card p-4 cursor-pointer" onClick={() => navigate(`/vc/${encodeURIComponent(vc.name)}`)}>
            <h3 className="font-semibold">{vc.name}</h3>
            <p className="text-sm text-slate-300">AUM {formatAmount(vc.total_aum)} · 펀드 {vc.total_funds}개</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function VcDetailPage({ id }: { id: string }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    fetch(`/api/vc-detail?name=${encodeURIComponent(id)}&format=stats`).then((r) => r.json()).then((d) => setData(d.data || d)).catch(() => setData(null));
  }, [id]);
  if (!data) return <div className="glass-card p-6">Loading...</div>;
  return (
    <section className="space-y-4">
      <div className="glass-card p-6">
        <h2 className="text-2xl font-semibold">{data.name}</h2>
        <p className="text-slate-300 text-sm">총 펀드 {data.total_funds} · 운용규모 {formatAmount(data.total_aum)}</p>
      </div>
      <div className="glass-card p-4">
        <h3 className="mb-2">운용 펀드</h3>
        <ul className="space-y-2 text-sm">{(data.funds || []).map((f: any) => <li key={f.id}>{f.fund_name} · {formatAmount(f.total_amount)}</li>)}</ul>
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div>{value || "-"}</div>
    </div>
  );
}

export default App;
