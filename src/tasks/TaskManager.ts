import { Task, TaskStatus, TaskPriority, RepeatConfig, CodeBlockParams } from "../types";
import { RRuleParser } from "./RRuleParser";

/**
 * TaskManager - Core task management logic
 * Handles task parsing, filtering, sorting, and recurring task generation.
 */
export class TaskManager {
  private tasks: Map<string, Task> = new Map();

  /**
   * Parse a markdown line into a task object.
   * Expected format: - [ ] Task title 📅2024-01-15 ⏳2024-01-10 🔼 🏷️work,urgent 🔁FREQ=WEEKLY;BYDAY=MO
   */
  static parseTaskLine(line: string, filePath: string, lineNum: number): Task | null {
    // Match checkbox pattern: - [ ] or - [x] or - [>] or - [-]
    const checkboxMatch = line.match(/^(\s*)[-*]\s+\[([ xX>\/-])\]\s+(.*)$/);
    if (!checkboxMatch) return null;

    const [, indent, checkbox, content] = checkboxMatch;
    const status = this.parseCheckboxStatus(checkbox);

    // Extract metadata from content
    const { title, metadata } = this.parseTaskContent(content);

    // Generate unique ID
    const id = `${filePath}:${lineNum}`;

    return {
      id,
      filePath,
      line: lineNum,
      title,
      status,
      priority: metadata.priority ?? TaskPriority.None,
      tags: metadata.tags ?? [],
      dueDate: metadata.dueDate,
      startDate: metadata.startDate,
      completedDate: metadata.completedDate,
      duration: metadata.duration,
      isAllDay: metadata.isAllDay ?? true,
      repeat: metadata.repeat,
      group: metadata.group,
      content: line,
    };
  }

  /**
   * Parse checkbox character to TaskStatus
   */
  private static parseCheckboxStatus(checkbox: string): TaskStatus {
    switch (checkbox.toLowerCase()) {
      case "x":
        return TaskStatus.Completed;
      case ">":
        return TaskStatus.InProgress;
      case "-":
        return TaskStatus.Cancelled;
      case "/":
        return TaskStatus.InProgress;
      default:
        return TaskStatus.Pending;
    }
  }

  /**
   * Parse task content and extract metadata
   */
  private static parseTaskContent(content: string): {
    title: string;
    metadata: {
      tags: string[];
      priority?: TaskPriority;
      dueDate?: string;
      startDate?: string;
      completedDate?: string;
      duration?: number;
      isAllDay?: boolean;
      repeat?: RepeatConfig;
      group?: string;
    };
  } {
    const metadata: {
      tags: string[];
      priority?: TaskPriority;
      dueDate?: string;
      startDate?: string;
      completedDate?: string;
      duration?: number;
      isAllDay?: boolean;
      repeat?: RepeatConfig;
      group?: string;
    } = {
      tags: [],
    };
    let title = content;

    // Extract due date: 📅YYYY-MM-DD or 📅YYYY-MM-DD HH:mm
    const dueDateMatch = title.match(/📅\s*(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?)/);
    if (dueDateMatch) {
      metadata.dueDate = dueDateMatch[1];
      title = title.replace(dueDateMatch[0], "").trim();
    }

    // Extract start date: ⏳YYYY-MM-DD or ⏳YYYY-MM-DD HH:mm
    const startDateMatch = title.match(/⏳\s*(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?)/);
    if (startDateMatch) {
      metadata.startDate = startDateMatch[1];
      title = title.replace(startDateMatch[0], "").trim();
    }

    // Extract completed date: ✅YYYY-MM-DD
    const completedDateMatch = title.match(/✅\s*(\d{4}-\d{2}-\d{2})/);
    if (completedDateMatch) {
      metadata.completedDate = completedDateMatch[1];
      title = title.replace(completedDateMatch[0], "").trim();
    }

    // Extract priority: 🔼(high) or 🔽(low) or ⏫(urgent) or 🔽(low)
    const priorityMatch = title.match(/(⏫|🔼|🔽)/);
    if (priorityMatch) {
      switch (priorityMatch[1]) {
        case "⏫":
          metadata.priority = TaskPriority.Urgent;
          break;
        case "🔼":
          metadata.priority = TaskPriority.High;
          break;
        case "🔽":
          metadata.priority = TaskPriority.Low;
          break;
      }
      title = title.replace(priorityMatch[0], "").trim();
    }

    // Extract tags: 🏷️tag1,tag2 or #tag1 #tag2
    const tagEmojiMatch = title.match(/🏷️\s*([^\s]+)/);
    if (tagEmojiMatch) {
      metadata.tags = tagEmojiMatch[1].split(",").map((t) => t.trim());
      title = title.replace(tagEmojiMatch[0], "").trim();
    }

    // Extract inline hashtags as tags
    const hashtagMatches = title.match(/#(\S+)/g);
    if (hashtagMatches) {
      const tags = hashtagMatches.map((m) => m.slice(1));
      (metadata.tags as string[]).push(...tags);
      title = title.replace(/#\S+/g, "").trim();
    }

    // Extract recurrence: 🔁RRULE or 🔁FREQ=...
    const repeatMatch = title.match(/🔁\s*(RRULE:)?(.+?)(?=\s*📅|🏷️|⏳|✅|⏫|🔼|🔽|$)/);
    if (repeatMatch) {
      const rruleStr = repeatMatch[2].trim();
      const repeat = RRuleParser.fromRRule(rruleStr.startsWith("RRULE:") ? rruleStr : `RRULE:${rruleStr}`);
      if (repeat) {
        metadata.repeat = repeat;
      }
      title = title.replace(repeatMatch[0], "").trim();
    }

    // Extract group: 📁group or 🏷️group (if not already parsed as tags)
    const groupMatch = title.match(/📁\s*(\S+)/);
    if (groupMatch) {
      metadata.group = groupMatch[1];
      title = title.replace(groupMatch[0], "").trim();
    }

    // Extract duration: ⏱️30 or ⏱️30min
    const durationMatch = title.match(/⏱️\s*(\d+)/);
    if (durationMatch) {
      metadata.duration = parseInt(durationMatch[1], 10);
      title = title.replace(durationMatch[0], "").trim();
    }

    // Clean up title
    title = title.replace(/\s+/g, " ").trim();

    return { title, metadata };
  }

  /**
   * Serialize a task back to markdown format
   */
  static serializeTask(task: Task): string {
    let line = "- [";

    switch (task.status) {
      case TaskStatus.Completed:
        line += "x";
        break;
      case TaskStatus.InProgress:
        line += ">";
        break;
      case TaskStatus.Cancelled:
        line += "-";
        break;
      default:
        line += " ";
        break;
    }

    line += `] ${task.title}`;

    // Add start date
    if (task.startDate) {
      line += ` ⏳${task.startDate}`;
    }

    // Add due date
    if (task.dueDate) {
      line += ` 📅${task.dueDate}`;
    }

    // Add completed date
    if (task.completedDate) {
      line += ` ✅${task.completedDate}`;
    }

    // Add priority
    switch (task.priority) {
      case TaskPriority.Urgent:
        line += " ⏫";
        break;
      case TaskPriority.High:
        line += " 🔼";
        break;
      case TaskPriority.Low:
        line += " 🔽";
        break;
    }

    // Add tags
    if (task.tags && task.tags.length > 0) {
      line += ` 🏷️${task.tags.join(",")}`;
    }

    // Add group
    if (task.group) {
      line += ` 📁${task.group}`;
    }

    // Add duration
    if (task.duration) {
      line += ` ⏱️${task.duration}`;
    }

    // Add recurrence
    if (task.repeat) {
      line += ` 🔁${RRuleParser.toRRule(task.repeat)}`;
    }

    return line;
  }

  /**
   * Filter tasks based on code block parameters
   */
  static filterTasks(tasks: Task[], params: CodeBlockParams): Task[] {
    let filtered = [...tasks];

    // Filter by status
    if (!params.showCompleted) {
      filtered = filtered.filter((t) => t.status !== TaskStatus.Completed);
    }
    if (!params.showCancelled) {
      filtered = filtered.filter((t) => t.status !== TaskStatus.Cancelled);
    }

    // Filter by groups
    if (params.groups && params.groups.length > 0) {
      filtered = filtered.filter((t) => t.group && params.groups!.includes(t.group));
    }

    // Filter by tags
    if (params.tags && params.tags.length > 0) {
      filtered = filtered.filter((t) =>
        t.tags.some((tag) => params.tags!.includes(tag))
      );
    }

    // Filter by date range
    if (params.dateRange) {
      const { start, end } = this.parseDateRange(params.dateRange);
      if (start && end) {
        filtered = filtered.filter((t) => {
          if (!t.dueDate) return false;
          const dueDate = t.dueDate.split(" ")[0];
          return dueDate >= start && dueDate <= end;
        });
      }
    }

    // Filter by custom filter expression (simple implementation)
    if (params.filter) {
      const filterLower = params.filter.toLowerCase();
      filtered = filtered.filter((t) => {
        return (
          t.title.toLowerCase().includes(filterLower) ||
          t.tags.some((tag) => tag.toLowerCase().includes(filterLower)) ||
          (t.group && t.group.toLowerCase().includes(filterLower))
        );
      });
    }

    // Apply limit
    if (params.limit && params.limit > 0) {
      filtered = filtered.slice(0, params.limit);
    }

    return filtered;
  }

  /**
   * Sort tasks based on parameters
   */
  static sortTasks(tasks: Task[], sortBy?: string, sortOrder: "asc" | "desc" = "asc"): Task[] {
    const sorted = [...tasks];

    if (!sortBy) {
      // Default sort: by due date (ascending), then by priority (descending)
      return sorted.sort((a, b) => {
        const dateCompare = this.compareDates(a.dueDate, b.dueDate);
        if (dateCompare !== 0) return dateCompare;
        return b.priority - a.priority;
      });
    }

    sorted.sort((a, b) => {
      let result = 0;

      switch (sortBy) {
        case "dueDate":
          result = this.compareDates(a.dueDate, b.dueDate);
          break;
        case "startDate":
          result = this.compareDates(a.startDate, b.startDate);
          break;
        case "priority":
          result = b.priority - a.priority;
          break;
        case "title":
          result = a.title.localeCompare(b.title);
          break;
        case "group":
          result = (a.group ?? "").localeCompare(b.group ?? "");
          break;
        case "status":
          result = a.status - b.status;
          break;
        default:
          result = 0;
      }

      return sortOrder === "desc" ? -result : result;
    });

    return sorted;
  }

  /**
   * Group tasks by a field
   */
  static groupTasksBy(tasks: Task[], groupBy: string): Map<string, Task[]> {
    const groups = new Map<string, Task[]>();

    for (const task of tasks) {
      let key: string;

      switch (groupBy) {
        case "status":
          key = this.getStatusLabel(task.status);
          break;
        case "priority":
          key = this.getPriorityLabel(task.priority);
          break;
        case "group":
          key = task.group ?? "No Group";
          break;
        case "tags":
          key = task.tags.length > 0 ? task.tags.join(", ") : "No Tags";
          break;
        default:
          key = "All";
      }

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(task);
    }

    return groups;
  }

  /**
   * Generate ghost occurrences for recurring tasks within a date range
   */
  static generateRecurringOccurrences(
    tasks: Task[],
    rangeStart: string,
    rangeEnd: string
  ): Task[] {
    const ghosts: Task[] = [];

    for (const task of tasks) {
      if (!task.repeat || task.repeatParentId || task.status >= 2 || !task.dueDate) {
        continue;
      }

      const occurrences = RRuleParser.generateOccurrences(
        {
          id: task.id,
          filePath: task.filePath,
          title: task.title,
          dueDate: task.dueDate,
          startDate: task.startDate,
          duration: task.duration,
          priority: task.priority,
          status: task.status,
          isAllDay: task.isAllDay,
          tags: task.tags,
          group: task.group,
          repeat: task.repeat,
          repeatParentId: task.repeatParentId,
        },
        rangeStart,
        rangeEnd
      );

      for (const occ of occurrences) {
        ghosts.push({
          id: occ.id as string,
          filePath: occ.filePath as string,
          line: -1,
          title: occ.title as string,
          status: TaskStatus.Pending,
          priority: occ.priority as TaskPriority,
          tags: (occ.tags as string[]) ?? [],
          dueDate: occ.dueDate as string,
          startDate: occ.startDate as string,
          duration: occ.duration as number,
          isAllDay: occ.isAllDay as boolean,
          repeat: task.repeat,
          repeatParentId: task.id,
          group: occ.group as string,
          isGhost: true,
        });
      }
    }

    return ghosts;
  }

  /**
   * Parse date range string
   */
  private static parseDateRange(rangeStr: string): { start: string; end: string } {
    const today = new Date();
    const todayStr = this.toDateString(today);

    // Check for named ranges
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
        // Parse explicit range: YYYY-MM-DD,YYYY-MM-DD
        const parts = rangeStr.split(",");
        if (parts.length === 2) {
          return { start: parts[0].trim(), end: parts[1].trim() };
        }
        return { start: todayStr, end: todayStr };
    }
  }

  private static getStatusLabel(status: TaskStatus): string {
    switch (status) {
      case TaskStatus.Pending:
        return "Pending";
      case TaskStatus.InProgress:
        return "In Progress";
      case TaskStatus.Completed:
        return "Completed";
      case TaskStatus.Cancelled:
        return "Cancelled";
      default:
        return "Unknown";
    }
  }

  private static getPriorityLabel(priority: TaskPriority): string {
    switch (priority) {
      case TaskPriority.Urgent:
        return "Urgent";
      case TaskPriority.High:
        return "High";
      case TaskPriority.Medium:
        return "Medium";
      case TaskPriority.None:
        return "None";
      case TaskPriority.Low:
        return "Low";
      default:
        return "Unknown";
    }
  }

  private static compareDates(a?: string, b?: string): number {
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    return a.localeCompare(b);
  }

  private static toDateString(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
}