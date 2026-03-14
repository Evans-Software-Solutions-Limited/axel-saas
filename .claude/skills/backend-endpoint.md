# Skill: Backend Endpoint

Use this when creating or modifying Elysia route handlers in microservices/core.

## Before You Start

1. Read the root CLAUDE.md → "Architecture" → "Elysia Routes"
2. Decide: is this public (no auth) or protected (requires JWT)?
3. Check if a repository exists for the domain (users, subscriptions, etc.)

## Endpoint Structure

```typescript
// protected endpoint example
export const myHandler = new Elysia({
  name: "MyHandler",
})
  .derive(async ({ headers }) => ({
    user: await getAuthUser(headers.authorization),
  }))
  .onBeforeHandle(requireAuth)
  .post(
    "/my-route",
    async (ctx) => {
      const { body } = ctx;
      const { sub: userId } = getUser(ctx);  // Extract from validated token

      // Call repository or service logic
      // Return typed response
      return { success: true, data: {...} };
    },
    {
      body: t.Object({ /* schema */ }),
      detail: {
        description: "...",
        tags: ["MyFeature"],
      },
    },
  );
```

## Checklist

- [ ] New handler module in `microservices/core/src/application/{domain}/`
- [ ] If data access needed: use or create repository (e.g., `{domain}Repository.ts`)
- [ ] Type guards: `t.Object({...})` for request body
- [ ] Auth: use `requireAuth` for protected routes; omit for public
- [ ] Error responses: 400/401/403/404/409/500 with message
- [ ] Mount handler in `api.ts` via `.use(myHandler)`
- [ ] Write tests: valid request, missing auth, invalid body schema
- [ ] Coverage ≥ 90% on repository logic (handler middleware may be excluded)

## After You're Done

1. `bun run typecheck` — no TS errors
2. `bun run test:unit` — handler tests + repository tests pass
3. Verify handler is mounted in `api.ts`
4. If it's a new domain, check if a local CLAUDE.md would help
