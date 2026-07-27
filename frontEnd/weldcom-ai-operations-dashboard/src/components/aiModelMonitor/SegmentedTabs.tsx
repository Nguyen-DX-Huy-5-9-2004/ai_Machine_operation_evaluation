import { useUiText } from '../../i18n/appTranslations';

interface SegmentedTabsProps<T extends string> {
  value: T;
  values: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  ariaLabel: string;
}

export function SegmentedTabs<T extends string>({ value, values, onChange, ariaLabel }: SegmentedTabsProps<T>) {
  const t = useUiText();
  return (
    <div className="amm-segmented" role="tablist" aria-label={t(ariaLabel)}>
      {values.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={item.value === value}
          className={item.value === value ? 'is-active' : ''}
          onClick={() => onChange(item.value)}
        >
          {t(item.label)}
        </button>
      ))}
    </div>
  );
}
