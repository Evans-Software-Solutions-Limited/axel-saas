/**
 * Waitlist email notifications. Thin wrappers over the shared emailService so
 * the waitlist handler can stay focused on validation + persistence.
 *
 * Fire-and-forget: failures never throw. The handler should still `void` these
 * calls to make intent explicit.
 */

import { sendEmail } from "../email/emailService";

const APP_URL = process.env.APP_URL ?? "https://app.meetaxel.ai";

function unsubscribeLink(token: string): string {
  return `${APP_URL}/waitlist/unsubscribe?token=${token}`;
}

export async function sendJoinConfirmation(
  email: string,
  interestedIn: string,
  token: string,
): Promise<void> {
  await sendEmail({
    template: "waitlist-joined",
    to: email,
    data: {
      interestedIn,
      unsubscribeLink: unsubscribeLink(token),
    },
  });
}

export async function sendUpdateConfirmation(
  email: string,
  interestedIn: string,
  token: string,
): Promise<void> {
  await sendEmail({
    template: "waitlist-updated",
    to: email,
    data: {
      interestedIn,
      unsubscribeLink: unsubscribeLink(token),
    },
  });
}
