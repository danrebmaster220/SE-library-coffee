// components/MenuItemCard.jsx
import React, { useState, useCallback, memo } from "react";
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";

import CustomizationModal from "./CustomizationModal";
import { useResponsive } from "../hooks/useResponsive";

const MenuItemCard = memo(({ item, onAddToOrder, isPhone: isPhoneProp, fillWebCellWidth = false }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const { width } = useWindowDimensions();
  const { isPhone: isPhoneHook } = useResponsive();
  
  // Use prop if passed, otherwise use hook
  const isPhone = isPhoneProp !== undefined ? isPhoneProp : isPhoneHook;

  // Support both backend & local fields
  const name = item.name || item.item_name || "Unnamed Item";
  const imageUri = item.image || item.image_url || null;

  const kind = item.menu_price_kind;
  const base = Number(item.price || item.item_price || 0);
  const resolved = item.menu_price;
  const priceNum =
    resolved != null && !Number.isNaN(Number(resolved)) ? Number(resolved) : base;

  let priceLine = `₱${priceNum.toFixed(2)}`;
  if (kind === "from") {
    priceLine = item.menu_price_label || `From ₱${priceNum.toFixed(2)}`;
  } else if (kind === "unavailable") {
    priceLine = "—";
  } else if (kind === "exact" || kind === "base" || kind == null) {
    priceLine = `₱${priceNum.toFixed(2)}`;
  }

  // Dynamic card width for phone native (web uses CSS grid in MenuContent; fixed width breaks layout)
  const phoneCardWidth = Platform.OS === "web" ? null : (width - 48) / 2;

  // Memoized handlers
  const handleOpenModal = useCallback(() => setModalVisible(true), []);
  const handleCloseModal = useCallback(() => setModalVisible(false), []);
  const handleAddItem = useCallback((customizedItem) => {
    onAddToOrder(customizedItem);
    setModalVisible(false);
  }, [onAddToOrder]);

  return (
    <View
      style={[
        styles.card,
        isPhone && {
          ...styles.cardPhone,
          ...(phoneCardWidth != null ? { width: phoneCardWidth } : {}),
        },
        /* Web grid: parent cell has width but no height — flex:1 collapses to 0 on RN-web (tablet). */
        fillWebCellWidth &&
          Platform.OS === "web" && {
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            flexShrink: 1,
            flex: 0,
            alignSelf: "stretch",
          },
      ]}
    >
      {imageUri ? (
        <Image 
          source={{ uri: imageUri }} 
          style={[styles.image, isPhone && styles.imagePhone]} 
        />
      ) : (
        <View style={[styles.placeholder, isPhone && styles.placeholderPhone]}>
          <Text style={[styles.placeholderText, isPhone && styles.placeholderTextPhone]}>
            No Image
          </Text>
        </View>
      )}

      <View style={[styles.info, isPhone && styles.infoPhone]}>
        <Text 
          style={[styles.name, isPhone && styles.namePhone]} 
          numberOfLines={2}
        >
          {name}
        </Text>
        <Text style={[styles.price, isPhone && styles.pricePhone]}>
          {priceLine}
        </Text>

        <TouchableOpacity
          style={[styles.button, isPhone && styles.buttonPhone, kind === "unavailable" && styles.buttonDisabled]}
          onPress={handleOpenModal}
          disabled={kind === "unavailable"}
        >
          <Text style={[styles.buttonText, isPhone && styles.buttonTextPhone]}>Order</Text>
        </TouchableOpacity>

        <CustomizationModal
          visible={modalVisible}
          item={item}
          onClose={handleCloseModal}
          onAdd={handleAddItem}
          menuBranch={item._menuBranch || null}
        />
      </View>
    </View>
  );
});

// Set display name for React DevTools
MenuItemCard.displayName = 'MenuItemCard';

export default MenuItemCard;

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: "#FFFDF9",
    borderRadius: 20,
    margin: 6,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E8DFD5",
    alignItems: "center",
  },
  cardPhone: {
    flex: 0,
    maxWidth: "100%",
    margin: 0,
    borderRadius: 16,
  },
  image: {
    width: "100%",
    height: 180,
  },
  imagePhone: {
    height: 100,
  },
  placeholder: {
    width: "100%",
    height: 180,
    backgroundColor: "#F5EDE5",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderPhone: {
    height: 100,
  },
  placeholderText: {
    color: "#A89080",
    fontSize: 14,
  },
  placeholderTextPhone: {
    fontSize: 12,
  },
  info: {
    width: "100%",
    padding: 14,
    alignItems: "center",
  },
  infoPhone: {
    padding: 10,
  },
  name: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
    color: "#4C2B18",
    textAlign: "center",
  },
  namePhone: {
    fontSize: 14,
    marginBottom: 2,
    minHeight: 34, // 2 lines at 14px + line spacing
  },
  price: {
    fontSize: 16,
    fontWeight: "600",
    color: "#8B5E34",
    marginBottom: 12,
  },
  pricePhone: {
    fontSize: 14,
    marginBottom: 8,
  },
  button: {
    backgroundColor: "#6B4423",
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 25,
  },
  buttonPhone: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  buttonTextPhone: {
    fontSize: 13,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
});
