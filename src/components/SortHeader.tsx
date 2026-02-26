import React from "react";
import type { SortDir } from "../types";

type SortHeaderProps = {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
};

export const SortHeader = React.memo(function SortHeader({ label, active, dir, onClick }: SortHeaderProps) {
  return (
    <th
      className={active ? "sorted" : ""}
      onClick={onClick}
      scope="col"
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      {label} <span className="sort-arrow">{active ? (dir === "asc" ? "↑" : "↓") : "↕"}</span>
    </th>
  );
});
