import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
} from "react-native";
import { Colors } from "../constants/theme";
import { Task } from "./DetailPanel";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Project {
  name: string;
  color: string;
}

interface TaskPanelProps {
  tasks: Task[];
  projects: Project[];
  currentView: string;
  currentProject: string | null;
  toggleDone: (id: string) => void;
  onOpenDetail: (task: Task) => void;
  selectedTaskId: string | null;
  showCompleted: boolean;
  setShowCompleted: (val: boolean) => void;
}

const fmtSeconds = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const getDeadlineColorAndLabel = (dueDate?: string, colors?: any) => {
  if (!dueDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  let label = "";
  let color = colors.ghAmber;
  let bg = "rgba(210, 153, 34, 0.08)";
  let border = "rgba(210, 153, 34, 0.3)";

  if (diffDays < 0) {
    label = `· ${Math.abs(diffDays)}d overdue`;
    color = colors.ghRed;
    bg = "rgba(248, 81, 73, 0.08)";
    border = "rgba(248, 81, 73, 0.3)";
  } else if (diffDays === 0) {
    label = "· Today";
    color = "#e3b341";
    bg = "rgba(227, 179, 65, 0.1)";
    border = "rgba(227, 179, 65, 0.4)";
  } else if (diffDays === 1) {
    label = "· Tomorrow";
    color = "#f0883e";
    bg = "rgba(240, 136, 62, 0.08)";
    border = "rgba(240, 136, 62, 0.3)";
  } else if (diffDays <= 7) {
    label = `· ${diffDays}d left`;
    color = "#d29922";
    bg = "rgba(210, 153, 34, 0.08)";
    border = "rgba(210, 153, 34, 0.35)";
  } else {
    const [y, m, d] = dueDate.split("-");
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    label = `· ${months[parseInt(m) - 1]} ${parseInt(d)}`;
    color = "#3fb950";
    bg = "rgba(63, 185, 80, 0.08)";
    border = "rgba(63, 185, 80, 0.3)";
  }

  return { label, color, bg, border };
};

const getSubtaskProgressStyles = (done: number, total: number, colors: any) => {
  if (total === 0) return null;
  const pct = (done / total) * 100;
  let color = colors.ghMuted;
  let bg = "rgba(128,128,128,0.05)";
  let border = "rgba(128,128,128,0.2)";

  if (pct === 0) {
    color = "#f85149";
    bg = "rgba(248, 81, 73, 0.08)";
    border = "rgba(248, 81, 73, 0.3)";
  } else if (pct < 40) {
    color = "#f0883e";
    bg = "rgba(240, 136, 62, 0.08)";
    border = "rgba(240, 136, 62, 0.3)";
  } else if (pct < 70) {
    color = "#d29922";
    bg = "rgba(210, 153, 34, 0.08)";
    border = "rgba(210, 153, 34, 0.3)";
  } else if (pct < 100) {
    color = "#56d4dd";
    bg = "rgba(86, 212, 221, 0.08)";
    border = "rgba(86, 212, 221, 0.3)";
  } else {
    color = "#3fb950";
    bg = "rgba(63, 185, 80, 0.1)";
    border = "rgba(63, 185, 80, 0.35)";
  }

  return { color, bg, border };
};

export default function TaskPanel({
  tasks,
  projects,
  currentView,
  currentProject,
  toggleDone,
  onOpenDetail,
  selectedTaskId,
  showCompleted,
  setShowCompleted,
}: TaskPanelProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === "unspecified" ? "light" : scheme];
  const insets = useSafeAreaInsets();

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const isTaskBacklog = (t: Task) =>
    t.target === "backlog" || (t.due && t.due < todayStr);
  const isTaskCurrent = (t: Task) =>
    !isTaskBacklog(t) &&
    (t.target === "today" ||
      t.due === todayStr ||
      (!t.due && t.target === "today"));

  // Filtering based on view & project & completed state
  const baseFiltered = tasks
    .filter((t) => {
      if (currentProject) return t.project === currentProject;
      if (currentView === "inbox") return t.project === "Inbox";
      const backlog = isTaskBacklog(t);
      if (currentView === "backlog") return backlog;
      if (currentView === "today") return !backlog && isTaskCurrent(t);
      return t.target === currentView && !backlog;
    })
    .filter((t) => {
      if (!showCompleted && t.done) return false;
      return true;
    });

  const getProjectColor = (pName: string) => {
    const found = projects.find((proj) => proj.name === pName);
    return found ? found.color : "#bc8cff";
  };

  const renderTaskItem = (task: Task) => {
    const pColor = getProjectColor(task.project);
    const isHex = pColor.startsWith("#");
    const projectBorderColor = isHex
      ? `${pColor}4d`
      : "rgba(188, 140, 255, 0.3)";
    const projectBgColor = isHex ? `${pColor}14` : "rgba(188, 140, 255, 0.08)";

    const totalSeconds = (task.sessions || []).reduce(
      (acc, sess) => acc + (sess.end - sess.start) / 1000,
      0,
    );
    const subtasksDone = (task.subtasks || []).filter((s) => s.done).length;
    const totalSubtasks = (task.subtasks || []).length;

    const isActive = selectedTaskId === task.id;
    const dlInfo = getDeadlineColorAndLabel(task.due, colors);
    const subtaskStyles = getSubtaskProgressStyles(
      subtasksDone,
      totalSubtasks,
      colors,
    );

    return (
      <Animated.View
        key={task.id}
        layout={LinearTransition}
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(150)}
      >
        <View
          style={[
            styles.taskItem,
            { borderBottomColor: colors.ghBorder },
            isActive && { backgroundColor: "rgba(31,111,235,0.06)" },
          ]}
        >
          {/* Custom Checkbox */}
          <TouchableOpacity
            style={styles.checkboxTouchArea}
            onPress={() => toggleDone(task.id)}
          >
            <View
              style={[
                styles.checkbox,
                { borderColor: task.done ? colors.ghGreen : colors.ghBorder2 },
                task.done && { backgroundColor: colors.ghGreen },
              ]}
            >
              {task.done && <Text style={styles.checkmark}>✓</Text>}
            </View>
          </TouchableOpacity>

          {/* Task Details Area */}
          <TouchableOpacity
            style={styles.taskBodyTouchArea}
            onPress={() => onOpenDetail(task)}
          >
            <View style={styles.taskBody}>
              <Text
                style={[
                  styles.taskTitle,
                  { color: task.done ? colors.ghMuted : colors.ghText },
                  task.done && styles.lineThrough,
                ]}
                numberOfLines={2}
              >
                {task.title}
              </Text>

              <View style={styles.taskMeta}>
                {/* Project Tag */}
                <Text
                  style={[
                    styles.taskTag,
                    {
                      color: pColor,
                      borderColor: projectBorderColor,
                      backgroundColor: projectBgColor,
                    },
                  ]}
                >
                  {task.project}
                </Text>

                {/* Deadline Tag */}
                {dlInfo && (
                  <Text
                    style={[
                      styles.taskTag,
                      {
                        color: dlInfo.color,
                        borderColor: dlInfo.border,
                        backgroundColor: dlInfo.bg,
                      },
                    ]}
                  >
                    {dlInfo.label}
                  </Text>
                )}

                {/* Subtask count */}
                {subtaskStyles && (
                  <Text
                    style={[
                      styles.taskTag,
                      {
                        color: subtaskStyles.color,
                        borderColor: subtaskStyles.border,
                        backgroundColor: subtaskStyles.bg,
                      },
                    ]}
                  >
                    ✓ {subtasksDone}/{totalSubtasks}
                  </Text>
                )}
              </View>
            </View>

            {/* Logged Timer Value */}
            {totalSeconds > 0 && (
              <View
                style={[
                  styles.timeLogBadge,
                  {
                    backgroundColor: colors.ghSurface2,
                    borderColor: colors.ghBorder,
                  },
                ]}
              >
                <Text
                  style={[styles.timeLogBadgeText, { color: colors.ghMuted }]}
                >
                  {fmtSeconds(totalSeconds)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  const renderContent = () => {
    if (!currentProject && currentView === "backlog") {
      const byProject = baseFiltered.reduce((acc, t) => {
        if (!acc[t.project]) acc[t.project] = [];
        acc[t.project].push(t);
        return acc;
      }, {} as Record<string, Task[]>);

      const projectNames = Object.keys(byProject).sort();

      return (
        <ScrollView style={styles.taskList} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }} {...{ delaysContentTouches: false }}>
          {projectNames.map((pName) => (
            <View key={pName} style={styles.projectSection}>
              <Text style={[styles.projectSectionTitle, { color: colors.ghMuted }]}>
                {pName}
              </Text>
              {byProject[pName].map(renderTaskItem)}
            </View>
          ))}
          {baseFiltered.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={{ color: colors.ghMuted, fontSize: 13 }}>
                No backlog tasks found.
              </Text>
            </View>
          )}
        </ScrollView>
      );
    }

    if (currentProject) {
      const backlogTasks = baseFiltered.filter(isTaskBacklog);
      const currentTasks = baseFiltered.filter(isTaskCurrent);
      const futureTasks = baseFiltered.filter(
        (t) => !isTaskBacklog(t) && !isTaskCurrent(t),
      );

      if (baseFiltered.length === 0) {
        return (
          <View style={styles.emptyState}>
            <Text style={{ color: colors.ghMuted, fontSize: 13 }}>
              No tasks in this project.
            </Text>
          </View>
        );
      }

      return (
        <ScrollView style={styles.taskList} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }} {...{ delaysContentTouches: false }}>
          {backlogTasks.length > 0 && (
            <View style={styles.projectSection}>
              <Text
                style={[styles.projectSectionTitle, { color: colors.ghMuted }]}
              >
                Backlog
              </Text>
              {backlogTasks.map(renderTaskItem)}
            </View>
          )}
          {currentTasks.length > 0 && (
            <View style={styles.projectSection}>
              <Text
                style={[styles.projectSectionTitle, { color: colors.ghMuted }]}
              >
                Current
              </Text>
              {currentTasks.map(renderTaskItem)}
            </View>
          )}
          {futureTasks.length > 0 && (
            <View style={styles.projectSection}>
              <Text
                style={[styles.projectSectionTitle, { color: colors.ghMuted }]}
              >
                Future Date
              </Text>
              {futureTasks.map(renderTaskItem)}
            </View>
          )}
        </ScrollView>
      );
    }

    return (
      <ScrollView style={styles.taskList} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }} {...{ delaysContentTouches: false }}>
        {baseFiltered.map(renderTaskItem)}
        {baseFiltered.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={{ color: colors.ghMuted, fontSize: 13 }}>
              No tasks found here.
            </Text>
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.ghBg }]}>
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "column",
  },
  taskList: {
    flex: 1,
  },
  projectSection: {
    marginTop: 8,
  },
  projectSectionTitle: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  taskItem: {
    flexDirection: "row",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    alignItems: "center",
    position: "relative",
  },
  activeBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  checkboxTouchArea: {
    paddingVertical: 12,
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  taskBodyTouchArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  checkmark: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
  },
  taskBody: {
    flex: 1,
    marginRight: 8,
  },
  taskTitle: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 4,
  },
  taskMeta: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  taskTag: {
    fontSize: 9,
    fontFamily: "monospace",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: 10,
    alignSelf: "flex-start",
    overflow: "hidden",
  },
  timeLogBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  timeLogBadgeText: {
    fontSize: 11,
    fontFamily: "monospace",
    fontWeight: "600",
  },
  emptyState: {
    padding: 32,
    alignItems: "center",
  },
  lineThrough: {
    textDecorationLine: "line-through",
  },
});
