import { Suspense } from "react";
import type { Metadata } from "next";
import { APP_NAME } from "@/lib/app-info";
import { LinkScreenRoute } from "@/components/shell/ScreenRoute";
import { RingkasanLoading, RingkasanScreen } from "@/components/ringkasan/RingkasanScreen";
import { redirect } from "next/navigation";
import { hrefs, type ScreenProps } from "@/lib/workspace";
import { isStationBmiShare } from "@/components/shell/cgk-bmi";

/** A station link has the Cek BMI menu only: its home is Cek BMI. KPS links keep Beranda. */
function ShareHome(props: ScreenProps) {
  if (isStationBmiShare(props.access, props.ws)) redirect(hrefs(props.access).bmi);
  return <RingkasanScreen {...props} />;
}

// The layout's title template only reaches child segments, not this index page.
export const metadata: Metadata = { title: { absolute: `Beranda | ${APP_NAME}` } };

// Sits in the same segment as the token gate, which must reach the database on every request.
export const instant = false;

/** Dashboard, station link (scope from the token). The screen is shared with /admin. */
export default function Page({ params, searchParams }: PageProps<"/s/[token]">) {
  return (
    <Suspense fallback={<RingkasanLoading />}>
      <LinkScreenRoute params={params} searchParams={searchParams} screen={ShareHome} bmiOnlyOk />
    </Suspense>
  );
}
