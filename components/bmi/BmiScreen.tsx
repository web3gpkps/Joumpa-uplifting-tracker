import { bmiCheckDate, bmiSummary, type BmiCheckRow, type BmiSummary } from "@/lib/rules";
import {
  changedVia,
  firstParam,
  hrefs,
  parseStation,
  ruleSettings,
  shortDateTime,
  sortedStaff,
  stationCodes,
  type ScreenProps,
  type Workspace,
} from "@/lib/workspace";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader, PageLoading } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { StationSelect } from "@/components/ui/StationSelect";
import { FilterBar } from "@/components/ui/Toolbar";
import { WeekSelect } from "@/components/ui/WeekSelect";
import { ALL_STATIONS, bmiPeriodOptions } from "@/components/ui/url-options";
import { RememberView } from "@/components/ui/RememberView";
import { oneTo, rememberScope } from "@/components/ui/remember";
import { todayInJakarta } from "@/components/shell/programme-calendar";
import { BmiGrid, type BmiGridRow } from "./BmiGrid";
import type { BmiCardProps } from "./BmiCard";
import type { BmiPerson } from "./BmiPersonSheet";
import { BmiPhoneList } from "./BmiPhoneList";
import {
  checkedCount,
  defaultCheckDate,
  defaultPeriod,
  isChecked,
  profileIncomplete,
  slotStatusLine,
  uncheckedFirst,
} from "./summary";

const TITLE = "Cek BMI";

/** "tautan ini, 8 Okt 07.55" (the grid column header already says "Terakhir diubah lewat"). */
function changedWhen(row: { updatedByLink?: string | null; updatedAt?: string | null }, ws: Workspace): string {
  const when = shortDateTime(row.updatedAt);
  return `${changedVia(row, ws)}${when ? `, ${when}` : ""}`;
}

export function BmiLoading() {
  return <PageLoading title={TITLE} label="Memuat cek BMI" />;
}

/**
 * Cek BMI: one period at a time (WeekSelect "Periode"), people not yet checked first.
 * Desktop: a grid for that period, every period behind "Tampilkan semua cek". Phone: one
 * card per person. Profile and history open in a per-person sheet.
 */
export function BmiScreen({ access, ws, searchParams: query }: ScreenProps) {
  const links = hrefs(access);
  const today = todayInJakarta();
  // Without the schedule the BMI periods cannot be placed on dates.
  const settings = ws.schedule ? ruleSettings(ws.settings) : null;

  if (!settings) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={TITLE} meta={ws.scopeLabel} />
        <Panel>
          <ErrorState
            title="Jadwal cek BMI belum diatur"
            cause="Tanggal cek pertama, jarak antar cek, atau jumlah periode belum diisi di Parameter."
            action="Minta pemilik aplikasi melengkapi Parameter, lalu muat ulang halaman ini."
          />
        </Panel>
      </div>
    );
  }

  const stationFilter = parseStation(ws, query.stasiun);
  const stations = stationCodes(ws);
  const allSlots = firstParam(query.semua) === "1";

  const requestedPeriod = Number(firstParam(query.periode));
  const period =
    Number.isInteger(requestedPeriod) && requestedPeriod >= 1 && requestedPeriod <= settings.bmiPeriods
      ? requestedPeriod
      : defaultPeriod(settings, today);
  const currentPeriod = bmiCheckDate(1, settings) <= today ? defaultPeriod(settings, today) : null;
  const plannedDates = Array.from({ length: settings.bmiPeriods }, (_, i) => bmiCheckDate(i + 1, settings));
  const defaultDates = plannedDates.map((_, i) => defaultCheckDate(i + 1, plannedDates, today));

  const href = (p: number, station: string | null, all = allSlots) =>
    links.to("bmi", { periode: p, stasiun: station ?? (ws.isKps ? ALL_STATIONS : null), semua: all ? 1 : null });

  const checksByStaff = new Map<string, Workspace["bmiChecks"]>();
  for (const c of ws.bmiChecks) {
    const list = checksByStaff.get(c.staffCode);
    if (list) list.push(c);
    else checksByStaff.set(c.staffCode, [c]);
  }

  const inScope = sortedStaff(ws).filter((st) => !stationFilter || st.station === stationFilter);
  const summaries = new Map<string, BmiSummary>(
    inScope.map((st) => [st.code, bmiSummary((checksByStaff.get(st.code) ?? []) as BmiCheckRow[], st.gender, settings)]),
  );
  const staffInView = uncheckedFirst(inScope, (st) => summaries.get(st.code)!, period);
  const showStation = ws.isKps && !stationFilter;

  const people = staffInView.map((st) => {
    const summary = summaries.get(st.code)!;
    const person: BmiPerson = {
      code: st.code,
      name: st.name ?? st.code,
      station: st.station,
      gender: st.gender,
      bmiNote: st.bmiNote,
      assignmentStatus: st.assignmentStatus,
      summary,
    };
    const slot = summary.periods[period - 1];
    return { st, summary, person, slot, slotStatus: slotStatusLine(slot, period, plannedDates, today) };
  });

  const gridRows: BmiGridRow[] = people.map(({ st, summary, person, slotStatus }) => {
    const checks = checksByStaff.get(st.code) ?? [];
    const latest = checks.reduce<(typeof checks)[number] | null>(
      (a, c) => (!a || (c.updatedAt ?? "") > (a.updatedAt ?? "") ? c : a),
      null,
    );
    return {
      code: st.code,
      name: person.name,
      station: st.station,
      gender: st.gender,
      bmiNote: st.bmiNote,
      checks: summary.periods.map((p) =>
        p && p.heightCm !== null && p.weightKg !== null
          ? { date: p.checkDate, tb: p.heightCm, bb: p.weightKg, bmi: p.bmi, category: p.category }
          : null,
      ),
      weightDelta: summary.weightDelta,
      weighings: summary.periods.filter((p) => p?.weightKg !== null && p?.weightKg !== undefined).length,
      heightRequirement: summary.heightRequirement,
      slotStatus,
      changed: latest ? changedWhen(latest, ws) : null,
      person,
    };
  });

  const cards: Array<Omit<BmiCardProps, "accessKey">> = people.map(({ person, slot, slotStatus }) => ({
    period,
    defaultDate: defaultDates[period - 1],
    plannedDates,
    settings,
    person,
    showStation,
    status: slotStatus,
    saved:
      slot && isChecked(slot) && slot.heightCm !== null && slot.weightKg !== null
        ? { checkDate: slot.checkDate, heightCm: slot.heightCm, weightKg: slot.weightKg }
        : null,
  }));

  const checked = checkedCount([...summaries.values()], period);
  const missingProfile = staffInView.filter((st) => profileIncomplete(st.gender)).length;
  const scopeCode = stationFilter ?? (ws.isKps ? "Semua stasiun" : ws.scopeLabel.replace(/^Stasiun /, ""));
  const scopeName = stationFilter ? `Stasiun ${stationFilter}` : ws.isKps ? "semua stasiun" : ws.scopeLabel;
  const meta = `${scopeCode} · Periode ${period} · ${checked} dari ${staffInView.length} sudah dicek`;

  const stationOptions = ws.isKps
    ? [null, ...stations].map((code) => ({
        value: code ?? ALL_STATIONS,
        label: code ?? "Semua stasiun",
        href: href(period, code),
      }))
    : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={TITLE} meta={meta} />
      <RememberView
        scope={rememberScope(access, ws)}
        allowed={{ periode: oneTo(settings.bmiPeriods), ...(ws.isKps ? { stasiun: stations } : {}) }}
        shown={{ periode: String(period), stasiun: stationFilter }}
      />

      <FilterBar
        label="Filter cek BMI"
        end={
          staffInView.length > 0 ? (
            <>
              {missingProfile > 0 ? <span className="tabular">{missingProfile} belum isi L/P</span> : null}
              <span className="hidden grid:inline-flex">
                <ButtonLink href={href(period, stationFilter, !allSlots)} variant="ghost">
                  {allSlots ? `Hanya periode ${period}` : "Tampilkan semua cek"}
                </ButtonLink>
              </span>
            </>
          ) : null
        }
      >
        {stationOptions ? <StationSelect options={stationOptions} current={stationFilter ?? ALL_STATIONS} /> : null}
        <WeekSelect
          label="Periode"
          options={bmiPeriodOptions(settings, (n) => href(n, stationFilter))}
          current={String(period)}
          nowValue={currentPeriod ? String(currentPeriod) : undefined}
        />
      </FilterBar>

      {staffInView.length === 0 ? (
        <Panel>
          <EmptyState
            title={`Belum ada SDM di ${scopeName}`}
            action={
              <ButtonLink href={links.sdm} variant="secondary">
                Buka Data SDM
              </ButtonLink>
            }
          >
            Cek BMI dicatat per SDM.
          </EmptyState>
        </Panel>
      ) : (
        <BmiGrid
          key={`${period}-${allSlots ? "semua" : "satu"}-${stationFilter ?? ALL_STATIONS}`}
          caption={allSlots ? `Cek BMI semua periode, ${scopeName}` : `Cek BMI periode ${period}, ${scopeName}`}
          rows={gridRows}
          accessKey={access.key}
          plannedDates={plannedDates}
          defaultDates={defaultDates}
          period={period}
          allSlots={allSlots}
          showStation={showStation}
          settings={settings}
          emptyState={<p className="text-sm text-ink-muted">Tidak ada SDM yang cocok dengan pencarian.</p>}
          phone={
            <Panel padding="flush">
              <BmiPhoneList
                key={`${period}-${stationFilter ?? ALL_STATIONS}`}
                label={`Cek BMI periode ${period}, ${scopeName}`}
                cards={cards}
                accessKey={access.key}
              />
            </Panel>
          }
        />
      )}
    </div>
  );
}
