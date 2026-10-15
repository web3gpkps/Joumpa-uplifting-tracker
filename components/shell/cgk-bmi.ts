import type { WorkspaceAccess, NavSection } from "@/lib/workspace/access";

/**
 * A station link (one station, not KPS): its holder sees only the Cek BMI menu, and every other
 * screen sends it to Cek BMI. KPS links and the owner keep every page.
 */
export function isStationBmiShare(
  access: Pick<WorkspaceAccess, "kind">,
  workspace: { isKps: boolean; isOwner: boolean },
): boolean {
  return access.kind === "link" && !workspace.isKps && !workspace.isOwner;
}

/**
 * A signed-in branch account of one station (not KPS, not the owner). Its menu is Cek BMI only,
 * named "BMI Monitoring Tracker", and the BMI screen speaks of the employee number (No Pegawai).
 * The other pages stay in the code and their routes keep working; only the menu hides them.
 */
export function isBranchBmiView(
  access: Pick<WorkspaceAccess, "kind">,
  workspace: { isKps: boolean; isOwner: boolean },
): boolean {
  return access.kind === "account" && !workspace.isKps && !workspace.isOwner;
}

/** The menu name of Cek BMI for a branch account. */
export const BRANCH_BMI_MENU_LABEL = "BMI Monitoring Tracker";

/** Cek BMI only, under its branch-account name. Hidden items are not removed from navSections. */
export function branchBmiNavigation(sections: NavSection[]): NavSection[] {
  return bmiOnlyNavigation(sections).map((section) => ({
    ...section,
    items: section.items.map((item) => ({ ...item, label: BRANCH_BMI_MENU_LABEL, shortLabel: BRANCH_BMI_MENU_LABEL })),
  }));
}

/** Cek BMI only. Hidden items are not removed from navSections. */
export function bmiOnlyNavigation(sections: NavSection[]): NavSection[] {
  return sections
    .map((section) => ({ ...section, items: section.items.filter((item) => item.key === "bmi") }))
    .filter((section) => section.items.length > 0);
}

/**
 * Cek BMI shows every period by default, for every access; "?semua=0" opens it on the chosen
 * period only. The label is "Cek" everywhere (the sheet headers read "BMI Cek ke-N (Periode ...)").
 */
export function bmiPeriodView(allValue: string | undefined) {
  return {
    allSlots: allValue !== "0",
    label: "Cek",
    /** The ?semua= value that opens this view: null (the default) for every period, 0 for one. */
    query: (all: boolean) => (all ? null : 0),
  };
}
