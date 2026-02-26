/* ─── ROUTE ─── */
export type Route =
  | { page: "funds"; params: URLSearchParams }
  | { page: "fund"; id: string }
  | { page: "vcs"; params: URLSearchParams }
  | { page: "vc"; id: string };

/* ─── VIEW & SORT ─── */
export type ViewType = "table" | "card";
export type SortDir = "asc" | "desc";
export type FundSortKey = "fund_name" | "company_name" | "amount_억" | "registered_date";
export type VcSortKey = "name" | "fund_count" | "total_aum" | "active_count";
export type FilterKey = "stage" | "sector" | "size";

/* ─── DATA MODELS ─── */
export type Fund = {
  asct_id: string;
  fund_name: string;
  company_name: string;
  amount_억: number;
  registered_date?: string;
  lifecycle?: string;
  sector_tags?: string[];
};

export type FundStats = {
  total_funds: number;
  active_funds: number;
  active_aum: number;
  total_vcs: number;
};

export type Vc = {
  name: string;
  total_funds: number;
  active_funds: number;
  total_aum: number;
  sectors: string[];
};

export type VcStats = {
  total_vcs: number;
  active_vcs: number;
  total_aum: number;
  avg_aum_per_vc: number;
  top_sectors?: { sector: string }[];
};

export type Paging = {
  total: number;
  page: number;
  pages: number;
  limit: number;
};

/* ─── DETAIL PAGE TYPES ─── */
export type FundDetail = {
  fund_name: string;
  company_name: string;
  amount_억: number;
  registered_date?: string;
  maturity_date?: string;
  lifecycle?: string;
  sector_tags?: string[];
  is_govt_matched?: boolean;
  account_type?: string;
  fund_manager_name?: string;
};

export type RelatedFund = {
  asct_id: string;
  fund_name: string;
  amount_억: number;
  registered_date?: string;
  lifecycle?: string;
};

export type FundDetailResponse = {
  fund: FundDetail;
  relatedFunds?: RelatedFund[];
};

export type VcFund = {
  id: string;
  fund_name: string;
  total_amount: number;
  formation_date?: string;
  lifecycle?: string;
};

export type VcDetailData = {
  name: string;
  total_aum: number;
  total_funds: number;
  active_funds: number;
  funds?: VcFund[];
};

/* ─── COMPONENT PROPS ─── */
export type StatCard = {
  label: string;
  value: string;
  unit: string;
};
