import React from "react";
import { getPageNumbers } from "../utils/pagination";

type PaginationBarProps = {
  page: number;
  pages: number;
  total: number;
  limit: number;
  onPage: (p: number) => void;
};

export const PaginationBar = React.memo(function PaginationBar({ page, pages, total, limit, onPage }: PaginationBarProps) {
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <nav className="pagination" aria-label="페이지 네비게이션">
      <span className="page-info">{start.toLocaleString()} – {end.toLocaleString()} of {total.toLocaleString()}</span>
      <div className="page-btns">
        <button className="page-btn" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="이전 페이지">←</button>
        {getPageNumbers(page, pages).map((p, i) =>
          p === "..." ? (
            <span key={`e${i}`} className="page-btn" style={{ cursor: "default", borderColor: "transparent" }}>...</span>
          ) : (
            <button
              key={p}
              className={`page-btn ${p === page ? "active" : ""}`}
              onClick={() => onPage(p as number)}
              aria-label={`${p} 페이지`}
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </button>
          ),
        )}
        <button className="page-btn" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="다음 페이지">→</button>
      </div>
    </nav>
  );
});
