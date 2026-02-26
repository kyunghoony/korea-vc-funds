import React from "react";
import { IconChevronDown } from "./icons";

type FilterDropdownProps = {
  title: string;
  options: string[];
  selected: string[];
  isOpen: boolean;
  onOpen: () => void;
  onToggle: (value: string) => void;
};

export const FilterDropdown = React.memo(function FilterDropdown({
  title, options, selected, isOpen, onOpen, onToggle,
}: FilterDropdownProps) {
  return (
    <div className="filter-group">
      <button
        className={`filter-btn ${selected.length ? "has-selection" : ""}`}
        onClick={onOpen}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`${title} 필터${selected.length > 0 ? ` (${selected.length}개 선택)` : ""}`}
      >
        <span>{title}{selected.length > 0 ? ` (${selected.length})` : ""}</span>
        <IconChevronDown />
      </button>
      {isOpen && (
        <div className="filter-dropdown" role="listbox" aria-label={`${title} 옵션`}>
          {options.length === 0 ? (
            <span style={{ color: "var(--text-muted)", fontSize: 12, padding: 8 }}>옵션 없음</span>
          ) : (
            options.map((opt) => (
              <button
                key={opt}
                className={`filter-chip ${selected.includes(opt) ? "selected" : ""}`}
                onClick={() => onToggle(opt)}
                role="option"
                aria-selected={selected.includes(opt)}
              >
                {opt}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
});
