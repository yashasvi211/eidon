import AddTaskModal from "./AddTaskModal";

export default function EditTaskModal({
  isOpen,
  onClose,
  task,
  onSave,
  projects = [],
}) {
  const handleSave = (updatedTaskData) => {
    if (onSave) {
      onSave(updatedTaskData);
    }
  };

  return (
    <AddTaskModal
      isOpen={isOpen}
      onClose={onClose}
      onAdd={handleSave}
      initialTask={task}
      projects={projects}
    />
  );
}
