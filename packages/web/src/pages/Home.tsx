import { useEffect } from "react";
import { Link, useLocation } from "react-router";
import { MarketingLayout } from "@/components/MarketingLayout";
import { PageMeta } from "@/components/PageMeta";
import { WaitlistForm } from "@/components/WaitlistForm";
import { Button } from "@axel-saas/ui/button";
import {
  IconCalendarEvent,
  IconClipboardList,
  IconPlug,
} from "@tabler/icons-react";
import {
  RELEASE_EXPECTATION_COPY,
  WAITLIST_SECTION_ID,
  waitlistSignupHref,
} from "@/lib/waitlist";

const VALUE_CELLS = [
  {
    icon: IconCalendarEvent,
    headline: "Your day, planned",
    body: "Axel reads your schedule, surfaces what matters, and briefs you every morning.",
  },
  {
    icon: IconClipboardList,
    headline: "Every meeting, captured",
    body: "Summaries, action items, and follow-ups — without lifting a finger.",
  },
  {
    icon: IconPlug,
    headline: "Connects to how you work",
    body: "First-class integrations with the tools you already use — no engineering degree required to get value.",
  },
] as const;

const PRICING_TEASER = [
  { name: "Free", blurb: "Meet Axel — limits on volume and sub-agents." },
  { name: "Premium", blurb: "Full Axel capability for professionals." },
  {
    name: "Enterprise",
    blurb: "Teams, SSO, integrations, and custom retention.",
  },
] as const;

export function Home() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash === `#${WAITLIST_SECTION_ID}`) {
      document.getElementById(WAITLIST_SECTION_ID)?.scrollIntoView({
        behavior: "smooth",
      });
    }
  }, [location.hash, location.pathname]);

  return (
    <MarketingLayout>
      <PageMeta
        title="Axel — AI Personal Assistant for Everyone"
        description="Axel handles your calendar, comms, and tasks — built for anyone, not just developers. One assistant for every kind of work. Join the waitlist."
        path="/"
      />
      {/* Hero */}
      <section className="py-32 px-6 text-center relative overflow-hidden">
        {/* Subtle radial glow behind hero */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse, rgba(79,143,247,0.08) 0%, transparent 70%)",
          }}
        />
        <div className="max-w-3xl mx-auto space-y-8 relative">
          <h1 className="text-5xl md:text-6xl font-bold text-text leading-[1.1] tracking-tight">
            One assistant.{" "}
            <span className="text-accent">Every kind of work.</span>
          </h1>
          <p className="text-lg md:text-xl text-muted max-w-2xl mx-auto leading-relaxed">
            Axel handles your calendar, your comms, and everything between —
            built to feel like a personal assistant, not a developer tool.
          </p>
          <p className="text-sm text-muted/70">{RELEASE_EXPECTATION_COPY}</p>
          <div className="flex items-center justify-center gap-4 pt-2 flex-wrap">
            <Link to={waitlistSignupHref()}>
              <Button className="bg-accent hover:bg-accent/85 text-white px-8 py-3 text-base rounded-lg shadow-lg shadow-accent/20 transition-all">
                Join waitlist
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button
                type="button"
                variant="outline"
                className="border-border/80 text-text hover:bg-surface-raised hover:border-border px-8 py-3 text-base rounded-lg"
              >
                See how it works
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Problem / value strip */}
      <section
        id="how-it-works"
        className="py-20 px-6 bg-surface-raised/50 border-y border-border/40 scroll-mt-20"
      >
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-text text-center mb-12 tracking-tight">
            What Axel does for you
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {VALUE_CELLS.map(({ icon: Icon, headline, body }) => (
              <div
                key={headline}
                className="text-center md:text-left space-y-4 p-6 rounded-xl border border-border/40 bg-surface/50 hover:border-border/70 transition-colors"
              >
                <div className="w-11 h-11 rounded-lg bg-accent/10 flex items-center justify-center mx-auto md:mx-0">
                  <Icon
                    className="w-5 h-5 text-accent"
                    stroke={1.5}
                    aria-hidden
                  />
                </div>
                <h3 className="text-lg font-semibold text-text tracking-tight">
                  {headline}
                </h3>
                <p className="text-muted text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-10">
          <h2 className="text-2xl font-bold text-text tracking-tight">
            Simple plans
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-left">
            {PRICING_TEASER.map(({ name, blurb }) => (
              <div
                key={name}
                className="rounded-xl border border-border/60 bg-surface-raised/60 p-6 hover:border-accent/30 transition-colors"
              >
                <p className="font-semibold text-text mb-2 tracking-tight">
                  {name}
                </p>
                <p className="text-sm text-muted leading-relaxed">{blurb}</p>
              </div>
            ))}
          </div>
          <Link
            to="/pricing"
            className="inline-flex text-accent font-medium hover:text-accent/80 transition-colors"
          >
            See full pricing &rarr;
          </Link>
        </div>
      </section>

      {/* Waitlist form — POST /waitlist per API spec */}
      <section
        id={WAITLIST_SECTION_ID}
        className="py-24 px-6 text-center border-t border-border/40 scroll-mt-20 relative overflow-hidden"
      >
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse, rgba(79,143,247,0.06) 0%, transparent 70%)",
          }}
        />
        <div className="max-w-xl mx-auto space-y-6 relative">
          <h2 className="text-3xl font-bold text-text tracking-tight">
            Get on the list
          </h2>
          <p className="text-muted leading-relaxed">
            {RELEASE_EXPECTATION_COPY} We&apos;ll email you when it&apos;s your
            turn. Pick the plan you&apos;re most interested in — you can change
            it later.
          </p>
          <WaitlistForm />
        </div>
      </section>
    </MarketingLayout>
  );
}

export default Home;
