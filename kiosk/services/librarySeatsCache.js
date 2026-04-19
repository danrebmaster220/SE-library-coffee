/**
 * Stale-while-revalidate cache for the Study Hall seat screen (seats list + pricing).
 * Prefetch from studyArea.jsx warms cache before navigation.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAvailableSeats, getLibraryPricing } from "./api";

const CACHE_KEY = "@kiosk_library_seat_screen_v1";

/** Max age to still treat disk cache as valid for instant paint (stale OK). */
export const LIBRARY_SEAT_CACHE_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

/**
 * @returns {Promise<{ seats: any[], pricing: object, ts: number } | null>}
 */
export async function readLibrarySeatScreenCache() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.ts !== "number") return null;
    if (Date.now() - parsed.ts > LIBRARY_SEAT_CACHE_MAX_AGE_MS) return null;
    return {
      seats: Array.isArray(parsed.seats) ? parsed.seats : [],
      pricing: parsed.pricing && typeof parsed.pricing === "object" ? parsed.pricing : null,
      ts: parsed.ts,
    };
  } catch {
    return null;
  }
}

export async function writeLibrarySeatScreenCache(seats, pricing) {
  try {
    if (!pricing || typeof pricing !== "object") return;
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        seats: Array.isArray(seats) ? seats : [],
        pricing,
        ts: Date.now(),
      })
    );
  } catch (e) {
    console.warn("librarySeatsCache write failed:", e?.message);
  }
}

/** Fire-and-forget: warm cache while user is on Study Area prompt. */
export function prefetchLibrarySeatScreenData() {
  Promise.all([getAvailableSeats(), getLibraryPricing()])
    .then(([seats, pricing]) => {
      if (!pricing) return;
      const list = seats === null ? [] : seats;
      writeLibrarySeatScreenCache(list, pricing);
    })
    .catch(() => {
      /* ignore — prefetch is best-effort */
    });
}
