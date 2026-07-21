import { Info } from 'lucide-react';
import type { ReactNode } from 'react';

interface InfoTooltipProps {
  text: string;
  children?: ReactNode;
  align?: 'left' | 'center' | 'right';
}

export function InfoTooltip({ text, children, align = 'center' }: InfoTooltipProps) {
  return (
    <span className={`amm-tooltip amm-tooltip--${align}`} tabIndex={0} aria-label={text}>
      {children ?? <Info size={14} aria-hidden="true" />}
      <span className="amm-tooltip__bubble" role="tooltip">{text}</span>
    </span>
  );
}
