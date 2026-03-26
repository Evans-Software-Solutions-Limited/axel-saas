/** Canonical base URL for the public site. Override via VITE_SITE_URL at build time. */
export const SITE_URL: string =
  (import.meta.env.VITE_SITE_URL as string | undefined) ??
  "https://meetaxel.ai";
