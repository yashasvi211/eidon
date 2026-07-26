import re

with open('src/app/index.tsx', 'r') as f:
    content = f.read()

# a) Import the new components
imports = """import TrackingScreen from "../components/TrackingScreen";
import TrackerDetail from "../components/TrackerDetail";
import AddTrackerModal from "../components/AddTrackerModal";
import { Tracker } from "../types/tracking";
"""
content = re.sub(r'import AddTaskModal from "\.\./components/AddTaskModal";', imports + 'import AddTaskModal from "../components/AddTaskModal";', content)

# b) Add state
states = """  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [selectedTracker, setSelectedTracker] = useState<Tracker | null>(null);
  const [showAddTrackerModal, setShowAddTrackerModal] = useState(false);
"""
content = re.sub(r'  const \[showAddProjectModal, setShowAddProjectModal\] = useState\(false\);', '  const [showAddProjectModal, setShowAddProjectModal] = useState(false);\n' + states, content)

# c) Load trackers
load = """      const fetchedTrackers = await api.getTrackers();
      setTrackers(fetchedTrackers || []);
"""
content = re.sub(r'      const sets = await api.getSettings\(\);\n      setSettings\(sets\);', '      const sets = await api.getSettings();\n      setSettings(sets);\n' + load, content)

# d) Add handler functions
handlers = """
  const handleAddTracker = async (tracker: Tracker) => {
    setTrackers(prev => [...prev, tracker]);
    await api.createTracker(tracker);
    setShowAddTrackerModal(false);
  };

  const handleUpdateTracker = async (updated: Tracker) => {
    setTrackers(prev => prev.map(t => t.id === updated.id ? updated : t));
    await api.updateTracker(updated.id, updated);
    setSelectedTracker(updated);
  };

  const handleDeleteTracker = async (trackerId: string) => {
    setTrackers(prev => prev.filter(t => t.id !== trackerId));
    await api.deleteTracker(trackerId);
    setSelectedTracker(null);
  };
"""
content = re.sub(r'  const toggleTaskStatus = async \(taskId: string\) => \{', handlers + '\n  const toggleTaskStatus = async (taskId: string) => {', content)

# e) In renderMiddlePanel(), add tracking view before return EmptyState
tracking_view = """
    if (currentView === "tracking") {
      if (selectedTracker) {
        return (
          <TrackerDetail
            tracker={selectedTracker}
            onBack={() => setSelectedTracker(null)}
            onUpdate={handleUpdateTracker}
            onDelete={() => handleDeleteTracker(selectedTracker.id)}
          />
        );
      }
      return (
        <TrackingScreen
          trackers={trackers}
          onSelectTracker={(t) => setSelectedTracker(t)}
          onAddTracker={() => setShowAddTrackerModal(true)}
        />
      );
    }
"""
content = re.sub(r'    return \(\n      <View style=\{\[styles\.emptyMiddle, \{ backgroundColor: colors\.ghSurface \}\]\}>', tracking_view + '\n    return (\n      <View style={[styles.emptyMiddle, { backgroundColor: colors.ghSurface }]}>', content)

# f) Header title mapping
header_title = """          : currentView === "tracking" && !selectedTracker
          ? "Tracking"
          : currentView === "tracking" && selectedTracker
          ? selectedTracker.name
"""
content = re.sub(r'          : currentView === "settings" \? "Settings"\n', '          : currentView === "settings" ? "Settings"\n' + header_title, content)

# g) AddTrackerModal in JSX tree
modal = """      {showAddTrackerModal && (
        <AddTrackerModal
          visible={showAddTrackerModal}
          onClose={() => setShowAddTrackerModal(false)}
          onAdd={handleAddTracker}
        />
      )}
"""
content = re.sub(r'      \{showSettingsModal && \(', modal + '\n      {showSettingsModal && (', content)

# h) headerRight button
header_right = """        <View style={styles.headerRight}>
          {currentView === "tracking" && !selectedTracker ? (
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddTrackerModal(true)}>
              <Feather name="plus" size={20} color="#fff" />
              <Text style={styles.addBtnText}>New Tracker</Text>
            </TouchableOpacity>
          ) : currentView !== "settings" && currentView !== "stats" && currentView !== "timetracking" && currentView !== "tracking" && !selectedTask ? (
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
              <Feather name="plus" size={20} color="#fff" />
              <Text style={styles.addBtnText}>Add Task</Text>
            </TouchableOpacity>
          ) : null}
        </View>"""
content = re.sub(r'        <View style=\{styles\.headerRight\}>\s*\{currentView !== "settings" && currentView !== "stats" && currentView !== "timetracking" && !selectedTask \? \(\s*<TouchableOpacity style=\{styles\.addBtn\} onPress=\{\(\) => setShowAddModal\(true\)\}>\s*<Feather name="plus" size=\{20\} color="#fff" />\s*<Text style=\{styles\.addBtnText\}>Add Task</Text>\s*</TouchableOpacity>\s*\) : null\}\s*</View>', header_right, content, flags=re.DOTALL)

# i) clear selectedTracker when currentView changes
# We can just put a useEffect after the others
use_effect = """
  useEffect(() => {
    if (currentView !== 'tracking') setSelectedTracker(null);
  }, [currentView]);
"""
content = re.sub(r'  useEffect\(\(\) => \{\n    if \(currentView !== \'stats\'\) \{', use_effect + "\n  useEffect(() => {\n    if (currentView !== 'stats') {", content)

with open('src/app/index.tsx', 'w') as f:
    f.write(content)
