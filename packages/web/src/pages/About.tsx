import { Link } from "react-router";
import { MarketingLayout } from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";
import { waitlistSignupHref } from "@/lib/waitlist";

export function About() {
  return (
    <MarketingLayout>
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-text mb-10">
            Why Axel exists
          </h1>

          <div className="space-y-10 text-muted leading-relaxed">
            <div>
              <h2 className="text-xl font-semibold text-text mb-3">
                The problem
              </h2>
              <p>
                Professionals are drowning in tool sprawl — a different app for
                every task, and none of them aware of each other. You spend the
                day switching context instead of finishing work.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-text mb-3">
                A crowded landscape
              </h2>
              <p>
                There are multiple wrappers around OpenClaw and plenty of AI
                agents where you need to read docs, wire APIs, and think like a
                technical operator. That&apos;s legitimate — but it leaves most
                people behind. Axel is different: a personal assistant for{" "}
                <span className="text-text font-medium">anyone</span>, whether
                you live in a terminal or you&apos;ve never opened one.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-text mb-3">
                What we believe
              </h2>
              <p>
                One capable, context-aware assistant beats ten disconnected
                ones. You should have one place that knows your calendar, your
                comms, and your priorities — not a dozen tabs that don&apos;t
                talk.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-text mb-3">
                Personal assistant first
              </h2>
              <p>
                Axel is here to brief you, capture meetings, chase follow-ups,
                and keep your day coherent — the way a great PA would. Technical
                users can go deeper when they want to; non-technical users
                should never need a manual to get value.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-text mb-3">
                Integrations, not a public API product
              </h2>
              <p>
                We&apos;re investing in integrations with the tools you already
                use. Axel is not positioned as a broad, bring-your-own-API
                platform — if you need raw programmatic access above all else,
                we&apos;re probably not the right fit today.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-text mb-3">
                Where Axel comes from
              </h2>
              <p>
                Axel is the consumer face of{" "}
                <a
                  href="https://openclaw.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  OpenClaw
                </a>{" "}
                — the same engine, made approachable. We&apos;re a separate
                product, not affiliated with the OpenClaw project itself, but we
                build in the open and give credit where it&apos;s due.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-text mb-3">
                Hosted solutions
              </h2>
              <p>
                We also offer hosted deployments for organisations that need a
                managed Axel environment — scoped, priced per engagement. If
                that&apos;s you, reach out at{" "}
                <a
                  href="mailto:admin@evans-software-soltuions.com?subject=Hosted%20Axel"
                  className="text-accent hover:underline"
                >
                  admin@evans-software-soltuions.com
                </a>{" "}
                and we&apos;ll talk it through.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-text mb-3">
                How we build
              </h2>
              <p>
                Privacy-first, honest about what AI can and can&apos;t do, and
                focused on long-term use — not viral growth hacks. We&apos;d
                rather you trust Axel for years than click once and churn.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-text mb-3">
                Who we are
              </h2>
              <p>
                Small team, big standards. If something breaks your trust, we
                want to hear it — reach us at{" "}
                <a
                  href="mailto:admin@evans-software-soltuions.com"
                  className="text-accent hover:underline"
                >
                  admin@evans-software-soltuions.com
                </a>
                .
              </p>
            </div>
          </div>

          <div className="mt-10">
            <Link to={waitlistSignupHref()}>
              <Button className="bg-accent hover:bg-accent/90 text-white px-8">
                Join waitlist
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}

export default About;
