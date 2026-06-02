import { Task, TaskStatus, TaskPriority, RepeatConfig, CodeBlockParams } from "../types";
import { RRuleParser } from "./RRuleParser";

// Regex patterns for task parsing - compiled once for performance
const CHECKBOX_REGEX = /^(\s*)[-*]\s+\[([ xX>\/-])\]\s+(.*)$/;
const DUE_DATE_REGEX = /📅\s*(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?)/;
const START_DATE_REGEX = /⏳\s*(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?)/;
const COMPLETED_DATE_REGEX = /✅\s*(\d{4}-\d{2}-\d{2})/;
const PRIORITY_REGEX = /(⏫|🔼|🔽)/;
const TAG_EMOJI_REGEX = /🏷️\s*([^\s]+)/;
const HASHTAG_REGEX = /#(\S+)/g;
const REPEAT_REGEX = /🔁\s*(RRULE:)?(.+?)(?=\s*📅|🏷️|⏳|✅|⏫|🔼|🔽|$)/;
const GROUP_REGEX = /📁\s*(\S+)/;
const DURATION_REGEX = /⏱️\s*(\d+)/;

/**
 * Parsed metadata from task content
 */
interface TaskMetadata {
  tags: string[];
  priority?: TaskPriority;
  dueDate?: string;
  startDate?: string;
  completedDate?: string;
  duration?: number;
  isAllDay?: boolean;
  repeat?: RepeatConfig;
  group?: string;
}

/**
 * TaskManager - Core task management logic
 * Handles task parsing, filtering, sorting, and recurring task generation.
 */
export class TaskManager {
  /**
   * Parse a markdown line into a task object.
   * Expected format: - [ ] Task title 📅2024-01-15 ⏳2024-01-10 🔼 🏷️work,urgent 🔁FREQ=WEEKLY;BYDAY=MO
   * 
   * @param line - The markdown line to parse
   * @param filePath - Path to the source file
   * @param lineNum - Line number in the file (1-based)
   * @returns Parsed Task object or null if not a valid task line
   */
  static parseTaskLine(line: string, filePath: string, lineNum: number): Task | null {
    // Match checkbox pattern: - [ ] or - [x] or - [>] or - [-]
    const checkboxMatch = line.match(CHECKBOX_REGEX);
    if (!checkboxMatch) {
      return null;
    }

    const [, , checkbox, content] = checkboxMatch;
    const status = this.parseCheckboxStatus(checkbox);
    const { title, metadata } = this.parseTaskContent(content);

    return {
      id: this.generateTaskId(filePath, lineNum),
      filePath,
      line: lineNum,
      title,
      status,
      priority: metadata.priority ?? TaskPriority.None,
      tags: metadata.tags,
      dueDate: metadata.dueDate,
      startDate: metadata.startDate,
      completedDate: metadata.completedDate,
      duration: metadata.duration,
      isAllDay: metadata.isAllDay,
      repeat: metadata.repeat,
      group: metadata.group,
      content: line,
    };
  }

  /**
   * Generate a unique task ID from file path and line number
   */
  private static generateTaskId(filePath: string, lineNum: number): string {
    return `${filePath}:${lineNum}`;
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
   * Uses a helper function approach to avoid code duplication in date/metadata extraction
   */
  private static parseTaskContent(content: string): { title: string; metadata: TaskMetadata } {
    const metadata: TaskMetadata = { tags: [] };
    let title = content;

    // Extract date fields using helper
    title = this.extractDateField(title, DUE_DATE_REGEX, (val) => { metadata.dueDate = val; });
    title = this.extractDateField(title, START_DATE_REGEX, (val) => { metadata.startDate = val; });
    title = this.extractDateField(title, COMPLETED_DATE_REGEX, (val) => { metadata.completedDate = val; });

    // Extract priority
    title = this.extractPriority(title, metadata);

    // Extract tags (emoji format first, then hashtags)
    title = this.extractTags(title, metadata);

    // Extract recurrence
    title = this.extractRecurrence(title, metadata);

    // Extract group
    title = this.extractField(title, GROUP_REGEX, (val) => { metadata.group = val; });

    // Extract duration
    title = this.extractField(title, DURATION_REGEX, (val) => { metadata.duration = parseInt(val, 10); });

    // Clean up title - normalize whitespace
    title = title.replace(/\s+/g, " ").trim();

    return { title, metadata };
  }

  /**
   * Extract a date field from content and store in metadata
   */
  private static extractDateField(content: string, regex: RegExp, setter: (value: string) => void): string {
    const match = content.match(regex);
    if (match) {
      setter(match[1]);
      return content.replace(match[0], "").trim();
    }
    return content;
  }

  /**
   * Extract priority from content
   */
  private static extractPriority(content: string, metadata: TaskMetadata): string {
    const match = content.match(PRIORITY_REGEX);
    if (match) {
      const priorityMap: Record<string, TaskPriority> = {
        "⏫": TaskPriority.Urgent,
        "🔼": TaskPriority.High,
        "🔽": TaskPriority.Low,
      };
      metadata.priority = priorityMap[match[1]];
      return content.replace(match[0], "").trim();
    }
    return content;
  }

  /**
   * Extract tags from content (both emoji and hashtag formats)
   */
  private static extractTags(content: string, metadata: TaskMetadata): string {
    // Extract emoji tags: 🏷️tag1,tag2
    const tagEmojiMatch = content.match(TAG_EMOJI_REGEX);
    if (tagEmojiMatch) {
      metadata.tags = tagEmojiMatch[1].split(",").map((t) => t.trim()).filter(Boolean);
      content = content.replace(tagEmojiMatch[0], "").trim();
    }

    // Extract inline hashtags as tags
    const hashtagMatches = content.match(HASHTAG_REGEX);
    if (hashtagMatches) {
      const hashTags = hashtagMatches.map((m) => m.slice(1)).filter(Boolean);
      metadata.tags.push(...hashTags);
      content = content.replace(/#\S+/g, "").trim();
    }

    return content;
  }

  /**
   * Extract recurrence rule from content
   */
  private static extractRecurrence(content: string, metadata: TaskMetadata): string {
    const match = content.match(REPEAT_REGEX);
    if (match) {
      const rruleStr = match[2].trim();
      const fullRrule = rruleStr.startsWith("RRULE:") ? rruleStr : `RRULE:${rruleStr}`;
      const repeat = RRuleParser.fromRRule(fullRrule);
      if (repeat) {
        metadata.repeat = repeat;
      }
      return content.replace(match[0], "").trim();
    }
    return content;
  }

  /**
   * Generic field extractor using regex
   */
  private static extractField(content: string, regex: RegExp, setter: (value: string) => void): string {
    const match = content.match(regex);
    if (match) {
      setter(match[1]);
      return content.replace(match[0], "").trim();
    }
    return content;
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
   * Uses a single-pass predicate approach to avoid creating intermediate arrays
   */
  static filterTasks(tasks: Task[], params: CodeBlockParams): Task[] {
    // Pre-compute filter values to avoid repeated work
    const dateRange = params.dateRange ? this.parseDateRange(params.dateRange) : null;
    const filterLower = params.filter?.toLowerCase();
    const groupsSet = params.groups?.length ? new Set(params.groups) : null;
    const tagsSet = params.tags?.length ? new Set(params.tags) : null;

    // Single-pass filtering with combined predicate
    const filtered = tasks.filter((t) => {
      // Status filters
      if (!params.showCompleted && t.status === TaskStatus.Completed) return false;
      if (!params.showCancelled && t.status === TaskStatus.Cancelled) return false;

      // Group filter
      if (groupsSet && (!t.group || !groupsSet.has(t.group))) return false;

      // Tag filter
      if (tagsSet && !t.tags.some((tag) => tagsSet.has(tag))) return false;

      // Date range filter
      if (dateRange) {
        if (!t.dueDate) return false;
        const dueDate = t.dueDate.split(" ")[0];
        if (dueDate < dateRange.start || dueDate > dateRange.end) return false;
      }

      // Text search filter
      if (filterLower) {
        const matchesTitle = t.title.toLowerCase().includes(filterLower);
        const matchesTags = t.tags.some((tag) => tag.toLowerCase().includes(filterLower));
        const matchesGroup = t.group?.toLowerCase().includes(filterLower);
        if (!matchesTitle && !matchesTags && !matchesGroup) return false;
      }

      return true;
    });

    // Apply limit
    return params.limit && params.limit > 0 ? filtered.slice(0, params.limit) : filtered;
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
   * Only generates ghosts for pending/in-progress tasks with valid recurrence rules
   */
  static generateRecurringOccurrences(
    tasks: Task[],
    rangeStart: string,
    rangeEnd: string
  ): Task[] {
    const ghosts: Task[] = [];

    // Filter to only active tasks (pending or in-progress) with recurrence
    const activeTasks = tasks.filter(
      (task) =>
        task.repeat &&
        !task.repeatParentId &&
        task.status < TaskStatus.Completed && // Use enum instead of magic number 2
        task.dueDate
    );

    for (const task of activeTasks) {
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
        ghosts.push(this.createGhostTask(occ, task));
      }
    }

    return ghosts;
  }

  /**
   * Create a ghost task for a recurring occurrence
   */
  private static createGhostTask(
    occ: {
      id?: string;
      filePath?: string;
      title?: string;
      dueDate?: string;
      startDate?: string;
      duration?: number;
      priority?: TaskPriority;
      status?: TaskStatus;
      isAllDay?: boolean;
      tags?: string[];
      group?: string;
      repeat?: RepeatConfig;
      repeatParentId?: string;
    },
    parentTask: Task
  ): Task {
    return {
      id: occ.id ?? "",
      filePath: occ.filePath ?? "",
      line: -1, // Ghost tasks don't have a real line number
      title: occ.title ?? "",
      status: TaskStatus.Pending,
      priority: occ.priority ?? TaskPriority.None,
      tags: occ.tags ?? [],
      dueDate: occ.dueDate ?? "",
      startDate: occ.startDate,
      duration: occ.duration,
      isAllDay: occ.isAllDay ?? true,
      repeat: parentTask.repeat,
      repeatParentId: parentTask.id,
      group: occ.group,
      isGhost: true,
    };
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