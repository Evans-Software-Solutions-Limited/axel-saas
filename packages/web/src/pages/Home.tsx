import { useEffect } from "react";
import { Link, useLocation } from "react-router";
import { MarketingLayout } from "@/components/MarketingLayout";
import { PageMeta } from "@/components/PageMeta";
import { WaitlistForm } from "@/components/WaitlistForm";
import { Button } from "@/components/ui/button";
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
      <section className="py-24 px-4 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <h1 className="text-5xl font-bold text-text leading-tight">
            One assistant. Every kind of work.
          </h1>
          <p className="text-xl text-muted">
            Axel handles your calendar, your comms, and everything between —
            built to feel like a personal assistant, not a developer tool.
          </p>
          <p className="text-sm text-muted">{RELEASE_EXPECTATION_COPY}</p>
          <div className="flex items-center justify-center gap-4 pt-2 flex-wrap">
            <Link to={waitlistSignupHref()}>
              <Button className="bg-accent hover:bg-accent/90 text-white px-8 py-3 text-base">
                Join waitlist
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button
                type="button"
                variant="outline"
                className="border-border text-text hover:bg-surface-raised px-8 py-3 text-base"
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
        className="py-16 px-4 bg-surface-raised scroll-mt-20"
      >
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-text text-center mb-10">
            What Axel does for you
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {VALUE_CELLS.map(({ icon: Icon, headline, body }) => (
              <div
                key={headline}
                className="text-center md:text-left space-y-3"
              >
                <Icon
                  className="w-10 h-10 text-accent mx-auto md:mx-0"
                  stroke={1.5}
                  aria-hidden
                />
                <h3 className="text-lg font-semibold text-text">{headline}</h3>
                <p className="text-muted text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-2xl font-bold text-text">Simple plans</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
            {PRICING_TEASER.map(({ name, blurb }) => (
              <div
                key={name}
                className="rounded-xl border border-border bg-surface-raised p-5"
              >
                <p className="font-semibold text-text mb-2">{name}</p>
                <p className="text-sm text-muted leading-relaxed">{blurb}</p>
              </div>
            ))}
          </div>
          <Link
            to="/pricing"
            className="inline-flex text-accent font-medium hover:underline"
          >
            See full pricing
          </Link>
        </div>
      </section>

      {/* Waitlist form — POST /waitlist per API spec */}
      <section
        id={WAITLIST_SECTION_ID}
        className="py-20 px-4 text-center border-t border-border scroll-mt-20"
      >
        <div className="max-w-xl mx-auto space-y-6">
          <h2 className="text-3xl font-bold text-text">Get on the list</h2>
          <p className="text-muted">
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
