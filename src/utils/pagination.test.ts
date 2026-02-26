import { describe, expect, it } from "vitest";
import { getPageNumbers } from "./pagination";

describe("getPageNumbers", () => {
  it("returns all pages for total <= 7", () => {
    expect(getPageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(getPageNumbers(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("returns ellipsis for large page counts", () => {
    const result = getPageNumbers(1, 20);
    expect(result[0]).toBe(1);
    expect(result).toContain("...");
    expect(result[result.length - 1]).toBe(20);
  });

  it("shows ellipsis on both sides for middle pages", () => {
    const result = getPageNumbers(10, 20);
    expect(result[0]).toBe(1);
    expect(result[1]).toBe("...");
    expect(result).toContain(9);
    expect(result).toContain(10);
    expect(result).toContain(11);
    expect(result[result.length - 1]).toBe(20);
  });

  it("handles single page", () => {
    expect(getPageNumbers(1, 1)).toEqual([1]);
  });

  it("handles empty pages", () => {
    expect(getPageNumbers(1, 0)).toEqual([]);
  });
});
