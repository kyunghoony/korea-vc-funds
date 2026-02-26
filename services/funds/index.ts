// services/funds/index.ts — barrel export

export { matchFunds, extractDealSignals } from "./fund-matcher";
export type { DealSignals, MatchedFund, MatchReason } from "./fund-matcher";

export {
  listFunds,
  getFundDetail,
  getVCDetail,
  getFundStats,
  getSectorList,
} from "./fund-explorer";
export type { FundListParams, FundSortKey } from "./fund-explorer";
