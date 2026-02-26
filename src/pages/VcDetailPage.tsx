import { useEffect, useState } from "react";
import type { VcDetailData, VcFund } from "../types";
import { amountClass, formatAmount, formatDate, lifecycleClass } from "../utils/formatting";
import { navigate } from "../utils/routing";
import { TableSkeleton } from "../components/Skeletons";
import { EmptyState, ErrorState } from "../components/EmptyState";

export function VcDetailPage({ id }: { id: string }) {
  const [data, setData] = useState<VcDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/vc-detail?name=${encodeURIComponent(id)}&format=stats`)
      .then((r) => r.json())
      .then((result) => setData(result.data || result))
      .catch((e) => {
        console.error("Failed to fetch VC detail:", e);
        setError("VC 상세 정보를 불러오는 데 실패했습니다");
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
      <button className="back-btn" onClick={() => navigate("/vcs")} aria-label="VC 목록으로 돌아가기">← VC 목록</button>
      <ErrorState onRetry={() => window.location.reload()} message={error} />
    </main>
  );

  if (!data) return (
    <main className="content" id="main-content" style={{ marginTop: 24 }}>
      <button className="back-btn" onClick={() => navigate("/vcs")} aria-label="VC 목록으로 돌아가기">← VC 목록</button>
      <EmptyState onReset={() => navigate("/vcs")} title="VC를 찾을 수 없습니다" description="존재하지 않는 VC이거나 삭제된 VC입니다" />
    </main>
  );

  return (
    <main className="content" id="main-content" style={{ marginTop: 24 }}>
      <button className="back-btn" onClick={() => navigate("/vcs")} aria-label="VC 목록으로 돌아가기">← VC 목록</button>

      <div className="vc-header-card">
        <h1>{data.name}</h1>
        <div className="vc-stats-row" role="region" aria-label="VC 통계">
          <div className="vc-stat-item">
            <div className="vc-stat-label">총 AUM</div>
            <div className="vc-stat-value">{formatAmount(data.total_aum)}<span className="stat-unit">억</span></div>
          </div>
          <div className="vc-stat-item">
            <div className="vc-stat-label">펀드 수</div>
            <div className="vc-stat-value">{data.total_funds}</div>
          </div>
          <div className="vc-stat-item">
            <div className="vc-stat-label">활성 펀드</div>
            <div className="vc-stat-value">{data.active_funds}</div>
          </div>
        </div>
      </div>

      {(data.funds || []).length > 0 && (
        <section aria-label="운용 펀드 목록">
          <h2 className="detail-section-title" style={{ marginBottom: 12 }}>운용 펀드</h2>
          <div className="table-wrap">
            <table className="funds-table">
              <thead>
                <tr>
                  <th className="no-sort" scope="col">펀드명</th>
                  <th className="no-sort" scope="col">규모</th>
                  <th className="no-sort" scope="col">결성일</th>
                  <th className="no-sort" scope="col">상태</th>
                </tr>
              </thead>
              <tbody>
                {(data.funds || []).map((fund: VcFund) => (
                  <tr
                    key={fund.id}
                    onClick={() => navigate(`/fund/${encodeURIComponent(fund.id)}`)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/fund/${encodeURIComponent(fund.id)}`); } }}
                    tabIndex={0}
                    role="link"
                    aria-label={`${fund.fund_name} 상세보기`}
                  >
                    <td><div className="fund-name">{fund.fund_name}</div></td>
                    <td><span className={`amount ${amountClass(fund.total_amount)}`}>{formatAmount(fund.total_amount)}<span className="amount-unit">억</span></span></td>
                    <td><span className="date">{formatDate(fund.formation_date)}</span></td>
                    <td><span className={`lifecycle-badge ${lifecycleClass(fund.lifecycle)}`}>{fund.lifecycle || "-"}</span></td>
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
