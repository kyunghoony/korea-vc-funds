// === VCReview Fund Explorer ===
// 펀드 목록 조회, 필터링, 통계 쿼리 로직
// services/funds/fund-explorer.ts

import { neon } from "@neondatabase/serverless";

type NeonSQL = ((strings: TemplateStringsArray, ...values: any[]) => Promise<Record<string, any>[]>) &
  ((query: string, params?: any[]) => Promise<Record<string, any>[]>);

function getSQL(): NeonSQL {
  return neon(process.env.POSTGRES_URL!) as unknown as NeonSQL;
}

// === Sort keys ===
export type FundSortKey =
  | "amount_desc" | "amount_asc"
  | "registered_desc" | "registered_asc"
  | "maturity_desc" | "maturity_asc"
  | "company_asc" | "company_desc"
  | "fund_name_asc" | "fund_name_desc"
  | "govt_desc" | "govt_asc"
  // Legacy short names (backward compat)
  | "amount" | "maturity" | "registered";

// Normalize legacy sort keys
function normalizeSort(sort: string): string {
  if (sort === "amount") return "amount_desc";
  if (sort === "maturity") return "maturity_desc";
  if (sort === "registered") return "registered_desc";
  return sort;
}

// === 펀드 목록 (필터링 + 페이지네이션) ===
export interface FundListParams {
  sector?: string;
  stage?: string;
  active?: boolean;
  govt?: boolean;
  company?: string;
  minAmount?: number;
  maxAmount?: number;
  lifecycle?: string;
  region?: string;
  sort?: FundSortKey;
  page?: number;
  limit?: number;
}

export async function listFunds(params: FundListParams) {
  const sql = getSQL();
  const {
    sector,
    stage,
    active = true,
    govt,
    company,
    minAmount,
    maxAmount,
    lifecycle,
    region,
    sort = "amount_desc",
    page = 1,
    limit = 20,
  } = params;

  const offset = (page - 1) * limit;

  const sectorVal = sector || null;
  const stageVal = stage || null;
  const companyVal = company ? `%${company}%` : null;
  const minAmountVal = minAmount || null;
  const maxAmountVal = maxAmount || null;
  const lifecycleVal = lifecycle || null;
  const regionVal = region || null;
  const govtBool = govt ? true : false;

  // Count query (no ORDER BY needed) — single tagged template
  const countResult = await sql`
    SELECT COUNT(*) as total FROM vc_funds
    WHERE (${active} = false OR is_active = TRUE)
      AND (${govtBool} = false OR is_govt_matched = TRUE)
      AND (${sectorVal}::text IS NULL OR ${sectorVal}::text = ANY(sector_tags))
      AND (${stageVal}::text IS NULL OR ${stageVal}::text = ANY(all_tags))
      AND (${companyVal}::text IS NULL OR company_name ILIKE ${companyVal}::text)
      AND (${minAmountVal}::int IS NULL OR amount_억 >= ${minAmountVal}::int)
      AND (${maxAmountVal}::int IS NULL OR amount_억 <= ${maxAmountVal}::int)
      AND (${lifecycleVal}::text IS NULL OR lifecycle = ${lifecycleVal}::text)
      AND (${regionVal}::text IS NULL OR ${regionVal}::text = ANY(sector_tags))
  `;

  // Data query — must use tagged template per sort option (neon driver requires it)
  const dataResult = await queryFundsSorted(
    sql, normalizeSort(sort),
    active, govtBool, sectorVal, stageVal, companyVal,
    minAmountVal, maxAmountVal, lifecycleVal, regionVal,
    limit, offset,
  );

  const total = parseInt(countResult[0].total as string);

  return {
    funds: dataResult,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
}

// Helper: run data query with the right ORDER BY via tagged templates
// Each branch is a separate tagged template because neon can't parameterize ORDER BY
async function queryFundsSorted(
  sql: NeonSQL,
  sort: string,
  active: boolean,
  govtBool: boolean,
  sectorVal: string | null,
  stageVal: string | null,
  companyVal: string | null,
  minAmountVal: number | null,
  maxAmountVal: number | null,
  lifecycleVal: string | null,
  regionVal: string | null,
  limit: number,
  offset: number,
) {
  // Macro-like: each branch has the same WHERE, different ORDER BY
  // Using tagged template literals for safe parameter binding

  if (sort === "amount_asc") {
    return sql`
      SELECT asct_id, company_name, fund_name, registered_date, maturity_date,
             fund_manager_name, support_type, account_type, total_amount, amount_억,
             sector_tags, is_govt_matched, is_active, lifecycle, has_sector
      FROM vc_funds
      WHERE (${active} = false OR is_active = TRUE)
        AND (${govtBool} = false OR is_govt_matched = TRUE)
        AND (${sectorVal}::text IS NULL OR ${sectorVal}::text = ANY(sector_tags))
        AND (${stageVal}::text IS NULL OR ${stageVal}::text = ANY(all_tags))
        AND (${companyVal}::text IS NULL OR company_name ILIKE ${companyVal}::text)
        AND (${minAmountVal}::int IS NULL OR amount_억 >= ${minAmountVal}::int)
        AND (${maxAmountVal}::int IS NULL OR amount_억 <= ${maxAmountVal}::int)
        AND (${lifecycleVal}::text IS NULL OR lifecycle = ${lifecycleVal}::text)
        AND (${regionVal}::text IS NULL OR ${regionVal}::text = ANY(sector_tags))
      ORDER BY amount_억 ASC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  if (sort === "registered_desc") {
    return sql`
      SELECT asct_id, company_name, fund_name, registered_date, maturity_date,
             fund_manager_name, support_type, account_type, total_amount, amount_억,
             sector_tags, is_govt_matched, is_active, lifecycle, has_sector
      FROM vc_funds
      WHERE (${active} = false OR is_active = TRUE)
        AND (${govtBool} = false OR is_govt_matched = TRUE)
        AND (${sectorVal}::text IS NULL OR ${sectorVal}::text = ANY(sector_tags))
        AND (${stageVal}::text IS NULL OR ${stageVal}::text = ANY(all_tags))
        AND (${companyVal}::text IS NULL OR company_name ILIKE ${companyVal}::text)
        AND (${minAmountVal}::int IS NULL OR amount_억 >= ${minAmountVal}::int)
        AND (${maxAmountVal}::int IS NULL OR amount_억 <= ${maxAmountVal}::int)
        AND (${lifecycleVal}::text IS NULL OR lifecycle = ${lifecycleVal}::text)
        AND (${regionVal}::text IS NULL OR ${regionVal}::text = ANY(sector_tags))
      ORDER BY registered_date DESC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  if (sort === "registered_asc") {
    return sql`
      SELECT asct_id, company_name, fund_name, registered_date, maturity_date,
             fund_manager_name, support_type, account_type, total_amount, amount_억,
             sector_tags, is_govt_matched, is_active, lifecycle, has_sector
      FROM vc_funds
      WHERE (${active} = false OR is_active = TRUE)
        AND (${govtBool} = false OR is_govt_matched = TRUE)
        AND (${sectorVal}::text IS NULL OR ${sectorVal}::text = ANY(sector_tags))
        AND (${stageVal}::text IS NULL OR ${stageVal}::text = ANY(all_tags))
        AND (${companyVal}::text IS NULL OR company_name ILIKE ${companyVal}::text)
        AND (${minAmountVal}::int IS NULL OR amount_억 >= ${minAmountVal}::int)
        AND (${maxAmountVal}::int IS NULL OR amount_억 <= ${maxAmountVal}::int)
        AND (${lifecycleVal}::text IS NULL OR lifecycle = ${lifecycleVal}::text)
        AND (${regionVal}::text IS NULL OR ${regionVal}::text = ANY(sector_tags))
      ORDER BY registered_date ASC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  if (sort === "maturity_desc") {
    return sql`
      SELECT asct_id, company_name, fund_name, registered_date, maturity_date,
             fund_manager_name, support_type, account_type, total_amount, amount_억,
             sector_tags, is_govt_matched, is_active, lifecycle, has_sector
      FROM vc_funds
      WHERE (${active} = false OR is_active = TRUE)
        AND (${govtBool} = false OR is_govt_matched = TRUE)
        AND (${sectorVal}::text IS NULL OR ${sectorVal}::text = ANY(sector_tags))
        AND (${stageVal}::text IS NULL OR ${stageVal}::text = ANY(all_tags))
        AND (${companyVal}::text IS NULL OR company_name ILIKE ${companyVal}::text)
        AND (${minAmountVal}::int IS NULL OR amount_억 >= ${minAmountVal}::int)
        AND (${maxAmountVal}::int IS NULL OR amount_억 <= ${maxAmountVal}::int)
        AND (${lifecycleVal}::text IS NULL OR lifecycle = ${lifecycleVal}::text)
        AND (${regionVal}::text IS NULL OR ${regionVal}::text = ANY(sector_tags))
      ORDER BY maturity_date DESC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  if (sort === "maturity_asc") {
    return sql`
      SELECT asct_id, company_name, fund_name, registered_date, maturity_date,
             fund_manager_name, support_type, account_type, total_amount, amount_억,
             sector_tags, is_govt_matched, is_active, lifecycle, has_sector
      FROM vc_funds
      WHERE (${active} = false OR is_active = TRUE)
        AND (${govtBool} = false OR is_govt_matched = TRUE)
        AND (${sectorVal}::text IS NULL OR ${sectorVal}::text = ANY(sector_tags))
        AND (${stageVal}::text IS NULL OR ${stageVal}::text = ANY(all_tags))
        AND (${companyVal}::text IS NULL OR company_name ILIKE ${companyVal}::text)
        AND (${minAmountVal}::int IS NULL OR amount_억 >= ${minAmountVal}::int)
        AND (${maxAmountVal}::int IS NULL OR amount_억 <= ${maxAmountVal}::int)
        AND (${lifecycleVal}::text IS NULL OR lifecycle = ${lifecycleVal}::text)
        AND (${regionVal}::text IS NULL OR ${regionVal}::text = ANY(sector_tags))
      ORDER BY maturity_date ASC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  if (sort === "company_asc") {
    return sql`
      SELECT asct_id, company_name, fund_name, registered_date, maturity_date,
             fund_manager_name, support_type, account_type, total_amount, amount_억,
             sector_tags, is_govt_matched, is_active, lifecycle, has_sector
      FROM vc_funds
      WHERE (${active} = false OR is_active = TRUE)
        AND (${govtBool} = false OR is_govt_matched = TRUE)
        AND (${sectorVal}::text IS NULL OR ${sectorVal}::text = ANY(sector_tags))
        AND (${stageVal}::text IS NULL OR ${stageVal}::text = ANY(all_tags))
        AND (${companyVal}::text IS NULL OR company_name ILIKE ${companyVal}::text)
        AND (${minAmountVal}::int IS NULL OR amount_억 >= ${minAmountVal}::int)
        AND (${maxAmountVal}::int IS NULL OR amount_억 <= ${maxAmountVal}::int)
        AND (${lifecycleVal}::text IS NULL OR lifecycle = ${lifecycleVal}::text)
        AND (${regionVal}::text IS NULL OR ${regionVal}::text = ANY(sector_tags))
      ORDER BY company_name ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  if (sort === "company_desc") {
    return sql`
      SELECT asct_id, company_name, fund_name, registered_date, maturity_date,
             fund_manager_name, support_type, account_type, total_amount, amount_억,
             sector_tags, is_govt_matched, is_active, lifecycle, has_sector
      FROM vc_funds
      WHERE (${active} = false OR is_active = TRUE)
        AND (${govtBool} = false OR is_govt_matched = TRUE)
        AND (${sectorVal}::text IS NULL OR ${sectorVal}::text = ANY(sector_tags))
        AND (${stageVal}::text IS NULL OR ${stageVal}::text = ANY(all_tags))
        AND (${companyVal}::text IS NULL OR company_name ILIKE ${companyVal}::text)
        AND (${minAmountVal}::int IS NULL OR amount_억 >= ${minAmountVal}::int)
        AND (${maxAmountVal}::int IS NULL OR amount_억 <= ${maxAmountVal}::int)
        AND (${lifecycleVal}::text IS NULL OR lifecycle = ${lifecycleVal}::text)
        AND (${regionVal}::text IS NULL OR ${regionVal}::text = ANY(sector_tags))
      ORDER BY company_name DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  if (sort === "fund_name_asc") {
    return sql`
      SELECT asct_id, company_name, fund_name, registered_date, maturity_date,
             fund_manager_name, support_type, account_type, total_amount, amount_억,
             sector_tags, is_govt_matched, is_active, lifecycle, has_sector
      FROM vc_funds
      WHERE (${active} = false OR is_active = TRUE)
        AND (${govtBool} = false OR is_govt_matched = TRUE)
        AND (${sectorVal}::text IS NULL OR ${sectorVal}::text = ANY(sector_tags))
        AND (${stageVal}::text IS NULL OR ${stageVal}::text = ANY(all_tags))
        AND (${companyVal}::text IS NULL OR company_name ILIKE ${companyVal}::text)
        AND (${minAmountVal}::int IS NULL OR amount_억 >= ${minAmountVal}::int)
        AND (${maxAmountVal}::int IS NULL OR amount_억 <= ${maxAmountVal}::int)
        AND (${lifecycleVal}::text IS NULL OR lifecycle = ${lifecycleVal}::text)
        AND (${regionVal}::text IS NULL OR ${regionVal}::text = ANY(sector_tags))
      ORDER BY fund_name ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  if (sort === "fund_name_desc") {
    return sql`
      SELECT asct_id, company_name, fund_name, registered_date, maturity_date,
             fund_manager_name, support_type, account_type, total_amount, amount_억,
             sector_tags, is_govt_matched, is_active, lifecycle, has_sector
      FROM vc_funds
      WHERE (${active} = false OR is_active = TRUE)
        AND (${govtBool} = false OR is_govt_matched = TRUE)
        AND (${sectorVal}::text IS NULL OR ${sectorVal}::text = ANY(sector_tags))
        AND (${stageVal}::text IS NULL OR ${stageVal}::text = ANY(all_tags))
        AND (${companyVal}::text IS NULL OR company_name ILIKE ${companyVal}::text)
        AND (${minAmountVal}::int IS NULL OR amount_억 >= ${minAmountVal}::int)
        AND (${maxAmountVal}::int IS NULL OR amount_억 <= ${maxAmountVal}::int)
        AND (${lifecycleVal}::text IS NULL OR lifecycle = ${lifecycleVal}::text)
        AND (${regionVal}::text IS NULL OR ${regionVal}::text = ANY(sector_tags))
      ORDER BY fund_name DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  if (sort === "govt_desc") {
    return sql`
      SELECT asct_id, company_name, fund_name, registered_date, maturity_date,
             fund_manager_name, support_type, account_type, total_amount, amount_억,
             sector_tags, is_govt_matched, is_active, lifecycle, has_sector
      FROM vc_funds
      WHERE (${active} = false OR is_active = TRUE)
        AND (${govtBool} = false OR is_govt_matched = TRUE)
        AND (${sectorVal}::text IS NULL OR ${sectorVal}::text = ANY(sector_tags))
        AND (${stageVal}::text IS NULL OR ${stageVal}::text = ANY(all_tags))
        AND (${companyVal}::text IS NULL OR company_name ILIKE ${companyVal}::text)
        AND (${minAmountVal}::int IS NULL OR amount_억 >= ${minAmountVal}::int)
        AND (${maxAmountVal}::int IS NULL OR amount_억 <= ${maxAmountVal}::int)
        AND (${lifecycleVal}::text IS NULL OR lifecycle = ${lifecycleVal}::text)
        AND (${regionVal}::text IS NULL OR ${regionVal}::text = ANY(sector_tags))
      ORDER BY is_govt_matched DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  if (sort === "govt_asc") {
    return sql`
      SELECT asct_id, company_name, fund_name, registered_date, maturity_date,
             fund_manager_name, support_type, account_type, total_amount, amount_억,
             sector_tags, is_govt_matched, is_active, lifecycle, has_sector
      FROM vc_funds
      WHERE (${active} = false OR is_active = TRUE)
        AND (${govtBool} = false OR is_govt_matched = TRUE)
        AND (${sectorVal}::text IS NULL OR ${sectorVal}::text = ANY(sector_tags))
        AND (${stageVal}::text IS NULL OR ${stageVal}::text = ANY(all_tags))
        AND (${companyVal}::text IS NULL OR company_name ILIKE ${companyVal}::text)
        AND (${minAmountVal}::int IS NULL OR amount_억 >= ${minAmountVal}::int)
        AND (${maxAmountVal}::int IS NULL OR amount_억 <= ${maxAmountVal}::int)
        AND (${lifecycleVal}::text IS NULL OR lifecycle = ${lifecycleVal}::text)
        AND (${regionVal}::text IS NULL OR ${regionVal}::text = ANY(sector_tags))
      ORDER BY is_govt_matched ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  // Default: amount_desc
  return sql`
    SELECT asct_id, company_name, fund_name, registered_date, maturity_date,
           fund_manager_name, support_type, account_type, total_amount, amount_억,
           sector_tags, is_govt_matched, is_active, lifecycle, has_sector
    FROM vc_funds
    WHERE (${active} = false OR is_active = TRUE)
      AND (${govtBool} = false OR is_govt_matched = TRUE)
      AND (${sectorVal}::text IS NULL OR ${sectorVal}::text = ANY(sector_tags))
      AND (${stageVal}::text IS NULL OR ${stageVal}::text = ANY(all_tags))
      AND (${companyVal}::text IS NULL OR company_name ILIKE ${companyVal}::text)
      AND (${minAmountVal}::int IS NULL OR amount_억 >= ${minAmountVal}::int)
      AND (${maxAmountVal}::int IS NULL OR amount_억 <= ${maxAmountVal}::int)
      AND (${lifecycleVal}::text IS NULL OR lifecycle = ${lifecycleVal}::text)
      AND (${regionVal}::text IS NULL OR ${regionVal}::text = ANY(sector_tags))
    ORDER BY amount_억 DESC NULLS LAST
    LIMIT ${limit} OFFSET ${offset}
  `;
}

// === 펀드 상세 ===
export async function getFundDetail(asctId: string) {
  const sql = getSQL();

  const fundResult = await sql`
    SELECT * FROM vc_funds WHERE asct_id = ${asctId}
  `;
  if (!fundResult.length) return null;

  const fund = fundResult[0];
  const relatedResult = await sql`
    SELECT asct_id, fund_name, amount_억, maturity_date, is_active, sector_tags
    FROM vc_funds
    WHERE company_name = ${fund.company_name} AND asct_id != ${asctId}
    ORDER BY registered_date DESC
    LIMIT 10
  `;

  return { fund, relatedFunds: relatedResult };
}

// === 대시보드 통계 ===
export async function getFundStats() {
  const sql = getSQL();

  const [overview, sectors, topVCs] = await Promise.all([
    sql`
      SELECT
        COUNT(*) as total_funds,
        COUNT(*) FILTER (WHERE is_active) as active_funds,
        COUNT(*) FILTER (WHERE has_sector) as tagged_funds,
        COUNT(*) FILTER (WHERE is_govt_matched) as govt_funds,
        (SELECT COUNT(DISTINCT TRIM(vc_name))
         FROM vc_funds, LATERAL unnest(string_to_array(company_name, ' / ')) AS vc_name
        ) as total_vcs,
        SUM(total_amount) FILTER (WHERE is_active) as active_aum,
        COUNT(*) FILTER (WHERE lifecycle = '적극투자기' AND is_active) as hot_funds
      FROM vc_funds
    `,
    sql`
      SELECT unnest(sector_tags) as sector, COUNT(*) as count
      FROM vc_funds
      WHERE is_active = TRUE AND has_sector = TRUE
      GROUP BY sector
      ORDER BY count DESC
      LIMIT 20
    `,
    sql`
      SELECT TRIM(vc_name) as company_name,
        COUNT(*) as funds,
        COUNT(*) FILTER (WHERE is_active) as active,
        SUM(total_amount) as aum
      FROM vc_funds,
           LATERAL unnest(string_to_array(company_name, ' / ')) AS vc_name
      GROUP BY TRIM(vc_name)
      ORDER BY aum DESC
      LIMIT 20
    `,
  ]);

  return {
    overview: overview[0],
    sectors,
    topVCs,
  };
}

// === VC사 상세 (펀드 집계) ===
export async function getVCDetail(companyName: string) {
  const sql = getSQL();

  // " / " 구분자 기반 split → 배열에 해당 VC명이 포함되는 모든 펀드 조회
  const funds = await sql`
    SELECT asct_id, company_name, fund_name, registered_date, maturity_date,
           fund_manager_name, support_type, account_type, total_amount, amount_억,
           sector_tags, all_tags, is_govt_matched, is_active, lifecycle, has_sector,
           hurdle_rate
    FROM vc_funds
    WHERE ${companyName} = ANY(string_to_array(company_name, ' / '))
    ORDER BY total_amount DESC
  `;

  if (!funds.length) return null;

  // Application-level aggregation
  const totalAUM = funds.reduce((s, f) => s + (parseFloat(f.amount_억) || 0), 0);
  const activeFunds = funds.filter((f) => f.is_active);
  const activeAUM = activeFunds.reduce((s, f) => s + (parseFloat(f.amount_억) || 0), 0);
  const avgFundSize = Math.round(totalAUM / funds.length);

  // Sector focus — frequency count from sector_tags
  const sectorMap = new Map<string, number>();
  for (const f of funds) {
    const tags: string[] = f.sector_tags || [];
    for (const tag of tags) {
      sectorMap.set(tag, (sectorMap.get(tag) || 0) + 1);
    }
  }
  const sectorFocus = Array.from(sectorMap.entries())
    .map(([sector, count]) => ({ sector, count }))
    .sort((a, b) => b.count - a.count);

  // Stage mix — extract from sector_tags/all_tags
  const stageKeywords = ['초기투자', '성장투자', '세컨더리'];
  const stageCount = new Map<string, number>();
  for (const f of funds) {
    const allTags: string[] = [...(f.sector_tags || []), ...(f.all_tags || [])];
    for (const kw of stageKeywords) {
      if (allTags.includes(kw)) {
        stageCount.set(kw, (stageCount.get(kw) || 0) + 1);
      }
    }
  }
  const stageMix = Array.from(stageCount.entries())
    .map(([stage, count]) => ({ stage, count }))
    .sort((a, b) => b.count - a.count);

  // Lifecycle distribution
  const lifecycleMap = new Map<string, number>();
  for (const f of funds) {
    if (f.lifecycle) {
      lifecycleMap.set(f.lifecycle, (lifecycleMap.get(f.lifecycle) || 0) + 1);
    }
  }
  const lifecycleDist = Array.from(lifecycleMap.entries())
    .map(([lifecycle, count]) => ({ lifecycle, count }))
    .sort((a, b) => b.count - a.count);

  // Government matching ratio
  const govtMatched = funds.filter((f) => f.is_govt_matched).length;

  // Account types for govt-matched funds
  const accountMap = new Map<string, number>();
  for (const f of funds) {
    if (f.is_govt_matched && f.account_type) {
      accountMap.set(f.account_type, (accountMap.get(f.account_type) || 0) + 1);
    }
  }
  const accountTypes = Array.from(accountMap.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  // Average hurdle rate (exclude "0" and empty)
  const hurdleRates = funds
    .map((f) => parseFloat(f.hurdle_rate))
    .filter((v) => !isNaN(v) && v > 0);
  const avgHurdleRate = hurdleRates.length > 0
    ? Math.round((hurdleRates.reduce((s, v) => s + v, 0) / hurdleRates.length) * 100) / 100
    : null;

  // Fund managers — parse name before parenthesis, deduplicate
  const managerSet = new Set<string>();
  for (const f of funds) {
    if (f.fund_manager_name) {
      const name = f.fund_manager_name.split('(')[0].trim();
      if (name) managerSet.add(name);
    }
  }
  const managers = Array.from(managerSet);

  // Registration history — year grouping
  const regMap = new Map<string, number>();
  for (const f of funds) {
    if (f.registered_date) {
      const year = f.registered_date instanceof Date
        ? String(f.registered_date.getFullYear())
        : String(f.registered_date).slice(0, 4);
      regMap.set(year, (regMap.get(year) || 0) + 1);
    }
  }
  const registrationHistory = Array.from(regMap.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year.localeCompare(b.year));

  // Maturity schedule — future only, year grouping
  const now = new Date();
  const matMap = new Map<string, number>();
  for (const f of funds) {
    if (f.maturity_date) {
      const matDate = new Date(f.maturity_date);
      if (matDate > now) {
        const year = f.maturity_date instanceof Date
          ? String(f.maturity_date.getFullYear())
          : String(f.maturity_date).slice(0, 4);
        matMap.set(year, (matMap.get(year) || 0) + 1);
      }
    }
  }
  const maturitySchedule = Array.from(matMap.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year.localeCompare(b.year));

  // co-GP partners — extract from company_name containing " / ", exclude self
  const coGPSet = new Set<string>();
  for (const f of funds) {
    if (f.company_name.includes(' / ')) {
      const parts = f.company_name.split(' / ');
      for (const p of parts) {
        const trimmed = p.trim();
        if (trimmed && trimmed !== companyName) {
          coGPSet.add(trimmed);
        }
      }
    }
  }
  const coGPPartners = Array.from(coGPSet);

  // Fund summary list
  const fundsList = funds.map((f) => ({
    asct_id: f.asct_id,
    company_name: f.company_name,
    fund_name: f.fund_name,
    amount_억: parseFloat(f.amount_억) || 0,
    registered_date: f.registered_date,
    maturity_date: f.maturity_date,
    lifecycle: f.lifecycle,
    sector_tags: f.sector_tags || [],
    is_co_gp: f.company_name.includes(' / '),
  }));

  return {
    company: companyName,
    totalAUM: Math.round(totalAUM),
    activeAUM: Math.round(activeAUM),
    totalFunds: funds.length,
    activeFunds: activeFunds.length,
    avgFundSize,
    avgHurdleRate,
    sectorFocus,
    stageMix,
    lifecycleDist,
    govtMatchRatio: { matched: govtMatched, total: funds.length },
    accountTypes,
    managers,
    registrationHistory,
    maturitySchedule,
    coGPPartners,
    funds: fundsList,
  };
}

// === 섹터 목록 (필터 UI용) ===
export async function getSectorList() {
  const sql = getSQL();

  const result = await sql`
    SELECT unnest(sector_tags) as sector, COUNT(*) as count
    FROM vc_funds
    WHERE is_active = TRUE
    GROUP BY sector
    HAVING COUNT(*) >= 3
    ORDER BY count DESC
  `;

  return result;
}
