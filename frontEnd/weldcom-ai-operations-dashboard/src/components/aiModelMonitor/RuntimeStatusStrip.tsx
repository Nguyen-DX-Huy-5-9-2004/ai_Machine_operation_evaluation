import { Activity, CalendarClock, Database, History, RadioTower, RefreshCw, ShieldCheck, Workflow } from 'lucide-react';
import type { MonitorProvenance, RuntimeStripItem } from '../../types/aiModelMonitor';
import { InfoTooltip } from './InfoTooltip';
import { SourceBadge } from './SourceBadge';

const icons = {
  serving: RadioTower,
  pipeline: Workflow,
  database: Database,
  parity: ShieldCheck,
  freshness: History,
  run: Activity,
  retrain: CalendarClock,
};

export function RuntimeStatusStrip({ items, source }: { items: RuntimeStripItem[]; source?: MonitorProvenance }) {
  return (
    <footer className="amm-runtime-strip"><SourceBadge source={source} />
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
