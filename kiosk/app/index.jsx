import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Animated, ImageBackground, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useResponsive } from "../hooks/useResponsive";

const WelcomeScreen = () => {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [visible, setVisible] = useState(true);
  const { isPhone } = useResponsive();

  const handleStart = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 800,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      router.replace("/orderType"); // Navigate to Dine In / Take Out
    });
  };

  return (
    <View style={styles.container}>
      {visible && (
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          <TouchableOpacity activeOpacity={0.9} style={styles.touchArea} onPress={handleStart}>
            <ImageBackground
              source={require("../assets/images/LandingPage.png")}
              style={styles.background}
              resizeMode="cover"
            >
          
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill}>
                <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.textContainer}>
                  <Text style={[styles.title, isPhone && styles.titlePhone]}>
                    Welcome to The Library
                  </Text>
                  <Text style={[styles.subTitle, isPhone && styles.subTitlePhone]}>
                    COFFEE + STUDY
                  </Text>

                  <View style={styles.bottomContainer}>
                    <Text style={[styles.tapText, styles.bottomBar, isPhone && styles.tapTextPhone]}>
                      Touch to Start
                    </Text>
                  </View>
                </SafeAreaView>
              </BlurView>
            </ImageBackground>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
};

export default WelcomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  touchArea: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  title: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "700",
    textAlign: "center",
  },
  titlePhone: {
    fontSize: 28,
    paddingHorizontal: 20,
  },
  subTitle: {
    color: "#D4AF37",
    fontSize: 30,
    fontWeight: "700",
    marginBottom: 10,
    textAlign: "center",
  },
  subTitlePhone: {
    fontSize: 22,
  },
  tapText: {
    color: "#F5E8C7",
    fontSize: 22,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 40,
  },
  tapTextPhone: {
    fontSize: 18,
    marginTop: 30,
  },
});
