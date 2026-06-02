import { Task, CodeBlockParams, TaskStatus, TaskPriority } from "../types";

/**
 * KanbanView - Renders tasks in a kanban board grouped by status
 */
export class KanbanView {
  static render(
    container: HTMLElement,
    tasks: Task[],
    params: CodeBlockParams,
    onTaskUpdate: (task: Task) => Promise<void>
  ): void {
    const board = container.createEl("div", { cls: "task-kanban-board" });

    // Define columns
    const columns = [
      { id: "pending", title: "To Do", status: TaskStatus.Pending, color: "#6c757d" },
      { id: "in-progress", title: "In Progress", status: TaskStatus.InProgress, color: "#0d6efd" },
      { id: "completed", title: "Done", status: TaskStatus.Completed, color: "#198754" },
    ];

    // Only show completed if params allow
    const showCompleted = params.showCompleted ?? false;
    const visibleColumns = showCompleted ? columns : columns.filter((c) => c.status !== TaskStatus.Completed);

    for (const col of visibleColumns) {
      const column = board.createEl("div", { cls: "task-kanban-column" });

      // Column header
      const columnHeader = column.createEl("div", { cls: "task-kanban-column-header" });
      const colorDot = columnHeader.createEl("span", {
        cls: "task-kanban-column-color",
      });
      colorDot.style.backgroundColor = col.color;
      columnHeader.createEl("span", {
        cls: "task-kanban-column-title",
        text: col.title,
      });

      // Task count badge
      const columnTasks = tasks.filter((t) => t.status === col.status);
      const badge = columnHeader.createEl("span", {
        cls: "task-kanban-column-badge",
        text: String(columnTasks.length),
      });

      // Column body
      const columnBody = column.createEl("div", { cls: "task-kanban-column-body" });

      if (columnTasks.length === 0) {
        columnBody.createEl("div", {
          cls: "task-kanban-empty",
          text: "No tasks",
        });
      } else {
        for (const task of columnTasks) {
          const card = columnBody.createEl("div", {
            cls: `task-kanban-card task-kanban-card-${this.getPriorityClass(task.priority)}`,
          });

          // Card title
          const cardTitle = card.createEl("div", {
            cls: "task-kanban-card-title",
            text: task.title,
          });
          if (task.isGhost) {
            cardTitle.addClass("task-kanban-ghost");
          }

          // Card metadata
          const cardMeta = card.createEl("div", { cls: "task-kanban-card-meta" });

          // Due date
          if (task.dueDate) {
            const dueDateEl = cardMeta.createEl("span", {
              cls: "task-kanban-card-due",
            });
            const dateStr = task.dueDate.split(" ")[0];
            dueDateEl.textContent = this.formatDate(dateStr);
            if (this.isOverdue(task)) {
              dueDateEl.addClass("task-kanban-overdue");
            }
          }

          // Priority
          if (task.priority !== TaskPriority.None) {
            cardMeta.createEl("span", {
              cls: "task-kanban-card-priority",
              text: this.getPriorityIcon(task.priority),
            });
          }

          // Tags
          if (task.tags && task.tags.length > 0) {
            const tagsEl = card.createEl("div", { cls: "task-kanban-card-tags" });
            for (const tag of task.tags.slice(0, 3)) {
              const tagEl = tagsEl.createEl("span", { cls: "task-kanban-tag" });
              tagEl.textContent = `#${tag}`;
            }
          }

          // Card actions
          const cardActions = card.createEl("div", { cls: "task-kanban-card-actions" });

          // Move buttons
          if (col.status === TaskStatus.Pending) {
            const startBtn = cardActions.createEl("button", {
              cls: "task-kanban-action-btn",
              text: "Start",
            });
            startBtn.addEventListener("click", async () => {
              await onTaskUpdate({ ...task, status: TaskStatus.InProgress });
            });
          } else if (col.status === TaskStatus.InProgress) {
            const completeBtn = cardActions.createEl("button", {
              cls: "task-kanban-action-btn task-kanban-action-complete",
              text: "Complete",
            });
            completeBtn.addEventListener("click", async () => {
              await onTaskUpdate({
                ...task,
                status: TaskStatus.Completed,
                completedDate: new Date().toISOString().split("T")[0],
              });
            });
          } else if (col.status === TaskStatus.Completed) {
            const reopenBtn = cardActions.createEl("button", {
              cls: "task-kanban-action-btn",
              text: "Reopen",
            });
            reopenBtn.addEventListener("click", async () => {
              await onTaskUpdate({ ...task, status: TaskStatus.Pending, completedDate: undefined });
            });
          }
        }
      }
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
        return "";
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