/**
 * ECR repository for the OpenClaw image.
 *
 * Per the spec (§4.2 "ECR repository"):
 *   - Image scanning enabled (catches CVEs at push time, free).
 *   - Lifecycle policy keeps the last 30 images so the repo doesn't
 *     grow unbounded as the version-watcher (PR #103) and per-commit
 *     image builds add a tag each.
 *
 * The repo name is the same across stages but lives in a per-stage
 * SST app instance — preprod and production each get their own
 * `openclaw` repo in their own account.
 */

export const repository = new aws.ecr.Repository("openclaw", {
  name: `openclaw-${$app.stage}`,
  imageScanningConfiguration: { scanOnPush: true },
  // Force-delete on `sst remove` for non-production stages — otherwise
  // teardown fails on any repo that ever held an image. Production
  // stages are `removal: "retain"` per sst.config.ts so this flag is
  // irrelevant there.
  forceDelete: $app.stage !== "production",
});

/**
 * Keep the latest 30 image tags. Anything older is GC'd. The version
 * watcher in `.github/workflows/openclaw-version-check.yml` adds a
 * new tag per OpenClaw release (~weekly upstream cadence), plus
 * per-commit tags from the deploy workflow — 30 tags is roughly two
 * months of headroom, enough to roll back through a quarter's worth
 * of bumps without manual cleanup.
 */
new aws.ecr.LifecyclePolicy("openclaw-retention", {
  repository: repository.name,
  policy: JSON.stringify({
    rules: [
      {
        rulePriority: 1,
        description: "Keep the most recent 30 images; expire older ones",
        selection: {
          tagStatus: "any",
          countType: "imageCountMoreThan",
          countNumber: 30,
        },
        action: { type: "expire" },
      },
    ],
  }),
});
