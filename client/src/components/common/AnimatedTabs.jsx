import { useLayoutEffect, useRef, useState } from 'react';

// Một hàng tab dùng chung indicator, bàn phím và nhịp animation cho các màn hình.
export default function AnimatedTabs({ options, value, onChange, label, idPrefix, panelId, className = '' }) {
  const listRef = useRef(null);
  const buttonRefs = useRef({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0, visible: false });
  const normalizedOptions = options.map(option => Array.isArray(option)
    ? { value: option[0], label: option[1] }
    : option);

  useLayoutEffect(() => {
    const list = listRef.current;
    const active = buttonRefs.current[String(value)];
    if (!list || !active) return undefined;

    const updateIndicator = () => {
      const next = { left: active.offsetLeft, width: active.offsetWidth, visible: true };
      setIndicator(current => current.left === next.left && current.width === next.width && current.visible
        ? current
        : next);
    };

    updateIndicator();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateIndicator);
    observer?.observe(list);
    normalizedOptions.forEach(option => {
      const button = buttonRefs.current[String(option.value)];
      if (button) observer?.observe(button);
    });
    window.addEventListener('resize', updateIndicator);

    const activeLeft = active.offsetLeft;
    const activeRight = activeLeft + active.offsetWidth;
    if (activeLeft < list.scrollLeft) list.scrollTo({ left: activeLeft, behavior: 'smooth' });
    else if (activeRight > list.scrollLeft + list.clientWidth) {
      list.scrollTo({ left: activeRight - list.clientWidth, behavior: 'smooth' });
    }

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateIndicator);
    };
  }, [value, options.length]);

  function handleKeyDown(event) {
    if (!normalizedOptions.length) return;
    const currentIndex = normalizedOptions.findIndex(option => String(option.value) === String(value));
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % normalizedOptions.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + normalizedOptions.length) % normalizedOptions.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = normalizedOptions.length - 1;
    else return;

    event.preventDefault();
    const next = normalizedOptions[nextIndex];
    onChange(next.value);
    buttonRefs.current[String(next.value)]?.focus();
  }

  return <div className={`hc-tabs ${className}`.trim()} ref={listRef} role="tablist" aria-label={label} onKeyDown={handleKeyDown}>
    {normalizedOptions.map(option => {
      const selected = String(value) === String(option.value);
      const TabIcon = option.icon;
      const tabId = `${idPrefix}-${option.value}`;
      return <button
        key={option.value}
        id={tabId}
        ref={element => { buttonRefs.current[String(option.value)] = element; }}
        type="button"
        role="tab"
        aria-selected={selected}
        aria-controls={panelId}
        tabIndex={selected ? 0 : -1}
        className={`hc-tabs__button${selected ? ' is-active' : ''}`}
        onClick={() => onChange(option.value)}
      >{TabIcon && <TabIcon size={16} aria-hidden="true" />}{option.label}</button>;
    })}
    <span
      className="hc-tabs__indicator"
      aria-hidden="true"
      style={{ width: `${indicator.width}px`, transform: `translateX(${indicator.left}px)`, opacity: indicator.visible ? 1 : 0 }}
    />
  </div>;
}
