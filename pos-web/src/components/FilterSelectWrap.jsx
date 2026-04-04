/**
 * Wrap native <select> elements so a chevron shows and rotates (↓/↑) on focus.
 * Use: <FilterSelectWrap><select className="filter-select" ... /></FilterSelectWrap>
 * Full width (modals): <FilterSelectWrap fullWidth>...</FilterSelectWrap>
 */
export default function FilterSelectWrap({ children, fullWidth = false, className = '' }) {
  return (
    <div
      className={['filter-select-wrap', fullWidth ? 'filter-select-wrap--full' : '', className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}
