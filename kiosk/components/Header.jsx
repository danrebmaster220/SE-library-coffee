import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useResponsive } from "../hooks/useResponsive";

const Header = ({ customerName, orderType, isPhone: isPhoneProp }) => {
  const router = useRouter();
  const { isPhone: isPhoneHook } = useResponsive();
  
  // Use prop if passed, otherwise use hook
  const isPhone = isPhoneProp !== undefined ? isPhoneProp : isPhoneHook;

  const formattedOrderType = (() => {
    if (!orderType) return "";
    const lower = orderType.toLowerCase();
    if (lower === "dinein") return "Dine In";
    if (lower === "takeout") return "Take Out";
    if (lower === "dine-in") return "Dine In";
    if (lower === "take-out") return "Take Out";
    return orderType.charAt(0).toUpperCase() + orderType.slice(1);
  })();

  return (
    <View style={[styles.header, isPhone && styles.headerPhone]}>
      <TouchableOpacity 
        style={[styles.backButton, isPhone && styles.backButtonPhone]} 
        onPress={() => router.back()}
      >
        <ArrowLeft color="#fff" size={isPhone ? 24 : 30} />
      </TouchableOpacity>

      <Image 
        source={require("../assets/images/logo/logo.png")} 
        style={[styles.logo, isPhone && styles.logoPhone]} 
      />

      <Text style={[styles.title, isPhone && styles.titlePhone]}>Library Café</Text>

      <Text style={[styles.subtitle, isPhone && styles.subtitlePhone]}>
        <Text style={styles.orderType}>{formattedOrderType}</Text>
      </Text>
    </View>
  );
}

export default Header;

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#4C2B18",
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    position: "relative",
  },
  headerPhone: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  backButton: {
    position: "absolute",
    left: 20,
    top: 25,
    zIndex: 2,
  },
  backButtonPhone: {
    left: 12,
    top: 18,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#fff",
  },
  titlePhone: {
    fontSize: 20,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 18,
    color: "#fff",
  },
  subtitlePhone: {
    fontSize: 14,
    marginTop: 2,
  },
  orderType: {
    fontWeight: "700",
    color: "#D4AF37",
  },
  logo: {
    width: 90,
    height: 65,
    resizeMode: "contain",
    position: "absolute",
    left: 55,
    top: 15,
    zIndex: 1,
  },
  logoPhone: {
    width: 60,
    height: 45,
    left: 40,
    top: 10,
  },
});
