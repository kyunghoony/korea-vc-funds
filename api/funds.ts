// GET /api/funds — 펀드 목록 조회 + 필터링
// api/funds.ts

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { listFunds, getSectorList } from "../services/fund-explorer";
import type { FundSortKey } from "../services/fund-explorer";

const VALID_SORTS = new Set([
  "amount_desc", "amount_asc",
  "registered_desc", "registered_asc",
  "maturity_desc", "maturity_asc",
  "company_asc", "company_desc",
  "fund_name_asc", "fund_name_desc",
  "govt_desc", "govt_asc",
  "amount", "maturity", "registered",
]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      sector,
      stage,
      active,
      govt,
      company,
      min_amount,
      max_amount,
      lifecycle,
      region,
      sort,
      page,
      limit,
      type,
    } = req.query;

    // GET /api/funds?type=sectors → 섹터 목록 반환
    if (type === "sectors") {
      const sectors = await getSectorList();
      return res.status(200).json({ sectors });
    }

    // Validate sort param
    const sortKey = (sort as string) || "amount_desc";
    const validSort: FundSortKey = VALID_SORTS.has(sortKey) ? sortKey as FundSortKey : "amount_desc";

    // GET /api/funds → 펀드 목록
    const result = await listFunds({
      sector: sector as string,
      stage: stage as string,
      active: active !== "false",
      govt: govt === "true",
      company: company as string,
      minAmount: min_amount ? parseInt(min_amount as string) : undefined,
      maxAmount: max_amount ? parseInt(max_amount as string) : undefined,
      lifecycle: lifecycle as string,
      region: region as string,
      sort: validSort,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? Math.min(parseInt(limit as string), 50) : 20,
    });

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[funds] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
