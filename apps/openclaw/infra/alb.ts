/**
 * Application Load Balancer for per-session OpenClaw subdomain routing.
 *
 * Listener configuration depends on whether the stage has a hosted
 * zone (`dns.ts` exposes `null` for dev stages):
 *
 *   - **staging + production** — HTTPS-443 listener with the
 *     wildcard ACM cert attached. Default action is `fixed-response`
 *     404 — the per-session listener rules added by Phase 5 take
 *     precedence based on the `Host` header.
 *   - **dev / preview stages** — HTTP-80 listener with the same 404
 *     default. No cert, no DNS, accessed via the ALB DNS name
 *     directly per spec §9.1.
 *
 * The wildcard ALIAS record (`*.openclaw.<zone>` → this ALB) lives
 * in this module rather than `dns.ts` because it needs the ALB's
 * own `dnsName` + `zoneId` — having it here keeps the dependency
 * graph straight (`dns.ts` exports things `alb.ts` consumes; no
 * back-import needed).
 *
 * Phase 5's per-session listener rules (host-header → target group)
 * are added at session start time by the core API via the AWS SDK,
 * not in this module. The default action stays as 404 forever —
 * unknown subdomains shouldn't reach a working OpenClaw.
 */

import { defaultSubnets } from "./cluster";
import { certificateArn, wildcardName, zoneId } from "./dns";
import { albSecurityGroup } from "./iam";

export const loadBalancer = new aws.lb.LoadBalancer("openclaw-alb", {
  name: `openclaw-${$app.stage}`,
  loadBalancerType: "application",
  internal: false,
  securityGroups: [albSecurityGroup.id],
  subnets: defaultSubnets.ids,
  // Drop existing connections faster on `sst remove` so teardown
  // doesn't stall for 5 minutes per spec exit-criterion ("sst remove
  // tears everything down cleanly").
  idleTimeout: 60,
  enableDeletionProtection: $app.stage === "production",
  // Access logs are deferred to Phase 6 (alarms + observability).
  // Adding them later is a single property change with no
  // resource-replacement churn.
});

/**
 * Default 404 action — identical between the HTTPS + HTTP variants.
 * Per-session host-based rules added by Phase 5 take precedence;
 * any subdomain that doesn't match a rule lands here.
 */
const default404Action: aws.types.input.lb.ListenerDefaultAction = {
  type: "fixed-response",
  fixedResponse: {
    contentType: "text/plain",
    messageBody: "Not Found",
    statusCode: "404",
  },
};

/**
 * Listener built from the zone availability. On staged environments
 * we run HTTPS-443 with the wildcard cert; on dev we keep HTTP-80
 * so the deploy can be smoke-tested via the ALB DNS name without
 * ACM validation.
 *
 * `sslPolicy: ELBSecurityPolicy-TLS13-1-2-2021-06` enforces TLS 1.2+
 * per spec §9.2. AWS's modern policy: TLS 1.3 + 1.2 only, FS-suite
 * ciphers, no RSA key exchange.
 */
export const listener = new aws.lb.Listener(
  "openclaw-alb-listener",
  certificateArn !== null
    ? {
        loadBalancerArn: loadBalancer.arn,
        port: 443,
        protocol: "HTTPS",
        sslPolicy: "ELBSecurityPolicy-TLS13-1-2-2021-06",
        certificateArn,
        defaultActions: [default404Action],
      }
    : {
        // Dev fallback — no cert available because there's no hosted
        // zone for the stage. Keep HTTP-80 so smoke tests work via
        // the raw ALB DNS name.
        loadBalancerArn: loadBalancer.arn,
        port: 80,
        protocol: "HTTP",
        defaultActions: [default404Action],
      },
);

/**
 * Public ingress rule on the ALB security group. Lives in this file
 * (not in `iam.ts`) because the SG ingress port MUST match the
 * listener's `port` — and the listener's port is the conditional
 * thing above. Co-locating the two declarations means a future
 * change to one is forced to consider the other.
 *
 * Inspector-brad caught the cost of NOT co-locating these on #105
 * and #106 — separate ports on the SG and listener get past the
 * deploy (AWS doesn't cross-validate the two) but drop every actual
 * request at the SG before the listener ever sees it.
 */
new aws.ec2.SecurityGroupRule("openclaw-alb-sg-ingress-public", {
  type: "ingress",
  securityGroupId: albSecurityGroup.id,
  protocol: "tcp",
  fromPort: certificateArn !== null ? 443 : 80,
  toPort: certificateArn !== null ? 443 : 80,
  cidrBlocks: ["0.0.0.0/0"],
  description:
    certificateArn !== null
      ? "HTTPS from anywhere — TLS terminates at the ALB"
      : "HTTP from anywhere (dev fallback — no cert available without a hosted zone)",
});

/**
 * Wildcard ALIAS record `*.openclaw.<zone>` → ALB. ALIAS (not CNAME)
 * because Route53 alias records can target an ALB's DNS name + zone
 * ID directly with no extra DNS hop, and they work for apex records
 * if we ever need that.
 *
 * One record handles every session subdomain — Phase 5's session
 * lifecycle adds listener rules on the ALB, not DNS records. That's
 * the spec's "no Route53 cleanup needed on session stop" property
 * (§7.2).
 *
 * Skipped on dev stages where the hosted zone is null.
 */
export const wildcardRecord =
  zoneId !== null && wildcardName !== null
    ? new aws.route53.Record("openclaw-wildcard-alias", {
        zoneId,
        name: wildcardName,
        type: "A",
        aliases: [
          {
            name: loadBalancer.dnsName,
            zoneId: loadBalancer.zoneId,
            evaluateTargetHealth: false,
          },
        ],
      })
    : null;
