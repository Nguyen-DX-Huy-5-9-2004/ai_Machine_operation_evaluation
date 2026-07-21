import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';

interface Props {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  className?: string;
}

export function MachineDetailSelect({ value, options, onChange, className = '' }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`md-dropdown ${open ? 'is-open' : ''} ${className}`}>
      <button type="button" className="md-dropdown-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(current => !current)}>
        <span>{value}</span>
        <FontAwesomeIcon icon={faChevronDown} />
      </button>
      {open && (
        <div className="md-dropdown-menu" role="listbox">
          {options.map(option => (
            <button type="button" role="option" aria-selected={option === value} key={option} className={option === value ? 'is-selected' : ''} onClick={() => { onChange(option); setOpen(false); }}>
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
