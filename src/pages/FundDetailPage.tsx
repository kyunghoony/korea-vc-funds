import { useEffect, useState } from "react";
import type { FundDetailResponse, RelatedFund } from "../types";
import { amountClass, formatAmount, formatDate, lifecycleClass } from "../utils/formatting";
import { navigate } from "../utils/routing";
import { TableSkeleton } from "../components/Skeletons";
import { EmptyState, ErrorState } from "../components/EmptyState";

export function FundDetailPage({ id }: { id: string }) {
  const [data, setData] = useState<FundDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/fund-detail?id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((result) => setData(result))
      .catch((e) => {
        console.error("Failed to fetch fund detail:", e);
        setError("펀드 상세 정보를 불러오는 데 실패했습니다");
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <main className="content" id="main-content" style={{ marginTop: 24 }}>
      <TableSkeleton />
    </main>
  );

  if (error) return (
    <main className="content" id="main-content" style={{ marginTop: 24 }}>
      <button className="back-btn" onClick={() => navigate("/")} aria-label="펀드 목록으로 돌아가기">← 펀드 목록</button>
      <ErrorState onRetry={() => window.location.reload()} message={error} />
    </main>
  );

  if (!data?.fund) return (
    <main className="content" id="main-content" style={{ marginTop: 24 }}>
      <button className="back-btn" onClick={() => navigate("/")} aria-label="펀드 목록으로 돌아가기">← 펀드 목록</button>
      <EmptyState onReset={() => navigate("/")} title="펀드를 찾을 수 없습니다" description="존재하지 않는 펀드이거나 삭제된 펀드입니다" />
    </main>
  );

  const fund = data.fund;

  return (
    <main className="content" id="main-content" style={{ marginTop: 24 }}>
      <button className="back-btn" onClick={() => navigate("/")} aria-label="펀드 목록으로 돌아가기">← 펀드 목록</button>

      <div className="detail-layout">
        <div className="detail-card">
          <h1>{fund.fund_name}</h1>
          <div className="detail-company">{fund.company_name}</div>
          <div className="detail-row">
            <span className="label">규모</span>
            <span className={`value amount ${amountClass(fund.amount_억)}`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {formatAmount(fund.amount_억)}억
            </span>
          </div>
          <div className="detail-row">
            <span className="label">설립일</span>
            <span className="value mono">{formatDate(fund.registered_date)}</span>
          </div>
          <div className="detail-row">
            <span className="label">만기일</span>
            <span className="value mono">{formatDate(fund.maturity_date)}</span>
          </div>
          {fund.fund_manager_name && (
            <div className="detail-row">
              <span className="label">펀드매니저</span>
              <span className="value">{fund.fund_manager_name}</span>
            </div>
          )}
        </div>

        <div className="detail-card">
          <div className="detail-row">
            <span className="label">상태</span>
            <span className={`lifecycle-badge ${lifecycleClass(fund.lifecycle)}`}>{fund.lifecycle || "-"}</span>
          </div>
          <div className="detail-row" style={{ flexDirection: "column", gap: 8 }}>
            <span className="label">섹터</span>
            <div className="tag-wrap">
              {(fund.sector_tags || []).map((tag: string) => <span key={tag} className="tag">{tag}</span>)}
            </div>
          </div>
          <div className="detail-row">
            <span className="label">정부매칭</span>
            <span className="value">{fund.is_govt_matched ? "예" : "아니오"}</span>
          </div>
          {fund.account_type && (
            <div className="detail-row">
              <span className="label">계정유형</span>
              <span className="value">{fund.account_type}</span>
            </div>
          )}
        </div>
      </div>

      {data.relatedFunds && data.relatedFunds.length > 0 && (
        <section aria-label="같은 운용사 펀드">
          <h2 className="detail-section-title" style={{ marginBottom: 12 }}>같은 운용사 펀드</h2>
          <div className="table-wrap">
            <table className="funds-table">
              <thead>
                <tr>
                  <th className="no-sort" scope="col">펀드명</th>
                  <th className="no-sort" scope="col">규모</th>
                  <th className="no-sort" scope="col">설립일</th>
                  <th className="no-sort" scope="col">상태</th>
                </tr>
              </thead>
              <tbody>
                {data.relatedFunds.map((rf: RelatedFund) => (
                  <tr
                    key={rf.asct_id}
                    onClick={() => navigate(`/fund/${encodeURIComponent(rf.asct_id)}`)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/fund/${encodeURIComponent(rf.asct_id)}`); } }}
                    tabIndex={0}
                    role="link"
                    aria-label={`${rf.fund_name} 상세보기`}
                  >
                    <td><div className="fund-name">{rf.fund_name}</div></td>
                    <td><span className={`amount ${amountClass(rf.amount_억)}`}>{formatAmount(rf.amount_억)}<span className="amount-unit">억</span></span></td>
                    <td><span className="date">{formatDate(rf.registered_date)}</span></td>
                    <td><span className={`lifecycle-badge ${lifecycleClass(rf.lifecycle)}`}>{rf.lifecycle || "-"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
