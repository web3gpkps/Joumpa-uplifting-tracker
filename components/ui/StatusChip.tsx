import type {
  ActionFlag,
  ActionKind,
  ActionStatus,
  AssignmentStatus,
  BmiCategory,
  Consistency,
  CriteriaStatus,
  HeightRequirement,
  ReplacementPass,
  ReplacementTimeliness,
  ReportConclusion,
  Reported,
  Trend,
} from "@/lib/rules";
import { cx } from "./cx";

export type StatusTone = "good" | "warning" | "critical" | "progress" | "neutral";

/** Every status label lib/rules.ts can produce. */
export type RuleStatusLabel =
  | ReportConclusion
  | CriteriaStatus
  | Consistency
  | BmiCategory
  | HeightRequirement
  | ActionStatus
  | ActionKind
  | ActionFlag
  | ReplacementPass
  | ReplacementTimeliness
  | Reported
  | AssignmentStatus
  | Trend;

/*
 * THE tone map (DESIGN.md Tokens). `satisfies` makes it exhaustive: if lib/rules.ts adds or
 * renames a label, the build fails here until it gets a tone. "Lewat <tanggal>" (late
 * replacement) is matched by prefix below. Do not add tone tables anywhere else.
 */
const RULE_TONES = {
  // Report conclusion, criteria status, weekly status
  Sesuai: "good",
  "Sesuai dengan Catatan": "good",
  "Perlu Perbaikan": "warning",
  "Tidak Sesuai": "critical",
  // Consistency of the report conclusion with the criteria
  OK: "good",
  "Beda – verifikasi": "warning",
  // BMI category
  Kurus: "warning",
  Normal: "good",
  Overweight: "warning",
  Obesitas: "critical",
  // Height requirement
  Memenuhi: "good",
  "Tidak Memenuhi": "critical",
  "Isi standar di Parameter": "neutral",
  // Action item status and kind
  "Belum Mulai": "neutral",
  "On Progress": "progress",
  Selesai: "good",
  Tertunda: "neutral",
  Sekali: "neutral",
  Rutin: "progress",
  // Action item flag
  OVERDUE: "critical",
  "Jatuh tempo ≤ 7 hari": "warning",
  "Rutin – pantau": "progress",
  "On Track": "good",
  // Replacement result, timeliness, reported
  "Lulus – boleh bertugas": "good",
  "Belum lulus": "critical",
  "Belum training/dinilai": "neutral",
  "Tepat waktu": "good",
  Menunggu: "warning",
  Ya: "good",
  Belum: "warning",
  // Assignment status ("Aktif" stays quiet so exceptions stand out)
  Aktif: "neutral",
  "Coaching 30 Hari": "progress",
  Diganti: "neutral",
  Ditarik: "critical",
  // Trend
  "▲ Naik": "good",
  "▼ Turun": "warning",
  "= Tetap": "neutral",
} satisfies Record<Exclude<RuleStatusLabel, `Lewat ${string}`>, StatusTone>;

/** Labels the screens show that lib/rules does not type as a status. */
const SCREEN_TONES: Record<string, StatusTone> = {
  "NIPP ganda": "warning",
  ganda: "warning",
};

const TONE_BY_LABEL = new Map<string, StatusTone>(
  Object.entries({ ...SCREEN_TONES, ...RULE_TONES }).map(([label, tone]) => [normalise(label), tone]),
);

function normalise(label: string): string {
  return label.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Tone for a status label. Unknown labels are "neutral". */
export function toneForStatus(label: string | null | undefined): StatusTone {
  if (!label) return "neutral";
  const key = normalise(label);
  if (key.startsWith("lewat ")) return "critical";
  return TONE_BY_LABEL.get(key) ?? "neutral";
}

/*
 * Only exceptions draw the eye: critical / warning / progress get a 4px tinted fill,
 * good and neutral are plain text in their tone colour.
 */
const toneClasses: Record<StatusTone, string> = {
  good: "text-good", // 5.69:1
  neutral: "text-ink-muted", // 6.85:1
  warning: "rounded-status bg-warning-tint px-1.5 text-warning", // 6.07:1
  critical: "rounded-status bg-critical-tint px-1.5 text-critical", // 6.28:1
  progress: "rounded-status bg-progress-tint px-1.5 text-progress", // 6.32:1
};

type StatusChipProps = {
  /** The status text from lib/rules (or the DB), shown as-is. Status is never colour alone. */
  label: string | null | undefined;
  /**
   * Override the looked-up tone. Avoid: add the label to RULE_TONES instead. Kept for
   * labels whose tone depends on context (e.g. a link that is active vs. revoked).
   */
  tone?: StatusTone;
  /** Text shown when label is empty (neutral). */
  emptyLabel?: string;
  className?: string;
};

/** Status label in its tone (DESIGN.md Tokens). Server-component friendly. */
export function StatusChip({ label, tone, emptyLabel = "Belum ada data", className }: StatusChipProps) {
  const hasLabel = Boolean(label && label.trim() !== "");
  const resolved = tone ?? (hasLabel ? toneForStatus(label) : "neutral");
  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center py-0.5 text-xs font-semibold whitespace-nowrap",
        toneClasses[resolved],
        className,
      )}
    >
      {hasLabel ? label : emptyLabel}
    </span>
  );
}
