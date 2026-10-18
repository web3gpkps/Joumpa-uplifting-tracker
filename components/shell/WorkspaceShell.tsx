import type { ReactNode } from "react";
import type { Workspace } from "@/lib/workspace";
import { navSections, type WorkspaceAccess } from "@/lib/workspace/access";
import { ShellFrame, ShellIdentity, ShellLoading, WeekLine } from "./ShellFrame";
import { programmeWeekLine } from "./programme-calendar";
import { bmiOnlyNavigation, isStationBmiShare } from "./cgk-bmi";

type WorkspaceShellProps = {
  access: WorkspaceAccess;
  workspace: Workspace;
  /** Today in Asia/Jakarta, from todayInJakarta() at request time. */
  today: string;
  children: ReactNode;
};

/**
 * Station link chrome (/s/<token>, no account). The scope ("Stasiun SUB" / "KPS · semua
 * stasiun") and the programme week sit under the logo; the link's label is the footer.
 * A station link has the Cek BMI menu only; a KPS link gets every page.
 */
export function WorkspaceShell({ access, workspace, today, children }: WorkspaceShellProps) {
  const bmiOnly = isStationBmiShare(access, workspace);
  const sections = navSections(access);
  return (
    <ShellFrame
      sections={bmiOnly ? bmiOnlyNavigation(sections) : sections}
      homeHref={bmiOnly ? `${access.basePath}/bmi` : access.basePath}
      scopeLabel={workspace.scopeLabel}
      scopeShort={workspace.scope}
      weekLine={workspace.schedule ? <WeekLine>{programmeWeekLine(workspace.schedule, today)}</WeekLine> : undefined}
      footer={workspace.label ? <ShellIdentity icon="link" text={`Tautan: ${workspace.label}`} /> : undefined}
    >
      {children}
    </ShellFrame>
  );
}

export function WorkspaceShellLoading() {
  return <ShellLoading scopeLabel="Membuka halaman" />;
}
