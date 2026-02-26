-- VCReview DIVA Fund Intelligence Schema
-- For Neon PostgreSQL

-- 1. VC사 테이블
CREATE TABLE IF NOT EXISTS vc_companies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  total_funds INTEGER DEFAULT 0,
  active_funds INTEGER DEFAULT 0,
  total_aum BIGINT DEFAULT 0,  -- 총 결성액 (원)
  sector_focus TEXT[],  -- 주력 섹터 태그
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 펀드 테이블 (핵심)
CREATE TABLE IF NOT EXISTS vc_funds (
  id SERIAL PRIMARY KEY,
  asct_id TEXT NOT NULL UNIQUE,  -- DIVA 고유 ID
  company_name TEXT NOT NULL,
  fund_name TEXT NOT NULL,
  registered_date DATE,
  maturity_date DATE,
  settlement_month TEXT,
  fund_manager TEXT,  -- 이름(배정일)
  fund_manager_name TEXT,  -- 이름만 파싱
  support_type TEXT,  -- 지원구분
  account_type TEXT,  -- 계정구분 (핵심 필드)
  purpose_type TEXT,  -- 목적구분
  sector_type TEXT,  -- 투자분야구분
  hurdle_rate NUMERIC(5,2),
  total_amount BIGINT,  -- 결성총액 (원)
  amount_억 INTEGER,
  -- Intelligence Layer 필드
  sector_tags TEXT[] DEFAULT '{}',  -- 섹터 태그 배열
  all_tags TEXT[] DEFAULT '{}',  -- 전체 태그 배열
  is_govt_matched BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT FALSE,
  lifecycle TEXT,  -- 적극투자기/중기/후기회수기
  has_sector BOOLEAN DEFAULT FALSE,
  -- 메타
  tag_source TEXT DEFAULT 'auto',  -- auto/manual/ai
  tag_confidence NUMERIC(3,2) DEFAULT 0.8,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 펀드-딜 매칭 테이블
CREATE TABLE IF NOT EXISTS fund_deal_matches (
  id SERIAL PRIMARY KEY,
  deal_analysis_id TEXT NOT NULL,  -- deal_analyses FK
  fund_id INTEGER REFERENCES vc_funds(id),
  match_score NUMERIC(5,2),  -- 0~100
  match_reasons JSONB,  -- {"sector": 40, "stage": 30, "account": 20, "lifecycle": 10}
  rank INTEGER,  -- 순위
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 태그 히스토리 (사용자 피드백 루프)
CREATE TABLE IF NOT EXISTS fund_tag_edits (
  id SERIAL PRIMARY KEY,
  fund_id INTEGER REFERENCES vc_funds(id),
  user_id TEXT,
  old_tags TEXT[],
  new_tags TEXT[],
  edit_type TEXT,  -- add/remove/correct
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_funds_active ON vc_funds(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_funds_sector_tags ON vc_funds USING GIN(sector_tags);
CREATE INDEX idx_funds_all_tags ON vc_funds USING GIN(all_tags);
CREATE INDEX idx_funds_account ON vc_funds(account_type);
CREATE INDEX idx_funds_company ON vc_funds(company_name);
CREATE INDEX idx_funds_maturity ON vc_funds(maturity_date);
CREATE INDEX idx_funds_amount ON vc_funds(amount_억 DESC);
CREATE INDEX IF NOT EXISTS idx_funds_fund_name ON vc_funds(fund_name);
CREATE INDEX IF NOT EXISTS idx_funds_registered_date ON vc_funds(registered_date DESC);
CREATE INDEX IF NOT EXISTS idx_funds_company_name ON vc_funds(company_name);
CREATE INDEX IF NOT EXISTS idx_funds_amount_desc ON vc_funds(amount_억 DESC);
CREATE INDEX idx_matches_deal ON fund_deal_matches(deal_analysis_id);
CREATE INDEX idx_matches_score ON fund_deal_matches(match_score DESC);

-- 뷰: 활성+섹터태그 펀드 (매칭 대상)
CREATE VIEW v_matchable_funds AS
SELECT * FROM vc_funds
WHERE is_active = TRUE AND has_sector = TRUE
ORDER BY amount_억 DESC;

-- 뷰: VC사별 요약
CREATE VIEW v_vc_summary AS
SELECT 
  company_name,
  COUNT(*) as total_funds,
  COUNT(*) FILTER (WHERE is_active) as active_funds,
  SUM(total_amount) as total_aum,
  array_agg(DISTINCT unnest_tag) as all_sectors
FROM vc_funds, LATERAL unnest(sector_tags) as unnest_tag
GROUP BY company_name
ORDER BY total_aum DESC;
