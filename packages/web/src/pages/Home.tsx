import { Link } from "react-router";
import { MarketingLayout } from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";
import { IconCheck } from "@tabler/icons-react";

const FEATURES = [
  {
    title: "Email Triage",
    description:
      "Axel reads, categorises, and drafts replies to your inbox so you can focus on what matters.",
  },
  {
    title: "Calendar Management",
    description:
      "Book, reschedule, and defend your time automatically based on your priorities.",
  },
  {
    title: "Task Automation",
    description:
      "Delegate recurring tasks to Axel and get a daily brief on what's been done.",
  },
  {
    title: "Telegram Integration",
    description:
      "Chat with Axel directly over Telegram for quick updates and approvals on the go.",
  },
] as const;

export function Home() {
  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="py-24 px-4 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <h1 className="text-5xl font-bold text-text leading-tight">
            Your 24/7 <span className="text-accent">AI Employee</span>
          </h1>
          <p className="text-xl text-muted">
            Axel handles your email, calendar, tasks, and daily brief — so you
            can focus on the work only you can do.
          </p>
          <div className="flex items-center justify-center gap-4 pt-2 flex-wrap">
            <Link to="/signup">
              <Button className="bg-accent hover:bg-accent/90 text-white px-8 py-3 text-base">
                Get started free
              </Button>
            </Link>
            <Link to="/pricing">
              <Button
                variant="outline"
                className="border-border text-text hover:bg-surface-raised px-8 py-3 text-base"
              >
                See pricing
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted">
            14-day free trial. No credit card required.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-surface-raised">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-text text-center mb-12">
            Everything you need, handled
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-4">
                <IconCheck className="w-5 h-5 text-success mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-text mb-1">{f.title}</h3>
                  <p className="text-muted text-sm">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 text-center">
        <div className="max-w-xl mx-auto space-y-4">
          <h2 className="text-3xl font-bold text-text">Ready to delegate?</h2>
          <p className="text-muted">
            Join professionals who've reclaimed their time with Axel.
          </p>
          <Link to="/signup">
            <Button className="bg-accent hover:bg-accent/90 text-white px-8 py-3 text-base mt-2">
              Start for free
            </Button>
          </Link>
        </div>
      </section>
    </MarketingLayout>
  );
}

export default Home;
