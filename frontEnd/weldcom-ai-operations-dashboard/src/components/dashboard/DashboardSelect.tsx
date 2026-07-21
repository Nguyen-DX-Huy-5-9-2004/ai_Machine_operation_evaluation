import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';

interface DashboardSelectProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  compact?: boolean;
}

export function DashboardSelect({ value, options, onChange, compact = false }: DashboardSelectProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="chart-select">
      <button className={['select-pill chart-select-button', open ? 'is-active' : ''].join(' ')} onClick={() => setOpen((state) => !state)}>
        {value}
        <FontAwesomeIcon icon={faChevronDown} className="ml-auto text-[10px]" />
      </button>
      {open ? (
        <div className={['dropdown-menu', compact ? 'compact' : ''].join(' ')}>
          {options.map((option) => (
            <button key={option} onClick={() => { onChange(option); setOpen(false); }} className={option === value ? 'is-selected' : ''}>
              {option}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
