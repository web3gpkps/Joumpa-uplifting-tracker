import type { ReactNode } from "react";
import { practiceAvg, staffRekap, weekEnd, weekOfDate, weekStart } from "@/lib/rules";
import { formatTanggal, formatTanggalPendek } from "@/lib/dates";
import {
  hrefs,
  lastChangedLabel,
  parseStation,
  ruleSettings,
  sortedStaff,
  stationCodes,
  type ScreenProps,
  type WorkspaceAccess,
  type Workspace,
  type WorkspaceStaff,
} from "@/lib/workspace";
import { todayInJakarta } from "@/components/shell/programme-calendar";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader, PageLoading } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { RememberView } from "@/components/ui/RememberView";
import { oneTo, rememberScope } from "@/components/ui/remember";
import { EmptyState } from "@/components/ui/States";
import { StationSelect } from "@/components/ui/StationSelect";
import { FilterBar } from "@/components/ui/Toolbar";
import { WeekSelect } from "@/components/ui/WeekSelect";
import { ALL_STATIONS, weekOptions, type UrlOption } from "@/components/ui/url-options";
import { WeeklyEntry, type EntryGroup } from "@/components/performa/WeeklyEntry";
import type { EntryStaff } from "@/components/performa/ScoreRow";
import { RekapTable } from "@/components/performa/RekapTable";
import { ScoreGrid, type ScoreGridRow } from "@/components/performa/ScoreGrid";
import { parseWeek } from "@/components/performa/workspace-data";
import { saveWeeklyScore } from "./actions";

const TITLE = "Penilaian Mingguan";

export function PerformaLoading() {
  return <PageLoading title={TITLE} label="Memuat penilaian" />;
}

type Query = { tab: "input" | "rekap"; week: number; station: string | null };

function hrefFor(access: WorkspaceAccess, q: Query): string {
  return hrefs(access).to("performa", {
    tab: q.tab === "rekap" ? "rekap" : null,
    minggu: q.week,
    stasiun: q.station,
  });
}

function isAssessed(ws: Workspace, code: string, week: number): boolean {
  const row = ws.weeklyScores.find((r) => r.staffCode === code && r.week === week);
  return row ? practiceAvg(row) !== null : false;
}

/**
 * Penilaian Mingguan: week select + score grid (phones: one card per person). Rekap is a
 * secondary view (?tab=rekap) behind one button in the header.
 */
export function PerformaScreen({ access, ws, searchParams: sp }: ScreenProps) {
  const today = todayInJakarta();
  const settings = ruleSettings(ws.settings);

  const query: Query = {
    tab: sp.tab === "rekap" ? "rekap" : "input",
    week: parseWeek(sp.minggu, settings, today),
    station: parseStation(ws, sp.stasiun),
  };
  const currentWeek = weekOfDate(today, settings);
  const allStaff = sortedStaff(ws);
  const staff = query.station ? allStaff.filter((s) => s.station === query.station) : allStaff;
  const scopeName = query.station ?? (ws.isKps ? "semua stasiun" : ws.scopeLabel);
  const showStation = ws.isKps && query.station === null;
  const rekap = query.tab === "rekap";

  const assessedCount = (list: WorkspaceStaff[]) => list.filter((s) => isAssessed(ws, s.code, query.week)).length;

  const stationFilter = ws.isKps ? (
    <StationSelect
      options={[null, ...stationCodes(ws)].map(
        (code): UrlOption => {
          const list = code ? allStaff.filter((s) => s.station === code) : allStaff;
          const count = rekap ? `${list.length} SDM` : `${assessedCount(list)}/${list.length}`;
          return {
            value: code ?? ALL_STATIONS,
            label: `${code ?? "Semua stasiun"} (${count})`,
            href: hrefFor(access, { ...query, station: code }),
          };
        },
      )}
      current={query.station ?? ALL_STATIONS}
    />
  ) : null;

  const weekStartDate = weekStart(query.week, settings);
  const weekRange = `${formatTanggalPendek(weekStartDate)} s.d. ${formatTanggal(weekEnd(query.week, settings))}`;
  const notStarted = today < weekStartDate ? " · belum berjalan" : "";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={TITLE}
        meta={rekap ? `${ws.scopeLabel} · Rekap ${settings.weeks} minggu` : `${ws.scopeLabel} · ${weekRange}${notStarted}`}
        actions={
          <ButtonLink href={hrefFor(access, { ...query, tab: rekap ? "input" : "rekap" })} scroll={false}>
            {rekap ? "Isi penilaian" : "Lihat rekap"}
          </ButtonLink>
        }
      >
        <RememberView
          scope={rememberScope(access, ws)}
          allowed={{ minggu: oneTo(settings.weeks), ...(ws.isKps ? { stasiun: stationCodes(ws) } : {}) }}
          shown={{ minggu: String(query.week), stasiun: query.station }}
        />
      </PageHeader>

      {rekap ? (
        <RekapView
          ws={ws}
          staff={staff}
          scopeName={scopeName}
          showStation={showStation}
          currentWeek={currentWeek}
          filters={stationFilter}
        />
      ) : (
        <InputView
          ws={ws}
          access={access}
          query={query}
          staff={staff}
          scopeName={scopeName}
          showStation={showStation}
          assessed={assessedCount(staff)}
          filters={
            <>
              <WeekSelect
                label="Minggu"
                options={weekOptions(settings, (w) => hrefFor(access, { ...query, week: w }))}
                current={String(query.week)}
                nowValue={currentWeek !== null ? String(currentWeek) : undefined}
              />
              {stationFilter}
            </>
          }
        />
      )}
    </div>
  );
}

function InputView({
  ws,
  access,
  query,
  staff,
  scopeName,
  showStation,
  assessed,
  filters,
}: {
  ws: Workspace;
  access: WorkspaceAccess;
  query: Query;
  staff: WorkspaceStaff[];
  scopeName: string;
  showStation: boolean;
  assessed: number;
  filters: ReactNode;
}) {
  const settings = ruleSettings(ws.settings);
  const total = staff.length;

  const groups: EntryGroup[] = [];
  const gridRows: ScoreGridRow[] = [];
  for (const s of staff) {
    let group = groups.find((g) => g.station === s.station);
    if (!group) {
      group = { station: s.station, summary: "", staff: [] };
      groups.push(group);
    }
    const row = ws.weeklyScores.find((r) => r.staffCode === s.code && r.week === query.week) ?? null;
    const changedLabel = row ? lastChangedLabel(row, ws) : null;
    const baselineAvg = practiceAvg(s);
    group.staff.push({
      code: s.code,
      name: s.name,
      assignmentStatus: s.assignmentStatus,
      baselineAvg,
      saved: row
        ? {
            scores: [row.scoreA, row.scoreB, row.scoreC, row.scoreD, row.scoreE, row.scoreF],
            observer: row.observer,
            coachingNotes: row.coachingNotes,
          }
        : null,
      changedLabel,
    } satisfies EntryStaff);
    gridRows.push({
      code: s.code,
      name: s.name,
      station: s.station,
      assignmentStatus: s.assignmentStatus,
      baselineAvg,
      score_a: row?.scoreA ?? null,
      score_b: row?.scoreB ?? null,
      score_c: row?.scoreC ?? null,
      score_d: row?.scoreD ?? null,
      score_e: row?.scoreE ?? null,
      score_f: row?.scoreF ?? null,
      observer: row?.observer ?? null,
      coaching_notes: row?.coachingNotes ?? null,
      changedLabel,
    });
  }
  for (const g of groups) {
    const done = g.staff.filter((e) => isAssessed(ws, e.code, query.week)).length;
    g.summary = `${done} dari ${g.staff.length} dinilai`;
  }

  const label = `Penilaian Minggu ke-${query.week}, ${scopeName}`;
  const progress = (
    <>
      <span className="font-semibold text-ink tabular-nums">{assessed}</span> dari{" "}
      <span className="tabular-nums">{total}</span> dinilai
    </>
  );
  const emptyState = (
    <EmptyState
      title={`Belum ada SDM di ${scopeName}`}
      layout="inline"
      action={
        <ButtonLink href={hrefs(access).to("sdm", { stasiun: query.station })} size="sm">
          Buka Data SDM
        </ButtonLink>
      }
    >
      SDM ditambahkan di Data SDM.
    </EmptyState>
  );
  const listKey = `${query.week}-${query.station ?? "semua"}`;

  return (
    <ScoreGrid
      key={listKey}
      caption={label}
      rows={gridRows}
      week={query.week}
      settings={settings}
      showStation={showStation}
      accessKey={access.key}
      saveAction={saveWeeklyScore}
      summary={progress}
      toolbar={filters}
      emptyState={emptyState}
      phone={
        <div className="flex flex-col gap-4">
          <FilterBar label="Filter penilaian" end={<span>{progress}</span>}>
            {filters}
          </FilterBar>
          {total === 0 ? (
            emptyState
          ) : (
            <div className="rounded-panel border border-line bg-surface">
              <WeeklyEntry
                key={listKey}
                accessKey={access.key}
                week={query.week}
                settings={settings}
                groups={groups}
                showStationHeadings={groups.length > 1}
                label={label}
                saveAction={saveWeeklyScore}
              />
            </div>
          )}
        </div>
      }
    />
  );
}

function RekapView({
  ws,
  staff,
  scopeName,
  showStation,
  currentWeek,
  filters,
}: {
  ws: Workspace;
  staff: WorkspaceStaff[];
  scopeName: string;
  showStation: boolean;
  currentWeek: number | null;
  filters: ReactNode;
}) {
  const settings = ruleSettings(ws.settings);
  const rows = staff.map((s) => ({
    code: s.code,
    name: s.name,
    station: s.station,
    rekap: staffRekap(s, ws.weeklyScores, settings),
  }));
  const anyScore = rows.some((r) => r.rekap.weeksAssessed > 0);

  return (
    <div className="flex flex-col gap-3">
      <FilterBar label="Filter rekap" end={<span className="tabular-nums">{rows.length} SDM</span>}>
        {filters}
      </FilterBar>
      {rows.length > 0 && !anyScore ? (
        <EmptyState title={`Belum ada nilai mingguan di ${scopeName}`} layout="inline">
          Rekap terisi setelah penilaian disimpan.
        </EmptyState>
      ) : null}
      <Panel padding="flush">
        <RekapTable
          caption={`Rekap penilaian ${scopeName}, Minggu ke-1 sampai ke-${settings.weeks}`}
          rows={rows}
          weeks={settings.weeks}
          currentWeek={currentWeek}
          showStation={showStation}
        />
      </Panel>
    </div>
  );
}
