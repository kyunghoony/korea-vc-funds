import React from "react";
import { IconDatabase } from "./icons";

type EmptyStateProps = {
  onReset: () => void;
  title?: string;
  description?: string;
};

export const EmptyState = React.memo(function EmptyState({
  onReset,
  title = "검색 결과가 없습니다",
  description = "다른 검색어나 필터를 시도해보세요",
}: EmptyStateProps) {
  return (
    <div className="empty-state" role="status">
      <div className="empty-icon"><IconDatabase /></div>
      <div className="empty-title">{title}</div>
      <div className="empty-desc">{description}</div>
      <button className="empty-reset" onClick={onReset}>초기화</button>
    </div>
  );
});

export const ErrorState = React.memo(function ErrorState({
  onRetry,
  message = "데이터를 불러오는 중 오류가 발생했습니다",
}: {
  onRetry: () => void;
  message?: string;
}) {
  return (
    <div className="empty-state" role="alert">
      <div className="empty-icon"><IconDatabase /></div>
      <div className="empty-title">오류 발생</div>
      <div className="empty-desc">{message}</div>
      <button className="empty-reset" onClick={onRetry}>다시 시도</button>
    </div>
  );
});
