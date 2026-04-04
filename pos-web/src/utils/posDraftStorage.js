const VERSION = 1;

function storageKey(userId) {
  return `library_coffee_pos_draft_v${VERSION}_${userId}`;
}

export function getPosDraftUserId() {
  try {
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    return u?.id ?? u?.user_id ?? 'anon';
  } catch {
    return 'anon';
  }
}

/** @returns {null | { cart: unknown[], orderType: unknown, selectedBeeper: unknown, selectedDiscount: unknown, pendingLibraryBooking: unknown }} */
export function loadPosDraft() {
  const uid = getPosDraftUserId();
  try {
    const raw = sessionStorage.getItem(storageKey(uid));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== VERSION || !data.payload) return null;
    return data.payload;
  } catch {
    return null;
  }
}

export function savePosDraft(payload) {
  const uid = getPosDraftUserId();
  try {
    sessionStorage.setItem(storageKey(uid), JSON.stringify({ v: VERSION, payload }));
  } catch (e) {
    console.warn('POS draft save failed', e);
  }
}

export function clearPosDraft() {
  const uid = getPosDraftUserId();
  try {
    sessionStorage.removeItem(storageKey(uid));
  } catch {
    /* ignore */
  }
}
