import { View, Text, StyleSheet, TouchableOpacity, useColorScheme } from "react-native";
import { Colors } from "@/constants/theme";

interface HeaderProps {
  title: string;
  showMenuBtn?: boolean;
  onMenuPress?: () => void;
  right?: React.ReactNode;
}

export default function Header({
  title,
  showMenuBtn,
  onMenuPress,
  right,
}: HeaderProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === "unspecified" ? "light" : scheme];

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: colors.ghBg,
          borderBottomColor: colors.ghBorder,
        },
      ]}
    >
      <View style={styles.left}>
        {showMenuBtn && (
          <TouchableOpacity onPress={onMenuPress} style={styles.menuBtn}>
            <Text style={{ color: colors.ghText, fontSize: 20 }}>☰</Text>
          </TouchableOpacity>
        )}
        <Text style={[styles.title, { color: colors.ghText }]}>{title}</Text>
      </View>
      {right && <View style={styles.right}>{right}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    minHeight: 56,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuBtn: {
    marginRight: 15,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});
