/**
 * DNS + ACM wildcard cert for OpenClaw per-session subdomains.
 *
 * Per spec §9.1:
 *
 *   | Stage      | OpenClaw zone (parent) | Wildcard               |
 *   |------------|------------------------|------------------------|
 *   | production | meetaxel.ai            | *.openclaw.meetaxel.ai |
 *   | staging    | staging.meetaxel.ai    | *.openclaw.staging…    |
 *   | dev        | none                   | none — ALB direct      |
 *
 * What this module produces (deployed stages only):
 *
 *   - **ACM wildcard certificate** for `*.openclaw.<zone>` in
 *     eu-west-2, DNS-validated against the existing per-stage
 *     hosted zone.
 *   - **`CertificateValidation`** that blocks the resource graph
 *     until ACM confirms the cert is `ISSUED`. Without this, the
 *     listener in `alb.ts` would attach a not-yet-valid cert and
 *     the deploy would race ACM (5-10 min typical for DNS
 *     validation), often surfacing as a confusing "listener
 *     created but TLS handshakes failing" state for a few
 *     minutes after `sst deploy` returned.
 *
 * The wildcard ALIAS record (`*.openclaw.<zone>` → ALB) lives in
 * `alb.ts` because it needs both the hosted-zone exports here
 * AND the load balancer object — keeping it in `alb.ts` avoids a
 * dns→alb→dns circular import.
 *
 * Dev stages (anything not `staging` or `production`) get NULL
 * exports — `alb.ts` falls back to an HTTP-80 fixed-response
 * listener for those, matching the spec's "ALB DNS direct"
 * dev posture.
 *
 * Zone IDs are discovered by NAME via `aws.route53.getZone`, not
 * hard-coded. The two zones (`meetaxel.ai`, `staging.meetaxel.ai`)
 * already exist — the root `axel-saas` SST app provisioned them.
 * Name-based discovery avoids drift with the IDs in
 * `packages/api-utils/src/domains/domain-config.ts` (the core API's
 * own zone-ID lookup), without coupling the two apps.
 */

/**
 * Map the SST stage to the parent zone name + the wildcard FQDN to
 * issue the cert for. Returns `null` for any unrecognised stage
 * (dev, PR previews, etc.) — those go through the no-DNS path.
 *
 * Mirrors `packages/api-utils/src/domains/domain-config.ts` but
 * inlined here so this SST app stays independent of the root
 * monorepo workspaces (the spec is firm about no cross-app
 * coupling).
 */
function resolveZoneConfig(
  stage: string,
): { zoneName: string; wildcardName: string } | null {
  if (stage === "production") {
    return {
      zoneName: "meetaxel.ai",
      wildcardName: "*.openclaw.meetaxel.ai",
    };
  }
  if (stage === "staging") {
    return {
      zoneName: "staging.meetaxel.ai",
      wildcardName: "*.openclaw.staging.meetaxel.ai",
    };
  }
  return null;
}

const zoneConfig = resolveZoneConfig($app.stage);

/** The wildcard FQDN the cert + ALIAS record live under (e.g.
 * `*.openclaw.staging.meetaxel.ai`). `null` on dev. Exported so
 * `alb.ts` can build the ALIAS record without re-deriving it. */
export const wildcardName: string | null = zoneConfig?.wildcardName ?? null;

/**
 * Look up the existing hosted zone by name. Resolved at deploy time
 * via `aws.route53.getZone({ name: ... })` — the zone has to exist
 * in the target AWS account or the deploy fails fast with a clear
 * "no matching HostedZones found" error.
 *
 * Trailing dot is added in the lookup arg because Route53's API
 * stores zone names with a trailing dot internally; without it,
 * some AWS SDK versions ambiguously match nothing. Defensive.
 */
const hostedZone = zoneConfig
  ? await aws.route53.getZone({ name: `${zoneConfig.zoneName}.` })
  : null;

/**
 * Hosted-zone ID for the cross-stack contract. `null` on dev
 * stages so `ssm.ts` can skip writing the parameter — the core
 * API doesn't need it then because Phase 5's session-create
 * endpoint is also disabled on dev (no DNS to attach the session
 * subdomain to).
 *
 * Also re-exported as a plain string for `alb.ts` to consume when
 * building the wildcard ALIAS record.
 */
export const zoneId: string | null = hostedZone?.zoneId ?? null;

/**
 * ACM wildcard certificate. Created in eu-west-2 to match the ALB
 * (ACM certs for ALBs MUST live in the same region as the LB;
 * us-east-1 certs are only useful for CloudFront).
 *
 * `subjectAlternativeNames` is empty — we don't need the apex
 * `openclaw.<zone>` to terminate TLS, just the wildcard. If a
 * future use case needs apex termination, add it here and ACM
 * will re-issue the cert.
 */
const certificate = zoneConfig
  ? new aws.acm.Certificate("openclaw-wildcard-cert", {
      domainName: zoneConfig.wildcardName,
      validationMethod: "DNS",
    })
  : null;

/**
 * DNS-validation records. ACM emits one CNAME per name in the
 * cert (just one here, since SANs is empty). The CNAME proves to
 * ACM that we control the zone. Wrapped in `$util.output` so the
 * record resource can pull the validation options out of the
 * cert's `domainValidationOptions` array once ACM has issued
 * them.
 *
 * Re-deploys are idempotent: ACM emits the same CNAME name +
 * value for the same domain.
 */
const validationRecord =
  certificate && hostedZone
    ? new aws.route53.Record("openclaw-cert-validation", {
        zoneId: hostedZone.zoneId,
        name: certificate.domainValidationOptions[0]!.resourceRecordName,
        type: certificate.domainValidationOptions[0]!
          .resourceRecordType as $util.Input<string>,
        records: [certificate.domainValidationOptions[0]!.resourceRecordValue],
        ttl: 60,
        allowOverwrite: true,
      })
    : null;

/**
 * Block the resource graph until ACM finishes validating the cert.
 * The listener in `alb.ts` depends on `certificateArn` below; that
 * dependency forces the listener to wait on this validation, which
 * in turn waits on the CNAME above. End result: `sst deploy` only
 * returns after TLS handshakes work.
 */
const certificateValidation =
  certificate && validationRecord
    ? new aws.acm.CertificateValidation("openclaw-cert-validation-wait", {
        certificateArn: certificate.arn,
        validationRecordFqdns: [validationRecord.fqdn],
      })
    : null;

/**
 * The ARN that the ALB listener attaches. `null` on dev stages,
 * causing `alb.ts` to keep its HTTP-80 listener for local testing.
 *
 * We export the validation resource's `certificateArn` rather than
 * the cert's own `arn` directly so the downstream listener implicitly
 * waits on validation. (Same ARN value either way; the difference
 * is the Pulumi dependency graph.)
 */
export const certificateArn: $util.Output<string> | null =
  certificateValidation?.certificateArn ?? null;
