# Task Format Reference

The Obsidian Task Manager plugin uses a simple markdown format for tasks with emoji-based metadata.

## Basic Task Format

```markdown
- [ ] Task title
```

## Status Indicators

| Status | Checkbox | Description |
|--------|----------|-------------|
| Pending | `- [ ]` | Task not started |
| In Progress | `- [>]` or `- [/]` | Task being worked on |
| Completed | `- [x]` | Task finished |
| Cancelled | `- [-]` | Task cancelled |

## Metadata Fields

### Due Date 📅

```markdown
- [ ] Task title 📅2024-01-15
- [ ] Task title 📅2024-01-15 14:30
```

Format: `YYYY-MM-DD` or `YYYY-MM-DD HH:mm`

### Start Date ⏳

```markdown
- [ ] Task title ⏳2024-01-10 📅2024-01-15
```

### Completed Date ✅

```markdown
- [x] Task title ✅2024-01-15
```

### Priority

| Priority | Emoji | Description |
|----------|-------|-------------|
| Urgent | ⏫ | Highest priority |
| High | 🔼 | High priority |
| Medium | (default) | Normal priority |
| Low | 🔽 | Low priority |

```markdown
- [ ] Task title ⏫
- [ ] Task title 🔼
- [ ] Task title 🔽
```

### Tags 🏷️

```markdown
- [ ] Task title 🏷️work,urgent
- [ ] Task title #work #urgent
```

### Group 📁

```markdown
- [ ] Task title 📁Inbox
```

### Duration ⏱️

```markdown
- [ ] Task title ⏱️30
```

Duration in minutes.

### Recurrence 🔁

```markdown
- [ ] Task title 🔁FREQ=WEEKLY;BYDAY=MO,WE,FR
- [ ] Task title 🔁RRULE:FREQ=DAILY;INTERVAL=2
- [ ] Task title 🔁FREQ=MONTHLY;BYMONTHDAY=15
- [ ] Task title 🔁FREQ=YEARLY
```

#### Recurrence Options

| Option | Description | Example |
|--------|-------------|---------|
| FREQ | Frequency: DAILY, WEEKLY, MONTHLY, YEARLY | `FREQ=WEEKLY` |
| INTERVAL | Repeat every N periods | `INTERVAL=2` |
| BYDAY | Days of week: SU,MO,TU,WE,TH,FR,SA | `BYDAY=MO,WE,FR` |
| BYMONTHDAY | Day of month (1-28, or -1 for last) | `BYMONTHDAY=15` |
| BYSETPOS | Nth occurrence (1=first, -1=last) | `BYSETPOS=1` |
| COUNT | Number of occurrences | `COUNT=10` |
| UNTIL | End date | `UNTIL=20241231` |

## Complete Example

```markdown
- [ ] Review quarterly report ⏳2024-01-10 📅2024-01-15 14:30 ⏫ 🏷️work,quarterly 📁Finance ⏱️60 🔁FREQ=MONTHLY;BYMONTHDAY=15
```

## Code Block Views

### Table View (default)

````markdown
```task-manager
view: table
sortBy: dueDate
sortOrder: asc
showCompleted: false
```
````

### Kanban View

````markdown
```task-manager
view: kanban
showCompleted: true
```
````

### Calendar View

````markdown
```task-manager
view: calendar
dateRange: month
```
````

### View Parameters

| Parameter | Values | Description |
|-----------|--------|-------------|
| view | table, kanban, calendar | View type |
| groupBy | status, priority, group, tags | Group tasks by field |
| sortBy | dueDate, startDate, priority, title, group, status | Sort by field |
| sortOrder | asc, desc | Sort order |
| filter | text | Filter by text |
| showCompleted | true, false | Show completed tasks |
| showCancelled | true, false | Show cancelled tasks |
| dateRange | today, tomorrow, week, month, YYYY-MM-DD,YYYY-MM-DD | Date range filter |
| limit | number | Maximum number of tasks |
| groups | group1,group2 | Filter by groups |
| tags | tag1,tag2 | Filter by tags |