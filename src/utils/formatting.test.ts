import { describe, expect, it } from "vitest";
import { formatAmount, formatDate, formatJo, amountClass, lifecycleClass } from "./formatting";

describe("formatAmount", () => {
  it("returns '-' for undefined", () => {
    expect(formatAmount(undefined)).toBe("-");
  });

  it("returns '-' for null", () => {
    expect(formatAmount(null as unknown as undefined)).toBe("-");
  });

  it("formats numbers with locale string", () => {
    expect(formatAmount(1000)).toBe("1,000");
    expect(formatAmount(0)).toBe("0");
  });
});

describe("formatDate", () => {
  it("returns '-' for empty/undefined", () => {
    expect(formatDate(undefined)).toBe("-");
    expect(formatDate("")).toBe("-");
  });

  it("formats date as YYYY.MM", () => {
    expect(formatDate("2024-03-15")).toBe("2024.03");
    expect(formatDate("2023-12-01")).toBe("2023.12");
  });
});

describe("formatJo", () => {
  it("returns 조원 for values >= 10000억", () => {
    const result = formatJo(10000);
    expect(result.unit).toBe("조원");
    expect(result.value).toBe("1.0");
  });

  it("returns 억 for values < 10000억", () => {
    const result = formatJo(5000);
    expect(result.unit).toBe("억");
    expect(result.value).toBe("5,000");
  });
});

describe("amountClass", () => {
  it("returns amount-high for >= 3000", () => {
    expect(amountClass(3000)).toBe("amount-high");
    expect(amountClass(5000)).toBe("amount-high");
  });

  it("returns amount-mid for >= 1000", () => {
    expect(amountClass(1000)).toBe("amount-mid");
    expect(amountClass(2999)).toBe("amount-mid");
  });

  it("returns amount-low for < 1000 or falsy", () => {
    expect(amountClass(999)).toBe("amount-low");
    expect(amountClass(0)).toBe("amount-low");
    expect(amountClass(undefined)).toBe("amount-low");
  });
});

describe("lifecycleClass", () => {
  it("returns lifecycle-active for 적극투자기", () => {
    expect(lifecycleClass("적극투자기")).toBe("lifecycle-active");
  });

  it("returns lifecycle-mid for 중기", () => {
    expect(lifecycleClass("중기")).toBe("lifecycle-mid");
  });

  it("returns lifecycle-late for others", () => {
    expect(lifecycleClass("후기/회수기")).toBe("lifecycle-late");
    expect(lifecycleClass(undefined)).toBe("lifecycle-late");
  });
});
