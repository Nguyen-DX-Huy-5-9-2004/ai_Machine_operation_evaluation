import {
  Activity, BadgeCheck, BrainCircuit, Crosshair, DatabaseZap, HeartPulse, ShieldCheck,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import type { MonitorKpi } from '../../types/aiModelMonitor';
import { InfoTooltip } from './InfoTooltip';
import { Sparkline } from './Sparkline';
import { useUiText } from '../../i18n/appTranslations';

const ICONS = {
  runtime: HeartPulse,
  coverage: ShieldCheck,
  l1: BrainCircuit,
  l2: DatabaseZap,
  calibration: Crosshair,
  drift: Activity,
  runs: BadgeCheck,
};

export function MonitorKpiCard({ item }: { item: MonitorKpi }) {
  const t = useUiText();
  const Icon = ICONS[item.icon];
  const deltaClass = item.deltaDirection ? `is-${item.deltaDirection}` : '';

  return (
    <article className={`amm-kpi amm-tone-${item.tone}`} style={{ '--amm-accent': `var(--amm-${item.tone})` } as CSSProperties}>
      <div className="amm-kpi__top">
        <span className="amm-kpi__icon"><Icon size={22} /></span>
        <span className="amm-kpi__label">{t(item.label)}</span>
        <InfoTooltip text={item.tooltip} align="right" />
      </div>
      <div className="amm-kpi__value-row">
        <div><strong>{item.value}</strong>{item.suffix ? <span>{item.suffix}</span> : null}</div>
        <Sparkline values={item.sparkline} color="var(--amm-accent)" />
      </div>
      <p className="amm-kpi__detail">{t(item.detail)}</p>
      {item.delta ? <p className={`amm-kpi__delta ${deltaClass}`}>{item.deltaDirection === 'up' ? '▲' : item.deltaDirection === 'down' ? '▼' : '•'} {t(item.delta)}</p> : null}
    </article>
  );
}
