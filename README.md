Obsidian Task Manager Plugin 

[![Obsidian Plugin Audit](https://img.shields.io/endpoint?url=https%3A%2F%2Fapi.obsidianpluginaudit.com%2Fbadge%2Fobsidian-task-manager%2Flatest.json%3Fversion%3D1.0.0&cacheSeconds=60)](https://obsidianpluginaudit.com/audit/obsidian-task-manager/latest)

![Obsidian Task Manager](./images/obsidian-task-manager-plugin.png)

Manage Tasks in Obsidian with ease and integrate with Google Calendar for full task and event management. Keep your tasks and events local and private, but sync them to your Google Calendar for easy access and notifications. Your tasks and events are synced in real-time.

Original plugin's author, Antone Heyward: [Buying me a coffee](https://buymeacoffee.com/antoneheyward) [ProductiveMatters.com](https://productivematters.com)

## Installation

Step 1: Install BRAT

1. Open Obsidian and go to **Settings** > **Community plugins**.
2. Click **Turn on community plugins** (and ensure **Restricted mode** is disabled).
3. Click **Browse** and search for **"BRAT"**.
4. Click **Install** and then **Enable**. 

Step 2: Install a Obsidian Task Manager Plugin

1. Get the GitHub repository URL: https://github.com/mberymon/obsidian-task-manager
2. Go to Obsidian **Settings** and scroll down to the **BRAT** section in your sidebar.
3. Click **Add Beta plugin**.
4. Paste the copied GitHub link, select the latest version, and click **Add Plugin**.
5. Go back to **Settings** > **Community plugins**, scroll down to find the newly installed plugin, and make sure it's **Toggled On**
6. Watch this video if you need instruction on how to setup Google Calendar integration. [Configure integration with Google Calendar](https://youtu.be/BW2TJp9wV9k)

## Usage

### Creating Tasks

1. Click the **check-square** ribbon icon to create a new task
2. Use the command palette: `Task Manager: Create new task`
3. Or write tasks directly in markdown:

```markdown
- [ ] My task 📅2024-01-15 ⏫ 🏷️work
```

### Viewing Tasks

Use code blocks to display tasks in different views:

#### Table View (default)

````markdown
```task-manager
view: table
sortBy: dueDate
```
````

#### Kanban View

````markdown
```task-manager
view: kanban
```
````

#### Calendar View

````markdown
```task-manager
view: calendar
dateRange: month
```
````

### Task Format

| Field | Emoji | Example |
|-------|-------|---------|
| Due Date | 📅 | `📅2024-01-15` |
| Start Date | ⏳ | `⏳2024-01-10` |
| Priority | ⏫🔼🔽 | `⏫` (urgent) |
| Tags | 🏷️ | `🏷️work,urgent` |
| Group | 📁 | `📁Inbox` |
| Duration | ⏱️ | `⏱️30` |
| Recurrence | 🔁 | `🔁FREQ=WEEKLY;BYDAY=MO` |

### Commands

- **Task Manager: Create new task** - Open the create task modal
- **Task Manager: Toggle task status** - Toggle checkbox on current line

### Settings

Configure the plugin in Obsidian Settings > Task Manager:

- Task folder location
- Default view type
- Show completed/cancelled tasks
- Date format
- Google Calendar integration
