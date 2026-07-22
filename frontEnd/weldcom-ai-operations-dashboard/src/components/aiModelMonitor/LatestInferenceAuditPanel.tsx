import type { AIModelMonitorPayload, MonitorProvenance } from '../../types/aiModelMonitor';
import { formatCount, formatHistoricalTimestamp } from '../../utils/formatters';
import { SourceBadge } from './SourceBadge';

export function LatestInferenceAuditPanel({ audit, source }: { audit?: AIModelMonitorPayload['latestInferenceAudit']; source?: MonitorProvenance }) {
  if (!audit?.availability) return null;
  return <section className="amm-latest-audit" aria-label="Latest bounded AI inference">
    <header><span>Latest bounded inference</span><SourceBadge source={source} /></header>
    <div className="amm-latest-audit__grid">
      <div><span>Status</span><strong>{audit.result || 'Not available'}</strong></div>
      <div><span>Input / policy-ready</span><strong>{formatCount(audit.inputRows)} / {formatCount(audit.scoredRows)}</strong></div>
      <div><span>Candidate</span><strong>{audit.candidateAUsed ? 'A' : 'Not available'}</strong></div>
      <div><span>SQL writes</span><strong>{formatCount(audit.sqlWrites)}</strong></div>
      <div><span>Completed</span><strong title={audit.generatedAt ?? undefined}>{formatHistoricalTimestamp(audit.generatedAt)}</strong></div>
    </div>
  </section>;
}
