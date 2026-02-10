import { useLocalSearchParams } from "expo-router";
import { useState, useEffect, useRef } from "react";
import { 
  StyleSheet, 
  View, 
  ActivityIndicator, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  Modal,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ShoppingCart, X, ChevronLeft, ChevronRight } from "lucide-react-native";

import Header from "../../components/Header";
import MenuContent from "../../components/MenuContent";
import OrderDetails from "../../components/OrderDetails";
import Sidebar from "../../components/Sidebar";
import { useResponsive } from "../../hooks/useResponsive";

import { getCategories, getMenuItems } from "../../services/api";

export default function MenuPage() {
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
  const handleRemoveLibraryBooking = () => {
    setCurrentLibraryBooking(null);
  };

  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [showCartModal, setShowCartModal] = useState(false); // For phone cart modal
  
  // For category scroll indicators
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const categoryScrollRef = useRef(null);

  // Handle category scroll to show/hide arrows
  const handleCategoryScroll = (event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const scrollX = contentOffset.x;
    const maxScrollX = contentSize.width - layoutMeasurement.width;
    
    // Show left arrow if scrolled past 10px
    setShowLeftArrow(scrollX > 10);
    // Show right arrow if not at the end (with 10px threshold)
    setShowRightArrow(scrollX < maxScrollX - 10);
  };

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories();
  }, []);

  // Fetch items when category changes
  useEffect(() => {
    if (selectedCategory) {
      fetchItemsForCategory(selectedCategory);
    }
  }, [selectedCategory]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const cats = await getCategories();
      setCategories(cats);
      
      // Auto-select first category
      if (cats.length > 0) {
        setSelectedCategory(cats[0].name);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchItemsForCategory = async (categoryName) => {
    try {
      setLoadingItems(true);
      
      // Find the category ID
      const category = categories.find(
        cat => cat.name === categoryName
      );
      
      if (category) {
        const items = await getMenuItems(category.category_id);
        setMenuItems(items);
      } else {
        setMenuItems([]);
      }
    } catch (error) {
      console.error("Error fetching items:", error);
      setMenuItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  // Add item or increase quantity
  const handleAddToOrder = (item) => {
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
  };

  // Remove item from order
  const removeItem = (itemKey) => {
    setOrders((prev) => prev.filter((item) => {
      const key = item.customizationSummary 
        ? `${item.item_id}-${item.customizationSummary}`
        : `${item.item_id}-standard`;
      return key !== itemKey;
    }));
  };

  // Update item quantity
  const updateQuantity = (itemKey, newQuantity) => {
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
  };

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

  // Calculate total items in cart for badge
  const totalCartItems = orders.reduce((sum, item) => sum + item.quantity, 0);
  const totalCartAmount = orders.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Include library booking amount in total
  const libraryBookingAmount = currentLibraryBooking?.amount || 0;
  const grandTotal = totalCartAmount + libraryBookingAmount;
  
  // Show cart if there are items OR a library booking
  const hasCartContent = totalCartItems > 0 || currentLibraryBooking;

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

        {/* Menu Content */}
        <View style={styles.phoneMenuContainer}>
          {loadingItems ? (
            <View style={styles.loadingItemsContainer}>
              <ActivityIndicator size="large" color="#4C2B18" />
              <Text style={styles.loadingText}>Loading items...</Text>
            </View>
          ) : (
            <MenuContent
              items={menuItems}
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
        <Sidebar
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          categories={categories}
        />

        {loadingItems ? (
          <View style={styles.loadingItemsContainer}>
            <ActivityIndicator size="large" color="#4C2B18" />
            <Text style={styles.loadingText}>Loading items...</Text>
          </View>
        ) : (
          <MenuContent
            items={menuItems}
            onAddToOrder={handleAddToOrder}
            selectedCategory={selectedCategory}
            isPhone={isPhone}
          />
        )}

        <OrderDetails
          orders={orders}
          removeItem={removeItem}
          updateQuantity={updateQuantity}
          customerName={customerName}
          orderType={orderType}
          libraryBooking={currentLibraryBooking}
          onRemoveLibraryBooking={handleRemoveLibraryBooking}
          isPhone={isPhone}
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
    padding: 10,
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
});
