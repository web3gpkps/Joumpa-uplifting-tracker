import { describe, expect, test } from "bun:test";
import { DEFAULT_SETTINGS } from "@/lib/rules";
import type { WorkspaceActionItem } from "@/lib/workspace";
import { byUrgency, toActionView } from "./action-view";

const ITEM = {
  code: "SUB-TL01",
  reportGroup: "SUB",
  area: "Grooming",
  action: "Cek grooming harian",
  target: null,
  kind: "Sekali",
  schedule: null,
  dueDate: null,
  dueRule: null,
  pic: "PIC SUB",
  status: "Belum Mulai",
  progress: 0,
  updatedOn: null,
  evidence: null,
  kpsNotes: null,
  sortOrder: 1,
  updatedAt: "2026-10-12T00:00:00Z",
  updatedByLink: null,
} as unknown as WorkspaceActionItem;

const WS = { linkId: null, linkLabels: {} };
const TODAY = "2026-10-12";
const view = (code: string, patch: Partial<WorkspaceActionItem>) =>
  toActionView({ ...ITEM, code, ...patch } as WorkspaceActionItem, DEFAULT_SETTINGS, TODAY, WS);

describe("byUrgency", () => {
  test("OVERDUE, jatuh tempo, the rest, Selesai last", () => {
    const items = [
      view("done", { dueDate: "2026-10-01", status: "Selesai" }),
      view("none", {}),
      view("later", { dueDate: "2026-12-01" }),
      view("soon", { dueDate: "2026-10-15" }),
      view("late", { dueDate: "2026-10-01" }),
    ];
    expect(items.sort(byUrgency).map((v) => v.code)).toEqual(["late", "soon", "later", "none", "done"]);
  });
  test("flags come from lib/rules", () => {
    expect(view("late", { dueDate: "2026-10-01" }).flag).toBe("OVERDUE");
    expect(view("soon", { dueDate: "2026-10-15" }).flag).toBe("Jatuh tempo ≤ 7 hari");
    expect(view("none", {}).flag).toBeNull();
  });
});
