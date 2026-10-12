"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { DataTable, DataTableEmpty, Td, Th, Tr } from "@/components/ui/DataTable";
import { StatusChip } from "@/components/ui/StatusChip";
import { cx } from "@/components/ui/cx";
import type { Settings } from "@/lib/rules";
import { ActionItemDialog } from "./ActionItemDialog";
import { DeleteActionItemDialog } from "./DeleteActionItemDialog";
import { describeDaysLeft, type ActionView } from "./action-view";

type ActionTableProps = {
  accessKey: string;
  /** KPS links and the owner: definitions and Catatan KPS in the dialog. */
  isKps: boolean;
  /** Owner only: "Hapus" on each row. */
  isOwner: boolean;
  today: string;
  settings: Settings;
  /** Already filtered and sorted by flag. */
  items: ActionView[];
  /** Show the Laporan column (KPS / owner viewing every report group). */
  showGroup: boolean;
  caption: string;
  emptyTitle: string;
};

function DueDate({ view }: { view: ActionView }) {
  if (!view.dueLabel) return <span className="text-ink-muted">–</span>;
  return (
    <span className="flex flex-col">
      <span className="tabular">{view.dueLabel}</span>
      {view.daysLeft !== null ? (
        <span className={cx("text-xs", view.daysLeft < 0 ? "font-semibold text-critical" : "text-ink-muted")}>
          {describeDaysLeft(view.daysLeft)}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Tindak Lanjut list: a table from 900 px, one card per item below. Each item opens
 * "Perbarui progres" in a dialog; the owner can also delete. Client component.
 */
export function ActionTable({
  accessKey,
  isKps,
  isOwner,
  today,
  settings,
  items,
  showGroup,
  caption,
  emptyTitle,
}: ActionTableProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");

  // Beranda links here as #tl-<code>: scroll that item into view and focus its button.
  useEffect(() => {
    if (!window.location.hash.startsWith("#tl-")) return;
    const code = decodeURIComponent(window.location.hash.slice(4));
    const target = [...document.querySelectorAll<HTMLElement>("[data-tl-code]")].find(
      (el) => el.dataset.tlCode === code && el.getClientRects().length > 0,
    );
    if (!target) return;
    target.scrollIntoView({ block: "center" });
    target.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
  }, []);

  const editingItem = editing ? (items.find((v) => v.code === editing) ?? null) : null;
  const deletingItem = deleting ? (items.find((v) => v.code === deleting) ?? null) : null;
  const columns = showGroup ? 8 : 7;

  return (
    <>
      <div role="status" aria-live="polite" className="px-4 pt-3 text-sm font-semibold text-good empty:hidden">
        {notice}
      </div>

      <div className="hidden grid:block">
        <DataTable caption={caption} minWidth="960px">
          <thead>
            <tr>
              <Th>Butir</Th>
              {showGroup ? <Th>Laporan</Th> : null}
              <Th>Flag</Th>
              <Th>Status</Th>
              <Th numeric>% Progres</Th>
              <Th>Batas waktu</Th>
              <Th>PIC</Th>
              <Th>
                <span className="sr-only">Aksi</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <DataTableEmpty colSpan={columns} title={emptyTitle} />
            ) : (
              items.map((view) => (
                <Tr key={view.code} data-tl-code={view.code} selected={Boolean(savedAt[view.code])}>
                  <Th scope="row" className="max-w-md font-normal whitespace-normal">
                    <span className="station-code">{view.code}</span>
                    <span className="block text-ink">{view.action ?? "Tindakan belum diisi"}</span>
                    {view.area ? <span className="block text-xs text-ink-muted">{view.area}</span> : null}
                  </Th>
                  {showGroup ? (
                    <Td>
                      <span className="station-code">{view.reportGroup}</span>
                    </Td>
                  ) : null}
                  <Td>
                    <StatusChip label={view.flag} emptyLabel="–" />
                  </Td>
                  <Td>
                    <StatusChip label={view.status} />
                  </Td>
                  <Td numeric>{view.progress}%</Td>
                  <Td>
                    <DueDate view={view} />
                  </Td>
                  <Td className="whitespace-normal">{view.pic ?? <span className="text-ink-muted">–</span>}</Td>
                  <Td>
                    <span className="flex gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => setEditing(view.code)}>
                        Perbarui progres<span className="sr-only"> {view.code}</span>
                      </Button>
                      {isOwner ? (
                        <Button size="sm" variant="ghost" onClick={() => setDeleting(view.code)}>
                          Hapus<span className="sr-only"> butir {view.code}</span>
                        </Button>
                      ) : null}
                    </span>
                  </Td>
                </Tr>
              ))
            )}
          </tbody>
        </DataTable>
      </div>

      <ul aria-label={caption} className="divide-y divide-line grid:hidden">
        {items.length === 0 ? (
          <li className="px-4 py-6 text-sm font-semibold text-ink">{emptyTitle}</li>
        ) : (
          items.map((view) => (
            <li
              key={view.code}
              data-tl-code={view.code}
              className={cx("flex flex-col gap-3 px-4 py-4", savedAt[view.code] && "bg-brand-tint")}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-sm text-ink [overflow-wrap:anywhere]">
                  <span className="station-code">
                    {view.code}
                    {showGroup ? <span className="font-normal text-ink-muted"> · {view.reportGroup}</span> : null}
                  </span>
                  <span className="block">{view.action ?? "Tindakan belum diisi"}</span>
                </p>
                {view.flag ? <StatusChip label={view.flag} className="shrink-0" /> : null}
              </div>
              <dl className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-ink-muted">Status</dt>
                  <dd>
                    <StatusChip label={view.status} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Progres</dt>
                  <dd className="tabular">{view.progress}%</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-ink-muted">Batas waktu</dt>
                  <dd className="[overflow-wrap:anywhere]">
                    <DueDate view={view} />
                  </dd>
                </div>
              </dl>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="secondary" fullWidth onClick={() => setEditing(view.code)}>
                  Perbarui progres<span className="sr-only"> {view.code}</span>
                </Button>
                {isOwner ? (
                  <Button variant="ghost" fullWidth onClick={() => setDeleting(view.code)}>
                    Hapus<span className="sr-only"> butir {view.code}</span>
                  </Button>
                ) : null}
              </div>
            </li>
          ))
        )}
      </ul>

      <ActionItemDialog
        accessKey={accessKey}
        isKps={isKps}
        today={today}
        settings={settings}
        item={editingItem}
        onClose={() => setEditing(null)}
        onSaved={(code, at) => setSavedAt((current) => ({ ...current, [code]: at }))}
      />
      {isOwner ? (
        <DeleteActionItemDialog
          accessKey={accessKey}
          item={deletingItem}
          onClose={() => setDeleting(null)}
          onDeleted={(code) => {
            setDeleting(null);
            setNotice(`Butir ${code} dihapus.`);
          }}
        />
      ) : null}
    </>
  );
}
