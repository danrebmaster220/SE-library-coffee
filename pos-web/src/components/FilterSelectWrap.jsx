import { useState, useRef, useEffect, cloneElement, isValidElement } from 'react';

/**
 * Wrap native <select> elements so a chevron shows and rotates (↓/↑) while the list is open.
 * Uses explicit open state (not :focus-within) so the chevron resets when the dropdown closes
 * even if the <select> keeps focus.
 *
 * Use: <FilterSelectWrap><select className="filter-select" ... /></FilterSelectWrap>
 * Full width (modals): <FilterSelectWrap fullWidth>...</FilterSelectWrap>
 */
export default function FilterSelectWrap({ children, fullWidth = false, className = '' }) {
  const [open, setOpen] = useState(false);
  const blurTimer = useRef(null);

  useEffect(
    () => () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    },
    []
  );

  const clearBlurTimer = () => {
    if (blurTimer.current) {
      clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
  };

  const child = children;
  const enhanced = isValidElement(child)
    ? cloneElement(child, {
        onFocus: (e) => {
          clearBlurTimer();
          setOpen(true);
          child.props.onFocus?.(e);
        },
        onBlur: (e) => {
          child.props.onBlur?.(e);
          clearBlurTimer();
          blurTimer.current = setTimeout(() => {
            setOpen(false);
            blurTimer.current = null;
          }, 120);
        },
        onChange: (e) => {
          child.props.onChange?.(e);
          setOpen(false);
        },
        onKeyDown: (e) => {
          if (e.key === 'Escape') setOpen(false);
          child.props.onKeyDown?.(e);
        },
      })
    : child;

  return (
    <div
      className={[
        'filter-select-wrap',
        open ? 'filter-select-wrap--open' : '',
        fullWidth ? 'filter-select-wrap--full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {enhanced}
    </div>
  );
}
