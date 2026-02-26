// === VCReview VC Explorer ===
// VC 목록 조회, 필터링, 통계 쿼리 로직
// services/funds/vc-explorer.ts

import { neon } from "@neondatabase/serverless";

type NeonSQL = ((strings: TemplateStringsArray, ...values: any[]) => Promise<Record<string, any>[]>) &
  ((query: string, params?: any[]) => Promise<Record<string, any>[]>);

function getSQL(): NeonSQL {
  return neon(process.env.POSTGRES_URL!) as unknown as NeonSQL;
}

// === VC 목록 파라미터 ===
export interface VCListParams {
  search?: string;
  sort?: "total_aum" | "fund_count" | "active_count" | "name" | "hot_funds" | "avg_fund_size" | "latest_fund_date";
  order?: "asc" | "desc";
  min_aum?: number;
  max_aum?: number;
  min_funds?: number;
  sector?: string;
  active_only?: boolean;
  page?: number;
  limit?: number;
}

// === VC 목록 (필터링 + 정렬 + 페이지네이션) ===
export async function listVCs(params: VCListParams) {
  const sql = getSQL();
  const searchVal = params.search ? `%${params.search}%` : null;

  // Single query: aggregate funds by company_name + collect sectors
  // Filters applied in JS since ~500 VCs is trivially small
  const allVCs = await sql`
    WITH fund_agg AS (
      SELECT
        TRIM(vc_name) as company_name,
        COUNT(*)::int as total_funds,
        COUNT(*) FILTER (WHERE is_active)::int as active_funds,
        COALESCE(SUM(amount_억), 0)::int as total_aum,
        COALESCE(ROUND(AVG(amount_억)::numeric), 0)::int as avg_fund_size,
        MAX(registered_date)::text as latest_fund_date,
        COUNT(*) FILTER (WHERE lifecycle = '적극투자기')::int as hot_funds
      FROM vc_funds,
           LATERAL unnest(string_to_array(company_name, ' / ')) AS vc_name
      WHERE (${searchVal}::text IS NULL OR TRIM(vc_name) ILIKE ${searchVal}::text)
      GROUP BY TRIM(vc_name)
    ),
    sector_agg AS (
      SELECT TRIM(vc_name) as company_name, array_agg(DISTINCT tag ORDER BY tag) as sectors
      FROM vc_funds,
           LATERAL unnest(string_to_array(company_name, ' / ')) AS vc_name,
           LATERAL unnest(sector_tags) AS tag
      WHERE (${searchVal}::text IS NULL OR TRIM(vc_name) ILIKE ${searchVal}::text)
      GROUP BY TRIM(vc_name)
    )
    SELECT
      f.company_name as name,
      f.total_funds,
      f.active_funds,
      f.total_aum,
      f.avg_fund_size,
      f.latest_fund_date,
      f.hot_funds,
      COALESCE(s.sectors, '{}'::text[]) as sectors
    FROM fund_agg f
    LEFT JOIN sector_agg s ON f.company_name = s.company_name
  `;

  // Apply filters in JavaScript (~500 rows, trivially fast)
  let filtered = allVCs.map((vc) => ({
    name: vc.name as string,
    total_funds: Number(vc.total_funds),
    active_funds: Number(vc.active_funds),
    total_aum: Number(vc.total_aum),
    avg_fund_size: Number(vc.avg_fund_size),
    latest_fund_date: vc.latest_fund_date as string | null,
    hot_funds: Number(vc.hot_funds),
    sectors: (vc.sectors || []) as string[],
  }));

  if (params.min_aum) {
    filtered = filtered.filter((vc) => vc.total_aum >= params.min_aum!);
  }
  if (params.max_aum) {
    filtered = filtered.filter((vc) => vc.total_aum <= params.max_aum!);
  }
  if (params.min_funds) {
    filtered = filtered.filter((vc) => vc.total_funds >= params.min_funds!);
  }
  if (params.sector) {
    const sectorFilter = params.sector;
    filtered = filtered.filter((vc) => vc.sectors.includes(sectorFilter));
  }
  if (params.active_only) {
    filtered = filtered.filter((vc) => vc.active_funds > 0);
  }

  // Sort
  const sortKey = params.sort || "total_aum";
  const order = params.order || "desc";
  const multiplier = order === "asc" ? 1 : -1;

  filtered.sort((a, b) => {
    if (sortKey === "name") {
      return multiplier * a.name.localeCompare(b.name, "ko");
    }
    if (sortKey === "fund_count") {
      return multiplier * (a.total_funds - b.total_funds);
    }
    if (sortKey === "active_count") {
      return multiplier * (a.active_funds - b.active_funds);
    }
    if (sortKey === "hot_funds") {
      return multiplier * (a.hot_funds - b.hot_funds);
    }
    if (sortKey === "avg_fund_size") {
      return multiplier * (a.avg_fund_size - b.avg_fund_size);
    }
    if (sortKey === "latest_fund_date") {
      const dateA = a.latest_fund_date ? new Date(a.latest_fund_date).getTime() : 0;
      const dateB = b.latest_fund_date ? new Date(b.latest_fund_date).getTime() : 0;
      return multiplier * (dateA - dateB);
    }
    // Default: total_aum
    return multiplier * (a.total_aum - b.total_aum);
  });

  // Paginate
  const page = params.page || 1;
  const limit = Math.min(params.limit || 20, 100);
  const offset = (page - 1) * limit;
  const paged = filtered.slice(offset, offset + limit);

  return {
    vcs: paged,
    total: filtered.length,
    page,
    limit,
    pages: Math.ceil(filtered.length / limit),
  };
}

// === VC 상세 (펀드 리스트 + 통계 breakdown) ===
export async function getVCDetailWithStats(companyName: string) {
  const sql = getSQL();

  // Fetch all funds where this VC participates (solo + co-GP)
  const funds = await sql`
    SELECT asct_id, company_name, fund_name, registered_date, maturity_date,
           fund_manager_name, account_type, total_amount, amount_억,
           sector_tags, is_govt_matched, is_active, lifecycle
    FROM vc_funds
    WHERE ${companyName} = ANY(string_to_array(company_name, ' / '))
    ORDER BY amount_억 DESC NULLS LAST
  `;

  if (!funds.length) return null;

  // Aggregate metrics
  const totalFunds = funds.length;
  const activeFunds = funds.filter((f) => f.is_active).length;
  const totalAUM = funds.reduce((s, f) => s + (Number(f.amount_억) || 0), 0);
  const avgFundSize = totalFunds > 0 ? Math.round(totalAUM / totalFunds) : 0;
  const hotFunds = funds.filter((f) => f.lifecycle === "적극투자기").length;

  // Collect distinct sectors
  const sectorSet = new Set<string>();
  for (const f of funds) {
    const tags: string[] = f.sector_tags || [];
    for (const tag of tags) sectorSet.add(tag);
  }
  const sectors = Array.from(sectorSet).sort();

  // Stats: by_lifecycle
  const lifecycleMap: Record<string, number> = {};
  for (const f of funds) {
    if (f.lifecycle) {
      lifecycleMap[f.lifecycle] = (lifecycleMap[f.lifecycle] || 0) + 1;
    }
  }

  // Stats: by_sector
  const sectorMap: Record<string, number> = {};
  for (const f of funds) {
    const tags: string[] = f.sector_tags || [];
    for (const tag of tags) {
      sectorMap[tag] = (sectorMap[tag] || 0) + 1;
    }
  }

  // Stats: aum_by_year (registration year → total AUM in 억)
  const aumByYear: Record<string, number> = {};
  for (const f of funds) {
    if (f.registered_date) {
      const year = f.registered_date instanceof Date
        ? String(f.registered_date.getFullYear())
        : String(f.registered_date).slice(0, 4);
      aumByYear[year] = (aumByYear[year] || 0) + (Number(f.amount_억) || 0);
    }
  }

  // Format fund list
  const fundList = funds.map((f) => ({
    id: f.asct_id,
    fund_name: f.fund_name,
    total_amount: Number(f.amount_억) || 0,
    formation_date: f.registered_date ? String(f.registered_date) : null,
    expiry_date: f.maturity_date ? String(f.maturity_date) : null,
    lifecycle: f.lifecycle || null,
    sector_tags: f.sector_tags || [],
    is_govt: Boolean(f.is_govt_matched),
    account_type: f.account_type || null,
    manager: f.fund_manager_name || null,
  }));

  return {
    name: companyName,
    total_funds: totalFunds,
    active_funds: activeFunds,
    total_aum: totalAUM,
    avg_fund_size: avgFundSize,
    sectors,
    hot_funds: hotFunds,
    funds: fundList,
    stats: {
      by_lifecycle: lifecycleMap,
      by_sector: sectorMap,
      aum_by_year: aumByYear,
    },
  };
}

// === VC 대시보드 통계 ===
export async function getVCDashboardStats() {
  const sql = getSQL();

  const [overview, sectorVCs, sizeRows] = await Promise.all([
    // Total VCs, active VCs, total AUM (unnest co-GP names for VC counts; plain SUM for AUM to avoid double-counting)
    sql`
      SELECT
        COUNT(DISTINCT TRIM(vc_name))::int as total_vcs,
        COUNT(DISTINCT TRIM(vc_name)) FILTER (WHERE is_active = TRUE)::int as active_vcs,
        (SELECT COALESCE(SUM(amount_억), 0) FROM vc_funds)::bigint as total_aum
      FROM vc_funds,
           LATERAL unnest(string_to_array(company_name, ' / ')) AS vc_name
    `,
    // Top sectors by distinct VC count (unnest co-GP names)
    sql`
      SELECT tag as sector, COUNT(DISTINCT TRIM(vc_name))::int as vc_count
      FROM vc_funds,
           LATERAL unnest(string_to_array(company_name, ' / ')) AS vc_name,
           LATERAL unnest(sector_tags) AS tag
      GROUP BY tag
      ORDER BY vc_count DESC
      LIMIT 20
    `,
    // Size distribution: group VCs by total AUM bracket (unnest co-GP names)
    sql`
      WITH vc_aum AS (
        SELECT TRIM(vc_name) as vc, COALESCE(SUM(amount_억), 0) as aum
        FROM vc_funds,
             LATERAL unnest(string_to_array(company_name, ' / ')) AS vc_name
        GROUP BY TRIM(vc_name)
      )
      SELECT
        COUNT(*) FILTER (WHERE aum >= 5000)::int as mega,
        COUNT(*) FILTER (WHERE aum >= 1000 AND aum < 5000)::int as large,
        COUNT(*) FILTER (WHERE aum >= 300 AND aum < 1000)::int as mid,
        COUNT(*) FILTER (WHERE aum < 300)::int as small
      FROM vc_aum
    `,
  ]);

  const totalVCs = Number(overview[0].total_vcs);
  const totalAUM = Number(overview[0].total_aum);

  return {
    total_vcs: totalVCs,
    active_vcs: Number(overview[0].active_vcs),
    total_aum: totalAUM,
    avg_aum_per_vc: totalVCs > 0 ? Math.round(totalAUM / totalVCs) : 0,
    top_sectors: sectorVCs.map((r) => ({
      sector: r.sector as string,
      vc_count: Number(r.vc_count),
    })),
    size_distribution: {
      mega: Number(sizeRows[0].mega),
      large: Number(sizeRows[0].large),
      mid: Number(sizeRows[0].mid),
      small: Number(sizeRows[0].small),
    },
  };
}
