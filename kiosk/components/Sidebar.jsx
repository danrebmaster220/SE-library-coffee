// components/Sidebar.jsx
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const Sidebar = ({ selectedCategory, onSelectCategory, categories = [] }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Categories</Text>

      <ScrollView contentContainerStyle={styles.list}>
        {categories.map((category) => {
          // handle the category name in any format
          const label = typeof category === "string" ? category : category.name;
          const key = typeof category === "string" ? category : category.id ?? label;

          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.categoryButton,
                selectedCategory === label && styles.activeButton,
              ]}
              onPress={() => onSelectCategory(label)}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === label && styles.activeText,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

export default Sidebar;

const styles = StyleSheet.create({
  container: {
    width: 155,
    flexShrink: 0,
    backgroundColor: "#4C2B18",
    borderRadius: 20,
    padding: 12,
    marginRight: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 15,
    textAlign: "center",
  },
  list: {
    flexGrow: 1,
  },
  categoryButton: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: "#6B3A1C",
    alignItems: "center",
  },
  activeButton: {
    backgroundColor: "#2D1810",
  },
  categoryText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
  },
  activeText: {
    color: "#d4af37",
  },
});