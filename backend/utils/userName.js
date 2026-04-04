/** Build display full name from parts; ignores empty strings. */
const buildFullName = (first, middle, last) =>
  [first, middle, last]
    .map((s) => (s != null && String(s).trim() !== '' ? String(s).trim() : ''))
    .filter(Boolean)
    .join(' ');

/** Prefer split fields; fall back to legacy full_name column. */
const resolveDisplayName = (row) => {
  if (!row) return '';
  const fromParts = buildFullName(row.first_name, row.middle_name, row.last_name);
  if (fromParts) return fromParts;
  return row.full_name || '';
};

module.exports = { buildFullName, resolveDisplayName };
