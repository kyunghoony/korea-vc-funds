// === VCReview Fund Matcher ===
// 딜 분석 결과 → 매칭 펀드 추천 알고리즘
// services/funds/fund-matcher.ts

import { neon } from "@neondatabase/serverless";

// === 1. 딜 시그널 추출 (Secretary Agent 출력 기반) ===
export interface DealSignals {
  sectors: string[];       // ["AI/SW", "핀테크/금융"]
  stage: string;           // "초기투자" | "성장투자" | "세컨더리"
  business_model: string;  // "SaaS" | "Marketplace" | "D2C" 등
  geo: string[];           // ["해외", "동남아"]
  amount_needed?: number;  // 투자 희망 금액 (억)
  keywords?: string[];     // 추가 키워드
}

export interface MatchedFund {
  asct_id: string;
  company_name: string;
  fund_name: string;
  fund_manager_name: string;
  amount_억: number;
  maturity_date: string;
  lifecycle: string;
  match_score: number;
  match_reasons: MatchReason[];
  is_govt_matched: boolean;
  account_type: string;
}

export interface MatchReason {
  type: "sector" | "stage" | "account" | "lifecycle" | "keyword" | "size";
  description: string;
  score: number;
}

// === 2. 섹터 매핑 (딜 키워드 → 펀드 태그) ===
const SECTOR_SYNONYMS: Record<string, string[]> = {
  "AI/SW": ["AI/SW", "딥테크", "반도체"],
  "핀테크/금융": ["핀테크/금융", "AI/SW"],
  "바이오": ["바이오"],
  "콘텐츠/엔터": ["콘텐츠/엔터", "영화/영상", "게임"],
  "에듀테크/교육": ["에듀테크/교육", "AI/SW", "콘텐츠/엔터"],
  "친환경/ESG": ["친환경/ESG", "이차전지/배터리"],
  "모빌리티": ["모빌리티", "AI/SW"],
  "푸드/농업": ["푸드/농업"],
  "뷰티/패션": ["뷰티/패션", "콘텐츠/엔터"],
  "우주/항공": ["우주/항공", "딥테크", "국방/안보"],
  "반도체": ["반도체", "소", "딥테크"],
  "로봇/자동화": ["로봇/자동화", "딥테크", "AI/SW"],
};

// === 3. 계정구분 → 섹터 매핑 ===
const ACCOUNT_SECTOR_AFFINITY: Record<string, string[]> = {
  "문화계정": ["콘텐츠/엔터", "영화/영상", "게임"],
  "과기정통계정": ["AI/SW", "딥테크", "반도체"],
  "보건계정": ["바이오"],
  "환경계정": ["친환경/ESG"],
  "소재부품장비계정": ["소부장", "반도체"],
  "관광계정": ["관광/여행"],
  "스포츠계정": ["스포츠"],
  "해양계정": ["해양/수산"],
  "교육계정": ["에듀테크/교육"],
  "국토교통혁신계정": ["모빌리티", "건설/부동산"],
};

// === 4. 매칭 스코어 계산 ===
function calculateMatchScore(deal: DealSignals, fund: any): MatchedFund | null {
  const reasons: MatchReason[] = [];
  let totalScore = 0;

  const fundTags: string[] = fund.sector_tags || [];
  const allTags: string[] = fund.all_tags || [];

  // (A) 섹터 매칭 — 가중치 40점
  let sectorScore = 0;
  for (const dealSector of deal.sectors) {
    const expandedSectors = SECTOR_SYNONYMS[dealSector] || [dealSector];
    for (const expanded of expandedSectors) {
      if (fundTags.includes(expanded)) {
        const isPrimary = expanded === dealSector;
        const pts = isPrimary ? 40 : 20;
        sectorScore = Math.max(sectorScore, pts);
        reasons.push({
          type: "sector",
          description: isPrimary
            ? `섹터 직접 매칭: ${expanded}`
            : `연관 섹터: ${dealSector} → ${expanded}`,
          score: pts,
        });
      }
    }
  }
  // 계정구분으로 추가 섹터 매칭
  const acctSectors = ACCOUNT_SECTOR_AFFINITY[fund.account_type] || [];
  for (const dealSector of deal.sectors) {
    if (acctSectors.includes(dealSector)) {
      sectorScore = Math.max(sectorScore, 35);
      reasons.push({
        type: "account",
        description: `계정구분 매칭: ${fund.account_type} → ${dealSector}`,
        score: 35,
      });
    }
  }
  totalScore += sectorScore;

  // (B) 스테이지 매칭 — 가중치 25점
  if (deal.stage && allTags.includes(deal.stage)) {
    totalScore += 25;
    reasons.push({
      type: "stage",
      description: `투자 스테이지 매칭: ${deal.stage}`,
      score: 25,
    });
  } else if (deal.stage === "초기투자" && allTags.includes("엔젤")) {
    totalScore += 20;
    reasons.push({
      type: "stage",
      description: "엔젤 계정 — 초기 투자 특화",
      score: 20,
    });
  }

  // (C) 라이프사이클 — 가중치 20점
  if (fund.lifecycle === "적극투자기") {
    totalScore += 20;
    reasons.push({
      type: "lifecycle",
      description: "적극 투자 집행기 (결성 2년 이내)",
      score: 20,
    });
  } else if (fund.lifecycle === "중기") {
    totalScore += 10;
    reasons.push({
      type: "lifecycle",
      description: "중기 (결성 2~4년)",
      score: 10,
    });
  }

  // (D) 펀드 사이즈 적합성 — 가중치 15점
  if (deal.amount_needed) {
    const fundSize = fund.amount_억 || 0;
    // 일반적으로 펀드 사이즈의 5~15%가 1건 투자 적정 금액
    const minTicket = fundSize * 0.03;
    const maxTicket = fundSize * 0.2;
    if (deal.amount_needed >= minTicket && deal.amount_needed <= maxTicket) {
      totalScore += 15;
      reasons.push({
        type: "size",
        description: `펀드 규모 적합: ${fundSize}억 (적정 티켓 ${Math.round(minTicket)}~${Math.round(maxTicket)}억)`,
        score: 15,
      });
    }
  }

  // 최소 threshold
  if (totalScore < 25) return null;

  return {
    asct_id: fund.asct_id,
    company_name: fund.company_name,
    fund_name: fund.fund_name,
    fund_manager_name: fund.fund_manager_name || "",
    amount_억: fund.amount_억,
    maturity_date: fund.maturity_date,
    lifecycle: fund.lifecycle,
    match_score: Math.min(totalScore, 100),
    match_reasons: reasons,
    is_govt_matched: fund.is_govt_matched,
    account_type: fund.account_type,
  };
}

// === 5. 메인 매칭 함수 ===
export async function matchFunds(
  deal: DealSignals,
  options?: { limit?: number; activeOnly?: boolean; govtOnly?: boolean }
): Promise<MatchedFund[]> {
  const sql = neon(process.env.POSTGRES_URL!);
  const limit = options?.limit || 10;

  try {
    const funds = options?.govtOnly
      ? await sql`SELECT * FROM vc_funds WHERE is_active = TRUE AND has_sector = TRUE AND is_govt_matched = TRUE ORDER BY amount_억 DESC`
      : await sql`SELECT * FROM vc_funds WHERE is_active = TRUE AND has_sector = TRUE ORDER BY amount_억 DESC`;

    // 전체 매칭 스코어 계산
    const matches: MatchedFund[] = [];
    for (const fund of funds) {
      const match = calculateMatchScore(deal, fund);
      if (match) matches.push(match);
    }

    // 스코어 순 정렬 → 상위 N개
    matches.sort((a, b) => b.match_score - a.match_score);

    // VC사 중복 제거 (같은 VC사에서 최고 스코어 펀드 1개만)
    const seen = new Set<string>();
    const deduped: MatchedFund[] = [];
    for (const m of matches) {
      if (!seen.has(m.company_name)) {
        seen.add(m.company_name);
        deduped.push(m);
      }
      if (deduped.length >= limit) break;
    }

    return deduped;
  } catch (error) {
    console.error('[fund-matcher] Error:', error);
    throw error;
  }
}

// === 6. Secretary Agent 연동 ===
// deal_analyses 저장 시 자동 매칭 트리거
export function extractDealSignals(analysis: any): DealSignals {
  // Secretary Agent가 추출한 구조화 데이터에서 시그널 매핑
  const sectorMap: Record<string, string> = {
    "fintech": "핀테크/금융",
    "edtech": "에듀테크/교육",
    "biotech": "바이오",
    "ai": "AI/SW",
    "saas": "AI/SW",
    "content": "콘텐츠/엔터",
    "ecommerce": "뷰티/패션",
    "mobility": "모빌리티",
    "deeptech": "딥테크",
    "semiconductor": "반도체",
    "energy": "친환경/ESG",
    "food": "푸드/농업",
    "gaming": "게임",
    "healthcare": "바이오",
    "robotics": "로봇/자동화",
    "space": "우주/항공",
  };

  const stageMap: Record<string, string> = {
    "pre-seed": "초기투자",
    "seed": "초기투자",
    "series-a": "초기투자",
    "series-b": "성장투자",
    "series-c": "성장투자",
    "growth": "성장투자",
    "late": "성장투자",
  };

  const sectors: string[] = (analysis.sectors || [])
    .map((s: string) => sectorMap[s.toLowerCase()] || s)
    .filter(Boolean);

  const stage = stageMap[analysis.stage?.toLowerCase()] || "초기투자";

  return {
    sectors: [...new Set(sectors)],
    stage,
    business_model: analysis.business_model || "",
    geo: analysis.geo || [],
    amount_needed: analysis.funding_amount || undefined,
    keywords: analysis.keywords || [],
  };
}
