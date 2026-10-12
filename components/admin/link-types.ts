/** Share-link scopes and the shapes the Tautan Akses screen passes around. */

export const KPS_SCOPE = "KPS";

/** Same order as the dialog's Lingkup select: KPS first, then the stations. */
export const LINK_SCOPES = ["KPS", "SUB", "DPS", "CGK", "HLP", "KNO"] as const;
export type LinkScope = (typeof LINK_SCOPES)[number];

export function isLinkScope(value: string): value is LinkScope {
  return (LINK_SCOPES as readonly string[]).includes(value);
}

/** What a scope opens, as short field help. CGK and HLP share the CGK & HLP report. */
export function scopeDescription(scope: string): string {
  if (scope === KPS_SCOPE) return "Semua stasiun, termasuk Catatan KPS";
  if (scope === "CGK" || scope === "HLP") return `Data stasiun ${scope}, tindak lanjut laporan CGK & HLP`;
  return `Data stasiun ${scope} saja`;
}

export function scopeName(scope: string): string {
  return scope === KPS_SCOPE ? "KPS" : `Stasiun ${scope}`;
}

export type LinkRow = {
  id: string;
  scope: string;
  label: string | null;
  createdAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  /** Full URL for active links (the owner can copy it again); null once revoked. */
  url: string | null;
  /** Labels starting with "QA test" mark temporary links made for testing. */
  isQa: boolean;
};

export type NewLink = { scope: string; label: string | null; url: string };

export type LinkActionResult =
  | { ok: true; link?: NewLink; message: string }
  | { ok: false; message: string; fieldErrors?: { scope?: string; label?: string } };
