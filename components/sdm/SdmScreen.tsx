import {
  firstParam,
  hrefs,
  parseStation,
  ruleSettings,
  sortedStaff,
  stationCodes,
  type ScreenProps,
  type WorkspaceAccess,
} from "@/lib/workspace";
import { PageHeader, PageLoading } from "@/components/ui/PageHeader";
import { RememberView } from "@/components/ui/RememberView";
import { rememberScope } from "@/components/ui/remember";
import { StationSelect } from "@/components/ui/StationSelect";
import { UrlSelect } from "@/components/ui/UrlSelect";
import { ALL_STATIONS, type UrlOption } from "@/components/ui/url-options";
import { StaffGrid } from "@/components/sdm/StaffGrid";
import { AddStaffButton } from "@/components/sdm/AddStaffButton";
import { CHECKS, CHECK_LABELS, MATCHES, parseCheck, toRows, type Check } from "@/components/sdm/rows";
import { deleteStaff, saveStaff, saveStaffGender } from "./actions";

const TITLE = "Data SDM";

export function SdmLoading() {
  return <PageLoading title={TITLE} label="Memuat daftar SDM" />;
}

type Query = { station: string | null; check: Check | null };

function hrefFor(access: WorkspaceAccess, q: Query): string {
  return hrefs(access).to("sdm", { stasiun: q.station, cek: q.check });
}

/** Data SDM: staff records, training results and the rows that need a look. */
export function SdmScreen({ access, ws, searchParams: sp }: ScreenProps) {
  const settings = ruleSettings(ws.settings);
  const query: Query = {
    station: parseStation(ws, sp.stasiun),
    // ?lp=1 is the older link for the missing-L/P filter.
    check: parseCheck(sp.cek) ?? (firstParam(sp.lp) === "1" ? "lp-kosong" : null),
  };

  const allStaff = sortedStaff(ws);
  const scopeStaff = query.station ? allStaff.filter((s) => s.station === query.station) : allStaff;
  const scopeRows = toRows(ws, scopeStaff, settings);
  const rows = query.check ? scopeRows.filter(MATCHES[query.check]) : scopeRows;
  const scopeName = query.station ?? (ws.isKps ? "semua stasiun" : ws.scopeLabel);
  const stations = stationCodes(ws);
  const ownStation = ws.isKps ? null : ws.scope;

  const count = (check: Check) => scopeRows.filter(MATCHES[check]).length;
  const flagged = count("perlu");
  const checkOptions: UrlOption[] = [
    { value: "semua", label: `Semua SDM (${scopeRows.length})`, href: hrefFor(access, { ...query, check: null }) },
    ...CHECKS.map((check) => ({
      value: check,
      label: `${CHECK_LABELS[check]} (${count(check)})`,
      href: hrefFor(access, { ...query, check }),
    })),
  ];
  const stationOptions: UrlOption[] = [null, ...stations].map((code) => ({
    value: code ?? ALL_STATIONS,
    label: `${code ?? "Semua stasiun"} (${code ? allStaff.filter((s) => s.station === code).length : allStaff.length})`,
    href: hrefFor(access, { ...query, station: code }),
  }));

  const filters = (
    <>
      {ws.isKps ? <StationSelect options={stationOptions} current={query.station ?? ALL_STATIONS} /> : null}
      <UrlSelect
        label={`Perlu diperiksa (${flagged})`}
        options={checkOptions}
        current={query.check ?? "semua"}
        width="w-full sm:w-64"
      />
    </>
  );

  const checkName =
    query.check === "perlu"
      ? "yang perlu diperiksa"
      : query.check === "lp-kosong"
        ? "dengan L/P belum diisi"
        : query.check
          ? `dengan ${CHECK_LABELS[query.check]}`
          : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={TITLE}
        meta={`${ws.scopeLabel} · ${scopeRows.length} SDM${flagged > 0 ? ` · ${flagged} perlu diperiksa` : ""}`}
        actions={
          <AddStaffButton
            accessKey={access.key}
            isKps={ws.isKps}
            ownStation={ownStation}
            stations={stations}
            settings={settings}
            saveAction={saveStaff}
          />
        }
      >
        {ws.isKps ? (
          <RememberView scope={rememberScope(access, ws)} allowed={{ stasiun: stations }} shown={{ stasiun: query.station }} />
        ) : null}
      </PageHeader>

      <StaffGrid
        caption={`Data SDM ${scopeName}`}
        rows={rows}
        toolbar={filters}
        emptyTitle={checkName ? `Tidak ada SDM ${checkName} di ${scopeName}` : `Belum ada SDM di ${scopeName}`}
        emptyHint={checkName ? "Pilih Semua SDM untuk melihat seluruh daftar." : "Tambahkan lewat Tambah SDM."}
        accessKey={access.key}
        isKps={ws.isKps}
        ownStation={ownStation}
        stations={stations}
        settings={settings}
        saveAction={saveStaff}
        saveGenderAction={saveStaffGender}
        canDelete={access.kind === "owner"}
        deleteAction={deleteStaff}
      />
    </div>
  );
}
