import React from "react";
import type { StatCard } from "../types";

type StatBarProps = {
  cards: StatCard[] | null;
  loading: boolean;
};

export const StatBar = React.memo(function StatBar({ cards, loading }: StatBarProps) {
  return (
    <div className="stats-bar" role="region" aria-label="통계 요약">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="stat-card">
          <div className="stat-label">{cards?.[i]?.label || "\u00A0"}</div>
          {loading ? (
            <div className="skeleton skeleton-stat" />
          ) : (
            <div className="stat-value">
              {cards?.[i]?.value || "-"}
              {cards?.[i]?.unit ? <span className="stat-unit">{cards[i].unit}</span> : null}
            </div>
          )}
        </div>
      ))}
    </div>
  );
});
