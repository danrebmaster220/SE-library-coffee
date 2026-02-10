import { FlatList, StyleSheet, Text, View } from "react-native";
import MenuItemCard from "./MenuItemCard";
import { useResponsive } from "../hooks/useResponsive";

const MenuContent = ({ items = [], onAddToOrder, selectedCategory, isPhone: isPhoneProp }) => {
  const { isPhone: isPhoneHook } = useResponsive();
  
  // Use prop if passed, otherwise use hook
  const isPhone = isPhoneProp !== undefined ? isPhoneProp : isPhoneHook;
  
  const keyExtractor = (item) =>
    String(item.id || item.item_id || item.name || Math.random());

  return (
    <View style={styles.container}>
      {/* Hide category title on phone since we show it in tabs */}
      {!isPhone && (
        <Text style={styles.categoryTitle}>{selectedCategory}</Text>
      )}

      <FlatList
        data={items}
        keyExtractor={keyExtractor}
        numColumns={2}
        key={isPhone ? 'phone-grid' : 'tablet-grid'} // Force re-render on layout change
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={[styles.rowSpacing, isPhone && styles.rowSpacingPhone]}
        renderItem={({ item }) => (
          <MenuItemCard item={item} onAddToOrder={onAddToOrder} isPhone={isPhone} />
        )}
        contentContainerStyle={[styles.listPadding, isPhone && styles.listPaddingPhone]}
      />
    </View>
  );
};

export default MenuContent;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 10,
  },
  categoryTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#3d2417",
    textAlign: "center",
    marginBottom: 15,
  },
  rowSpacing: {
    justifyContent: "space-between",
    marginBottom: 12,
  },
  rowSpacingPhone: {
    marginBottom: 8,
    gap: 8,
    paddingHorizontal: 4,
  },
  listPadding: {
    paddingBottom: 80,
  },
  listPaddingPhone: {
    paddingBottom: 100, // Extra space for floating cart button
  },
});