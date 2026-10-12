import Link from "next/link";
import type { ReactNode } from "react";
import type { DashboardLink, StationRow } from "@/lib/dashboard";
import type { SheetLinks } from "@/lib/workspace/access";
import { DataTable, Td, Th, Tr } from "@/components/ui/DataTable";
import { StatusChip } from "@/components/ui/StatusChip";
import { Flagged, Value } from "./format";

type StationTableProps = {
  /** Worst first. */
  rows: StationRow[];
  total: StationRow;
  links: SheetLinks;
};

const cellLink = "-mx-3 -my-2 flex min-h-10 items-center justify-end px-3 py-2 hover:bg-bg";

function href(links: SheetLinks, link: DashboardLink): string {
  return links.to(link.sheet, link.query);
}

function Ratio({ value, total, reason }: { value: number | null; total: number; reason: string }) {
  if (value === null) return <Value value={null} emptyReason={reason} />;
  return (
    <span className="tabular-nums">
      {value}
      <span className="text-ink-muted">/{total}</span>
    </span>
  );
}

function CellLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={cellLink}>
      {children}
    </Link>
  );
}

function Cells({ row, links }: { row: StationRow; links: SheetLinks }) {
  return (
    <>
      <Td numeric>
        <CellLink href={href(links, row.links.performa)}>
          <Ratio value={row.assessed} total={row.staffCount} reason="belum mulai" />
        </CellLink>
      </Td>
      <Td numeric>
        <CellLink href={href(links, row.links.bmi)}>
          <Ratio value={row.bmiChecked} total={row.staffCount} reason="belum ada cek" />
        </CellLink>
      </Td>
      <Td numeric>
        <CellLink href={href(links, row.links.rekap)}>
          <Flagged n={row.tidakSesuai} tone="critical" />
        </CellLink>
      </Td>
      <Td numeric>
        <CellLink href={href(links, row.links.tindakLanjut)}>
          <Flagged n={row.actionOverdue} tone="critical" />
        </CellLink>
      </Td>
      <Td numeric>
        <CellLink href={href(links, row.links.penggantian)}>
          <Flagged n={row.replacementOpen} tone={row.replacementOverdue > 0 ? "critical" : "warning"} />
        </CellLink>
      </Td>
    </>
  );
}

/**
 * KPS / owner: one row per station, worst first, then all stations together. The station
 * code opens that station's Beranda; each number opens the screen filtered to it.
 * Phone: the same rows stacked, one link per station.
 */
export function StationTable({ rows, total, links }: StationTableProps) {
  const shared = rows.filter((r) => r.sharedGroup);
  return (
    <>
      <div className="hidden md:block">
        <DataTable caption="Pekerjaan per stasiun, terburuk di atas" stickyHeader={false}>
          <thead>
            <tr>
              <Th>Stasiun</Th>
              <Th numeric>Dinilai</Th>
              <Th numeric>Cek BMI</Th>
              <Th numeric>Tidak Sesuai</Th>
              <Th numeric>Tindak lanjut OVERDUE</Th>
              <Th numeric>Penggantian belum efektif</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Tr key={r.station}>
                <Th scope="row">
                  <Link href={href(links, r.links.station)} className="station-code text-brand underline underline-offset-2">
                    {r.station}
                  </Link>
                </Th>
                <Cells row={r} links={links} />
              </Tr>
            ))}
            <Tr className="font-semibold [&>*]:bg-bg">
              <Th scope="row">Semua stasiun</Th>
              <Cells row={total} links={links} />
            </Tr>
          </tbody>
        </DataTable>
      </div>

      <ul className="flex flex-col divide-y divide-line md:hidden" aria-label="Pekerjaan per stasiun, terburuk di atas">
        {rows.map((r) => (
          <li key={r.station}>
            <Link href={href(links, r.links.station)} className="flex min-h-12 flex-col justify-center gap-1 px-4 py-3 hover:bg-bg">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="station-code text-sm text-brand">{r.station}</span>
                {r.actionOverdue > 0 ? <StatusChip label={`${r.actionOverdue} OVERDUE`} tone="critical" /> : null}
                {r.tidakSesuai > 0 ? <StatusChip label={`${r.tidakSesuai} Tidak Sesuai`} tone="critical" /> : null}
              </span>
              <PhoneCounts row={r} />
            </Link>
          </li>
        ))}
        <li className="flex min-h-12 flex-col justify-center gap-1 px-4 py-3">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-ink">Semua stasiun</span>
            {total.actionOverdue > 0 ? <StatusChip label={`${total.actionOverdue} OVERDUE`} tone="critical" /> : null}
            {total.tidakSesuai > 0 ? <StatusChip label={`${total.tidakSesuai} Tidak Sesuai`} tone="critical" /> : null}
          </span>
          <PhoneCounts row={total} />
        </li>
      </ul>
      {shared.length > 0 ? (
        <p className="border-t border-line px-4 py-3 text-xs text-ink-muted">
          {shared.map((r) => r.station).join(" dan ")} memakai satu laporan tindak lanjut, {shared[0].group}.
        </p>
      ) : null}
    </>
  );
}

function PhoneCounts({ row }: { row: StationRow }) {
  return (
    <span className="text-sm text-ink-muted tabular-nums">
      Dinilai {row.assessed === null ? "–" : `${row.assessed}/${row.staffCount}`} · Cek BMI{" "}
      {row.bmiChecked === null ? "–" : `${row.bmiChecked}/${row.staffCount}`} · Penggantian belum efektif{" "}
      {row.replacementOpen}
    </span>
  );
}
