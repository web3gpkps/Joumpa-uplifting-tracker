import Image from "next/image";
import gapura from "@/public/brand/gapura-airport-services.png";
import { cx } from "@/components/ui/cx";

type LogoProps = {
  /** Height in px. DESIGN.md sizes: sidebar 28, phone top bar 24, printed report 32, login 40. */
  height: 24 | 28 | 32 | 40;
  /** Logos sit at the top of every screen, so they load eagerly by default. */
  eager?: boolean;
  className?: string;
};

/**
 * The official Gapura Airport Services logo (1052 × 569), never stretched, recoloured,
 * cropped or redrawn: drawn at a set height with its own aspect ratio, in a box that cannot
 * shrink. Server-component friendly.
 */
export function Logo({ height, eager = true, className }: LogoProps) {
  return (
    <Image
      src={gapura}
      alt="Gapura Airport Services"
      width={Math.round(height * (gapura.width / gapura.height))}
      height={height}
      loading={eager ? "eager" : "lazy"}
      className={cx("w-auto max-w-none shrink-0", className)}
      style={{ height, aspectRatio: `${gapura.width} / ${gapura.height}` }}
    />
  );
}
