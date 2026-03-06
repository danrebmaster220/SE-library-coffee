import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api from '../api';
import socketService from '../services/socketService';
import Toast from '../components/Toast';
import '../styles/pos.css';

export default function POS() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [cart, setCart] = useState([]);
  const [orderType, setOrderType] = useState(null);
  const [orders, setOrders] = useState({ pending: [], preparing: [], ready: [] });
  const [beepers, setBeepers] = useState([]);
  const [selectedBeeper, setSelectedBeeper] = useState(null);
  const [showBeeperModal, setShowBeeperModal] = useState(false);
  const [discounts, setDiscounts] = useState([]);
  const [selectedDiscount, setSelectedDiscount] = useState(null);
  const [cashAmount, setCashAmount] = useState('');
  const [showCustomization, setShowCustomization] = useState(false);
  const [customizingItem, setCustomizingItem] = useState(null);
  const [customizationGroups, setCustomizationGroups] = useState([]);
  const [selectedCustomizations, setSelectedCustomizations] = useState({});
  const [quantitySelections, setQuantitySelections] = useState({}); // For pump-based options {groupId: {optionId: quantity}}
  const [activeAddonTab, setActiveAddonTab] = useState(null); // For tabbed add-ons
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidingOrder, setVoidingOrder] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [adminCredentials, setAdminCredentials] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Pending order state - when loading a kiosk order for payment
  const [pendingOrderId, setPendingOrderId] = useState(null);
  const [pendingOrderBeeper, setPendingOrderBeeper] = useState(null);
  const [pendingLibraryBooking, setPendingLibraryBooking] = useState(null); // Library booking from kiosk order
  
  // Item removal modal state (for kiosk orders)
  const [showItemRemovalModal, setShowItemRemovalModal] = useState(false);
  const [removingItem, setRemovingItem] = useState(null); // { itemId, action: 'remove' | 'decrease', itemName }
  const [itemRemovalCredentials, setItemRemovalCredentials] = useState({ username: '', password: '' });
  const [itemRemovalReason, setItemRemovalReason] = useState('');
  
  // Confirmation modal state (for POS direct orders)
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // { type: 'remove', itemId, itemName }
  
  // Order search state
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  
  // Ref for pos-container to force correct height in cashier mode
  const posContainerRef = useRef(null);
  
  // Toast notification state
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });

  // Toast notification function
  const showToast = useCallback((message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 3000);
  }, []);

  // Define fetch functions BEFORE useEffect that uses them
  const fetchMenuData = useCallback(async () => {
    try {
      const [itemsRes, catsRes] = await Promise.all([
        api.get('/menu/items'),
        api.get('/menu/categories')
      ]);
      setMenuItems(itemsRes.data);
      // Filter to only show active categories in POS
      const activeCategories = catsRes.data.filter(cat => cat.status === 'active');
      setCategories(activeCategories);
      // Auto-select first active category using category_id from database
      if (activeCategories.length > 0) setSelectedCategory(activeCategories[0].category_id);
    } catch (err) {
      console.error('Failed to fetch menu:', err);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const [pendingRes, preparingRes, readyRes] = await Promise.all([
        api.get('/pos/orders/pending'),
        api.get('/pos/orders/preparing'),
        api.get('/pos/orders/ready')
      ]);
      setOrders({
        pending: pendingRes.data,
        preparing: preparingRes.data,
        ready: readyRes.data
      });
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    }
  }, []);

  const fetchBeepers = useCallback(async () => {
    try {
      const res = await api.get('/pos/beepers');
      setBeepers(res.data);
    } catch (err) {
      console.error('Failed to fetch beepers:', err);
    }
  }, []);

  const fetchDiscounts = useCallback(async () => {
    try {
      const res = await api.get('/discounts/active');
      setDiscounts(res.data);
    } catch (err) {
      console.error('Failed to fetch discounts:', err);
    }
  }, []);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    setCurrentUser(user);
    // Check if user is admin (role_id = 1)
    setIsAdmin(user?.role_id === 1);
    fetchMenuData();
    fetchOrders();
    fetchBeepers();
    fetchDiscounts();

    // Connect to Socket.IO for real-time beeper updates
    socketService.connect();
    socketService.onBeepersUpdate((data) => {
      console.log('🔔 Real-time beeper update:', data);
      // Refresh beepers list when any beeper status changes
      fetchBeepers();
    });

    const interval = setInterval(fetchOrders, 5000);
    return () => {
      clearInterval(interval);
      socketService.removeListener('beepers:update');
    };
  }, [fetchMenuData, fetchOrders, fetchBeepers, fetchDiscounts]);

  // Force correct height for cashier mode on resize
  useEffect(() => {
    const el = posContainerRef.current;
    if (!el) return;
    
    const isCashier = !!el.closest('.cashier-layout');
    if (!isCashier) return;
    
    const setHeight = () => {
      const topbar = document.querySelector('.cashier-topbar');
      const topbarH = topbar ? topbar.getBoundingClientRect().height : 60;
      const h = window.innerHeight - topbarH;
      el.style.height = h + 'px';
      el.style.maxHeight = h + 'px';
      el.style.minHeight = '0';
    };
    
    setHeight();
    window.addEventListener('resize', setHeight);
    return () => window.removeEventListener('resize', setHeight);
  }, []);

  // Fetch barista defaults (Size/Temp) + any add-on groups
  const fetchBaristaDefaults = async (itemId) => {
    try {
      const res = await api.get(`/customizations/barista-defaults/${itemId}`);
      return res.data;
    } catch (err) {
      console.error('Failed to fetch barista defaults:', err);
      return { needs_size_temp: false, size_options: [], temp_options: [], addon_groups: [] };
    }
  };

  const handleAddItem = async (item) => {
    if (!orderType) {
      showToast('Please select Dine In or Take Out first!', 'warning');
      return;
    }
    
    // For barista items, check what customizations are linked to this item
    if (item.station === 'barista') {
      const baristaData = await fetchBaristaDefaults(item.item_id);
      
      // Build customization groups from what's actually linked to the item
      const groups = [];
      
      // Add Size group if linked to item
      if (baristaData.size_group && baristaData.size_group.options?.length > 0) {
        groups.push({
          ...baristaData.size_group,
          is_required: baristaData.size_group.is_required ?? false
        });
      }
      
      // Add Temperature group if linked to item
      if (baristaData.temp_group && baristaData.temp_group.options?.length > 0) {
        groups.push({
          ...baristaData.temp_group,
          is_required: baristaData.temp_group.is_required ?? false
        });
      }
      
      // Add any add-on groups
      if (baristaData.addon_groups && baristaData.addon_groups.length > 0) {
        groups.push(...baristaData.addon_groups);
      }
      
      // If there are any customization groups, show the modal
      if (groups.length > 0) {
        // No auto-selection - let user choose
        const defaults = {};
        
        setCustomizingItem(item);
        setCustomizationGroups(groups);
        setSelectedCustomizations(defaults);
        setShowCustomization(true);
        return;
      }
      
      // No customization linked - add directly to cart
      const cartItem = {
        id: Date.now(),
        item_id: item.item_id,
        name: item.name,
        base_price: parseFloat(item.price),
        customizations: [],
        customization_total: 0,
        total_price: parseFloat(item.price),
        quantity: 1
      };
      setCart(prev => [...prev, cartItem]);
      showToast(`${item.name} added to cart`, 'success');
      return;
    }
    
    // For non-barista items - check if item has customizations
    try {
      const res = await api.get(`/customizations/item/${item.item_id}`);
      const groups = res.data.groups || [];
      const isCustomizable = res.data.is_customizable;
      
      if (isCustomizable && groups.length > 0) {
        setCustomizingItem(item);
        setCustomizationGroups(groups);
        // No auto-selection - let user choose
        const defaults = {};
        setSelectedCustomizations(defaults);
        setShowCustomization(true);
        return;
      }
    } catch (err) {
      console.error('Failed to fetch customizations:', err);
    }
    
    // No customization needed - add directly to cart
    const cartItem = {
      id: Date.now(),
      item_id: item.item_id,
      name: item.name,
      base_price: parseFloat(item.price),
      customizations: [],
      customization_total: 0,
      total_price: parseFloat(item.price),
      quantity: 1
    };
    setCart(prev => [...prev, cartItem]);
    showToast(`${item.name} added to cart`, 'success');
  };

  const handleCustomizationChange = (groupId, optionId, isMultiple) => {
    setSelectedCustomizations(prev => {
      if (isMultiple) {
        const current = prev[groupId] || [];
        if (current.includes(optionId)) {
          return { ...prev, [groupId]: current.filter(id => id !== optionId) };
        } else {
          return { ...prev, [groupId]: [...current, optionId] };
        }
      } else {
        return { ...prev, [groupId]: [optionId] };
      }
    });
  };

  // Handle quantity-based options (pumps for Syrup/Sauces)
  const handleQuantityChange = (groupId, optionId, change) => {
    setQuantitySelections(prev => {
      const groupQty = prev[groupId] || {};
      const currentQty = groupQty[optionId] || 0;
      const newQty = Math.max(0, Math.min(currentQty + change, 10));
      
      return {
        ...prev,
        [groupId]: {
          ...groupQty,
          [optionId]: newQty
        }
      };
    });
  };

  const getOptionQuantity = (groupId, optionId) => {
    return quantitySelections[groupId]?.[optionId] || 0;
  };

  // Get count for badge (quantity-based or regular)
  const getAddonCount = (group) => {
    const groupId = group.group_id || group.id;
    if (group.input_type === 'quantity') {
      // Sum of all quantities
      const groupQty = quantitySelections[groupId] || {};
      return Object.values(groupQty).reduce((sum, qty) => sum + qty, 0);
    } else {
      // Count of selected options
      return (selectedCustomizations[groupId] || []).length;
    }
  };

  const confirmCustomization = () => {
    if (!customizingItem) return;
    
    // Validate required customization groups
    const requiredGroups = customizationGroups.filter(g => g.is_required);
    const missingRequired = [];
    
    requiredGroups.forEach(group => {
      const groupId = group.group_id || group.id;
      const hasSelection = (selectedCustomizations[groupId] || []).length > 0;
      if (!hasSelection) {
        missingRequired.push(group.name);
      }
    });
    
    if (missingRequired.length > 0) {
      showToast(`Please select: ${missingRequired.join(', ')}`, 'error');
      return;
    }
    
    const customizations = [];
    let customizationTotal = 0;
    
    // Process regular selections (choice-based)
    Object.entries(selectedCustomizations).forEach(([groupId, optionIds]) => {
      const group = customizationGroups.find(g => (g.group_id || g.id) === parseInt(groupId));
      if (group && group.input_type !== 'quantity') {
        optionIds.forEach(optId => {
          const option = group.options.find(o => (o.option_id || o.id) === optId);
          if (option) {
            const optPrice = parseFloat(option.price || option.price_per_unit) || 0;
            customizations.push({
              group_id: group.group_id || group.id,
              group_name: group.name,
              option_id: option.option_id || option.id,
              option_name: option.name,
              price: optPrice,
              quantity: 1
            });
            customizationTotal += optPrice;
          }
        });
      }
    });

    // Process quantity-based selections (pumps)
    Object.entries(quantitySelections).forEach(([groupId, optionQtys]) => {
      const group = customizationGroups.find(g => (g.group_id || g.id) === parseInt(groupId));
      if (group) {
        Object.entries(optionQtys).forEach(([optId, qty]) => {
          if (qty > 0) {
            const option = group.options.find(o => (o.option_id || o.id) === parseInt(optId));
            if (option) {
              const pricePerUnit = parseFloat(option.price_per_unit || option.price) || 0;
              customizations.push({
                group_id: group.group_id || group.id,
                group_name: group.name,
                option_id: option.option_id || option.id,
                option_name: `${option.name} x${qty}`,
                price: pricePerUnit * qty,
                quantity: qty
              });
              customizationTotal += pricePerUnit * qty;
            }
          }
        });
      }
    });

    const cartItem = {
      id: Date.now(),
      item_id: customizingItem.item_id,
      name: customizingItem.name,
      base_price: parseFloat(customizingItem.price),
      customizations,
      customization_total: customizationTotal,
      total_price: parseFloat(customizingItem.price) + customizationTotal,
      quantity: 1
    };

    setCart(prev => [...prev, cartItem]);
    setShowCustomization(false);
    setCustomizingItem(null);
    setSelectedCustomizations({});
    setQuantitySelections({});
  };

  // Direct remove from cart (used after auth/confirmation)
  const removeFromCart = (cartItemId) => {
    setCart(prev => prev.filter(item => item.id !== cartItemId));
  };

  // Direct update quantity (used after auth/confirmation)
  const updateQuantity = (cartItemId, delta) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === cartItemId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) {
            return null; // Mark for removal
          }
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter(item => item !== null);
    });
  };

  // Handle library booking removal
  const handleRemoveLibraryBooking = () => {
    if (pendingOrderId) {
      // Kiosk order - require admin auth
      setRemovingItem({ 
        itemId: 'library-booking', 
        action: 'remove-library', 
        name: 'Study Area Booking',
        libraryBooking: pendingLibraryBooking
      });
      setItemRemovalCredentials({ username: '', password: '' });
      setItemRemovalReason('');
      setShowItemRemovalModal(true);
    } else {
      // POS direct order - simple confirmation
      setConfirmAction({ 
        action: 'remove-library', 
        name: 'Study Area Booking'
      });
      setShowConfirmModal(true);
    }
  };

  // Handle item removal with proper auth flow
  const handleRemoveItem = (item) => {
    if (pendingOrderId) {
      // Kiosk order - require admin auth
      setRemovingItem({ itemId: item.id, action: 'remove', name: item.name, size: item.size, quantity: item.quantity });
      setItemRemovalCredentials({ username: '', password: '' });
      setItemRemovalReason('');
      setShowItemRemovalModal(true);
    } else {
      // POS direct order - simple confirmation
      setConfirmAction({ action: 'remove', itemId: item.id, name: item.name, size: item.size, quantity: item.quantity });
      setShowConfirmModal(true);
    }
  };

  // Handle quantity decrease with proper auth flow
  const handleDecreaseQuantity = (item) => {
    if (pendingOrderId) {
      // Kiosk order - require admin auth for any decrease
      setRemovingItem({ itemId: item.id, action: 'decrease', name: item.name, size: item.size, quantity: item.quantity });
      setItemRemovalCredentials({ username: '', password: '' });
      setItemRemovalReason('');
      setShowItemRemovalModal(true);
    } else {
      // POS direct order
      if (item.quantity > 1) {
        // Quantity > 1: Decrease directly without confirmation
        updateQuantity(item.id, -1);
        showToast(`Decreased quantity of ${item.name}`, 'success');
      } else {
        // Quantity = 1: Show confirmation (will remove item)
        setConfirmAction({ action: 'decrease', itemId: item.id, name: item.name, size: item.size, quantity: item.quantity });
        setShowConfirmModal(true);
      }
    }
  };

  // Handle quantity increase
  const handleIncreaseQuantity = (item) => {
    if (pendingOrderId) {
      // Kiosk order - don't allow adding more than customer ordered
      showToast('Cannot add more items to kiosk order', 'warning');
    } else {
      // POS direct order - direct increase
      updateQuantity(item.id, 1);
    }
  };

  // Process item removal after admin auth (for kiosk orders)
  const processItemRemovalWithAuth = async () => {
    if (!itemRemovalCredentials.username || !itemRemovalCredentials.password) {
      showToast('Please enter admin credentials', 'warning');
      return;
    }
    if (!itemRemovalReason) {
      showToast('Please select a reason', 'warning');
      return;
    }

    try {
      // Verify admin credentials
      const response = await api.post('/auth/verify-admin', {
        username: itemRemovalCredentials.username,
        password: itemRemovalCredentials.password
      });

      if (response.data.valid) {
        // Perform the action
        if (removingItem.action === 'remove') {
          removeFromCart(removingItem.itemId);
          showToast(`Removed ${removingItem.name} from order`, 'success');
        } else if (removingItem.action === 'decrease') {
          updateQuantity(removingItem.itemId, -1);
          showToast(`Decreased ${removingItem.name} quantity`, 'success');
        } else if (removingItem.action === 'remove-library') {
          setPendingLibraryBooking(null);
          showToast('Removed Study Area Booking from order', 'success');
        }
        
        // Close modal and reset
        setShowItemRemovalModal(false);
        setRemovingItem(null);
        setItemRemovalCredentials({ username: '', password: '' });
        setItemRemovalReason('');
      } else {
        showToast('Invalid admin credentials', 'error');
      }
    } catch (err) {
      showToast('Authentication failed', 'error');
    }
  };

  // Process item removal after confirmation (for POS direct orders)
  const confirmItemRemoval = () => {
    if (confirmAction.action === 'remove') {
      removeFromCart(confirmAction.itemId);
      showToast(`Removed ${confirmAction.name} from cart`, 'success');
    } else if (confirmAction.action === 'decrease') {
      updateQuantity(confirmAction.itemId, -1);
      showToast(`Decreased quantity of ${confirmAction.name}`, 'success');
    } else if (confirmAction.action === 'clear') {
      resetOrder();
      showToast('Cart cleared', 'success');
    } else if (confirmAction.action === 'remove-library') {
      setPendingLibraryBooking(null);
      showToast('Removed Study Area Booking', 'success');
    }
    setShowConfirmModal(false);
    setConfirmAction(null);
  };

  // Memoized calculations to prevent recalculation on every render
  const subtotal = useMemo(() => {
    const itemsTotal = cart.reduce((sum, item) => sum + (item.total_price * item.quantity), 0);
    const libraryTotal = pendingLibraryBooking ? pendingLibraryBooking.amount : 0;
    return itemsTotal + libraryTotal;
  }, [cart, pendingLibraryBooking]);

  const itemsOnlyTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.total_price * item.quantity), 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    if (!selectedDiscount) return 0;
    return subtotal * (parseFloat(selectedDiscount.percentage) / 100);
  }, [selectedDiscount, subtotal]);

  const total = useMemo(() => {
    return subtotal - discountAmount;
  }, [subtotal, discountAmount]);

  const change = useMemo(() => {
    const cash = parseFloat(cashAmount) || 0;
    return Math.max(0, cash - total);
  }, [cashAmount, total]);

  // Keep old function names for backward compatibility but use memoized values
  const calculateSubtotal = useCallback(() => subtotal, [subtotal]);
  const calculateItemsOnly = useCallback(() => itemsOnlyTotal, [itemsOnlyTotal]);
  const calculateDiscount = useCallback(() => discountAmount, [discountAmount]);
  const calculateTotal = useCallback(() => total, [total]);
  const calculateChange = useCallback(() => change, [change]);

  // Memoized filtered menu items by category
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter(item => 
      item.category_id === selectedCategory && item.status === 'available'
    );
  }, [menuItems, selectedCategory]);

  // Memoized available beepers
  const availableBeepers = useMemo(() => {
    return beepers.filter(b => b.status === 'available');
  }, [beepers]);

  // Memoized in-use beepers count
  const inUseBeepersCount = useMemo(() => {
    return beepers.filter(b => b.status === 'in-use').length;
  }, [beepers]);

  // Memoized filtered orders by search query
  const filteredPendingOrders = useMemo(() => {
    if (!orderSearchQuery.trim()) return orders.pending;
    const searchNum = orderSearchQuery.trim().replace('#', '').toLowerCase();
    return orders.pending.filter(order => {
      const beeperNum = order.beeper_number?.toString() || '';
      const orderNum = order.order_number?.toString() || '';
      return beeperNum.includes(searchNum) || orderNum.includes(searchNum);
    });
  }, [orders.pending, orderSearchQuery]);

  const handleQuickCash = useCallback((amount) => {
    setCashAmount(prev => {
      const current = parseFloat(prev) || 0;
      return String(current + amount);
    });
  }, []);

  const clearCash = useCallback(() => {
    setCashAmount('');
  }, []);

  const handlePayment = async () => {
    if (!orderType) {
      showToast('Please select order type first!', 'warning');
      return;
    }
    // For pending orders, beeper is already assigned
    if (!pendingOrderId && !selectedBeeper) {
      showToast('Please select a beeper number!', 'warning');
      return;
    }
    // Allow payment if there's a cart, pending order, or library booking
    if (cart.length === 0 && !pendingOrderId && !pendingLibraryBooking) {
      showToast('Cart is empty!', 'warning');
      return;
    }
    const total = calculateTotal();
    const cash = parseFloat(cashAmount) || 0;
    if (cash < total) {
      showToast('Insufficient cash amount!', 'error');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const subtotal = calculateSubtotal();
      const discountAmt = calculateDiscount();
      const total = calculateTotal();
      const cash = parseFloat(cashAmount) || 0;
      const change = cash - total;

      let transactionId;

      // Check if processing a pending kiosk order
      if (pendingOrderId) {
        await api.put(`/pos/transactions/${pendingOrderId}/pay`, {
          discount_id: selectedDiscount?.discount_id || null,
          discount_amount: discountAmt,
          cash_tendered: cash,
          change_due: change
        });
        transactionId = pendingOrderId;
        showToast(`Payment successful for Order #${pendingOrderBeeper}!`, 'success');
      } else {
        const items = cart.map(item => ({
          item_id: item.item_id,
          item_name: item.name,
          quantity: item.quantity,
          unit_price: item.base_price,
          total_price: item.total_price * item.quantity,
          customizations: item.customizations.map(c => ({
            option_id: c.option_id,
            option_name: c.option_name || c.name,
            group_name: c.group_name || '',
            quantity: c.quantity || 1,
            unit_price: c.price,
            total_price: c.price * (c.quantity || 1)
          }))
        }));

        const response = await api.post('/pos/transactions', {
          order_type: orderType === 'dine_in' ? 'dine-in' : 'takeout',
          beeper_id: selectedBeeper,
          items,
          subtotal: subtotal,
          discount_id: selectedDiscount?.discount_id || null,
          discount_amount: discountAmt,
          total_amount: total,
          cash_tendered: cash,
          change_due: change,
          status: 'preparing'
        });
        transactionId = response.data.transaction_id;
        showToast('Payment successful!', 'success');
      }

      // Print receipt after successful payment
      if (transactionId) {
        try {
          await api.post(`/printer/receipt/${transactionId}`);
          console.log('Receipt printed successfully');
        } catch (printError) {
          console.error('Failed to print receipt:', printError);
          // Don't fail the payment if printing fails
        }
      }

      showToast('Payment successful!', 'success');
      resetOrder();
      fetchOrders();
      fetchBeepers();
    } catch (err) {
      console.error('Payment failed:', err);
      setError(err.response?.data?.error || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  const resetOrder = () => {
    setCart([]);
    setOrderType(null);
    setSelectedBeeper(null);
    setSelectedDiscount(null);
    setCashAmount('');
    setPendingOrderId(null);
    setPendingOrderBeeper(null);
    setPendingLibraryBooking(null);
  };

  const handleStartPreparing = async (order) => {
    try {
      await api.put(`/pos/order/${order.id}/preparing`);
      fetchOrders();
    } catch (err) {
      console.error('Failed to start preparing:', err);
    }
  };

  
  // Load pending kiosk order into cart for payment
  const loadPendingOrder = (order) => {
    setCart([]);
    setSelectedDiscount(null);
    setCashAmount('');
    setOrderType(order.order_type === 'dine-in' ? 'dine_in' : 'takeout');
    setPendingOrderId(order.id || order.transaction_id);
    setPendingOrderBeeper(order.beeper_number);
    
    // Parse and set library booking if exists
    if (order.library_booking) {
      try {
        const booking = typeof order.library_booking === 'string' 
          ? JSON.parse(order.library_booking) 
          : order.library_booking;
        setPendingLibraryBooking(booking);
      } catch (e) {
        console.error('Error parsing library booking:', e);
        setPendingLibraryBooking(null);
      }
    } else {
      setPendingLibraryBooking(null);
    }
    
    if (order.items && order.items.length > 0) {
      const cartItems = order.items.map((item, idx) => {
        const customizations = item.customizations || [];
        const customizationTotal = customizations.reduce((sum, c) => sum + (parseFloat(c.total_price) || 0), 0);
        const basePrice = parseFloat(item.base_price) || parseFloat(item.unit_price) - customizationTotal / item.quantity;
        return {
          id: Date.now() + idx,
          item_id: item.item_id,
          name: item.item_name || item.item_name_db,
          base_price: basePrice,
          customizations: customizations.map(c => ({
            group_id: c.group_id,
            group_name: c.group_name,
            option_id: c.option_id,
            option_name: c.option_name,
            price: parseFloat(c.unit_price) || 0,
            quantity: c.quantity || 1
          })),
          customization_total: customizationTotal,
          total_price: parseFloat(item.unit_price),
          quantity: item.quantity
        };
      });
      setCart(cartItems);
    }
    showToast(`Loaded order #${order.beeper_number} for payment`, 'success');
  };

  const clearPendingOrder = () => {
    setPendingOrderId(null);
    setPendingOrderBeeper(null);
    setPendingLibraryBooking(null);
    setCart([]);
    setOrderType(null);
    setSelectedDiscount(null);
    setCashAmount('');
  };

  const handleMarkReady = async (order) => {
    try {
      await api.put(`/pos/orders/${order.id}/ready`);
      fetchOrders();
    } catch (err) {
      console.error('Failed to mark ready:', err);
    }
  };

  const handleComplete = async (order) => {
    try {
      await api.put(`/pos/orders/${order.id}/complete`);
      fetchOrders();
      fetchBeepers();
    } catch (err) {
      console.error('Failed to complete order:', err);
    }
  };

  const openVoidModal = (order) => {
    setVoidingOrder(order);
    setVoidReason('');
    setAdminCredentials({ username: '', password: '' });
    setShowVoidModal(true);
  };

  const handleVoid = async () => {
    if (!voidingOrder) return;
    if (!voidReason.trim()) {
      setError('Please enter a reason for voiding this order');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const voidData = { reason: voidReason.trim() };
      
      if (currentUser?.role === 'admin') {
        await api.post(`/pos/transactions/${voidingOrder.id}/void`, voidData);
      } else {
        const authRes = await api.post('/auth/verify-admin', adminCredentials);
        if (authRes.data.valid) {
          await api.post(`/pos/transactions/${voidingOrder.id}/void`, voidData);
        } else {
          throw new Error('Invalid admin credentials');
        }
      }
      showToast('Order voided successfully', 'success');
      setShowVoidModal(false);
      setVoidingOrder(null);
      setVoidReason('');
      setAdminCredentials({ username: '', password: '' });
      fetchOrders();
      fetchBeepers();
    } catch (err) {
      console.error('Void failed:', err);
      setError(err.response?.data?.error || err.message || 'Void failed');
    } finally {
      setLoading(false);
    }
  };

  // Search for pending order by beeper number and load it
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  const handleOrderSearchSelect = (order) => {
    loadPendingOrder(order);
    setOrderSearchQuery('');
    setShowSearchDropdown(false);
    showToast(`Order #${order.beeper_number || order.order_number} loaded`, 'success');
  };

  const handleOrderSearchKeyDown = (e) => {
    if (e.key === 'Enter' && orderSearchQuery.trim()) {
      const searchNum = orderSearchQuery.trim().replace('#', '');
      const foundOrder = orders.pending.find(
        order => order.beeper_number?.toString() === searchNum || 
                 order.order_number?.toString() === searchNum
      );
      
      if (foundOrder) {
        handleOrderSearchSelect(foundOrder);
      } else {
        showToast(`No pending order found with #${searchNum}`, 'warning');
      }
    } else if (e.key === 'Escape') {
      setShowSearchDropdown(false);
      setOrderSearchQuery('');
    }
  };

  return (
    <div className="pos-container" ref={posContainerRef}>
      {/* Left Panel - Order Queue */}
      <div className="pos-orders-panel">
        <h2>Order Queue</h2>
        
        {/* Search Bar with Dropdown */}
        <div className="order-search-container">
          <div className="order-search-wrapper">
            <svg className="order-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              type="text"
              className="order-search-input"
              placeholder="Search order #..."
              value={orderSearchQuery}
              onChange={(e) => setOrderSearchQuery(e.target.value)}
              onFocus={() => setShowSearchDropdown(true)}
              onKeyDown={handleOrderSearchKeyDown}
            />
          </div>
          
          {/* Search Dropdown */}
          {showSearchDropdown && (
            <div className="order-search-dropdown">
              <div className="search-dropdown-header">
                {orderSearchQuery.trim() 
                  ? `Results (${filteredPendingOrders.length})`
                  : `All Pending Orders (${orders.pending.length})`
                }
              </div>
              <div className="search-dropdown-list">
                {filteredPendingOrders.length > 0 ? (
                  filteredPendingOrders.map(order => (
                    <div 
                      key={order.id} 
                      className="search-dropdown-item"
                      onClick={() => handleOrderSearchSelect(order)}
                    >
                      <span className="dropdown-order-num">#{order.beeper_number || order.order_number}</span>
                      <span className="dropdown-order-type">{order.order_type}</span>
                      <span className="dropdown-order-total">₱{parseFloat(order.total_amount).toFixed(2)}</span>
                    </div>
                  ))
                ) : (
                  <div className="search-dropdown-empty">No matching orders found</div>
                )}
              </div>
            </div>
          )}
          
          {/* Click outside to close */}
          {showSearchDropdown && (
            <div 
              className="search-dropdown-overlay" 
              onClick={() => setShowSearchDropdown(false)}
            />
          )}
        </div>
        
        <div className="order-section">
          <h3>Pending ({orders.pending.length})</h3>
          <div className="order-list">
            {orders.pending.map(order => (
              <div 
                key={order.id} 
                className={`order-card pending ${pendingOrderId === order.id ? "selected" : ""}`}
                onClick={() => loadPendingOrder(order)}
                style={{ cursor: "pointer" }}
              >
                <div className="order-header">
                  <span className="beeper-badge">#{order.beeper_number}</span>
                  <span className="order-type">{order.order_type}</span>
                </div>
                {isAdmin && order.processed_by_name && (
                  <div className="processed-by-label">By: {order.processed_by_name}</div>
                )}
                {isAdmin && !order.processed_by_name && (
                  <div className="processed-by-label kiosk">From Kiosk</div>
                )}
                <div className="order-items-preview">
                  {order.items?.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="item-preview">
                      <span>{item.quantity}x {item.item_name}</span>
                      {item.customizations?.length > 0 && (
                        <span className="customization-count">+{item.customizations.length} options</span>
                      )}
                    </div>
                  ))}
                  {order.items?.length > 3 && (
                    <div className="more-items">+{order.items.length - 3} more items</div>
                  )}
                </div>
                <div className="order-total">P{parseFloat(order.total_amount).toFixed(2)}</div>
                <div className="order-actions">
                  <button onClick={(e) => { e.stopPropagation(); loadPendingOrder(order); }} className="btn-select">Select for Payment</button>
                  <button onClick={(e) => { e.stopPropagation(); openVoidModal(order); }} className="btn-void">Void</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="order-section">
          <h3>Preparing ({orders.preparing.length})</h3>
          <div className="order-list">
            {orders.preparing.map(order => (
              <div key={order.id} className="order-card preparing">
                <div className="order-number-large">#{order.beeper_number || order.order_number}</div>
                {isAdmin && order.processed_by_name && (
                  <div className="processed-by-label">By: {order.processed_by_name}</div>
                )}
                <div className="order-info">
                  <span className="order-total">₱{parseFloat(order.total_amount).toFixed(2)}</span>
                  <span className="order-type">{order.order_type}</span>
                </div>
                <div className="order-actions">
                  <button onClick={() => handleMarkReady(order)} className="btn-ready">Ready</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="order-section">
          <h3>Ready ({orders.ready.length})</h3>
          <div className="order-list">
            {orders.ready.map(order => (
              <div key={order.id} className="order-card ready">
                <div className="order-number-large">#{order.beeper_number || order.order_number}</div>
                {isAdmin && order.processed_by_name && (
                  <div className="processed-by-label">By: {order.processed_by_name}</div>
                )}
                <div className="order-info">
                  <span className="order-total">₱{parseFloat(order.total_amount).toFixed(2)}</span>
                  <span className="order-type">{order.order_type}</span>
                </div>
                <div className="order-actions">
                  <button onClick={() => handleComplete(order)} className="btn-complete">Complete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Center Panel - Menu */}
      <div className="pos-menu-panel">
        <div className="menu-section">
          <h3 className="section-label">Categories</h3>
          <div className="category-tabs">
            {categories.length === 0 ? (
              <div className="empty-message">No categories found</div>
            ) : (
              categories.map(cat => (
                <button
                  key={cat.category_id}
                  className={`category-tab ${selectedCategory === cat.category_id ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat.category_id)}
                >
                  {cat.name}
                </button>
              ))
            )}
          </div>
        </div>
        
        <div className="menu-section">
          <h3 className="section-label">Menu Items</h3>
          <div className="menu-grid">
            {filteredMenuItems.length === 0 ? (
              <div className="empty-message">No items in this category</div>
            ) : (
              filteredMenuItems.map(item => (
                <div
                  key={item.item_id}
                  className={`menu-item ${item.status !== 'available' ? 'unavailable' : ''}`}
                  onClick={() => item.status === 'available' && handleAddItem(item)}
                >
                  {item.image && <img src={item.image} alt={item.name} className="item-image" />}
                  <div className="item-name">{item.name}</div>
                  <div className="item-price">₱{parseFloat(item.price).toFixed(2)}</div>
                  {item.status !== 'available' && <div className="unavailable-badge">Unavailable</div>}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Right Panel - Cart */}
      {/* Right Panel - Cart */}
      <div className="pos-cart-panel">
        <div className="cart-header">
          <h2>
            {pendingOrderId ? (
              <span className="pending-order-header">
                <span className="pending-badge">KIOSK ORDER</span>
                Order #{pendingOrderBeeper}
              </span>
            ) : (
              "Current Order"
            )}
          </h2>
          {/* Only show Clear button for POS direct orders, not for kiosk orders */}
          {!pendingOrderId && cart.length > 0 && (
            <button 
              onClick={() => {
                setConfirmAction({ action: 'clear', itemCount: cart.length });
                setShowConfirmModal(true);
              }} 
              className="btn-clear-order"
            >
              Clear
            </button>
          )}
        </div>

        {/* Cart Body - wraps scrollable content + payment for proper overflow handling */}
        <div className="cart-body">
        {/* Scrollable Cart Content */}
        <div className="cart-scrollable-content">
          {/* Order Type Selection - FIRST STEP */}
        <div className="order-type-selection">
          <label>Order Type:</label>
          <div className="order-type-buttons">
            <button
              className={`order-type-btn ${orderType === 'dine_in' ? 'active' : ''}`}
              onClick={() => !pendingOrderId && setOrderType('dine_in')}
              disabled={pendingOrderId}
            >
              Dine In
            </button>
            <button
              className={`order-type-btn ${orderType === 'takeout' || orderType === 'take_out' ? 'active' : ''}`}
              onClick={() => !pendingOrderId && setOrderType('take_out')}
              disabled={pendingOrderId}
            >
              Take Out
            </button>
          </div>
        </div>

        {/* Beeper Selection - Button that opens modal (hidden for pending orders) */}
        {!pendingOrderId && (
          <div className="beeper-selection required">
          <label>Order Number: <span className="required-mark">*</span></label>
          <button 
            className={`beeper-select-btn ${selectedBeeper ? 'has-selection' : ''}`}
            onClick={() => setShowBeeperModal(true)}
          >
            {selectedBeeper ? (
              <span className="beeper-selected">
                <span className="beeper-icon">🔔</span>
                <span>Order #{beepers.find(b => (b.beeper_id || b.beeper_number) === selectedBeeper)?.beeper_number || selectedBeeper}</span>
              </span>
            ) : (
              <span className="beeper-placeholder">Select Order #</span>
            )}
            <span className="beeper-arrow">▼</span>
          </button>
          <div className="beeper-status-hint">
            <span className="available-count">
              {availableBeepers.length} available
            </span>
            <span className="separator">•</span>
            <span className="in-use-count">
              {inUseBeepersCount} in use
            </span>
          </div>
          </div>
        )}

        {/* Cart Items */}
        <div className="cart-items">
          {/* Library Booking Display */}
          {pendingLibraryBooking && (
            <div className="library-booking-card">
              <div className="library-booking-header">
                <span className="library-icon">📚</span>
                <span className="library-title">Study Area Booking</span>
                <button 
                  className="btn-remove-library" 
                  onClick={handleRemoveLibraryBooking}
                  title="Remove booking"
                >×</button>
              </div>
              <div className="library-booking-details">
                <p><strong>Customer:</strong> {pendingLibraryBooking.customer_name}</p>
                <p><strong>Location:</strong> Table {pendingLibraryBooking.table_number}, Seat {pendingLibraryBooking.seat_number}</p>
                <p><strong>Duration:</strong> {Math.floor(pendingLibraryBooking.duration_minutes / 60)}h {pendingLibraryBooking.duration_minutes % 60}m</p>
              </div>
              <div className="library-booking-price">
                ₱{pendingLibraryBooking.amount.toFixed(2)}
              </div>
            </div>
          )}
          
          {cart.length === 0 && !pendingLibraryBooking ? (
            <div className="cart-empty">No items in cart</div>
          ) : cart.length === 0 ? (
            <div className="cart-empty-items">No food/drink items</div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="cart-item">
                <div className="cart-item-header">
                  <span className="cart-item-name">{item.name}</span>
                  <button onClick={() => handleRemoveItem(item)} className="btn-remove" title="Remove item">×</button>
                </div>
                {item.customizations && item.customizations.length > 0 && (
                  <div className="cart-item-customizations">
                    {item.customizations.map((c, i) => (
                      <span key={i} className="customization-tag">
                        {c.option_name} {c.price > 0 && `+₱${c.price.toFixed(2)}`}
                      </span>
                    ))}
                  </div>
                )}
                <div className="cart-item-footer">
                  <div className="quantity-controls">
                    <button 
                      onClick={() => handleDecreaseQuantity(item)}
                      className={pendingOrderId ? 'qty-btn-auth' : ''}
                    >-</button>
                    <span>{item.quantity}</span>
                    <button 
                      onClick={() => handleIncreaseQuantity(item)}
                      disabled={pendingOrderId}
                      className={pendingOrderId ? 'qty-btn-disabled' : ''}
                    >+</button>
                  </div>
                  <span className="cart-item-total">₱{(item.total_price * item.quantity).toFixed(2)}</span>
                </div>
              </div>
            ))
          )}
        </div>
        </div>{/* End of cart-scrollable-content */}

        {/* Sticky Payment Section */}
        <div className="cart-payment-section">
          {/* Discount Selection */}
          <div className="discount-selection">
            <label>Discount:</label>
            <select value={selectedDiscount?.discount_id || ''} onChange={(e) => {
              const disc = discounts.find(d => d.discount_id === parseInt(e.target.value));
              setSelectedDiscount(disc || null);
            }}>
              <option value="">No Discount</option>
            {discounts.map(d => (
              <option key={d.discount_id} value={d.discount_id}>
                {d.name} ({d.percentage}%)
              </option>
            ))}
          </select>
        </div>

        {/* Totals */}
        <div className="cart-totals">
          <div className="total-row">
            <span>Subtotal:</span>
            <span>₱{calculateSubtotal().toFixed(2)}</span>
          </div>
          <div className="total-row discount">
            <span>Discount:</span>
            <span>{selectedDiscount ? `-₱${calculateDiscount().toFixed(2)}` : '₱0.00'}</span>
          </div>
          <div className="total-row grand-total">
            <span>Total:</span>
            <span>₱{calculateTotal().toFixed(2)}</span>
          </div>
        </div>

        {/* Cash Input with Quick Amounts */}
        <div className="cash-section">
          <label>Cash Amount:</label>
          <div className="cash-input-row">
            <input
              type="number"
              value={cashAmount}
              onChange={(e) => setCashAmount(e.target.value)}
              placeholder="Enter cash amount"
            />
            <button onClick={clearCash} className="btn-clear-cash">Clear</button>
          </div>
          <div className="quick-cash-buttons">
            {[50, 100, 200, 500, 1000].map(amount => (
              <button key={amount} onClick={() => handleQuickCash(amount)} className="quick-cash-btn">
                +{amount}
              </button>
            ))}
          </div>
          <div className="change-display">
            Change: ₱{parseFloat(cashAmount) > 0 ? calculateChange().toFixed(2) : '0.00'}
          </div>
        </div>

        </div>{/* End of cart-payment-section */}

          {/* Pay Button - outside payment section so it's always pinned at bottom */}
          <button
            onClick={handlePayment}
            disabled={loading || (cart.length === 0 && !pendingOrderId && !pendingLibraryBooking) || !orderType}
            className="btn-pay"
          >
            {loading ? 'Processing...' : 'Pay & Complete'}
          </button>

          {error && <div className="error-message">{error}</div>}
        </div>{/* End of cart-body */}
      </div>

      {/* Customization Modal */}
      {showCustomization && customizingItem && (() => {
        // Separate required groups (Size, Temperature) from add-on groups
        const requiredGroups = customizationGroups.filter(g => g.is_required);
        const addonGroups = customizationGroups.filter(g => !g.is_required);
        const currentAddonGroup = addonGroups.find(g => (g.group_id || g.id) === activeAddonTab) || addonGroups[0];
        
        // Helper to get selected count for a group
        const getSelectedCount = (groupId) => {
          const selected = selectedCustomizations[groupId] || [];
          return selected.length;
        };
        
        return (
          <div className="modal-overlay">
            <div className="modal customization-modal">
              <div className="modal-header">
                <h3>Customize: {customizingItem.name}</h3>
                <button onClick={() => setShowCustomization(false)} className="modal-close">×</button>
              </div>
              <div className="modal-body">
                {customizationGroups.length === 0 ? (
                  <p>No customizations available for this item.</p>
                ) : (
                  <>
                    {/* Required Groups (Size, Temperature) - Always visible */}
                    {requiredGroups.map(group => {
                      const groupId = group.group_id || group.id;
                      return (
                        <div key={groupId} className="customization-group required-group">
                          <h4>
                            {group.name}
                            <span className="required-badge">Required</span>
                          </h4>
                          <div className="customization-options-row">
                            {group.options.map(option => {
                              const optionId = option.option_id || option.id;
                              const optPrice = parseFloat(option.price || option.price_per_unit) || 0;
                              const isSelected = (selectedCustomizations[groupId] || []).includes(optionId);
                              return (
                                <label key={optionId} className={`option-chip ${isSelected ? 'selected' : ''}`}>
                                  <input
                                    type="radio"
                                    name={`group-${groupId}`}
                                    checked={isSelected}
                                    onChange={() => handleCustomizationChange(groupId, optionId, false)}
                                  />
                                  <span className="chip-content">
                                    <span className="option-name">{option.name}</span>
                                    {optPrice > 0 && <span className="option-price">+₱{optPrice.toFixed(0)}</span>}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {/* Add-on Groups - Tabbed */}
                    {addonGroups.length > 0 && (
                      <div className="addon-section">
                        <h4 className="addon-header">Add-ons</h4>
                        <div className="addon-tabs">
                          {addonGroups.map(group => {
                            const groupId = group.group_id || group.id;
                            const count = getAddonCount(group);
                            const isActive = currentAddonGroup && (currentAddonGroup.group_id || currentAddonGroup.id) === groupId;
                            return (
                              <button
                                key={groupId}
                                className={`addon-tab ${isActive ? 'active' : ''}`}
                                onClick={() => setActiveAddonTab(groupId)}
                              >
                                {group.name}
                                {count > 0 && <span className="tab-badge">{count}</span>}
                              </button>
                            );
                          })}
                        </div>
                        
                        {/* Current Tab Content */}
                        {currentAddonGroup && (
                          <div className="addon-content">
                            {currentAddonGroup.input_type === 'quantity' ? (
                              /* Quantity-based options (Syrup, Sauces) with +/- controls */
                              currentAddonGroup.options.map(option => {
                                const optionId = option.option_id || option.id;
                                const optPrice = parseFloat(option.price_per_unit || option.price) || 0;
                                const groupId = currentAddonGroup.group_id || currentAddonGroup.id;
                                const qty = getOptionQuantity(groupId, optionId);
                                return (
                                  <div key={optionId} className="quantity-option">
                                    <div className="quantity-option-info">
                                      <span className="quantity-option-name">{option.name}</span>
                                      <span className="quantity-option-price">₱{optPrice.toFixed(0)}/pump</span>
                                    </div>
                                    <div className="quantity-controls">
                                      <button 
                                        className="qty-btn"
                                        onClick={() => handleQuantityChange(groupId, optionId, -1)}
                                        disabled={qty === 0}
                                      >−</button>
                                      <span className="qty-value">{qty}</span>
                                      <button 
                                        className="qty-btn"
                                        onClick={() => handleQuantityChange(groupId, optionId, 1)}
                                      >+</button>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              /* Regular single-select options (Espresso, Milk, Additives) */
                              currentAddonGroup.options.map(option => {
                                const optionId = option.option_id || option.id;
                                const optPrice = parseFloat(option.price || option.price_per_unit) || 0;
                                const groupId = currentAddonGroup.group_id || currentAddonGroup.id;
                                const isSelected = (selectedCustomizations[groupId] || []).includes(optionId);
                                return (
                                  <label key={optionId} className={`addon-option ${isSelected ? 'selected' : ''}`}>
                                    <input
                                      type="radio"
                                      name={`addon-group-${groupId}`}
                                      checked={isSelected}
                                      onChange={() => handleCustomizationChange(groupId, optionId, false)}
                                    />
                                    <span className="addon-option-name">{option.name}</span>
                                    {optPrice > 0 && (
                                      <span className="addon-option-price">+₱{optPrice.toFixed(0)}</span>
                                    )}
                                  </label>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button onClick={() => setShowCustomization(false)} className="btn-cancel">Cancel</button>
                <button onClick={confirmCustomization} className="btn-confirm">Add to Cart</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Void Modal */}
      {showVoidModal && voidingOrder && (
        <div className="modal-overlay" onClick={() => setShowVoidModal(false)}>
          <div className="modal void-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Void Order #{voidingOrder.order_number}</h3>
              <button onClick={() => setShowVoidModal(false)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <p className="void-question">Are you sure you want to void this order?</p>
              <div className="void-order-info">
                <p>Order Type: {voidingOrder.order_type}</p>
                <p>Total: ₱{parseFloat(voidingOrder.total_amount).toFixed(2)}</p>
              </div>
              
              <div className="void-form">
                <label>Reason for voiding: *</label>
                <textarea
                  placeholder="Enter reason for voiding this order..."
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  rows={3}
                />
              </div>
              
              {currentUser?.role !== 'admin' && (
                <div className="void-admin-auth">
                  <p className="auth-label">Admin authorization required:</p>
                  <input
                    type="text"
                    placeholder="Admin Username"
                    value={adminCredentials.username}
                    onChange={(e) => setAdminCredentials(prev => ({ ...prev, username: e.target.value }))}
                  />
                  <input
                    type="password"
                    placeholder="Admin Password"
                    value={adminCredentials.password}
                    onChange={(e) => setAdminCredentials(prev => ({ ...prev, password: e.target.value }))}
                  />
                </div>
              )}
              {error && <div className="error-message">{error}</div>}
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowVoidModal(false)} className="btn-cancel">Cancel</button>
              <button onClick={handleVoid} disabled={loading} className="btn-void-confirm">
                {loading ? 'Processing...' : 'Confirm Void'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Beeper Selection Modal */}
      {showBeeperModal && (
        <div className="modal-overlay" onClick={() => setShowBeeperModal(false)}>
          <div className="modal beeper-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🔔 Select Order Number</h3>
              <button onClick={() => setShowBeeperModal(false)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <div className="beeper-legend">
                <span className="legend-item available">
                  <span className="legend-dot"></span> Available
                </span>
                <span className="legend-item in-use">
                  <span className="legend-dot"></span> In Use
                </span>
                <span className="legend-item selected-legend">
                  <span className="legend-dot"></span> Selected
                </span>
              </div>
              <div className="beeper-grid">
                {beepers.map(beeper => {
                  const beeperId = beeper.beeper_id || beeper.beeper_number;
                  const isAvailable = beeper.status === 'available';
                  const isSelected = selectedBeeper === beeperId;
                  
                  return (
                    <button
                      key={beeperId}
                      className={`beeper-btn ${isAvailable ? 'available' : 'in-use'} ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        if (isAvailable) {
                          setSelectedBeeper(beeperId);
                          setShowBeeperModal(false);
                        }
                      }}
                      disabled={!isAvailable}
                      title={isAvailable ? `Select Order #${beeper.beeper_number}` : 'This order number is currently in use'}
                    >
                      <span className="beeper-num">#{beeper.beeper_number}</span>
                      <span className="beeper-status-icon">
                        {isSelected ? '✓' : (isAvailable ? '' : '🔒')}
                      </span>
                    </button>
                  );
                })}
              </div>
              {beepers.length === 0 && (
                <div className="no-beepers">No order numbers configured in the system.</div>
              )}
            </div>
            <div className="modal-footer beeper-modal-footer">
              <div className="beeper-summary">
                <span>{availableBeepers.length} of {beepers.length} beepers available</span>
              </div>
              <button onClick={() => setShowBeeperModal(false)} className="btn-cancel">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <Toast toast={toast} onClose={() => setToast({ show: false, message: '', type: 'info' })} />

      {/* Item Removal Authorization Modal (for Kiosk orders) */}
      {showItemRemovalModal && removingItem && (
        <div className="modal-overlay" onClick={() => {
          setShowItemRemovalModal(false);
          setRemovingItem(null);
          setItemRemovalCredentials({ username: '', password: '' });
          setItemRemovalReason('');
        }}>
          <div className="modal item-removal-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Modify Kiosk Order</h3>
              <button onClick={() => {
                setShowItemRemovalModal(false);
                setRemovingItem(null);
                setItemRemovalCredentials({ username: '', password: '' });
                setItemRemovalReason('');
              }} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <p className="removal-question">
                Are you sure you want to {removingItem.action === 'remove-library' ? 'remove' : removingItem.action === 'remove' ? 'remove' : 'decrease quantity of'} this {removingItem.action === 'remove-library' ? 'booking' : 'item'}?
              </p>
              <div className="removal-item-info">
                <span className="item-name">{removingItem.name}</span>
                {removingItem.size && <span className="item-size">({removingItem.size})</span>}
                {removingItem.action !== 'remove-library' && <span className="item-qty">× {removingItem.quantity}</span>}
              </div>
              
              <div className="removal-form">
                <label>Admin authorization required:</label>
                <input 
                  type="text" 
                  value={itemRemovalCredentials.username}
                  onChange={(e) => setItemRemovalCredentials({...itemRemovalCredentials, username: e.target.value})}
                  placeholder="Admin Username"
                  autoFocus
                />
                <input 
                  type="password" 
                  value={itemRemovalCredentials.password}
                  onChange={(e) => setItemRemovalCredentials({...itemRemovalCredentials, password: e.target.value})}
                  placeholder="Admin Password"
                />
                <label>Reason for modification: *</label>
                <textarea 
                  value={itemRemovalReason}
                  onChange={(e) => setItemRemovalReason(e.target.value)}
                  placeholder="Enter reason (e.g., Customer request, Item unavailable)"
                  rows={2}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                onClick={() => {
                  setShowItemRemovalModal(false);
                  setRemovingItem(null);
                  setItemRemovalCredentials({ username: '', password: '' });
                  setItemRemovalReason('');
                }} 
                className="btn-cancel"
              >
                Cancel
              </button>
              <button 
                onClick={processItemRemovalWithAuth}
                className="btn-confirm-modify"
                disabled={!itemRemovalCredentials.username || !itemRemovalCredentials.password}
              >
                Confirm {removingItem.action === 'remove-library' || removingItem.action === 'remove' ? 'Remove' : 'Decrease'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simple Confirmation Modal (for POS direct orders) */}
      {showConfirmModal && confirmAction && (
        <div className="modal-overlay" onClick={() => {
          setShowConfirmModal(false);
          setConfirmAction(null);
        }}>
          <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {confirmAction.action === 'clear' 
                  ? 'Clear Cart' 
                  : `Confirm ${confirmAction.action === 'remove' ? 'Remove' : 'Decrease'}`
                }
              </h3>
              <button onClick={() => {
                setShowConfirmModal(false);
                setConfirmAction(null);
              }} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              {confirmAction.action === 'clear' ? (
                <>
                  <p>Are you sure you want to clear all items from the cart?</p>
                  <div className="confirm-item-preview">
                    <span className="item-name">{confirmAction.itemCount} item(s) will be removed</span>
                  </div>
                </>
              ) : (
                <>
                  <p>Are you sure you want to {confirmAction.action === 'remove' ? 'remove' : 'decrease quantity of'}:</p>
                  <div className="confirm-item-preview">
                    <span className="item-name">{confirmAction.name}</span>
                    {confirmAction.size && <span className="item-size">({confirmAction.size})</span>}
                    <span className="item-qty">× {confirmAction.quantity}</span>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button 
                onClick={() => {
                  setShowConfirmModal(false);
                  setConfirmAction(null);
                }} 
                className="btn-cancel"
              >
                Cancel
              </button>
              <button 
                onClick={confirmItemRemoval}
                className={confirmAction.action === 'clear' ? 'btn-void-confirm' : 'btn-confirm'}
              >
                {confirmAction.action === 'clear' ? 'Clear All' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
