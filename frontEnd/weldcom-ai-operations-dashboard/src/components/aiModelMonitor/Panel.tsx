import type { ReactNode } from 'react';
import { InfoTooltip } from './InfoTooltip';

interface PanelProps {
  title: string;
  subtitle?: string;
  tooltip?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Panel({ title, subtitle, tooltip, action, className = '', children }: PanelProps) {
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
        {action ? <div className="amm-panel__action">{action}</div> : null}
      </header>
      <div className="amm-panel__body">{children}</div>
    </section>
  );
}
