import type { ReactNode } from 'react';
import type { MonitorProvenance } from '../../types/aiModelMonitor';
import { InfoTooltip } from './InfoTooltip';
import { SourceBadge } from './SourceBadge';

interface PanelProps {
  title: string;
  subtitle?: string;
  tooltip?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
  source?: MonitorProvenance;
}

export function Panel({ title, subtitle, tooltip, action, className = '', children, source }: PanelProps) {
  return (
    <section className={`amm-panel ${className}`}>
      <header className="amm-panel__header">
        <div className="amm-panel__heading">
          <div className="amm-panel__title-row">
            <h2>{title}</h2>
            {tooltip ? <InfoTooltip text={tooltip} /> : null}
          </div>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {action || source ? <div className="amm-panel__action"><SourceBadge source={source} />{action}</div> : null}
      </header>
      <div className="amm-panel__body">{children}</div>
    </section>
  );
}
