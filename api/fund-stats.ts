// GET /api/fund-stats — 펀드 대시보드 통계
// api/fund-stats.ts

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFundStats } from "../services/fund-explorer";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const stats = await getFundStats();

    // 1시간 캐시 (대시보드 데이터는 자주 안 바뀜)
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=7200");

    return res.status(200).json(stats);
  } catch (error: any) {
    console.error("[fund-stats] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
