"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { saveBmiProfile } from "@/components/bmi/actions";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Select, Textarea } from "@/components/ui/Field";
import { SaveStatus, type SaveState } from "@/components/ui/SaveStatus";
import { StatusChip } from "@/components/ui/StatusChip";
import { formatTanggalPendek } from "@/lib/dates";
import { formatDecimal, formatSignedKg } from "@/lib/format";
import type { BmiSummary } from "@/lib/rules";

export type BmiPerson = {
  code: string;
  name: string;
  station: string | null;
  gender: string | null;
  /** "Catatan program BMI" (staff.bmi_note). */
  bmiNote: string | null;
  assignmentStatus: string | null;
  summary: BmiSummary;
};

type BmiPersonSheetProps = {
  /** Controlled. Remount (key) on every opening so the form starts from the stored values. */
  open: boolean;
  onClose: () => void;
  accessKey: string;
  person: BmiPerson;
  plannedDates: string[];
  /** The period chosen on the page, marked in the history. */
  period: number;
};

/** Open state for a sheet: `n` changes on every opening, use it as the sheet's key. */
export type SheetState = { open: boolean; n: number };

export const CLOSED_SHEET: SheetState = { open: false, n: 0 };
export const openSheet = (s: SheetState): SheetState => ({ open: true, n: s.n + 1 });
export const closeSheet = (s: SheetState): SheetState => ({ ...s, open: false });

const CONNECTION_LOST = "Koneksi ke server terputus. Isian masih ada; simpan lagi.";

function requirementText(summary: BmiSummary, gender: string | null) {
  const r = summary.heightRequirement;
  if (r === "Memenuhi" || r === "Tidak Memenuhi") return <StatusChip label={r} />;
  if (summary.latestHeight === null) return "–";
  if (gender !== "L" && gender !== "P") return "Isi L/P dulu";
  return "Standar tinggi belum diatur";
}

/**
 * One person's BMI profile and history in a sheet (full screen on a phone): L/P and the
 * BMI programme note (share_save_profile, both sent), then every period so far. Render it
 * outside forms and grids: a grid would otherwise take the keys and paste typed here.
 */
export function BmiPersonSheet({ open, onClose, accessKey, person, plannedDates, period }: BmiPersonSheetProps) {
  const formId = useId();
  const savedGender = person.gender === "L" || person.gender === "P" ? person.gender : "";
  const savedNote = person.bmiNote ?? "";
  const [gender, setGender] = useState(savedGender);
  const [note, setNote] = useState(savedNote);
  const [save, setSave] = useState<SaveState>({ status: "idle" });
  const [pending, startTransition] = useTransition();
  const dirty = gender !== savedGender || note.trim() !== savedNote.trim();

  function touched() {
    if (save.status !== "saving") setSave({ status: "idle" });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setSave({ status: "saving" });
    startTransition(async () => {
      try {
        const result = await saveBmiProfile(accessKey, {
          staffCode: person.code,
          gender: gender === "L" || gender === "P" ? gender : null,
          bmiNote: note.trim() === "" ? null : note,
        });
        setSave(
          result.ok ? { status: "saved", at: result.savedAt } : { status: "error", message: result.error.message },
        );
      } catch {
        setSave({ status: "error", message: CONNECTION_LOST });
      }
    });
  }

  const { summary } = person;
  const weighings = summary.periods.filter((p) => p?.weightKg !== null && p?.weightKg !== undefined).length;
  const meta = [person.code, person.station].filter(Boolean).join(" · ");

  return (
    <Dialog
      open={open}
      onClose={() => !pending && onClose()}
      dismissible={!pending}
      size="md"
      title={person.name}
      description={<span className="tabular">{meta}</span>}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Tutup
          </Button>
          <Button type="submit" form={formId} loading={pending} loadingText="Menyimpan…" disabled={!dirty && !pending}>
            Simpan profil
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <form id={formId} onSubmit={onSubmit} aria-label={`Profil BMI ${person.name}`} className="flex flex-col gap-3">
          <Field label="L/P" help="Dipakai untuk syarat tinggi.">
            <Select
              value={gender}
              onChange={(e) => {
                setGender(e.target.value);
                touched();
              }}
              className="max-w-40"
            >
              <option value="">Belum diisi</option>
              <option value="L">L</option>
              <option value="P">P</option>
            </Select>
          </Field>
          <Field label="Catatan program BMI">
            <Textarea
              value={note}
              maxLength={2000}
              onChange={(e) => {
                setNote(e.target.value);
                touched();
              }}
            />
          </Field>
          <SaveStatus state={save} />
        </form>

        <dl className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
          <dt className="text-ink-muted">Syarat tinggi</dt>
          <dd className="text-ink">{requirementText(summary, person.gender)}</dd>
          <dt className="text-ink-muted">Δ berat</dt>
          <dd className="text-ink tabular">
            {summary.weightDelta !== null && weighings >= 2 ? `${formatSignedKg(summary.weightDelta)} kg` : "–"}
          </dd>
          {person.assignmentStatus && person.assignmentStatus !== "Aktif" ? (
            <>
              <dt className="text-ink-muted">Penugasan</dt>
              <dd>
                <StatusChip label={person.assignmentStatus} />
              </dd>
            </>
          ) : null}
        </dl>

        <section aria-labelledby={`${formId}-riwayat`} className="flex flex-col gap-1">
          <h3 id={`${formId}-riwayat`} className="text-sm font-semibold text-ink">
            Riwayat cek
          </h3>
          <ol className="flex flex-col divide-y divide-line">
            {plannedDates.map((planned, i) => {
              const value = summary.periods[i] ?? null;
              const selected = i + 1 === period;
              return (
                <li
                  key={planned}
                  className="grid grid-cols-[4.5rem_3.5rem_minmax(0,1fr)] items-center gap-x-3 py-2 text-sm"
                >
                  <span className={selected ? "font-semibold text-ink" : "text-ink"}>
                    Periode {i + 1}
                    {selected ? <span className="sr-only"> (dipilih)</span> : null}
                  </span>
                  <span className="text-ink-muted tabular">{formatTanggalPendek(value?.checkDate ?? planned)}</span>
                  {value && value.heightCm !== null && value.weightKg !== null ? (
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 tabular">
                      <span>
                        {formatDecimal(value.heightCm, 1)} cm · {formatDecimal(value.weightKg, 1)} kg
                        {value.bmi !== null ? ` · BMI ${formatDecimal(value.bmi, 1)}` : ""}
                      </span>
                      {value.category ? <StatusChip label={value.category} /> : null}
                    </span>
                  ) : (
                    <span className="text-ink-muted">Belum dicek</span>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </Dialog>
  );
}
