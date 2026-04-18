import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View, ScrollView, useWindowDimensions, BackHandler } from "react-native";
import { useMemo, useEffect, useState, useRef } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useResponsive } from "../hooks/useResponsive";
import { getTaxDisplay } from "../services/api";

const OrderSuccess = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { customerName, orderType, transactionId, beeperNumber, libraryBooking } = params;
  const { height } = useWindowDimensions();
  const { isPhone } = useResponsive();

  // Parse library booking if exists
  const parsedLibraryBooking = useMemo(() => {
    if (libraryBooking) {
      try {
        return JSON.parse(libraryBooking);
      } catch (_e) {
        return null;
      }
    }
    return null;
  }, [libraryBooking]);

  // Use beeper number from backend as display number
  const displayNumber = beeperNumber || transactionId || "---";

  // Get customer display name (prefer library booking name)
  const displayName = parsedLibraryBooking?.customer_name || customerName;

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return `${hours}h ${mins}m`;
  };

  const handleContinue = () => {
    // Navigate back to home screen
    router.replace("/");
  };

  useEffect(() => {
    const onBackPress = () => {
      router.replace("/");
      return true; // Prevent default behavior
    };
    const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => subscription.remove();
  }, [router]);

  // Auto-redirect countdown (10 seconds)
  const [countdown, setCountdown] = useState(10);
  const countdownRef = useRef(null);
  const [vatInclusiveNote, setVatInclusiveNote] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getTaxDisplay().then((t) => {
      if (cancelled || !t?.vat_enabled) return;
      const r = Math.round(Number(t.vat_rate_percent) || 0);
      setVatInclusiveNote(`Prices include VAT (${r}%)`);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          router.replace("/");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [router]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <TouchableOpacity 
        style={styles.container} 
        activeOpacity={1}
        onPress={handleContinue}
      >
        <ScrollView 
          contentContainerStyle={[styles.scrollContent, { minHeight: height - 100 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, isPhone && styles.cardPhone]}>
            {/* Success Icon */}
            <View style={[styles.iconContainer, isPhone && styles.iconContainerPhone]}>
              <Text style={[styles.checkmark, isPhone && styles.checkmarkPhone]}>✓</Text>
            </View>

            {/* Title */}
            <Text style={[styles.title, isPhone && styles.titlePhone]}>Order Placed!</Text>
            <Text style={styles.subtitle}>Returning to home in {countdown}s...</Text>
            <Text style={styles.subtitleHint}>Tap anywhere to continue</Text>

            {/* Main Content Row */}
            <View style={styles.contentRow}>
              {/* Order Number Box */}
              <View style={[styles.orderBox, isPhone && styles.orderBoxPhone]}>
                <Text style={styles.orderLabel}>Order Number</Text>
                <Text style={[styles.orderNumber, isPhone && styles.orderNumberPhone]}>
                  #{displayNumber}
                </Text>
                <Text style={styles.cashierText}>Please proceed to the cashier for payment</Text>
                {vatInclusiveNote ? (
                  <Text style={styles.vatNote}>{vatInclusiveNote}</Text>
                ) : null}
              </View>

              {/* Library Booking Info - only show if exists */}
              {parsedLibraryBooking && (
                <View style={styles.libraryBox}>
                  <Text style={styles.libraryTitle}>📚 Study Area Reserved</Text>
                  <Text style={styles.libraryInfo}>
                    {parsedLibraryBooking.table_name || `Table ${parsedLibraryBooking.table_number}`}, Seat {parsedLibraryBooking.seat_number}
                  </Text>
                <Text style={styles.libraryDuration}>
                  Duration: {formatDuration(parsedLibraryBooking.duration_minutes)}
                </Text>
                <Text style={styles.libraryNote}>
                  Your session will start after payment
                </Text>
              </View>
            )}
          </View>

          {/* Order Info Footer */}
          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>Customer: {displayName}</Text>
            <Text style={styles.infoText}>Type: {orderType}</Text>
          </View>
        </View>
      </ScrollView>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default OrderSuccess;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#4C2B18",
  },
  container: {
    flex: 1,
    backgroundColor: "#4C2B18",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    width: "100%",
    maxWidth: 500,
  },
  cardPhone: {
    padding: 20,
    borderRadius: 16,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: "#4ADE80",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  iconContainerPhone: {
    width: 50,
    height: 50,
    marginBottom: 12,
  },
  checkmark: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "bold",
  },
  checkmarkPhone: {
    fontSize: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#4C2B18",
    marginBottom: 4,
  },
  titlePhone: {
    fontSize: 22,
  },
  subtitle: {
    fontSize: 14,
    color: "#D4AF37",
    marginBottom: 4,
    fontWeight: "600",
  },
  subtitleHint: {
    fontSize: 12,
    color: "#999",
    marginBottom: 20,
  },
  contentRow: {
    width: "100%",
    gap: 12,
  },
  orderBox: {
    backgroundColor: "#5D3A22",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    alignItems: "center",
  },
  orderBoxPhone: {
    padding: 16,
    borderRadius: 12,
  },
  orderLabel: {
    fontSize: 14,
    color: "#D4AF37",
    marginBottom: 8,
    fontWeight: "500",
  },
  orderNumber: {
    fontSize: 64,
    fontWeight: "bold",
    color: "#fff",
    marginVertical: 4,
  },
  orderNumberPhone: {
    fontSize: 48,
  },
  cashierText: {
    fontSize: 13,
    color: "#D4AF37",
    marginTop: 8,
    textAlign: "center",
  },
  vatNote: {
    fontSize: 12,
    color: "#C4B5A0",
    marginTop: 10,
    textAlign: "center",
  },
  libraryBox: {
    backgroundColor: "#E8F5E9",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    borderWidth: 2,
    borderColor: "#4CAF50",
    alignItems: "center",
  },
  libraryTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2E7D32",
    marginBottom: 8,
  },
  libraryInfo: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  libraryDuration: {
    fontSize: 14,
    color: "#555",
    marginTop: 4,
  },
  libraryNote: {
    fontSize: 12,
    color: "#666",
    marginTop: 8,
    fontStyle: "italic",
  },
  infoContainer: {
    marginTop: 16,
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    width: "100%",
  },
  infoText: {
    fontSize: 14,
    color: "#6b4b32",
    marginBottom: 2,
  },
});