// services/api.js
// API service for connecting kiosk to backend

import environment from '../config/environment';

// API URL is now configured in config/environment.js
// To change the URL, edit that file instead
export const API_BASE_URL = environment.API_URL;

// Log current environment on startup (helpful for debugging)
console.log(`🔌 API connecting to: ${API_BASE_URL} (${environment.ENV_NAME})`);

// Helper function for API calls
const fetchAPI = async (endpoint, options = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API Error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
};

// ==========================================
// CATEGORIES API
// ==========================================

/** Public seat list for Study Hall kiosk (array JSON). Returns null on request failure (distinct from empty list). */
export const getAvailableSeats = async () => {
  try {
    const data = await fetchAPI('/library/seats/available');
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error fetching available seats:', error);
    return null;
  }
};

/** Study Hall rate card from server (must match checkout validation). */
export const getLibraryPricing = async () => {
  try {
    const data = await fetchAPI('/library/pricing');
    const out = {
      base_rate: Number(data?.base_rate),
      base_minutes: Number(data?.base_minutes),
      extend_rate: Number(data?.extend_rate),
      extend_minutes: Number(data?.extend_minutes),
    };
    if (
      !Number.isFinite(out.base_rate) ||
      !Number.isFinite(out.base_minutes) ||
      !Number.isFinite(out.extend_rate) ||
      !Number.isFinite(out.extend_minutes)
    ) {
      return null;
    }
    return out;
  } catch (error) {
    console.error('Error fetching library pricing:', error);
    return null;
  }
};

export const getCategories = async () => {
  try {
    const data = await fetchAPI('/menu/categories');
    // Filter only active categories
    const categories = data.categories || data || [];
    return categories.filter(cat => cat.status === 'active');
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
};

// ==========================================
// MENU ITEMS API
// ==========================================

/**
 * @param {string|null} categoryId
 * @param {{ temp?: 'iced'|'hot', size?: 'medium'|'large' }} branch — for card pricing (variant matrix)
 */
export const getMenuItems = async (categoryId = null, branch = {}) => {
  try {
    const params = new URLSearchParams();
    if (categoryId) params.set('category_id', String(categoryId));
    if (branch.temp) params.set('temp', branch.temp);
    if (branch.size) params.set('size', branch.size);
    const qs = params.toString();
    const endpoint = qs ? `/menu/items?${qs}` : '/menu/items';
    const data = await fetchAPI(endpoint);
    const items = data.items || data || [];
    return items.filter(item => item.status === 'available');
  } catch (error) {
    console.error('Error fetching menu items:', error);
    return [];
  }
};

export const getItemsByCategory = async (categoryName) => {
  try {
    // First get all categories to find the ID
    const categories = await getCategories();
    const category = categories.find(
      cat => cat.name.toLowerCase() === categoryName.toLowerCase()
    );
    
    if (!category) {
      console.warn(`Category "${categoryName}" not found`);
      return [];
    }

    return await getMenuItems(category.category_id);
  } catch (error) {
    console.error('Error fetching items by category:', error);
    return [];
  }
};

// ==========================================
// CUSTOMIZATIONS API
// ==========================================

export const getItemCustomizations = async (itemId) => {
  try {
    const data = await fetchAPI(`/customizations/item/${itemId}`);
    return data;
  } catch (error) {
    console.error('Error fetching customizations:', error);
    return { is_customizable: false, groups: [] };
  }
};

// ==========================================
// ORDERS API (for submitting kiosk orders)
// ==========================================

export const submitOrder = async (orderData) => {
  try {
    // Calculate subtotal from items
    const subtotal = Number(orderData.items.reduce((sum, item) => {
      return sum + (item.unit_price * item.quantity);
    }, 0).toFixed(2));

    // Build properly formatted order data for the backend
    const formattedOrderData = {
      order_type: orderData.order_type === 'dine_in' ? 'dine-in' : 'takeout',
      items: orderData.items.map(item => ({
        item_id: item.item_id,
        item_name: item.item_name,
        quantity: item.quantity,
        unit_price: Number((parseFloat(item.unit_price) || 0).toFixed(2)),
        total_price: Number(((parseFloat(item.unit_price) || 0) * item.quantity).toFixed(2)),
        customizations: item.customizations || []
      })),
      subtotal: subtotal,
      total_amount: Number((orderData.total_amount || subtotal).toFixed(2)),
      // Include library booking if present
      library_booking: orderData.library_booking || null,
    };

    const response = await fetchAPI('/pos/kiosk/order', {
      method: 'POST',
      body: JSON.stringify(formattedOrderData),
    });
    return response;
  } catch (error) {
    console.error('Error submitting order:', error);
    throw error;
  }
};

export const getTakeoutCupsStatus = async () => {
  try {
    const data = await fetchAPI('/pos/cups/status');
    return {
      stock: Number(data?.stock ?? 0),
      is_takeout_disabled: Boolean(data?.is_takeout_disabled),
    };
  } catch (error) {
    console.error('Error fetching takeout cup status:', error);
    return {
      stock: 0,
      is_takeout_disabled: true,
    };
  }
};

/** Public VAT label for kiosk UI (matches POS inclusive pricing). */
export const getTaxDisplay = async () => {
  try {
    const data = await fetchAPI('/menu/tax-display');
    return {
      vat_enabled: Boolean(data?.vat_enabled),
      vat_rate_percent: Number(data?.vat_rate_percent) || 0,
    };
  } catch (error) {
    console.error('Error fetching tax display:', error);
    return { vat_enabled: false, vat_rate_percent: 0 };
  }
};

/** VAT-inclusive breakdown for cart total (same rules as POS receipts). */
export const getTaxEstimate = async (totalInclusive) => {
  const params = new URLSearchParams({
    total_incl: Number(totalInclusive || 0).toFixed(2),
  });
  return fetchAPI(`/menu/tax-estimate?${params.toString()}`);
};

export default {
  getCategories,
  getMenuItems,
  getItemsByCategory,
  getItemCustomizations,
  submitOrder,
  getAvailableSeats,
  getTakeoutCupsStatus,
  getTaxDisplay,
  getTaxEstimate,
  getLibraryPricing,
  API_BASE_URL,
};
