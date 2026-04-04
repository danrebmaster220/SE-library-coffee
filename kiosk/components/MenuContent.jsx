import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MenuItemCard from "./MenuItemCard";
import { useResponsive } from "../hooks/useResponsive";

const MenuContent = ({
  items = [],
  onAddToOrder,
  selectedCategory,
  isPhone: isPhoneProp,
  branchFilters = null,
}) => {
  const { isPhone: isPhoneHook } = useResponsive();

  const isPhone = isPhoneProp !== undefined ? isPhoneProp : isPhoneHook;

  /** Real width of this menu column (not full window — required for tablet web middle column). */
  const [columnWidth, setColumnWidth] = useState(0);
  const columnRef = useRef(null);

  const applyMeasuredWidth = useCallback((w) => {
    if (w > 0) {
      setColumnWidth((prev) => (Math.abs(w - prev) > 0.5 ? w : prev));
    }
  }, []);

  const onMenuColumnLayout = useCallback(
    (e) => {
      applyMeasuredWidth(e.nativeEvent.layout.width);
    },
    [applyMeasuredWidth]
  );

  /** RN-web: onLayout alone often stays 0 for flex row children; re-measure after commit + on resize. */
  useLayoutEffect(() => {
    if (Platform.OS !== "web") return;

    const measureNow = () => {
      const node = columnRef.current;
      if (!node) return;
      if (typeof node.measure === "function") {
        node.measure((x, y, w) => {
          applyMeasuredWidth(w);
        });
        return;
      }
      const w =
        typeof node.offsetWidth === "number"
          ? node.offsetWidth
          : node.getBoundingClientRect?.()?.width;
      applyMeasuredWidth(w);
    };

    measureNow();
    const raf = requestAnimationFrame(measureNow);
    const onResize = () => measureNow();
    if (typeof window !== "undefined") {
      window.addEventListener("resize", onResize);
    }
    return () => {
      cancelAnimationFrame(raf);
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", onResize);
      }
    };
  }, [applyMeasuredWidth, selectedCategory, items.length]);

  const keyExtractor = (item) =>
    String(item.id || item.item_id || item.name || Math.random());

  const showHeading = selectedCategory && selectedCategory !== "All";

  const headerBlock = (
    <>
      {showHeading && (
        <Text
          style={[styles.categoryTitle, isPhone && styles.categoryTitlePhone]}
          numberOfLines={2}
        >
          {selectedCategory}
        </Text>
      )}
      {branchFilters}
    </>
  );

  /**
   * Web: VirtualizedList is unreliable in Chrome; use ScrollView + map.
   * Grid width MUST come from onLayout — using window.innerWidth sizes for the full screen,
   * so on iPad web the middle column is ~400px but the grid was ~1000px → clipped / blank.
   */
  if (Platform.OS === "web") {
    const pad = 8;
    const gap = 8;
    const contentW = Math.max(1, columnWidth - pad * 2);
    const itemW = Math.max(1, Math.floor((contentW - gap) / 2));

    return (
      <View
        ref={columnRef}
        style={[styles.container, styles.webColumn]}
        onLayout={onMenuColumnLayout}
        collapsable={false}
      >
        {columnWidth <= 0 ? (
          <View style={styles.webMeasuring}>
            <ActivityIndicator size="large" color="#4C2B18" />
          </View>
        ) : (
          <ScrollView
            style={styles.webScroll}
            contentContainerStyle={[
              styles.webScrollInner,
              /* RN-web: flexGrow on scroll content lets the grid flex to fill and can zero-out card rows on tablet. */
              isPhone && styles.webScrollInnerGrow,
              styles.listPadding,
              isPhone && styles.listPaddingPhone,
              { paddingHorizontal: pad },
            ]}
            showsVerticalScrollIndicator
          >
            {headerBlock}
            <View
              style={[
                styles.webGrid,
                {
                  width: contentW,
                  alignSelf: "center",
                  gap,
                },
              ]}
            >
              {items.map((item) => (
                <View key={keyExtractor(item)} style={{ width: itemW }}>
                  <MenuItemCard
                    item={item}
                    onAddToOrder={onAddToOrder}
                    isPhone={isPhone}
                    fillWebCellWidth
                  />
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showHeading && (
        <Text
          style={[styles.categoryTitle, isPhone && styles.categoryTitlePhone]}
          numberOfLines={2}
        >
          {selectedCategory}
        </Text>
      )}
      {branchFilters}

      <FlatList
        data={items}
        keyExtractor={keyExtractor}
        numColumns={2}
        key={isPhone ? "phone-grid" : "tablet-grid"}
        style={styles.nativeList}
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
    minHeight: 0,
    width: "100%",
    paddingHorizontal: 2,
  },
  webColumn: {
    minWidth: 0,
    alignSelf: "stretch",
  },
  webMeasuring: {
    flex: 1,
    minHeight: 160,
    justifyContent: "center",
    alignItems: "center",
  },
  webScroll: {
    flex: 1,
    minHeight: 0,
    width: "100%",
  },
  webScrollInner: {
    paddingBottom: 8,
  },
  webScrollInnerGrow: {
    flexGrow: 1,
  },
  webGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  nativeList: {
    flex: 1,
    minHeight: 0,
  },
  categoryTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#3d2417",
    textAlign: "center",
    marginBottom: 10,
  },
  categoryTitlePhone: {
    fontSize: 18,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  rowSpacing: {
    justifyContent: "flex-start",
    marginBottom: 4,
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
    paddingBottom: 100,
  },
});
