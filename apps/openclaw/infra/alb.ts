/**
 * Application Load Balancer for per-session OpenClaw subdomain routing.
 *
 * Phase 2 (this PR): ALB + listener with a default 404 action and
 * no TLS cert yet. The exit criteria are met when the ALB's DNS name
 * responds with a 404 over HTTP — confirming the listener works.
 *
 * Phase 3 will:
 *   - attach the wildcard ACM cert (`*.openclaw.<zone>`)
 *   - switch the listener to HTTPS port 443
 *   - add the Route53 wildcard ALIAS record (`*.openclaw.<zone>` →
 *     this ALB)
 *
 * Phase 5's per-session listener rules (host-header → target group)
 * are added at session start time by the core API via the AWS SDK,
 * not in this module. The default action stays as 404 forever —
 * unknown subdomains shouldn't reach a working OpenClaw.
 *
 * Per spec §4.2 + §9.2:
 *   - Internet-facing
 *   - In default public subnets (multi-AZ — ALB requires ≥ 2)
 *   - Wildcard ACM cert in Phase 3
 *   - HTTPS-only listener in Phase 3 (Phase 2 uses HTTP-80 with a
 *     404 default action so the deploy is testable without going
 *     through ACM cert validation)
 */

import { defaultSubnets } from "./cluster";
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
  // Access logs are an SST/CloudWatch decision deferred to Phase 6
  // (alarms + observability). Skipped here to keep the surface
  // minimal — adding them later is a single property add, no
  // resource-replacement churn.
});

/**
 * Default listener. Phase 2 uses HTTP-80 so the deploy doesn't
 * depend on ACM cert provisioning + DNS validation — this lets the
 * Phase 2 exit criterion ("ALB DNS returns 404") be tested via
 * `curl http://<alb-dns>` without touching DNS.
 *
 * Phase 3 will:
 *   1. Issue an ACM cert for `*.openclaw.<zone>` validated via
 *      Route53.
 *   2. Replace this listener with a 443/HTTPS one carrying that
 *      cert.
 *   3. Optionally add an HTTP-80 → HTTPS-443 redirect listener.
 *
 * The default `fixedResponse` returns the literal string "Not Found"
 * with HTTP 404. Any subdomain whose listener rule has been removed
 * (or hasn't been created yet — first request after deploy lands
 * here) hits this default and gets a 404 instead of an internal
 * routing error.
 */
export const listener = new aws.lb.Listener("openclaw-alb-listener", {
  loadBalancerArn: loadBalancer.arn,
  // Phase 2: HTTP-80 so the deploy is testable without TLS. Phase 3
  // replaces this with HTTPS-443 + ACM cert.
  port: 80,
  protocol: "HTTP",
  defaultActions: [
    {
      type: "fixed-response",
      fixedResponse: {
        contentType: "text/plain",
        messageBody: "Not Found",
        statusCode: "404",
      },
    },
  ],
});
