import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons';
import { translateInfoTooltip, useAppLanguage } from '../../i18n/appTranslations';

interface InfoDotProps { text: string; }

export function InfoDot({ text }: InfoDotProps) {
  const language = useAppLanguage();
  const translatedText = translateInfoTooltip(text, language);
  return <span className="md-info-dot" tabIndex={0} aria-label={translatedText}><FontAwesomeIcon icon={faCircleInfo} /><span className="md-info-tooltip">{translatedText}</span></span>;
}
