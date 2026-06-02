import { Task, CodeBlockParams, TaskStatus, TaskPriority, TableGroup } from "../types";
import { TaskManager } from "../tasks/TaskManager";

/**
 * TableView - Renders tasks in a sortable, filterable table with grouping
 */
export class TableView {
  static render(
    container: HTMLElement,
    tasks: Task[],
    params: CodeBlockParams,
    onTaskUpdate: (task: Task) => Promise<void>,
    onTaskCreate: () => void
  ): void {
    container.empty();
    container.addClass("task-table-view");

    // Toolbar
    const toolbar = container.createDiv({ cls: "task-table-toolbar" });
    this.renderToolbar(toolbar, params, tasks);

    // Group tasks
    const groups = this.groupTasks(tasks, params.groupBy);

    if (tasks.length === 0) {
      const empty = container.createDiv({ cls: "task-table-empty" });
      empty.textContent = "No tasks found. Create one with the button above.";
      return;
    }

    // Render each group
    for (const group of groups) {
      this.renderGroup(container, group, onTaskUpdate);
    }
  }

  private static renderToolbar(
    toolbar: HTMLElement,
    params: CodeBlockParams,
    tasks: Task[]
  ): void {
    // Group by dropdown
    const groupByWrap = toolbar.createDiv({ cls: "task-table-toolbar-group" });
    groupByWrap.createEl("label", { text: "Group by:", cls: "task-table-toolbar-label" });
    const groupBySelect = groupByWrap.createEl("select", { cls: "task-table-group-select" });
    const groupOptions = [
      { value: "", label: "None" },
      { value: "status", label: "Status" },
      { value: "priority", label: "Priority" },
      { value: "project", label: "Project" },
      { value: "tags", label: "Tags" },
    ];
    for (const opt of groupOptions) {
      const option = groupBySelect.createEl("option", { value: opt.value, text: opt.label });
      if (opt.value === params.groupBy) option.selected = true;
    }

    // Sort dropdown
    const sortWrap = toolbar.createDiv({ cls: "task-table-toolbar-sort" });
    sortWrap.createEl("label", { text: "Sort by:", cls: "task-table-toolbar-label" });
    const sortSelect = sortWrap.createEl("select", { cls: "task-table-select" });
    const sortOptions = [
      { value: "", label: "Default" },
      { value: "dueDate", label: "Due Date" },
      { value: "startDate", label: "Start Date" },
      { value: "priority", label: "Priority" },
      { value: "title", label: "Title" },
      { value: "project", label: "Project" },
      { value: "status", label: "Status" },
    ];
    for (const opt of sortOptions) {
      const option = sortSelect.createEl("option", { value: opt.value, text: opt.label });
      if (opt.value === params.sortBy) option.selected = true;
    }

    // Sort order toggle
    const sortOrderBtn = sortWrap.createEl("button", {
      cls: "task-table-sort-order",
      text: params.sortOrder === "desc" ? "↓" : "↑",
    });
    sortOrderBtn.title = params.sortOrder === "desc" ? "Descending" : "Ascending";

    // Filter input
    const filterWrap = toolbar.createDiv({ cls: "task-table-toolbar-filter" });
    const filterInput = filterWrap.createEl("input", {
      type: "text",
      cls: "task-table-filter-input",
      placeholder: "Filter tasks...",
      value: params.filter ?? "",
    });
  }

  private static groupTasks(tasks: Task[], groupBy?: string): TableGroup[] {
    if (!groupBy) {
      return [{ groupKey: "all", groupName: "All Tasks", tasks }];
    }

    const grouped = TaskManager.groupTasksBy(tasks, groupBy);
    const result: TableGroup[] = [];

    for (const [key, groupTasks] of grouped) {
      result.push({
        groupKey: key,
        groupName: key,
        tasks: groupTasks,
      });
    }

    return result;
  }

  private static renderGroup(
    container: HTMLElement,
    group: TableGroup,
    onTaskUpdate: (task: Task) => Promise<void>
  ): void {
    // Group header
    const header = container.createDiv({ cls: "task-table-group-header" });
    header.createSpan({ cls: "task-table-group-title", text: group.groupName });
    header.createSpan({ cls: "task-table-group-count", text: String(group.tasks.length) });

    // Progress bar
    const completed = group.tasks.filter((t) => t.status === TaskStatus.Completed).length;
    const total = group.tasks.length;
    const progressWrap = header.createDiv({ cls: "task-table-group-progress" });
    const progressWrapInner = progressWrap.createDiv({ cls: "task-table-progress-wrap" });
    const progressFill = progressWrapInner.createDiv({ cls: "task-table-progress-fill" });
    progressFill.style.width = total > 0 ? `${(completed / total) * 100}%` : "0%";
    const progressCount = progressWrap.createSpan({ cls: "task-table-progress-count" });
    progressCount.textContent = `${completed}/${total}`;

    // Table
    const table = container.createDiv({ cls: "task-table-wrapper" });
    const tableEl = table.createEl("table", { cls: "task-table" });

    // Header
    const thead = tableEl.createEl("thead");
    const headerRow = thead.createEl("tr");
    const columns = [
      { id: "checkbox", title: "", width: "32px" },
      { id: "title", title: "Task" },
      { id: "dueDate", title: "Due", width: "90px" },
      { id: "priority", title: "Priority", width: "60px" },
      { id: "tags", title: "Tags" },
      { id: "project", title: "Project", width: "100px" },
      { id: "actions", title: "", width: "32px" },
    ];

    for (const col of columns) {
      const th = headerRow.createEl("th", {
        cls: `task-table-header task-table-header-${col.id}`,
        text: col.title,
      });
      if (col.width) th.style.width = col.width;
    }

    // Body
    const tbody = tableEl.createEl("tbody");

    for (const task of group.tasks) {
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

      // Title with priority dot
      const titleCell = row.createEl("td", { cls: "task-table-cell task-table-cell-title" });
      const titleRow = titleCell.createDiv({ cls: "task-table-title-row" });
      const dot = titleRow.createSpan({
        cls: `task-table-priority-dot task-table-priority-dot-${this.getPriorityClass(task.priority)}`,
      });
      const titleSpan = titleRow.createSpan({ cls: "task-table-title-text", text: task.title });
      if (task.isGhost) {
        titleSpan.addClass("task-table-ghost");
      }

      // Due date
      const dueDateCell = row.createEl("td", { cls: "task-table-cell task-table-cell-dueDate" });
      if (task.dueDate) {
        const dateStr = task.dueDate.split(" ")[0];
        const timeStr = task.dueDate.includes(" ") ? task.dueDate.split(" ")[1] : null;
        dueDateCell.textContent = this.formatDate(dateStr);
        if (timeStr) {
          dueDateCell.createSpan({ cls: "task-table-due-time", text: timeStr });
        }
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

      // Project
      const projectCell = row.createEl("td", { cls: "task-table-cell task-table-cell-project" });
      if (task.project) {
        const pill = projectCell.createSpan({ cls: "task-table-group-pill" });
        pill.textContent = task.project;
      }

      // Actions
      const actionsCell = row.createEl("td", { cls: "task-table-cell task-table-cell-actions" });
      const deleteBtn = actionsCell.createEl("button", {
        cls: "task-table-action-btn",
        text: "×",
      });
      deleteBtn.title = "Cancel task";
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