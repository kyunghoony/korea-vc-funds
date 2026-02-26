// services/funds/index.ts — barrel export

export { matchFunds, extractDealSignals } from "./fund-matcher.js";
export type { DealSignals, MatchedFund, MatchReason } from "./fund-matcher.js";

export {
  listFunds,
  getFundDetail,
  getVCDetail,
  getFundStats,
  getSectorList,
} from "./fund-explorer.js";
export type { FundListParams, FundSortKey } from "./fund-explorer.js";
