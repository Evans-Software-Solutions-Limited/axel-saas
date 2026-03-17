import { Link } from "react-router";
import { MarketingLayout } from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const USE_CASES = [
  {
    title: "Busy Professionals",
    description:
      "Axel triages your inbox, prepares your daily brief, and keeps your calendar clear of conflicts — all before you've finished your morning coffee.",
    highlights: [
      "Inbox zero by 9am",
      "Daily summary brief",
      "Conflict-free scheduling",
    ],
  },
  {
    title: "Founders & Solopreneurs",
    description:
      "Run your business without drowning in admin. Axel handles follow-ups, schedules meetings, and tracks your tasks across projects.",
    highlights: [
      "Automated follow-ups",
      "Multi-project task tracking",
      "Meeting scheduling",
    ],
  },
  {
    title: "Remote Teams",
    description:
      "Keep distributed teams aligned with automated standups, shared task boards, and async communication — routed through Axel.",
    highlights: [
      "Async standup summaries",
      "Shared task visibility",
      "Multi-agent workflows",
    ],
  },
  {
    title: "Technical Teams",
    description:
      "Connect Axel to your stack via API. Trigger automations from code, query task state, and integrate with your existing pipelines.",
    highlights: ["Full API access", "Code generation", "Custom integrations"],
  },
] as const;

export function UseCases() {
  return (
    <MarketingLayout>
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-text mb-4">Use Cases</h1>
            <p className="text-muted text-lg max-w-2xl mx-auto">
              Axel adapts to how you work — whether you're a solo operator or a
              growing team.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {USE_CASES.map((uc) => (
              <Card
                key={uc.title}
                className="border border-border bg-surface-raised"
              >
                <CardHeader>
                  <CardTitle className="text-text">{uc.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted text-sm">{uc.description}</p>
                  <ul className="space-y-2">
                    {uc.highlights.map((h) => (
                      <li
                        key={h}
                        className="flex items-center gap-2 text-sm text-text"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                        {h}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link to="/signup">
              <Button className="bg-accent hover:bg-accent/90 text-white px-8">
                Try Axel for free
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}

export default UseCases;
