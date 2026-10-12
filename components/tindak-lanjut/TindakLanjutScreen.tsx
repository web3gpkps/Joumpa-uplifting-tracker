import { PageHeader, PageLoading } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { FilterBar } from "@/components/ui/Toolbar";
import { UrlSelect } from "@/components/ui/UrlSelect";
import type { UrlOption } from "@/components/ui/url-options";
import { todayInJakarta } from "@/components/shell/programme-calendar";
import { ActionTable } from "@/components/tindak-lanjut/ActionTable";
import { AddActionItemButton } from "@/components/tindak-lanjut/AddActionItemButton";
import { byUrgency, toActionView } from "@/components/tindak-lanjut/action-view";
import { reportGroups } from "@/lib/aggregate";
import { reportGroupOf } from "@/lib/rules";
import { firstParam, hrefs, ruleSettings, settingsComplete, type ScreenProps } from "@/lib/workspace";

const TITLE = "Tindak Lanjut";
const ALL = "semua";

export function TindakLanjutLoading() {
  return <PageLoading title={TITLE} label="Memuat tindak lanjut" />;
}

/**
 * Action items sorted by flag (OVERDUE, jatuh tempo, the rest, Selesai). Station links see
 * their report group's items; KPS and the owner see every group with a Laporan filter.
 * Every item opens "Perbarui progres"; the owner can also add and delete items.
 */
export function TindakLanjutScreen({ access, ws, searchParams }: ScreenProps) {
  const today = todayInJakarta();
  const settings = ruleSettings(ws.settings);
  const isOwner = access.kind === "owner" && ws.isOwner;
  const links = hrefs(access);

  const all = ws.actionItems.map((item) => toActionView(item, settings, today, ws));

  // Report groups of this workspace (CGK and HLP share "CGK & HLP"); fall back to the items' own groups.
  const fromStations = ws.stations.length > 0 ? reportGroups(ws.stations) : [];
  const groupKeys = fromStations.length > 0 ? fromStations : [...new Set(all.map((v) => v.reportGroup))];

  // ?laporan= (or ?stasiun=, mapped to its report group) for KPS and the owner; a station
  // link always works on its own group.
  const requested =
    firstParam(searchParams.laporan) ?? reportGroupOf(firstParam(searchParams.stasiun)?.toUpperCase()) ?? null;
  const groupFilter = ws.isKps && requested && groupKeys.includes(requested) ? requested : null;
  const items = (groupFilter ? all.filter((v) => v.reportGroup === groupFilter) : all).sort(byUrgency);

  const overdue = items.filter((v) => v.flag === "OVERDUE").length;
  const dueSoon = items.filter((v) => v.flag === "Jatuh tempo ≤ 7 hari").length;
  const scopeCode = groupFilter
    ? `Laporan ${groupFilter}`
    : ws.isKps
      ? "Semua laporan"
      : `Laporan ${groupKeys[0] ?? ws.scope}`;
  const meta = `${scopeCode} · ${items.length} butir · ${overdue} OVERDUE · ${dueSoon} jatuh tempo ≤ 7 hari`;

  const filterOptions: UrlOption[] | null = ws.isKps
    ? [null, ...groupKeys].map((key) => ({
        value: key ?? ALL,
        label: key ?? "Semua laporan",
        href: links.to("tindakLanjut", { laporan: key }),
      }))
    : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={TITLE}
        meta={meta}
        actions={
          isOwner ? (
            <AddActionItemButton
              accessKey={access.key}
              existing={all.map((v) => ({ code: v.code, reportGroup: v.reportGroup }))}
              defaultGroup={groupFilter}
            />
          ) : undefined
        }
      />

      {filterOptions ? (
        <FilterBar label="Filter tindak lanjut">
          <UrlSelect label="Laporan" options={filterOptions} current={groupFilter ?? ALL} />
        </FilterBar>
      ) : null}

      {!settingsComplete(ws.settings) ? (
        <p className="text-sm text-warning">Parameter belum lengkap: batas waktu bergulir memakai nilai bawaan.</p>
      ) : null}

      <Panel padding="flush">
        <ActionTable
          // A new report-group filter starts with fresh row state.
          key={groupFilter ?? ALL}
          accessKey={access.key}
          isKps={ws.isKps}
          isOwner={isOwner}
          today={today}
          settings={settings}
          items={items}
          showGroup={ws.isKps && !groupFilter}
          caption={`Tindak lanjut, ${scopeCode.toLowerCase()}`}
          emptyTitle={`Belum ada butir tindak lanjut untuk ${scopeCode.toLowerCase()}`}
        />
      </Panel>
    </div>
  );
}
