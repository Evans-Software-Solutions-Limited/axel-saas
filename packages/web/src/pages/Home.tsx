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
      <section className="py-28 px-4 text-center relative z-10">
        <div className="max-w-3xl mx-auto space-y-8">
          <h1 className="text-5xl md:text-6xl font-display font-bold text-text leading-[1.1] tracking-tight animate-fade-up stagger-1">
            One assistant.{" "}
            <span className="text-accent drop-shadow-[0_0_20px_var(--color-accent-glow)]">
              Every kind of work.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed animate-fade-up stagger-2">
            Axel handles your calendar, your comms, and everything between —
            built to feel like a personal assistant, not a developer tool.
          </p>
          <p className="text-sm text-muted animate-fade-up stagger-3">
            {RELEASE_EXPECTATION_COPY}
          </p>
          <div className="flex items-center justify-center gap-4 pt-2 flex-wrap animate-fade-up stagger-4">
            <Link to={waitlistSignupHref()}>
              <Button className="px-8 py-3 text-base">Join waitlist</Button>
            </Link>
            <a href="#how-it-works">
              <Button
                type="button"
                variant="outline"
                className="px-8 py-3 text-base"
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
        className="py-20 px-4 scroll-mt-20 relative z-10"
      >
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-display font-bold text-text text-center mb-14">
            What Axel does for you
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {VALUE_CELLS.map(({ icon: Icon, headline, body }) => (
              <div
                key={headline}
                className="glass-card rounded-2xl p-6 text-center md:text-left space-y-4"
              >
                <div className="w-12 h-12 rounded-xl bg-accent-muted flex items-center justify-center mx-auto md:mx-0">
                  <Icon
                    className="w-6 h-6 text-accent"
                    stroke={1.5}
                    aria-hidden
                  />
                </div>
                <h3 className="text-lg font-display font-semibold text-text">
                  {headline}
                </h3>
                <p className="text-text-secondary text-sm leading-relaxed">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="py-20 px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-10">
          <h2 className="text-3xl font-display font-bold text-text">
            Simple plans
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
            {PRICING_TEASER.map(({ name, blurb }) => (
              <div key={name} className="glass-card rounded-2xl p-6">
                <p className="font-display font-semibold text-text mb-2">
                  {name}
                </p>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {blurb}
                </p>
              </div>
            ))}
          </div>
          <Link
            to="/pricing"
            className="inline-flex text-accent font-medium hover:underline underline-offset-4 transition-all duration-200"
          >
            See full pricing
          </Link>
        </div>
      </section>

      {/* Waitlist form */}
      <section
        id={WAITLIST_SECTION_ID}
        className="py-24 px-4 text-center border-t border-border-subtle scroll-mt-20 relative z-10"
      >
        <div className="max-w-xl mx-auto space-y-6">
          <h2 className="text-3xl font-display font-bold text-text">
            Get on the list
          </h2>
          <p className="text-text-secondary">
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
