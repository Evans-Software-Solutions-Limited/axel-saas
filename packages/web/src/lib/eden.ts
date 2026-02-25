import { treaty } from "@elysiajs/eden";
import { type CoreApi } from "@axel-saas/core";

export const api = {
  core: treaty<CoreApi>(import.meta.env.VITE_CORE_API_URL),
};
