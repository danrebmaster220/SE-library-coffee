import { useRouter } from "expo-router";
import { Coffee, ShoppingBag } from "lucide-react-native";
import { useState, useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useResponsive } from "../hooks/useResponsive";
import { getTakeoutCupsStatus } from "../services/api";

export default function OrderTypeSelection() {
  const router = useRouter();
  const [selectedOption, setSelectedOption] = useState(null);
  const [cupsStatus, setCupsStatus] = useState({
    stock: 0,
    is_takeout_disabled: false,
  });
  const [cupsLoading, setCupsLoading] = useState(true);
  const { width } = useWindowDimensions();
  const { isPhone } = useResponsive();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-30)).current;
  const cardsFade = useRef(new Animated.Value(0)).current;
  const cardsSlide = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(headerSlide, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(cardsFade, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(cardsSlide, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [fadeAnim, headerSlide, cardsFade, cardsSlide]);

  useEffect(() => {
    let mounted = true;

    const loadCupStatus = async () => {
      try {
        const data = await getTakeoutCupsStatus();
        if (!mounted) return;
        setCupsStatus({
          stock: Number(data?.stock ?? 0),
          is_takeout_disabled: Boolean(data?.is_takeout_disabled),
        });
      } finally {
        if (mounted) setCupsLoading(false);
      }
    };

    loadCupStatus();
    const interval = setInterval(loadCupStatus, 10000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleOptionPress = (option) => {
    if (option === "takeout" && cupsStatus.is_takeout_disabled) {
      return;
    }

    setSelectedOption(option);
    const orderTypeValue = option === "dinein" ? "Dine-In" : "Take-Out";

    if (option === "takeout") {
      // Take-Out: skip study area, go straight to menu
      router.push({
        pathname: "/menu",
        params: { orderType: orderTypeValue },
      });
    } else {
      // Dine-In: ask if they want to book a study area
      router.push({
        pathname: "/studyArea",
        params: { orderType: orderTypeValue },
      });
    }
  };

  // Dynamic card sizes for phone
  const phoneCardWidth = width * 0.75;
  const phoneCardHeight = 180;

  return (
    <View style={styles.background}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <View style={[styles.container, isPhone && styles.containerPhone]}>
          <Animated.View
            style={[
              styles.header,
              isPhone && styles.headerPhone,
              {
                opacity: fadeAnim,
                transform: [{ translateY: headerSlide }],
              },
            ]}
          >
            <Text style={[styles.title, isPhone && styles.titlePhone]}>LIBRARY</Text>
            <Text style={[styles.subtitle, isPhone && styles.subtitlePhone]}>
              C O F F E E  +  S T U D Y
            </Text>
          </Animated.View>

          <Animated.Text
            style={[
              styles.chooseText,
              isPhone && styles.chooseTextPhone,
              {
                opacity: fadeAnim,
              },
            ]}
          >
            Choose Your Order Type
          </Animated.Text>

          <Animated.View
            style={[
              styles.cardsContainer,
              isPhone && styles.cardsContainerPhone,
              {
                opacity: cardsFade,
                transform: [{ translateY: cardsSlide }],
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.card,
                isPhone && { ...styles.cardPhone, width: phoneCardWidth, height: phoneCardHeight },
                selectedOption === "dinein" && styles.cardSelected,
              ]}
              onPress={() => handleOptionPress("dinein")}
              activeOpacity={0.85}
            >
              <View style={[styles.iconCircle, isPhone && styles.iconCirclePhone]}>
                <Coffee color="#FFFFFF" size={isPhone ? 36 : 50} strokeWidth={1.5} />
              </View>
              <View style={isPhone ? styles.cardTextPhone : null}>
                <Text style={[styles.cardTitle, isPhone && styles.cardTitlePhone]}>Dine-In</Text>
                <Text style={[styles.cardSubtitle, isPhone && styles.cardSubtitlePhone]}>ENJOY HERE</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.card,
                isPhone && { ...styles.cardPhone, width: phoneCardWidth, height: phoneCardHeight },
                selectedOption === "takeout" && styles.cardSelected,
                cupsStatus.is_takeout_disabled && styles.cardDisabled,
              ]}
              onPress={() => handleOptionPress("takeout")}
              disabled={cupsStatus.is_takeout_disabled}
              activeOpacity={0.85}
            >
              <View style={[styles.iconCircle, isPhone && styles.iconCirclePhone]}>
                <ShoppingBag color="#FFFFFF" size={isPhone ? 36 : 50} strokeWidth={1.5} />
              </View>
              <View style={isPhone ? styles.cardTextPhone : null}>
                <Text style={[styles.cardTitle, isPhone && styles.cardTitlePhone]}>Take-Out</Text>
                <Text style={[styles.cardSubtitle, isPhone && styles.cardSubtitlePhone]}>TO GO</Text>
                <Text style={[styles.cupsText, isPhone && styles.cupsTextPhone]}>
                  {cupsLoading
                    ? "Checking cups..."
                    : cupsStatus.is_takeout_disabled
                      ? "Unavailable: No cups left"
                      : `Cups available: ${cupsStatus.stock}`}
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>
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
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  containerPhone: {
    paddingHorizontal: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
  },
  headerPhone: {
    marginBottom: 20,
  },
  title: {
    fontSize: 72,
    fontWeight: "300",
    color: "#6B4423",
    letterSpacing: 24,
    marginBottom: 16,
  },
  titlePhone: {
    fontSize: 36,
    letterSpacing: 12,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 20,
    color: "#8B5E34",
    letterSpacing: 10,
    fontWeight: "400",
  },
  subtitlePhone: {
    fontSize: 12,
    letterSpacing: 5,
  },
  chooseText: {
    fontSize: 26,
    color: "#D4A574",
    fontWeight: "500",
    marginBottom: 50,
    letterSpacing: 1,
  },
  chooseTextPhone: {
    fontSize: 18,
    marginBottom: 30,
  },
  cardsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 50,
  },
  cardsContainerPhone: {
    flexDirection: "column",
    gap: 16,
  },
  card: {
    width: 280,
    height: 340,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#8B5E34",
  },
  cardPhone: {
    flexDirection: "row",
    justifyContent: "flex-start",
    paddingHorizontal: 24,
    borderRadius: 16,
  },
  cardSelected: {
    backgroundColor: "#6B4423",
    transform: [{ scale: 1.03 }],
  },
  cardDisabled: {
    opacity: 0.6,
  },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  iconCirclePhone: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginBottom: 0,
    marginRight: 20,
  },
  cardTextPhone: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 30,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 10,
    letterSpacing: 1,
  },
  cardTitlePhone: {
    fontSize: 22,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: "#D4A574",
    letterSpacing: 5,
    fontWeight: "500",
  },
  cardSubtitlePhone: {
    fontSize: 11,
    letterSpacing: 3,
  },
  cupsText: {
    marginTop: 10,
    fontSize: 12,
    color: "#F4DABF",
    letterSpacing: 0.3,
  },
  cupsTextPhone: {
    marginTop: 6,
    fontSize: 10,
  },
});
