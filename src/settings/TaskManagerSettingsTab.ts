import { App, PluginSettingTab, Setting } from "obsidian";
import { TaskManagerPlugin } from "../main";
import { ViewType, RepeatFreq } from "../types";

/**
 * TaskManagerSettingsTab - Settings UI for the plugin
 */
export class TaskManagerSettingsTab extends PluginSettingTab {
  private plugin: TaskManagerPlugin;

  constructor(app: App, plugin: TaskManagerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // Task folder setting
    new Setting(containerEl)
      .setName("Task folder")
      .setDesc("Folder where task files are stored")
      .addText((text) =>
        text
          .setPlaceholder("tasks")
          .setValue(this.plugin.settings.taskFolderPath)
          .onChange(async (value) => {
            this.plugin.settings.taskFolderPath = value || "tasks";
            await this.plugin.saveSettings();
          })
      );

    // Default view
    new Setting(containerEl)
      .setName("Default view")
      .setDesc("Default view type for task blocks")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("table", "Table")
          .addOption("kanban", "Kanban")
          .addOption("calendar", "Calendar")
          .setValue(this.plugin.settings.defaultView)
          .onChange(async (value) => {
            this.plugin.settings.defaultView = value as ViewType;
            await this.plugin.saveSettings();
          })
      );

    // Show completed tasks
    new Setting(containerEl)
      .setName("Show completed tasks")
      .setDesc("Include completed tasks in views by default")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showCompletedByDefault)
          .onChange(async (value) => {
            this.plugin.settings.showCompletedByDefault = value;
            await this.plugin.saveSettings();
          })
      );

    // Show cancelled tasks
    new Setting(containerEl)
      .setName("Show cancelled tasks")
      .setDesc("Include cancelled tasks in views by default")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showCancelledByDefault)
          .onChange(async (value) => {
            this.plugin.settings.showCancelledByDefault = value;
            await this.plugin.saveSettings();
          })
      );

    // Date format
    new Setting(containerEl)
      .setName("Date format")
      .setDesc("Format for displaying dates")
      .addText((text) =>
        text
          .setPlaceholder("YYYY-MM-DD")
          .setValue(this.plugin.settings.dateFormat)
          .onChange(async (value) => {
            this.plugin.settings.dateFormat = value || "YYYY-MM-DD";
            await this.plugin.saveSettings();
          })
      );

    // Start of week
    new Setting(containerEl)
      .setName("Start of week")
      .setDesc("First day of the week (0 = Sunday, 1 = Monday)")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("0", "Sunday")
          .addOption("1", "Monday")
          .setValue(String(this.plugin.settings.startOfWeek))
          .onChange(async (value) => {
            this.plugin.settings.startOfWeek = parseInt(value, 10);
            await this.plugin.saveSettings();
          })
      );

    // Default repeat frequency
    new Setting(containerEl)
      .setName("Default repeat frequency")
      .setDesc("Default frequency for recurring tasks")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("DAILY", "Daily")
          .addOption("WEEKLY", "Weekly")
          .addOption("MONTHLY", "Monthly")
          .addOption("YEARLY", "Yearly")
          .setValue(this.plugin.settings.defaultRepeatFreq)
          .onChange(async (value) => {
            this.plugin.settings.defaultRepeatFreq = value as RepeatFreq;
            await this.plugin.saveSettings();
          })
      );

    // Default calendar view
    new Setting(containerEl)
      .setName("Default calendar view")
      .setDesc("Default view mode for calendar blocks")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("month", "Month")
          .addOption("week", "Week")
          .addOption("3day", "3 Day")
          .addOption("day", "Day")
          .addOption("agenda", "Agenda")
          .addOption("list", "List")
          .setValue(this.plugin.settings.defaultCalendarView)
          .onChange(async (value) => {
            this.plugin.settings.defaultCalendarView = value as any;
            await this.plugin.saveSettings();
          })
      );

    // Default project
    new Setting(containerEl)
      .setName("Default project")
      .setDesc("Default project for new tasks")
      .addText((text) =>
        text
          .setPlaceholder("Inbox")
          .setValue(this.plugin.settings.defaultProject)
          .onChange(async (value) => {
            this.plugin.settings.defaultProject = value || "Inbox";
            await this.plugin.saveSettings();
          })
      );

    // Reset settings
    new Setting(containerEl)
      .setName("Reset settings")
      .setDesc("Reset all settings to defaults")
      .addButton((button) =>
        button
          .setButtonText("Reset")
          .setWarning()
          .onClick(async () => {
            this.plugin.settings = this.plugin.getDefaultSettings();
            await this.plugin.saveSettings();
            this.display();
          })
      );
  }
}