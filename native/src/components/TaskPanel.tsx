import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  FlatList,
} from "react-native";
import { Colors } from "../constants/theme";
import { Task } from "./DetailPanel";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

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
  setTasks?: (updater: (prev: Task[]) => Task[]) => void;
  onDeleteTask?: (id: string) => void;
}

const fmtSeconds = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const getExecutionStatus = (task: Task, colors: any) => {
  if (!task.due) return null;

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const dueObj = new Date(task.due + "T00:00:00");
  if (task.dueTime && task.dueTime.trim() !== '') {
    const [h, m] = task.dueTime.split(":").map(Number);
    if (!isNaN(h) && !isNaN(m)) dueObj.setHours(h, m, 0, 0);
  } else {
    dueObj.setHours(23, 59, 59, 999);
  }

  const today = new Date(todayStr + "T00:00:00");
  const diffDueDays = Math.round((dueObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const diffMs = dueObj.getTime() - now.getTime();
  if (diffMs < 0) {
    const overMs = Math.abs(diffMs);
    const overDays = Math.floor(overMs / (1000 * 60 * 60 * 24));
    const overHours = Math.floor((overMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const overMins = Math.floor((overMs % (1000 * 60 * 60)) / (1000 * 60));
    let labelStr = `${overDays}d overdue`;
    if (overDays === 0 && overHours > 0) labelStr = `${overHours}h overdue`;
    else if (overDays === 0 && overHours === 0) labelStr = `${Math.max(1, overMins)}m overdue`;
    return {
      label: `! Overdue`,
      color: colors.ghRed || '#f85149',
      bg: "rgba(248, 81, 73, 0.08)",
      border: "rgba(248, 81, 73, 0.3)",
    };
  }

  if (task.execStartDate) {
    const execStart = new Date(task.execStartDate + "T00:00:00");
    const diffExecDays = Math.round((execStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffExecDays > 0) {
      return {
        label: `· Starts in ${diffExecDays}d`,
        color: colors.ghMuted,
        bg: "rgba(128,128,128,0.05)",
        border: "rgba(128,128,128,0.2)",
      };
    } else {
      return {
        label: `· Active (${diffDueDays}d left)`,
        color: "#56d4dd",
        bg: "rgba(86, 212, 221, 0.08)",
        border: "rgba(86, 212, 221, 0.3)",
      };
    }
  }

  if (diffDueDays <= 2) {
    return {
      label: diffDueDays === 0 ? "· Due Today" : `· Due in ${diffDueDays}d`,
      color: "#d29922",
      bg: "rgba(210, 153, 34, 0.08)",
      border: "rgba(210, 153, 34, 0.35)",
    };
  }

  const [y, m, d] = task.due.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return {
    label: `· ${months[parseInt(m) - 1]} ${parseInt(d)}`,
    color: "#3fb950",
    bg: "rgba(63, 185, 80, 0.08)",
    border: "rgba(63, 185, 80, 0.3)"
  };
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

type ListItem = 
  | { type: 'header'; id: string; title: string; isCompletedHeader?: boolean }
  | { type: 'task'; id: string; task: Task; index: number }
  | { type: 'empty'; id: string; message: string };

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
  setTasks,
  onDeleteTask
}: TaskPanelProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === "unspecified" ? "light" : scheme];
  const insets = useSafeAreaInsets();

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const isTaskOverdue = (t: Task) => {
    if (t.done || !t.due) return false;
    const nowObj = new Date();
    const dueObj = new Date(t.due + "T00:00:00");
    if (t.dueTime && t.dueTime.trim() !== '') {
      const [h, m] = t.dueTime.split(":").map(Number);
      if (!isNaN(h) && !isNaN(m)) dueObj.setHours(h, m, 0, 0);
    } else {
      dueObj.setHours(23, 59, 59, 999);
    }
    return nowObj.getTime() > dueObj.getTime();
  };

  const isTaskCurrent = (t: Task) => {
    if (t.target === "backlog") return false;
    if (t.due && t.due > todayStr && !isTaskOverdue(t)) return false;
    return t.target === "today" || (!!t.due && (t.due <= todayStr || isTaskOverdue(t))) || (!t.due && t.target === "today");
  };

  const baseFiltered = tasks
    .filter((t, idx, self) => self.findIndex(x => x.id === t.id) === idx)
    .filter((t) => {
      if (currentProject) return t.project === currentProject;
      if (currentView === "inbox") return t.project === "Inbox";
      if (currentView === "all") return true;
      if (currentView === "today") return isTaskCurrent(t);
      return t.target === currentView;
    })
    .sort((a, b) => {
      const getPriorityWeight = (priority?: string) => {
        if (priority === 'High') return 3;
        if (priority === 'Moderate') return 2;
        if (priority === 'Low') return 1;
        return 0;
      };
      return getPriorityWeight(b.priority) - getPriorityWeight(a.priority);
    });

  const getProjectColor = (pName: string) => {
    const found = projects.find((proj) => proj.name === pName);
    return found ? found.color : "#bc8cff";
  };

  const renderTaskItem = (task: Task, index: number) => {
    const pColor = getProjectColor(task.project);
    const isHex = pColor.startsWith("#");
    const projectBorderColor = isHex ? `${pColor}4d` : "rgba(188, 140, 255, 0.3)";
    const projectBgColor = isHex ? `${pColor}14` : "rgba(188, 140, 255, 0.08)";

    const totalSeconds = (task.sessions || []).reduce((acc, sess) => acc + (sess.end - sess.start) / 1000, 0);
    const subtasksDone = (task.subtasks || []).filter((s) => s.done).length;
    const totalSubtasks = (task.subtasks || []).length;

    const isActive = selectedTaskId === task.id;
    const dlInfo = getExecutionStatus(task, colors);
    const subtaskStyles = getSubtaskProgressStyles(subtasksDone, totalSubtasks, colors);

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


            {/* Task Details Area */}
            <TouchableOpacity 
              style={styles.taskBodyTouchArea}
              onPress={() => onOpenDetail(task)}
              activeOpacity={0.7}
            >
              <Text style={[styles.taskNumber, { color: colors.ghMuted }]}>
                {index}.
              </Text>
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

                  {/* Priority Tag */}
                  {task.priority && (
                    <Text
                      style={[
                        styles.taskTag,
                        {
                          color: task.priority === 'High' ? (colors.ghRed || '#f85149') : task.priority === 'Moderate' ? (colors.ghAmber || '#d29922') : (colors.ghGreen || '#3fb950'),
                          borderColor: task.priority === 'High' ? 'rgba(248, 81, 73, 0.3)' : task.priority === 'Moderate' ? 'rgba(210, 153, 34, 0.3)' : 'rgba(63, 185, 80, 0.3)',
                          backgroundColor: task.priority === 'High' ? 'rgba(248, 81, 73, 0.08)' : task.priority === 'Moderate' ? 'rgba(210, 153, 34, 0.08)' : 'rgba(63, 185, 80, 0.08)',
                        },
                      ]}
                    >
                      {task.priority === 'High' ? '↑ High' : task.priority === 'Moderate' ? '• Moderate' : '↓ Low'}
                    </Text>
                  )}

                  {/* Deadline / Status Tag */}
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

                  {/* Recurring indicator */}
                  {task.recurrence && (
                    <Text
                      style={[
                        styles.taskTag,
                        {
                          color: '#58a6ff',
                          borderColor: 'rgba(88,166,255,0.3)',
                          backgroundColor: 'rgba(88,166,255,0.08)',
                        },
                      ]}
                    >
                      ↻ {task.recurrence.frequency}
                    </Text>
                  )}

                  {/* Streak badge */}
                  {task.recurrence?.streakEnabled && task.recurrence.currentStreak > 0 && (
                    <Text
                      style={[
                        styles.taskTag,
                        {
                          color: '#f0883e',
                          borderColor: 'rgba(240,136,62,0.35)',
                          backgroundColor: 'rgba(240,136,62,0.1)',
                        },
                      ]}
                    >
                      ★ {task.recurrence.currentStreak}
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
                      marginRight: 8,
                    },
                  ]}
                >
                  <Text style={[styles.timeLogBadgeText, { color: colors.ghMuted }]}>
                    {fmtSeconds(totalSeconds)}
                  </Text>
                </View>
              )}

            </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'header') {
      if (item.isCompletedHeader) {
        return (
          <TouchableOpacity 
            style={[styles.projectSection, { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }]} 
            onPress={() => setShowCompleted(!showCompleted)}
            activeOpacity={0.7}
          >
            <Feather name={showCompleted ? "chevron-down" : "chevron-right"} size={14} color={colors.ghMuted} style={{ marginRight: 4 }} />
            <Text style={[styles.projectSectionTitle, { color: colors.ghMuted, paddingHorizontal: 0 }]}>
              {item.title}
            </Text>
          </TouchableOpacity>
        );
      }
      return (
        <View style={styles.projectSection}>
          <Text style={[styles.projectSectionTitle, { color: colors.ghMuted }]}>
            {item.title}
          </Text>
        </View>
      );
    }
    if (item.type === 'empty') {
      return (
        <View style={styles.emptyState}>
          <Text style={{ color: colors.ghMuted, fontSize: 13 }}>
            {item.message}
          </Text>
        </View>
      );
    }
    return renderTaskItem(item.task, item.index);
  };

  let listData: ListItem[] = [];
  let taskCounter = 1;

  const activeTasks = baseFiltered.filter(t => !t.done);
  const completedTasks = baseFiltered.filter(t => t.done);

  if (!currentProject && currentView === "all") {
    const byProject = activeTasks.reduce((acc, t) => {
      if (!acc[t.project]) acc[t.project] = [];
      acc[t.project].push(t);
      return acc;
    }, {} as Record<string, Task[]>);

    const projectNames = Object.keys(byProject).sort();

    projectNames.forEach(pName => {
      listData.push({ type: 'header', id: `header-${pName}`, title: pName });
      byProject[pName].forEach(t => {
        listData.push({ type: 'task', id: t.id, task: t, index: taskCounter++ });
      });
    });

    if (activeTasks.length === 0 && completedTasks.length === 0) {
      listData.push({ type: 'empty', id: 'empty-all', message: 'No tasks found.' });
    }
  } else if (currentProject) {
    const overdueTasks = activeTasks.filter(t => isTaskOverdue(t));
    const currentTasks = activeTasks.filter(t => !isTaskOverdue(t) && ((!!t.due && t.due === todayStr) || (!t.due && (t.target === 'today' || !t.target))));
    const futureTasks = activeTasks.filter(t => !isTaskOverdue(t) && !!t.due && t.due > todayStr);

    if (activeTasks.length === 0 && completedTasks.length === 0) {
      listData.push({ type: 'empty', id: 'empty-project', message: 'No tasks in this project.' });
    } else {
      if (overdueTasks.length > 0) {
        listData.push({ type: 'header', id: 'header-overdue', title: '! Overdue' });
        overdueTasks.forEach(t => listData.push({ type: 'task', id: t.id, task: t, index: taskCounter++ }));
      }
      if (currentTasks.length > 0) {
        listData.push({ type: 'header', id: 'header-current', title: 'Current / Today' });
        currentTasks.forEach(t => listData.push({ type: 'task', id: t.id, task: t, index: taskCounter++ }));
      }
      if (futureTasks.length > 0) {
        listData.push({ type: 'header', id: 'header-future', title: 'Scheduled / Future' });
        futureTasks.forEach(t => listData.push({ type: 'task', id: t.id, task: t, index: taskCounter++ }));
      }
    }
  } else {
    activeTasks.forEach(t => listData.push({ type: 'task', id: t.id, task: t, index: taskCounter++ }));
    if (activeTasks.length === 0 && completedTasks.length === 0) {
      listData.push({ type: 'empty', id: 'empty-view', message: 'No tasks found here.' });
    }
  }

  if (completedTasks.length > 0) {
    listData.push({ 
      type: 'header', 
      id: 'header-completed', 
      title: `Completed (${completedTasks.length})`,
      isCompletedHeader: true
    });
    if (showCompleted) {
      completedTasks.forEach(t => listData.push({ type: 'task', id: t.id, task: t, index: taskCounter++ }));
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.ghBg }]}>
      <FlatList
        data={listData}
        keyExtractor={(item, index) => `${item.id}_${index}`}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "column",
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
    paddingLeft: 8,
    paddingRight: 16,
    borderBottomWidth: 1,
    alignItems: "center",
    position: "relative",
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
  taskNumber: {
    marginRight: 14,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "monospace",
    width: 26,
    textAlign: "right",
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
