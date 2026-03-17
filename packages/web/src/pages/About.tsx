import { Link } from "react-router";
import { MarketingLayout } from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";

export function About() {
  return (
    <MarketingLayout>
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-text mb-8">About Axel</h1>

          <div className="space-y-10 text-muted">
            <div>
              <h2 className="text-xl font-semibold text-text mb-3">
                Our mission
              </h2>
              <p>
                We built Axel because knowledge workers spend too much time on
                coordination — email, scheduling, task tracking — and not enough
                time on the work that actually matters. Axel is the AI employee
                that handles the coordination layer, 24/7, so you don't have to.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-text mb-3">
                What makes Axel different
              </h2>
              <p>
                Most AI tools bolt onto your existing workflows. Axel owns them.
                It reads your inbox, manages your calendar, tracks your tasks,
                and surfaces a daily brief — acting like a dedicated PA rather
                than a chatbot you have to prompt.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-text mb-3">
                Built for real work
              </h2>
              <p>
                Axel connects to the tools you already use — email, calendar,
                Telegram, and more — and learns your preferences over time. It
                handles routine decisions, escalates the ones that need you, and
                keeps a clear audit trail of everything it's done.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-text mb-3">
                Get in touch
              </h2>
              <p>
                Questions, feedback, or enterprise enquiries —{" "}
                <a
                  href="mailto:hello@axel.ai"
                  className="text-accent hover:underline"
                >
                  hello@axel.ai
                </a>
              </p>
            </div>
          </div>

          <div className="mt-10">
            <Link to="/signup">
              <Button className="bg-accent hover:bg-accent/90 text-white px-8">
                Start for free
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}

export default About;
