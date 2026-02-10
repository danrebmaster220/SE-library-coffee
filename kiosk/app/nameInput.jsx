import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useResponsive } from "../hooks/useResponsive";

export default function NameInputPage() {
  const router = useRouter();
  const { orderType } = useLocalSearchParams();
  const [name, setName] = useState("");
  const { isPhone } = useResponsive();

  const handleContinue = () => {
    if (name.trim()) {
      router.push({
        pathname: "/menu",
        params: { orderType, customerName: name },
      });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.content}>
        <Text style={[styles.title, isPhone && styles.titlePhone]}>
          Enter your name so we can save your order
        </Text>
        <Text style={[styles.subTitle, isPhone && styles.subTitlePhone]}>
          Note: You can add a number or nickname to make it unique for easier reordering.
        </Text>

        <TextInput
          style={[styles.input, isPhone && styles.inputPhone]}
          placeholder="Your name"
          value={name}
          onChangeText={setName}
        />

        <TouchableOpacity
          style={[styles.button, isPhone && styles.buttonPhone, !name.trim() && { opacity: 0.6 }]}
          onPress={handleContinue}
          disabled={!name.trim()}
        >
          <Text style={[styles.buttonText, isPhone && styles.buttonTextPhone]}>Proceed</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F1EBDF",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#3d2417",
    marginBottom: 10,
    textAlign: "center",
    lineHeight: 32,
  },
  titlePhone: {
    fontSize: 20,
    lineHeight: 26,
  },
  subTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FF474C",
    marginBottom: 25,
    textAlign: "center",
    lineHeight: 32,
  },
  subTitlePhone: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 20,
  },
  input: {
    width: "80%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#ccc",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    color: "#3d2417",
  },
  inputPhone: {
    width: "100%",
    padding: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#3d2417",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonPhone: {
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 18,
    textAlign: "center",
  },
  buttonTextPhone: {
    fontSize: 16,
  },
});
