import { App, Modal, Notice, setIcon } from "obsidian";
import { TaskFormData, TaskStatus, TaskPriority, RepeatConfig, RepeatFreq } from "../types";
//import { RRuleParser } from "../tasks/RRuleParser";

// Day constants for repeat panel
const RFC_DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
//const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
//const ORDINAL_LABELS = ["1st", "2nd", "3rd", "4th", "Last"];
//const ORDINAL_VALUES = [1, 2, 3, 4, -1];

/**
 * CreateTaskModal - Modal for creating and editing tasks
 */
export class CreateTaskModal extends Modal {
  private data: TaskFormData;
  private onSubmit: (data: TaskFormData) => Promise<void>;
  private groupNames: string[];
  private startDateInputEl: HTMLInputElement | null = null;
  private dueDateInputEl: HTMLInputElement | null = null;
  private enableDateRange = false;

  constructor(
    app: App,
    initialData: Partial<TaskFormData>,
    onSubmit: (data: TaskFormData) => Promise<void>,
    options: { groupNames?: string[]; heading?: string; buttonText?: string } = {}
  ) {
    super(app);
    this.onSubmit = onSubmit;
    this.groupNames = options.groupNames ?? [];

    this.data = {
      title: initialData.title ?? "",
      description: initialData.description ?? "",
      status: initialData.status ?? TaskStatus.Pending,
      priority: initialData.priority ?? TaskPriority.None,
      tags: initialData.tags ? [...initialData.tags] : [],
      dueDate: initialData.dueDate ?? "",
      dueTime: initialData.dueTime ?? "",
      startDate: initialData.startDate ?? "",
      startTime: initialData.startTime ?? "",
      duration: initialData.duration ?? 30,
      isAllDay: initialData.isAllDay !== undefined ? initialData.isAllDay : true,
      repeat: initialData.repeat,
      group: initialData.group ?? "",
      type: initialData.type ?? "task",
      content: initialData.content ?? "",
      enableDateRange: initialData.enableDateRange ?? false,
    };

    this.enableDateRange = initialData.enableDateRange ?? false;
  }

  async onOpen(): Promise<void> {
    const { contentEl, modalEl } = this;
    contentEl.empty();

    modalEl.addClass("kanban-board-modal-host");
    contentEl.addClass("task-edit-modal");

    // Header
    const header = modalEl.createDiv({ cls: "kanban-modal-header" });
    modalEl.insertBefore(header, contentEl);
    header.createEl("h2", { cls: "kanban-modal-title", text: "New Task" });

    // Form
    const form = contentEl.createDiv({ cls: "tm-form" });
    this.buildForm(form);

    // Footer
    const footer = modalEl.createDiv({ cls: "kanban-modal-footer" });
    footer.createEl("button", { cls: "km-btn", text: "Cancel" }).onclick = () => this.close();

    const submitBtn = footer.createEl("button", { cls: "km-btn km-btn-cta", text: "Create Task" });
    submitBtn.onclick = async () => {
      if (!this.data.title.trim()) {
        new Notice("Task title cannot be empty");
        return;
      }

      submitBtn.textContent = "Creating…";
      submitBtn.setAttribute("disabled", "true");

      try {
        await this.onSubmit(this.data);
        this.close();
      } catch {
        new Notice("Failed to create task");
        submitBtn.textContent = "Create Task";
        submitBtn.removeAttribute("disabled");
      }
    };

    // Keyboard shortcut
    this.modalEl.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        submitBtn.click();
      }
    });
  }

  onClose(): void {
    this.contentEl.empty();
    this.modalEl.removeClass("kanban-board-modal-host");
  }

  private buildForm(form: HTMLElement): void {
    // Title
    const titleWrap = form.createDiv({ cls: "tm-hero-title-wrap" });
    const titleInput = titleWrap.createEl("input", { cls: "tm-hero-title", type: "text" });
    titleInput.placeholder = "What needs to be done?";
    titleInput.value = this.data.title;
    titleInput.addEventListener("input", () => {
      this.data.title = titleInput.value;
    });

    // Dates section
    this.section(form, "Dates", (s) => {
      const grid = s.createDiv({ cls: "tm-dates-grid" });

      // Start date
      this.dateField(
        grid,
        "Start",
        this.data.startDate,
        this.data.startTime,
        (d) => { this.data.startDate = d; },
        (t) => { this.data.startTime = t; }
      );

      // Due date
      this.dateField(
        grid,
        "Due",
        this.data.dueDate,
        this.data.dueTime,
        (d) => { this.data.dueDate = d; },
        (t) => { this.data.dueTime = t; }
      );

      // All day toggle
      const allDayWrap = s.createDiv({ cls: "tm-allday-wrap" });
      const label = allDayWrap.createEl("label", { cls: "tm-allday-label" });
      const cb = label.createEl("input", { type: "checkbox", cls: "tm-allday-checkbox" });
      cb.checked = this.data.isAllDay ?? true;
      label.createSpan({ text: "All Day" });

      cb.addEventListener("change", () => {
        this.data.isAllDay = cb.checked;
      });
    });

    // Priority section
    this.section(form, "Priority", (s) => {
      this.priorityPills(s, this.data.priority, (v) => {
        this.data.priority = v;
      });
    });

    // Tags section
    this.section(form, "Tags", (s) => {
      const input = s.createEl("input", { cls: "km-input", type: "text" });
      input.placeholder = "work, urgent, review…";
      input.value = this.data.tags.join(", ");
      input.addEventListener("input", () => {
        this.data.tags = input.value.split(",").map((t) => t.trim()).filter(Boolean);
      });
    });

    // Group section
    this.section(form, "Group", (s) => {
      const wrap = s.createDiv({ cls: "tm-autocomplete-wrap" });
      wrap.style.position = "relative";
      const input = wrap.createEl("input", { cls: "km-input", type: "text" });
      input.placeholder = "Inbox";
      input.value = this.data.group ?? "";
      input.addEventListener("input", () => {
        this.data.group = input.value.trim();
      });

      // Simple dropdown
      const dropdown = wrap.createDiv({ cls: "tm-autocomplete-dropdown" });
      dropdown.style.display = "none";

      input.addEventListener("focus", () => {
        dropdown.empty();
        const filtered = this.groupNames.filter((g) =>
          g.toLowerCase().includes(input.value.toLowerCase())
        );
        if (filtered.length === 0) {
          dropdown.style.display = "none";
          return;
        }
        for (const item of filtered) {
          const option = dropdown.createDiv({ cls: "tm-autocomplete-item" });
          option.textContent = item;
          option.addEventListener("mousedown", () => {
            input.value = item;
            this.data.group = item;
            dropdown.style.display = "none";
          });
        }
        dropdown.style.display = "flex";
      });

      input.addEventListener("blur", () => {
        setTimeout(() => { dropdown.style.display = "none"; }, 200);
      });
    });

    // Duration section
    this.section(form, "Duration (minutes)", (s) => {
      const input = s.createEl("input", { cls: "km-input", type: "number" });
      input.min = "1";
      input.placeholder = "30";
      input.value = String(this.data.duration ?? 30);
      input.oninput = () => {
        const val = parseInt(input.value);
        if (!isNaN(val) && val > 0) {
          this.data.duration = val;
        }
      };
    });

    // Repeat section
    const repeatWrap = form.createDiv({ cls: "tm-repeat-wrap" });
    this.renderRepeatPanel(repeatWrap);

    // Description section
    this.section(form, "Description", (s) => {
      const ta = s.createEl("textarea", { cls: "tm-textarea" });
      ta.placeholder = "Add details, notes, or context…";
      ta.value = this.data.content ?? "";
      ta.rows = 3;
      ta.oninput = () => {
        this.data.content = ta.value;
      };
    });
  }

  private section(parent: HTMLElement, title: string, builder: (section: HTMLElement) => void): void {
    const section = parent.createDiv({ cls: "tm-form-section" });
    section.createEl("h3", { cls: "tm-form-section-title", text: title });
    builder(section);
  }

  private dateField(
    container: HTMLElement,
    label: string,
    dateValue: string | undefined,
    timeValue: string | undefined,
    onDateChange: (date: string) => void,
    onTimeChange: (time: string) => void
  ): void {
    const field = container.createDiv({ cls: "tm-date-field" });
    field.createEl("label", { cls: "tm-date-field-label", text: label });

    const dateInput = field.createEl("input", {
      cls: "tm-date-input",
      type: "date",
    });
    dateInput.value = dateValue ?? "";
    dateInput.addEventListener("change", () => {
      onDateChange(dateInput.value);
    });

    if (label === "Start") {
      this.startDateInputEl = dateInput;
    } else {
      this.dueDateInputEl = dateInput;
    }

    const timeInput = field.createEl("input", {
      cls: "tm-time-input",
      type: "time",
    });
    timeInput.value = timeValue ?? "";
    timeInput.style.display = this.data.isAllDay ? "none" : "";
    timeInput.addEventListener("change", () => {
      onTimeChange(timeInput.value);
    });
  }

  private priorityPills(
    container: HTMLElement,
    current: TaskPriority,
    onChange: (priority: TaskPriority) => void
  ): void {
    const wrap = container.createDiv({ cls: "tm-priority-pills" });
    const priorities = [
      { value: TaskPriority.Low, label: "Low", icon: "🔽" },
      { value: TaskPriority.None, label: "None", icon: "—" },
      { value: TaskPriority.Medium, label: "Medium", icon: "➡️" },
      { value: TaskPriority.High, label: "High", icon: "🔼" },
      { value: TaskPriority.Urgent, label: "Urgent", icon: "⏫" },
    ];

    for (const p of priorities) {
      const pill = wrap.createEl("button", {
        cls: `tm-priority-pill${current === p.value ? " is-active" : ""}`,
        text: `${p.icon} ${p.label}`,
      });
      pill.addEventListener("click", () => {
        wrap.querySelectorAll(".tm-priority-pill").forEach((el) => el.removeClass("is-active"));
        pill.addClass("is-active");
        onChange(p.value);
      });
    }
  }

  private renderRepeatPanel(container: HTMLElement): void {
    container.empty();

    if (!this.data.repeat) {
      const addBtn = container.createEl("button", { cls: "tm-add-btn" });
      setIcon(addBtn.createSpan({ cls: "tm-add-btn-icon" }), "repeat");
      addBtn.createSpan({ text: "Add recurrence" });
      addBtn.onclick = () => {
        this.data.repeat = { freq: "WEEKLY" as RepeatFreq, interval: 1 };
        this.renderRepeatPanel(container);
      };
      return;
    }

    const panel = container.createDiv({ cls: "tm-repeat-panel" });

    // Frequency selector
    const row1 = panel.createDiv({ cls: "tm-repeat-row" });
    row1.createEl("span", { cls: "tm-repeat-row-label", text: "Repeat" });

    const freqSel = row1.createEl("select", { cls: "km-select" });
    const freqs: Array<[RepeatFreq, string]> = [
      ["DAILY", "Daily"],
      ["WEEKLY", "Weekly"],
      ["MONTHLY", "Monthly"],
      ["YEARLY", "Yearly"],
    ];
    for (const [v, l] of freqs) {
      const o = freqSel.createEl("option", { value: v, text: l });
      if (v === this.data.repeat?.freq) o.selected = true;
    }
    freqSel.onchange = () => {
      if (this.data.repeat) {
        this.data.repeat = { freq: freqSel.value as RepeatFreq, interval: this.data.repeat.interval };
      }
      this.renderRepeatPanel(container);
    };

    row1.createEl("span", { text: "every", cls: "tm-repeat-row-label" });

    const intervalInput = row1.createEl("input", {
      cls: "km-input tm-interval-input",
      type: "number",
    });
    intervalInput.min = "1";
    intervalInput.value = String(this.data.repeat?.interval ?? 1);
    intervalInput.oninput = () => {
      const n = parseInt(intervalInput.value);
      if (this.data.repeat && n > 0) this.data.repeat.interval = n;
    };

    const unitLabels: Record<RepeatFreq, string> = {
      DAILY: "day(s)",
      WEEKLY: "week(s)",
      MONTHLY: "month(s)",
      YEARLY: "year(s)",
    };
    row1.createEl("span", {
      text: unitLabels[this.data.repeat.freq],
      cls: "tm-repeat-row-label",
    });

    // Weekly day selection
    if (this.data.repeat.freq === "WEEKLY") {
      const dayRow = panel.createDiv({ cls: "tm-day-row" });
      const currentDays = new Set(this.data.repeat.byday ?? []);

      for (let i = 0; i < RFC_DAYS.length; i++) {
        const code = RFC_DAYS[i];
        const lbl = dayRow.createEl("label", {
          cls: "tm-day-pill" + (currentDays.has(code) ? " is-on" : ""),
        });
        const chk = lbl.createEl("input", { type: "checkbox" });
        chk.checked = currentDays.has(code);
        lbl.createSpan({ text: DAY_LABELS[i].slice(0, 2) });

        chk.onchange = () => {
          if (!this.data.repeat) return;
          if (chk.checked) {
            currentDays.add(code);
            lbl.addClass("is-on");
          } else {
            currentDays.delete(code);
            lbl.removeClass("is-on");
          }
          this.data.repeat!.byday = RFC_DAYS.filter((d) => currentDays.has(d));
        };
      }
    }

    // Monthly options
    if (this.data.repeat.freq === "MONTHLY") {
      const mRow = panel.createDiv({ cls: "tm-repeat-row" });
      mRow.createEl("span", { text: "On", cls: "tm-repeat-row-label" });

      const modeSel = mRow.createEl("select", { cls: "km-select" });
      const modes = [
        ["default", "Same day"],
        ["bymonthday", "Day number"],
        ["bynthweekday", "Nth weekday"],
      ];
      for (const [v, l] of modes) {
        const o = modeSel.createEl("option", { value: v, text: l });
        if (v === this.detectMonthlyMode(this.data.repeat)) o.selected = true;
      }

      modeSel.onchange = () => {
        if (!this.data.repeat) return;
        delete this.data.repeat.bymonthday;
        delete this.data.repeat.bysetpos;
        delete this.data.repeat.byday;
        if (modeSel.value === "bymonthday") this.data.repeat.bymonthday = [1];
        if (modeSel.value === "bynthweekday") {
          this.data.repeat.bysetpos = [1];
          this.data.repeat.byday = ["MO"];
        }
        this.renderRepeatPanel(container);
      };
    }

    // End condition
    const endCond = this.detectEndCondition(this.data.repeat);
    const endRow = panel.createDiv({ cls: "tm-repeat-row" });
    endRow.createEl("span", { text: "Ends", cls: "tm-repeat-row-label" });

    const endSel = endRow.createEl("select", { cls: "km-select" });
    const endOptions = [
      ["never", "Never"],
      ["until", "On date"],
      ["count", "After N times"],
    ];
    for (const [v, l] of endOptions) {
      const o = endSel.createEl("option", { value: v, text: l });
      if (v === endCond) o.selected = true;
    }

    endSel.onchange = () => {
      if (!this.data.repeat) return;
      delete this.data.repeat.until;
      delete this.data.repeat.count;
      if (endSel.value === "count") this.data.repeat.count = 10;
      this.renderRepeatPanel(container);
    };

    // Remove button
    const removeRow = panel.createDiv({ cls: "tm-repeat-row" });
    const removeBtn = removeRow.createEl("button", {
      cls: "tm-remove-btn",
      text: "Remove recurrence",
    });
    removeBtn.onclick = () => {
      this.data.repeat = undefined;
      this.renderRepeatPanel(container);
    };
  }

  private detectMonthlyMode(r: RepeatConfig | undefined): string {
    if (!r) return "default";
    if (r.bysetpos?.length && r.byday?.length) return "bynthweekday";
    if (r.bymonthday?.length) return "bymonthday";
    return "default";
  }

  private detectEndCondition(r: RepeatConfig | undefined): string {
    if (!r) return "never";
    if (r.until) return "until";
    if (r.count != null) return "count";
    return "never";
  }
}