import { Activity, CalendarClock, Database, History, RadioTower, RefreshCw, ShieldCheck, Workflow } from 'lucide-react';
import type { RuntimeStripItem } from '../../types/aiModelMonitor';
import { InfoTooltip } from './InfoTooltip';

const icons = {
  serving: RadioTower,
  pipeline: Workflow,
  database: Database,
  parity: ShieldCheck,
  freshness: History,
  run: Activity,
  retrain: CalendarClock,
};

export function RuntimeStatusStrip({ items }: { items: RuntimeStripItem[] }) {
  return (
    <footer className="amm-runtime-strip">
      {items.map((item) => {
        const Icon = icons[item.icon] ?? RefreshCw;
        return (
          <div className={`amm-runtime-item amm-tone-${item.tone}`} key={item.id}>
            <Icon size={22} />
            <span><small>{item.label}</small><strong>{item.value}</strong></span>
            <InfoTooltip text={item.tooltip} align="right" />
          </div>
        );
      })}
    </footer>
  );
}
