// GET /api/vc-detail?company=에이티넘인베스트먼트 — VC사 상세 (펀드 집계)
// GET /api/vc-detail?name=에이티넘인베스트먼트 — 동일 (name 파라미터도 지원)
// api/vc-detail.ts

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getVCDetail } from "../services/fund-explorer.js";
import { getVCDetailWithStats } from "../services/vc-explorer.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { company, name, format } = req.query;
    const vcName = (name || company) as string;

    if (!vcName) {
      return res.status(400).json({ success: false, error: "name or company (VC name) is required" });
    }

    // format=stats → 새 포맷 (funds + stats breakdown)
    // 기본 → 기존 포맷 (backward compat)
    if (format === "stats" || name) {
      const result = await getVCDetailWithStats(vcName);
      if (!result) {
        return res.status(404).json({ success: false, error: "VC not found" });
      }
      return res.status(200).json({ success: true, data: result });
    }

    // Legacy format (backward compat for existing FundDB tab)
    const result = await getVCDetail(vcName);
    if (!result) {
      return res.status(404).json({ error: "VC not found" });
    }
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[vc-detail] Error:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}
