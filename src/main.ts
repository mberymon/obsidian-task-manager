import { Plugin, Notice, MarkdownView, TFile } from "obsidian";
import type { Editor, MarkdownFileInfo } from "obsidian";
import { Task, TaskManagerSettings, TaskFormData, TaskStatus, TaskPriority} from "./types"; //, CodeBlockParams, ViewType, RepeatFreq
import { TaskManager } from "./tasks/TaskManager";
import { TaskFileManager } from "./vault/TaskFileManager";
import { ViewRenderer } from "./views/ViewRenderer";
import { CreateTaskModal } from "./ui/CreateTaskModal";
import { TaskManagerSettingsTab } from "./settings/TaskManagerSettingsTab";

/**
 * TaskManagerPlugin - Main plugin class
 */
export default class TaskManagerPlugin extends Plugin {
  settings: TaskManagerSettings;
  private fileManager: TaskFileManager | null = null;
  private tasks: Task[] = [];

  async onload(): Promise<void> {
    // Load settings
    await this.loadSettings();

    // Initialize file manager
    this.fileManager = new TaskFileManager(this.app, this.settings.taskFolderPath);

    // Register code block processor
    this.registerMarkdownCodeBlockProcessor("task-manager", (source, el, ctx) => {
      this.renderCodeBlock(source, el, ctx);
    });

    // Also support "tasks" code block for compatibility
    this.registerMarkdownCodeBlockProcessor("tasks", (source, el, ctx) => {
      this.renderCodeBlock(source, el, ctx);
    });

    // Add ribbon icon
    this.addRibbonIcon("check-square", "Create Task", () => {
      this.openCreateTaskModal();
    });

    // Add command: Create new task
    this.addCommand({
      id: "create-task",
      name: "Create new task",
      callback: () => {
        this.openCreateTaskModal();
      },
    });

    // Add command: Toggle task status
    this.addCommand({
      id: "toggle-task",
      name: "Toggle task status on current line",
      editorCallback: (editor, view) => {
        this.toggleTaskOnLine(editor, view);
      },
    });

    // Add settings tab
    this.addSettingTab(new TaskManagerSettingsTab(this.app, this));

    // Listen for file changes to refresh tasks
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile && file.path.startsWith(this.settings.taskFolderPath)) {
          this.refreshTasks();
        }
      })
    );

    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof TFile && file.path.startsWith(this.settings.taskFolderPath)) {
          this.refreshTasks();
        }
      })
    );

    // Initial task load
    await this.refreshTasks();
  }

  onunload(): void {
    // Cleanup
  }

  /**
   * Load settings from disk
   */
  async loadSettings(): Promise<void> {
    const data = await this.loadData();
    this.settings = {
      ...this.getDefaultSettings(),
      ...data,
    };
  }

  /**
   * Save settings to disk
   */
  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /**
   * Get default settings
   */
  getDefaultSettings(): TaskManagerSettings {
    return {
      taskFolderPath: "tasks",
      defaultTaskFile: "tasks.md",
      defaultProject: "Inbox",
      defaultView: "table",
      showCompletedByDefault: false,
      showCancelledByDefault: false,
      defaultCalendarView: "month",
      dateFormat: "YYYY-MM-DD",
      timeFormat: "HH:mm",
      use24HourTime: true,
      startOfWeek: 0,
      defaultRepeatFreq: "WEEKLY",
      defaultRepeatInterval: 1,
      taskTypes: [
        { name: "task", icon: "check-square" },
        { name: "event", icon: "calendar" },
        { name: "note", icon: "file-text" },
      ],
      knownProjects: ["Inbox"],
      knownTags: [],
      knownTypes: ["task", "event", "note"],
    };
  }

  /**
   * Refresh tasks from vault
   */
  async refreshTasks(): Promise<void> {
    if (!this.fileManager) return;
    this.tasks = await this.fileManager.readAllTasks();
  }

  /**
   * Render a code block view
   */
  private renderCodeBlock(
    source: string,
    el: HTMLElement,
    ctx: Parameters<Parameters<typeof this.registerMarkdownCodeBlockProcessor>[1]>[2]
  ): void {
    const params = ViewRenderer.parseParams(source);

    // Apply defaults from settings
    if (!params.view) {
      params.view = this.settings.defaultView;
    }
    if (params.showCompleted === undefined) {
      params.showCompleted = this.settings.showCompletedByDefault;
    }
    if (params.showCancelled === undefined) {
      params.showCancelled = this.settings.showCancelledByDefault;
    }

    ViewRenderer.renderView(
      el,
      this.tasks,
      params,
      ctx,
      async (task: Task) => {
        if (!this.fileManager) return;
        await this.fileManager.updateTask(task);
        await this.refreshTasks();
      },
      () => {
        this.openCreateTaskModal();
      }
    );
  }

  /**
   * Open the create task modal
   */
  private async openCreateTaskModal(): Promise<void> {
    if (!this.fileManager) return;

    // Gather known options from vault
    const projects = await this.fileManager.getProjectNames();
    const tags = await this.fileManager.getTagNames();
    const types = this.settings.knownTypes.map((t) => t);

    const modal = new CreateTaskModal(
      this.app,
      "",
      async (data: TaskFormData) => {
        if (!this.fileManager) return;

        // Build task object
        const task: Omit<Task, "id" | "filePath" | "line"> = {
          title: data.title,
          description: data.description,
          status: data.status,
          priority: data.priority,
          tags: data.tags,
          dueDate: this.combineDateAndTime(data.dueDate, data.dueTime),
          startDate: this.combineDateAndTime(data.startDate, data.startTime),
          duration: data.duration,
          isAllDay: data.isAllDay,
          repeat: data.repeat,
          project: data.project,
          type: data.type,
        };

        await this.fileManager.createTask(task);
        await this.refreshTasks();
        new Notice("Task created");
      },
      {
        groupNames: projects.length > 0 ? projects : ["Inbox"],
        tagNames: tags,
        typeNames: types,
      }
    );

    modal.open();
  }

  /**
   * Toggle task status on the current editor line
   */
  private toggleTaskOnLine(editor: Editor, view: MarkdownView | MarkdownFileInfo): void {
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);

    const task = TaskManager.parseTaskLine(line, view.file?.path ?? "", cursor.line);
    if (!task) {
      new Notice("No task found on this line");
      return;
    }

    // Toggle status
    const newStatus =
      task.status === TaskStatus.Pending
        ? TaskStatus.InProgress
        : task.status === TaskStatus.InProgress
        ? TaskStatus.Completed
        : TaskStatus.Pending;

    const updatedTask = {
      ...task,
      status: newStatus,
      completedDate:
        newStatus === TaskStatus.Completed
          ? new Date().toISOString().split("T")[0]
          : undefined,
    };

    const newLine = TaskManager.serializeTask(updatedTask);
    editor.setLine(cursor.line, newLine);
  }

  /**
   * Combine date and time strings
   */
  private combineDateAndTime(date?: string, time?: string): string | undefined {
    if (!date) return undefined;
    if (!time) return date;
    return `${date} ${time}`;
  }
}

// Export for settings tab
export { TaskManagerPlugin };