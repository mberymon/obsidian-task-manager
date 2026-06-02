import { Task, CodeBlockParams, TaskStatus } from "../types";

/**
 * CalendarView - Renders tasks in a calendar grid
 */
export class CalendarView {
  static render(
    container: HTMLElement,
    tasks: Task[],
    params: CodeBlockParams,
    onTaskUpdate: (task: Task) => Promise<void>
  ): void {
    const calendar = container.createEl("div", { cls: "task-calendar" });

    // Determine date range to display
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    // Header with month/year and navigation
    const header = calendar.createEl("div", { cls: "task-calendar-header" });
    const prevBtn = header.createEl("button", { cls: "task-calendar-nav-btn", text: "←" });
    const titleEl = header.createEl("span", {
      cls: "task-calendar-title",
      text: today.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    });
    const nextBtn = header.createEl("button", { cls: "task-calendar-nav-btn", text: "→" });

    // Weekday headers
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weekdayHeader = calendar.createEl("div", { cls: "task-calendar-weekdays" });
    for (const day of weekdays) {
      weekdayHeader.createEl("div", { cls: "task-calendar-weekday", text: day });
    }

    // Calendar grid
    const grid = calendar.createEl("div", { cls: "task-calendar-grid" });

    // Calculate days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    // Previous month's trailing days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const cell = grid.createEl("div", { cls: "task-calendar-cell task-calendar-cell-other-month" });
      cell.createEl("span", { cls: "task-calendar-cell-day", text: String(dayNum) });
    }

    // Current month's days
    const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const monthEnd = `${year}-${String(month + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

    // Group tasks by due date
    const tasksByDate = new Map<string, Task[]>();
    for (const task of tasks) {
      if (task.dueDate) {
        const dateStr = task.dueDate.split(" ")[0];
        if (dateStr >= monthStart && dateStr <= monthEnd) {
          if (!tasksByDate.has(dateStr)) {
            tasksByDate.set(dateStr, []);
          }
          tasksByDate.get(dateStr)!.push(task);
        }
      }
    }

    const todayStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const cell = grid.createEl("div", {
        cls: `task-calendar-cell${dateStr === todayStr ? " task-calendar-cell-today" : ""}`,
      });

      // Day number
      const dayNum = cell.createEl("span", { cls: "task-calendar-cell-day", text: String(day) });
      if (dateStr === todayStr) {
        dayNum.addClass("task-calendar-cell-day-today");
      }

      // Tasks for this day
      const dayTasks = tasksByDate.get(dateStr) ?? [];
      for (const task of dayTasks) {
        const taskEl = cell.createEl("div", {
          cls: `task-calendar-task task-calendar-task-${this.getStatusClass(task.status)}`,
        });
        taskEl.textContent = task.title;
        taskEl.title = task.title;

        taskEl.addEventListener("click", async () => {
          // Toggle task status on click
          const newStatus =
            task.status === TaskStatus.Pending
              ? TaskStatus.InProgress
              : task.status === TaskStatus.InProgress
              ? TaskStatus.Completed
              : TaskStatus.Pending;

          await onTaskUpdate({
            ...task,
            status: newStatus,
            completedDate:
              newStatus === TaskStatus.Completed
                ? new Date().toISOString().split("T")[0]
                : undefined,
          });
        });
      }
    }

    // Next month's leading days
    const totalCells = startOffset + daysInMonth;
    const remainingCells = 7 - (totalCells % 7);
    if (remainingCells < 7) {
      for (let i = 1; i <= remainingCells; i++) {
        const cell = grid.createEl("div", { cls: "task-calendar-cell task-calendar-cell-other-month" });
        cell.createEl("span", { cls: "task-calendar-cell-day", text: String(i) });
      }
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
}