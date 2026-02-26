// GET /api/vcs — VC 목록 조회 + 필터링 + 페이지네이션
// api/vcs.ts

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { listVCs } from "../services/vc-explorer.js";

const VALID_SORTS = new Set(["total_aum", "fund_count", "active_count", "name", "hot_funds", "avg_fund_size", "latest_fund_date"]);
const VALID_ORDERS = new Set(["asc", "desc"]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const {
      search,
      sort,
      order,
      min_aum,
      max_aum,
      min_funds,
      sector,
      active_only,
      page,
      limit,
    } = req.query;

    const sortKey = VALID_SORTS.has(sort as string) ? (sort as string) : "total_aum";
    const orderKey = VALID_ORDERS.has(order as string) ? (order as string) : "desc";

    const result = await listVCs({
      search: search as string || undefined,
      sort: sortKey as "total_aum" | "fund_count" | "active_count" | "name" | "hot_funds" | "avg_fund_size" | "latest_fund_date",
      order: orderKey as "asc" | "desc",
      min_aum: min_aum ? parseInt(min_aum as string) : undefined,
      max_aum: max_aum ? parseInt(max_aum as string) : undefined,
      min_funds: min_funds ? parseInt(min_funds as string) : undefined,
      sector: sector as string || undefined,
      active_only: active_only === "true",
      page: page ? parseInt(page as string) : 1,
      limit: limit ? Math.min(parseInt(limit as string), 100) : 20,
    });

    // 30분 캐시 (VC 목록은 자주 안 바뀜)
    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");

    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    console.error("[vcs] Error:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}
