# Changelog

## v0.0.3-dev - 2026-06-02

### 1. Table View UI Restored (`src/views/TableView.ts`)
- Toolbar with "Group by" dropdown (None, Status, Priority, Project, Tags)
- "Sort by" dropdown with sort order toggle (↑/↓)
- Filter input for text search
- Group sections with header showing group name, count, and progress bar
- Table rows with priority dots, title, due date (with time), priority icon, tags, project pill, and action buttons
- Completed/cancelled row styling with strikethrough

### 2. Kanban View UI Restored (`src/views/KanbanView.ts`)
- Header with board title, sort dropdown, and toggle completed button
- Column-based layout (To Do, In Progress, Done)
- Cards with priority dots, title, due date (with time), project pill, tags
- Priority border coloring (urgent=red, high=orange)
- Action buttons (Start, Complete, Reopen) per column

### 3. Calendar View Modes Restored (`src/views/CalendarView.ts`)
- **Month**: Grid with weekday headers, day cells with chips, add button on hover
- **Week**: Time-based columns with hour labels, all-day row, timeline positioning for timed tasks
- **3 Day**: Compact 3-day version of week view
- **Day**: Single day timeline with hour gutter
- **Agenda**: Grouped by date list with dots and times
- **List**: Collapsible cards by date with checkboxes, overdue section
- Navigation: prev/next/today buttons, mode toggle buttons (M/W/3/D/A/L)

### 4. CSS Restored (`styles.css`)
- All original class names and styling patterns from `styles.css.original`
- Calendar navigation, mode buttons, chips, week/day views, agenda, list
- Table toolbar, group headers, progress bars, row styling, priority dots
- Kanban container, header, columns, cards, dots, meta, actions
- Modal styles preserved exactly as they were (no changes to working task dialog)

### 5. ViewRenderer Updated
- All views now receive `onTaskCreate` callback for creating new tasks