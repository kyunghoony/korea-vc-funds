import React from "react";

export const TableSkeleton = React.memo(function TableSkeleton() {
  return (
    <div className="table-wrap" aria-busy="true" aria-label="데이터 로딩 중">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="skeleton skeleton-row" />
      ))}
    </div>
  );
});

export const CardSkeleton = React.memo(function CardSkeleton() {
  return (
    <div className="cards-grid" aria-busy="true" aria-label="데이터 로딩 중">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton skeleton-card" />
      ))}
    </div>
  );
});
