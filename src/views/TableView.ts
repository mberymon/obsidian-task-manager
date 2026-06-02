import { Task, CodeBlockParams, TaskStatus, TaskPriority } from "../types";

/**
 * TableView - Renders tasks in a sortable, filterable table
 */
export class TableView {
  static render(
    container: HTMLElement,
    tasks: Task[],
    params: CodeBlockParams,
    onTaskUpdate: (task: Task) => Promise<void>
  ): void {
    const table = container.createEl("table", { cls: "task-table" });

    // Header
    const thead = table.createEl("thead");
    const headerRow = thead.createEl("tr");

    const columns = [
      { id: "checkbox", title: "", sortable: false },
      { id: "title", title: "Task", sortable: true },
      { id: "dueDate", title: "Due", sortable: true },
      { id: "priority", title: "Priority", sortable: true },
      { id: "tags", title: "Tags", sortable: false },
      { id: "group", title: "Group", sortable: true },
      { id: "actions", title: "", sortable: false },
    ];

    for (const col of columns) {
      const th = headerRow.createEl("th", { cls: `task-table-header task-table-header-${col.id}` });
      if (col.sortable) {
        th.style.cursor = "pointer";
        th.textContent = col.title;
        th.addEventListener("click", () => {
          // Sorting handled by code block params
        });
      } else {
        th.textContent = col.title;
      }
    }

    // Body
    const tbody = table.createEl("tbody");

    if (tasks.length === 0) {
      const emptyRow = tbody.createEl("tr");
      const emptyCell = emptyRow.createEl("td", {
        attr: { colspan: String(columns.length) },
        cls: "task-table-empty",
      });
      emptyCell.textContent = "No tasks found. Create one with the button above.";
      return;
    }

    for (const task of tasks) {
      const row = tbody.createEl("tr", {
        cls: `task-table-row task-table-row-${this.getStatusClass(task.status)}`,
      });

      // Checkbox
      const checkboxCell = row.createEl("td", { cls: "task-table-cell task-table-cell-checkbox" });
      const checkbox = checkboxCell.createEl("input", {
        type: "checkbox",
        cls: "task-table-checkbox",
      });
      checkbox.checked = task.status === TaskStatus.Completed;
      checkbox.addEventListener("change", async () => {
        await onTaskUpdate({
          ...task,
          status: checkbox.checked ? TaskStatus.Completed : TaskStatus.Pending,
          completedDate: checkbox.checked
            ? new Date().toISOString().split("T")[0]
            : undefined,
        });
      });

      // Title
      const titleCell = row.createEl("td", { cls: "task-table-cell task-table-cell-title" });
      titleCell.textContent = task.title;
      if (task.isGhost) {
        titleCell.addClass("task-table-ghost");
      }

      // Due date
      const dueDateCell = row.createEl("td", { cls: "task-table-cell task-table-cell-dueDate" });
      if (task.dueDate) {
        const dateStr = task.dueDate.split(" ")[0];
        dueDateCell.textContent = this.formatDate(dateStr);
        if (this.isOverdue(task)) {
          dueDateCell.addClass("task-table-overdue");
        }
      }

      // Priority
      const priorityCell = row.createEl("td", { cls: "task-table-cell task-table-cell-priority" });
      priorityCell.textContent = this.getPriorityIcon(task.priority);
      priorityCell.addClass(`task-table-priority-${this.getPriorityClass(task.priority)}`);

      // Tags
      const tagsCell = row.createEl("td", { cls: "task-table-cell task-table-cell-tags" });
      if (task.tags && task.tags.length > 0) {
        for (const tag of task.tags) {
          const tagEl = tagsCell.createEl("span", { cls: "task-table-tag" });
          tagEl.textContent = `#${tag}`;
        }
      }

      // Group
      const groupCell = row.createEl("td", { cls: "task-table-cell task-table-cell-group" });
      if (task.group) {
        groupCell.textContent = task.group;
      }

      // Actions
      const actionsCell = row.createEl("td", { cls: "task-table-cell task-table-cell-actions" });
      const deleteBtn = actionsCell.createEl("button", {
        cls: "task-table-action-btn",
        text: "×",
      });
      deleteBtn.title = "Delete task";
      deleteBtn.addEventListener("click", async () => {
        await onTaskUpdate({ ...task, status: TaskStatus.Cancelled });
      });
    }
  }

  private static getStatusClass(status: TaskStatus): string {
    switch (status) {
      case TaskStatus.Completed:
        return "completed";
      case TaskStatus.InProgress:
        return "in-progress";
      case TaskStatus.Cancelled:
        return "cancelled";
      default:
        return "pending";
    }
  }

  private static getPriorityIcon(priority: TaskPriority): string {
    switch (priority) {
      case TaskPriority.Urgent:
        return "⏫";
      case TaskPriority.High:
        return "🔼";
      case TaskPriority.Medium:
        return "➡️";
      case TaskPriority.Low:
        return "🔽";
      default:
        return "—";
    }
  }

  private static getPriorityClass(priority: TaskPriority): string {
    switch (priority) {
      case TaskPriority.Urgent:
        return "urgent";
      case TaskPriority.High:
        return "high";
      case TaskPriority.Medium:
        return "medium";
      case TaskPriority.Low:
        return "low";
      default:
        return "none";
    }
  }

  private static formatDate(dateStr: string): string {
    const date = new Date(dateStr + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const taskDate = new Date(dateStr + "T00:00:00");
    taskDate.setHours(0, 0, 0, 0);

    if (taskDate.getTime() === today.getTime()) return "Today";
    if (taskDate.getTime() === tomorrow.getTime()) return "Tomorrow";
    if (taskDate.getTime() === yesterday.getTime()) return "Yesterday";

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  private static isOverdue(task: Task): boolean {
    if (!task.dueDate || task.status === TaskStatus.Completed) return false;
    const dueDate = task.dueDate.split(" ")[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate + "T00:00:00");
    due.setHours(0, 0, 0, 0);
    return due.getTime() < today.getTime();
  }
}