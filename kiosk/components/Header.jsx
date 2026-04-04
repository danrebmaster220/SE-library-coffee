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
      <View style={styles.headerRow}>
        <View style={[styles.headerSide, isPhone && styles.headerSidePhone]}>
          <TouchableOpacity style={styles.backButtonInner} onPress={() => router.back()}>
            <ArrowLeft color="#fff" size={isPhone ? 24 : 30} />
          </TouchableOpacity>
        </View>

        <View style={styles.headerCenter}>
          <Text style={[styles.title, isPhone && styles.titlePhone]}>Library Coffee + Study</Text>
          <Text style={[styles.subtitle, isPhone && styles.subtitlePhone]}>
            <Text style={styles.orderType}>{formattedOrderType}</Text>
          </Text>
        </View>

        <View style={[styles.headerSide, styles.headerSideRight, isPhone && styles.headerSidePhone]}>
          <Image
            source={require("../assets/images/logo/logo.png")}
            style={[styles.logo, isPhone && styles.logoPhone]}
          />
        </View>
      </View>
    </View>
  );
}

export default Header;

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#4C2B18",
    paddingVertical: 18,
    paddingHorizontal: 12,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerPhone: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  headerSide: {
    width: 100,
    minHeight: 48,
    justifyContent: "center",
  },
  headerSidePhone: {
    width: 72,
    minHeight: 44,
  },
  headerSideRight: {
    alignItems: "flex-end",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  backButtonInner: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    alignSelf: "flex-start",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  titlePhone: {
    fontSize: 20,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 18,
    color: "#fff",
    textAlign: "center",
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
  },
  logoPhone: {
    width: 60,
    height: 45,
  },
});
