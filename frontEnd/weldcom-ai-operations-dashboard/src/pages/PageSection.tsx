interface PageSectionProps {
  title: string;
  purpose: string;
  items: string[];
}

export function PageSection({ title, purpose, items }: PageSectionProps) {
  return (
    <section className="glass-panel p-5">
      <div className="panel-title mb-2">{title}</div>
      <p className="mb-4 text-sm text-slate-300">{purpose}</p>
      <div className="grid gap-2 text-sm text-slate-400">
        {items.map((item) => (
          <div key={item} className="rounded-lg border border-blue-200/10 bg-slate-950/[0.28] px-3 py-2">{item}</div>
        ))}
      </div>
    </section>
  );
}
