import { coreAPI } from "./api";
import { hostedZoneId, webHost } from "./domains";

const region = aws.getRegionOutput().name;

export const frontend = new sst.aws.StaticSite("web", {
  path: "packages/web",
  build: {
    output: "dist",
    command: "bun run build",
  },
  domain:
    hostedZoneId != null
      ? {
          name: webHost,
          dns: sst.aws.dns({ zone: hostedZoneId }),
        }
      : undefined,
  environment: {
    VITE_REGION: region,
    VITE_CORE_API_URL: coreAPI.url,
    VITE_SUPABASE_URL: process.env.SUPABASE_URL || "",
    VITE_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",
  },
});
