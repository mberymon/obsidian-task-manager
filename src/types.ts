/**
 * Core types for the Obsidian Task Manager plugin
 */

// Task status enum
export enum TaskStatus {
  Pending = 0,
  InProgress = 1,
  Completed = 2,
  Cancelled = 3,
}

// Priority levels
export enum TaskPriority {
  Low = -1,
  None = 0,
  Medium = 1,
  High = 2,
  Urgent = 3,
}

// Repeat frequency
export type RepeatFreq = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

// Repeat configuration (simplified RRULE)
export interface RepeatConfig {
  freq: RepeatFreq;
  interval: number;
  byday?: string[]; // e.g., ["MO", "WE", "FR"]
  bymonthday?: number[]; // e.g., [1, 15] or [-1] for last day
  bysetpos?: number[]; // e.g., [1] for first, [-1] for last
  count?: number; // number of occurrences
  until?: string; // end date YYYY-MM-DD
}

// Task interface
export interface Task {
  id: string; // unique identifier (generated from file path + line number)
  filePath: string; // path to the markdown file
  line: number; // line number in the file
  title: string; // task title
  description?: string; // task description/body
  status: TaskStatus;
  priority: TaskPriority;
  tags: string[];
  dueDate?: string; // YYYY-MM-DD or YYYY-MM-DD HH:mm
  startDate?: string; // YYYY-MM-DD or YYYY-MM-DD HH:mm
  completedDate?: string; // YYYY-MM-DD
  duration?: number; // duration in minutes
  isAllDay?: boolean;
  repeat?: RepeatConfig;
  repeatParentId?: string; // for recurring task instances
  group?: string; // group/category name
  isGhost?: boolean; // ghost occurrence for recurring tasks
  content?: string; // raw markdown content
  frontmatter?: Record<string, unknown>; // frontmatter data
}

// View types
export type ViewType = "table" | "kanban" | "calendar";

// View configuration
export interface ViewConfig {
  type: ViewType;
  groupBy?: string; // field to group by (e.g., "status", "priority", "group")
  sortBy?: string; // field to sort by (e.g., "dueDate", "priority")
  sortOrder?: "asc" | "desc";
  filter?: string; // filter expression
  showCompleted?: boolean;
  showCancelled?: boolean;
  dateRange?: {
    start: string;
    end: string;
  };
}

// Plugin settings
export interface TaskManagerSettings {
  // Task file settings
  taskFolderPath: string; // folder for task files
  defaultTaskFile: string; // default file name for new tasks

  // View settings
  defaultView: ViewType;
  showCompletedByDefault: boolean;
  showCancelledByDefault: boolean;

  // Date/time settings
  dateFormat: string;
  timeFormat: string;
  use24HourTime: boolean;
  startOfWeek: number; // 0 = Sunday, 1 = Monday, etc.

  // Recurrence settings
  defaultRepeatFreq: RepeatFreq;
  defaultRepeatInterval: number;

  // Google Calendar integration (optional)
  enableGoogleCalendar: boolean;
  googleCalendarId?: string;

  // Task types
  taskTypes: TaskTypeConfig[];

  // Legacy settings (for migration)
  legacySettings?: Record<string, unknown>;
}

// Task type configuration
export interface TaskTypeConfig {
  name: string;
  icon?: string;
  color?: string;
  defaultStatus?: TaskStatus;
  defaultPriority?: TaskPriority;
}

// Code block parameters
export interface CodeBlockParams {
  view?: ViewType;
  groupBy?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filter?: string;
  showCompleted?: boolean;
  showCancelled?: boolean;
  dateRange?: string; // e.g., "today", "week", "month", "2024-01-01,2024-12-31"
  limit?: number;
  groups?: string[]; // specific groups to show
  tags?: string[]; // specific tags to filter
}

// Drag and drop state
export interface DragState {
  taskId: string;
  sourceGroup?: string;
  sourceStatus?: TaskStatus;
}

// Modal data for create/edit task
export interface TaskFormData {
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  tags: string[];
  dueDate?: string;
  dueTime?: string;
  startDate?: string;
  startTime?: string;
  duration?: number;
  isAllDay?: boolean;
  repeat?: RepeatConfig;
  group?: string;
  type?: string;
  content?: string;
  enableDateRange?: boolean;
}

// Calendar event for display
export interface CalendarEvent {
  task: Task;
  date: string;
  isStart: boolean;
  isEnd: boolean;
  isMultiDay: boolean;
}

// Kanban column
export interface KanbanColumn {
  id: string;
  title: string;
  tasks: Task[];
  color?: string;
}

// Table column
export interface TableColumn {
  id: string;
  title: string;
  sortable: boolean;
  width?: string;
  render?: (task: Task) => string;
}