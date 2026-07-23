import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons';
import { createPortal } from 'react-dom';
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { translateInfoTooltip, useAppLanguage } from '../../i18n/appTranslations';

interface InfoDotProps { text: string; }

export function InfoDot({ text }: InfoDotProps) {
  const language = useAppLanguage();
  const translatedText = translateInfoTooltip(text, language);
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const rect = trigger?.getBoundingClientRect();
  const showBelow = (rect?.top ?? 0) < 92;

  return (
    <span
      className="md-info-dot"
      tabIndex={0}
      aria-label={translatedText}
      onMouseEnter={(event) => { setTrigger(event.currentTarget); setOpen(true); }}
      onMouseLeave={() => setOpen(false)}
      onFocus={(event) => { setTrigger(event.currentTarget); setOpen(true); }}
      onBlur={() => setOpen(false)}
    >
      <FontAwesomeIcon icon={faCircleInfo} />
      {open && rect ? createPortal(
        <span
          className="md-info-tooltip md-info-tooltip--portal"
          data-tooltip-side={showBelow ? 'below' : 'above'}
          role="tooltip"
          style={{ left: rect.left + rect.width / 2, top: showBelow ? rect.bottom + 8 : rect.top - 8 } as CSSProperties}
        >
          {translatedText}
        </span>,
        document.body,
      ) : null}
    </span>
  );
}
