import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { 
  StyleSheet, 
  View, 
  ActivityIndicator, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  BackHandler,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ShoppingCart, X, ChevronLeft, ChevronRight, Search } from "lucide-react-native";
import { io } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";

import Header from "../../components/Header";
import MenuContent from "../../components/MenuContent";
import OrderDetails from "../../components/OrderDetails";
import Sidebar from "../../components/Sidebar";
import { useResponsive } from "../../hooks/useResponsive";

import { getCategories, getMenuItems, API_BASE_URL } from "../../services/api";

// AsyncStorage keys for cart persistence
const CART_STORAGE_KEY = '@kiosk_cart_items';
const BOOKING_STORAGE_KEY = '@kiosk_library_booking';

export default function MenuPage() {
  const router = useRouter();
  const { customerName = "Guest", orderType = "Dine-In", libraryBooking } = useLocalSearchParams();
  const { isPhone } = useResponsive();
  const insets = useSafeAreaInsets();

  // Parse and store library booking in state (so it can be removed)
  const [currentLibraryBooking, setCurrentLibraryBooking] = useState(() => {
    if (libraryBooking) {
      try {
        return JSON.parse(libraryBooking);
      } catch (e) {
        console.error("Error parsing library booking:", e);
        return null;
      }
    }
    return null;
  });
  
  // Function to remove library booking
  const handleRemoveLibraryBooking = useCallback(() => {
    setCurrentLibraryBooking(null);
  }, []);

  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cartRestored, setCartRestored] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [showCartModal, setShowCartModal] = useState(false); // For phone cart modal
  
  // For category scroll indicators
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const categoryScrollRef = useRef(null);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  /** Iced / Hot branch (only for categories with allow_iced / allow_hot) */
  const [branchMode, setBranchMode] = useState('all'); // 'all' | 'iced' | 'hot'
  const [icedSize, setIcedSize] = useState(null); // null | 'medium' | 'large'

  // Handle category scroll to show/hide arrows
  const handleCategoryScroll = useCallback((event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const scrollX = contentOffset.x;
    const maxScrollX = contentSize.width - layoutMeasurement.width;
    
    // Show left arrow if scrolled past 10px
    setShowLeftArrow(scrollX > 10);
    // Show right arrow if not at the end (with 10px threshold)
    setShowRightArrow(scrollX < maxScrollX - 10);
  }, []);

  // Listen for real-time seat updates
  useEffect(() => {
    if (!currentLibraryBooking) return;

    const socketUrl = API_BASE_URL.replace('/api', '');
    const socket = io(socketUrl, { transports: ['polling', 'websocket'] });

    socket.on('connect', () => {
      socket.emit('join:library');
    });

    socket.on('library:seats-update', (data) => {
      // If our currently selected seat got occupied by someone else (not active from us!)
      if (data && data.seat_id === currentLibraryBooking.seat_id && data.status === 'occupied') {
        Alert.alert(
          "Seat Reserved", 
          "Your selected seat was just reserved by someone else. Your selection has been cleared. Please choose another seat before checking out."
        );
        setCurrentLibraryBooking(null);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [currentLibraryBooking]);

  // Restore cart from AsyncStorage on mount
  useEffect(() => {
    const restoreCart = async () => {
      try {
        const savedCart = await AsyncStorage.getItem(CART_STORAGE_KEY);
        const savedBooking = await AsyncStorage.getItem(BOOKING_STORAGE_KEY);
        if (savedCart) {
          const parsedCart = JSON.parse(savedCart);
          if (Array.isArray(parsedCart) && parsedCart.length > 0) {
            setOrders(parsedCart);
          }
        }
        if (savedBooking && !currentLibraryBooking) {
          const parsedBooking = JSON.parse(savedBooking);
          if (parsedBooking) {
            setCurrentLibraryBooking(parsedBooking);
          }
        }
      } catch (e) {
        console.log('Failed to restore cart:', e);
      } finally {
        setCartRestored(true);
      }
    };
    restoreCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save cart to AsyncStorage whenever orders or booking changes
  useEffect(() => {
    if (!cartRestored) return; // Don't save until initial restore is done
    const saveCart = async () => {
      try {
        await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(orders));
        if (currentLibraryBooking) {
          await AsyncStorage.setItem(BOOKING_STORAGE_KEY, JSON.stringify(currentLibraryBooking));
        } else {
          await AsyncStorage.removeItem(BOOKING_STORAGE_KEY);
        }
      } catch (e) {
        console.log('Failed to save cart:', e);
      }
    };
    saveCart();
  }, [orders, currentLibraryBooking, cartRestored]);

  // Clear saved cart (called after successful order submission)
  const clearSavedCart = useCallback(async () => {
    try {
      await AsyncStorage.multiRemove([CART_STORAGE_KEY, BOOKING_STORAGE_KEY]);
    } catch (e) {
      console.log('Failed to clear saved cart:', e);
    }
  }, []);

  // Intercept hardware back button
  useEffect(() => {
    const onBackPress = () => {
      if (orders.length > 0 || currentLibraryBooking) {
        Alert.alert(
          "Leave Menu?",
          "Your cart items will be saved. You can return to continue your order.",
          [
            { text: "Stay", style: "cancel" },
            {
              text: "Go Back",
              onPress: () => {
                // Cart is already auto-saved via the useEffect above
                router.back();
              },
            },
          ]
        );
        return true; // Prevent default back
      }
      return false; // Allow default back if cart is empty
    };

    const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => subscription.remove();
  }, [orders, currentLibraryBooking, router]);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const cats = await getCategories();
      const allCategory = { category_id: 'all', name: 'All' };
      const catsWithAll = [allCategory, ...cats];
      
      setCategories(catsWithAll);
      
      // Auto-select first category
      if (catsWithAll.length > 0) {
        setSelectedCategory(catsWithAll[0].name);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchItemsForCategory = useCallback(async () => {
    if (!selectedCategory) return;
    try {
      setLoadingItems(true);
      const branchQuery = {};
      if (selectedCategory !== 'All') {
        const cat = categories.find((c) => c.name === selectedCategory);
        const hasBranch =
          cat &&
          (Number(cat.allow_iced ?? 1) === 1 || Number(cat.allow_hot ?? 1) === 1);
        if (hasBranch) {
          if (branchMode === 'iced') {
            if (icedSize === 'medium' || icedSize === 'large') {
              branchQuery.temp = 'iced';
              branchQuery.size = icedSize;
            } else {
              branchQuery.temp = 'iced';
            }
          } else if (branchMode === 'hot') {
            branchQuery.temp = 'hot';
          }
        }
      }

      if (selectedCategory === 'All') {
        const items = await getMenuItems(null, {});
        setMenuItems(items);
      } else {
        const category = categories.find((cat) => cat.name === selectedCategory);
        if (category) {
          const items = await getMenuItems(category.category_id, branchQuery);
          setMenuItems(items);
        } else {
          setMenuItems([]);
        }
      }
    } catch (error) {
      console.error('Error fetching items:', error);
      setMenuItems([]);
    } finally {
      setLoadingItems(false);
    }
  }, [selectedCategory, categories, branchMode, icedSize]);

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    setBranchMode('all');
    setIcedSize(null);
  }, [selectedCategory]);

  useEffect(() => {
    if (selectedCategory && categories.length > 0) {
      fetchItemsForCategory();
    }
  }, [selectedCategory, categories, branchMode, icedSize, fetchItemsForCategory]);

  // Add item or increase quantity
  const handleAddToOrder = useCallback((item) => {
    setOrders((prev) => {
      // Create unique key using item_id and customization summary
      const itemKey = item.customizationSummary 
        ? `${item.item_id}-${item.customizationSummary}`
        : `${item.item_id}-standard`;
      
      const exists = prev.find((order) => {
        const orderKey = order.customizationSummary 
          ? `${order.item_id}-${order.customizationSummary}`
          : `${order.item_id}-standard`;
        return orderKey === itemKey;
      });

      if (exists) {
        return prev.map((order) => {
          const orderKey = order.customizationSummary 
            ? `${order.item_id}-${order.customizationSummary}`
            : `${order.item_id}-standard`;
          return orderKey === itemKey
            ? { ...order, quantity: order.quantity + 1 }
            : order;
        });
      }
      
      return [...prev, { 
        ...item, 
        quantity: 1,
        // Ensure price is set correctly
        price: item.totalPrice || item.price || item.item_price || 0,
        name: item.name || item.item_name,
      }];
    });
  }, []);

  // Remove item from order
  const removeItem = useCallback((itemKey) => {
    setOrders((prev) => prev.filter((item) => {
      const key = item.customizationSummary 
        ? `${item.item_id}-${item.customizationSummary}`
        : `${item.item_id}-standard`;
      return key !== itemKey;
    }));
  }, []);

  // Update item quantity
  const updateQuantity = useCallback((itemKey, newQuantity) => {
    setOrders((prev) =>
      prev
        .map((item) => {
          const key = item.customizationSummary 
            ? `${item.item_id}-${item.customizationSummary}`
            : `${item.item_id}-standard`;
          return key === itemKey ? { ...item, quantity: newQuantity } : item;
        })
        .filter((item) => item.quantity > 0)
    );
  }, []);

  const menuBranchForModal = useMemo(() => {
    if (selectedCategory === 'All') return null;
    const cat = categories.find((c) => c.name === selectedCategory);
    if (!cat) return null;
    const hasBranch =
      Number(cat.allow_iced ?? 1) === 1 || Number(cat.allow_hot ?? 1) === 1;
    if (!hasBranch) return null;
    if (branchMode === 'all') return null;
    if (branchMode === 'hot') return { temp: 'hot' };
    if (branchMode === 'iced') {
      if (icedSize === 'medium' || icedSize === 'large') {
        return { temp: 'iced', size: icedSize };
      }
      return { temp: 'iced' };
    }
    return null;
  }, [selectedCategory, categories, branchMode, icedSize]);

  const itemsForGrid = useMemo(() => {
    return menuItems.map((it) => ({ ...it, _menuBranch: menuBranchForModal }));
  }, [menuItems, menuBranchForModal]);

  const filteredMenuItems = useMemo(() => {
    if (!searchQuery.trim()) return itemsForGrid;
    const query = searchQuery.toLowerCase();
    return itemsForGrid.filter((item) =>
      (item.name || item.item_name || '').toLowerCase().includes(query)
    );
  }, [itemsForGrid, searchQuery]);

  const currentCategoryObj = categories.find((c) => c.name === selectedCategory);
  const showBranchBar =
    selectedCategory !== 'All' &&
    currentCategoryObj &&
    (Number(currentCategoryObj.allow_iced ?? 1) === 1 ||
      Number(currentCategoryObj.allow_hot ?? 1) === 1);

  // Memoized cart calculations - must be before any conditional returns
  const totalCartItems = useMemo(() => {
    return orders.reduce((sum, item) => sum + item.quantity, 0);
  }, [orders]);

  const totalCartAmount = useMemo(() => {
    return orders.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }, [orders]);
  
  // Include library booking amount in total
  const libraryBookingAmount = currentLibraryBooking?.amount || 0;
  const grandTotal = useMemo(() => {
    return totalCartAmount + libraryBookingAmount;
  }, [totalCartAmount, libraryBookingAmount]);
  
  // Show cart if there are items OR a library booking
  const hasCartContent = totalCartItems > 0 || currentLibraryBooking;

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4C2B18" />
          <Text style={styles.loadingText}>Loading menu...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // PHONE LAYOUT: Stack vertically with bottom cart button
  if (isPhone) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <Header customerName={customerName} orderType={orderType} isPhone={isPhone} />
        
        {/* Horizontal Category Tabs for Phone with Scroll Indicators */}
        <View style={styles.phoneCategoryContainer}>
          {/* Left Arrow Indicator */}
          {showLeftArrow && (
            <View style={styles.scrollArrowLeft}>
              <ChevronLeft color="#4C2B18" size={20} />
            </View>
          )}
          
          <ScrollView 
            ref={categoryScrollRef}
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.phoneCategoryScroll}
            onScroll={handleCategoryScroll}
            scrollEventThrottle={16}
          >
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.category_id}
                style={[
                  styles.phoneCategoryTab,
                  selectedCategory === cat.name && styles.phoneCategoryTabActive
                ]}
                onPress={() => setSelectedCategory(cat.name)}
              >
                <Text style={[
                  styles.phoneCategoryText,
                  selectedCategory === cat.name && styles.phoneCategoryTextActive
                ]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          {/* Right Arrow Indicator */}
          {showRightArrow && (
            <View style={styles.scrollArrowRight}>
              <ChevronRight color="#4C2B18" size={20} />
            </View>
          )}
        </View>

        {showBranchBar && (
          <View style={styles.branchSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.branchScroll}>
              <TouchableOpacity
                style={[styles.branchChip, branchMode === 'all' && styles.branchChipActive]}
                onPress={() => { setBranchMode('all'); setIcedSize(null); }}
              >
                <Text style={[styles.branchChipText, branchMode === 'all' && styles.branchChipTextActive]}>All</Text>
              </TouchableOpacity>
              {Number(currentCategoryObj.allow_iced ?? 1) === 1 && (
                <TouchableOpacity
                  style={[styles.branchChip, branchMode === 'iced' && styles.branchChipActive]}
                  onPress={() => setBranchMode('iced')}
                >
                  <Text style={[styles.branchChipText, branchMode === 'iced' && styles.branchChipTextActive]}>Iced</Text>
                </TouchableOpacity>
              )}
              {Number(currentCategoryObj.allow_hot ?? 1) === 1 && (
                <TouchableOpacity
                  style={[styles.branchChip, branchMode === 'hot' && styles.branchChipActive]}
                  onPress={() => { setBranchMode('hot'); setIcedSize(null); }}
                >
                  <Text style={[styles.branchChipText, branchMode === 'hot' && styles.branchChipTextActive]}>Hot</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
            {branchMode === 'iced' && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.branchScrollSecond}>
                <Text style={styles.branchSubLabel}>Size:</Text>
                <TouchableOpacity
                  style={[styles.branchChipSmall, icedSize === null && styles.branchChipSmallMuted]}
                  onPress={() => setIcedSize(null)}
                >
                  <Text style={styles.branchChipText}>Any</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.branchChipSmall, icedSize === 'medium' && styles.branchChipActive]}
                  onPress={() => setIcedSize('medium')}
                >
                  <Text style={[styles.branchChipText, icedSize === 'medium' && styles.branchChipTextActive]}>Medium</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.branchChipSmall, icedSize === 'large' && styles.branchChipActive]}
                  onPress={() => setIcedSize('large')}
                >
                  <Text style={[styles.branchChipText, icedSize === 'large' && styles.branchChipTextActive]}>Large</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        )}

        {/* Search Bar for Phone */}
        <View style={styles.phoneSearchContainer}>
          <View style={styles.phoneSearchWrapper}>
            <Search color="#8b6b5d" size={18} />
            <TextInput
              style={styles.phoneSearchInput}
              placeholder="Search menu..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#8b6b5d"
            />
            {searchQuery.trim() !== '' && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                <X color="#8b6b5d" size={16} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Menu Content */}
        <View style={styles.phoneMenuContainer}>
          {loadingItems ? (
            <View style={styles.loadingItemsContainer}>
              <ActivityIndicator size="large" color="#4C2B18" />
              <Text style={styles.loadingText}>Loading items...</Text>
            </View>
          ) : (
            <MenuContent
              items={filteredMenuItems}
              onAddToOrder={handleAddToOrder}
              selectedCategory={selectedCategory}
              isPhone={isPhone}
            />
          )}
        </View>

        {/* Floating Cart Button for Phone - shows if items OR library booking */}
        {hasCartContent && (
          <TouchableOpacity
            style={[styles.floatingCartButton, { bottom: 16 + insets.bottom }]}
            onPress={() => setShowCartModal(true)}
          >
            <View style={styles.floatingCartContent}>
              <View style={styles.floatingCartLeft}>
                <ShoppingCart color="#fff" size={22} />
                {totalCartItems > 0 && (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>{totalCartItems}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.floatingCartText}>View Cart</Text>
              <Text style={styles.floatingCartPrice}>₱{grandTotal.toFixed(2)}</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Cart Modal for Phone */}
        <Modal
          visible={showCartModal}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowCartModal(false)}
        >
          <SafeAreaView style={styles.cartModalContainer} edges={['top', 'bottom', 'left', 'right']}>
            <View style={styles.cartModalHeader}>
              <Text style={styles.cartModalTitle}>Your Order</Text>
              <TouchableOpacity
                style={styles.cartModalClose}
                onPress={() => setShowCartModal(false)}
              >
                <X color="#3d2417" size={24} />
              </TouchableOpacity>
            </View>
            <OrderDetails
              orders={orders}
              removeItem={removeItem}
              updateQuantity={updateQuantity}
              customerName={customerName}
              orderType={orderType}
              libraryBooking={currentLibraryBooking}
              onRemoveLibraryBooking={handleRemoveLibraryBooking}
              isPhone={isPhone}
              onClose={() => setShowCartModal(false)}
              onOrderSuccess={clearSavedCart}
            />
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    );
  }

  // TABLET LAYOUT: Original 3-column layout
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <Header customerName={customerName} orderType={orderType} isPhone={isPhone} />

      <View style={styles.container}>
        <View style={styles.tabletSidebarContainer}>
          <Sidebar
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            categories={categories}
            style={styles.tabletSidebar}
          />
        </View>

        <View style={styles.tabletMainContent}>
          {showBranchBar && (
            <View style={styles.branchSectionTablet}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.branchScroll}>
                <TouchableOpacity
                  style={[styles.branchChip, branchMode === 'all' && styles.branchChipActive]}
                  onPress={() => { setBranchMode('all'); setIcedSize(null); }}
                >
                  <Text style={[styles.branchChipText, branchMode === 'all' && styles.branchChipTextActive]}>All</Text>
                </TouchableOpacity>
                {Number(currentCategoryObj.allow_iced ?? 1) === 1 && (
                  <TouchableOpacity
                    style={[styles.branchChip, branchMode === 'iced' && styles.branchChipActive]}
                    onPress={() => setBranchMode('iced')}
                  >
                    <Text style={[styles.branchChipText, branchMode === 'iced' && styles.branchChipTextActive]}>Iced</Text>
                  </TouchableOpacity>
                )}
                {Number(currentCategoryObj.allow_hot ?? 1) === 1 && (
                  <TouchableOpacity
                    style={[styles.branchChip, branchMode === 'hot' && styles.branchChipActive]}
                    onPress={() => { setBranchMode('hot'); setIcedSize(null); }}
                  >
                    <Text style={[styles.branchChipText, branchMode === 'hot' && styles.branchChipTextActive]}>Hot</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
              {branchMode === 'iced' && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.branchScrollSecond}>
                  <Text style={styles.branchSubLabel}>Size:</Text>
                  <TouchableOpacity
                    style={[styles.branchChipSmall, icedSize === null && styles.branchChipSmallMuted]}
                    onPress={() => setIcedSize(null)}
                  >
                    <Text style={styles.branchChipText}>Any</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.branchChipSmall, icedSize === 'medium' && styles.branchChipActive]}
                    onPress={() => setIcedSize('medium')}
                  >
                    <Text style={[styles.branchChipText, icedSize === 'medium' && styles.branchChipTextActive]}>Medium</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.branchChipSmall, icedSize === 'large' && styles.branchChipActive]}
                    onPress={() => setIcedSize('large')}
                  >
                    <Text style={[styles.branchChipText, icedSize === 'large' && styles.branchChipTextActive]}>Large</Text>
                  </TouchableOpacity>
                </ScrollView>
              )}
            </View>
          )}
          {/* Tablet Search Bar */}
          <View style={styles.tabletSearchContainer}>
            <View style={styles.tabletSearchWrapper}>
              <Search color="#8b6b5d" size={18} />
              <TextInput
                style={styles.tabletSearchInput}
                placeholder="Search menu..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#8b6b5d"
              />
              {searchQuery.trim() !== '' && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                  <X color="#8b6b5d" size={16} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {loadingItems ? (
            <View style={styles.loadingItemsContainer}>
              <ActivityIndicator size="large" color="#4C2B18" />
              <Text style={styles.loadingText}>Loading items...</Text>
            </View>
          ) : (
            <MenuContent
              items={filteredMenuItems}
              onAddToOrder={handleAddToOrder}
              selectedCategory={selectedCategory}
              isPhone={isPhone}
            />
          )}
        </View>

        <OrderDetails
          orders={orders}
          removeItem={removeItem}
          updateQuantity={updateQuantity}
          customerName={customerName}
          orderType={orderType}
          libraryBooking={currentLibraryBooking}
          onRemoveLibraryBooking={handleRemoveLibraryBooking}
          isPhone={isPhone}
          onOrderSuccess={clearSavedCart}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F1EBDF",
  },
  container: {
    flex: 1,
    flexDirection: "row",
    paddingTop: 6,
    paddingHorizontal: 6,
    paddingBottom: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingItemsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#4C2B18",
  },
  
  // Phone-specific styles
  phoneCategoryContainer: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0d5c9",
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  phoneCategoryScroll: {
    paddingHorizontal: 32,
    paddingVertical: 10,
    gap: 8,
  },
  phoneCategoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f5f0eb",
    marginRight: 8,
  },
  phoneCategoryTabActive: {
    backgroundColor: "#4C2B18",
  },
  phoneCategoryText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b4b32",
  },
  phoneCategoryTextActive: {
    color: "#fff",
  },
  
  // Scroll arrow indicators
  scrollArrowLeft: {
    position: "absolute",
    left: 4,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    paddingHorizontal: 4,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  scrollArrowRight: {
    position: "absolute",
    right: 4,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    paddingHorizontal: 4,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  
  phoneMenuContainer: {
    flex: 1,
    padding: 8,
  },
  
  // Floating cart button
  floatingCartButton: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "#4C2B18",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingCartContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  floatingCartLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  cartBadge: {
    backgroundColor: "#e74c3c",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: -8,
    marginTop: -12,
  },
  cartBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  floatingCartText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  floatingCartPrice: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  
  // Cart modal styles
  cartModalContainer: {
    flex: 1,
    backgroundColor: "#F1EBDF",
  },
  cartModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0d5c9",
  },
  cartModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#3d2417",
  },
  cartModalClose: {
    padding: 8,
  },
  
  // Search Bar Styles
  phoneSearchContainer: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e0d5c9",
  },
  phoneSearchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1EBDF",
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 40,
  },
  phoneSearchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: "#4C2B18",
  },
  tabletSidebarContainer: {
    width: 170,
    flexDirection: "column",
  },
  tabletSearchContainer: {
    marginBottom: 10,
  },
  tabletSearchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabletSearchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: "#4C2B18",
  },
  tabletSidebar: {
    flex: 1,
  },
  tabletMainContent: {
    flex: 1,
    flexDirection: 'column',
    paddingHorizontal: 4,
  },
  clearSearchBtn: {
    padding: 4,
  },
  branchSection: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0d5c9',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  branchSectionTablet: {
    marginBottom: 8,
  },
  branchScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  branchScrollSecond: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  branchSubLabel: {
    fontSize: 13,
    color: '#6b4b32',
    fontWeight: '600',
    marginRight: 4,
  },
  branchChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#f5f0eb',
    borderWidth: 1,
    borderColor: '#e0d5c9',
  },
  branchChipSmall: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f5f0eb',
    borderWidth: 1,
    borderColor: '#e0d5c9',
  },
  branchChipSmallMuted: {
    borderStyle: 'dashed',
  },
  branchChipActive: {
    backgroundColor: '#4C2B18',
    borderColor: '#4C2B18',
  },
  branchChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b4b32',
  },
  branchChipTextActive: {
    color: '#fff',
  },
});
