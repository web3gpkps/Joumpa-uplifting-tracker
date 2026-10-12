import Link from "next/link";
import { TOTAL, type ActionProgressRow } from "@/lib/aggregate";
import { formatProgress } from "@/lib/format";
import type { SheetLinks } from "@/lib/workspace/access";
import { DataTable, Td, Th, Tr } from "@/components/ui/DataTable";
import { StatusChip } from "@/components/ui/StatusChip";
import { Flagged, Value } from "./format";

/**
 * Tindak lanjut per laporan (SUB, DPS, CGK & HLP, KNO), then all of them. The laporan name
 * opens Tindak Lanjut filtered to it. Phone: stacked rows.
 */
export function ActionTable({ rows, links }: { rows: ActionProgressRow[]; links: SheetLinks }) {
  const label = (key: string) => (key === TOTAL ? "Semua laporan" : key);
  const hrefFor = (key: string) => links.to("tindakLanjut", { laporan: key === TOTAL ? null : key });
  return (
    <>
      <div className="hidden md:block">
        <DataTable caption="Tindak lanjut per laporan" stickyHeader={false}>
          <thead>
            <tr>
              <Th>Laporan</Th>
              <Th numeric>Selesai</Th>
              <Th numeric>On Progress</Th>
              <Th numeric>OVERDUE</Th>
              <Th numeric>Jatuh tempo ≤ 7 hari</Th>
              <Th numeric>Rata-rata progres</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Tr key={r.key} className={r.key === TOTAL ? "font-semibold [&>*]:bg-bg" : undefined}>
                <Th scope="row">
                  <Link href={hrefFor(r.key)} className="text-brand underline underline-offset-2">
                    {label(r.key)}
                  </Link>
                </Th>
                <Td numeric className="tabular-nums">
                  {r.selesai}
                  <span className="text-ink-muted">/{r.total}</span>
                </Td>
                <Td numeric>{r.onProgress}</Td>
                <Td numeric>
                  <Flagged n={r.overdue} tone="critical" />
                </Td>
                <Td numeric>
                  <Flagged n={r.dueSoon} tone="warning" />
                </Td>
                <Td numeric>
                  <Value value={r.avgProgress} format={formatProgress} emptyReason="belum ada butir" />
                </Td>
              </Tr>
            ))}
          </tbody>
        </DataTable>
      </div>

      <ul className="flex flex-col divide-y divide-line md:hidden" aria-label="Tindak lanjut per laporan">
        {rows.map((r) => (
          <li key={r.key}>
            <Link href={hrefFor(r.key)} className="flex min-h-12 flex-col justify-center gap-1 px-4 py-3 hover:bg-bg">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-semibold text-brand">{label(r.key)}</span>
                {r.overdue > 0 ? <StatusChip label={`${r.overdue} OVERDUE`} tone="critical" /> : null}
                {r.dueSoon > 0 ? <StatusChip label={`${r.dueSoon} jatuh tempo ≤ 7 hari`} tone="warning" /> : null}
              </span>
              <span className="text-sm text-ink-muted tabular-nums">
                Selesai {r.selesai}/{r.total} · On Progress {r.onProgress} · progres{" "}
                {r.avgProgress === null ? "–" : formatProgress(r.avgProgress)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
