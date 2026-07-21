import { useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons";
import type { CSSProperties } from "react";
import { translateInfoTooltip, useAppLanguage } from "../../i18n/appTranslations";

export function DashboardInfoTooltip({ text }: { text: string }) {
  const language = useAppLanguage();
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const rect = trigger?.getBoundingClientRect();
  const showBelow = (rect?.top ?? 0) < 92;
  const translatedText = translateInfoTooltip(text, language);

  return (
    <span
      className="dashboard-info-tooltip"
      tabIndex={0}
      aria-label={translatedText}
      onMouseEnter={(event) => { setTrigger(event.currentTarget); setOpen(true); }}
      onMouseLeave={() => setOpen(false)}
      onFocus={(event) => { setTrigger(event.currentTarget); setOpen(true); }}
      onBlur={() => setOpen(false)}
    >
      <FontAwesomeIcon icon={faCircleInfo} aria-hidden="true" />
      {open && rect
        ? createPortal(
            <span
              className="dashboard-info-tooltip__bubble"
              data-tooltip-side={showBelow ? "below" : "above"}
              role="tooltip"
              style={{
                left: rect.left + rect.width / 2,
                top: showBelow ? rect.bottom + 8 : rect.top - 8,
              } as CSSProperties}
            >
              {translatedText}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
