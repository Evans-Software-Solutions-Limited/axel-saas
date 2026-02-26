const PlaceholderTab = ({ title }: { title: string }) => (
  <div className="p-8">
    <h1 className="text-3xl font-bold mb-4">{title}</h1>
    <div className="rounded-lg border border-[#1a1a1a] bg-[#111] p-8 text-center">
      <p className="text-gray-400">Coming soon...</p>
    </div>
  </div>
);

export function Chat() {
  return <PlaceholderTab title="Chat" />;
}

export function Tasks() {
  return <PlaceholderTab title="Tasks" />;
}

export function Crons() {
  return <PlaceholderTab title="Crons" />;
}

export function Integrations() {
  return <PlaceholderTab title="Integrations" />;
}

export function Settings() {
  return <PlaceholderTab title="Settings" />;
}
