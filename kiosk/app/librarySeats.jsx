// app/librarySeats.jsx - Library Seat Selection Screen
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { User, Clock, Plus, Minus, ArrowLeft } from "lucide-react-native";
import { API_BASE_URL, getAvailableSeats, getLibraryPricing } from "../services/api";
import {
  readLibrarySeatScreenCache,
  writeLibrarySeatScreenCache,
} from "../services/librarySeatsCache";
import { useResponsive } from "../hooks/useResponsive";
import { io } from "socket.io-client";

/** Fallback if /library/pricing fails (must match server libraryPricingService). */
const FALLBACK_LIBRARY_PRICING = {
  base_rate: 100,
  base_minutes: 120,
  extend_rate: 50,
  extend_minutes: 30,
};

export default function LibrarySeats() {
  const router = useRouter();
  const { orderType } = useLocalSearchParams();
  const { width, height } = useWindowDimensions();
  const { isPhone } = useResponsive();
  const insets = useSafeAreaInsets();

  const [seats, setSeats] = useState([]);
  const [pricing, setPricing] = useState(null);
  /** True once we can show the main UI (network done or stale cache applied). */
  const [bootstrapped, setBootstrapped] = useState(false);
  /** True while refreshing after showing stale cache. */
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pricingRef = useRef(null);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const selectedSeatRef = useRef(null);
  const [showModal, setShowModal] = useState(false);
  
  // Booking form state
  const [customerName, setCustomerName] = useState("");
  const [extensions, setExtensions] = useState(0); // Number of 30-min extensions
  
  // Real-time locking state
  const [lockedSeatIds, setLockedSeatIds] = useState(new Set());
  const socketRef = useRef(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    pricingRef.current = pricing;
  }, [pricing]);

  // Silent refresh (no loading spinner, no error alerts) for polling
  const fetchSeatsSilent = async () => {
    try {
      const list = await getAvailableSeats();
      if (list === null) return;
      setSeats(list);
      const p = pricingRef.current;
      if (p) {
        await writeLibrarySeatScreenCache(list, p);
      }
    } catch (_error) {
      // ignore
    }
  };

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const cached = await readLibrarySeatScreenCache();
      if (cancelled) return;

      let hasStale = false;
      if (cached?.pricing) {
        const p = normalizePricing(cached.pricing) || FALLBACK_LIBRARY_PRICING;
        setSeats(Array.isArray(cached.seats) ? cached.seats : []);
        setPricing(p);
        setBootstrapped(true);
        hasStale = true;
        setIsRefreshing(true);
      }

      try {
        const [seatsList, pricingFromApi] = await Promise.all([
          getAvailableSeats(),
          getLibraryPricing(),
        ]);
        if (cancelled) return;

        if (seatsList === null) {
          if (!hasStale) {
            Alert.alert("Error", "Failed to load seats. Please try again.");
            setSeats([]);
            setPricing(FALLBACK_LIBRARY_PRICING);
          }
        } else {
          setSeats(seatsList);
          const p = normalizePricing(pricingFromApi) || FALLBACK_LIBRARY_PRICING;
          if (!normalizePricing(pricingFromApi)) {
            console.warn("Library pricing: using fallback constants (API unavailable or invalid)");
          }
          setPricing(p);
          await writeLibrarySeatScreenCache(seatsList, p);
        }
      } catch (error) {
        console.error("Error loading library screen:", error);
        if (!hasStale) {
          Alert.alert("Error", "Failed to load seats or pricing. Please try again.");
          setSeats([]);
          setPricing(FALLBACK_LIBRARY_PRICING);
        }
      } finally {
        if (!cancelled) {
          setBootstrapped(true);
          setIsRefreshing(false);
        }
      }
    };

    bootstrap();

    // Animation value from useRef is stable
    const animation = fadeAnim;
    Animated.timing(animation, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // Setup Socket.IO for real-time seat updates
    const socketUrl = API_BASE_URL.replace('/api', '');
    const socket = io(socketUrl, { transports: ['polling', 'websocket'] });

    socket.on('connect', () => {
      console.log("Connected to WebSocket for seat updates");
      socket.emit('join:library');
    });

    socket.on('library:seats-update', (data) => {
      console.log("Real-time seat update received:", data);
      fetchSeatsSilent(); // Refresh seats immediately when any seat status changes
    });

    socket.on('seat:locked', (data) => {
      setLockedSeatIds(prev => new Set(prev).add(data.seat_id));
    });

    socket.on('seat:released', (data) => {
      setLockedSeatIds(prev => {
        const next = new Set(prev);
        next.delete(data.seat_id);
        return next;
      });
    });

    socketRef.current = socket;

    // Poll for seat updates every 10 seconds as a fallback
    const pollInterval = setInterval(() => {
      fetchSeatsSilent();
    }, 10000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
      if (selectedSeatRef.current && socket) {
        // Auto-release any seats locked by this client if they unmount
        socket.emit('seat:release', { seat_id: selectedSeatRef.current.seat_id });
      }
      socket.disconnect();
    };
  }, [fadeAnim]);

  const normalizePricing = (raw) => {
    if (!raw || typeof raw !== "object") return null;
    const base_rate = Number(raw.base_rate);
    const base_minutes = Number(raw.base_minutes);
    const extend_rate = Number(raw.extend_rate);
    const extend_minutes = Number(raw.extend_minutes);
    if (
      !Number.isFinite(base_rate) ||
      !Number.isFinite(base_minutes) ||
      !Number.isFinite(extend_rate) ||
      !Number.isFinite(extend_minutes)
    ) {
      return null;
    }
    return { base_rate, base_minutes, extend_rate, extend_minutes };
  };

  // Group seats by table - ensure seats is an array
  const seatsArray = Array.isArray(seats) ? seats : [];
  const groupedSeats = seatsArray.reduce((acc, seat) => {
    const table = seat.table_number;
    if (!acc[table]) {
      acc[table] = {
        table_name: seat.table_name || `Table ${seat.table_number}`,
        seats: []
      };
    }
    acc[table].seats.push(seat);
    return acc;
  }, {});
  const rateCard = pricing || FALLBACK_LIBRARY_PRICING;

  const calculateTotal = () => {
    return rateCard.base_rate + extensions * rateCard.extend_rate;
  };

  const calculateDuration = () => {
    return rateCard.base_minutes + extensions * rateCard.extend_minutes;
  };

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return `${hours}h ${mins}m`;
  };

  const handleSeatPress = (seat) => {
    if (seat.status === "occupied") {
      Alert.alert("Seat Occupied", "This seat is currently in use.");
      return;
    }
    if (seat.status === "reserved" || lockedSeatIds.has(seat.seat_id)) {
      Alert.alert("Seat Reserved", "This seat is reserved by another customer.");
      return;
    }
    if (seat.status === "maintenance") {
      Alert.alert("Under Maintenance", "This seat is currently unavailable.");
      return;
    }
    
    // Attempt local lock
    if (socketRef.current) {
      socketRef.current.emit('seat:lock', { seat_id: seat.seat_id });
      // Listen for lock failure just in case race condition
      socketRef.current.once('seat:lock-failed', (data) => {
        if (data.seat_id === seat.seat_id) {
            Alert.alert("Seat Reserved", data.message);
            setShowModal(false);
            setSelectedSeat(null);
            fetchSeatsSilent();
        }
      });
    }

    setSelectedSeat(seat);
    selectedSeatRef.current = seat;
    setCustomerName("");
    setExtensions(0);
    setShowModal(true);
  };

  const getSeatStyle = (seat) => {
    if (seat.status === "occupied") return styles.seatOccupied;
    if (seat.status === "reserved" || lockedSeatIds.has(seat.seat_id)) return styles.seatReserved;
    if (seat.status === "maintenance") return styles.seatMaintenance;
    return styles.seatAvailable;
  };

  const handleConfirmBooking = () => {
    if (!customerName.trim()) {
      Alert.alert("Required", "Please enter your full name.");
      return;
    }

    // Close modal first
    setShowModal(false);

    // Store library booking data and navigate to menu
    router.push({
      pathname: "/menu",
      params: {
        orderType,
        libraryBooking: JSON.stringify({
          seat_id: selectedSeat.seat_id,
          table_number: selectedSeat.table_number,
          table_name: selectedSeat.table_name || `Table ${selectedSeat.table_number}`,
          seat_number: selectedSeat.seat_number,
          customer_name: customerName.trim(),
          duration_minutes: calculateDuration(),
          amount: calculateTotal(),
        }),
      },
    });
  };

  const handleSkip = () => {
    // Release any locked seat
    if (selectedSeat && socketRef.current) {
      socketRef.current.emit('seat:release', { seat_id: selectedSeat.seat_id });
    }
    
    // Skip library booking, go to menu without booking
    router.push({
      pathname: "/menu",
      params: { orderType },
    });
  };

  const handleBack = () => {
    // Release any locked seat
    if (selectedSeat && socketRef.current) {
      socketRef.current.emit('seat:release', { seat_id: selectedSeat.seat_id });
    }
    router.back();
  };

  if (!bootstrapped) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.skeletonRoot}>
          <View style={styles.skeletonHeaderRow}>
            <View style={styles.skeletonCircle} />
            <View style={styles.skeletonHeaderText}>
              <View style={styles.skeletonLineLg} />
              <View style={styles.skeletonLineSm} />
            </View>
            <View style={styles.skeletonSkip} />
          </View>
          <View style={styles.skeletonLegend}>
            <View style={styles.skeletonPill} />
            <View style={styles.skeletonPill} />
            <View style={styles.skeletonPill} />
          </View>
          <ScrollView contentContainerStyle={styles.skeletonScroll}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.skeletonTableCard}>
                <View style={styles.skeletonTableTitle} />
                <View style={styles.skeletonSeatRow}>
                  {[0, 1, 2, 3].map((j) => (
                    <View key={j} style={styles.skeletonSeat} />
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={styles.skeletonFooter}>
            <View style={styles.skeletonLineMd} />
            <ActivityIndicator size="small" color="#4C2B18" style={{ marginTop: 8 }} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Dynamic modal width based on screen size
  const modalWidth = isPhone ? width * 0.9 : width * 0.45;

  return (
    <View style={styles.background}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <Animated.View style={[styles.container, isPhone && styles.containerPhone, { opacity: fadeAnim }]}>
          {/* Header */}
          <View style={[styles.header, isPhone && styles.headerPhone]}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <ArrowLeft color="#3d2417" size={isPhone ? 20 : 24} />
            </TouchableOpacity>
            <View style={styles.headerText}>
              <Text style={[styles.title, isPhone && styles.titlePhone]}>Select Your Seat</Text>
              <Text style={[styles.subtitle, isPhone && styles.subtitlePhone]}>
                Choose a table and seat for your study session
              </Text>
            </View>
            <TouchableOpacity style={[styles.skipButton, isPhone && styles.skipButtonPhone]} onPress={handleSkip}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          </View>

          {isRefreshing ? (
            <View style={styles.refreshingBanner}>
              <Text style={styles.refreshingText}>Updating seats…</Text>
            </View>
          ) : null}

          {/* Legend */}
          <View style={[styles.legend, isPhone && styles.legendPhone]}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#4CAF50" }]} />
              <Text style={styles.legendText}>Available</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#FF9800" }]} />
              <Text style={styles.legendText}>Reserved</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#f44336" }]} />
              <Text style={styles.legendText}>Occupied</Text>
            </View>
          </View>

          {/* Tables Grid */}
          <ScrollView style={styles.tablesContainer} contentContainerStyle={styles.tablesContent}>
            {Object.keys(groupedSeats).length === 0 ? (
              <View style={styles.noSeatsContainer}>
                <Text style={styles.noSeatsText}>No tables available.</Text>
                <Text style={styles.noSeatsSubtext}>Please contact staff for assistance.</Text>
              </View>
            ) : (
              <View style={styles.tablesGrid}>
                {Object.entries(groupedSeats).map(([tableNum, tableData]) => (
                  <View key={tableNum} style={styles.tableCard}>
                    <View style={styles.tableHeader}>
                      <Text style={styles.tableTitle}>{tableData.table_name}</Text>
                      <View style={styles.seatCountBadge}>
                        <Text style={styles.seatCountText}>{tableData.seats.length} seats</Text>
                      </View>
                    </View>
                    <View style={styles.seatsGrid}>
                      {tableData.seats.map((seat) => (
                        <TouchableOpacity
                          key={seat.seat_id}
                          style={[styles.seatButton, getSeatStyle(seat)]}
                          onPress={() => handleSeatPress(seat)}
                          activeOpacity={0.7}
                          disabled={seat.status !== "available"}
                        >
                          <User
                            color={seat.status === "available" ? "#4C2B18" : "#fff"}
                            size={20}
                          />
                          <Text
                            style={[
                              styles.seatNumber,
                              seat.status !== "available" && styles.seatNumberOccupied,
                            ]}
                          >
                            {seat.seat_number}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Pricing Info */}
          <View style={styles.pricingInfo}>
            <Text style={styles.pricingTitle}>Study Area Rates</Text>
            <Text style={[styles.pricingText, isPhone && styles.pricingTextPhone]}>
              Base: ₱{rateCard.base_rate} for {formatDuration(rateCard.base_minutes)} • Extension: +₱
              {rateCard.extend_rate} per {rateCard.extend_minutes} mins
            </Text>
          </View>
        </Animated.View>

        {/* Booking Modal */}
        <Modal
          visible={showModal}
          animationType="fade"
          transparent
          onRequestClose={() => {
            if (selectedSeat && socketRef.current) {
              socketRef.current.emit('seat:release', { seat_id: selectedSeat.seat_id });
            }
            setShowModal(false);
            setSelectedSeat(null);
            selectedSeatRef.current = null;
          }}
        >
          <View style={[styles.modalOverlay, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
            <ScrollView 
              style={{ maxHeight: height - insets.top - insets.bottom - 32 }}
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <View style={[styles.modalContent, { width: modalWidth }]}>
                <Text style={[styles.modalTitle, isPhone && styles.modalTitlePhone]}>Book Seat</Text>
                {selectedSeat && (
                  <Text style={styles.modalSubtitle}>
                    {selectedSeat.table_name || `Table ${selectedSeat.table_number}`}, Seat {selectedSeat.seat_number}
                  </Text>
                )}

                <View style={styles.modalDivider} />

                {/* Customer Name Input */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Full Name *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={customerName}
                    onChangeText={setCustomerName}
                    placeholder="Enter your full name"
                    placeholderTextColor="#999"
                  />
                </View>

                {/* Duration Selection */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Duration</Text>
                  <View style={styles.durationBox}>
                    <View style={styles.durationBase}>
                      <Clock color="#4C2B18" size={20} />
                      <Text style={styles.durationText}>
                        Base: {formatDuration(rateCard.base_minutes)} = ₱{rateCard.base_rate}
                      </Text>
                    </View>
                    
                    {/* Extension Controls */}
                    <View style={styles.extensionRow}>
                      <Text style={styles.extensionLabel}>
                        Extensions (+{rateCard.extend_minutes} mins each)
                      </Text>
                      <View style={styles.extensionControls}>
                        <TouchableOpacity
                          style={[styles.extButton, extensions === 0 && styles.extButtonDisabled]}
                          onPress={() => setExtensions(Math.max(0, extensions - 1))}
                          disabled={extensions === 0}
                        >
                          <Minus color={extensions === 0 ? "#ccc" : "#4C2B18"} size={18} />
                        </TouchableOpacity>
                        <Text style={styles.extensionCount}>{extensions}</Text>
                        <TouchableOpacity
                          style={styles.extButton}
                          onPress={() => setExtensions(extensions + 1)}
                        >
                          <Plus color="#4C2B18" size={18} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {extensions > 0 && (
                      <Text style={styles.extensionCost}>
                        Extension: +₱{extensions * rateCard.extend_rate}
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.modalDivider} />

                {/* Total Summary */}
                <View style={styles.totalBox}>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total Duration:</Text>
                    <Text style={styles.totalValue}>{formatDuration(calculateDuration())}</Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabelBig}>Total Amount:</Text>
                    <Text style={styles.totalValueBig}>₱{calculateTotal().toFixed(2)}</Text>
                  </View>
                </View>

                {/* Buttons */}
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setShowModal(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.confirmButton]}
                    onPress={handleConfirmBooking}
                  >
                    <Text style={styles.confirmButtonText}>Confirm & Continue</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: "#F5E6D3",
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  skeletonRoot: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: "#F5E6D3",
  },
  skeletonHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
  },
  skeletonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E8DCCD",
  },
  skeletonHeaderText: {
    flex: 1,
    marginLeft: 12,
  },
  skeletonLineLg: {
    height: 22,
    borderRadius: 6,
    backgroundColor: "#E8DCCD",
    width: "70%",
  },
  skeletonLineSm: {
    height: 14,
    borderRadius: 4,
    backgroundColor: "#E0D6C8",
    width: "45%",
    marginTop: 6,
  },
  skeletonLineMd: {
    height: 14,
    borderRadius: 4,
    backgroundColor: "#E0D6C8",
    width: "55%",
    alignSelf: "center",
  },
  skeletonSkip: {
    width: 52,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#E8DCCD",
  },
  skeletonLegend: {
    flexDirection: "row",
    marginBottom: 12,
    justifyContent: "space-between",
  },
  skeletonPill: {
    height: 28,
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: "#E8DCCD",
  },
  skeletonScroll: {
    paddingBottom: 24,
  },
  skeletonTableCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#eee",
  },
  skeletonTableTitle: {
    height: 18,
    width: "40%",
    borderRadius: 4,
    backgroundColor: "#E8DCCD",
    marginBottom: 14,
  },
  skeletonSeatRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -5,
  },
  skeletonSeat: {
    width: 56,
    height: 56,
    margin: 5,
    borderRadius: 12,
    backgroundColor: "#EDE4D9",
  },
  skeletonFooter: {
    paddingVertical: 12,
    alignItems: "center",
  },
  refreshingBanner: {
    backgroundColor: "rgba(76, 43, 24, 0.08)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  refreshingText: {
    fontSize: 13,
    color: "#5d4e41",
    textAlign: "center",
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 20,
  },
  headerPhone: {
    paddingVertical: 12,
  },
  backButton: {
    padding: 10,
  },
  headerText: {
    flex: 1,
    marginLeft: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#3d2417",
  },
  titlePhone: {
    fontSize: 22,
  },
  subtitle: {
    fontSize: 14,
    color: "#6b4b32",
    marginTop: 4,
  },
  subtitlePhone: {
    fontSize: 12,
    marginTop: 2,
  },
  skipButton: {
    padding: 10,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  skipButtonPhone: {
    padding: 8,
  },
  skipText: {
    color: "#666",
    fontWeight: "600",
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 30,
    marginBottom: 15,
  },
  legendPhone: {
    gap: 15,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  legendText: {
    fontSize: 14,
    color: "#666",
  },
  containerPhone: {
    paddingHorizontal: 12,
  },
  pricingTextPhone: {
    fontSize: 12,
  },
  tablesContainer: {
    flex: 1,
  },
  tablesContent: {
    paddingBottom: 20,
  },
  noSeatsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  noSeatsText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#4C2B18",
  },
  noSeatsSubtext: {
    fontSize: 14,
    color: "#888",
    marginTop: 8,
  },
  tablesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 20,
  },
  tableCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    minWidth: 280,
    maxWidth: 320,
    borderWidth: 1,
    borderColor: "#e0d5c9",
  },
  tableHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  tableTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#3d2417",
  },
  seatCountBadge: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  seatCountText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4CAF50",
  },
  seatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    gap: 10,
  },
  seatButton: {
    width: 60,
    height: 70,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    padding: 8,
  },
  seatAvailable: {
    backgroundColor: "#E8F5E9",
    borderWidth: 2,
    borderColor: "#4CAF50",
  },
  seatOccupied: {
    backgroundColor: "#f44336",
    borderWidth: 2,
    borderColor: "#d32f2f",
  },
  seatReserved: {
    backgroundColor: "#FF9800",
    borderWidth: 2,
    borderColor: "#F57C00",
  },
  seatMaintenance: {
    backgroundColor: "#9E9E9E",
    borderWidth: 2,
    borderColor: "#757575",
  },
  seatNumber: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4C2B18",
    marginTop: 4,
  },
  seatNumberOccupied: {
    color: "#fff",
  },
  pricingInfo: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    marginVertical: 15,
    alignItems: "center",
  },
  pricingTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#3d2417",
    marginBottom: 5,
  },
  pricingText: {
    fontSize: 12,
    color: "#666",
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 25,
    maxWidth: 500,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#3d2417",
    textAlign: "center",
  },
  modalTitlePhone: {
    fontSize: 20,
  },
  modalSubtitle: {
    fontSize: 16,
    color: "#6b4b32",
    textAlign: "center",
    marginTop: 5,
  },
  modalDivider: {
    height: 1,
    backgroundColor: "#eee",
    marginVertical: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3d2417",
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: "#333",
  },
  durationBox: {
    backgroundColor: "#f9f5f0",
    borderRadius: 12,
    padding: 15,
  },
  durationBase: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 15,
  },
  durationText: {
    fontSize: 16,
    color: "#3d2417",
    fontWeight: "600",
  },
  extensionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  extensionLabel: {
    fontSize: 14,
    color: "#666",
    flex: 1,
    minWidth: 120,
  },
  extensionControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  extButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  extButtonDisabled: {
    backgroundColor: "#f5f5f5",
    borderColor: "#eee",
  },
  extensionCount: {
    fontSize: 18,
    fontWeight: "700",
    color: "#3d2417",
    minWidth: 28,
    textAlign: "center",
  },
  extensionCost: {
    fontSize: 14,
    color: "#4CAF50",
    marginTop: 10,
    fontWeight: "600",
  },
  totalBox: {
    backgroundColor: "#3d2417",
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  totalLabel: {
    fontSize: 14,
    color: "#ccc",
  },
  totalValue: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "600",
  },
  totalLabelBig: {
    fontSize: 18,
    color: "#fff",
    fontWeight: "600",
  },
  totalValueBig: {
    fontSize: 22,
    color: "#d4af37",
    fontWeight: "700",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 5,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  confirmButton: {
    backgroundColor: "#4CAF50",
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#666",
    textAlign: "center",
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
  },
});
