/**
 * Waitlist email notifications.
 *
 * Currently a logging stub. Wire to a real provider (Resend, SES, etc.) by
 * setting EMAIL_PROVIDER and implementing the send function below.
 */

const APP_URL = process.env.APP_URL ?? "https://app.axel.so";

function unsubscribeLink(token: string): string {
  return `${APP_URL}/waitlist/unsubscribe?token=${token}`;
}

export async function sendJoinConfirmation(
  email: string,
  interestedIn: string,
  token: string,
): Promise<void> {
  const link = unsubscribeLink(token);
  // TODO: replace with real email provider call
  console.info("[waitlist] join confirmation", { email, interestedIn, link });
}

export async function sendUpdateConfirmation(
  email: string,
  interestedIn: string,
  token: string,
): Promise<void> {
  const link = unsubscribeLink(token);
  // TODO: replace with real email provider call
  console.info("[waitlist] update confirmation", { email, interestedIn, link });
}
