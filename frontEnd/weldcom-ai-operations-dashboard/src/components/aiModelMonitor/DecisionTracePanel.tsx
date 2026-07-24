import { ArrowRight, Bot, BrainCircuit, DatabaseZap, ShieldCheck } from 'lucide-react';
import type { DecisionTrace, HealthTone, MonitorProvenance } from '../../types/aiModelMonitor';
import { Panel } from './Panel';
import { useUiText } from '../../i18n/appTranslations';

function TraceGroup({ title, icon: Icon, items, tone }: {
  title: string;
  icon: typeof Bot;
  items: Array<{ label: string; value: string; tone?: HealthTone }>;
  tone: HealthTone;
}) {
  const t = useUiText();
  return (
    <section className={`amm-trace-group amm-tone-${tone}`}>
      <h3><Icon size={16} />{t(title)}</h3>
      <dl>
        {items.map((item) => <div key={`${title}-${item.label}`}><dt>{t(item.label)}</dt><dd className={item.tone ? `amm-text-${item.tone}` : ''}>{t(item.value)}</dd></div>)}
      </dl>
    </section>
  );
}

export function DecisionTracePanel({ trace, source }: { trace: DecisionTrace; source?: MonitorProvenance }) {
  const t = useUiText();
  const isEmpty = trace.eventId === 'Not available';
  return (
    <Panel
      title="Example Decision Trace"
      subtitle={`${trace.machineId} · ${trace.eventTime} · ${trace.eventId}`}
      tooltip="Một event mẫu được truy vết qua evidence, L1, L2 và policy để giải thích quyết định cuối."
      action={<button type="button" className="amm-link-button">{t('View full trace')} →</button>}
      className="amm-trace-panel"
      source={source}
    >
      {isEmpty ? <div className="amm-trace-empty">{t('No bounded inference sample available.')}</div> : <div className="amm-trace-grid">
        <TraceGroup title="Input Evidence" icon={DatabaseZap} items={trace.inputEvidence} tone="info" />
        <ArrowRight className="amm-trace-arrow" />
        <TraceGroup title="L1 — Dual TCN" icon={BrainCircuit} items={trace.l1} tone="info" />
        <ArrowRight className="amm-trace-arrow" />
        <TraceGroup title="L2 — Risks" icon={Bot} items={trace.l2} tone="healthy" />
        <ArrowRight className="amm-trace-arrow" />
        <TraceGroup title="Policy v2" icon={ShieldCheck} items={trace.policy} tone="warning" />
      </div>}
      <div className="amm-final-reason"><span>{t('Assessment explanation')}</span><strong>{t(trace.finalReason)}</strong></div>
    </Panel>
  );
}
