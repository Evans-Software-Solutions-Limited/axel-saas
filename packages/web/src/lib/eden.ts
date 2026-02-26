import { treaty } from "@elysiajs/eden";
import { type CoreApi } from "@axel-saas/core";
import { supabase } from "@/lib/supabase";

export const api = {
  core: treaty<CoreApi>(import.meta.env.VITE_CORE_API_URL, {
    headers: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      console.log("session", session);
      if (!session?.access_token) return {};
      return { Authorization: `Bearer ${session.access_token}` };
    },
  }),
};
