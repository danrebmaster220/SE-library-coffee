// hooks/useResponsive.js - Responsive design hook for phone/tablet detection
import { useWindowDimensions } from "react-native";

/**
 * Custom hook for responsive design across phone and tablet devices
 * 
 * Breakpoints:
 * - Phone: width < 768px (portrait mode)
 * - Tablet: width >= 768px (landscape mode)
 * 
 * @returns {Object} Responsive utilities and screen info
 */
export const useResponsive = () => {
  const { width, height } = useWindowDimensions();

  // Device type detection
  const isPhone = width < 768;
  const isTablet = width >= 768;
  
  // Orientation (mostly for reference)
  const isPortrait = height > width;
  const isLandscape = width > height;

  // Screen size categories for more granular control
  const isSmallPhone = width < 375; // iPhone SE, small Android
  const isMediumPhone = width >= 375 && width < 430; // iPhone standard, most Android
  const isLargePhone = width >= 430 && width < 768; // iPhone Plus/Max, large Android
  const isSmallTablet = width >= 768 && width < 1024; // iPad Mini, small tablets
  const isLargeTablet = width >= 1024; // iPad Pro, large tablets

  // Dynamic spacing based on screen size
  const spacing = {
    xs: isPhone ? 4 : 6,
    sm: isPhone ? 8 : 12,
    md: isPhone ? 12 : 16,
    lg: isPhone ? 16 : 24,
    xl: isPhone ? 24 : 32,
    xxl: isPhone ? 32 : 48,
  };

  // Dynamic font sizes
  const fontSize = {
    xs: isPhone ? 10 : 12,
    sm: isPhone ? 12 : 14,
    md: isPhone ? 14 : 16,
    lg: isPhone ? 16 : 18,
    xl: isPhone ? 18 : 22,
    xxl: isPhone ? 22 : 28,
    title: isPhone ? 24 : 32,
  };

  // Number of columns for grids
  const menuColumns = isPhone ? 2 : 2; // Keep 2 columns but smaller cards
  const tableColumns = isPhone ? 1 : 2; // Library tables grid

  // Component specific sizing
  const sizes = {
    // Sidebar
    sidebarWidth: isPhone ? 0 : 180, // Hidden on phone (use tabs instead)
    
    // Order details panel
    orderPanelWidth: isPhone ? 0 : 300, // Hidden on phone (use bottom sheet)
    
    // Menu item cards
    menuCardMaxWidth: isPhone 
      ? (width - spacing.md * 3) / 2 // 2 cards with gaps
      : 280,
    menuCardImageHeight: isPhone ? 120 : 180,
    
    // Header
    headerHeight: isPhone ? 60 : 80,
    logoSize: isPhone ? 40 : 50,
    
    // Buttons
    buttonHeight: isPhone ? 44 : 52,
    iconSize: isPhone ? 20 : 24,
    
    // Modal
    modalWidth: isPhone ? "95%" : "85%",
    modalMaxWidth: isPhone ? "100%" : 600,
  };

  // Helper function to get responsive value
  const responsive = (phoneValue, tabletValue) => {
    return isPhone ? phoneValue : tabletValue;
  };

  return {
    // Screen dimensions
    width,
    height,
    
    // Device type
    isPhone,
    isTablet,
    
    // Orientation
    isPortrait,
    isLandscape,
    
    // Granular sizes
    isSmallPhone,
    isMediumPhone,
    isLargePhone,
    isSmallTablet,
    isLargeTablet,
    
    // Dynamic values
    spacing,
    fontSize,
    sizes,
    menuColumns,
    tableColumns,
    
    // Helper
    responsive,
  };
};

export default useResponsive;
