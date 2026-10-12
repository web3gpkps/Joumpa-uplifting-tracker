import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { ReloadButton } from "@/components/ui/ReloadButton";
import { StatusChip } from "@/components/ui/StatusChip";
import { ConflictTable, type ConflictRow } from "@/components/admin/ConflictTable";
import { formatRelatif, formatWaktu } from "@/components/admin/format";
import { requireAdmin } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sinkronisasi" };

const OPEN_LIMIT = 200;
const RESOLVED_LIMIT = 50;
const CONFLICT_COLUMNS =
  "id, created_at, table_name, row_key, column_name, baseline, sheet_value, db_value, resolution, resolved_at";

export default function SinkronisasiPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Sinkronisasi" meta="Database aplikasi sumber utama · Google Sheet salinan" />
      <Suspense fallback={<LoadingState label="Memuat status sinkronisasi" />}>
        <SyncData />
      </Suspense>
    </div>
  );
}

function toConflict(row: {
  id: number;
  created_at: string;
  table_name: string;
  row_key: string | null;
  column_name: string | null;
  baseline: unknown;
  sheet_value: unknown;
  db_value: unknown;
  resolution: string | null;
  resolved_at: string | null;
}): ConflictRow {
  return {
    id: row.id,
    createdAt: row.created_at,
    tableName: row.table_name,
    rowKey: row.row_key,
    columnName: row.column_name,
    baseline: row.baseline,
    sheetValue: row.sheet_value,
    dbValue: row.db_value,
    resolution: row.resolution,
    resolvedAt: row.resolved_at,
  };
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="section-label">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{children}</dd>
    </div>
  );
}

async function SyncData() {
  await requireAdmin();
  const supabase = await createClient();
  // sync_state.baseline (the full snapshot) is never read here: it is large and not shown.
  const [stateResult, openResult, resolvedResult] = await Promise.all([
    supabase
      .from("sync_state")
      .select("initialized, lease_token, lease_until, last_success_at, last_error, failures, last_ping_at")
      .eq("id", true)
      .maybeSingle(),
    supabase
      .from("sync_conflicts")
      .select(CONFLICT_COLUMNS, { count: "exact" })
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(OPEN_LIMIT),
    supabase
      .from("sync_conflicts")
      .select(CONFLICT_COLUMNS, { count: "exact" })
      .not("resolved_at", "is", null)
      .order("resolved_at", { ascending: false })
      .limit(RESOLVED_LIMIT),
  ]);

  // Request time (after the queries): reading the clock is allowed here.
  const now = new Date();
  const state = stateResult.data;
  const leaseHeld = Boolean(state?.lease_token && state.lease_until && new Date(state.lease_until) > now);

  let health: { label: string; tone: "good" | "warning" | "critical" | "neutral" };
  if (!state) health = { label: "Status tidak tersedia", tone: "neutral" };
  else if (state.failures > 0) health = { label: `Gagal ${state.failures} kali berturut-turut`, tone: "critical" };
  else if (!state.last_success_at) health = { label: "Belum pernah berhasil", tone: "warning" };
  else health = { label: "Sinkron terakhir berhasil", tone: "good" };

  const openRows = (openResult.data ?? []).map(toConflict);
  const resolvedRows = (resolvedResult.data ?? []).map(toConflict);
  const openCount = openResult.count ?? openRows.length;
  const resolvedCount = resolvedResult.count ?? resolvedRows.length;

  return (
    <div className="flex flex-col gap-6">
      <Panel
        title="Status"
        actions={<StatusChip label={health.label} tone={health.tone} />}
      >
        {stateResult.error ? (
          <ErrorState
            title="Status sinkronisasi tidak bisa dimuat"
            cause="Server tidak menjawab."
            action={<ReloadButton />}
          />
        ) : !state ? (
          <ErrorState
            title="Sinkronisasi belum disiapkan"
            action="Hubungi pengelola aplikasi."
          />
        ) : (
          <div className="flex flex-col gap-4">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Item label="Sinkron terakhir berhasil">
                {state.last_success_at ? (
                  <>
                    {formatWaktu(state.last_success_at)} WIB
                    <span className="block text-xs text-ink-muted">{formatRelatif(state.last_success_at, now)}</span>
                  </>
                ) : (
                  <span className="text-ink-muted">Belum pernah</span>
                )}
              </Item>
              <Item label="Gagal berturut-turut">
                <span className="tabular-nums">{state.failures} kali</span>
              </Item>
              <Item label="Proses berjalan (kunci)">
                {leaseHeld ? (
                  <>Ya, terkunci sampai {formatWaktu(state.lease_until)} WIB</>
                ) : (
                  <span className="text-ink-muted">Tidak ada proses berjalan</span>
                )}
              </Item>
              <Item label="Ping terakhir">
                {state.last_ping_at ? (
                  <>
                    {formatWaktu(state.last_ping_at)} WIB
                    <span className="block text-xs text-ink-muted">{formatRelatif(state.last_ping_at, now)}</span>
                  </>
                ) : (
                  <span className="text-ink-muted">Belum ada ping</span>
                )}
              </Item>
            </dl>
            {!state.initialized ? (
              <p className="text-sm text-warning">
                Sinkron pertama belum selesai.
              </p>
            ) : null}
            <div>
              <h3 className="section-label">Galat terakhir</h3>
              {state.last_error ? (
                <p className="mt-1 rounded-control border border-line bg-bg p-3 text-sm wrap-break-word whitespace-pre-wrap text-ink">
                  {state.last_error}
                </p>
              ) : (
                <p className="mt-1 text-sm text-ink-muted">Tidak ada galat tercatat.</p>
              )}
            </div>
            <p className="text-sm text-ink-muted">
              Sinkronisasi berjalan otomatis setiap menit dan setelah ada perubahan di aplikasi atau Google Sheet.
            </p>
          </div>
        )}
      </Panel>

      <Panel
        title={openCount > openRows.length ? `Belum ditinjau (${openRows.length} terbaru dari ${openCount})` : `Belum ditinjau (${openCount})`}
        padding="flush"
      >
        {openResult.error ? (
          <div className="px-4">
            <ErrorState
              title="Daftar konflik tidak bisa dimuat"
              cause="Server tidak menjawab."
              action={<ReloadButton />}
            />
          </div>
        ) : (
          <div className="border-t border-line">
            <ConflictTable
              caption="Konflik yang belum ditinjau"
              rows={openRows}
              mode="open"
              emptyTitle="Tidak ada konflik yang perlu ditinjau"
              emptyText="Konflik muncul jika isian yang sama diubah di aplikasi dan di Google Sheet sebelum sinkron."
            />
          </div>
        )}
      </Panel>

      <Panel
        title={resolvedCount > resolvedRows.length ? `Sudah ditinjau (${resolvedRows.length} terbaru dari ${resolvedCount})` : `Sudah ditinjau (${resolvedCount})`}
        padding="flush"
      >
        {resolvedResult.error ? (
          <div className="px-4">
            <ErrorState
              title="Riwayat konflik tidak bisa dimuat"
              cause="Server tidak menjawab."
              action={<ReloadButton />}
            />
          </div>
        ) : (
          <div className="border-t border-line">
            <ConflictTable
              caption="Konflik yang sudah ditinjau"
              rows={resolvedRows}
              mode="resolved"
              emptyTitle="Belum ada konflik yang ditandai selesai"
              emptyText="Setelah Anda menekan Tandai selesai, konflik pindah ke daftar ini."
            />
          </div>
        )}
      </Panel>
    </div>
  );
}
