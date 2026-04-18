import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import api from '../api';
import socketService from '../services/socketService';
import { printOrderReceipt, printVoidConfirmation } from '../services/webPrinter';
import VoidTransactionModal from '../components/VoidTransactionModal';
import Toast from '../components/Toast';
import FilterSelectWrap from '../components/FilterSelectWrap';
import { loadPosDraft, savePosDraft, clearPosDraft } from '../utils/posDraftStorage';
import '../styles/pos.css';

const isSizeGroupName = (name) => String(name || '').toLowerCase().includes('size');
const isTempGroupName = (name) => String(name || '').toLowerCase().includes('temperature');
const isHotOptionName = (name) => String(name || '').toLowerCase().includes('hot');
const isLargeSizeOptionName = (name) => /large|22/i.test(String(name || ''));
const isSizeAllowedForTemp = (sizeName, tempName) => {
  if (!sizeName || !tempName) return true;
  if (isHotOptionName(tempName) && isLargeSizeOptionName(sizeName)) return false;
  return true;
};
const pickPreferredSizeForTemp = (sizeOptions, tempOption) => {
  const options = Array.isArray(sizeOptions) ? sizeOptions : [];
  const tempName = tempOption?.name || null;
  const valid = options.filter((o) => isSizeAllowedForTemp(o.name, tempName));
  if (valid.length === 0) return null;
  const medium = valid.find((o) => /medium|med|16/i.test(String(o.name || '')));
  return medium || valid[0];
};

const findVariantMatch = (variants, sizeOptionId, tempOptionId) => {
  const rows = Array.isArray(variants) ? variants : [];
  if (rows.length === 0) return null;

  return rows.find((row) => {
    const rowSize = row.size_option_id ?? null;
    const rowTemp = row.temp_option_id ?? null;
    const wantedSize = sizeOptionId ?? null;
    const wantedTemp = tempOptionId ?? null;
    return rowSize === wantedSize && rowTemp === wantedTemp;
  }) || null;
};

/** Match menu-bar slug (iced/hot/medium/large) to a customization option by label — same idea as kiosk */
const findOptionForMenuBranch = (options, slug) => {
  if (!options || !slug) return null;
  const s = String(slug).toLowerCase();
  if (s === 'iced') {
    return options.find((o) => /iced|cold/i.test(String(o.name || ''))) || null;
  }
  if (s === 'hot') {
    return options.find((o) => {
      const n = String(o.name || '').toLowerCase();
      return n.includes('hot') && !n.includes('chocolate');
    }) || null;
  }
  if (s === 'medium') {
    return options.find((o) => /medium|med|16/i.test(String(o.name || ''))) || null;
  }
  if (s === 'large') {
    return options.find((o) => /large|22/i.test(String(o.name || ''))) || null;
  }
  return null;
};

const isTakeoutOrderType = (value) => value === 'takeout' || value === 'take_out';

/**
 * Prefill modal `selectedCustomizations` from global Temp/Size bar (posMenuBranchForModal).
 * Keys are group_id; values are [optionId] for single-select groups.
 */
const buildBranchPrefillSelections = (groups, menuBranch) => {
  if (!menuBranch || !Array.isArray(groups)) return {};
  const out = {};
  const tempG = groups.find((g) => isTempGroupName(g.name));
  const sizeG = groups.find((g) => isSizeGroupName(g.name));
  if (menuBranch.temp && tempG?.options?.length) {
    const opt = findOptionForMenuBranch(tempG.options, menuBranch.temp);
    if (opt) {
      const gid = tempG.group_id || tempG.id;
      const oid = opt.option_id ?? opt.id;
      out[gid] = [oid];
    }
  }
  if (menuBranch.size && sizeG?.options?.length) {
    const opt = findOptionForMenuBranch(sizeG.options, menuBranch.size);
    if (opt) {
      const gid = sizeG.group_id || sizeG.id;
      const oid = opt.option_id ?? opt.id;
      out[gid] = [oid];
    }
  }
  if (!menuBranch.size && sizeG?.options?.length && tempG?.options?.length) {
    const tempGid = tempG.group_id || tempG.id;
    const selectedTempId = (out[tempGid] || [])[0];
    const selectedTemp = tempG.options.find((o) => (o.option_id ?? o.id) === selectedTempId) || null;
    if (selectedTemp) {
      const preferred = pickPreferredSizeForTemp(sizeG.options, selectedTemp);
      if (preferred) {
        const sizeGid = sizeG.group_id || sizeG.id;
        const sizeOid = preferred.option_id ?? preferred.id;
        out[sizeGid] = [sizeOid];
      }
    }
  }
  return out;
};

export default function POS() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasActiveShift, setHasActiveShift] = useState(true);
  const [shiftChecking, setShiftChecking] = useState(true);
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  /** 'all' = entire menu; otherwise category_id number */
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [menuBranchMode, setMenuBranchMode] = useState('all');
  const [menuIcedSize, setMenuIcedSize] = useState('medium');
  const [menuSearchQuery, setMenuSearchQuery] = useState('');
  const [cart, setCart] = useState(() => {
    const d = loadPosDraft();
    return d?.cart?.length ? d.cart : [];
  });
  const [orderType, setOrderType] = useState(null);
  const [takeoutCupsStatus, setTakeoutCupsStatus] = useState({
    stock: null,
    is_takeout_disabled: false,
    required_cups: 0,
    can_fulfill: true
  });
  const [takeoutCupsLoading, setTakeoutCupsLoading] = useState(false);
  const [taxDisplay, setTaxDisplay] = useState({ vat_enabled: false, vat_rate_percent: 0 });
  const [orders, setOrders] = useState({ pending: [], preparing: [], ready: [] });
  const [beepers, setBeepers] = useState([]);
  const [selectedBeeper, setSelectedBeeper] = useState(null);
  const [showBeeperModal, setShowBeeperModal] = useState(false);
  const [discounts, setDiscounts] = useState([]);
  const [selectedDiscount, setSelectedDiscount] = useState(null);
  const [cashAmount, setCashAmount] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCustomization, setShowCustomization] = useState(false);
  const [customizingItem, setCustomizingItem] = useState(null);
  const [customizationGroups, setCustomizationGroups] = useState([]);
  const [selectedCustomizations, setSelectedCustomizations] = useState({});
  const [quantitySelections, setQuantitySelections] = useState({}); // For pump-based options {groupId: {optionId: quantity}}
  const [activeAddonTab, setActiveAddonTab] = useState(null); // For tabbed add-ons
  const [addonLimit, setAddonLimit] = useState(null); // Global add-on limit from category (null = unlimited)
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidingOrder, setVoidingOrder] = useState(null);
  const [voidReasonType, setVoidReasonType] = useState('');
  const [voidOtherReason, setVoidOtherReason] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  
  // Pending order state - when loading a kiosk order for payment
  const [pendingOrderId, setPendingOrderId] = useState(null);
  const [pendingOrderBeeper, setPendingOrderBeeper] = useState(null);
  const [pendingLibraryBooking, setPendingLibraryBooking] = useState(null); // Library booking from kiosk order
  
  // Item removal modal state (for kiosk orders)
  const [showItemRemovalModal, setShowItemRemovalModal] = useState(false);
  const [removingItem, setRemovingItem] = useState(null); // { itemId, action: 'remove' | 'decrease', itemName }
  const [itemRemovalPin, setItemRemovalPin] = useState('');
  const [itemRemovalReasonType, setItemRemovalReasonType] = useState('');
  const [itemRemovalOtherReason, setItemRemovalOtherReason] = useState('');
  
  // Bulk Void UI
  const [showBulkVoidModal, setShowBulkVoidModal] = useState(false);
  
  // Confirmation modal state (for POS direct orders)
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // { type: 'remove', itemId, itemName }
  
  // Order search state
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  
  // Ref for pos-container to force correct height in cashier mode
  const posContainerRef = useRef(null);
  const draftToastShownRef = useRef(false);

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
      const catsRes = await api.get('/menu/categories');
      const activeCategories = catsRes.data.filter(cat => cat.status === 'active');
      setCategories([{ category_id: 'all', name: 'All', status: 'active', allow_hot: 1, allow_iced: 1 }, ...activeCategories]);
    } catch (err) {
      console.error('Failed to fetch menu categories:', err);
    }
  }, []);

  const fetchMenuItems = useCallback(async () => {
    try {
      const params = {};
      const applyBranchParams = (cat) => {
        const hasBranch = cat && (Number(cat.allow_iced ?? 1) === 1 || Number(cat.allow_hot ?? 1) === 1);
        if (!hasBranch) return;
        if (menuBranchMode === 'iced') {
          params.temp = 'iced';
          if (menuIcedSize === 'medium' || menuIcedSize === 'large') {
            params.size = menuIcedSize;
          }
        } else if (menuBranchMode === 'hot') {
          params.temp = 'hot';
        }
      };

      if (selectedCategory !== 'all') {
        params.category_id = selectedCategory;
        const cat = categories.find(c => c.category_id === selectedCategory);
        applyBranchParams(cat);
      } else if (menuSearchQuery.trim() !== '') {
        /* All + search: same temp/size API enrichment as a branched category (backend applies temp/size without category_id). */
        const allCat = categories.find(c => c.category_id === 'all');
        applyBranchParams(allCat);
      }
      const itemsRes = await api.get('/menu/items', { params });
      const data = itemsRes.data;
      setMenuItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch menu items:', err);
    }
  }, [selectedCategory, categories, menuBranchMode, menuIcedSize, menuSearchQuery]);

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

  const fetchTakeoutCupsStatus = useCallback(async (requiredOverride = null) => {
    try {
      setTakeoutCupsLoading(true);
      const requiredCups = Number.isFinite(requiredOverride)
        ? Math.max(0, Math.floor(requiredOverride))
        : 0;

      const res = await api.get('/pos/cups/status', {
        params: { required_cups: requiredCups }
      });

      setTakeoutCupsStatus({
        stock: Number(res.data?.stock ?? 0),
        is_takeout_disabled: Boolean(res.data?.is_takeout_disabled),
        required_cups: Number(res.data?.required_cups ?? requiredCups),
        can_fulfill: Boolean(res.data?.can_fulfill)
      });
    } catch (err) {
      console.error('Failed to fetch takeout cup status:', err);
    } finally {
      setTakeoutCupsLoading(false);
    }
  }, []);

  const fetchTaxDisplay = useCallback(async () => {
    try {
      const res = await api.get('/pos/tax-display');
      setTaxDisplay({
        vat_enabled: Boolean(res.data?.vat_enabled),
        vat_rate_percent: Number(res.data?.vat_rate_percent) || 0
      });
    } catch (err) {
      console.error('Failed to fetch tax display:', err);
    }
  }, []);

  useEffect(() => {
    const onTaxSettingsUpdated = () => {
      fetchTaxDisplay();
    };
    const onFocus = () => {
      fetchTaxDisplay();
    };
    window.addEventListener('tax-settings-updated', onTaxSettingsUpdated);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('tax-settings-updated', onTaxSettingsUpdated);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchTaxDisplay]);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    // Check if user is admin
    setIsAdmin(user?.role_id === 1 || user?.role?.toLowerCase() === 'admin');

    const checkShift = () => {
      api.get('/shifts/my-active')
        .then(res => {
          setHasActiveShift(!!res.data.shift);
          setShiftChecking(false);
        })
        .catch(() => setShiftChecking(false));
    };
    checkShift();
    window.addEventListener('shiftUpdated', checkShift);

    fetchMenuData();
    fetchOrders();
    fetchBeepers();
    fetchDiscounts();
    fetchTakeoutCupsStatus(0);
    fetchTaxDisplay();

    // Connect to Socket.IO for real-time beeper updates
    socketService.connect();
    socketService.onBeepersUpdate((data) => {
      console.log('🔔 Real-time beeper update:', data);
      // Refresh beepers list when any beeper status changes
      fetchBeepers();
    });

    const interval = setInterval(() => {
      fetchOrders();
      fetchTakeoutCupsStatus(0);
    }, 5000);
    return () => {
      clearInterval(interval);
      socketService.removeListener('beepers:update');
      window.removeEventListener('shiftUpdated', checkShift);
    };
  }, [fetchMenuData, fetchOrders, fetchBeepers, fetchDiscounts, fetchTakeoutCupsStatus, fetchTaxDisplay]);

  useEffect(() => {
    const requiredCups = isTakeoutOrderType(orderType)
      ? cart.reduce((sum, item) => {
        const requiresCup = Number(item?.requires_takeout_cup ?? 1) === 1;
        const quantity = Number(item?.quantity || 0);
        if (!requiresCup || quantity <= 0) return sum;
        return sum + Math.floor(quantity);
      }, 0)
      : 0;

    fetchTakeoutCupsStatus(requiredCups);
  }, [fetchTakeoutCupsStatus, orderType, cart]);

  useEffect(() => {
    if (pendingOrderId) return;
    if (!isTakeoutOrderType(orderType)) return;
    if (!takeoutCupsStatus.is_takeout_disabled) return;

    setOrderType('dine_in');
    showToast('Take Out is currently unavailable because cups are out of stock.', 'warning');
  }, [orderType, pendingOrderId, showToast, takeoutCupsStatus.is_takeout_disabled]);

  useEffect(() => {
    fetchMenuItems();
  }, [fetchMenuItems]);

  /** Restore other draft fields (cart comes from lazy useState) */
  useLayoutEffect(() => {
    const draft = loadPosDraft();
    if (!draft?.cart?.length) return;
    if (draft.orderType != null) setOrderType(draft.orderType);
    if (draft.selectedBeeper != null) setSelectedBeeper(draft.selectedBeeper);
    if (draft.selectedDiscount != null) setSelectedDiscount(draft.selectedDiscount);
    if (draft.pendingLibraryBooking != null) setPendingLibraryBooking(draft.pendingLibraryBooking);
    if (!draftToastShownRef.current) {
      draftToastShownRef.current = true;
      showToast('Restored in-progress order from this browser session', 'info');
    }
  }, [showToast]);

  useEffect(() => {
    if (pendingOrderId) {
      clearPosDraft();
      return;
    }
    const hasDraft =
      cart.length > 0 ||
      orderType != null ||
      selectedBeeper != null ||
      selectedDiscount != null ||
      pendingLibraryBooking != null;
    if (!hasDraft) {
      clearPosDraft();
      return;
    }
    savePosDraft({
      cart,
      orderType,
      selectedBeeper,
      selectedDiscount,
      pendingLibraryBooking
    });
  }, [cart, orderType, selectedBeeper, selectedDiscount, pendingLibraryBooking, pendingOrderId]);

  useEffect(() => {
    setMenuBranchMode('all');
    setMenuIcedSize('medium');
  }, [selectedCategory]);

  useEffect(() => {
    if (selectedCategory === 'all' && !menuSearchQuery.trim()) {
      setMenuBranchMode('all');
      setMenuIcedSize('medium');
    }
  }, [menuSearchQuery, selectedCategory]);

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
    if (item.menu_price_kind === 'unavailable') {
      showToast('This item is not available for the selected temperature/size.', 'warning');
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
        const branchForModal = item._menuBranch ?? posMenuBranchForModal;
        const defaults = buildBranchPrefillSelections(groups, branchForModal);
        setCustomizingItem({
          ...item,
          base_price: parseFloat(baristaData.base_price ?? item.price),
          variant_pricing: baristaData.variant_pricing || []
        });
        setCustomizationGroups(groups);
        setSelectedCustomizations(defaults);
        setQuantitySelections({});
        setAddonLimit(baristaData.addon_limit != null ? Number(baristaData.addon_limit) : null);
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
        quantity: 1,
        requires_takeout_cup: Number(item?.requires_takeout_cup ?? 1)
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
        const branchForModal = item._menuBranch ?? posMenuBranchForModal;
        const defaults = buildBranchPrefillSelections(groups, branchForModal);
        setCustomizingItem({
          ...item,
          base_price: parseFloat(res.data.base_price ?? item.price),
          variant_pricing: res.data.variant_pricing || []
        });
        setCustomizationGroups(groups);
        setSelectedCustomizations(defaults);
        setQuantitySelections({});
        setAddonLimit(res.data.addon_limit != null ? Number(res.data.addon_limit) : null);
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
      quantity: 1,
      requires_takeout_cup: Number(item?.requires_takeout_cup ?? 1)
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
          // Check global addon limit before adding
          if (addonLimit != null) {
            const currentTotal = getTotalAddonQuantity(quantitySelections, prev);
            if (currentTotal >= addonLimit) {
              showToast(`Maximum of ${addonLimit} total add-ons reached`, 'warning');
              return prev;
            }
          }
          return { ...prev, [groupId]: [...current, optionId] };
        }
      } else {
        // Single-select Add-ons (non-required): toggling on counts as 1, toggling off frees 1
        const current = prev[groupId] || [];
        const isDeselecting = current.includes(optionId);
        if (!isDeselecting && addonLimit != null) {
          // Check if this is an add-on group (not Size/Temperature)
          const changedGroup = customizationGroups.find((g) => (g.group_id || g.id) === Number(groupId));
          const isAddonGroup = changedGroup && !isSizeGroupName(changedGroup.name) && !isTempGroupName(changedGroup.name);
          if (isAddonGroup) {
            const currentTotal = getTotalAddonQuantity(quantitySelections, prev);
            // If the group already has a selection, we're swapping (no net increase)
            const netIncrease = current.length === 0 ? 1 : 0;
            if (currentTotal + netIncrease > addonLimit) {
              showToast(`Maximum of ${addonLimit} total add-ons reached`, 'warning');
              return prev;
            }
          }
        }
        const next = { ...prev, [groupId]: [optionId] };
        const changedGroup = customizationGroups.find((g) => (g.group_id || g.id) === Number(groupId));
        if (changedGroup && isTempGroupName(changedGroup.name)) {
          const tempOpt = changedGroup.options?.find((o) => (o.option_id || o.id) === optionId) || null;
          const sizeGroup = customizationGroups.find((g) => isSizeGroupName(g.name));
          if (sizeGroup) {
            const sizeGroupId = sizeGroup.group_id || sizeGroup.id;
            const selectedSizeId = (next[sizeGroupId] || [])[0];
            if (selectedSizeId) {
              const sizeOpt = sizeGroup.options?.find((o) => (o.option_id || o.id) === selectedSizeId) || null;
              if (sizeOpt && !isSizeAllowedForTemp(sizeOpt.name, tempOpt?.name)) {
                const preferred = pickPreferredSizeForTemp(sizeGroup.options, tempOpt);
                next[sizeGroupId] = preferred ? [preferred.option_id || preferred.id] : [];
              }
            } else {
              const preferred = pickPreferredSizeForTemp(sizeGroup.options, tempOpt);
              if (preferred) {
                next[sizeGroupId] = [preferred.option_id || preferred.id];
              }
            }
          }
        }
        return next;
      }
    });
  };

  // Helper: compute total add-on quantity across all groups (for global limit check)
  const getTotalAddonQuantity = (currentQuantitySelections, currentSelectedCustomizations) => {
    let total = 0;
    // Count quantity-based add-ons (pumps)
    const addonGroupIds = customizationGroups
      .filter(g => !isSizeGroupName(g.name) && !isTempGroupName(g.name))
      .map(g => g.group_id || g.id);

    for (const gid of addonGroupIds) {
      const group = customizationGroups.find(g => (g.group_id || g.id) === gid);
      if (group?.input_type === 'quantity') {
        const groupQty = currentQuantitySelections[gid] || {};
        total += Object.values(groupQty).reduce((sum, qty) => sum + (qty || 0), 0);
      } else {
        // Single/multiple select add-ons: count each selected option as 1
        total += (currentSelectedCustomizations[gid] || []).length;
      }
    }
    return total;
  };

  // Handle quantity-based options (pumps for Syrup/Sauces)
  const handleQuantityChange = (groupId, optionId, change) => {
    // Find the option to get its max_quantity
    const group = customizationGroups.find(g => (g.group_id || g.id) === Number(groupId));
    const option = group?.options?.find(o => (o.option_id || o.id) === Number(optionId));
    const maxQty = option?.max_quantity || 99;

    setQuantitySelections(prev => {
      const groupQty = prev[groupId] || {};
      const currentQty = groupQty[optionId] || 0;
      let newQty = Math.max(0, Math.min(currentQty + change, maxQty));

      // Check per-option max_quantity
      if (change > 0 && newQty > maxQty) {
        showToast(`Maximum ${maxQty} for ${option?.name || 'this option'}`, 'warning');
        return prev;
      }

      // Check global addon limit
      if (change > 0 && addonLimit != null) {
        const currentTotal = getTotalAddonQuantity(prev, selectedCustomizations);
        if (currentTotal >= addonLimit) {
          showToast(`Maximum of ${addonLimit} total add-ons reached`, 'warning');
          return prev;
        }
      }
      
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

  const confirmCustomization = async () => {
    if (!customizingItem || isAdding) return;
    
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

    setIsAdding(true);
    
    // Slight delay to show loading state and prevent rapid double-clicks
    await new Promise(r => setTimeout(r, 200));

    const selectedSizeGroup = customizationGroups.find(g => isSizeGroupName(g.name));
    const selectedTempGroup = customizationGroups.find(g => isTempGroupName(g.name));
    const selectedSizeOptionId = selectedSizeGroup
      ? (selectedCustomizations[selectedSizeGroup.group_id || selectedSizeGroup.id] || [])[0] || null
      : null;
    const selectedTempOptionId = selectedTempGroup
      ? (selectedCustomizations[selectedTempGroup.group_id || selectedTempGroup.id] || [])[0] || null
      : null;

    const defaultBasePrice = parseFloat(customizingItem.base_price ?? customizingItem.price) || 0;
    const variantMatch = findVariantMatch(
      customizingItem.variant_pricing,
      selectedSizeOptionId,
      selectedTempOptionId
    );
    const usingVariantBasePrice = !!variantMatch;
    const resolvedBasePrice = usingVariantBasePrice
      ? (parseFloat(variantMatch.price) || defaultBasePrice)
      : defaultBasePrice;
    
    const customizations = [];
    let customizationTotal = 0;
    
    // Process regular selections (choice-based)
    Object.entries(selectedCustomizations).forEach(([groupId, optionIds]) => {
      const group = customizationGroups.find(g => (g.group_id || g.id) === parseInt(groupId));
      if (group && group.input_type !== 'quantity') {
        optionIds.forEach(optId => {
          const option = group.options.find(o => (o.option_id || o.id) === optId);
          if (option) {
            const isVariantDriverGroup = usingVariantBasePrice && (isSizeGroupName(group.name) || isTempGroupName(group.name));
            const optPrice = isVariantDriverGroup ? 0 : (parseFloat(option.price || option.price_per_unit) || 0);
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
      base_price: Number(resolvedBasePrice.toFixed(2)),
      customizations,
      customization_total: Number(customizationTotal.toFixed(2)),
      total_price: Number((resolvedBasePrice + customizationTotal).toFixed(2)),
      quantity: 1,
      requires_takeout_cup: Number(customizingItem?.requires_takeout_cup ?? 1)
    };

    setCart(prev => [...prev, cartItem]);
    setShowCustomization(false);
    setCustomizingItem(null);
    setSelectedCustomizations({});
    setQuantitySelections({});
    setIsAdding(false);
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

  // Handle quantity decrease — same line-item modal as kiosk (reason + admin when kiosk)
  const handleDecreaseQuantity = (item) => {
    setRemovingItem({ itemId: item.id, action: 'decrease', name: item.name, size: item.size, quantity: item.quantity });
    setItemRemovalPin('');
    setItemRemovalReasonType('');
    setItemRemovalOtherReason('');
    setShowItemRemovalModal(true);
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

  const closeItemRemovalModal = () => {
    setShowItemRemovalModal(false);
    setRemovingItem(null);
    setItemRemovalPin('');
    setItemRemovalReasonType('');
    setItemRemovalOtherReason('');
  };

  const requiresPinForItemRemoval = (item = removingItem) => {
    if (!item) return false;
    if (pendingOrderId) return true;

    // Qty 1 decrease is effectively a void/removal and must require PIN.
    return item.action === 'decrease' && Number(item.quantity || 0) <= 1;
  };

  // Process line-item adjustment: reason required; kiosk orders also require admin verification
  const processItemRemovalWithAuth = async () => {
    const finalReason = itemRemovalReasonType === 'Other - Please specify' ? itemRemovalOtherReason : itemRemovalReasonType;
    if (!finalReason.trim()) {
      showToast('Please select a reason', 'warning');
      return;
    }

    const applyRemoval = () => {
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
      closeItemRemovalModal();
    };

    if (!requiresPinForItemRemoval(removingItem)) {
      applyRemoval();
      return;
    }

    if (!/^\d{6}$/.test(itemRemovalPin)) {
      showToast('Please enter a valid 6-digit admin PIN', 'warning');
      return;
    }

    try {
      const response = await api.post('/auth/verify-admin-pin', {
        admin_pin: itemRemovalPin
      });

      if (response.data.valid) {
        applyRemoval();
      } else {
        showToast('Invalid admin PIN', 'error');
      }
    } catch {
      showToast('Authentication failed', 'error');
    }
  };

  const confirmItemRemoval = () => {
    if (confirmAction?.action === 'clear') {
      resetOrder();
      showToast('Cart cleared', 'success');
    }
    setShowConfirmModal(false);
    setConfirmAction(null);
  };

  // Memoized calculations to prevent recalculation on every render
  const subtotal = useMemo(() => {
    const itemsTotal = cart.reduce((sum, item) => sum + (item.total_price * item.quantity), 0);
    const libraryTotal = pendingLibraryBooking ? pendingLibraryBooking.amount : 0;
    return Number((itemsTotal + libraryTotal).toFixed(2));
  }, [cart, pendingLibraryBooking]);

  const requiredTakeoutCups = useMemo(() => {
    if (!isTakeoutOrderType(orderType)) return 0;

    return cart.reduce((sum, item) => {
      const requiresCup = Number(item?.requires_takeout_cup ?? 1) === 1;
      const quantity = Number(item?.quantity || 0);
      if (!requiresCup || quantity <= 0) return sum;
      return sum + Math.floor(quantity);
    }, 0);
  }, [cart, orderType]);

  const discountAmount = useMemo(() => {
    if (!selectedDiscount) return 0;
    const computedAmt = subtotal * (parseFloat(selectedDiscount.percentage) / 100);
    return Number(computedAmt.toFixed(2));
  }, [selectedDiscount, subtotal]);

  const handleBulkVoidConfirm = async ({ itemIds, voidLibrary, reason, adminPin }) => {
    if (pendingOrderId) {
      // --- PENDING ORDER: call backend ---
      const allItemsSelected = itemIds.length === cart.length;
      const allVoided = allItemsSelected && (!pendingLibraryBooking || voidLibrary);

      try {
        if (allVoided) {
          // Full void — void the entire transaction
          await api.post(`/pos/transactions/${pendingOrderId}/void`, {
            reason: reason || 'Voided from cart panel',
            admin_pin: adminPin || null
          });
          showToast('Order voided successfully', 'success');
          try {
            const beeperNum =
              pendingOrderBeeper ??
              (selectedBeeper != null
                ? beepers.find((b) => (b.beeper_id || b.beeper_number) === selectedBeeper)?.beeper_number ??
                  selectedBeeper
                : null);
            await printVoidConfirmation({
              transaction_id: pendingOrderId,
              beeper_number: beeperNum,
              total_amount: total,
              order_type: orderType,
              reason: reason || 'Voided from cart panel',
              voided_at: new Date().toISOString()
            });
          } catch (printErr) {
            console.warn('Void slip print:', printErr);
          }
          resetOrder();
        } else {
          // Partial void — remove selected items from pending order
          const transactionItemIds = cart
            .filter(item => itemIds.includes(item.id))
            .map(item => item.transaction_item_id)
            .filter(Boolean);

          const result = await api.put(`/pos/transactions/${pendingOrderId}/remove-items`, {
            transaction_item_ids: transactionItemIds,
            void_library: voidLibrary,
            reason: reason || 'Partial void from cart panel',
            admin_pin: adminPin || null
          });

          if (result.data.fully_voided) {
            showToast('All items removed — order voided', 'success');
            try {
              const beeperNum =
                pendingOrderBeeper ??
                (selectedBeeper != null
                  ? beepers.find((b) => (b.beeper_id || b.beeper_number) === selectedBeeper)?.beeper_number ??
                    selectedBeeper
                  : null);
              await printVoidConfirmation({
                transaction_id: pendingOrderId,
                beeper_number: beeperNum,
                total_amount: total,
                order_type: orderType,
                reason: reason || 'Partial void — cart emptied',
                voided_at: new Date().toISOString()
              });
            } catch (printErr) {
              console.warn('Void slip print:', printErr);
            }
            resetOrder();
          } else {
            // Remove voided items from local cart
            setCart(prev => prev.filter(item => !itemIds.includes(item.id)));
            if (voidLibrary && pendingLibraryBooking) {
              setPendingLibraryBooking(null);
            }
            showToast(result.data.message, 'success');
          }
        }
        fetchOrders();
        fetchBeepers();
      } catch (err) {
        console.error('Void failed:', err);
        showToast(err.response?.data?.error || 'Void failed', 'error');
      }
    } else {
      // --- POS DIRECT ORDER: local cart removal ---
      if (itemIds.length > 0) {
        setCart(prev => prev.filter(item => !itemIds.includes(item.id)));
      }
      if (voidLibrary && pendingLibraryBooking) {
        const socket = socketService.getSocket();
        if (socket && pendingLibraryBooking.seat_id) {
          socket.emit('seat:release', { seat_id: pendingLibraryBooking.seat_id });
        }
        setPendingLibraryBooking(null);
      }
      showToast(`Successfully voided ${itemIds.length + (voidLibrary ? 1 : 0)} items`, 'success');
    }
    setShowBulkVoidModal(false);
  };

  const total = useMemo(() => {
    return Number((subtotal - discountAmount).toFixed(2));
  }, [subtotal, discountAmount]);

  const change = useMemo(() => {
    const cash = parseFloat(cashAmount) || 0;
    return Number(Math.max(0, cash - total).toFixed(2));
  }, [cashAmount, total]);

  // Keep old function names for backward compatibility but use memoized values
  const calculateSubtotal = useCallback(() => subtotal, [subtotal]);
  const calculateDiscount = useCallback(() => discountAmount, [discountAmount]);
  const calculateTotal = useCallback(() => total, [total]);
  const calculateChange = useCallback(() => change, [change]);

  const formatMoney = (value) => {
    const numeric = Number(value || 0);
    const amount = Number.isNaN(numeric) ? 0 : numeric;
    return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const posMenuBranchForModal = useMemo(() => {
    const cat = categories.find((c) => c.category_id === selectedCategory);
    if (!cat) return null;
    const hasBranch = Number(cat.allow_iced ?? 1) === 1 || Number(cat.allow_hot ?? 1) === 1;
    if (!hasBranch) return null;
    if (selectedCategory === 'all' && !menuSearchQuery.trim()) return null;
    if (menuBranchMode === 'all') return null;
    if (menuBranchMode === 'hot') return { temp: 'hot' };
    if (menuBranchMode === 'iced') {
      if (menuIcedSize === 'medium' || menuIcedSize === 'large') {
        return { temp: 'iced', size: menuIcedSize };
      }
      return { temp: 'iced' };
    }
    return null;
  }, [selectedCategory, categories, menuBranchMode, menuIcedSize, menuSearchQuery]);

  const formatMenuItemCardPrice = (item) => {
    const k = item.menu_price_kind;
    const p = item.menu_price;
    if (k === 'unavailable') return '—';
    if (k === 'from') return item.menu_price_label || `From ${formatMoney(p)}`;
    const n = p != null && !Number.isNaN(Number(p)) ? Number(p) : parseFloat(item.price || 0);
    return formatMoney(n);
  };

  const currentPosCategory = categories.find((c) => c.category_id === selectedCategory);
  const showPosBranchBar =
    currentPosCategory &&
    (Number(currentPosCategory.allow_iced ?? 1) === 1 || Number(currentPosCategory.allow_hot ?? 1) === 1) &&
    (selectedCategory !== 'all' || menuSearchQuery.trim() !== '');

  const filteredMenuItems = useMemo(() => {
    let list = menuItems.filter((item) => item.status === 'available');
    if (menuSearchQuery.trim()) {
      const q = menuSearchQuery.trim().toLowerCase();
      list = list.filter((item) => (item.name || '').toLowerCase().includes(q));
    }
    return list.map((item) => ({ ...item, _menuBranch: posMenuBranchForModal }));
  }, [menuItems, menuSearchQuery, posMenuBranchForModal]);

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

  const clearCash = useCallback(() => {
    setCashAmount('');
  }, []);

  const handlePayment = async () => {
    if (!orderType) {
      showToast('Please select order type first!', 'warning');
      return;
    }

    if (isTakeoutOrderType(orderType)) {
      const stock = Number(takeoutCupsStatus.stock ?? 0);
      if (stock <= 0) {
        showToast('Take Out is unavailable because cups are out of stock.', 'warning');
        await fetchTakeoutCupsStatus(requiredTakeoutCups);
        return;
      }

      if (requiredTakeoutCups > stock) {
        showToast(`Not enough cups. Need ${requiredTakeoutCups}, available ${stock}.`, 'warning');
        await fetchTakeoutCupsStatus(requiredTakeoutCups);
        return;
      }
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
      }

      // Print receipt after successful payment (via print server)
      if (transactionId) {
        try {
          const receiptRes = await api.get(`/printer/receipt-data/${transactionId}`);
          await printOrderReceipt(receiptRes.data);
          console.log('Receipt sent to print server');
        } catch (printError) {
          console.error('Failed to print receipt:', printError);
          // Don't fail the payment if printing fails
        }
      }

      // Emit library update if this was an order with a library booking
      if (pendingLibraryBooking) {
        socketService.emitLibraryCheckin({ seat_id: pendingLibraryBooking.seat_id });
      }

      showToast('Payment successful!', 'success');
      setShowPaymentModal(false);
      resetOrder();
      fetchOrders();
      fetchBeepers();
      fetchTakeoutCupsStatus(0);
    } catch (err) {
      console.error('Payment failed:', err);
      const responseData = err?.response?.data || {};
      if (responseData.code === 'INSUFFICIENT_TAKEOUT_CUPS') {
        const needed = Number(responseData.cups_needed ?? 0);
        const available = Number(responseData.cups_available ?? 0);
        showToast(`Insufficient cups: need ${needed}, available ${available}.`, 'error');
        await fetchTakeoutCupsStatus(needed);
      }
      setError(err.response?.data?.error || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  const resetOrder = () => {
    clearPosDraft();
    setCart([]);
    setOrderType(null);
    setSelectedBeeper(null);
    setSelectedDiscount(null);
    setCashAmount('');
    setPendingOrderId(null);
    setPendingOrderBeeper(null);
    setPendingLibraryBooking(null);
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
          transaction_item_id: item.transaction_item_id, // Preserve DB ID for partial void
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
          quantity: item.quantity,
          requires_takeout_cup: Number(item?.requires_takeout_cup ?? 1)
        };
      });
      setCart(cartItems);
    }
    showToast(`Loaded order #${order.beeper_number} for payment`, 'success');
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
    setVoidReasonType('');
    setVoidOtherReason('');
    setAdminPin('');
    setShowVoidModal(true);
  };

  const handleVoid = async () => {
    if (!voidingOrder) return;
    const finalReason = voidReasonType === 'Other - Please specify' ? voidOtherReason : voidReasonType;
    if (!finalReason.trim()) {
      setError('Please select a reason for voiding this order');
      return;
    }

    if (!/^\d{6}$/.test(adminPin)) {
      setError('A valid 6-digit admin PIN is required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const voidData = { reason: finalReason.trim() };

      await api.post(`/pos/transactions/${voidingOrder.id}/void`, {
        ...voidData,
        admin_pin: adminPin
      });

      try {
        await printVoidConfirmation({
          transaction_id: voidingOrder.id,
          beeper_number: voidingOrder.beeper_number,
          total_amount: voidingOrder.total_amount,
          order_type: voidingOrder.order_type,
          reason: finalReason.trim(),
          voided_at: new Date().toISOString()
        });
      } catch (printErr) {
        console.warn('Void slip print:', printErr);
      }

      showToast('Order voided successfully', 'success');
      setShowVoidModal(false);
      setVoidingOrder(null);
      setVoidReasonType('');
      setVoidOtherReason('');
      setAdminPin('');
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
      {/* Global Loading Overlay */}
      {loading && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)', zIndex: 99999,
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center'
        }}>
          <div style={{
             border: '5px solid rgba(255, 255, 255, 0.3)', borderTop: '5px solid #4ade80',
             borderRadius: '50%', width: '60px', height: '60px', 
             animation: 'spin 1s linear infinite'
          }}></div>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          <h2 style={{ marginTop: '20px', color: '#fff', fontWeight: 'bold' }}>Processing...</h2>
        </div>
      )}

      {/* Shift Restricted Overlay */}
      {!hasActiveShift && !shiftChecking && !isAdmin && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.95)', zIndex: 1000,
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          textAlign: 'center', padding: '20px', borderRadius: '8px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>💰</div>
          <h2 style={{ fontSize: '24px', color: '#333', marginBottom: '8px', fontWeight: 'bold' }}>Shift Not Started</h2>
          <p style={{ color: '#666', fontSize: '15px', maxWidth: '400px' }}>
            You must start your shift using the 'Start Shift' button in the top bar to process orders.
          </p>
        </div>
      )}

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
                      <span className="dropdown-order-total">{formatMoney(order.total_amount)}</span>
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
                <div className="order-total">{formatMoney(order.total_amount)}</div>
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
                  <span className="order-total">{formatMoney(order.total_amount)}</span>
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
                  <span className="order-total">{formatMoney(order.total_amount)}</span>
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
          <div className="pos-menu-search-wrap pos-menu-search-wrap--top">
            <input
              type="search"
              className="pos-menu-search-input"
              placeholder="Search menu..."
              value={menuSearchQuery}
              onChange={(e) => setMenuSearchQuery(e.target.value)}
              autoComplete="off"
              aria-label="Search menu items"
            />
          </div>
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
          {showPosBranchBar && (
            <div className="pos-menu-filters-compact" aria-label="Temperature and size filters">
              <div className="pos-filter-inline-group">
                <span className="pos-filter-inline-label">Temp</span>
                <div className="pos-branch-chips pos-branch-chips--inline">
                  <button
                    type="button"
                    className={`pos-branch-chip pos-branch-chip--temp ${menuBranchMode === 'all' ? 'active' : ''}`}
                    onClick={() => { setMenuBranchMode('all'); setMenuIcedSize('medium'); }}
                  >
                    All
                  </button>
                  {Number(currentPosCategory.allow_iced ?? 1) === 1 && (
                    <button
                      type="button"
                      className={`pos-branch-chip pos-branch-chip--temp ${menuBranchMode === 'iced' ? 'active' : ''}`}
                      onClick={() => setMenuBranchMode('iced')}
                    >
                      Iced
                    </button>
                  )}
                  {Number(currentPosCategory.allow_hot ?? 1) === 1 && (
                    <button
                      type="button"
                      className={`pos-branch-chip pos-branch-chip--temp ${menuBranchMode === 'hot' ? 'active' : ''}`}
                      onClick={() => { setMenuBranchMode('hot'); setMenuIcedSize('medium'); }}
                    >
                      Hot
                    </button>
                  )}
                </div>
              </div>
              {menuBranchMode === 'iced' && (
                <>
                  <div className="pos-filter-inline-sep" aria-hidden="true" />
                  <div className="pos-filter-inline-group">
                    <span className="pos-filter-inline-label">Size</span>
                    <div className="pos-branch-chips pos-branch-chips--inline">

                      <button
                        type="button"
                        className={`pos-branch-chip pos-branch-chip--size ${menuIcedSize === 'medium' ? 'active' : ''}`}
                        onClick={() => setMenuIcedSize('medium')}
                      >
                        Medium
                      </button>
                      <button
                        type="button"
                        className={`pos-branch-chip pos-branch-chip--size ${menuIcedSize === 'large' ? 'active' : ''}`}
                        onClick={() => setMenuIcedSize('large')}
                      >
                        Large
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
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
                  className={`menu-item ${item.status !== 'available' ? 'unavailable' : ''} ${item.menu_price_kind === 'unavailable' ? 'unavailable' : ''}`}
                  onClick={() => item.status === 'available' && item.menu_price_kind !== 'unavailable' && handleAddItem(item)}
                >
                  {item.image && <img src={item.image} alt={item.name} className="item-image" />}
                  <div className="item-name">{item.name}</div>
                  <div className="item-price">{formatMenuItemCardPrice(item)}</div>
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
          {/* Void button for ALL orders (POS direct + pending kiosk) */}
          {(cart.length > 0 || pendingLibraryBooking) && (
            <button 
              onClick={() => setShowBulkVoidModal(true)} 
              className="btn-clear-order"
              style={{ backgroundColor: '#e53935', color: 'white', padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Void
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
              onClick={() => {
                if (pendingOrderId) return;
                if (takeoutCupsStatus.is_takeout_disabled) {
                  showToast('Take Out is unavailable because cups are out of stock.', 'warning');
                  return;
                }
                setOrderType('take_out');
              }}
              disabled={pendingOrderId || takeoutCupsStatus.is_takeout_disabled}
            >
              Take Out
            </button>
          </div>
          <div className={`takeout-cups-hint ${takeoutCupsStatus.is_takeout_disabled ? 'danger' : 'ok'}`}>
            {takeoutCupsLoading
              ? 'Checking takeout cup stock...'
              : takeoutCupsStatus.is_takeout_disabled
                ? 'Take Out unavailable: no cups left.'
                : isTakeoutOrderType(orderType)
                  ? `Cups needed: ${requiredTakeoutCups} | Available: ${Number(takeoutCupsStatus.stock ?? 0)}`
                  : `Take Out cups available: ${Number(takeoutCupsStatus.stock ?? 0)}`}
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
              </div>
              <div className="library-booking-details">
                <p><strong>Customer:</strong> {pendingLibraryBooking.customer_name}</p>
                <p><strong>Location:</strong> {pendingLibraryBooking.table_name || `Table ${pendingLibraryBooking.table_number}`}, Seat {pendingLibraryBooking.seat_number}</p>
                <p><strong>Duration:</strong> {Math.floor(pendingLibraryBooking.duration_minutes / 60)}h {pendingLibraryBooking.duration_minutes % 60}m</p>
              </div>
              <div className="library-booking-price">
                {formatMoney(pendingLibraryBooking.amount)}
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
                </div>
                {item.customizations && item.customizations.length > 0 && (
                  <div className="cart-item-customizations">
                    {item.customizations.map((c, i) => (
                      <span key={i} className="customization-tag">
                        {c.option_name} {c.price > 0 && `+${formatMoney(c.price)}`}
                      </span>
                    ))}
                  </div>
                )}
                <div className="cart-item-footer">
                  <div className="quantity-controls">
                    <button 
                      onClick={() => handleDecreaseQuantity(item)}
                      disabled={!!pendingOrderId}
                      className={pendingOrderId ? 'qty-btn-disabled' : ''}
                    >-</button>
                    <span>{item.quantity}</span>
                    <button 
                      onClick={() => handleIncreaseQuantity(item)}
                      disabled={!!pendingOrderId}
                      className={pendingOrderId ? 'qty-btn-disabled' : ''}
                    >+</button>
                  </div>
                  <span className="cart-item-total">{formatMoney(item.total_price * item.quantity)}</span>
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
            <FilterSelectWrap fullWidth className="pos-filter-select-wrap">
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
            </FilterSelectWrap>
        </div>

        {/* Totals */}
        <div className="cart-totals">
          <div className="total-row">
            <span>Subtotal:</span>
            <span>{formatMoney(calculateSubtotal())}</span>
          </div>
          <div className="total-row discount">
            <span>Discount:</span>
            <span>{selectedDiscount ? `-${formatMoney(calculateDiscount())}` : formatMoney(0)}</span>
          </div>
          <div className="total-row grand-total">
            <span>Total:</span>
            <span>{formatMoney(calculateTotal())}</span>
          </div>
          {taxDisplay.vat_enabled && (
            <div
              className="pos-vat-inclusive-note"
              style={{ fontSize: '11px', color: '#666', textAlign: 'center', paddingTop: '6px', lineHeight: 1.3 }}
            >
              Prices include VAT ({Number(taxDisplay.vat_rate_percent || 0).toFixed(0)}%)
            </div>
          )}
        </div>

        </div>{/* End of cart-payment-section */}

          {/* Proceed to Payment Button - opens payment modal */}
          <button
            onClick={() => {
              if (!orderType) {
                showToast('Please select order type first!', 'warning');
                return;
              }
              if (isTakeoutOrderType(orderType) && takeoutCupsStatus.is_takeout_disabled) {
                showToast('Take Out is unavailable because cups are out of stock.', 'warning');
                return;
              }
              if (isTakeoutOrderType(orderType) && requiredTakeoutCups > Number(takeoutCupsStatus.stock ?? 0)) {
                showToast(`Not enough cups. Need ${requiredTakeoutCups}, available ${Number(takeoutCupsStatus.stock ?? 0)}.`, 'warning');
                return;
              }
              if (!pendingOrderId && !selectedBeeper) {
                showToast('Please select a beeper number!', 'warning');
                return;
              }
              if (cart.length === 0 && !pendingOrderId && !pendingLibraryBooking) {
                showToast('Cart is empty!', 'warning');
                return;
              }
              setCashAmount('');
              setShowPaymentModal(true);
            }}
            disabled={
              loading ||
              (cart.length === 0 && !pendingOrderId && !pendingLibraryBooking) ||
              !orderType ||
              (isTakeoutOrderType(orderType) && takeoutCupsStatus.is_takeout_disabled)
            }
            className="btn-pay"
          >
            {loading ? 'Processing...' : 'Proceed to Payment'}
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
        const hasVariantPricing = Array.isArray(customizingItem.variant_pricing) && customizingItem.variant_pricing.length > 0;
        
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
                      const tempGroup = customizationGroups.find((g) => isTempGroupName(g.name));
                      const tempGroupId = tempGroup ? (tempGroup.group_id || tempGroup.id) : null;
                      const selectedTempId = tempGroupId ? (selectedCustomizations[tempGroupId] || [])[0] : null;
                      const selectedTempOption = tempGroup?.options?.find(
                        (o) => (o.option_id || o.id) === selectedTempId
                      ) || null;
                      const visibleOptions = isSizeGroupName(group.name)
                        ? (group.options || []).filter((opt) =>
                            isSizeAllowedForTemp(opt.name, selectedTempOption?.name)
                          )
                        : (group.options || []);
                      return (
                        <div key={groupId} className="customization-group required-group">
                          <h4>
                            {group.name}
                            <span className="required-badge">Required</span>
                          </h4>
                          <div className="customization-options-row">
                            {visibleOptions.map(option => {
                              const optionId = option.option_id || option.id;
                              const optPrice = parseFloat(option.price || option.price_per_unit) || 0;
                              const isVariantDriverGroup = hasVariantPricing && (isSizeGroupName(group.name) || isTempGroupName(group.name));
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
                                    {optPrice > 0 && !isVariantDriverGroup && <span className="option-price">+{formatMoney(optPrice)}</span>}
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
                                      <span className="quantity-option-price">
                                        {formatMoney(optPrice)}/{currentAddonGroup.unit_label || 'qty'}
                                      </span>
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
                                      <span className="addon-option-price">+{formatMoney(optPrice)}</span>
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
                <button onClick={() => !isAdding && setShowCustomization(false)} disabled={isAdding} className="btn-cancel">Cancel</button>
                <button onClick={confirmCustomization} disabled={isAdding} className="btn-confirm">
                  {isAdding ? 'Adding...' : 'Add to Cart'}
                </button>
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
                <p>Total: {formatMoney(voidingOrder.total_amount)}</p>
              </div>
              
              <div style={{ width: '80%', margin: '0 auto' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>Reason for voiding: *</label>
                <FilterSelectWrap fullWidth>
                  <select 
                    value={voidReasonType}
                    onChange={(e) => setVoidReasonType(e.target.value)}
                    className="filter-select"
                    style={{ marginBottom: voidReasonType === 'Other - Please specify' ? '10px' : '20px' }}
                  >
                    <option value="" disabled>Select a reason...</option>
                    <option value="Wrong order punched">Wrong order punched</option>
                    <option value="Customer changed mind">Customer changed mind</option>
                    <option value="Payment failed">Payment failed</option>
                    <option value="Test transaction">Test transaction</option>
                    <option value="Other - Please specify">Other - Please specify</option>
                  </select>
                </FilterSelectWrap>
                
                {voidReasonType === 'Other - Please specify' && (
                  <input 
                    type="text"
                    placeholder="Enter custom reason..."
                    value={voidOtherReason}
                    onChange={e => setVoidOtherReason(e.target.value)}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '20px' }}
                  />
                )}
              </div>
              
              <div style={{ width: '80%', margin: '0 auto', backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '8px', border: '1px solid #eee' }}>
                <h4 style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#e74c3c', textAlign: 'center' }}>Admin Authorization PIN Required</h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input
                    type="password"
                    placeholder="Enter 6-digit PIN"
                    value={adminPin}
                    onChange={e => setAdminPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    maxLength={6}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
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

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="modal payment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Cash Payment</h3>
              <button onClick={() => setShowPaymentModal(false)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <div className="payment-total-display">
                <span className="payment-total-label">Total:</span>
                <span className="payment-total-amount">{formatMoney(calculateTotal())}</span>
              </div>

              <div className="payment-cash-section">
                <label>Amount Received:</label>
                <div className="cash-input-row">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={cashAmount}
                    onChange={(e) => { if (e.target.value === '' || /^\d*\.?\d{0,2}$/.test(e.target.value)) setCashAmount(e.target.value); }}
                    placeholder="0.00"
                    autoFocus
                  />
                  <button onClick={clearCash} className="btn-clear-cash">Clear</button>
                </div>

                <label className="quick-select-label">Quick Select:</label>
                <div className="quick-cash-buttons">
                  <button onClick={() => setCashAmount(String(calculateTotal()))} className="quick-cash-btn exact-btn">
                    Exact
                  </button>
                  {[100, 200, 500, 1000].map(amount => (
                    <button key={amount} onClick={() => setCashAmount(String(amount))} className="quick-cash-btn">
                      {formatMoney(amount)}
                    </button>
                  ))}
                </div>

                <div className="payment-change-display">
                  <span className="change-label">Change:</span>
                  <span className="change-amount">{parseFloat(cashAmount) > 0 ? formatMoney(calculateChange()) : formatMoney(0)}</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowPaymentModal(false)} className="btn-cancel">Cancel</button>
              <button
                onClick={handlePayment}
                disabled={loading || !cashAmount || parseFloat(cashAmount) < calculateTotal()}
                className="btn-confirm-payment"
              >
                {loading ? 'Processing...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <Toast toast={toast} onClose={() => setToast({ show: false, message: '', type: 'info' })} />

      {/* Line item adjustment (reason; admin auth for kiosk-loaded orders) */}
      {showItemRemovalModal && removingItem && (
        <div className="modal-overlay" onClick={closeItemRemovalModal}>
          <div className="modal item-removal-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{pendingOrderId ? 'Modify Kiosk Order' : 'Line item adjustment'}</h3>
              <button onClick={closeItemRemovalModal} className="modal-close">×</button>
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
              
              <div style={{ width: '90%', margin: '0 auto' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>Reason for modification: *</label>
                <FilterSelectWrap fullWidth className="item-removal-reason-select-wrap">
                  <select 
                    value={itemRemovalReasonType}
                    onChange={(e) => setItemRemovalReasonType(e.target.value)}
                    className="filter-select"
                    style={{ marginBottom: itemRemovalReasonType === 'Other - Please specify' ? '10px' : '20px' }}
                  >
                    <option value="" disabled>Select a reason...</option>
                    <option value="Customer request">Customer request</option>
                    <option value="Item unavailable">Item unavailable</option>
                    <option value="Wrong item prepared">Wrong item prepared</option>
                    <option value="Other - Please specify">Other - Please specify</option>
                  </select>
                </FilterSelectWrap>
                
                {itemRemovalReasonType === 'Other - Please specify' && (
                  <input 
                    type="text"
                    placeholder="Enter custom reason..."
                    value={itemRemovalOtherReason}
                    onChange={e => setItemRemovalOtherReason(e.target.value)}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '20px' }}
                  />
                )}
              </div>

              {requiresPinForItemRemoval(removingItem) && (
              <div style={{ width: '90%', margin: '0 auto', backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '8px', border: '1px solid #eee' }}>
                <h4 style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#e74c3c', textAlign: 'center' }}>Admin PIN Required</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input 
                    type="password" 
                    value={itemRemovalPin}
                    onChange={(e) => setItemRemovalPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit PIN"
                    inputMode="numeric"
                    maxLength={6}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', boxSizing: 'border-box' }}
                    autoFocus
                  />
                </div>
              </div>
              )}
            </div>
            <div className="modal-footer">
              <button 
                onClick={closeItemRemovalModal} 
                className="btn-cancel"
              >
                Cancel
              </button>
              <button 
                onClick={processItemRemovalWithAuth}
                className="btn-confirm-modify"
                disabled={
                  (() => {
                    const fr = itemRemovalReasonType === 'Other - Please specify' ? itemRemovalOtherReason : itemRemovalReasonType;
                    if (!String(fr || '').trim()) return true;
                    if (requiresPinForItemRemoval(removingItem)) {
                      return !/^\d{6}$/.test(itemRemovalPin);
                    }
                    return false;
                  })()
                }
              >
                Confirm {removingItem.action === 'remove-library' || removingItem.action === 'remove' ? 'Remove' : 'Decrease'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear-cart confirmation (if wired to setConfirmAction with action clear) */}
      {showConfirmModal && confirmAction?.action === 'clear' && (
        <div className="modal-overlay" onClick={() => {
          setShowConfirmModal(false);
          setConfirmAction(null);
        }}>
          <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Clear Cart</h3>
              <button onClick={() => {
                setShowConfirmModal(false);
                setConfirmAction(null);
              }} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to clear all items from the cart?</p>
              <div className="confirm-item-preview">
                <span className="item-name">{confirmAction.itemCount} item(s) will be removed</span>
              </div>
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
                className="btn-void-confirm"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Void Transaction Modal */}
      {showBulkVoidModal && (
        <VoidTransactionModal 
          isOpen={showBulkVoidModal}
          onClose={() => setShowBulkVoidModal(false)}
          cartItems={cart}
          libraryBooking={pendingLibraryBooking}
          onConfirmVoid={handleBulkVoidConfirm}
          isKioskOrder={!!pendingOrderId}
        />
      )}
    </div>
  );
}
