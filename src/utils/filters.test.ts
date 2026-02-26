import { describe, expect, it } from "vitest";
import { fundSizeToRange, vcSizeToRange } from "./filters";

describe("fundSizeToRange", () => {
  it("parses ~100억", () => {
    expect(fundSizeToRange("~100억")).toEqual({ min: undefined, max: 100 });
  });

  it("parses 100~500억", () => {
    expect(fundSizeToRange("100~500억")).toEqual({ min: 100, max: 500 });
  });

  it("parses 500~1000억", () => {
    expect(fundSizeToRange("500~1000억")).toEqual({ min: 500, max: 1000 });
  });

  it("parses 1000억~", () => {
    expect(fundSizeToRange("1000억~")).toEqual({ min: 1000, max: undefined });
  });

  it("returns undefined range for unknown input", () => {
    expect(fundSizeToRange("unknown")).toEqual({ min: undefined, max: undefined });
  });
});

describe("vcSizeToRange", () => {
  it("parses ~500억", () => {
    expect(vcSizeToRange("~500억")).toEqual({ min: undefined, max: 500 });
  });

  it("parses 500~2000억", () => {
    expect(vcSizeToRange("500~2000억")).toEqual({ min: 500, max: 2000 });
  });

  it("parses 2000억~", () => {
    expect(vcSizeToRange("2000억~")).toEqual({ min: 2000, max: undefined });
  });

  it("returns undefined range for unknown input", () => {
    expect(vcSizeToRange("unknown")).toEqual({ min: undefined, max: undefined });
  });
});
