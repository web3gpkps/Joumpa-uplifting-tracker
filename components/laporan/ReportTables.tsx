/*
 * Laporan Mingguan sections A to D as tables. Rows come from lib/aggregate weeklyReport();
 * nothing is recomputed here.
 */
import type { ReactNode } from "react";
import { TOTAL, type ActionProgressRow, type BmiPeriodRow, type TrendRow, type WeeklyPerformanceRow } from "@/lib/aggregate";
import { DataTable, Td, Th, Tr } from "@/components/ui/DataTable";
import { formatProgress, formatRatio, formatScore, formatSignedScore } from "@/lib/format";
import { Flagged, Value } from "@/components/ringkasan/format";

/** Column header that may wrap onto two lines, so wide sections fit an A4 landscape page. */
export function ColTh({ children, numeric = true }: { children: ReactNode; numeric?: boolean }) {
  return (
    <Th numeric={numeric} className="min-w-18 align-bottom whitespace-normal">
      {children}
    </Th>
  );
}

/** Row label cell; the TOTAL / SEMUA row reads heavier, like the workbook's bold total line. */
export function RowTh({ children }: { children: ReactNode }) {
  return (
    <Th scope="row" className="font-semibold whitespace-nowrap text-ink">
      {children}
    </Th>
  );
}

export function totalRowClass(key: string): string | undefined {
  return key === TOTAL || key === "SEMUA" ? "font-semibold [&>*]:bg-bg" : undefined;
}

type TableProps<T> = { caption: string; rows: T[]; hideCaption?: boolean };

/** B: action items per report group. */
export function ActionProgressTable({ caption, rows, hideCaption = true }: TableProps<ActionProgressRow>) {
  return (
    <DataTable caption={caption} hideCaption={hideCaption} stickyHeader={false} density="dense">
      <thead>
        <tr>
          <Th className="align-bottom">Laporan</Th>
          <ColTh>Total butir</ColTh>
          <ColTh>Selesai</ColTh>
          <ColTh>On Progress</ColTh>
          <ColTh>Belum Mulai</ColTh>
          <ColTh>Tertunda</ColTh>
          <ColTh>OVERDUE</ColTh>
          <ColTh>Jatuh tempo ≤ 7 hari</ColTh>
          <ColTh>% Selesai</ColTh>
          <ColTh>Rata-rata % progres</ColTh>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <Tr key={r.key} className={totalRowClass(r.key)}>
            <RowTh>{r.key}</RowTh>
            <Td numeric>{r.total}</Td>
            <Td numeric>{r.selesai}</Td>
            <Td numeric>{r.onProgress}</Td>
            <Td numeric>{r.belumMulai}</Td>
            <Td numeric>{r.tertunda}</Td>
            <Td numeric>
              <Flagged n={r.overdue} tone="critical" />
            </Td>
            <Td numeric>
              <Flagged n={r.dueSoon} tone="warning" />
            </Td>
            <Td numeric>
              <Value value={r.pctDone} format={formatRatio} />
            </Td>
            <Td numeric>
              <Value value={r.avgProgress} format={formatProgress} />
            </Td>
          </Tr>
        ))}
      </tbody>
    </DataTable>
  );
}

export function WeeklyPerformanceTable({ caption, rows }: { caption: string; rows: WeeklyPerformanceRow[] }) {
  return (
    <DataTable caption={caption} hideCaption stickyHeader={false} density="dense">
      <thead>
        <tr>
          <Th className="align-bottom">Stasiun</Th>
          <ColTh>Jumlah SDM</ColTh>
          <ColTh>Dinilai minggu ini</ColTh>
          <ColTh>Rata-rata minggu ini</ColTh>
          <ColTh>Rata-rata minggu lalu</ColTh>
          <ColTh>Perubahan vs minggu lalu</ColTh>
          <ColTh>Rata-rata baseline training</ColTh>
          <ColTh>Kenaikan vs baseline</ColTh>
          <ColTh>Sesuai</ColTh>
          <ColTh>Perlu Perbaikan</ColTh>
          <ColTh>Tidak Sesuai</ColTh>
          <ColTh>% Sesuai</ColTh>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <Tr key={r.key} className={totalRowClass(r.key)}>
            <RowTh>{r.key}</RowTh>
            <Td numeric>{r.staffCount}</Td>
            <Td numeric>{r.assessed}</Td>
            <Td numeric>
              <Value value={r.avgThisWeek} format={formatScore} />
            </Td>
            <Td numeric>
              <Value value={r.avgLastWeek} format={formatScore} />
            </Td>
            <Td numeric>
              <Value value={r.changeVsLastWeek} format={formatSignedScore} />
            </Td>
            <Td numeric>
              <Value value={r.baselineAvg} format={formatScore} />
            </Td>
            <Td numeric>
              <Value value={r.gainVsBaseline} format={formatSignedScore} />
            </Td>
            <Td numeric>{r.sesuai}</Td>
            <Td numeric>{r.perlu}</Td>
            <Td numeric>{r.tidak}</Td>
            <Td numeric>
              <Value value={r.pctSesuai} format={formatRatio} />
            </Td>
          </Tr>
        ))}
      </tbody>
    </DataTable>
  );
}

export function BmiPeriodTable({ caption, rows }: { caption: string; rows: BmiPeriodRow[] }) {
  return (
    <DataTable caption={caption} hideCaption stickyHeader={false} density="dense">
      <thead>
        <tr>
          <Th className="align-bottom">Stasiun</Th>
          <ColTh>Jumlah SDM</ColTh>
          <ColTh>Sudah dicek</ColTh>
          <ColTh>Belum dicek</ColTh>
          <ColTh>Normal</ColTh>
          <ColTh>Kurus</ColTh>
          <ColTh>Overweight</ColTh>
          <ColTh>Obesitas</ColTh>
          <ColTh>% Normal</ColTh>
          <ColTh>Tinggi tidak memenuhi (cek terakhir)</ColTh>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <Tr key={r.key} className={totalRowClass(r.key)}>
            <RowTh>{r.key}</RowTh>
            <Td numeric>{r.staffCount}</Td>
            <Td numeric>{r.checked}</Td>
            <Td numeric>{r.notChecked}</Td>
            <Td numeric>{r.normal}</Td>
            <Td numeric>{r.kurus}</Td>
            <Td numeric>{r.overweight}</Td>
            <Td numeric>{r.obesitas}</Td>
            <Td numeric>
              <Value value={r.pctNormal} format={formatRatio} />
            </Td>
            <Td numeric>{r.heightNotMet}</Td>
          </Tr>
        ))}
      </tbody>
    </DataTable>
  );
}

export function TrendTable({ caption, rows, selectedWeek }: { caption: string; rows: TrendRow[]; selectedWeek: number }) {
  const weeks = rows[0]?.weeks.length ?? 0;
  return (
    <DataTable caption={caption} hideCaption stickyHeader={false} density="dense">
      <thead>
        <tr>
          <Th className="align-bottom">Stasiun</Th>
          {Array.from({ length: weeks }, (_, i) => (
            <Th key={i} numeric className={i + 1 === selectedWeek ? "text-ink" : undefined}>
              Mg {i + 1}
            </Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <Tr key={r.key} className={totalRowClass(r.key)}>
            <RowTh>{r.key}</RowTh>
            {r.weeks.map((v, i) => (
              <Td key={i} numeric>
                <Value value={v} format={formatScore} />
              </Td>
            ))}
          </Tr>
        ))}
      </tbody>
    </DataTable>
  );
}
