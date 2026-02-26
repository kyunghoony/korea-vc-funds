import { describe, expect, it, beforeEach } from "vitest";
import { parseRoute } from "./routing";

describe("parseRoute", () => {
  beforeEach(() => {
    window.location.hash = "";
  });

  it("defaults to funds page", () => {
    window.location.hash = "#/";
    const route = parseRoute();
    expect(route.page).toBe("funds");
  });

  it("parses fund detail route", () => {
    window.location.hash = "#/fund/test-fund-id";
    const route = parseRoute();
    expect(route.page).toBe("fund");
    if (route.page === "fund") {
      expect(route.id).toBe("test-fund-id");
    }
  });

  it("parses vcs page route", () => {
    window.location.hash = "#/vcs";
    const route = parseRoute();
    expect(route.page).toBe("vcs");
  });

  it("parses vc detail route", () => {
    window.location.hash = "#/vc/test-vc-name";
    const route = parseRoute();
    expect(route.page).toBe("vc");
    if (route.page === "vc") {
      expect(route.id).toBe("test-vc-name");
    }
  });

  it("handles encoded URI components", () => {
    window.location.hash = `#/fund/${encodeURIComponent("한국 펀드")}`;
    const route = parseRoute();
    expect(route.page).toBe("fund");
    if (route.page === "fund") {
      expect(route.id).toBe("한국 펀드");
    }
  });

  it("parses query parameters for funds", () => {
    window.location.hash = "#/?q=test&page=2";
    const route = parseRoute();
    expect(route.page).toBe("funds");
    if (route.page === "funds") {
      expect(route.params.get("q")).toBe("test");
      expect(route.params.get("page")).toBe("2");
    }
  });
});
