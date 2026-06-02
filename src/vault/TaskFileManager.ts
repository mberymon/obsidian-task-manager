import { App, TFile, normalizePath } from "obsidian";
import { Task, TaskStatus, TaskPriority, RepeatConfig } from "../types";
import { TaskManager } from "../tasks/TaskManager";
import { FrontmatterParser } from "./FrontmatterParser";

/**
 * TaskFileManager - Handles reading and writing tasks to markdown files in the vault
 */
export class TaskFileManager {
  private app: App;
  private taskFolderPath: string;

  constructor(app: App, taskFolderPath: string) {
    this.app = app;
    this.taskFolderPath = normalizePath(taskFolderPath);
  }

  /**
   * Read all tasks from the task folder
   */
  async readAllTasks(): Promise<Task[]> {
    const tasks: Task[] = [];
    const taskFolder = this.app.vault.getAbstractFileByPath(this.taskFolderPath);

    if (!taskFolder) {
      // Try to create the folder if it doesn't exist
      try {
        await this.app.vault.createFolder(this.taskFolderPath);
      } catch {
        return tasks;
      }
    }

    // Get all markdown files in the task folder
    const files = this.app.vault.getMarkdownFiles();
    const taskFiles = files.filter((f) => f.path.startsWith(this.taskFolderPath));

    for (const file of taskFiles) {
      const fileTasks = await this.readTasksFromFile(file);
      tasks.push(...fileTasks);
    }

    return tasks;
  }

  /**
   * Read tasks from a specific markdown file
   */
  async readTasksFromFile(file: TFile): Promise<Task[]> {
    const content = await this.app.vault.read(file);
    const { content: bodyContent } = FrontmatterParser.parse(content);
    const lines = bodyContent.split("\n");
    const tasks: Task[] = [];

    for (let i = 0; i < lines.length; i++) {
      const task = TaskManager.parseTaskLine(lines[i], file.path, i);
      if (task) {
        tasks.push(task);
      }
    }

    return tasks;
  }

  /**
   * Create a new task in a file
   */
  async createTask(task: Omit<Task, "id" | "filePath" | "line">): Promise<Task | null> {
    const targetFile = await this.getTargetFile(task.group);
    if (!targetFile) return null;

    const content = await this.app.vault.read(targetFile);
    const { frontmatter, content: bodyContent } = FrontmatterParser.parse(content);
    const lines = bodyContent.split("\n");

    // Find the line number to insert (after frontmatter if present)
    const insertLine = lines.length > 0 && lines[lines.length - 1].trim() === ""
      ? lines.length - 1
      : lines.length;

    const taskLine = TaskManager.serializeTask({
      ...task,
      id: "",
      filePath: targetFile.path,
      line: insertLine,
    });

    // Insert the task
    lines.splice(insertLine, 0, taskLine);
    const newContent = Object.keys(frontmatter).length > 0
      ? `${FrontmatterParser.stringify(frontmatter)}\n\n${lines.join("\n")}`
      : lines.join("\n");

    await this.app.vault.modify(targetFile, newContent);

    return {
      ...task,
      id: `${targetFile.path}:${insertLine}`,
      filePath: targetFile.path,
      line: insertLine,
    };
  }

  /**
   * Update an existing task
   */
  async updateTask(task: Task): Promise<boolean> {
    const file = this.app.vault.getAbstractFileByPath(task.filePath) as TFile;
    if (!file) return false;

    const content = await this.app.vault.read(file);
    const { frontmatter, content: bodyContent } = FrontmatterParser.parse(content);
    const lines = bodyContent.split("\n");

    if (task.line < 0 || task.line >= lines.length) return false;

    lines[task.line] = TaskManager.serializeTask(task);
    const newContent = Object.keys(frontmatter).length > 0
      ? `${FrontmatterParser.stringify(frontmatter)}\n\n${lines.join("\n")}`
      : lines.join("\n");

    await this.app.vault.modify(file, newContent);
    return true;
  }

  /**
   * Delete a task
   */
  async deleteTask(task: Task): Promise<boolean> {
    const file = this.app.vault.getAbstractFileByPath(task.filePath) as TFile;
    if (!file) return false;

    const content = await this.app.vault.read(file);
    const { frontmatter, content: bodyContent } = FrontmatterParser.parse(content);
    const lines = bodyContent.split("\n");

    if (task.line < 0 || task.line >= lines.length) return false;

    lines.splice(task.line, 1);
    const newContent = Object.keys(frontmatter).length > 0
      ? `${FrontmatterParser.stringify(frontmatter)}\n\n${lines.join("\n")}`
      : lines.join("\n");

    await this.app.vault.modify(file, newContent);
    return true;
  }

  /**
   * Toggle task status (pending -> in-progress -> completed)
   */
  async toggleTaskStatus(task: Task): Promise<boolean> {
    let newStatus: TaskStatus;

    switch (task.status) {
      case TaskStatus.Pending:
        newStatus = TaskStatus.InProgress;
        break;
      case TaskStatus.InProgress:
        newStatus = TaskStatus.Completed;
        break;
      case TaskStatus.Completed:
        newStatus = TaskStatus.Pending;
        break;
      default:
        newStatus = TaskStatus.Pending;
    }

    const updatedTask = { ...task, status: newStatus };

    if (newStatus === TaskStatus.Completed) {
      const today = new Date();
      updatedTask.completedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    } else {
      updatedTask.completedDate = undefined;
    }

    return this.updateTask(updatedTask);
  }

  /**
   * Get or create the target file for a task
   */
  private async getTargetFile(group?: string): Promise<TFile | null> {
    let targetPath: string;

    if (group) {
      targetPath = normalizePath(`${this.taskFolderPath}/${group}.md`);
    } else {
      targetPath = normalizePath(`${this.taskFolderPath}/tasks.md`);
    }

    let file = this.app.vault.getAbstractFileByPath(targetPath) as TFile;

    if (!file) {
      try {
        const content = "";
        await this.app.vault.create(targetPath, content);
        file = this.app.vault.getAbstractFileByPath(targetPath) as TFile;
      } catch {
        return null;
      }
    }

    return file;
  }

  /**
   * Get all unique group names from tasks
   */
  async getGroupNames(): Promise<string[]> {
    const tasks = await this.readAllTasks();
    const groups = new Set<string>();

    for (const task of tasks) {
      if (task.group) {
        groups.add(task.group);
      }
    }

    // Also check for files in the task folder
    const files = this.app.vault.getMarkdownFiles();
    for (const file of files) {
      if (file.path.startsWith(this.taskFolderPath) && file.path !== this.taskFolderPath) {
        const fileName = file.basename;
        if (fileName !== "tasks") {
          groups.add(fileName);
        }
      }
    }

    return Array.from(groups).sort();
  }

  /**
   * Get all unique tags from tasks
   */
  async getTagNames(): Promise<string[]> {
    const tasks = await this.readAllTasks();
    const tags = new Set<string>();

    for (const task of tasks) {
      for (const tag of task.tags) {
        tags.add(tag);
      }
    }

    return Array.from(tags).sort();
  }
}