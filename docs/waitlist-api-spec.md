# Waitlist API Spec

## Overview

A lightweight waitlist for the Axel SaaS soft launch. Users join by submitting their email and the tier they're interested in. On join or update they receive a confirmation email. They can remove themselves via a token link included in every email.

---

## Data Model

| Field          | Type      | Notes                                           |
| -------------- | --------- | ----------------------------------------------- |
| `id`           | uuid      | Primary key                                     |
| `email`        | string    | Unique, lowercased on write                     |
| `interestedIn` | enum      | `free` \| `pro` \| `enterprise`                 |
| `token`        | string    | Opaque unsubscribe token (UUID, generated once) |
| `confirmedAt`  | timestamp | Set on first join                               |
| `updatedAt`    | timestamp | Updated on tier change                          |

---

## Endpoints

### `POST /waitlist`

Join the waitlist or update tier for an existing email.

**Request body**

```json
{
  "email": "user@example.com",
  "interestedIn": "pro"
}
```

`interestedIn` must be one of `free`, `pro`, `enterprise`. Both fields are required.

**Behaviour**

- If the email is new: create a record, set `confirmedAt`, send a **join confirmation email**.
- If the email already exists: update `interestedIn` and `updatedAt`, send an **update confirmation email**.

**Response `201 Created`** (new) or **`200 OK`** (existing)

```json
{
  "status": "joined" | "updated"
}
```

**Error responses**

| Code | Reason                                      |
| ---- | ------------------------------------------- |
| 400  | Missing/invalid field or bad `interestedIn` |
| 422  | Email format invalid                        |

---

### `DELETE /waitlist/unsubscribe?token=<token>`

Remove a subscriber using the token from their email.

**Behaviour**

- Look up the record by `token`.
- Delete it permanently.
- Optionally render a simple "You've been removed" confirmation page (for browser link clicks).

**Response `200 OK`**

```json
{
  "status": "removed"
}
```

**Error responses**

| Code | Reason          |
| ---- | --------------- |
| 404  | Token not found |

---

## Email Behaviour

### Join confirmation

Sent to `email` immediately after a new signup.

- **Subject:** `You're on the Axel waitlist`
- **Body:** Confirms the `interestedIn` tier, sets expectations for next steps, includes the unsubscribe link.

### Update confirmation

Sent when an existing subscriber changes their tier.

- **Subject:** `Your Axel waitlist preference has been updated`
- **Body:** States the new tier, includes the unsubscribe link.

### Unsubscribe link format

```
https://app.axel.so/waitlist/unsubscribe?token=<token>
```

Every outbound email must include this link in the footer.

---

## Notes

- No authentication required on any waitlist endpoint (public API).
- Rate-limit `POST /waitlist` per IP (e.g. 10 req/min) to prevent abuse.
- Token is generated once at creation and never rotated.
- Do not expose `token` in any response other than inside emails.
