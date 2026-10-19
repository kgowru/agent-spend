import { DMG_URL } from "@/lib/site";

/*
 * The download buttons land here, and we send the visitor straight on to the
 * disk image on GitHub. The hop exists only so the click gets counted: each one
 * is a function invocation of /download, which shows up in the project's
 * Observability tab. Custom events in Web Analytics would do the same job but
 * need a paid plan.
 *
 * It has to run on every request. A prerendered or cached redirect would be
 * served by the CDN without ever reaching the function, and the count would
 * stop moving.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return new Response(null, {
    status: 302,
    headers: {
      Location: DMG_URL,
      "Cache-Control": "no-store",
    },
  });
}
