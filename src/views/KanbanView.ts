import { Task, CodeBlockParams, TaskStatus, TaskPriority } from "../types";

/**
 * KanbanView - Renders tasks in a kanban board grouped by status
 */
export class KanbanView {
  static render(
    container: HTMLElement,
    tasks: Task[],
    params: CodeBlockParams,
    onTaskUpdate: (task: Task) => Promise<void>,
    onTaskCreate: () => void
  ): void {
    container.empty();
    container.addClass("kanban-container");

    // Header
    const header = container.createDiv({ cls: "kanban-header" });
    const headerLeft = header.createDiv({ cls: "kanban-header-left" });
    headerLeft.createSpan({ cls: "kanban-board-title", text: "Task Board" });

    const headerRight = header.createDiv({ cls: "kanban-header-right" });

    // Sort dropdown
    const sortWrap = headerRight.createDiv({ cls: "kanban-sort-wrap" });
    sortWrap.createEl("label", { text: "Sort:", cls: "kanban-sort-label" });
    const sortSelect = sortWrap.createEl("select", { cls: "kanban-sort-select" });
    const sortOptions = [
      { value: "", label: "Default" },
      { value: "dueDate", label: "Due Date" },
      { value: "priority", label: "Priority" },
      { value: "title", label: "Title" },
      { value: "project", label: "Project" },
    ];
    for (const opt of sortOptions) {
      const option = sortSelect.createEl("option", { value: opt.value, text: opt.label });
      if (opt.value === params.sortBy) option.selected = true;
    }

    // Toggle completed button
    const toggleBtn = headerRight.createEl("button", {
      cls: `kanban-header-btn${params.showCompleted ? " is-active" : ""}`,
      title: params.showCompleted ? "Hide completed" : "Show completed",
    });
    toggleBtn.createEl("span", { text: "✓" });

    // Board
    const board = container.createDiv({ cls: "kanban-board" });
    const columns = board.createDiv({ cls: "kanban-columns" });

    // Define columns
    const columnDefs = [
      { id: "pending", title: "To Do", status: TaskStatus.Pending, color: "var(--text-muted)" },
      { id: "in-progress", title: "In Progress", status: TaskStatus.InProgress, color: "var(--interactive-accent)" },
      { id: "completed", title: "Done", status: TaskStatus.Completed, color: "var(--text-success)" },
    ];

    const showCompleted = params.showCompleted ?? false;
    const visibleColumns = showCompleted ? columnDefs : columnDefs.filter((c) => c.status !== TaskStatus.Completed);

    for (const col of visibleColumns) {
      const column = columns.createDiv({ cls: "kanban-column" });

      // Column header
      const columnHeader = column.createDiv({ cls: "kanban-column-header" });
      const colorDot = columnHeader.createSpan({ cls: "kanban-column-color" });
      colorDot.style.backgroundColor = col.color;
      columnHeader.createSpan({ cls: "kanban-column-title", text: col.title });

      // Task count badge
      const columnTasks = tasks.filter((t) => t.status === col.status);
      columnHeader.createSpan({
        cls: "kanban-column-count",
        text: String(columnTasks.length),
      });

      // Column body
      const columnBody = column.createDiv({ cls: "kanban-column-body" });

      if (columnTasks.length === 0) {
        columnBody.createDiv({ cls: "kanban-column-empty", text: "No tasks" });
      } else {
        for (const task of columnTasks) {
          this.renderCard(columnBody, task, col, onTaskUpdate);
        }
      }
    }
  }

  private static renderCard(
    container: HTMLElement,
    task: Task,
    col: { id: string; title: string; status: TaskStatus; color: string },
    onTaskUpdate: (task: Task) => Promise<void>
  ): void {
    const card = container.createDiv({
      cls: `kanban-card kanban-card-${this.getPriorityClass(task.priority)}`,
    });

    // Card title row
    const titleRow = card.createDiv({ cls: "kanban-card-title-row" });

    // Priority dot
    const dot = titleRow.createSpan({
      cls: `kanban-card-dot kanban-card-dot-${this.getPriorityClass(task.priority)}`,
    });

    // Title
    const titleSpan = titleRow.createSpan({ cls: "kanban-card-title", text: task.title });
    if (task.isGhost) {
      titleSpan.addClass("kanban-card-ghost");
    }

    // Card meta
    const cardMeta = card.createDiv({ cls: "kanban-card-meta" });

    // Due date
    if (task.dueDate) {
      const dueDateEl = cardMeta.createSpan({ cls: "kanban-card-due" });
      const dateStr = task.dueDate.split(" ")[0];
      const timeStr = task.dueDate.includes(" ") ? task.dueDate.split(" ")[1] : null;
      dueDateEl.textContent = this.formatDate(dateStr);
      if (timeStr) {
        dueDateEl.createSpan({ cls: "kanban-card-due-time", text: timeStr });
      }
      if (this.isOverdue(task)) {
        dueDateEl.addClass("kanban-card-overdue");
      }
    }

    // Project pill
    if (task.project) {
      cardMeta.createSpan({ cls: "kanban-card-project", text: task.project });
    }

    // Tags
    if (task.tags && task.tags.length > 0) {
      const tagsEl = card.createDiv({ cls: "kanban-card-tags" });
      for (const tag of task.tags.slice(0, 3)) {
        tagsEl.createSpan({ cls: "kanban-card-tag", text: `#${tag}` });
      }
    }

    // Card actions
    const cardActions = card.createDiv({ cls: "kanban-card-actions" });

    if (col.status === TaskStatus.Pending) {
      const startBtn = cardActions.createEl("button", {
        cls: "kanban-action-btn",
        text: "Start",
      });
      startBtn.addEventListener("click", async () => {
        await onTaskUpdate({ ...task, status: TaskStatus.InProgress });
      });
    } else if (col.status === TaskStatus.InProgress) {
      const completeBtn = cardActions.createEl("button", {
        cls: "kanban-action-btn kanban-action-complete",
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
        cls: "kanban-action-btn",
        text: "Reopen",
      });
      reopenBtn.addEventListener("click", async () => {
        await onTaskUpdate({ ...task, status: TaskStatus.Pending, completedDate: undefined });
      });
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