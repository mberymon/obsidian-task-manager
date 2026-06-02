import { App, Modal, Notice, setIcon, Platform } from "obsidian";
import { TaskFormData, TaskStatus, TaskPriority, RepeatConfig, RepeatFreq } from "../types";
import { RRuleParser } from "../tasks/RRuleParser";

// Day constants for repeat panel
const RFC_DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORDINAL_LABELS = ["1st", "2nd", "3rd", "4th", "Last"];
const ORDINAL_VALUES = [1, 2, 3, 4, -1];

// SVG icons for date shortcuts
const SUN_ICON_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path></svg>`;
const SUNRISE_ICON_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 22H6M12 18V2M9 5l3-3 3 3M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z"></path></svg>`;
const CALENDAR_7_ICON_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><text x="12" y="18" font-size="8" font-family="system-ui, -apple-system, sans-serif" font-weight="bold" text-anchor="middle" fill="currentColor" stroke="none">+7</text></svg>`;
const MOON_ICON_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>`;

/**
 * Make an input field clearable with an X button
 */
function makeInputClearable(
  inputEl: HTMLInputElement,
  wrapperEl: HTMLElement,
  onClear: () => void,
  onInput?: (val: string) => void
): void {
  wrapperEl.addClass("tm-input-wrapper");
  inputEl.addClass("tm-clearable-input");
  const clearBtn = wrapperEl.createSpan({ cls: "tm-input-clear-btn" });
  setIcon(clearBtn, "x");

  const updateClearBtn = () => {
    clearBtn.style.display = inputEl.value ? "flex" : "none";
  };

  inputEl.addEventListener("input", () => {
    updateClearBtn();
    if (onInput) onInput(inputEl.value);
  });

  inputEl.addEventListener("change", () => {
    updateClearBtn();
  });

  clearBtn.onclick = (e) => {
    e.stopPropagation();
    inputEl.value = "";
    updateClearBtn();
    onClear();
    inputEl.focus();
  };

  updateClearBtn();
}

/**
 * Detect the monthly repeat mode
 */
function detectMonthlyMode(r: RepeatConfig | undefined): string {
  if (!r) return "default";
  if (r.bysetpos?.length && r.byday?.length) return "bynthweekday";
  if (r.bymonthday?.length) return "bymonthday";
  return "default";
}

/**
 * Detect the end condition for a repeat config
 */
function detectEndCondition(r: RepeatConfig | undefined): string {
  if (!r) return "never";
  if (r.until) return "until";
  if (r.count != null) return "count";
  return "never";
}

/**
 * Format a Date to YYYY-MM-DD
 */
function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * CreateTaskModal - Modal for creating and editing tasks
 * Restored original UI with date shortcuts, clearable inputs, autocomplete dropdowns
 */
export class CreateTaskModal extends Modal {
  private data: TaskFormData;
  private onSubmit: (data: TaskFormData) => Promise<void>;
  private options: {
    groupNames?: string[];
    tagNames?: string[];
    typeNames?: string[];
    heading?: string;
    buttonText?: string;
    folderContext?: string;
    initialDueDate?: string;
    initialDueTime?: string;
    initialStartDate?: string;
    initialStartTime?: string;
    initialTags?: string[];
    initialDuration?: number;
    defaultDurationMinutes?: number;
    initialIsAllDay?: boolean;
    initialType?: string;
    initialEnableDateRange?: boolean;
  };

  private startDateInputEl: HTMLInputElement | null = null;
  private startTimeInputEl: HTMLInputElement | null = null;
  private dueDateInputEl: HTMLInputElement | null = null;
  private dueTimeInputEl: HTMLInputElement | null = null;
  private startDateFieldEl: HTMLElement | null = null;
  private dueDateFieldEl: HTMLElement | null = null;
  private dateErrorMsgEl: HTMLElement | null = null;
  private enableDateRange = false;

  constructor(
    app: App,
    initialTitle: string,
    onSubmit: (data: TaskFormData) => Promise<void>,
    options: {
      groupNames?: string[];
      tagNames?: string[];
      typeNames?: string[];
      heading?: string;
      buttonText?: string;
      folderContext?: string;
      initialDueDate?: string;
      initialDueTime?: string;
      initialStartDate?: string;
      initialStartTime?: string;
      initialTags?: string[];
      initialDuration?: number;
      defaultDurationMinutes?: number;
      initialIsAllDay?: boolean;
      initialType?: string;
      initialEnableDateRange?: boolean;
    } = {}
  ) {
    super(app);
    this.options = options;
    this.onSubmit = onSubmit;

    this.data = {
      title: initialTitle,
      description: "",
      project: options.initialType === "event" ? "" : "Inbox",
      dueDate: options.initialDueDate ?? "",
      dueTime: options.initialDueTime ?? "",
      startDate: options.initialStartDate ?? "",
      startTime: options.initialStartTime ?? "",
      priority: TaskPriority.None,
      status: TaskStatus.Pending,
      tags: options.initialTags ? [...options.initialTags] : [],
      content: "",
      repeat: undefined,
      duration: options.initialDuration ?? options.defaultDurationMinutes ?? 30,
      isAllDay: options.initialIsAllDay !== undefined ? options.initialIsAllDay : true,
      type: options.initialType ?? "task",
    };

    this.enableDateRange = options.initialEnableDateRange ?? false;
  }

  async onOpen(): Promise<void> {
    const { contentEl, modalEl } = this;
    contentEl.empty();

    modalEl.querySelector(".kanban-modal-header")?.remove();
    modalEl.querySelector(".kanban-modal-footer")?.remove();

    contentEl.addClass("task-edit-modal");
    modalEl.addClass("kanban-board-modal-host");

    const header = modalEl.createDiv({ cls: "kanban-modal-header" });
    modalEl.insertBefore(header, contentEl);
    header.createEl("h2", { cls: "kanban-modal-title", text: this.options.heading ?? "New Task" });

    const form = contentEl.createDiv({ cls: "tm-form" });
    this.buildForm(form);

    const buttonText = this.options.buttonText ?? "Create Task";
    const footer = modalEl.createDiv({ cls: "kanban-modal-footer" });
    footer.createEl("button", { cls: "km-btn", text: "Cancel" }).onclick = () => this.close();

    const submitBtn = footer.createEl("button", { cls: "km-btn km-btn-cta", text: buttonText });
    submitBtn.onclick = async () => {
      if (!this.data.title.trim()) {
        new Notice("Task title cannot be empty");
        (contentEl.querySelector(".tm-hero-title") as HTMLInputElement)?.focus({ preventScroll: true });
        return;
      }

      const dateError = this.validateDates();
      if (dateError) {
        new Notice(dateError);
        return;
      }

      submitBtn.textContent = "Creating…";
      submitBtn.setAttribute("disabled", "true");

      try {
        await this.onSubmit(this.data);
        this.close();
      } catch {
        new Notice("Failed to create task");
        submitBtn.textContent = buttonText;
        submitBtn.removeAttribute("disabled");
      }
    };

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
    this.modalEl.querySelector(".kanban-modal-header")?.remove();
    this.modalEl.querySelector(".kanban-modal-footer")?.remove();
  }

  // ── Form builder ──────────────────────────────────────────────────────────
  private buildForm(form: HTMLElement): void {
    // Title
    const titleWrap = form.createDiv({ cls: "tm-hero-title-wrap" });
    const titleInput = titleWrap.createEl("input", { cls: "tm-hero-title", type: "text" });
    titleInput.placeholder = "What needs to be done?";
    titleInput.value = this.data.title;
    makeInputClearable(
      titleInput,
      titleWrap,
      () => { this.data.title = ""; },
      (val) => { this.data.title = val; }
    );
    if (!Platform.isMobile) setTimeout(() => titleInput.focus({ preventScroll: true }), 50);

    if (this.options.folderContext) {
      const badge = form.createDiv({ cls: "tm-context-badge" });
      setIcon(badge.createSpan({ cls: "tm-context-icon" }), "folder");
      badge.createSpan({ text: this.options.folderContext, cls: "tm-context-name" });
    }

    // Dates section
    this.section(form, "Dates", (s) => {
      const shortcutsWrap = s.createDiv({ cls: "tm-date-shortcuts" });
      const shortcuts = [
        { title: "Today", svg: SUN_ICON_SVG, calc: () => new Date() },
        { title: "Tomorrow", svg: SUNRISE_ICON_SVG, calc: () => { const d = new Date(); d.setDate(d.getDate() + 1); return d; } },
        { title: "Next Week", svg: CALENDAR_7_ICON_SVG, calc: () => { const d = new Date(); d.setDate(d.getDate() + 7); return d; } },
        { title: "Next Month", svg: MOON_ICON_SVG, calc: () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d; } },
      ];
      for (const sc of shortcuts) {
        const btn = shortcutsWrap.createEl("button", { cls: "tm-date-shortcut-btn", title: sc.title });
        btn.innerHTML = sc.svg;
        btn.createSpan({ text: sc.title });
        btn.onclick = () => {
          const dateStr = formatDate(sc.calc());
          this.data.dueDate = dateStr;
          if (this.dueDateInputEl) this.dueDateInputEl.value = dateStr;
        };
      }

      const grid = s.createDiv({ cls: "tm-dates-grid" });
      this.dateField(
        grid,
        "Start",
        this.data.startDate,
        this.data.startTime,
        (d) => { this.data.startDate = d; },
        (t) => { this.data.startTime = t; }
      );
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
        this.updateTimeVisibility();
      });
    });

    // Priority section
    this.section(form, "Priority", (s) => {
      this.priorityPills(s, this.data.priority, (v) => { this.data.priority = v; });
    });

    // Project section (renamed from Group)
    if (!this.options.folderContext) {
      this.section(form, "Project", (s) => {
        this.autocompleteField(
          s,
          this.data.project ?? "",
          this.options.groupNames ?? ["Inbox"],
          (val) => { this.data.project = val; },
          "layers"
        );
      });
    }

    // Type section
    this.section(form, "Type", (s) => {
      this.autocompleteField(
        s,
        this.data.type ?? "task",
        this.options.typeNames ?? ["task", "event", "note"],
        (val) => { this.data.type = val; },
        "document"
      );
    });

    // Tags section (multi-select)
    this.section(form, "Tags", (s) => {
      this.multiSelectField(
        s,
        this.data.tags,
        this.options.tagNames ?? [],
        (tags) => { this.data.tags = tags; }
      );
    });

    // Duration section
    this.section(form, "Duration (minutes)", (s) => {
      const input = s.createEl("input", { cls: "km-input", type: "number" });
      input.min = "1";
      input.placeholder = "30";
      input.value = String(this.data.duration ?? 30);
      input.oninput = () => {
        const val = parseInt(input.value);
        if (!isNaN(val) && val > 0) this.data.duration = val;
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
      ta.oninput = () => { this.data.content = ta.value; };
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

    const dateInput = field.createEl("input", { cls: "tm-date-input", type: "date" });
    dateInput.value = dateValue ?? "";
    dateInput.addEventListener("change", () => { onDateChange(dateInput.value); });

    if (label === "Start") {
      this.startDateInputEl = dateInput;
      this.startDateFieldEl = field;
    } else {
      this.dueDateInputEl = dateInput;
      this.dueDateFieldEl = field;
    }

    const timeInput = field.createEl("input", { cls: "tm-time-input", type: "time" });
    timeInput.value = timeValue ?? "";
    timeInput.style.display = this.data.isAllDay ? "none" : "";
    timeInput.addEventListener("change", () => { onTimeChange(timeInput.value); });

    if (label === "Start") {
      this.startTimeInputEl = timeInput;
    } else {
      this.dueTimeInputEl = timeInput;
    }
  }

  private updateTimeVisibility(): void {
    const display = this.data.isAllDay ? "none" : "";
    if (this.startTimeInputEl) this.startTimeInputEl.style.display = display;
    if (this.dueTimeInputEl) this.dueTimeInputEl.style.display = display;
  }

  private validateDates(): string | null {
    if (!this.enableDateRange) return null;
    if (!this.data.startDate || !this.data.dueDate) return null;
    if (this.data.startDate > this.data.dueDate) {
      return "Start date cannot be after due date";
    }
    return null;
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

  /**
   * Single-select autocomplete field (for Project and Type)
   */
  private autocompleteField(
    container: HTMLElement,
    initialValue: string,
    options: string[],
    onChange: (val: string) => void,
    icon: string
  ): void {
    const wrap = container.createDiv({ cls: "tm-autocomplete-wrap" });
    wrap.style.position = "relative";
    wrap.style.width = "100%";

    const input = wrap.createEl("input", { cls: "km-input", type: "text" });
    input.value = initialValue;

    makeInputClearable(
      input,
      wrap,
      () => { onChange(""); wrap.querySelector(".tm-autocomplete-dropdown")?.setAttribute("style", "display: none"); },
      (val) => { onChange(val.trim()); }
    );

    const dropdown = wrap.createDiv({ cls: "tm-autocomplete-dropdown" });
    dropdown.style.display = "none";
    dropdown.style.position = "absolute";
    dropdown.style.top = "100%";
    dropdown.style.left = "0";
    dropdown.style.right = "0";
    dropdown.style.zIndex = "1000";
    dropdown.style.maxHeight = "180px";
    dropdown.style.overflowY = "auto";
    dropdown.style.background = "var(--background-primary-alt)";
    dropdown.style.border = "1px solid var(--background-modifier-border-hover)";
    dropdown.style.borderRadius = "6px";
    dropdown.style.marginTop = "4px";
    dropdown.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.25)";
    dropdown.style.padding = "4px";
    dropdown.style.flexDirection = "column";
    dropdown.style.gap = "2px";

    let activeIdx = -1;
    let filtered: string[] = [];

    const renderDropdown = () => {
      const query = input.value.trim().toLowerCase();
      dropdown.empty();
      filtered = options.filter((item) => item.toLowerCase().includes(query));

      if (filtered.length === 0) {
        dropdown.style.display = "none";
        return;
      }

      if (activeIdx >= filtered.length) activeIdx = filtered.length - 1;
      if (activeIdx < -1) activeIdx = -1;

      for (let idx = 0; idx < filtered.length; idx++) {
        const item = filtered[idx];
        const option = dropdown.createDiv({
          cls: "tm-autocomplete-item" + (idx === activeIdx ? " is-active" : ""),
        });
        option.style.display = "flex";
        option.style.alignItems = "center";
        option.style.gap = "8px";
        option.style.padding = "6px 12px";
        option.style.cursor = "pointer";
        option.style.borderRadius = "4px";
        option.style.color = "var(--text-normal)";
        option.style.backgroundColor = idx === activeIdx ? "var(--background-modifier-hover)" : "transparent";

        const iconSpan = option.createSpan({ cls: "tm-autocomplete-item-icon" });
        iconSpan.style.display = "inline-flex";
        iconSpan.style.alignItems = "center";
        iconSpan.style.justifyContent = "center";
        iconSpan.style.color = "var(--text-muted)";
        iconSpan.style.width = "14px";
        iconSpan.style.height = "14px";
        setIcon(iconSpan, icon);

        option.createSpan({ text: item, cls: "tm-autocomplete-item-text" }).style.flex = "1";

        option.addEventListener("mouseenter", () => {
          activeIdx = idx;
          Array.from(dropdown.children).forEach((child, cIdx) => {
            (child as HTMLElement).style.backgroundColor = cIdx === activeIdx ? "var(--background-modifier-hover)" : "transparent";
          });
        });

        option.addEventListener("mousedown", (e) => {
          e.preventDefault();
          input.value = item;
          onChange(item);
          dropdown.style.display = "none";
        });
      }

      dropdown.style.display = "flex";
    };

    input.addEventListener("focus", () => { activeIdx = -1; renderDropdown(); });
    input.addEventListener("input", () => { activeIdx = -1; renderDropdown(); });
    input.addEventListener("blur", () => { dropdown.style.display = "none"; });
    input.addEventListener("keydown", (e) => {
      if (dropdown.style.display === "none") {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          activeIdx = 0;
          renderDropdown();
          e.preventDefault();
        }
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        activeIdx = (activeIdx + 1) % filtered.length;
        renderDropdown();
        const activeEl = dropdown.children[activeIdx];
        if (activeEl) activeEl.scrollIntoView({ block: "nearest" });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        activeIdx = (activeIdx - 1 + filtered.length) % filtered.length;
        renderDropdown();
        const activeEl = dropdown.children[activeIdx];
        if (activeEl) activeEl.scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") {
        if (activeIdx >= 0 && activeIdx < filtered.length) {
          e.preventDefault();
          const selected = filtered[activeIdx];
          input.value = selected;
          onChange(selected);
          dropdown.style.display = "none";
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        dropdown.style.display = "none";
      }
    });
  }

  /**
   * Multi-select autocomplete field for Tags
   */
  private multiSelectField(
    container: HTMLElement,
    initialTags: string[],
    allOptions: string[],
    onChange: (tags: string[]) => void
  ): void {
    const wrap = container.createDiv({ cls: "tm-multiselect-wrap" });
    wrap.style.position = "relative";
    wrap.style.width = "100%";

    const inputWrap = wrap.createDiv({ cls: "tm-multiselect-input" });
    inputWrap.style.display = "flex";
    inputWrap.style.flexWrap = "wrap";
    inputWrap.style.gap = "4px";
    inputWrap.style.padding = "4px 8px";
    inputWrap.style.border = "1px solid var(--background-modifier-border)";
    inputWrap.style.borderRadius = "4px";
    inputWrap.style.background = "var(--background-primary)";
    inputWrap.style.minHeight = "32px";
    inputWrap.style.alignItems = "center";

    const input = inputWrap.createEl("input", { cls: "tm-multiselect-input-field", type: "text" });
    input.style.border = "none";
    input.style.outline = "none";
    input.style.background = "transparent";
    input.style.flex = "1";
    input.style.minWidth = "80px";
    input.style.padding = "2px 0";
    input.placeholder = "Add tags…";

    const dropdown = wrap.createDiv({ cls: "tm-autocomplete-dropdown" });
    dropdown.style.display = "none";
    dropdown.style.position = "absolute";
    dropdown.style.top = "100%";
    dropdown.style.left = "0";
    dropdown.style.right = "0";
    dropdown.style.zIndex = "1000";
    dropdown.style.maxHeight = "180px";
    dropdown.style.overflowY = "auto";
    dropdown.style.background = "var(--background-primary-alt)";
    dropdown.style.border = "1px solid var(--background-modifier-border-hover)";
    dropdown.style.borderRadius = "6px";
    dropdown.style.marginTop = "4px";
    dropdown.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.25)";
    dropdown.style.padding = "4px";
    dropdown.style.flexDirection = "column";
    dropdown.style.gap = "2px";

    let activeIdx = -1;
    let filtered: string[] = [];
    let selectedTags = [...initialTags];

    const renderPills = () => {
      inputWrap.querySelectorAll(".tm-multiselect-pill").forEach((el) => el.remove());
      for (const tag of selectedTags) {
        const pill = inputWrap.createEl("span", { cls: "tm-multiselect-pill" });
        pill.style.display = "inline-flex";
        pill.style.alignItems = "center";
        pill.style.gap = "4px";
        pill.style.padding = "2px 6px";
        pill.style.background = "var(--background-secondary)";
        pill.style.borderRadius = "4px";
        pill.style.fontSize = "0.85em";
        pill.style.color = "var(--text-normal)";
        pill.textContent = tag;

        const removeBtn = pill.createEl("span", { cls: "tm-multiselect-pill-remove" });
        removeBtn.style.cursor = "pointer";
        removeBtn.style.opacity = "0.6";
        removeBtn.style.fontSize = "0.9em";
        setIcon(removeBtn, "x");
        removeBtn.onclick = (e) => {
          e.stopPropagation();
          selectedTags = selectedTags.filter((t) => t !== tag);
          onChange(selectedTags);
          renderPills();
        };

        inputWrap.insertBefore(pill, input);
      }
    };

    const renderDropdown = () => {
      const query = input.value.trim().toLowerCase();
      dropdown.empty();
      filtered = allOptions.filter(
        (item) => item.toLowerCase().includes(query) && !selectedTags.includes(item)
      );

      if (filtered.length === 0) {
        dropdown.style.display = "none";
        return;
      }

      if (activeIdx >= filtered.length) activeIdx = filtered.length - 1;
      if (activeIdx < -1) activeIdx = -1;

      for (let idx = 0; idx < filtered.length; idx++) {
        const item = filtered[idx];
        const option = dropdown.createDiv({
          cls: "tm-autocomplete-item" + (idx === activeIdx ? " is-active" : ""),
        });
        option.style.display = "flex";
        option.style.alignItems = "center";
        option.style.gap = "8px";
        option.style.padding = "6px 12px";
        option.style.cursor = "pointer";
        option.style.borderRadius = "4px";
        option.style.color = "var(--text-normal)";
        option.style.backgroundColor = idx === activeIdx ? "var(--background-modifier-hover)" : "transparent";

        const iconSpan = option.createSpan({ cls: "tm-autocomplete-item-icon" });
        iconSpan.style.display = "inline-flex";
        iconSpan.style.alignItems = "center";
        iconSpan.style.justifyContent = "center";
        iconSpan.style.color = "var(--text-muted)";
        iconSpan.style.width = "14px";
        iconSpan.style.height = "14px";
        setIcon(iconSpan, "tag");

        option.createSpan({ text: item, cls: "tm-autocomplete-item-text" }).style.flex = "1";

        option.addEventListener("mouseenter", () => {
          activeIdx = idx;
          Array.from(dropdown.children).forEach((child, cIdx) => {
            (child as HTMLElement).style.backgroundColor = cIdx === activeIdx ? "var(--background-modifier-hover)" : "transparent";
          });
        });

        option.addEventListener("mousedown", (e) => {
          e.preventDefault();
          if (!selectedTags.includes(item)) {
            selectedTags.push(item);
            onChange(selectedTags);
            renderPills();
          }
          input.value = "";
          renderDropdown();
        });
      }

      dropdown.style.display = "flex";
    };

    input.addEventListener("focus", () => { activeIdx = -1; renderDropdown(); });
    input.addEventListener("input", () => { activeIdx = -1; renderDropdown(); });
    input.addEventListener("blur", () => { dropdown.style.display = "none"; });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && input.value.trim()) {
        e.preventDefault();
        const newTag = input.value.trim();
        if (!selectedTags.includes(newTag)) {
          selectedTags.push(newTag);
          onChange(selectedTags);
          renderPills();
        }
        input.value = "";
        renderDropdown();
      } else if (e.key === "Backspace" && !input.value && selectedTags.length > 0) {
        selectedTags.pop();
        onChange(selectedTags);
        renderPills();
      } else if (dropdown.style.display === "none") {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          activeIdx = 0;
          renderDropdown();
          e.preventDefault();
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        activeIdx = (activeIdx + 1) % filtered.length;
        renderDropdown();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        activeIdx = (activeIdx - 1 + filtered.length) % filtered.length;
        renderDropdown();
      } else if (e.key === "Escape") {
        dropdown.style.display = "none";
      }
    });

    renderPills();
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

    const intervalInput = row1.createEl("input", { cls: "km-input tm-interval-input", type: "number" });
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
    row1.createEl("span", { text: unitLabels[this.data.repeat.freq], cls: "tm-repeat-row-label" });

    // Weekly day selection
    if (this.data.repeat.freq === "WEEKLY") {
      const dayRow = panel.createDiv({ cls: "tm-day-row" });
      const currentDays = new Set(this.data.repeat.byday ?? []);

      for (let i = 0; i < RFC_DAYS.length; i++) {
        const code = RFC_DAYS[i];
        const lbl = dayRow.createEl("label", { cls: "tm-day-pill" + (currentDays.has(code) ? " is-on" : "") });
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
      const modes = [["default", "Same day"], ["bymonthday", "Day number"], ["bynthweekday", "Nth weekday"]];
      for (const [v, l] of modes) {
        const o = modeSel.createEl("option", { value: v, text: l });
        if (v === detectMonthlyMode(this.data.repeat)) o.selected = true;
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
    const endCond = detectEndCondition(this.data.repeat);
    const endRow = panel.createDiv({ cls: "tm-repeat-row" });
    endRow.createEl("span", { text: "Ends", cls: "tm-repeat-row-label" });

    const endSel = endRow.createEl("select", { cls: "km-select" });
    const endOptions = [["never", "Never"], ["until", "On date"], ["count", "After N times"]];
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
    const removeBtn = removeRow.createEl("button", { cls: "tm-remove-btn", text: "Remove recurrence" });
    removeBtn.onclick = () => {
      this.data.repeat = undefined;
      this.renderRepeatPanel(container);
    };
  }
}