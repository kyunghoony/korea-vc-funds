// GET /api/fund-detail?id=AS20220036 — 펀드 상세 + 같은 VC사 펀드 목록
// api/fund-detail.ts

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFundDetail } from "../services/fund-explorer";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { id } = req.query;

    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "id (asct_id) is required" });
    }

    const result = await getFundDetail(id);

    if (!result) {
      return res.status(404).json({ error: "Fund not found" });
    }

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[fund-detail] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
