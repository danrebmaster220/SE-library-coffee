// app/studyArea.jsx - Study Area Choice Screen
import { useRouter, useLocalSearchParams } from "expo-router";
import { BookOpen, X, ArrowLeft } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { prefetchLibrarySeatScreenData } from "../services/librarySeatsCache";
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

export default function StudyAreaChoice() {
  const router = useRouter();
  const { orderType } = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const { isPhone } = useResponsive();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-30)).current;
  const cardsFade = useRef(new Animated.Value(0)).current;
  const cardsSlide = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    prefetchLibrarySeatScreenData();
  }, []);

  useEffect(() => {
    // Animation values from useRef are stable and don't need to be in deps
    const fadeAnimation = fadeAnim;
    const headerAnimation = headerSlide;
    const cardsFadeAnimation = cardsFade;
    const cardsSlideAnimation = cardsSlide;

    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnimation, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(headerAnimation, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(cardsFadeAnimation, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(cardsSlideAnimation, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [fadeAnim, headerSlide, cardsFade, cardsSlide]);

  const handleYes = () => {
    // Navigate to library seat selection
    router.push({
      pathname: "/librarySeats",
      params: { orderType },
    });
  };

  const handleNo = () => {
    // Skip library, go directly to menu
    router.push({
      pathname: "/menu",
      params: { orderType },
    });
  };

  const handleBack = () => {
    router.back();
  };

  // Dynamic card sizing
  const phoneCardWidth = width * 0.8;
  const tabletCardWidth = width * 0.28;

  return (
    <View style={styles.background}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <View style={[styles.container, isPhone && styles.containerPhone]}>
          {/* Back Button */}
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <ArrowLeft color="#3d2417" size={isPhone ? 20 : 24} />
          </TouchableOpacity>

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
            Do you want to avail a Study Area?
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
                styles.yesCard,
                { width: isPhone ? phoneCardWidth : tabletCardWidth }
              ]}
              onPress={handleYes}
              activeOpacity={0.85}
            >
              <View style={[styles.iconCircle, isPhone && styles.iconCirclePhone]}>
                <BookOpen color="#FFFFFF" size={isPhone ? 36 : 50} strokeWidth={1.5} />
              </View>
              <View style={isPhone ? styles.cardTextPhone : null}>
                <Text style={[styles.cardTitle, isPhone && styles.cardTitlePhone]}>Yes</Text>
                <Text style={[styles.cardSubtitle, isPhone && styles.cardSubtitlePhone]}>BOOK A SEAT</Text>
                <Text style={[styles.cardPrice, isPhone && styles.cardPricePhone]}>Starting at ₱100</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.card, 
                styles.noCard,
                { width: isPhone ? phoneCardWidth : tabletCardWidth }
              ]}
              onPress={handleNo}
              activeOpacity={0.85}
            >
              <View style={[styles.iconCircle, isPhone && styles.iconCirclePhone]}>
                <X color="#FFFFFF" size={isPhone ? 36 : 50} strokeWidth={1.5} />
              </View>
              <View style={isPhone ? styles.cardTextPhone : null}>
                <Text style={[styles.cardTitle, isPhone && styles.cardTitlePhone]}>No</Text>
                <Text style={[styles.cardSubtitle, isPhone && styles.cardSubtitlePhone]}>SKIP</Text>
                <Text style={[styles.cardPrice, isPhone && styles.cardPricePhone]}>Order drinks only</Text>
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
    fontSize: 60,
    fontWeight: "300",
    color: "#3d2417",
    letterSpacing: 15,
    fontFamily: "serif",
  },
  titlePhone: {
    fontSize: 32,
    letterSpacing: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#6b4b32",
    letterSpacing: 8,
    marginTop: 5,
  },
  subtitlePhone: {
    fontSize: 11,
    letterSpacing: 4,
  },
  chooseText: {
    fontSize: 28,
    fontWeight: "600",
    color: "#3d2417",
    marginBottom: 40,
    textAlign: "center",
  },
  chooseTextPhone: {
    fontSize: 20,
    marginBottom: 24,
  },
  cardsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 30,
  },
  cardsContainerPhone: {
    flexDirection: "column",
    gap: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingVertical: 40,
    paddingHorizontal: 30,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 2,
    borderColor: "transparent",
  },
  yesCard: {
    borderColor: "#4CAF50",
  },
  noCard: {
    borderColor: "#9E9E9E",
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#6b4b32",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  iconCirclePhone: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginBottom: 12,
  },
  cardTextPhone: {
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: "#3d2417",
    marginBottom: 8,
  },
  cardTitlePhone: {
    fontSize: 24,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: "#6b4b32",
    letterSpacing: 3,
    fontWeight: "600",
  },
  cardSubtitlePhone: {
    fontSize: 12,
    letterSpacing: 2,
  },
  cardPrice: {
    fontSize: 14,
    color: "#888",
    marginTop: 10,
  },
  cardPricePhone: {
    fontSize: 12,
    marginTop: 6,
  },
  backButton: {
    position: "absolute",
    top: 20,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
});
