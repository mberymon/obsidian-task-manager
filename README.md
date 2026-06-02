# Obsidian Task Views Plugin

Manage tasks in Obsidian with a clean, modern interface. Organize tasks by project, set priorities, add tags, and view them in table, kanban, or calendar views.

Based on this original plugin: https://github.com/antoneheyward/obsidian-task-manager

by Antone Heyward: [Buying me a coffee](https://buymeacoffee.com/antoneheyward) | [ProductiveMatters.com](https://productivematters.com)

## Installation

### Step 1: Install BRAT

1. Open Obsidian and go to **Settings** > **Community plugins**.
2. Click **Turn on community plugins** (and ensure **Restricted mode** is disabled).
3. Click **Browse** and search for **"BRAT"**.
4. Click **Install** and then **Enable**.

### Step 2: Install Obsidian Task Views Plugin

1. Get the GitHub repository URL: https://github.com/mberymon/obsidian-task-views
2. Go to Obsidian **Settings** and scroll down to the **BRAT** section in your sidebar.
3. Click **Add Beta plugin**.
4. Paste the copied GitHub link, select the latest version, and click **Add Plugin**.
5. Go back to **Settings** > **Community plugins**, scroll down to find the newly installed plugin, and make sure it's **Toggled On**

## Usage

### Creating Tasks

1. Click the **check-square** ribbon icon to create a new task
2. Use the command palette: `Task Manager: Create new task`
3. Or write tasks directly in markdown:

```markdown
- [ ] My task 📅2024-01-15 ⏫ 🏷️work 📁Inbox
```

### Task Format

| Field | Emoji | Example |
|-------|-------|---------|
| Due Date | 📅 | `📅2024-01-15` or `📅2024-01-15 14:30` |
| Start Date | ⏳ | `⏳2024-01-10` |
| Priority | ⏫🔼🔽 | `⏫` (urgent) |
| Tags | 🏷️ | `🏷️work,urgent` or `#work #urgent` |
| Project | 📁 | `📁Inbox` |
| Duration | ⏱️ | `⏱️30` |
| Recurrence | 🔁 | `🔁FREQ=WEEKLY;BYDAY=MO` |

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
calendarMode: month
```
````

### Calendar View Modes

The calendar view supports multiple display modes:

| Mode | Description |
|------|-------------|
| `month` | Full month grid |
| `week` | 7-day week view |
| `3day` | 3-day compact view |
| `day` | Single day view |
| `agenda` | Upcoming events list |
| `list` | Flat task list |

### Commands

- **Task Manager: Create new task** - Open the create task modal
- **Task Manager: Toggle task status** - Toggle checkbox on current line

### Settings

Configure the plugin in Obsidian Settings > Task Views:

- Task folder location
- Default view type
- Default calendar view mode
- Default project for new tasks
- Show completed/cancelled tasks
- Date format
- Start of week
- Default repeat frequency

### Create Task Modal Features

The task creation modal includes:

- **Date shortcuts**: Quick buttons for Today, Tomorrow, Next Week, Next Month
- **Project dropdown**: Select or type a new project name (default: "Inbox")
- **Type dropdown**: Choose task type (task, event, note)
- **Multi-select Tags**: Add multiple tags with autocomplete and pill removal
- **All Day toggle**: Hide/show time inputs for specific scheduling
- **Priority pills**: Low → None → Medium → High → Urgent
- **Recurrence panel**: Set up recurring tasks with flexible options
- **Clearable inputs**: X button to quickly clear any field