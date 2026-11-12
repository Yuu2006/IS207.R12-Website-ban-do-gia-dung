import { useId, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

// Chuẩn hóa dấu tiếng Việt để tìm kiếm theo tên gần đúng.
function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLocaleLowerCase('vi');
}

// Ô nhập có gợi ý bàn phím; vẫn cho phép giữ địa danh cũ hoặc tên người dùng tự nhập.
export default function AutocompleteCombobox({
  id,
  label,
  value,
  onChange,
  onSelect,
  options = [],
  error,
  hint,
  loading = false,
  required = false,
  disabled = false,
  autoComplete = 'off',
  maxLength,
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = useId();
  const rootRef = useRef(null);
  const query = normalize(value);
  const filteredOptions = useMemo(() => {
    const unique = [...new Map(options.filter(Boolean).map(option => [normalize(option), option])).values()];
    return unique.filter(option => !query || normalize(option).includes(query)).slice(0, 60);
  }, [options, query]);
  const activeOptionId = activeIndex >= 0 && filteredOptions[activeIndex] ? listId + '-option-' + activeIndex : undefined;

  function choose(option) {
    if (onSelect) onSelect(option);
    else onChange(option);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(current => filteredOptions.length ? (current + 1) % filteredOptions.length : -1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(current => filteredOptions.length ? (current <= 0 ? filteredOptions.length - 1 : current - 1) : -1);
    } else if (event.key === 'Enter' && open && activeIndex >= 0 && filteredOptions[activeIndex]) {
      event.preventDefault();
      choose(filteredOptions[activeIndex]);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  const describedBy = [error ? id + '-error' : '', hint ? id + '-hint' : ''].filter(Boolean).join(' ') || undefined;

  return <div className="hc-field">
    <label htmlFor={id}>{label}{required && <span aria-label="bắt buộc"> *</span>}</label>
    <div className="hc-combobox" ref={rootRef}>
      <input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={activeOptionId}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        autoComplete={autoComplete}
        maxLength={maxLength}
        required={required}
        disabled={disabled}
        value={value || ''}
        onFocus={() => setOpen(true)}
        onChange={event => { onChange(event.target.value); setOpen(true); setActiveIndex(-1); }}
        onKeyDown={handleKeyDown}
        onBlur={event => { if (!rootRef.current?.contains(event.relatedTarget)) setOpen(false); }}
      />
      <button
        className="hc-combobox__toggle"
        type="button"
        aria-label={(open ? 'Ẩn gợi ý ' : 'Hiện gợi ý ') + label}
        aria-expanded={open}
        disabled={disabled}
        onMouseDown={event => event.preventDefault()}
        onClick={() => setOpen(current => !current)}
      ><ChevronDown size={17} aria-hidden="true" /></button>
      {open && <div className="hc-combobox__list" id={listId} role="listbox" aria-label={'Gợi ý ' + label}>
        {loading ? <p className="hc-combobox__status" role="status">Đang tải gợi ý…</p>
          : filteredOptions.length ? filteredOptions.map((option, index) => <button
            className={'hc-combobox__option' + (index === activeIndex ? ' is-active' : '')}
            id={listId + '-option-' + index}
            type="button"
            role="option"
            aria-selected={index === activeIndex}
            key={normalize(option) + '-' + index}
            onMouseDown={event => event.preventDefault()}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => choose(option)}
          >{option}</button>)
            : <p className="hc-combobox__status">{query ? 'Không có gợi ý phù hợp. Ông có thể nhập địa danh khác.' : 'Gõ để tìm hoặc nhập địa danh.'}</p>}
      </div>}
    </div>
    {hint && <p className="hc-muted hc-combobox__hint" id={id + '-hint'}>{hint}</p>}
    {error && <p className="hc-field-error" id={id + '-error'}>{error}</p>}
  </div>;
}
