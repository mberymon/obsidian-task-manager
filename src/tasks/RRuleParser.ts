import { RepeatConfig } from "../types";

// RFC 2445 day codes to JS weekday indices
const RFC_DAY_TO_INDEX: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

const INDEX_TO_RFC_DAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/**
 * RRuleParser - Handles parsing and serialization of RRULE strings
 * and calculates next occurrences for recurring tasks.
 */
export class RRuleParser {
  /**
   * Parse an RRULE string into a RepeatConfig. Returns null on failure.
   */
  static fromRRule(rrule: string): RepeatConfig | null {
    const raw = rrule.replace(/^RRULE:/i, "").trim();
    const parts: Record<string, string> = {};

    for (const segment of raw.split(";")) {
      const eq = segment.indexOf("=");
      if (eq === -1) continue;
      parts[segment.slice(0, eq).toUpperCase()] = segment.slice(eq + 1);
    }

    const freqRaw = parts["FREQ"]?.toUpperCase();
    if (!freqRaw || !["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freqRaw)) {
      return null;
    }

    const freq = freqRaw as RepeatConfig["freq"];
    const config: RepeatConfig = {
      freq,
      interval: parts["INTERVAL"] ? parseInt(parts["INTERVAL"], 10) : 1,
    };

    if (parts["BYDAY"]) {
      config.byday = parts["BYDAY"].split(",").map((d) => d.trim().toUpperCase());
    }

    if (parts["BYMONTHDAY"]) {
      config.bymonthday = parts["BYMONTHDAY"].split(",").map(Number);
    }

    if (parts["BYSETPOS"]) {
      config.bysetpos = parts["BYSETPOS"].split(",").map(Number);
    }

    if (parts["COUNT"]) {
      config.count = parseInt(parts["COUNT"], 10);
    }

    if (parts["UNTIL"]) {
      const u = parts["UNTIL"].replace(/T.*$/, "");
      if (u.length === 8) {
        config.until = `${u.slice(0, 4)}-${u.slice(4, 6)}-${u.slice(6, 8)}`;
      } else {
        config.until = u;
      }
    }

    return config;
  }

  /**
   * Serialize a RepeatConfig to an RRULE string.
   */
  static toRRule(config: RepeatConfig): string {
    const parts = [`FREQ=${config.freq}`];

    if (config.interval && config.interval > 1) {
      parts.push(`INTERVAL=${config.interval}`);
    }

    if (config.byday && config.byday.length > 0) {
      parts.push(`BYDAY=${config.byday.join(",")}`);
    }

    if (config.bymonthday && config.bymonthday.length > 0) {
      parts.push(`BYMONTHDAY=${config.bymonthday.join(",")}`);
    }

    if (config.bysetpos && config.bysetpos.length > 0) {
      parts.push(`BYSETPOS=${config.bysetpos.join(",")}`);
    }

    if (config.count != null) {
      parts.push(`COUNT=${config.count}`);
    }

    if (config.until) {
      parts.push(`UNTIL=${config.until.replace(/-/g, "")}`);
    }

    return parts.join(";");
  }

  /**
   * Calculate the next due date after `currentDue`.
   * Returns null if the series has ended.
   */
  static calculateNextDate(currentDue: string, config: RepeatConfig): string | null {
    const base = new Date(currentDue + "T12:00:00Z");
    let next: Date;

    switch (config.freq) {
      case "DAILY":
        next = this.addDays(base, config.interval);
        break;
      case "WEEKLY":
        next = this.nextWeeklyDate(base, config);
        break;
      case "MONTHLY":
        next = this.nextMonthlyDate(base, config);
        break;
      case "YEARLY":
        next = new Date(base);
        next.setUTCFullYear(next.getUTCFullYear() + config.interval);
        break;
    }

    const nextStr = this.toDateStr(next);
    if (this.isSeriesEnded(config, nextStr)) return null;
    return nextStr;
  }

  /**
   * Returns true when the series should end at or before `candidateDue`.
   */
  static isSeriesEnded(config: RepeatConfig, candidateDue: string): boolean {
    if (config.count != null && config.count <= 1) return true;
    if (config.until && candidateDue > config.until) return true;
    return false;
  }

  /**
   * Returns a new RepeatConfig with count decremented by 1.
   * Returns undefined if the series would end (count hits 0).
   */
  static decrementCount(config: RepeatConfig): RepeatConfig | undefined {
    if (config.count == null) return config;
    const next = config.count - 1;
    if (next <= 0) return undefined;
    return { ...config, count: next };
  }

  /**
   * Generate read-only ghost occurrences for a recurring task within [rangeStart, rangeEnd].
   */
  static generateOccurrences(
    task: {
      id: string;
      filePath: string;
      title: string;
      dueDate?: string;
      startDate?: string;
      duration?: number;
      priority: number;
      status: number;
      isAllDay?: boolean;
      tags: string[];
      group?: string;
      repeat?: RepeatConfig;
      repeatParentId?: string;
    },
    rangeStart: string,
    rangeEnd: string,
    maxOccurrences = 200
  ): Array<Record<string, unknown>> {
    if (!task.repeat || task.repeatParentId || task.status >= 2 || !task.dueDate) {
      return [];
    }

    const ghosts: Array<Record<string, unknown>> = [];
    let config = { ...task.repeat };
    const baseDue = task.dueDate.split(" ")[0];
    const dueTimePart = task.dueDate.includes(" ") ? task.dueDate.split(" ")[1] : null;
    const baseStart = task.startDate?.split(" ")[0] ?? null;
    const startTimePart = task.startDate?.includes(" ") ? task.startDate.split(" ")[1] : null;

    let nextDue = this.calculateNextDate(baseDue, config);
    let iterations = 0;

    while (nextDue && nextDue <= rangeEnd && iterations < maxOccurrences) {
      iterations++;

      if (nextDue >= rangeStart) {
        let ghostStartDate: string | undefined;
        if (baseStart && startTimePart) {
          ghostStartDate = `${nextDue} ${startTimePart}`;
        } else if (baseStart) {
          ghostStartDate = nextDue;
        }

        ghosts.push({
          id: `ghost-${task.id}-${nextDue}`,
          filePath: task.filePath,
          title: task.title,
          dueDate: dueTimePart ? `${nextDue} ${dueTimePart}` : nextDue,
          startDate: ghostStartDate,
          duration: task.duration,
          priority: task.priority,
          status: 0,
          isAllDay: task.isAllDay,
          tags: task.tags,
          group: task.group,
          isGhost: true,
        });
      }

      if (config.count != null) {
        if (config.count <= 1) break;
        config = { ...config, count: config.count - 1 };
      }

      nextDue = this.calculateNextDate(nextDue, config);
    }

    return ghosts;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private static addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
  }

  private static nextWeeklyDate(base: Date, config: RepeatConfig): Date {
    if (!config.byday || config.byday.length === 0) {
      return this.addDays(base, 7 * config.interval);
    }

    const targetDays = new Set(
      config.byday.map((d) => RFC_DAY_TO_INDEX[d]).filter((n): n is number => n !== undefined)
    );
    const windowEnd = this.addDays(base, 7 * config.interval);
    let cursor = this.addDays(base, 1);

    while (cursor <= windowEnd) {
      if (targetDays.has(cursor.getUTCDay())) return cursor;
      cursor = this.addDays(cursor, 1);
    }

    return windowEnd;
  }

  private static nextMonthlyDate(base: Date, config: RepeatConfig): Date {
    const target = new Date(base);
    target.setUTCMonth(target.getUTCMonth() + config.interval);

    if (
      config.bysetpos &&
      config.bysetpos.length > 0 &&
      config.byday &&
      config.byday.length > 0
    ) {
      return this.nthWeekdayOfMonth(
        target.getUTCFullYear(),
        target.getUTCMonth(),
        config.byday[0],
        config.bysetpos[0]
      );
    }

    if (config.bymonthday && config.bymonthday.length > 0) {
      const day = config.bymonthday[0];
      const result = new Date(target);
      if (day < 0) {
        result.setUTCMonth(result.getUTCMonth() + 1, 0);
        result.setUTCDate(result.getUTCDate() + day + 1);
      } else {
        result.setUTCDate(day);
      }
      return result;
    }

    return target;
  }

  /**
   * Returns the date of the Nth occurrence of a weekday in a given month.
   */
  private static nthWeekdayOfMonth(
    year: number,
    month: number,
    byDay: string,
    bySetPos: number
  ): Date {
    const m = byDay.match(/^(-?\d+)?([A-Z]{2})$/);
    const dayCode = m ? m[2] : byDay;
    const embeddedPos = m && m[1] ? parseInt(m[1], 10) : null;
    const pos = embeddedPos != null ? embeddedPos : bySetPos;
    const targetWeekday = RFC_DAY_TO_INDEX[dayCode];

    if (targetWeekday === undefined) {
      return new Date(Date.UTC(year, month, 1, 12, 0, 0));
    }

    if (pos > 0) {
      const firstOfMonth = new Date(Date.UTC(year, month, 1, 12, 0, 0));
      let offset = (targetWeekday - firstOfMonth.getUTCDay() + 7) % 7;
      const firstOccurrence = new Date(firstOfMonth);
      firstOccurrence.setUTCDate(1 + offset);
      firstOccurrence.setUTCDate(firstOccurrence.getUTCDate() + (pos - 1) * 7);
      return firstOccurrence;
    } else {
      const lastOfMonth = new Date(Date.UTC(year, month + 1, 0, 12, 0, 0));
      let offset = (lastOfMonth.getUTCDay() - targetWeekday + 7) % 7;
      const lastOccurrence = new Date(lastOfMonth);
      lastOccurrence.setUTCDate(lastOfMonth.getUTCDate() - offset);
      lastOccurrence.setUTCDate(lastOccurrence.getUTCDate() + (pos + 1) * 7);
      return lastOccurrence;
    }
  }

  private static toDateStr(date: Date): string {
    const y = date.getUTCFullYear();
    const m = (date.getUTCMonth() + 1).toString().padStart(2, "0");
    const d = date.getUTCDate().toString().padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  /** Convert JS weekday index (0=Sun) to RFC day code */
  static indexToRfcDay(index: number): string {
    return INDEX_TO_RFC_DAY[index] ?? "SU";
  }

  /** Convert RFC day code to JS weekday index */
  static rfcDayToIndex(code: string): number {
    return RFC_DAY_TO_INDEX[code.toUpperCase()] ?? 0;
  }
}