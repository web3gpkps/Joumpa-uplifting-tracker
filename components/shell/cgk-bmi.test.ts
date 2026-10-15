import { describe, expect, test } from "bun:test";
import { ACCOUNT_ACCESS, navSections, OWNER_ACCESS } from "@/lib/workspace/access";
import { bmiOnlyNavigation, bmiPeriodView, branchBmiNavigation, isBranchBmiView, isStationBmiShare } from "./cgk-bmi";

describe("Cek BMI period view", () => {
  test("every access opens on all periods and can switch to the chosen one", () => {
    expect(bmiPeriodView(undefined).allSlots).toBe(true);
    expect(bmiPeriodView("1").allSlots).toBe(true);
    expect(bmiPeriodView("0").allSlots).toBe(false);
  });
  test("the label is Cek and the query keeps the default out of the URL", () => {
    expect(bmiPeriodView(undefined).label).toBe("Cek");
    expect(bmiPeriodView(undefined).query(true)).toBeNull();
    expect(bmiPeriodView(undefined).query(false)).toBe(0);
  });
});

describe("station link BMI navigation", () => {
  test("every station link uses the BMI-only menu; KPS links and the owner do not", () => {
    const ws = { isKps: false, isOwner: false };
    expect(isStationBmiShare({ kind: "link" }, ws)).toBe(true);
    expect(isStationBmiShare({ kind: "link" }, { ...ws, isKps: true })).toBe(false);
    expect(isStationBmiShare({ kind: "link" }, { ...ws, isOwner: true })).toBe(false);
    expect(isStationBmiShare(OWNER_ACCESS, ws)).toBe(false);
  });

  test("a signed-in branch account is handled by its own rule, not the link rule", () => {
    expect(isStationBmiShare({ kind: "account" }, { isKps: false, isOwner: false })).toBe(false);
  });

  test("filtering keeps BMI and leaves the original navigation available", () => {
    const original = navSections({ kind: "link", basePath: "/fixture" });
    const before = JSON.stringify(original);
    expect(bmiOnlyNavigation(original).flatMap((s) => s.items).map((s) => s.key)).toEqual(["bmi"]);
    expect(JSON.stringify(original)).toBe(before);
    expect(original.flatMap((s) => s.items).map((s) => s.key)).toContain("sdm");
    expect(navSections(OWNER_ACCESS).flatMap((s) => s.items).map((s) => s.key)).toContain("sinkronisasi");
    expect(navSections({ kind: "link", basePath: "/fixture" }).flatMap((s) => s.items).map((s) => s.key)).toContain("tindakLanjut");
  });
});

describe("branch account view", () => {
  const ws = { isKps: false, isOwner: false };

  test("only a single-station account gets it: not KPS, not the owner, not a link", () => {
    expect(isBranchBmiView({ kind: "account" }, ws)).toBe(true);
    expect(isBranchBmiView({ kind: "account" }, { ...ws, isKps: true })).toBe(false);
    expect(isBranchBmiView({ kind: "account" }, { ...ws, isOwner: true })).toBe(false);
    expect(isBranchBmiView({ kind: "owner" }, ws)).toBe(false);
    expect(isBranchBmiView({ kind: "link" }, ws)).toBe(false);
  });

  test("the menu is Cek BMI only, named BMI Monitoring Tracker; the full menu is untouched", () => {
    const original = navSections(ACCOUNT_ACCESS);
    const before = JSON.stringify(original);
    const menu = branchBmiNavigation(original).flatMap((s) => s.items);
    expect(menu.map((i) => [i.key, i.label, i.shortLabel, i.href])).toEqual([
      ["bmi", "BMI Monitoring Tracker", "BMI Monitoring Tracker", "/cabang/bmi"],
    ]);
    expect(JSON.stringify(original)).toBe(before);
    expect(original.flatMap((s) => s.items).map((i) => i.key)).toContain("sdm");
    expect(original.flatMap((s) => s.items).find((i) => i.key === "bmi")?.label).toBe("Cek BMI");
  });
});
