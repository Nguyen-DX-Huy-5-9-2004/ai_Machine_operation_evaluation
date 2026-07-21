import { Info } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, ReactNode } from 'react';
import { translateInfoTooltip, useAppLanguage } from '../../i18n/appTranslations';

interface InfoTooltipProps {
  text: string;
  children?: ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export function InfoTooltip({ text, children, align = 'center', className = '' }: InfoTooltipProps) {
  const language = useAppLanguage();
  const translatedText = translateInfoTooltip(text, language);
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const rect = trigger?.getBoundingClientRect();
  const showBelow = (rect?.top ?? 0) < 92;
  const left = align === 'left' ? (rect?.left ?? 0) : align === 'right' ? (rect?.right ?? 0) : ((rect?.left ?? 0) + (rect?.width ?? 0) / 2);
  const top = showBelow ? (rect?.bottom ?? 0) + 8 : (rect?.top ?? 0) - 8;

  return (
    <span
      className={`amm-tooltip amm-tooltip--${align} ${className}`}
      tabIndex={0}
      aria-label={translatedText}
      onMouseEnter={(event) => { setTrigger(event.currentTarget); setOpen(true); }}
      onMouseLeave={() => setOpen(false)}
      onFocus={(event) => { setTrigger(event.currentTarget); setOpen(true); }}
      onBlur={() => setOpen(false)}
    >
      {children ?? <Info size={14} aria-hidden="true" />}
      {open && rect
        ? createPortal(
            <span
              className="amm-tooltip__bubble amm-tooltip__bubble--portal"
              data-align={align}
              data-tooltip-side={showBelow ? 'below' : 'above'}
              role="tooltip"
              style={{ left, top } as CSSProperties}
            >
              {translatedText}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
