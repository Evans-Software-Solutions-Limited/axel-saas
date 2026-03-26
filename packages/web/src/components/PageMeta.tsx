import { SITE_URL } from "@/lib/seo";

/**
 * Page-level SEO metadata for public marketing/legal routes.
 *
 * React 19 hoists <title>, <meta>, and <link> rendered inside components to
 * <head> automatically — no helmet library required. Google's crawler executes
 * JavaScript, so these tags are effective for the primary acquisition surfaces.
 *
 * Use noIndex=true for utility pages that should not appear in search results
 * (e.g. waitlist unsubscribe, token-bearing URLs).
 */
export function PageMeta({
  title,
  description,
  path,
  noIndex = false,
}: Readonly<{
  title: string;
  description: string;
  /** Path relative to site root, e.g. "/" or "/pricing" */
  path: string;
  noIndex?: boolean;
}>) {
  const canonical = `${SITE_URL}${path}`;
  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      {noIndex ? (
        <meta name="robots" content="noindex,nofollow" />
      ) : (
        <meta name="robots" content="index,follow" />
      )}
    </>
  );
}
