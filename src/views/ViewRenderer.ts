import { MarkdownPostProcessorContext, MarkdownRenderChild } from "obsidian";
import { Task, CodeBlockParams, ViewType } from "../types";
import { TaskManager } from "../tasks/TaskManager";
import { TableView } from "./TableView";
import { KanbanView } from "./KanbanView";
import { CalendarView } from "./CalendarView";

/**
 * ViewRenderer - Handles code block post-processing and view rendering
 */
export class ViewRenderer {
  /**
   * Parse code block parameters
   */
  static parseParams(source: string): CodeBlockParams {
    const params: CodeBlockParams = {};
    const lines = source.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const [key, ...valueParts] = trimmed.split(":");
      const value = valueParts.join(":").trim();

      switch (key.toLowerCase()) {
        case "view":
          params.view = value as ViewType;
          break;
        case "groupby":
          params.groupBy = value;
          break;
        case "sortby":
          params.sortBy = value;
          break;
        case "sortorder":
          params.sortOrder = value as "asc" | "desc";
          break;
        case "filter":
          params.filter = value;
          break;
        case "showcompleted":
          params.showCompleted = value.toLowerCase() === "true";
          break;
        case "showcancelled":
          params.showCancelled = value.toLowerCase() === "true";
          break;
        case "daterange":
          params.dateRange = value;
          break;
        case "limit":
          params.limit = parseInt(value, 10);
          break;
        case "groups":
          params.groups = value.split(",").map((g) => g.trim());
          break;
        case "tags":
          params.tags = value.split(",").map((t) => t.trim());
          break;
      }
    }

    return params;
  }

  /**
   * Render a view based on parameters
   */
  static renderView(
    el: HTMLElement,
    tasks: Task[],
    params: CodeBlockParams,
    ctx: MarkdownPostProcessorContext,
    onTaskUpdate: (task: Task) => Promise<void>,
    onTaskCreate: () => void
  ): ViewRenderChild {
    const child = new ViewRenderChild(el, tasks, params, ctx, onTaskUpdate, onTaskCreate);
    ctx.addChild(child);
    return child;
  }
}

/**
 * ViewRenderChild - Manages the lifecycle of a rendered view
 */
class ViewRenderChild extends MarkdownRenderChild {
  private tasks: Task[];
  private params: CodeBlockParams;
  private ctx: MarkdownPostProcessorContext;
  private onTaskUpdate: (task: Task) => Promise<void>;
  private onTaskCreate: () => void;

  constructor(
    container: HTMLElement,
    tasks: Task[],
    params: CodeBlockParams,
    ctx: MarkdownPostProcessorContext,
    onTaskUpdate: (task: Task) => Promise<void>,
    onTaskCreate: () => void
  ) {
    super(container);
    this.tasks = tasks;
    this.params = params;
    this.ctx = ctx;
    this.onTaskUpdate = onTaskUpdate;
    this.onTaskCreate = onTaskCreate;
  }

  onload(): void {
    this.render();
  }

  private render(): void {
    this.containerEl.empty();
    this.containerEl.addClass("task-manager-view");

    // Add header with create button
    const header = this.containerEl.createDiv({ cls: "task-manager-header" });
    header.createSpan({
      cls: "task-manager-title",
      text: `Task Manager (${this.params.view ?? "table"})`,
    });

    const createBtn = header.createEl("button", {
      cls: "task-manager-create-btn",
      text: "+ New Task",
    });
    createBtn.addEventListener("click", () => this.onTaskCreate());

    // Filter and sort tasks
    let filteredTasks = TaskManager.filterTasks(this.tasks, this.params);
    filteredTasks = TaskManager.sortTasks(
      filteredTasks,
      this.params.sortBy,
      this.params.sortOrder
    );

    // Generate recurring occurrences if date range is specified
    if (this.params.dateRange) {
      const { start, end } = this.parseDateRange(this.params.dateRange);
      if (start && end) {
        const ghosts = TaskManager.generateRecurringOccurrences(
          this.tasks,
          start,
          end
        );
        filteredTasks = [...filteredTasks, ...ghosts];
      }
    }

    // Render the appropriate view
    const viewContent = this.containerEl.createDiv({ cls: "task-manager-content" });

    switch (this.params.view) {
      case "kanban":
        KanbanView.render(viewContent, filteredTasks, this.params, this.onTaskUpdate);
        break;
      case "calendar":
        CalendarView.render(viewContent, filteredTasks, this.params, this.onTaskUpdate);
        break;
      case "table":
      default:
        TableView.render(viewContent, filteredTasks, this.params, this.onTaskUpdate);
        break;
    }
  }

  private parseDateRange(rangeStr: string): { start: string; end: string } {
    const today = new Date();
    const todayStr = this.toDateString(today);

    switch (rangeStr.toLowerCase()) {
      case "today":
        return { start: todayStr, end: todayStr };
      case "tomorrow":
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return { start: this.toDateString(tomorrow), end: this.toDateString(tomorrow) };
      case "week":
      case "thisweek":
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        return {
          start: this.toDateString(startOfWeek),
          end: this.toDateString(endOfWeek),
        };
      case "month":
      case "thismonth":
        return {
          start: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`,
          end: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
            new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
          ).padStart(2, "0")}`,
        };
      default:
        const parts = rangeStr.split(",");
        if (parts.length === 2) {
          return { start: parts[0].trim(), end: parts[1].trim() };
        }
        return { start: todayStr, end: todayStr };
    }
  }

  private toDateString(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
}