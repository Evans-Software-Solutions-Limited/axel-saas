import { CORE_API_URL } from "@/lib/eden";

export type WaitlistInterestedIn = "free" | "pro" | "enterprise";

export type JoinWaitlistResult =
  | { ok: true; status: "joined" | "updated" }
  | { ok: false; error: string; status: number };

export async function joinWaitlist(body: {
  email: string;
  interestedIn: WaitlistInterestedIn;
}): Promise<JoinWaitlistResult> {
  const res = await fetch(`${CORE_API_URL}/waitlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let data: { status?: string; error?: string } = {};
  try {
    data = (await res.json()) as { status?: string; error?: string };
  } catch {
    /* non-JSON */
  }

  if (res.ok && (data.status === "joined" || data.status === "updated")) {
    return { ok: true, status: data.status };
  }

  const errorText =
    typeof data.error === "string" && data.error.length > 0
      ? data.error
      : res.status === 429
        ? "Too many requests. Try again in a minute."
        : "Something went wrong. Please try again.";

  return { ok: false, error: errorText, status: res.status };
}

export type UnsubscribeWaitlistResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

export async function unsubscribeWaitlist(
  token: string,
): Promise<UnsubscribeWaitlistResult> {
  const params = new URLSearchParams({ token });
  const res = await fetch(
    `${CORE_API_URL}/waitlist/unsubscribe?${params.toString()}`,
    { method: "DELETE" },
  );

  if (res.ok) {
    return { ok: true };
  }

  let data: { error?: string } = {};
  try {
    data = (await res.json()) as { error?: string };
  } catch {
    /* empty */
  }

  return {
    ok: false,
    error:
      typeof data.error === "string" && data.error.length > 0
        ? data.error
        : "Could not complete unsubscribe.",
    status: res.status,
  };
}
