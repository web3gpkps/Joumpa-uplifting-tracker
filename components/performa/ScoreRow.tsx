"use client";

import { useId, useState, type FormEvent } from "react";
import { deltaVsBaseline, practiceAvg, weeklyStatus, type Settings } from "@/lib/rules";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { SaveStatus, type SaveState } from "@/components/ui/SaveStatus";
import { StatusChip } from "@/components/ui/StatusChip";
import { cx } from "@/components/ui/cx";
import type { WeeklyScoreInput, WeeklyScoreResult } from "@/components/performa/actions";
import { formatScore, formatSignedScore } from "@/lib/format";
import { ASPECTS, parseScore } from "./format";

export type SavedScore = {
  scores: Array<number | null>;
  observer: string | null;
  coachingNotes: string | null;
};

export type EntryStaff = {
  code: string;
  name: string;
  assignmentStatus: string;
  /** Training baseline average, for the difference line. */
  baselineAvg: number | null;
  /** This week's saved row, or null. */
  saved: SavedScore | null;
  /** "Diubah lewat tautan ini, 8 Okt 14.05" for the saved row. */
  changedLabel: string | null;
};

export type SaveScoreAction = (accessKey: string, input: WeeklyScoreInput) => Promise<WeeklyScoreResult>;

type Draft = { scores: string[]; observer: string; notes: string };

const VALUES = ["1", "2", "3", "4", "5"] as const;

/** Fields inside "Lainnya": a server error on one of them opens it. */
const MORE_FIELDS = new Set(["observer", "coaching_notes"]);

function draftFrom(saved: SavedScore | null): Draft {
  return {
    scores: ASPECTS.map((_, i) => (saved?.scores[i] == null ? "" : String(saved.scores[i]))),
    observer: saved?.observer ?? "",
    notes: saved?.coachingNotes ?? "",
  };
}

function normalise(d: Draft): Draft {
  return { scores: d.scores.map((s) => s.trim()), observer: d.observer.trim(), notes: d.notes.trim() };
}

function sameDraft(a: Draft, b: Draft): boolean {
  const x = normalise(a);
  const y = normalise(b);
  return x.observer === y.observer && x.notes === y.notes && x.scores.every((s, i) => s === y.scores[i]);
}

function isEmpty(d: Draft): boolean {
  const n = normalise(d);
  return n.observer === "" && n.notes === "" && n.scores.every((s) => s === "");
}

/** True when the saved row has an average (the person counts as "dinilai"). */
export function isScored(saved: SavedScore | null): boolean {
  return saved !== null && practiceAvg(saved.scores) !== null;
}

type ScoreRowProps = {
  accessKey: string;
  week: number;
  settings: Settings;
  staff: EntryStaff;
  /** Observer name filled into an empty Observer field when scoring starts. */
  defaultObserver: string;
  saveAction: SaveScoreAction;
  /** After a successful save: move to the next card without a score. */
  onSaved: (code: string) => void;
};

/**
 * One person's card on phones: A to F as 1 to 5 buttons (tap the chosen one again to clear
 * it), live Rata-rata and Status, "Simpan & berikutnya". Observer and Catatan coaching sit
 * behind "Lainnya". Clearing every field of a saved card deletes it after a confirmation.
 * Typed input survives a failed save.
 */
export function ScoreRow({ accessKey, week, settings, staff, defaultObserver, saveAction, onSaved }: ScoreRowProps) {
  const id = useId();
  const nameId = `${id}-name`;
  const messageId = `${id}-message`;

  const [draft, setDraft] = useState<Draft>(() => draftFrom(staff.saved));
  const [prevSaved, setPrevSaved] = useState<SavedScore | null>(staff.saved);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const [serverField, setServerField] = useState<{ field: string; message: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // New server data after refresh(): adopt it unless the person is still editing this card.
  if (prevSaved !== staff.saved) {
    setPrevSaved(staff.saved);
    if (sameDraft(draft, draftFrom(prevSaved))) setDraft(draftFrom(staff.saved));
  }

  const dirty = !sameDraft(draft, draftFrom(staff.saved));
  const saving = saveState.status === "saving";
  const willDelete = dirty && staff.saved !== null && isEmpty(draft);

  const parsed = draft.scores.map(parseScore);
  const valid = parsed.map((p) => (p === "invalid" ? null : p));
  const avg = practiceAvg(valid);
  const status = weeklyStatus(avg, settings);
  const delta = deltaVsBaseline(avg, staff.baselineAvg);
  const message = serverField?.message ?? null;

  function edit(next: Draft) {
    setDraft(next);
    if (saveState.status === "saved" || saveState.status === "error" || saveState.status === "deleted") {
      setSaveState({ status: "idle" });
    }
    if (serverField) setServerField(null);
  }

  function setScore(index: number, value: string) {
    const startedScoring = draft.scores.every((s) => s.trim() === "") && value !== "";
    edit({
      ...draft,
      scores: draft.scores.map((s, i) => (i === index ? value : s)),
      observer:
        startedScoring && draft.observer.trim() === "" && defaultObserver.trim() !== ""
          ? defaultObserver.trim()
          : draft.observer,
    });
  }

  async function persist(toSave: Draft) {
    const n = normalise(toSave);
    setSaveState({ status: "saving" });
    try {
      const result = await saveAction(accessKey, {
        staffCode: staff.code,
        week,
        scores: n.scores.map(parseScore).map((p) => (p === "invalid" ? null : p)),
        observer: n.observer,
        coachingNotes: n.notes,
      });
      if (!result.ok) {
        setSaveState({ status: "error", message: result.error.message });
        if (result.error.field) {
          setServerField({ field: result.error.field, message: result.error.message });
          if (MORE_FIELDS.has(result.error.field)) setMoreOpen(true);
        }
        return;
      }
      setDraft((current) => (current === toSave ? n : current));
      setSaveState({ status: result.deleted ? "deleted" : "saved", at: result.savedAt });
      if (!result.deleted) onSaved(staff.code);
    } catch {
      setSaveState({ status: "error", message: "koneksi terputus. Isian masih ada; simpan lagi." });
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty || saving) return;
    if (willDelete) {
      setConfirmOpen(true);
      return;
    }
    void persist(draft);
  }

  const notActive = staff.assignmentStatus && staff.assignmentStatus !== "Aktif";
  const fieldInvalid = (field: string) => serverField?.field === field || undefined;

  return (
    <li
      data-entry-card=""
      data-code={staff.code}
      data-scored={isScored(staff.saved) ? "true" : "false"}
      className="scroll-mt-20 border-b border-line px-4 py-4 last:border-b-0"
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4" aria-labelledby={nameId}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p id={nameId} className="text-base font-semibold text-ink">
              {staff.name}
            </p>
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
              <span className="tabular-nums">{staff.code}</span>
              {notActive ? <StatusChip label={staff.assignmentStatus} /> : null}
            </p>
          </div>
          <p className="flex shrink-0 flex-col items-end text-right" aria-live="polite">
            <span className="text-base font-semibold text-ink tabular-nums">
              <span className="sr-only">Rata-rata </span>
              {avg !== null ? formatScore(avg) : "–"}
            </span>
            <StatusChip label={status} emptyLabel="Belum dinilai" />
          </p>
        </div>

        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {ASPECTS.map((aspect, i) => (
            <fieldset key={aspect.key} className="min-w-0">
              <legend className="mb-1 text-sm font-semibold text-ink">
                {aspect.letter} {aspect.name}
              </legend>
              <div className="flex gap-1">
                {VALUES.map((value, v) => {
                  const checked = draft.scores[i] === value;
                  return (
                    <label key={value} className="relative min-w-0 flex-1">
                      <input
                        type="radio"
                        name={`${id}-${aspect.key}`}
                        value={value}
                        checked={checked}
                        data-score-input={i === 0 && v === 0 ? "" : undefined}
                        onChange={() => setScore(i, value)}
                        // Tapping the chosen value again clears the aspect (radios cannot do that natively).
                        onClick={() => {
                          if (checked) setScore(i, "");
                        }}
                        aria-describedby={fieldInvalid(aspect.field) && message ? messageId : undefined}
                        className="peer absolute inset-0 size-full cursor-pointer opacity-0"
                      />
                      <span
                        aria-hidden="true"
                        className={cx(
                          "flex min-h-11 items-center justify-center rounded-control border text-base font-semibold tabular-nums",
                          "transition-colors duration-120 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand",
                          checked
                            ? "border-brand bg-brand text-white"
                            : "border-line-strong bg-surface text-ink peer-hover:bg-bg",
                        )}
                      >
                        {value}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>

        <details open={moreOpen} onToggle={(e) => setMoreOpen(e.currentTarget.open)}>
          <summary
            className={cx(
              buttonClasses({ variant: "ghost", size: "sm" }),
              "-ml-3 w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden",
            )}
          >
            {moreOpen ? "Tutup lainnya" : "Lainnya"}
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            <Field label="Observer">
              <Input
                value={draft.observer}
                onChange={(e) => edit({ ...draft, observer: e.target.value })}
                maxLength={200}
                autoComplete="off"
                aria-invalid={fieldInvalid("observer")}
              />
            </Field>
            <Field label="Catatan coaching">
              <Textarea
                value={draft.notes}
                onChange={(e) => edit({ ...draft, notes: e.target.value })}
                maxLength={4000}
                rows={2}
                aria-invalid={fieldInvalid("coaching_notes")}
              />
            </Field>
            {delta !== null || staff.changedLabel ? (
              <p className="text-xs text-ink-muted tabular-nums">
                {delta !== null ? `Δ baseline ${formatSignedScore(delta)}` : null}
                {delta !== null && staff.changedLabel ? " · " : null}
                {staff.changedLabel}
              </p>
            ) : null}
            {!isEmpty(draft) ? (
              <button
                type="button"
                onClick={() => edit({ scores: ASPECTS.map(() => ""), observer: "", notes: "" })}
                className="-ml-3 inline-flex min-h-11 w-fit items-center rounded-control px-3 text-sm font-semibold text-critical transition-colors duration-120 hover:bg-critical-tint lg:min-h-8"
              >
                Kosongkan isian
              </button>
            ) : null}
          </div>
        </details>

        {message ? (
          <p id={messageId} className="text-sm font-semibold text-critical">
            {message}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button
            type="submit"
            variant={willDelete ? "danger" : "primary"}
            disabled={!dirty}
            loading={saving}
            loadingText="Menyimpan…"
          >
            {willDelete ? "Hapus nilai" : "Simpan & berikutnya"}
          </Button>
          {dirty && !saving && saveState.status !== "error" ? (
            <span className="text-xs font-semibold text-warning">Belum disimpan</span>
          ) : null}
          <SaveStatus state={saveState} />
        </div>
      </form>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={`Hapus nilai Minggu ke-${week} untuk ${staff.name}?`}
        description="Nilai minggu lain tidak berubah."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Batal
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmOpen(false);
                void persist(draft);
              }}
            >
              Hapus nilai
            </Button>
          </>
        }
      />
    </li>
  );
}
