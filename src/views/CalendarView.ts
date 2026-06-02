import { Task, CodeBlockParams, TaskStatus, CalendarViewMode } from "../types";

/**
 * CalendarView - Renders tasks in a calendar with multiple view modes
 */
export class CalendarView {
  private static currentDate = new Date();
  private static viewMode: CalendarViewMode = "month";

  static render(
    container: HTMLElement,
    tasks: Task[],
    params: CodeBlockParams,
    onTaskUpdate: (task: Task) => Promise<void>,
    onTaskCreate: () => void
  ): void {
    container.empty();
    container.addClass("task-calendar-container");

    // Navigation
    const nav = container.createDiv({ cls: "task-calendar-nav" });
    const navLeft = nav.createDiv({ cls: "task-calendar-nav-left" });
    const navRight = nav.createDiv({ cls: "task-calendar-nav-right" });

    // Prev button
    const prevBtn = navLeft.createEl("button", { cls: "task-calendar-nav-btn", text: "‹" });
    prevBtn.onclick = () => { this.navigate(-1); this.rerender(container, tasks, params, onTaskUpdate, onTaskCreate); };

    // Today button
    const todayBtn = navLeft.createEl("button", { cls: "task-calendar-today-btn", text: "Today" });
    todayBtn.onclick = () => { this.currentDate = new Date(); this.rerender(container, tasks, params, onTaskUpdate, onTaskCreate); };

    // Title
    const titleEl = navLeft.createEl("span", { cls: "task-calendar-nav-title" });

    // Next button
    const nextBtn = navLeft.createEl("button", { cls: "task-calendar-nav-btn", text: "›" });
    nextBtn.onclick = () => { this.navigate(1); this.rerender(container, tasks, params, onTaskUpdate, onTaskCreate); };

    // Mode buttons
    const modeGroup = navRight.createDiv({ cls: "task-calendar-mode-group" });
    const allModes: Array<{ key: CalendarViewMode; label: string; short: string }> = [
      { key: "month", label: "Month", short: "M" },
      { key: "week", label: "Week", short: "W" },
      { key: "3day", label: "3 Day", short: "3" },
      { key: "day", label: "Day", short: "D" },
      { key: "agenda", label: "Agenda", short: "A" },
      { key: "list", label: "List", short: "L" },
    ];
    for (const { key, label, short } of allModes) {
      const btn = modeGroup.createEl("button", {
        cls: `task-calendar-mode-btn${this.viewMode === key ? " is-active" : ""}`,
        text: label,
      });
      btn.dataset.short = short;
      btn.onclick = () => { this.viewMode = key; this.rerender(container, tasks, params, onTaskUpdate, onTaskCreate); };
    }

    // Toggle completed button
    const toggleBtn = navRight.createEl("button", {
      cls: `cal-nav-toggle-completed${params.showCompleted ? " is-active" : ""}`,
    });
    toggleBtn.title = params.showCompleted ? "Hide completed tasks" : "Show completed tasks";
    toggleBtn.onclick = () => { this.rerender(container, tasks, params, onTaskUpdate, onTaskCreate); };

    // Update title
    titleEl.textContent = this.getTitle();

    // Body
    const body = container.createDiv({ cls: "task-calendar-body" });

    // Filter tasks
    const filteredTasks = params.showCompleted ? tasks : tasks.filter((t) => t.status !== TaskStatus.Completed);

    switch (this.viewMode) {
      case "month":
        this.renderMonthGrid(body, filteredTasks, onTaskUpdate, onTaskCreate);
        break;
      case "week":
        this.renderWeekGrid(body, filteredTasks, 7, onTaskUpdate, onTaskCreate);
        break;
      case "3day":
        this.renderWeekGrid(body, filteredTasks, 3, onTaskUpdate, onTaskCreate);
        break;
      case "day":
        this.renderDayView(body, filteredTasks, onTaskUpdate, onTaskCreate);
        break;
      case "agenda":
        this.renderAgendaView(body, filteredTasks, onTaskUpdate, onTaskCreate);
        break;
      case "list":
        this.renderListView(body, filteredTasks, onTaskUpdate, onTaskCreate);
        break;
    }
  }

  private static rerender(
    container: HTMLElement,
    tasks: Task[],
    params: CodeBlockParams,
    onTaskUpdate: (task: Task) => Promise<void>,
    onTaskCreate: () => void
  ): void {
    this.render(container, tasks, params, onTaskUpdate, onTaskCreate);
  }

  private static navigate(direction: number): void {
    const d = this.currentDate;
    switch (this.viewMode) {
      case "month":
        d.setMonth(d.getMonth() + direction);
        break;
      case "week":
        d.setDate(d.getDate() + 7 * direction);
        break;
      case "3day":
        d.setDate(d.getDate() + 3 * direction);
        break;
      case "day":
        d.setDate(d.getDate() + direction);
        break;
      case "agenda":
      case "list":
        d.setMonth(d.getMonth() + direction);
        break;
    }
  }

  private static getTitle(): string {
    const d = this.currentDate;
    switch (this.viewMode) {
      case "month":
        return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      case "week":
      case "3day":
      case "day":
        return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      case "agenda":
      case "list":
        return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      default:
        return "";
    }
  }

  private static renderMonthGrid(
    container: HTMLElement,
    tasks: Task[],
    onTaskUpdate: (task: Task) => Promise<void>,
    onTaskCreate: () => void
  ): void {
    const d = this.currentDate;
    const year = d.getFullYear();
    const month = d.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    // Group tasks by date
    const tasksByDate = this.groupTasksByDate(tasks);

    // Weekday headers
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weekdayHeader = container.createDiv({ cls: "task-calendar-weekdays" });
    for (const day of weekdays) {
      weekdayHeader.createEl("div", { cls: "task-calendar-weekday", text: day });
    }

    // Grid
    const grid = container.createDiv({ cls: "task-calendar-grid task-calendar-month" });
    const todayStr = this.toDateString(new Date());
    const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const monthEnd = `${year}-${String(month + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

    // Previous month trailing days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const cell = grid.createDiv({ cls: "task-calendar-day task-calendar-day-other-month" });
      cell.createEl("span", { cls: "task-calendar-day-num", text: String(dayNum) });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const cell = grid.createDiv({
        cls: `task-calendar-day${dateStr === todayStr ? " is-today" : ""}`,
      });

      // Date row with number and add button
      const dateRow = cell.createDiv({ cls: "task-calendar-date-row" });
      dateRow.createEl("span", {
        cls: `task-calendar-day-num${dateStr === todayStr ? " is-today" : ""}`,
        text: String(day),
      });
      const addBtn = dateRow.createEl("button", { cls: "task-calendar-add-btn" });
      addBtn.onclick = () => onTaskCreate();

      // Tasks
      const itemsEl = cell.createDiv({ cls: "task-calendar-items" });
      const dayTasks = tasksByDate.get(dateStr) ?? [];
      for (const task of dayTasks.slice(0, 4)) {
        const chip = itemsEl.createDiv({
          cls: `task-calendar-chip task-calendar-task-chip${task.status === TaskStatus.Completed ? " is-completed" : ""}${task.isGhost ? " is-ghost" : ""}`,
        });
        chip.createSpan({ cls: "task-calendar-chip-title", text: task.title });
        chip.onclick = () => onTaskUpdate({
          ...task,
          status: task.status === TaskStatus.Completed ? TaskStatus.Pending : TaskStatus.Completed,
          completedDate: task.status === TaskStatus.Completed ? undefined : new Date().toISOString().split("T")[0],
        });
      }
      if (dayTasks.length > 4) {
        itemsEl.createDiv({ cls: "task-calendar-more-btn", text: `+${dayTasks.length - 4} more` });
      }
    }

    // Next month leading days
    const totalCells = startOffset + daysInMonth;
    const remainingCells = 7 - (totalCells % 7);
    if (remainingCells < 7) {
      for (let i = 1; i <= remainingCells; i++) {
        const cell = grid.createDiv({ cls: "task-calendar-day task-calendar-day-other-month" });
        cell.createEl("span", { cls: "task-calendar-day-num", text: String(i) });
      }
    }
  }

  private static renderWeekGrid(
    container: HTMLElement,
    tasks: Task[],
    dayCount: number,
    onTaskUpdate: (task: Task) => Promise<void>,
    onTaskCreate: () => void
  ): void {
    const d = this.currentDate;
    const startOfWeek = new Date(d);
    startOfWeek.setDate(d.getDate() - d.getDay());

    const tasksByDate = this.groupTasksByDate(tasks);
    const todayStr = this.toDateString(new Date());

    // Header
    const header = container.createDiv({ cls: "task-calendar-week-header" });
    const labelRow = header.createDiv({ cls: "task-calendar-week-label-row" });
    labelRow.createDiv({ cls: "task-calendar-week-time-gutter" });
    labelRow.createDiv({ cls: "task-calendar-week-allday-label", text: "All Day" });

    for (let i = 0; i < dayCount; i++) {
      const dayDate = new Date(startOfWeek);
      dayDate.setDate(startOfWeek.getDate() + i);
      const dateStr = this.toDateString(dayDate);
      const dayLabel = labelRow.createDiv({
        cls: `task-calendar-week-day-label${dateStr === todayStr ? " is-today" : ""}`,
      });
      dayLabel.createEl("span", {
        cls: `task-calendar-week-day-num${dateStr === todayStr ? " is-today" : ""}`,
        text: String(dayDate.getDate()),
      });
      dayLabel.createEl("span", {
        cls: "task-calendar-week-day-name",
        text: dayDate.toLocaleDateString("en-US", { weekday: "short" }),
      });
    }

    // All-day row
    const alldayRow = header.createDiv({ cls: "task-calendar-week-allday-row" });
    alldayRow.createDiv({ cls: "task-calendar-week-allday-cell" });
    for (let i = 0; i < dayCount; i++) {
      const dayDate = new Date(startOfWeek);
      dayDate.setDate(startOfWeek.getDate() + i);
      const dateStr = this.toDateString(dayDate);
      const cell = alldayRow.createDiv({ cls: "task-calendar-week-allday-cell" });
      const dayTasks = (tasksByDate.get(dateStr) ?? []).filter((t) => t.isAllDay);
      for (const task of dayTasks) {
        const chip = cell.createDiv({
          cls: `task-calendar-chip task-calendar-task-chip${task.status === TaskStatus.Completed ? " is-completed" : ""}`,
        });
        chip.createSpan({ cls: "task-calendar-chip-title", text: task.title });
      }
    }

    // Body
    const body = container.createDiv({ cls: "task-calendar-week-body" });
    const gutter = body.createDiv({ cls: "task-calendar-week-gutter" });
    for (let hour = 0; hour < 24; hour++) {
      const label = gutter.createEl("span", {
        cls: "task-calendar-week-gutter-label",
        text: hour === 0 ? "" : `${hour}:00`,
      });
      label.style.top = `${hour * 60}px`;
    }

    const columns = body.createDiv({ cls: "task-calendar-week-columns" });
    columns.style.setProperty("--day-count", String(dayCount));

    for (let i = 0; i < dayCount; i++) {
      const dayDate = new Date(startOfWeek);
      dayDate.setDate(startOfWeek.getDate() + i);
      const dateStr = this.toDateString(dayDate);
      const col = columns.createDiv({
        cls: `task-calendar-week-column${dateStr === todayStr ? " is-today" : ""}`,
      });

      // Hour lines
      for (let hour = 0; hour < 24; hour++) {
        const hourLine = col.createDiv({ cls: "task-calendar-week-hour-line" });
        hourLine.style.top = `${hour * 60}px`;
      }

      // Timed tasks
      const dayTasks = (tasksByDate.get(dateStr) ?? []).filter((t) => !t.isAllDay && t.dueDate);
      for (const task of dayTasks) {
        const timePart = task.dueDate?.includes(" ") ? task.dueDate.split(" ")[1] : null;
        if (timePart) {
          const [hours, minutes] = timePart.split(":").map(Number);
          const top = hours * 60 + minutes;
          const item = col.createDiv({
            cls: `task-calendar-time-item${task.status === TaskStatus.Completed ? " is-completed" : ""}${task.isGhost ? " is-ghost" : ""}`,
          });
          item.style.top = `${top}px`;
          item.style.height = "30px";
          item.createSpan({ cls: "task-calendar-time-item-title", text: task.title });
        }
      }
    }
  }

  private static renderDayView(
    container: HTMLElement,
    tasks: Task[],
    onTaskUpdate: (task: Task) => Promise<void>,
    onTaskCreate: () => void
  ): void {
    const d = this.currentDate;
    const dateStr = this.toDateString(d);
    const tasksByDate = this.groupTasksByDate(tasks);
    const dayTasks = tasksByDate.get(dateStr) ?? [];

    // All-day items
    const alldayItems = dayTasks.filter((t) => t.isAllDay);
    if (alldayItems.length > 0) {
      const alldayEl = container.createDiv({ cls: "task-calendar-day-view-allday" });
      alldayEl.createEl("span", { cls: "task-calendar-day-view-allday-label", text: "All Day" });
      const itemsWrap = alldayEl.createDiv({ cls: "task-calendar-day-view-allday-items" });
      for (const task of alldayItems) {
        const chip = itemsWrap.createDiv({
          cls: `task-calendar-chip task-calendar-task-chip${task.status === TaskStatus.Completed ? " is-completed" : ""}`,
        });
        chip.createSpan({ cls: "task-calendar-chip-title", text: task.title });
      }
    }

    // Timeline
    const timeline = container.createDiv({ cls: "task-calendar-day-view" });
    const timelineEl = timeline.createDiv({ cls: "task-calendar-timeline" });

    for (let hour = 0; hour < 24; hour++) {
      const hourLine = timelineEl.createDiv({ cls: "task-calendar-hour-line" });
      hourLine.style.top = `${hour * 60}px`;
      const label = timelineEl.createEl("span", {
        cls: "task-calendar-hour-label",
        text: hour === 0 ? "" : `${hour}:00`,
      });
      label.style.top = `${hour * 60}px`;
    }

    // Timed tasks
    const timedTasks = dayTasks.filter((t) => !t.isAllDay && t.dueDate?.includes(" "));
    for (const task of timedTasks) {
      const timePart = task.dueDate!.split(" ")[1];
      const [hours, minutes] = timePart.split(":").map(Number);
      const top = hours * 60 + minutes;
      const item = timelineEl.createDiv({
        cls: `task-calendar-time-item${task.status === TaskStatus.Completed ? " is-completed" : ""}`,
      });
      item.style.top = `${top}px`;
      item.style.height = "30px";
      item.createSpan({ cls: "task-calendar-time-item-title", text: task.title });
    }
  }

  private static renderAgendaView(
    container: HTMLElement,
    tasks: Task[],
    onTaskUpdate: (task: Task) => Promise<void>,
    onTaskCreate: () => void
  ): void {
    const d = this.currentDate;
    const year = d.getFullYear();
    const month = d.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const tasksByDate = this.groupTasksByDate(tasks);
    const agenda = container.createDiv({ cls: "task-calendar-agenda" });

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayTasks = tasksByDate.get(dateStr) ?? [];
      if (dayTasks.length === 0) continue;

      const date = new Date(dateStr + "T00:00:00");
      const todayStr = this.toDateString(new Date());

      const header = agenda.createDiv({
        cls: `task-calendar-agenda-header${dateStr === todayStr ? " is-today" : ""}`,
      });
      header.createEl("span", {
        cls: "task-calendar-agenda-date",
        text: date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
      });

      for (const task of dayTasks) {
        const row = agenda.createDiv({
          cls: `task-calendar-agenda-row${task.isGhost ? " is-ghost" : ""}`,
        });
        row.createEl("span", {
          cls: `task-calendar-agenda-dot task-dot${task.status === TaskStatus.Completed ? " is-completed" : ""}`,
        });
        row.createEl("span", {
          cls: `task-calendar-agenda-title${task.status === TaskStatus.Completed ? " is-completed" : ""}`,
          text: task.title,
        });
        if (task.dueDate?.includes(" ")) {
          row.createEl("span", {
            cls: "task-calendar-agenda-time",
            text: task.dueDate.split(" ")[1],
          });
        }
      }
    }
  }

  private static renderListView(
    container: HTMLElement,
    tasks: Task[],
    onTaskUpdate: (task: Task) => Promise<void>,
    onTaskCreate: () => void
  ): void {
    const d = this.currentDate;
    const year = d.getFullYear();
    const month = d.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const monthEnd = `${year}-${String(month + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

    const tasksByDate = this.groupTasksByDate(tasks);
    const list = container.createDiv({ cls: "task-calendar-list" });

    // Overdue tasks
    const overdueTasks = tasks.filter((t) => t.dueDate && t.dueDate.split(" ")[0] < monthStart && t.status !== TaskStatus.Completed);
    if (overdueTasks.length > 0) {
      const card = list.createDiv({ cls: "tcl-card tcl-card-overdue" });
      const header = card.createDiv({ cls: "tcl-card-header" });
      header.createEl("span", { cls: "tcl-card-title", text: "Overdue" });
      header.createEl("span", { cls: "tcl-card-count", text: String(overdueTasks.length) });
      const body = card.createDiv({ cls: "tcl-card-body" });
      for (const task of overdueTasks) {
        this.renderListTaskRow(body, task, onTaskUpdate);
      }
    }

    // Tasks by date
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayTasks = tasksByDate.get(dateStr) ?? [];
      if (dayTasks.length === 0) continue;

      const date = new Date(dateStr + "T00:00:00");
      const card = list.createDiv({ cls: "tcl-card" });
      const header = card.createDiv({ cls: "tcl-card-header" });
      header.createEl("span", { cls: "tcl-card-title", text: date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) });
      header.createEl("span", { cls: "tcl-card-count", text: String(dayTasks.length) });

      const body = card.createDiv({ cls: "tcl-card-body" });
      for (const task of dayTasks) {
        this.renderListTaskRow(body, task, onTaskUpdate);
      }
    }
  }

  private static renderListTaskRow(
    container: HTMLElement,
    task: Task,
    onTaskUpdate: (task: Task) => Promise<void>
  ): void {
    const row = container.createDiv({ cls: "tcl-task-row" });
    const checkbox = row.createEl("input", {
      type: "checkbox",
      cls: "tcl-task-check",
    });
    checkbox.checked = task.status === TaskStatus.Completed;
    checkbox.onchange = async () => {
      await onTaskUpdate({
        ...task,
        status: checkbox.checked ? TaskStatus.Completed : TaskStatus.Pending,
        completedDate: checkbox.checked ? new Date().toISOString().split("T")[0] : undefined,
      });
    };

    row.createEl("span", {
      cls: `tcl-task-title${task.status === TaskStatus.Completed ? " is-done" : ""}`,
      text: task.title,
    });

    if (task.dueDate?.includes(" ")) {
      row.createEl("span", { cls: "tcl-task-time", text: task.dueDate.split(" ")[1] });
    }
  }

  private static groupTasksByDate(tasks: Task[]): Map<string, Task[]> {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      if (task.dueDate) {
        const dateStr = task.dueDate.split(" ")[0];
        if (!map.has(dateStr)) map.set(dateStr, []);
        map.get(dateStr)!.push(task);
      }
    }
    return map;
  }

  private static toDateString(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
}