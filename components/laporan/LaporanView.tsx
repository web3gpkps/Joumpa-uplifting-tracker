import Link from "next/link";
import type { ReactNode } from "react";
import { SEMUA, TOTAL, weeklyReport } from "@/lib/aggregate";
import { formatHariTanggal, formatTanggal, formatTanggalPendek } from "@/lib/dates";
import { formatScore } from "@/lib/format";
import { weekOfDate, weekStart } from "@/lib/rules";
import { hrefs, lastChangedLabel, stationCodes, trackerData, type Workspace, type WorkspaceAccess } from "@/lib/workspace";
import { APP_NAME, APP_TAGLINE } from "@/lib/app-info";
import { Logo } from "@/components/shell/Logo";
import { PageHeader } from "@/components/ui/PageHeader";
import { StationSelect } from "@/components/ui/StationSelect";
import { EmptyState } from "@/components/ui/States";
import { Toolbar } from "@/components/ui/Toolbar";
import { WeekSelect } from "@/components/ui/WeekSelect";
import { ALL_STATIONS, weekOptions } from "@/components/ui/url-options";
import { cx } from "@/components/ui/cx";
import { withoutTotals } from "@/components/ringkasan/data";
import { saveWeeklyFindings } from "./actions";
import { FindingsEditor, PrintedFindings } from "./FindingsEditor";
import { PrintButton } from "./PrintButton";
import { ActionProgressTable, BmiPeriodTable, TrendTable, WeeklyPerformanceTable } from "./ReportTables";
import { TrendChart } from "./TrendChart";

const linkClass = "text-accent underline underline-offset-2";

export function LaporanView({
  ws,
  access,
  today,
  week,
  station,
}: {
  ws: Workspace;
  access: WorkspaceAccess;
  today: string;
  week: number;
  /** KPS / owner: one station's report (?stasiun=SUB); null = all stations. */
  station: string | null;
}) {
  const links = hrefs(access);
  const data = trackerData(ws, station);
  const s = data.settings;
  const single = !ws.isKps || station !== null;
  /** KPS or the owner looking at one station: that station's findings are read-only here. */
  const kpsStationView = ws.isKps && station !== null;
  const scopeShort = ws.isKps ? (station ?? "Semua stasiun") : ws.scope;
  const report = weeklyReport(data, week, today);
  const thisWeek = weekOfDate(today, s);

  const totalPerf = report.performance.find((r) => r.key === TOTAL);
  const totalBmi = report.bmi.find((r) => r.key === TOTAL);
  const stationTrend = report.trend.filter((r) => r.key !== SEMUA);
  const semua = report.trend.find((r) => r.key === SEMUA) ?? null;
  const trendRows = withoutTotals(report.trend, single);
  const trendEmpty = trendRows.every((r) => r.weeks.every((v) => v === null));
  const weekNotStarted = weekStart(week, s) > today;

  const own = ws.weeklyReports.find((r) => r.week === week && r.scope === ws.scope) ?? null;
  const viewed = station ? (ws.weeklyReports.find((r) => r.week === week && r.scope === station) ?? null) : null;
  const stationFindings =
    ws.isKps && !station
      ? stationCodes(ws).map((code) => ({
          code,
          row: ws.weeklyReports.find((r) => r.week === week && r.scope === code) ?? null,
        }))
      : [];
  const filledFindings = stationFindings.filter((f) => f.row?.findings);
  const emptyFindings = stationFindings.filter((f) => !f.row?.findings).map((f) => f.code);

  const scoreNote = weekNotStarted ? (
    <>Minggu ke-{week} mulai {formatHariTanggal(weekStart(week, s))}.</>
  ) : totalPerf && totalPerf.assessed === 0 ? (
    <>
      Belum ada nilai Minggu ke-{week}.{" "}
      <Link href={links.to("performa", { minggu: week, stasiun: station })} className={linkClass} data-print="hide">
        Isi penilaian
      </Link>
    </>
  ) : null;

  const findings = kpsStationView ? (
    <div className="flex flex-col gap-1">
      {viewed?.findings ? (
        <>
          <p className="text-sm whitespace-pre-wrap text-ink">{viewed.findings}</p>
          <p className="text-xs text-ink-muted" data-print="hide">
            {lastChangedLabel(viewed, ws)}
          </p>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-muted" data-print="hide">
            Belum ada temuan dari {station} untuk Minggu ke-{week}.
          </p>
          <PrintedFindings text="" />
        </>
      )}
    </div>
  ) : (
    <FindingsEditor
      key={week}
      action={saveWeeklyFindings.bind(null, access.key, week)}
      week={week}
      scopeName={ws.isKps ? "KPS" : ws.scope}
      printLabel={ws.isKps ? "Temuan KPS" : undefined}
      initialFindings={own?.findings ?? ""}
      lastChanged={own ? lastChangedLabel(own, ws) : null}
    />
  );

  return (
    <div className="flex flex-col gap-6 print:gap-4">
      <div className="hidden print:flex print:items-center print:gap-4">
        <Logo height={32} />
        <div className="border-l border-line pl-4">
          <p className="text-sm font-semibold text-ink">{APP_NAME}</p>
          <p className="text-xs text-ink-muted">{APP_TAGLINE}</p>
        </div>
      </div>

      <PageHeader
        title="Laporan Mingguan"
        meta={`${scopeShort} · Minggu ke-${week} · ${formatTanggalPendek(report.periodStart)} s.d. ${formatTanggal(report.periodEnd)}`}
      />

      <Toolbar label="Pilih laporan" end={<PrintButton variant={kpsStationView ? "primary" : "secondary"} />}>
        <WeekSelect
          label="Minggu"
          options={weekOptions(s, (n) => links.to("laporan", { minggu: n, stasiun: station }))}
          current={String(week)}
          nowValue={thisWeek === null ? undefined : String(thisWeek)}
        />
        {ws.isKps ? (
          <StationSelect
            current={station ?? ALL_STATIONS}
            options={[
              { value: ALL_STATIONS, label: "Semua stasiun", href: links.to("laporan", { minggu: week }) },
              ...stationCodes(ws).map((code) => ({
                value: code,
                label: code,
                href: links.to("laporan", { minggu: week, stasiun: code }),
              })),
            ]}
          />
        ) : null}
      </Toolbar>

      <article
        aria-label={`Laporan Minggu ke-${week}`}
        className="flex flex-col gap-8 rounded-panel border border-line bg-surface p-4 sm:p-6 print:gap-5 print:border-0 print:p-0"
      >
        <Section
          id="bagian-a"
          title="A. Performa SDM"
          note={scoreNote}
          caption={`Rata-rata aspek A sampai F, skala 1 sampai 5. Sesuai = rata-rata ≥ ${formatScore(s.passAvgMin)}, Tidak Sesuai = di bawah ${formatScore(s.improveAvgMin)}. Kenaikan dihitung terhadap rata-rata baseline training semua SDM.`}
        >
          <TableFrame>
            <WeeklyPerformanceTable caption={`Performa SDM Minggu ke-${week}`} rows={withoutTotals(report.performance, single)} />
          </TableFrame>
        </Section>

        <Section id="bagian-b" title="B. Progres tindak lanjut" caption={`Posisi per ${formatTanggal(report.asOf)}.`}>
          <TableFrame>
            <ActionProgressTable caption="Progres tindak lanjut per laporan" rows={withoutTotals(report.actionProgress, single)} />
          </TableFrame>
        </Section>

        <Section
          id="bagian-c"
          title={`C. Cek BMI periode ${report.bmiPeriod}`}
          note={
            totalBmi && totalBmi.checked === 0 ? (
              <>
                Belum ada cek BMI periode {report.bmiPeriod}.{" "}
                {report.bmiPlannedDate <= today ? (
                  <Link
                    href={links.to("bmi", { periode: report.bmiPeriod, stasiun: station })}
                    className={linkClass}
                    data-print="hide"
                  >
                    Catat cek BMI
                  </Link>
                ) : null}
              </>
            ) : null
          }
          caption={`Rencana ${formatTanggal(report.bmiPlannedDate)}. Tinggi tidak memenuhi memakai cek terakhir tiap SDM dan terhitung bila L/P dan standar tinggi terisi.`}
        >
          <TableFrame>
            <BmiPeriodTable caption={`Cek BMI periode ${report.bmiPeriod}`} rows={withoutTotals(report.bmi, single)} />
          </TableFrame>
        </Section>

        <Section id="bagian-d" title={`D. Tren skor praktik, Minggu 1 sampai ${s.weeks}`}>
          {trendEmpty ? (
            <EmptyState title="Belum ada nilai mingguan" layout="inline">
              Tren muncul setelah penilaian Minggu ke-1 diisi.
            </EmptyState>
          ) : (
            <>
              <TrendChart rows={single ? trendRows : stationTrend} reference={single ? null : semua} passAvgMin={s.passAvgMin} />
              <TableFrame>
                <TrendTable caption="Rata-rata skor praktik per stasiun per minggu" rows={trendRows} selectedWeek={week} />
              </TableFrame>
            </>
          )}
        </Section>

        <Section
          id="bagian-e"
          title="E. Temuan, kendala dan rencana minggu depan"
          className={ws.isKps ? undefined : "order-first print:order-none"}
        >
          {findings}
          {stationFindings.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-ink">Temuan stasiun</h3>
              {filledFindings.length > 0 ? (
                <dl className="flex flex-col divide-y divide-line rounded-control border border-line">
                  {filledFindings.map(({ code, row }) => (
                    <div key={code} className="grid gap-1 px-3 py-2 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-4">
                      <dt className="station-code text-sm text-ink">{code}</dt>
                      <dd className="text-sm">
                        <p className="whitespace-pre-wrap text-ink">{row!.findings}</p>
                        <p className="mt-1 text-xs text-ink-muted" data-print="hide">
                          {lastChangedLabel(row!, ws)}
                        </p>
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {emptyFindings.length > 0 ? (
                <p className="text-sm text-ink-muted">
                  Belum ada temuan ({emptyFindings.length} stasiun): {emptyFindings.join(", ")}
                </p>
              ) : null}
            </div>
          ) : null}
        </Section>

        <SignatureBlock />
      </article>
    </div>
  );
}

function Section({
  id,
  title,
  note,
  caption,
  className,
  children,
}: {
  id: string;
  title: string;
  /** Why a table is empty, in one short line. */
  note?: ReactNode;
  /** One muted line under the content: definitions and the basis of the numbers. */
  caption?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-judul`}
      className={cx("flex min-w-0 flex-col gap-3 print:break-inside-avoid", className)}
    >
      <h2 id={`${id}-judul`} className="text-lg font-semibold text-ink print:text-base">
        {title}
      </h2>
      {note ? <p className="text-sm text-ink-muted">{note}</p> : null}
      {children}
      {caption ? <p className="text-xs text-ink-muted">{caption}</p> : null}
    </section>
  );
}

/** Bordered table; on paper the rows tighten so a section fits beside the next one. */
function TableFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-control border border-line print:[&_td]:h-6 print:[&_td]:py-0.5 print:[&_th]:h-6 print:[&_th]:py-0.5">
      {children}
    </div>
  );
}

/** Two signatures with room to sign. Paper only. */
function SignatureBlock() {
  return (
    <div className="hidden gap-8 pt-2 text-sm text-ink print:grid print:grid-cols-2 print:break-inside-avoid">
      {[
        { lead: "Disusun oleh,", role: "Manager / PIC JOUMPA Cabang" },
        { lead: "Mengetahui,", role: "General Manager Cabang" },
      ].map(({ lead, role }) => (
        <div key={role} className="flex flex-col">
          <p>{lead}</p>
          <span aria-hidden="true" className="h-16" />
          <p aria-label="Tanda tangan dan nama">( ........................................ )</p>
          <p className="font-semibold">{role}</p>
        </div>
      ))}
    </div>
  );
}
