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
    let currentKey: string | null = null;
    let currentArray: string[] | null = null;
    let currentObject: Record<string, unknown> | null = null;
    let objectKey: string | null = null;

    for (const line of lines) {
      // Skip empty lines and comments
      if (!line.trim() || line.trim().startsWith("#")) continue;

      // Check for array continuation (2 spaces + -)
      if (line.startsWith("  - ") && currentKey) {
        const value = line.slice(4).trim();
        if (currentArray) {
          currentArray.push(this.parseYamlValue(value));
        }
        continue;
      }

      // Check for nested object property (2 spaces + key:)
      if (line.startsWith("  ") && !line.startsWith("  - ") && currentKey && objectKey) {
        const colonIdx = line.indexOf(":");
        if (colonIdx > 0) {
          const key = line.slice(2, colonIdx).trim();
          const value = line.slice(colonIdx + 1).trim();
          if (currentObject) {
            currentObject[key] = this.parseYamlValue(value);
          }
        }
        continue;
      }

      // Reset array/object state if we're at a top-level key
      if (currentArray && !line.startsWith("  - ")) {
        result[currentKey!] = currentArray;
        currentArray = null;
      }
      if (currentObject && objectKey) {
        result[objectKey] = currentObject;
        currentObject = null;
        objectKey = null;
      }

      // Parse top-level key:value
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim();

        if (value === "") {
          // Could be start of array or nested object
          currentKey = key;
          // We'll determine type when we see the next line
        } else {
          result[key] = this.parseYamlValue(value);
          currentKey = null;
        }
      }
    }

    // Flush remaining state
    if (currentArray && currentKey) {
      result[currentKey] = currentArray;
    }
    if (currentObject && objectKey) {
      result[objectKey] = currentObject;
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