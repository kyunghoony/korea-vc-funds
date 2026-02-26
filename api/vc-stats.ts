// GET /api/vc-stats — VC 대시보드 통계
// api/vc-stats.ts

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getVCDashboardStats } from "../services/vc-explorer.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const stats = await getVCDashboardStats();

    // 1시간 캐시 (대시보드 데이터는 자주 안 바뀜)
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=7200");

    return res.status(200).json({ success: true, data: stats });
  } catch (error: any) {
    console.error("[vc-stats] Error:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}
