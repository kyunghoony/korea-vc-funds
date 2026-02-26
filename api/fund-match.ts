// POST /api/fund-match — 딜 분석 결과 → 매칭 펀드 추천
// api/fund-match.ts

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { matchFunds, extractDealSignals } from "../services/funds/fund-matcher.js";
import type { DealSignals } from "../services/funds/fund-matcher.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body;

    // 두 가지 입력 모드 지원:
    // 1) dealSignals 직접 전달 (프론트엔드에서 구조화된 시그널)
    // 2) analysis 전달 (Secretary Agent 출력 → extractDealSignals로 변환)
    let signals: DealSignals;

    if (body.dealSignals) {
      signals = body.dealSignals;
    } else if (body.analysis) {
      signals = extractDealSignals(body.analysis);
    } else {
      return res.status(400).json({
        error: "dealSignals or analysis is required",
        example: {
          dealSignals: {
            sectors: ["AI/SW", "핀테크/금융"],
            stage: "초기투자",
            amount_needed: 30,
          },
        },
      });
    }

    if (!signals.sectors?.length) {
      return res.status(400).json({ error: "At least one sector is required" });
    }

    const options = {
      limit: body.limit || 10,
      activeOnly: body.activeOnly !== false,
      govtOnly: body.govtOnly || false,
    };

    const matches = await matchFunds(signals, options);

    return res.status(200).json({
      matches,
      count: matches.length,
      signals, // 디버깅/투명성용
    });
  } catch (error: any) {
    console.error("[fund-match] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
