import { useState, useEffect, useCallback } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { API_BASE_URL } from "../services/api";
import { useResponsive } from "../hooks/useResponsive";

const CustomizationModal = ({ visible, onClose, item, onAdd }) => {
  const [loading, setLoading] = useState(true);
  const [customizationGroups, setCustomizationGroups] = useState([]);
  const [selections, setSelections] = useState({});
  const [isCustomizable, setIsCustomizable] = useState(false);
  const [activeAddonTab, setActiveAddonTab] = useState(null);
  
  const { isPhone, isLandscape, width, height } = useResponsive();
  const insets = useSafeAreaInsets();
  const isTabletLandscape = !isPhone && isLandscape;

  const fetchItemCustomizations = useCallback(async () => {
    if (!item?.item_id) {
      setLoading(false);
      setIsCustomizable(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(API_BASE_URL + "/customizations/item/" + item.item_id);
      const data = await response.json();
      
      if (data.is_customizable && data.groups && data.groups.length > 0) {
        setIsCustomizable(true);
        setCustomizationGroups(data.groups);
        
        const initialSelections = {};
        data.groups.forEach(group => {
          if (group.selection_type === "single" && group.is_required && group.options?.length > 0) {
            // For REQUIRED single-select groups, NO auto-selection - customer must choose
            initialSelections[group.group_id] = {
              type: "single",
              option: null,
              quantity: 1
            };
          } else if (group.selection_type === "multiple" || group.input_type === "quantity") {
            initialSelections[group.group_id] = {
              type: group.input_type === "quantity" ? "quantity" : "multiple",
              options: {}
            };
          } else if (group.selection_type === "single") {
            // For OPTIONAL single-select groups (like Milk add-on), DO NOT pre-select
            // Customer must explicitly choose to add optional items
            initialSelections[group.group_id] = {
              type: "single",
              option: null,
              quantity: 1
            };
          }
        });
        setSelections(initialSelections);
        
        // Set first addon tab - include all groups except Size and Temperature
        const addonTabGroups = data.groups.filter(g => 
          g.name !== "Size" && g.name !== "Temperature" && (
            g.input_type === "quantity" || 
            g.selection_type === "multiple" ||
            (g.selection_type === "single" && !g.is_required)
          )
        );
        if (addonTabGroups.length > 0) {
          setActiveAddonTab(addonTabGroups[0].name);
        }
      } else {
        setIsCustomizable(false);
        setCustomizationGroups([]);
      }
    } catch (error) {
      console.error("Error fetching customizations:", error);
      setIsCustomizable(false);
    } finally {
      setLoading(false);
    }
  }, [item]);

  useEffect(() => {
    if (visible && item) {
      fetchItemCustomizations();
    }
  }, [visible, item, fetchItemCustomizations]);

  const handleSingleSelect = (group, option) => {
    setSelections(prev => ({
      ...prev,
      [group.group_id]: {
        type: "single",
        option: option,
        quantity: 1
      }
    }));
  };

  const handleToggleSelect = (group, option) => {
    setSelections(prev => {
      const current = prev[group.group_id];
      const isCurrentlySelected = current?.option?.option_id === option.option_id;
      
      if (isCurrentlySelected) {
        return {
          ...prev,
          [group.group_id]: {
            type: "single",
            option: null,
            quantity: 0
          }
        };
      } else {
        return {
          ...prev,
          [group.group_id]: {
            type: "single",
            option: option,
            quantity: 1
          }
        };
      }
    });
  };

  const handleQuantityChange = (group, option, change) => {
    setSelections(prev => {
      const current = prev[group.group_id] || { type: "quantity", options: {} };
      const currentQty = current.options?.[option.option_id]?.quantity || 0;
      const newQty = Math.max(0, Math.min(currentQty + change, option.max_quantity || 10));
      
      return {
        ...prev,
        [group.group_id]: {
          type: "quantity",
          options: {
            ...current.options,
            [option.option_id]: newQty > 0 ? { ...option, quantity: newQty } : null
          }
        }
      };
    });
  };

  const getQuantity = (groupId, optionId) => {
    const groupSelection = selections[groupId];
    if (!groupSelection?.options) return 0;
    return groupSelection.options[optionId]?.quantity || 0;
  };

  const isOptionSelected = (groupId, option) => {
    const groupSelection = selections[groupId];
    if (!groupSelection) return false;
    
    if (groupSelection.type === "single") {
      return groupSelection.option?.option_id === option.option_id;
    }
    
    if (groupSelection.type === "quantity") {
      return (groupSelection.options?.[option.option_id]?.quantity || 0) > 0;
    }
    
    return false;
  };

  const calculatePrice = () => {
    let total = parseFloat(item?.price || item?.item_price || 0);
    
    Object.values(selections).forEach(groupSelection => {
      if (!groupSelection) return;
      
      if (groupSelection.type === "single" && groupSelection.option) {
        total += parseFloat(groupSelection.option.price || 0);
      }
      
      if (groupSelection.type === "quantity" && groupSelection.options) {
        Object.values(groupSelection.options).forEach(opt => {
          if (opt && opt.quantity > 0) {
            const pricePerUnit = parseFloat(opt.price_per_unit || opt.price || 0);
            total += pricePerUnit * opt.quantity;
          }
        });
      }
    });
    
    return total;
  };

  const buildCustomizationSummary = () => {
    const summaryParts = [];
    
    customizationGroups.forEach(group => {
      const groupSelection = selections[group.group_id];
      if (!groupSelection) return;
      
      if (groupSelection.type === "single" && groupSelection.option) {
        summaryParts.push(groupSelection.option.name);
      }
      
      if (groupSelection.type === "quantity" && groupSelection.options) {
        const quantityOptions = Object.values(groupSelection.options).filter(o => o && o.quantity > 0);
        if (quantityOptions.length > 0) {
          summaryParts.push(quantityOptions.map(o => o.name + " x" + o.quantity).join(", "));
        }
      }
    });
    
    return summaryParts.join(" | ") || "No customizations";
  };

  const handleConfirm = () => {
    // Validate required customization groups
    const requiredGroups = customizationGroups.filter(g => g.is_required);
    const missingRequired = [];
    
    requiredGroups.forEach(group => {
      const groupSelection = selections[group.group_id];
      const hasSelection = groupSelection?.option !== null && groupSelection?.option !== undefined;
      if (!hasSelection) {
        missingRequired.push(group.name);
      }
    });
    
    if (missingRequired.length > 0) {
      Alert.alert("Required Selection", `Please select: ${missingRequired.join(", ")}`);
      return;
    }
    
    const customizationArray = [];
    
    Object.entries(selections).forEach(([groupId, groupSelection]) => {
      if (!groupSelection) return;
      
      const group = customizationGroups.find(g => String(g.group_id) === String(groupId));
      const groupName = group?.name || "";
      
      if (groupSelection.type === "single" && groupSelection.option) {
        customizationArray.push({
          option_id: groupSelection.option.option_id,
          option_name: groupSelection.option.name,
          group_name: groupName,
          quantity: 1,
          price: parseFloat(groupSelection.option.price || 0)
        });
      }
      
      if (groupSelection.type === "quantity" && groupSelection.options) {
        Object.values(groupSelection.options).forEach(opt => {
          if (opt && opt.quantity > 0) {
            customizationArray.push({
              option_id: opt.option_id,
              option_name: opt.name,
              group_name: groupName,
              quantity: opt.quantity,
              price: parseFloat(opt.price_per_unit || opt.price || 0)
            });
          }
        });
      }
    });

    const customizedItem = {
      ...item,
      customizations: customizationArray,
      totalPrice: calculatePrice(),
      customizationSummary: buildCustomizationSummary(),
    };
    
    onAdd(customizedItem);
    onClose();
    setSelections({});
  };

  const handleAddWithoutCustomization = () => {
    onAdd({
      ...item,
      totalPrice: parseFloat(item?.price || item?.item_price || 0),
      customizationSummary: "Standard",
    });
    onClose();
  };

  // Categorize groups
  const sizeGroup = customizationGroups.find(g => g.name === "Size");
  const temperatureGroup = customizationGroups.find(g => g.name === "Temperature");
  
  // Add-on tab groups - All groups except Size and Temperature (which are shown in the main section)
  // Includes: quantity-based inputs, single-select non-required, and multiple-select groups
  const addonTabGroups = customizationGroups.filter(g => 
    g.name !== "Size" && g.name !== "Temperature" && (
      g.input_type === "quantity" || 
      g.selection_type === "multiple" ||
      (g.selection_type === "single" && !g.is_required)
    )
  );
  
  const currentAddonGroup = addonTabGroups.find(g => g.name === activeAddonTab);

  const getAddonCount = (groupName) => {
    const group = addonTabGroups.find(g => g.name === groupName);
    if (!group) return 0;
    const groupSelection = selections[group.group_id];
    if (!groupSelection) return 0;
    
    if (groupSelection.type === "quantity" && groupSelection.options) {
      return Object.values(groupSelection.options).filter(o => o && o.quantity > 0).reduce((sum, o) => sum + o.quantity, 0);
    }
    if (groupSelection.type === "single" && groupSelection.option) {
      return 1;
    }
    return 0;
  };

  if (!item) return null;

  const imageUri = item.image || item.image_url || null;
  const peso = "\u20B1";

  // ============ PHONE: FULL SCREEN LAYOUT ============
  if (isPhone) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={phoneStyles.container}>
          {/* HEADER BAR */}
          <View style={[phoneStyles.header, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity style={phoneStyles.backButton} onPress={onClose}>
              <View style={phoneStyles.backArrow}>
                <View style={phoneStyles.arrowLine1} />
                <View style={phoneStyles.arrowLine2} />
              </View>
            </TouchableOpacity>
            <View style={phoneStyles.headerInfo}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={phoneStyles.headerImage} />
              ) : (
                <View style={phoneStyles.headerImagePlaceholder}>
                  <Text style={{ fontSize: 16, color: '#FFF' }}>☕</Text>
                </View>
              )}
              <View style={phoneStyles.headerTextContainer}>
                <Text style={phoneStyles.headerTitle} numberOfLines={1}>{item.name || item.item_name}</Text>
                <Text style={phoneStyles.headerPrice}>Base: {peso}{parseFloat(item.price || item.item_price).toFixed(2)}</Text>
              </View>
            </View>
          </View>

          {loading ? (
            <View style={phoneStyles.loadingContainer}>
              <ActivityIndicator size="large" color="#5D4037" />
              <Text style={phoneStyles.loadingText}>Loading customizations...</Text>
            </View>
          ) : !isCustomizable ? (
            <View style={phoneStyles.noCustomizationContainer}>
              <Text style={phoneStyles.noCustomizationText}>
                This item does not have customization options.
              </Text>
            </View>
          ) : (
            <ScrollView 
              style={phoneStyles.scrollContent} 
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {/* SIZE SECTION */}
              {sizeGroup && (
                <View style={phoneStyles.section}>
                  <View style={phoneStyles.sectionHeader}>
                    <Text style={phoneStyles.sectionTitle}>{sizeGroup.name}</Text>
                    {sizeGroup.is_required && <Text style={phoneStyles.requiredBadge}>Required</Text>}
                  </View>
                  <View style={phoneStyles.optionRow}>
                    {sizeGroup.options?.map((option) => (
                      <TouchableOpacity
                        key={option.option_id}
                        style={[phoneStyles.optionButton, isOptionSelected(sizeGroup.group_id, option) && phoneStyles.selectedOption]}
                        onPress={() => handleSingleSelect(sizeGroup, option)}
                      >
                        <Text style={[phoneStyles.optionText, isOptionSelected(sizeGroup.group_id, option) && phoneStyles.selectedText]}>
                          {option.name}
                        </Text>
                        {parseFloat(option.price) > 0 && (
                          <Text style={[phoneStyles.optionPrice, isOptionSelected(sizeGroup.group_id, option) && phoneStyles.selectedText]}>
                            +{peso}{parseFloat(option.price).toFixed(2)}
                          </Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* TEMPERATURE SECTION */}
              {temperatureGroup && (
                <View style={phoneStyles.section}>
                  <View style={phoneStyles.sectionHeader}>
                    <Text style={phoneStyles.sectionTitle}>{temperatureGroup.name}</Text>
                    {temperatureGroup.is_required && <Text style={phoneStyles.requiredBadge}>Required</Text>}
                  </View>
                  <View style={phoneStyles.optionRow}>
                    {temperatureGroup.options?.map((option) => (
                      <TouchableOpacity
                        key={option.option_id}
                        style={[phoneStyles.optionButton, isOptionSelected(temperatureGroup.group_id, option) && phoneStyles.selectedOption]}
                        onPress={() => handleSingleSelect(temperatureGroup, option)}
                      >
                        <Text style={[phoneStyles.optionText, isOptionSelected(temperatureGroup.group_id, option) && phoneStyles.selectedText]}>
                          {option.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* ADD-ONS SECTION */}
              {addonTabGroups.length > 0 && (
                <View style={phoneStyles.section}>
                  <Text style={phoneStyles.sectionTitle}>Add-ons</Text>
                  
                  {/* Tab Bar */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={phoneStyles.addonTabBar}>
                    {addonTabGroups.map((group) => {
                      const count = getAddonCount(group.name);
                      return (
                        <TouchableOpacity
                          key={group.group_id}
                          style={[phoneStyles.addonTab, activeAddonTab === group.name && phoneStyles.activeAddonTab]}
                          onPress={() => setActiveAddonTab(group.name)}
                        >
                          <Text style={[phoneStyles.addonTabText, activeAddonTab === group.name && phoneStyles.activeAddonTabText]}>
                            {group.name}
                          </Text>
                          {count > 0 && (
                            <View style={phoneStyles.addonBadge}>
                              <Text style={phoneStyles.addonBadgeText}>{count}</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {/* Tab Content */}
                  {currentAddonGroup && (
                    <View style={phoneStyles.addonContent}>
                      {currentAddonGroup.input_type === "quantity" ? (
                        currentAddonGroup.options?.map((option) => (
                          <View key={option.option_id} style={phoneStyles.addonRow}>
                            <View style={phoneStyles.addonInfo}>
                              <Text style={phoneStyles.addonName}>{option.name}</Text>
                              <Text style={phoneStyles.addonPrice}>
                                                        {peso}{parseFloat(option.price_per_unit || option.price).toFixed(2)}/{currentAddonGroup.unit_label || 'qty'}
                              </Text>
                            </View>
                            <View style={phoneStyles.quantityControls}>
                              <TouchableOpacity
                                style={phoneStyles.quantityButton}
                                onPress={() => handleQuantityChange(currentAddonGroup, option, -1)}
                              >
                                <Text style={phoneStyles.quantityButtonText}>-</Text>
                              </TouchableOpacity>
                              <Text style={phoneStyles.quantityValue}>
                                {getQuantity(currentAddonGroup.group_id, option.option_id)}
                              </Text>
                              <TouchableOpacity
                                style={phoneStyles.quantityButton}
                                onPress={() => handleQuantityChange(currentAddonGroup, option, 1)}
                              >
                                <Text style={phoneStyles.quantityButtonText}>+</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))
                      ) : (
                        <View style={phoneStyles.addonOptionsGrid}>
                          {currentAddonGroup.options?.map((option) => (
                            <TouchableOpacity
                              key={option.option_id}
                              style={[phoneStyles.addonOptionButton, isOptionSelected(currentAddonGroup.group_id, option) && phoneStyles.selectedOption]}
                              onPress={() => handleToggleSelect(currentAddonGroup, option)}
                            >
                              <Text style={[phoneStyles.addonOptionText, isOptionSelected(currentAddonGroup.group_id, option) && phoneStyles.selectedText]}>
                                {option.name}
                              </Text>
                              {parseFloat(option.price) > 0 && (
                                <Text style={[phoneStyles.addonOptionPrice, isOptionSelected(currentAddonGroup.group_id, option) && phoneStyles.selectedText]}>
                                  +{peso}{parseFloat(option.price).toFixed(2)}
                                </Text>
                              )}
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          )}

          {/* FIXED FOOTER */}
          <View style={[phoneStyles.footer, { paddingBottom: insets.bottom + 14 }]}>
            <View style={phoneStyles.priceContainer}>
              <Text style={phoneStyles.totalLabel}>Total</Text>
              <Text style={phoneStyles.totalPrice}>{peso}{calculatePrice().toFixed(2)}</Text>
            </View>
            <TouchableOpacity style={phoneStyles.confirmButton} onPress={handleConfirm}>
              <Text style={phoneStyles.confirmButtonText}>Add to Order</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // ============ TABLET: MODAL LAYOUT ============
  // Helper to render customization options (shared between portrait and landscape)
  const renderCustomizationOptions = (s) => (
    <ScrollView 
      style={s.scrollContent} 
      showsVerticalScrollIndicator={true}
      contentContainerStyle={{ paddingBottom: 12 }}
    >
      {/* SIZE SECTION */}
      {sizeGroup && (
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>{sizeGroup.name}</Text>
            {sizeGroup.is_required && <Text style={s.requiredBadge}>Required</Text>}
          </View>
          <View style={s.optionRow}>
            {sizeGroup.options?.map((option) => (
              <TouchableOpacity
                key={option.option_id}
                style={[s.optionButton, isOptionSelected(sizeGroup.group_id, option) && s.selectedOption]}
                onPress={() => handleSingleSelect(sizeGroup, option)}
              >
                <Text style={[s.optionText, isOptionSelected(sizeGroup.group_id, option) && s.selectedText]}>
                  {option.name}
                </Text>
                {parseFloat(option.price) > 0 && (
                  <Text style={[s.optionPrice, isOptionSelected(sizeGroup.group_id, option) && s.selectedText]}>
                    +{peso}{parseFloat(option.price).toFixed(2)}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* TEMPERATURE SECTION */}
      {temperatureGroup && (
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>{temperatureGroup.name}</Text>
            {temperatureGroup.is_required && <Text style={s.requiredBadge}>Required</Text>}
          </View>
          <View style={s.optionRow}>
            {temperatureGroup.options?.map((option) => (
              <TouchableOpacity
                key={option.option_id}
                style={[s.optionButton, isOptionSelected(temperatureGroup.group_id, option) && s.selectedOption]}
                onPress={() => handleSingleSelect(temperatureGroup, option)}
              >
                <Text style={[s.optionText, isOptionSelected(temperatureGroup.group_id, option) && s.selectedText]}>
                  {option.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* ADD-ONS SECTION WITH TABS */}
      {addonTabGroups.length > 0 && (
        <View style={s.addonSection}>
          <Text style={s.addonSectionTitle}>Add-ons</Text>
          
          {/* Tab Bar */}
          <View style={s.addonTabBar}>
            {addonTabGroups.map((group) => {
              const count = getAddonCount(group.name);
              return (
                <TouchableOpacity
                  key={group.group_id}
                  style={[s.addonTab, activeAddonTab === group.name && s.activeAddonTab]}
                  onPress={() => setActiveAddonTab(group.name)}
                >
                  <Text style={[s.addonTabText, activeAddonTab === group.name && s.activeAddonTabText]}>
                    {group.name}
                  </Text>
                  {count > 0 && (
                    <View style={s.addonBadge}>
                      <Text style={s.addonBadgeText}>{count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Tab Content */}
          {currentAddonGroup && (
            <View style={s.addonContent}>
              {currentAddonGroup.input_type === "quantity" ? (
                currentAddonGroup.options?.map((option) => (
                  <View key={option.option_id} style={s.addonRow}>
                    <View style={s.addonInfo}>
                      <Text style={s.addonName}>{option.name}</Text>
                      <Text style={s.addonPrice}>
                                                {peso}{parseFloat(option.price_per_unit || option.price).toFixed(2)}/{currentAddonGroup.unit_label || 'qty'}
                      </Text>
                    </View>
                    <View style={s.quantityControls}>
                      <TouchableOpacity
                        style={s.quantityButton}
                        onPress={() => handleQuantityChange(currentAddonGroup, option, -1)}
                      >
                        <Text style={s.quantityButtonText}>-</Text>
                      </TouchableOpacity>
                      <Text style={s.quantityValue}>
                        {getQuantity(currentAddonGroup.group_id, option.option_id)}
                      </Text>
                      <TouchableOpacity
                        style={s.quantityButton}
                        onPress={() => handleQuantityChange(currentAddonGroup, option, 1)}
                      >
                        <Text style={s.quantityButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              ) : (
                <View style={s.addonOptionsGrid}>
                  {currentAddonGroup.options?.map((option) => (
                    <TouchableOpacity
                      key={option.option_id}
                      style={[s.addonOptionButton, isOptionSelected(currentAddonGroup.group_id, option) && s.selectedOption]}
                      onPress={() => handleToggleSelect(currentAddonGroup, option)}
                    >
                      <Text style={[s.addonOptionText, isOptionSelected(currentAddonGroup.group_id, option) && s.selectedText]}>
                        {option.name}
                      </Text>
                      {parseFloat(option.price) > 0 && (
                        <Text style={[s.addonOptionPrice, isOptionSelected(currentAddonGroup.group_id, option) && s.selectedText]}>
                          +{peso}{parseFloat(option.price).toFixed(2)}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );

  // Pick the right style set based on orientation
  const s = isTabletLandscape ? landscapeStyles : styles;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={s.overlay}>
        <View style={[s.modalContainer, isTabletLandscape && { width: width * 0.88, maxWidth: 960, height: height * 0.9 }]}>
          <TouchableOpacity style={s.closeButton} onPress={onClose}>
            <Text style={s.closeButtonText}>X</Text>
          </TouchableOpacity>

          {loading ? (
            <View style={s.loadingContainer}>
              <ActivityIndicator size="large" color="#5D4037" />
              <Text style={s.loadingText}>Loading customizations...</Text>
            </View>
          ) : !isCustomizable ? (
            <View style={isTabletLandscape ? s.landscapeBody : s.noCustomizationContainer}>
              {isTabletLandscape ? (
                <>
                  <View style={s.leftPanel}>
                    {imageUri ? (
                      <Image source={{ uri: imageUri }} style={s.productImage} />
                    ) : (
                      <View style={s.imageContainer}>
                        <Text style={s.imagePlaceholder}>...</Text>
                      </View>
                    )}
                    <Text style={s.title}>{item.name || item.item_name}</Text>
                    <Text style={s.noCustomizationText}>
                      This item does not have customization options.
                    </Text>
                  </View>
                  <View style={s.rightPanel}>
                    <View style={{ flex: 1 }} />
                    <View style={s.footer}>
                      <View style={s.priceContainer}>
                        <Text style={s.totalLabel}>Total:</Text>
                        <Text style={s.totalPrice}>{peso}{parseFloat(item.price || item.item_price).toFixed(2)}</Text>
                      </View>
                      <TouchableOpacity style={s.confirmButton} onPress={handleAddWithoutCustomization}>
                        <Text style={s.confirmButtonText}>Add to Order</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <View style={s.productHeader}>
                    {imageUri ? (
                      <Image source={{ uri: imageUri }} style={s.productImage} />
                    ) : (
                      <View style={s.imageContainer}>
                        <Text style={s.imagePlaceholder}>...</Text>
                      </View>
                    )}
                    <Text style={s.title}>{item.name || item.item_name}</Text>
                    <Text style={s.noCustomizationText}>
                      This item does not have customization options.
                    </Text>
                  </View>
                  <View style={s.footer}>
                    <View style={s.priceContainer}>
                      <Text style={s.totalLabel}>Total:</Text>
                      <Text style={s.totalPrice}>{peso}{parseFloat(item.price || item.item_price).toFixed(2)}</Text>
                    </View>
                    <TouchableOpacity style={s.confirmButton} onPress={handleAddWithoutCustomization}>
                      <Text style={s.confirmButtonText}>Add to Order</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          ) : isTabletLandscape ? (
            /* ======= LANDSCAPE TABLET: HORIZONTAL LAYOUT ======= */
            <View style={s.landscapeBody}>
              {/* LEFT PANEL - Product Info */}
              <View style={s.leftPanel}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={s.productImage} />
                ) : (
                  <View style={s.imageContainer}>
                    <Text style={s.imagePlaceholder}>...</Text>
                  </View>
                )}
                <Text style={s.title}>{item.name || item.item_name}</Text>
                <Text style={s.basePrice}>Base: {peso}{parseFloat(item.price || item.item_price).toFixed(2)}</Text>
                
                {/* Price + Add button in left panel bottom */}
                <View style={s.leftPanelFooter}>
                  <Text style={s.totalLabel}>Total</Text>
                  <Text style={s.totalPrice}>{peso}{calculatePrice().toFixed(2)}</Text>
                  <TouchableOpacity style={s.confirmButton} onPress={handleConfirm}>
                    <Text style={s.confirmButtonText}>Add to Order</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* RIGHT PANEL - Customization Options */}
              <View style={s.rightPanel}>
                {renderCustomizationOptions(s)}
              </View>
            </View>
          ) : (
            /* ======= PORTRAIT TABLET: VERTICAL LAYOUT (original) ======= */
            <View style={s.contentWrapper}>
              {/* FIXED HEADER */}
              <View style={s.fixedHeader}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={s.productImage} />
                ) : (
                  <View style={s.imageContainer}>
                    <Text style={s.imagePlaceholder}>...</Text>
                  </View>
                )}
                <Text style={s.title}>{item.name || item.item_name}</Text>
                <Text style={s.basePrice}>Base Price: {peso}{parseFloat(item.price || item.item_price).toFixed(2)}</Text>
              </View>

              {/* SCROLLABLE CONTENT */}
              {renderCustomizationOptions(s)}

              {/* FIXED FOOTER */}
              <View style={s.footer}>
                <View style={s.priceContainer}>
                  <Text style={s.totalLabel}>Total:</Text>
                  <Text style={s.totalPrice}>{peso}{calculatePrice().toFixed(2)}</Text>
                </View>
                <TouchableOpacity style={s.confirmButton} onPress={handleConfirm}>
                  <Text style={s.confirmButtonText}>Add to Order</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "#FFF",
    borderRadius: 24,
    width: "85%",
    maxWidth: 600,
    maxHeight: "90%",
    overflow: "hidden",
  },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  closeButtonText: {
    fontSize: 16,
    color: "#666",
    fontWeight: "600",
  },
  loadingContainer: {
    padding: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "#8D6E63",
    fontSize: 14,
  },
  noCustomizationContainer: {
    padding: 20,
  },
  noCustomizationText: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    marginTop: 12,
  },
  contentWrapper: {
    flex: 1,
    maxHeight: "100%",
  },
  fixedHeader: {
    alignItems: "center",
    paddingTop: 30,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0E6DC",
    backgroundColor: "#FFF",
  },
  productHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  productImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 12,
  },
  imageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#F5E6D3",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  imagePlaceholder: {
    fontSize: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#3E2723",
    textAlign: "center",
  },
  basePrice: {
    fontSize: 15,
    color: "#8D6E63",
    marginTop: 4,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#5D4037",
    flex: 1,
  },
  requiredBadge: {
    fontSize: 11,
    color: "#FFF",
    backgroundColor: "#FF9800",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: "hidden",
    fontWeight: "600",
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  optionButton: {
    flex: 1,
    minWidth: "45%",
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    alignItems: "center",
  },
  selectedOption: {
    backgroundColor: "#5D4037",
    borderColor: "#5D4037",
  },
  optionText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#3E2723",
  },
  optionPrice: {
    fontSize: 12,
    color: "#8D6E63",
    marginTop: 2,
  },
  selectedText: {
    color: "#FFF",
  },
  addonSection: {
    marginBottom: 20,
  },
  addonSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#5D4037",
    marginBottom: 12,
  },
  addonTabBar: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: "#E8E0D8",
    marginBottom: 16,
  },
  addonTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    position: "relative",
  },
  activeAddonTab: {
    borderBottomWidth: 3,
    borderBottomColor: "#5D4037",
    marginBottom: -2,
  },
  addonTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#A0A0A0",
  },
  activeAddonTabText: {
    color: "#5D4037",
  },
  addonBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#FF9800",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
  },
  addonBadgeText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "700",
  },
  addonContent: {
    gap: 10,
  },
  addonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FAF7F4",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8E0D8",
  },
  addonInfo: {
    flex: 1,
  },
  addonName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#3E2723",
  },
  addonPrice: {
    fontSize: 13,
    color: "#8D6E63",
    marginTop: 2,
  },
  addonOptionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  addonOptionButton: {
    flex: 1,
    minWidth: "45%",
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    alignItems: "center",
  },
  addonOptionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3E2723",
    textAlign: "center",
  },
  addonOptionPrice: {
    fontSize: 11,
    color: "#8D6E63",
    marginTop: 2,
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  quantityButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#5D4037",
    justifyContent: "center",
    alignItems: "center",
  },
  quantityButtonText: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "600",
    lineHeight: 24,
  },
  quantityValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#3E2723",
    minWidth: 30,
    textAlign: "center",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#E8E0D8",
    backgroundColor: "#FFF",
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: "#8D6E63",
  },
  totalPrice: {
    fontSize: 26,
    fontWeight: "700",
    color: "#3E2723",
  },
  confirmButton: {
    backgroundColor: "#5D4037",
    paddingVertical: 16,
    paddingHorizontal: 36,
    borderRadius: 14,
  },
  confirmButtonText: {
    color: "#FFF",
    fontSize: 17,
    fontWeight: "700",
  },
});

// ============ TABLET LANDSCAPE STYLES ============
const landscapeStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    overflow: "hidden",
    flexDirection: "column",
  },
  closeButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  closeButtonText: {
    fontSize: 16,
    color: "#666",
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    padding: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "#8D6E63",
    fontSize: 14,
  },
  noCustomizationContainer: {
    padding: 20,
  },
  noCustomizationText: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    marginTop: 12,
  },
  // Horizontal layout container
  landscapeBody: {
    flex: 1,
    flexDirection: "row",
  },
  // Left panel: product info
  leftPanel: {
    width: 240,
    backgroundColor: "#FAF7F4",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 28,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderRightWidth: 1,
    borderRightColor: "#F0E6DC",
  },
  productImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 12,
  },
  imageContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#F5E6D3",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  imagePlaceholder: {
    fontSize: 40,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#3E2723",
    textAlign: "center",
    marginBottom: 4,
  },
  basePrice: {
    fontSize: 14,
    color: "#8D6E63",
    marginBottom: 8,
  },
  leftPanelFooter: {
    marginTop: "auto",
    alignItems: "center",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E8E0D8",
    width: "100%",
  },
  // Right panel: scrollable options
  rightPanel: {
    flex: 1,
    flexDirection: "column",
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  section: {
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#5D4037",
    flex: 1,
  },
  requiredBadge: {
    fontSize: 11,
    color: "#FFF",
    backgroundColor: "#FF9800",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: "hidden",
    fontWeight: "600",
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionButton: {
    flex: 1,
    minWidth: "30%",
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    alignItems: "center",
  },
  selectedOption: {
    backgroundColor: "#5D4037",
    borderColor: "#5D4037",
  },
  optionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3E2723",
  },
  optionPrice: {
    fontSize: 12,
    color: "#8D6E63",
    marginTop: 2,
  },
  selectedText: {
    color: "#FFF",
  },
  addonSection: {
    marginBottom: 14,
  },
  addonSectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#5D4037",
    marginBottom: 10,
  },
  addonTabBar: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: "#E8E0D8",
    marginBottom: 12,
  },
  addonTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    position: "relative",
  },
  activeAddonTab: {
    borderBottomWidth: 3,
    borderBottomColor: "#5D4037",
    marginBottom: -2,
  },
  addonTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#A0A0A0",
  },
  activeAddonTabText: {
    color: "#5D4037",
  },
  addonBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "#FF9800",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
  },
  addonBadgeText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "700",
  },
  addonContent: {
    gap: 8,
  },
  addonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FAF7F4",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E8E0D8",
  },
  addonInfo: {
    flex: 1,
  },
  addonName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3E2723",
  },
  addonPrice: {
    fontSize: 12,
    color: "#8D6E63",
    marginTop: 2,
  },
  addonOptionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  addonOptionButton: {
    flex: 1,
    minWidth: "30%",
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    alignItems: "center",
  },
  addonOptionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#3E2723",
    textAlign: "center",
  },
  addonOptionPrice: {
    fontSize: 11,
    color: "#8D6E63",
    marginTop: 2,
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  quantityButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#5D4037",
    justifyContent: "center",
    alignItems: "center",
  },
  quantityButtonText: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "600",
    lineHeight: 22,
  },
  quantityValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#3E2723",
    minWidth: 28,
    textAlign: "center",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#E8E0D8",
    backgroundColor: "#FFF",
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  totalLabel: {
    fontSize: 13,
    color: "#8D6E63",
  },
  totalPrice: {
    fontSize: 24,
    fontWeight: "700",
    color: "#3E2723",
  },
  confirmButton: {
    backgroundColor: "#5D4037",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    marginTop: 10,
    alignSelf: "stretch",
    alignItems: "center",
  },
  confirmButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  productHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  contentWrapper: {
    flex: 1,
  },
  fixedHeader: {
    alignItems: "center",
    paddingTop: 28,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0E6DC",
    backgroundColor: "#FFF",
  },
});

// ============ PHONE FULL-SCREEN STYLES ============
const phoneStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF7F4",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#5D4037",
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  backArrow: {
    width: 12,
    height: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  arrowLine1: {
    position: "absolute",
    width: 10,
    height: 2,
    backgroundColor: "#FFF",
    transform: [{ rotate: "-45deg" }, { translateY: -3 }],
  },
  arrowLine2: {
    position: "absolute",
    width: 10,
    height: 2,
    backgroundColor: "#FFF",
    transform: [{ rotate: "45deg" }, { translateY: 3 }],
  },
  headerInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  headerImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  headerImagePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  headerPrice: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FAF7F4",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#8D6E63",
  },
  noCustomizationContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#FAF7F4",
  },
  noCustomizationText: {
    fontSize: 14,
    color: "#8D6E63",
    textAlign: "center",
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: "#FAF7F4",
  },
  section: {
    marginBottom: 20,
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#5D4037",
    flex: 1,
  },
  requiredBadge: {
    fontSize: 10,
    color: "#FFF",
    backgroundColor: "#FF9800",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: "hidden",
    fontWeight: "600",
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionButton: {
    flex: 1,
    minWidth: "45%",
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    alignItems: "center",
  },
  selectedOption: {
    backgroundColor: "#5D4037",
    borderColor: "#5D4037",
  },
  optionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#3E2723",
  },
  optionPrice: {
    fontSize: 11,
    color: "#8D6E63",
    marginTop: 2,
  },
  selectedText: {
    color: "#FFF",
  },
  addonTabBar: {
    marginBottom: 12,
    marginTop: 4,
  },
  addonTab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: "#F0E6DC",
    borderRadius: 16,
    marginRight: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  activeAddonTab: {
    backgroundColor: "#5D4037",
  },
  addonTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#5D4037",
  },
  activeAddonTabText: {
    color: "#FFF",
  },
  addonBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FF9800",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 6,
  },
  addonBadgeText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "bold",
  },
  addonContent: {
    backgroundColor: "#FAFAFA",
    borderRadius: 10,
    padding: 12,
  },
  addonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0E6DC",
  },
  addonInfo: {
    flex: 1,
  },
  addonName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#3E2723",
  },
  addonPrice: {
    fontSize: 11,
    color: "#8D6E63",
    marginTop: 2,
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#5D4037",
    justifyContent: "center",
    alignItems: "center",
  },
  quantityButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  quantityValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#3E2723",
    minWidth: 24,
    textAlign: "center",
  },
  addonOptionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  addonOptionButton: {
    flex: 1,
    minWidth: "45%",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#FFF",
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    alignItems: "center",
  },
  addonOptionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#3E2723",
    textAlign: "center",
  },
  addonOptionPrice: {
    fontSize: 10,
    color: "#8D6E63",
    marginTop: 2,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFF",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: "#E8E0D8",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 5,
  },
  priceContainer: {
    flexDirection: "column",
  },
  totalLabel: {
    fontSize: 12,
    color: "#8D6E63",
  },
  totalPrice: {
    fontSize: 22,
    fontWeight: "700",
    color: "#3E2723",
  },
  confirmButton: {
    backgroundColor: "#5D4037",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  confirmButtonText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "700",
  },
});

export default CustomizationModal;
