import React, { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Modal,
    Animated as RNAnimated,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import CalendarModal from "./CalendarModal";

interface PostponeModalProps {
    visible: boolean;
    onClose: () => void;
    onPostpone: (newDate: string, reason: string) => void;
    colors: any;
}

export default function PostponeModal({
    visible,
    onClose,
    onPostpone,
    colors,
}: PostponeModalProps) {
    const [reason, setReason] = useState("");
    const [selectedDate, setSelectedDate] = useState < string | null > (null);
    const [showCalendar, setShowCalendar] = useState(false);

    // Animation values
    const scaleAnim = useRef(new RNAnimated.Value(0.9)).current;
    const opacityAnim = useRef(new RNAnimated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            setReason("");
            setSelectedDate(null);
            setShowCalendar(false);
            scaleAnim.setValue(0.9);
            opacityAnim.setValue(0);
            RNAnimated.parallel([
                RNAnimated.spring(scaleAnim, {
                    toValue: 1,
                    tension: 20,
                    friction: 10,
                    useNativeDriver: true,
                }),
                RNAnimated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 350,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible]);

    const animateClose = (callback: () => void) => {
        RNAnimated.parallel([
            RNAnimated.timing(scaleAnim, {
                toValue: 0.9,
                duration: 250,
                useNativeDriver: true,
            }),
            RNAnimated.timing(opacityAnim, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }),
        ]).start(callback);
    };

    const handleCancel = () => {
        animateClose(onClose);
    };

    const handlePostpone = () => {
        if (!selectedDate || !reason.trim()) return;
        animateClose(() => {
            onPostpone(selectedDate, reason.trim());
        });
    };

    const getFutureDate = (days: number) => {
        const d = new Date();
        d.setDate(d.getDate() + days);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };

    const formatDisplayDate = (ymd: string | null) => {
        if (!ymd) return "Choose Date";
        const [y, m, d] = ymd.split("-");
        return `${d}/${m}/${y}`;
    };

    const handleSelectDate = (dmy: string) => {
        const [d, m, y] = dmy.split("/");
        if (d && m && y) {
            setSelectedDate(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={handleCancel}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <RNAnimated.View
                    style={[styles.overlay, { opacity: opacityAnim }]}
                >
                    <RNAnimated.View
                        style={[
                            styles.modal,
                            {
                                backgroundColor: colors.ghSurface,
                                borderColor: colors.ghBorder,
                                transform: [{ scale: scaleAnim }],
                            },
                        ]}
                    >
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                            <Text style={[styles.modalTitle, { color: colors.ghText }]}>Postpone Task</Text>
                            <TouchableOpacity onPress={handleCancel}>
                                <Feather name="x" size={20} color={colors.ghMuted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.label, { color: colors.ghMuted }]}>Move Due Date</Text>

                        <View style={styles.buttonGrid}>
                            <TouchableOpacity
                                style={[
                                    styles.presetBtn,
                                    {
                                        borderColor: selectedDate === getFutureDate(1) ? colors.ghBlue : colors.ghBorder,
                                        backgroundColor: selectedDate === getFutureDate(1) ? colors.ghBlue + '18' : 'transparent'
                                    }
                                ]}
                                onPress={() => setSelectedDate(getFutureDate(1))}
                            >
                                <Text style={{ color: selectedDate === getFutureDate(1) ? colors.ghBlue : colors.ghText, fontSize: 13 }}>Tomorrow</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.presetBtn,
                                    {
                                        borderColor: selectedDate === getFutureDate(2) ? colors.ghBlue : colors.ghBorder,
                                        backgroundColor: selectedDate === getFutureDate(2) ? colors.ghBlue + '18' : 'transparent'
                                    }
                                ]}
                                onPress={() => setSelectedDate(getFutureDate(2))}
                            >
                                <Text style={{ color: selectedDate === getFutureDate(2) ? colors.ghBlue : colors.ghText, fontSize: 13 }}>+2 Days</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.presetBtn,
                                    {
                                        borderColor: selectedDate === getFutureDate(7) ? colors.ghBlue : colors.ghBorder,
                                        backgroundColor: selectedDate === getFutureDate(7) ? colors.ghBlue + '18' : 'transparent'
                                    }
                                ]}
                                onPress={() => setSelectedDate(getFutureDate(7))}
                            >
                                <Text style={{ color: selectedDate === getFutureDate(7) ? colors.ghBlue : colors.ghText, fontSize: 13 }}>+1 Week</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.presetBtn,
                                    {
                                        borderColor: (![getFutureDate(1), getFutureDate(2), getFutureDate(7)].includes(selectedDate as string) && selectedDate !== null) ? colors.ghBlue : colors.ghBorder,
                                        backgroundColor: (![getFutureDate(1), getFutureDate(2), getFutureDate(7)].includes(selectedDate as string) && selectedDate !== null) ? colors.ghBlue + '18' : 'transparent'
                                    }
                                ]}
                                onPress={() => setShowCalendar(true)}
                            >
                                <Text style={{ color: (![getFutureDate(1), getFutureDate(2), getFutureDate(7)].includes(selectedDate as string) && selectedDate !== null) ? colors.ghBlue : colors.ghText, fontSize: 13 }}>
                                    {formatDisplayDate(selectedDate)}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.label, { color: colors.ghMuted, marginTop: 16 }]}>Reason (Required)</Text>
                        <TextInput
                            style={[
                                styles.input,
                                { color: colors.ghText, backgroundColor: colors.ghBg, borderColor: colors.ghBorder },
                            ]}
                            placeholder="Why are you postponing this?"
                            placeholderTextColor={colors.ghMuted}
                            value={reason}
                            onChangeText={setReason}
                            multiline
                        />

                        <View style={styles.footer}>
                            <TouchableOpacity
                                style={[styles.footerBtn, { backgroundColor: colors.ghSurface2, borderColor: colors.ghBorder }]}
                                onPress={handleCancel}
                            >
                                <Text style={{ color: colors.ghText, fontSize: 14, fontWeight: "600" }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.footerBtn,
                                    { backgroundColor: (selectedDate && reason.trim()) ? colors.ghBlue : colors.ghBorder, borderColor: (selectedDate && reason.trim()) ? colors.ghBlue : colors.ghBorder }
                                ]}
                                onPress={handlePostpone}
                                disabled={!selectedDate || !reason.trim()}
                            >
                                <Text style={{ color: (selectedDate && reason.trim()) ? "#fff" : colors.ghMuted, fontSize: 14, fontWeight: "600" }}>Postpone</Text>
                            </TouchableOpacity>
                        </View>

                        {showCalendar && (
                            <CalendarModal
                                visible={showCalendar}
                                onClose={() => setShowCalendar(false)}
                                onSelect={(d) => {
                                    handleSelectDate(d);
                                    setShowCalendar(false);
                                }}
                                colors={colors}
                            />
                        )}
                    </RNAnimated.View>
                </RNAnimated.View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
    },
    modal: {
        width: "100%",
        maxWidth: 400,
        borderRadius: 12,
        borderWidth: 1,
        padding: 24,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "700",
    },
    label: {
        fontSize: 11,
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    input: {
        height: 80,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingTop: 12,
        fontSize: 14,
        textAlignVertical: "top",
    },
    buttonGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    presetBtn: {
        flex: 1,
        minWidth: '45%',
        borderWidth: 1,
        borderRadius: 6,
        paddingVertical: 10,
        alignItems: "center",
    },
    footer: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 12,
        marginTop: 24,
    },
    footerBtn: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 6,
        borderWidth: 1,
    },
});
