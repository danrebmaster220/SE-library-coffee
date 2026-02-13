// components/OrderDetails.jsx
import { useRouter } from "expo-router";
import { useState, useCallback, useMemo } from "react";
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { BookOpen, Clock } from "lucide-react-native";

import { submitOrder } from "../services/api";
import { useResponsive } from "../hooks/useResponsive";

const OrderDetails = ({
  orders = [],
  removeItem,
  updateQuantity,
  customerName,
  orderType,
  libraryBooking = null,
  onRemoveLibraryBooking = null,
  isPhone: isPhoneProp,
  onClose, // For phone modal close callback
}) => {
  const [isModalVisible, setModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { isPhone: isPhoneHook } = useResponsive();
  
  // Use prop if passed, otherwise use hook
  const isPhone = isPhoneProp !== undefined ? isPhoneProp : isPhoneHook;

  const formattedOrderType = useMemo(() => {
    if (!orderType) return "";
    const lower = orderType.toLowerCase();
    if (lower === "dinein") return "Dine In";
    if (lower === "takeout") return "Take Out";
    if (lower === "dine-in") return "Dine In";
    if (lower === "take-out") return "Take Out";
    return orderType.charAt(0).toUpperCase() + orderType.slice(1);
  }, [orderType]);

  // Memoized calculations
  const total = useMemo(() => {
    return orders.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [orders]);

  const grandTotal = useMemo(() => {
    const libraryTotal = libraryBooking ? libraryBooking.amount : 0;
    return total + libraryTotal;
  }, [total, libraryBooking]);

  // Keep old function names for compatibility
  const getTotal = useCallback(() => total.toFixed(2), [total]);
  const getGrandTotal = useCallback(() => grandTotal.toFixed(2), [grandTotal]);

  const formatDuration = useCallback((minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return `${hours}h ${mins}m`;
  }, []);

  // Generate unique key for an item based on its ID and customizations
  const getItemKey = useCallback((item) => {
    return item.customizationSummary 
      ? (item.item_id + '-' + item.customizationSummary) 
      : (item.item_id + '-standard');
  }, []);

  const renderOrderItem = ({ item }) => (
    <View style={styles.orderItem}>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemName}>{item.name}</Text>
        {item.customizationSummary ? (
          <Text style={styles.customizationText}>
            {item.customizationSummary}
          </Text>
        ) : null}
        <Text style={styles.itemPrice}>₱{item.price.toFixed(2)}</Text>
      </View>

      <View style={styles.quantityControls}>
        <TouchableOpacity
          style={styles.qtyButton}
          onPress={() => updateQuantity(getItemKey(item), item.quantity - 1)}
        >
          <Text style={styles.qtyText}>-</Text>
        </TouchableOpacity>

        <Text style={styles.qtyNumber}>{item.quantity}</Text>

        <TouchableOpacity
          style={styles.qtyButton}
          onPress={() => updateQuantity(getItemKey(item), item.quantity + 1)}
        >
          <Text style={styles.qtyText}>+</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={() => removeItem(getItemKey(item))}>
        <Text style={styles.removeText}>✕</Text>
      </TouchableOpacity>
    </View>
  );

  const handleCheckout = () => setModalVisible(true);

  const handleConfirmOrder = async () => {
    try {
      setIsSubmitting(true);

      // Build order data for API
      const orderData = {
        customer_name: libraryBooking ? libraryBooking.customer_name : customerName,
        order_type: orderType === "Dine-In" ? "dine_in" : "takeout",
        items: orders.map(item => ({
          item_id: item.item_id,
          item_name: item.name || item.item_name,
          quantity: item.quantity,
          unit_price: parseFloat(item.totalPrice || item.price || item.item_price) || 0,
          customizations: item.customizations ? item.customizations.map(c => ({
            option_id: c.option_id,
            option_name: c.option_name || c.name,
            group_name: c.group_name || '',
            quantity: c.quantity || 1,
            unit_price: parseFloat(c.price) || 0,
            total_price: parseFloat(c.price) * (c.quantity || 1) || 0
          })) : [],
        })),
        total_amount: parseFloat(getGrandTotal()),
        // Include library booking if exists
        library_booking: libraryBooking ? {
          seat_id: libraryBooking.seat_id,
          table_number: libraryBooking.table_number,
          seat_number: libraryBooking.seat_number,
          customer_name: libraryBooking.customer_name,
          duration_minutes: libraryBooking.duration_minutes,
          amount: libraryBooking.amount,
        } : null,
      };

      const result = await submitOrder(orderData);
      
      setModalVisible(false);

      // Navigate to order success page with order details
      router.push({
        pathname: "/orderSuccess",
        params: {
          customerName: libraryBooking ? libraryBooking.customer_name : customerName,
          orderType,
          total: getGrandTotal(),
          transactionId: result.transaction_id,
          beeperNumber: result.beeper_number,
          libraryBooking: libraryBooking ? JSON.stringify(libraryBooking) : null,
        },
      });
      
      // Close phone cart modal after successful order
      if (isPhone && onClose) {
        onClose();
      }
    } catch (error) {
      console.error("Order submission error:", error);
      Alert.alert(
        "Order Failed",
        "Failed to submit your order. Please try again.",
        [{ text: "OK" }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, isPhone && styles.containerPhone]}>
      {!isPhone && (
        <>
          <Text style={styles.headerTitle}>Order Details</Text>
          <Text style={styles.customerInfo}>
            <Text style={styles.orderType}>{formattedOrderType}</Text>
          </Text>
        </>
      )}
      
      {/* Phone header showing order type */}
      {isPhone && (
        <Text style={styles.phoneOrderType}>
          <Text style={styles.orderType}>{formattedOrderType}</Text>
        </Text>
      )}

      {/* Library Booking Display */}
      {libraryBooking && (
        <View style={[styles.libraryBookingBox, isPhone && styles.libraryBookingBoxPhone]}>
          <View style={styles.libraryHeaderRow}>
            <View style={styles.libraryHeader}>
              <BookOpen color="#4CAF50" size={18} />
              <Text style={styles.libraryTitle}>Study Area</Text>
            </View>
            {onRemoveLibraryBooking && (
              <TouchableOpacity 
                style={styles.removeLibraryButton}
                onPress={onRemoveLibraryBooking}
              >
                <Text style={styles.removeLibraryText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.libraryDetail}>
            Table {libraryBooking.table_number}, Seat {libraryBooking.seat_number}
          </Text>
          <View style={styles.libraryRow}>
            <Clock color="#666" size={14} />
            <Text style={styles.libraryTime}>
              {formatDuration(libraryBooking.duration_minutes)}
            </Text>
          </View>
          <Text style={styles.libraryPrice}>₱{libraryBooking.amount.toFixed(2)}</Text>
        </View>
      )}

      {orders.length === 0 && !libraryBooking ? (
        <Text style={styles.emptyText}>No items added yet</Text>
      ) : orders.length === 0 ? (
        <Text style={styles.emptyItemsText}>No food/drinks added</Text>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrderItem}
          keyExtractor={(item, index) => item.name + index}
          contentContainerStyle={styles.list}
        />
      )}

      {(orders.length > 0 || libraryBooking) && (
        <View style={styles.footer}>
          {libraryBooking && orders.length > 0 && (
            <View style={styles.subtotalsBox}>
              <Text style={styles.subtotalLine}>Items: ₱{getTotal()}</Text>
              <Text style={styles.subtotalLine}>Study Area: ₱{libraryBooking.amount.toFixed(2)}</Text>
            </View>
          )}
          <Text style={styles.totalText}>Total: ₱{getGrandTotal()}</Text>
          <TouchableOpacity
            style={styles.checkoutButton}
            onPress={handleCheckout}
          >
            <Text style={styles.checkoutText}>Checkout</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Checkout Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Order Summary</Text>
            <Text style={styles.modalCustomer}>
              {libraryBooking && (
                <Text style={styles.modalCustomerName}>{libraryBooking.customer_name} • </Text>
              )}
              <Text style={styles.modalOrderType}>{formattedOrderType}</Text>
            </Text>

            {/* Library Booking in Modal */}
            {libraryBooking && (
              <View style={styles.modalLibraryBox}>
                <View style={styles.modalLibraryHeader}>
                  <BookOpen color="#4CAF50" size={16} />
                  <Text style={styles.modalLibraryTitle}>Study Area Booking</Text>
                </View>
                <Text style={styles.modalLibraryInfo}>
                  Table {libraryBooking.table_number}, Seat {libraryBooking.seat_number}
                </Text>
                <Text style={styles.modalLibraryInfo}>
                  Duration: {formatDuration(libraryBooking.duration_minutes)}
                </Text>
                <Text style={styles.modalLibraryPrice}>₱{libraryBooking.amount.toFixed(2)}</Text>
              </View>
            )}

            {orders.length > 0 && (
              <>
                <Text style={styles.modalSectionTitle}>Items</Text>
                <FlatList
                  data={orders}
                  renderItem={({ item }) => (
                    <View style={styles.modalItem}>
                      <Text style={styles.modalItemName}>
                        {item.name} × {item.quantity}
                      </Text>
                      {item.customizationSummary ? (
                        <Text style={styles.modalItemCustom}>
                          {item.customizationSummary}
                        </Text>
                      ) : null}
                    </View>
                  )}
                  keyExtractor={(item, i) => item.name + i}
                />
              </>
            )}

            {libraryBooking && orders.length > 0 && (
              <View style={styles.modalSubtotals}>
                <Text style={styles.modalSubtotalLine}>Items Subtotal: ₱{getTotal()}</Text>
                <Text style={styles.modalSubtotalLine}>Study Area: ₱{libraryBooking.amount.toFixed(2)}</Text>
              </View>
            )}

            <Text style={styles.modalTotal}>Total: ₱{getGrandTotal()}</Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton, isSubmitting && styles.disabledButton]}
                onPress={handleConfirmOrder}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalButtonText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default OrderDetails;

const styles = StyleSheet.create({
  container: {
    width: 300,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 15,
    marginLeft: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  containerPhone: {
    width: "100%",
    flex: 1,
    marginLeft: 0,
    borderRadius: 0,
    padding: 16,
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#3d2417", marginBottom: 4 },
  customerInfo: { fontSize: 16, color: "#6b4b32", marginBottom: 10 },
  phoneOrderType: { 
    fontSize: 14, 
    color: "#6b4b32", 
    marginBottom: 12,
    textAlign: "center",
  },
  orderType: { fontWeight: "700", color: "#d4af37" },
  list: { paddingBottom: 10 },
  orderItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderColor: "#eee",
    paddingBottom: 8,
  },
  itemName: { fontSize: 16, fontWeight: "600", color: "#3d2417" },
  customizationText: { fontSize: 13, color: "#555", marginTop: 2 },
  itemPrice: { fontSize: 14, color: "#3d2417", marginTop: 4 },
  quantityControls: { flexDirection: "row", alignItems: "center", marginHorizontal: 10 },
  qtyButton: { backgroundColor: "#4C2B18", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  qtyText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  qtyNumber: { fontSize: 16, fontWeight: "600", marginHorizontal: 6 },
  removeText: { color: "#B22222", fontWeight: "bold", fontSize: 18 },
  footer: { marginTop: 10, borderTopWidth: 1, borderColor: "#ddd", paddingTop: 10 },
  totalText: { fontSize: 18, fontWeight: "700", color: "#3d2417", marginBottom: 10 },
  checkoutButton: {
    backgroundColor: "#3d2417",
    paddingVertical: 10,
    borderRadius: 25,
    alignItems: "center",
  },
  checkoutText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  emptyText: { color: "#999", fontStyle: "italic", textAlign: "center", marginTop: 20 },
  emptyItemsText: { color: "#999", fontStyle: "italic", textAlign: "center", marginTop: 10, fontSize: 13 },
  
  // Phone-specific library booking
  libraryBookingBoxPhone: {
    marginHorizontal: 0,
  },

  // Library Booking Styles
  libraryBookingBox: {
    backgroundColor: "#E8F5E9",
    borderRadius: 12,
    padding: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#4CAF50",
  },
  libraryHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  libraryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  libraryTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2E7D32",
  },
  removeLibraryButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ef5350",
    justifyContent: "center",
    alignItems: "center",
  },
  removeLibraryText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  libraryDetail: {
    fontSize: 14,
    color: "#3d2417",
    fontWeight: "600",
  },
  libraryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
  },
  libraryTime: {
    fontSize: 13,
    color: "#666",
  },
  libraryPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2E7D32",
    marginTop: 6,
    textAlign: "right",
  },
  subtotalsBox: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  subtotalLine: {
    fontSize: 13,
    color: "#666",
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    width: "70%",
    padding: 20,
    maxHeight: "80%",
  },
  modalTitle: { fontSize: 22, fontWeight: "700", color: "#3d2417", marginBottom: 8 },
  modalCustomer: { fontSize: 16, color: "#6b4b32", marginBottom: 10 },
  modalCustomerName: { fontWeight: "600", color: "#3d2417" },
  modalOrderType: { fontWeight: "700", color: "#d4af37" },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#888",
    marginTop: 10,
    marginBottom: 5,
  },
  modalItem: { marginBottom: 8 },
  modalItemName: { fontSize: 16, color: "#3d2417" },
  modalItemCustom: { fontSize: 13, color: "#555" },
  modalLibraryBox: {
    backgroundColor: "#E8F5E9",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  modalLibraryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 5,
  },
  modalLibraryTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2E7D32",
  },
  modalLibraryInfo: {
    fontSize: 13,
    color: "#555",
  },
  modalLibraryPrice: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2E7D32",
    textAlign: "right",
    marginTop: 5,
  },
  modalSubtotals: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: "#eee",
  },
  modalSubtotalLine: {
    fontSize: 13,
    color: "#666",
  },
  modalTotal: {
    fontSize: 18,
    fontWeight: "700",
    color: "#3d2417",
    textAlign: "right",
    marginTop: 10,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: "center",
    marginHorizontal: 5,
  },
  cancelButton: { backgroundColor: "#aaa" },
  confirmButton: { backgroundColor: "#3d2417" },
  disabledButton: { backgroundColor: "#999" },
  modalButtonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
