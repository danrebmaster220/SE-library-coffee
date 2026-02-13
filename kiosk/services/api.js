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

export const getMenuItems = async (categoryId = null) => {
  try {
    const endpoint = categoryId 
      ? `/menu/items?category_id=${categoryId}` 
      : '/menu/items';
    const data = await fetchAPI(endpoint);
    const items = data.items || data || [];
    // Filter only available items
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
    const subtotal = orderData.items.reduce((sum, item) => {
      return sum + (item.unit_price * item.quantity);
    }, 0);

    // Build properly formatted order data for the backend
    const formattedOrderData = {
      order_type: orderData.order_type === 'dine_in' ? 'dine-in' : 'takeout',
      items: orderData.items.map(item => ({
        item_id: item.item_id,
        item_name: item.item_name,
        quantity: item.quantity,
        unit_price: parseFloat(item.unit_price) || 0,
        total_price: (parseFloat(item.unit_price) || 0) * item.quantity,
        customizations: item.customizations || []
      })),
      subtotal: subtotal,
      total_amount: orderData.total_amount || subtotal,
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

// ==========================================
// BEEPERS API
// ==========================================

export const getAvailableBeepers = async () => {
  try {
    const data = await fetchAPI('/pos/beepers/available');
    return data.beepers || data || [];
  } catch (error) {
    console.error('Error fetching beepers:', error);
    return [];
  }
};

export default {
  getCategories,
  getMenuItems,
  getItemsByCategory,
  getItemCustomizations,
  submitOrder,
  getAvailableBeepers,
  API_BASE_URL,
};
