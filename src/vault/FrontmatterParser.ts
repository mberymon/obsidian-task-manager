import { RepeatConfig } from "../types";
import { RRuleParser } from "../tasks/RRuleParser";

/**
 * FrontmatterParser - Parses YAML frontmatter from markdown files
 */
export class FrontmatterParser {
  /**
   * Parse frontmatter from markdown content
   * Returns { frontmatter, content } where content is the markdown without frontmatter
   */
  static parse(content: string): {
    frontmatter: Record<string, unknown>;
    content: string;
  } {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return { frontmatter: {}, content };
    }

    const frontmatterStr = match[1];
    const remainingContent = content.slice(match[0].length).trimStart();

    return {
      frontmatter: this.parseYaml(frontmatterStr),
      content: remainingContent,
    };
  }

  /**
   * Simple YAML parser (handles basic key-value, arrays, and nested objects)
   */
  private static parseYaml(yaml: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = yaml.split("\n");
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      i++;

      // Skip empty lines and comments
      if (!line.trim() || line.trim().startsWith("#")) continue;

      // Parse top-level key:value
      const colonIdx = line.indexOf(":");
      if (colonIdx <= 0) continue;

      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();

      if (value !== "") {
        result[key] = this.parseYamlValue(value);
        continue;
      }

      // Value is empty - could be array or nested object
      // Collect indented lines
      const indentedLines: string[] = [];
      while (i < lines.length) {
        const nextLine = lines[i];
        if (nextLine.startsWith("  ") && nextLine.trim()) {
          indentedLines.push(nextLine);
          i++;
        } else {
          break;
        }
      }

      if (indentedLines.length === 0) {
        result[key] = "";
        continue;
      }

      // Check if it's an array (all lines start with "  - ")
      if (indentedLines.every((l) => l.trimStart().startsWith("- "))) {
        result[key] = indentedLines.map((l) => this.parseYamlValue(l.trimStart().slice(2).trim()));
      } else {
        // It's a nested object
        const obj: Record<string, unknown> = {};
        for (const indentedLine of indentedLines) {
          const innerColonIdx = indentedLine.indexOf(":");
          if (innerColonIdx > 0) {
            const innerKey = indentedLine.slice(2, innerColonIdx).trim();
            const innerValue = indentedLine.slice(innerColonIdx + 1).trim();
            obj[innerKey] = this.parseYamlValue(innerValue);
          }
        }
        result[key] = obj;
      }
    }

    return result;
  }

  /**
   * Parse a YAML value string into appropriate type
   */
  private static parseYamlValue(value: string): unknown {
    if (!value) return "";

    // Remove quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }

    // Boolean
    if (value === "true") return true;
    if (value === "false") return false;

    // Null
    if (value === "null" || value === "~") return null;

    // Number
    const num = Number(value);
    if (!isNaN(num) && value !== "") return num;

    return value;
  }

  /**
   * Extract task-related frontmatter fields
   */
  static extractTaskFields(frontmatter: Record<string, unknown>): {
    group?: string;
    tags?: string[];
    dueDate?: string;
    startDate?: string;
    repeat?: RepeatConfig;
    duration?: number;
    isAllDay?: boolean;
  } {
    const fields: Record<string, unknown> = {};

    if (typeof frontmatter.group === "string") {
      fields.group = frontmatter.group;
    }

    if (Array.isArray(frontmatter.tags)) {
      fields.tags = frontmatter.tags.map(String);
    } else if (typeof frontmatter.tags === "string") {
      fields.tags = frontmatter.tags.split(",").map((t) => t.trim());
    }

    if (typeof frontmatter.due === "string") {
      fields.dueDate = frontmatter.due;
    } else if (typeof frontmatter.dueDate === "string") {
      fields.dueDate = frontmatter.dueDate;
    }

    if (typeof frontmatter.start === "string") {
      fields.startDate = frontmatter.start;
    } else if (typeof frontmatter.startDate === "string") {
      fields.startDate = frontmatter.startDate;
    }

    if (typeof frontmatter.repeat === "string") {
      fields.repeat = RRuleParser.fromRRule(frontmatter.repeat);
    }

    if (typeof frontmatter.duration === "number") {
      fields.duration = frontmatter.duration;
    }

    if (typeof frontmatter.allDay === "boolean") {
      fields.isAllDay = frontmatter.allDay;
    }

    return fields as Record<string, unknown> as {
      group?: string;
      tags?: string[];
      dueDate?: string;
      startDate?: string;
      repeat?: RepeatConfig;
      duration?: number;
      isAllDay?: boolean;
    };
  }

  /**
   * Serialize frontmatter back to YAML string
   */
  static stringify(frontmatter: Record<string, unknown>): string {
    const lines = ["---"];

    for (const [key, value] of Object.entries(frontmatter)) {
      if (value === undefined || value === null) continue;

      if (Array.isArray(value)) {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - ${this.stringifyYamlValue(item)}`);
        }
      } else {
        lines.push(`${key}: ${this.stringifyYamlValue(value)}`);
      }
    }

    lines.push("---");
    return lines.join("\n");
  }

  /**
   * Stringify a single YAML value
   */
  private static stringifyYamlValue(value: unknown): string {
    if (typeof value === "string") {
      // Quote strings with special characters
      if (value.includes(":") || value.includes("#") || value.includes(",") ||
          value.includes("'") || value.includes('"')) {
        return `"${value.replace(/"/g, '\\"')}"`;
      }
      return value;
    }
    return String(value);
  }
}