"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const i18n = {
  zh: {
    appName: "Jarvis 敏捷看板",
    project: "项目",
    board: "看板",
    newProject: "新建项目",
    newBoard: "新建看板",
    theme: "主题",
    light: "亮色",
    dark: "暗色",
    language: "语言",
    exportData: "导出",
    importData: "导入",
    copySummary: "复制摘要",
    syncBrief: "同步简报",
    activityLog: "协作日志",
    showActivity: "查看日志",
    filters: "筛选",
    search: "搜索",
    clearFilters: "清除",
    assigneeAll: "全部负责人",
    priorityAll: "全部优先级",
    dueAll: "全部时间",
    overdue: "已逾期",
    today: "今天",
    week: "7天内",
    exportSuccess: "已导出看板数据",
    importFailed: "导入失败，请检查文件格式",
    copySuccess: "已复制到剪贴板",
    syncCopied: "已复制同步简报",
    todo: "待办",
    inProgress: "进行中",
    review: "评审",
    done: "完成",
    addCard: "添加卡片",
    editCard: "编辑卡片",
    save: "保存",
    cancel: "取消",
    delete: "删除",
    title: "标题",
    description: "描述",
    assignee: "负责人",
    priority: "优先级",
    tags: "标签",
    dueDate: "截止日期",
    high: "高",
    medium: "中",
    low: "低",
    empty: "暂无卡片",
    stats: "健康度",
    total: "总数",
    doneCount: "完成",
    overdueCount: "逾期",
    activityEmpty: "暂无日志",
    created: "新建卡片",
    updated: "更新卡片",
    moved: "移动卡片",
    deleted: "删除卡片",
    imported: "导入数据",
    exported: "导出数据",
    risks: "风险",
    none: "暂无",
  },
  en: {
    appName: "Jarvis Kanban",
    project: "Project",
    board: "Board",
    newProject: "New Project",
    newBoard: "New Board",
    theme: "Theme",
    light: "Light",
    dark: "Dark",
    language: "Language",
    exportData: "Export",
    importData: "Import",
    copySummary: "Copy Summary",
    syncBrief: "Sync Brief",
    activityLog: "Activity",
    showActivity: "View Log",
    filters: "Filters",
    search: "Search",
    clearFilters: "Clear",
    assigneeAll: "All assignees",
    priorityAll: "All priorities",
    dueAll: "All dates",
    overdue: "Overdue",
    today: "Today",
    week: "Next 7 days",
    exportSuccess: "Board data exported",
    importFailed: "Import failed. Check the file format",
    copySuccess: "Copied to clipboard",
    syncCopied: "Sync brief copied",
    todo: "To Do",
    inProgress: "In Progress",
    review: "Review",
    done: "Done",
    addCard: "Add Card",
    editCard: "Edit Card",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    title: "Title",
    description: "Description",
    assignee: "Assignee",
    priority: "Priority",
    tags: "Tags",
    dueDate: "Due Date",
    high: "High",
    medium: "Medium",
    low: "Low",
    empty: "No cards",
    stats: "Health",
    total: "Total",
    doneCount: "Done",
    overdueCount: "Overdue",
    activityEmpty: "No activity yet",
    created: "Created card",
    updated: "Updated card",
    moved: "Moved card",
    deleted: "Deleted card",
    imported: "Imported data",
    exported: "Exported data",
    risks: "Risks",
    none: "None",
  },
} as const;

const assignees = ["Jarvis", "Ko先生"] as const;

type Lang = keyof typeof i18n;

type Task = {
  id: string;
  title: string;
  description: string;
  assignee: string;
  priority: "low" | "medium" | "high";
  tags: string[];
  dueDate: string;
};

type Column = {
  id: string;
  title: string;
  taskIds: string[];
};

type Board = {
  id: string;
  name: string;
  columns: Column[];
  tasks: Record<string, Task>;
};

type Project = {
  id: string;
  name: string;
  boards: Board[];
};

type Activity = {
  id: string;
  message: string;
  createdAt: number;
};

const defaultBoard = (lang: Lang): Board => {
  const t = i18n[lang];
  const task1: Task = {
    id: "task-1",
    title: "整理扩散模型论文清单",
    description: "优先CVPR/NeurIPS，标注代码与数据集",
    assignee: "Jarvis",
    priority: "high",
    tags: ["CV", "Diffusion"],
    dueDate: "",
  };
  const task2: Task = {
    id: "task-2",
    title: "看板UI交互验证",
    description: "确认拖拽与主题切换的体验",
    assignee: "Jarvis",
    priority: "medium",
    tags: ["Product"],
    dueDate: "",
  };

  return {
    id: "board-1",
    name: "Research Sprint",
    columns: [
      { id: "col-todo", title: t.todo, taskIds: [task1.id] },
      { id: "col-progress", title: t.inProgress, taskIds: [task2.id] },
      { id: "col-review", title: t.review, taskIds: [] },
      { id: "col-done", title: t.done, taskIds: [] },
    ],
    tasks: {
      [task1.id]: task1,
      [task2.id]: task2,
    },
  };
};

const defaultProject = (lang: Lang): Project => ({
  id: "project-1",
  name: "Jarvis Lab",
  boards: [defaultBoard(lang)],
});

const storageKey = "jarvis-kanban-state";
const themeKey = "jarvis-kanban-theme";
const langKey = "jarvis-kanban-lang";
const activityKey = "jarvis-kanban-activity";

const getId = () =>
  globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random()}`;

const parseDate = (value: string) => {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const startOfToday = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
};

type Draft = {
  id?: string;
  columnId: string;
  title: string;
  description: string;
  assignee: string;
  priority: "low" | "medium" | "high";
  tags: string;
  dueDate: string;
};

type Filters = {
  query: string;
  assignee: "all" | string;
  priority: "all" | Task["priority"];
  tag: string;
  due: "all" | "overdue" | "today" | "week";
};

function ColumnDroppable({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[120px] flex-col gap-3 rounded-2xl border border-slate-200 bg-white/80 p-3 transition dark:border-white/10 dark:bg-white/5 ${
        isOver ? "border-cyan-400/60 bg-cyan-500/10" : ""
      }`}
    >
      {children}
    </div>
  );
}

function TaskCard({
  task,
  onClick,
  isOverdue,
  overdueLabel,
}: {
  task: Task;
  onClick: () => void;
  isOverdue: boolean;
  overdueLabel: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityColor =
    task.priority === "high"
      ? "text-rose-600 bg-rose-100 border-rose-200 dark:text-rose-300 dark:bg-rose-500/10 dark:border-rose-400/30"
      : task.priority === "medium"
      ? "text-amber-600 bg-amber-100 border-amber-200 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-400/30"
      : "text-emerald-600 bg-emerald-100 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-400/30";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-grab rounded-xl border border-slate-200 bg-white p-3 text-sm text-black shadow-lg shadow-slate-200/60 transition active:cursor-grabbing dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100 dark:shadow-slate-950/30 ${
        isDragging ? "opacity-60" : "opacity-100"
      } ${isOverdue ? "ring-1 ring-rose-400/70" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-black dark:text-slate-100">
          {task.title}
        </h4>
        <div className="flex items-center gap-2">
          {isOverdue && (
            <span className="rounded-full border border-rose-400/60 bg-rose-500/10 px-2 py-0.5 text-[9px] uppercase text-rose-300">
              {overdueLabel}
            </span>
          )}
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${priorityColor}`}
          >
            {task.priority}
          </span>
        </div>
      </div>
      <p className="mt-2 text-xs text-black line-clamp-2 dark:text-slate-300">
        {task.description}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-black dark:text-slate-400">
        {task.assignee && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-white/10">
            {task.assignee}
          </span>
        )}
        {task.tags.map((tag) => (
          <span key={tag} className="rounded-full bg-cyan-500/10 px-2 py-0.5">
            #{tag}
          </span>
        ))}
        {task.dueDate && (
          <span className="rounded-full bg-indigo-500/10 px-2 py-0.5">
            {task.dueDate}
          </span>
        )}
      </div>
    </div>
  );
}

function OverlayCard({ task }: { task?: Task }) {
  if (!task) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/80 p-3 text-sm text-slate-100 shadow-lg">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">{task.title}</h4>
        <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] uppercase text-cyan-200">
          {task.priority}
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-300 line-clamp-2">
        {task.description}
      </p>
    </div>
  );
}

export default function Home() {
  const [lang, setLang] = useState<Lang>("zh");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [projects, setProjects] = useState<Project[]>([defaultProject("zh")]);
  const [activeProjectId, setActiveProjectId] = useState("project-1");
  const [activeBoardId, setActiveBoardId] = useState("board-1");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [filters, setFilters] = useState<Filters>({
    query: "",
    assignee: "all",
    priority: "all",
    tag: "",
    due: "all",
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const t = i18n[lang];

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem(storageKey);
    const savedLang = localStorage.getItem(langKey) as Lang | null;
    const savedTheme = localStorage.getItem(themeKey) as "dark" | "light" | null;
    const savedActivity = localStorage.getItem(activityKey);
    if (savedLang) setLang(savedLang);
    if (savedTheme) setTheme(savedTheme);
    if (savedActivity) {
      try {
        setActivities(JSON.parse(savedActivity) as Activity[]);
      } catch {
        setActivities([]);
      }
    }
    if (saved) {
      const parsed = JSON.parse(saved) as {
        projects: Project[];
        activeProjectId: string;
        activeBoardId: string;
      };
      setProjects(parsed.projects);
      setActiveProjectId(parsed.activeProjectId);
      setActiveBoardId(parsed.activeBoardId);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(themeKey, theme);
    document.documentElement.style.colorScheme = theme;
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(langKey, lang);
  }, [lang]);

  useEffect(() => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ projects, activeProjectId, activeBoardId })
    );
  }, [projects, activeProjectId, activeBoardId]);

  useEffect(() => {
    localStorage.setItem(activityKey, JSON.stringify(activities));
  }, [activities]);

  useEffect(() => {
    const project = projects.find((p) => p.id === activeProjectId) ?? projects[0];
    if (!project) return;
    if (!project.boards.find((b) => b.id === activeBoardId)) {
      setActiveBoardId(project.boards[0]?.id ?? "");
    }
  }, [activeProjectId, activeBoardId, projects]);

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? projects[0];
  const activeBoard = useMemo(
    () => activeProject.boards.find((b) => b.id === activeBoardId) ?? activeProject.boards[0],
    [activeProject, activeBoardId]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const findColumnByTask = (taskId: string) =>
    activeBoard.columns.find((col) => col.taskIds.includes(taskId));

  const getColumnById = (columnId: string) =>
    activeBoard.columns.find((col) => col.id === columnId);

  const updateBoard = (updater: (board: Board) => Board) => {
    setProjects((prev) =>
      prev.map((project) => {
        if (project.id !== activeProjectId) return project;
        return {
          ...project,
          boards: project.boards.map((board) =>
            board.id === activeBoardId ? updater(board) : board
          ),
        };
      })
    );
  };

  const pushNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2200);
  };

  const pushActivity = (message: string) => {
    setActivities((prev) =>
      [{ id: getId(), message, createdAt: Date.now() }, ...prev].slice(0, 80)
    );
  };

  const isTaskOverdue = (task: Task) => {
    if (!task.dueDate) return false;
    const due = parseDate(task.dueDate);
    if (!due) return false;
    return due < startOfToday();
  };

  const isTaskDueToday = (task: Task) => {
    if (!task.dueDate) return false;
    const due = parseDate(task.dueDate);
    if (!due) return false;
    const today = startOfToday();
    return due.getTime() === today.getTime();
  };

  const isTaskDueWeek = (task: Task) => {
    if (!task.dueDate) return false;
    const due = parseDate(task.dueDate);
    if (!due) return false;
    const today = startOfToday();
    const end = new Date(today);
    end.setDate(end.getDate() + 7);
    return due >= today && due <= end;
  };

  const filterTask = (task: Task) => {
    if (filters.query) {
      const q = filters.query.toLowerCase();
      const target = `${task.title} ${task.description} ${task.tags.join(" ")}`.toLowerCase();
      if (!target.includes(q)) return false;
    }
    if (filters.assignee !== "all" && task.assignee !== filters.assignee) {
      return false;
    }
    if (filters.priority !== "all" && task.priority !== filters.priority) {
      return false;
    }
    if (filters.tag) {
      const tagQ = filters.tag.toLowerCase();
      if (!task.tags.some((tag) => tag.toLowerCase().includes(tagQ))) return false;
    }
    if (filters.due === "overdue" && !isTaskOverdue(task)) return false;
    if (filters.due === "today" && !isTaskDueToday(task)) return false;
    if (filters.due === "week" && !isTaskDueWeek(task)) return false;
    return true;
  };

  const exportData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      theme,
      lang,
      projects,
      activeProjectId,
      activeBoardId,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `jarvis-kanban-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    pushNotice(t.exportSuccess);
    pushActivity(t.exported);
  };

  const importData = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as {
        projects?: Project[];
        activeProjectId?: string;
        activeBoardId?: string;
        theme?: "dark" | "light";
        lang?: Lang;
      };
      if (!parsed.projects || parsed.projects.length === 0) {
        throw new Error("invalid");
      }
      setProjects(parsed.projects);
      if (parsed.activeProjectId) setActiveProjectId(parsed.activeProjectId);
      if (parsed.activeBoardId) setActiveBoardId(parsed.activeBoardId);
      if (parsed.theme) setTheme(parsed.theme);
      if (parsed.lang) setLang(parsed.lang);
      pushActivity(t.imported);
    } catch {
      pushNotice(t.importFailed);
    }
  };

  const copySummary = async () => {
    const lines = [
      `# ${activeProject.name} / ${activeBoard.name}`,
      ...activeBoard.columns.map((column) => {
        const tasks = column.taskIds
          .map((id) => activeBoard.tasks[id])
          .filter((task): task is Task => Boolean(task));
        const taskLines =
          tasks.length === 0
            ? `- ${t.empty}`
            : tasks
                .map((task) =>
                  `- ${task.title}${task.assignee ? ` (@${task.assignee})` : ""}`
                )
                .join("\n");
        return `## ${column.title}\n${taskLines}`;
      }),
    ];
    const text = lines.join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      pushNotice(t.copySuccess);
    } catch {
      window.alert(text);
    }
  };

  const copySyncBrief = async () => {
    const allTasks = Object.values(activeBoard.tasks);
    const totalCount = allTasks.length;
    const doneColumn = activeBoard.columns.find((col) => col.id === "col-done");
    const doneCount = doneColumn?.taskIds.length ?? 0;
    const overdueTasks = allTasks.filter(isTaskOverdue);
    const risks = overdueTasks.map((task) => `- ${task.title} (${task.dueDate})`);

    const lines = [
      `# ${t.syncBrief} · ${activeProject.name} / ${activeBoard.name}`,
      `- ${t.total}: ${totalCount} | ${t.doneCount}: ${doneCount} | ${t.overdueCount}: ${overdueTasks.length}`,
      `- ${t.risks}: ${risks.length ? "\n" + risks.join("\n") : t.none}`,
      "",
      ...activeBoard.columns.map((column) => {
        const tasks = column.taskIds
          .map((id) => activeBoard.tasks[id])
          .filter((task): task is Task => Boolean(task));
        const taskLines =
          tasks.length === 0
            ? `- ${t.empty}`
            : tasks
                .map((task) => {
                  const due = task.dueDate ? ` · ${task.dueDate}` : "";
                  const who = task.assignee ? ` @${task.assignee}` : "";
                  return `- ${task.title}${who}${due}`;
                })
                .join("\n");
        return `## ${column.title}\n${taskLines}`;
      }),
    ];

    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      pushNotice(t.syncCopied);
    } catch {
      window.alert(text);
    }
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const sourceColumn = findColumnByTask(activeId);
    if (!sourceColumn) return;

    const targetColumn = getColumnById(overId) ?? findColumnByTask(overId);
    if (!targetColumn) return;

    updateBoard((board) => {
      const columns = board.columns.map((col) => ({ ...col }));
      const source = columns.find((col) => col.id === sourceColumn.id)!;
      const target = columns.find((col) => col.id === targetColumn.id)!;

      if (source.id === target.id && overId === source.id) {
        return { ...board, columns };
      }

      if (source.id === target.id) {
        const oldIndex = source.taskIds.indexOf(activeId);
        const newIndex = source.taskIds.indexOf(overId);
        if (oldIndex >= 0 && newIndex >= 0) {
          source.taskIds = arrayMove(source.taskIds, oldIndex, newIndex);
        }
      } else {
        source.taskIds = source.taskIds.filter((id) => id !== activeId);
        target.taskIds = target.taskIds.filter((id) => id !== activeId);
        const insertIndex = target.taskIds.indexOf(overId);
        if (insertIndex >= 0) {
          target.taskIds.splice(insertIndex, 0, activeId);
        } else {
          target.taskIds.push(activeId);
        }
      }

      return { ...board, columns };
    });

    const movedTask = activeBoard.tasks[activeId];
    const targetTitle = targetColumn.title;
    if (movedTask) {
      pushActivity(`${t.moved}: ${movedTask.title} → ${targetTitle}`);
    }
    setActiveTaskId(null);
  };

  const openDraft = (columnId: string, task?: Task) => {
    setDraft({
      id: task?.id,
      columnId,
      title: task?.title ?? "",
      description: task?.description ?? "",
      assignee: task?.assignee ?? assignees[0] ?? "",
      priority: task?.priority ?? "medium",
      tags: task?.tags.join(",") ?? "",
      dueDate: task?.dueDate ?? "",
    });
  };

  const saveDraft = () => {
    if (!draft) return;
    if (!draft.title.trim()) return;
    updateBoard((board) => {
      const tasks = { ...board.tasks };
      const columns = board.columns.map((col) => ({ ...col }));
      const targetColumn = columns.find((col) => col.id === draft.columnId) ?? columns[0];

      if (draft.id) {
        tasks[draft.id] = {
          id: draft.id,
          title: draft.title,
          description: draft.description,
          assignee: draft.assignee,
          priority: draft.priority,
          tags: draft.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          dueDate: draft.dueDate,
        };
      } else {
        const newId = getId();
        tasks[newId] = {
          id: newId,
          title: draft.title,
          description: draft.description,
          assignee: draft.assignee,
          priority: draft.priority,
          tags: draft.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          dueDate: draft.dueDate,
        };
        targetColumn.taskIds.unshift(newId);
      }

      return { ...board, tasks, columns };
    });

    if (draft.id) {
      pushActivity(`${t.updated}: ${draft.title}`);
    } else {
      pushActivity(`${t.created}: ${draft.title}`);
    }

    setDraft(null);
  };

  const deleteDraft = () => {
    if (!draft?.id) return;
    updateBoard((board) => {
      const tasks = { ...board.tasks };
      delete tasks[draft.id!];
      const columns = board.columns.map((col) => ({
        ...col,
        taskIds: col.taskIds.filter((id) => id !== draft.id),
      }));
      return { ...board, tasks, columns };
    });
    pushActivity(`${t.deleted}: ${draft.title}`);
    setDraft(null);
  };

  const addProject = () => {
    const name = window.prompt(t.newProject);
    if (!name) return;
    const newProject: Project = {
      id: getId(),
      name,
      boards: [defaultBoard(lang)],
    };
    setProjects((prev) => [...prev, newProject]);
    setActiveProjectId(newProject.id);
    setActiveBoardId(newProject.boards[0].id);
  };

  const addBoard = () => {
    const name = window.prompt(t.newBoard);
    if (!name) return;
    const newBoard: Board = { ...defaultBoard(lang), id: getId(), name };
    setProjects((prev) =>
      prev.map((project) => {
        if (project.id !== activeProjectId) return project;
        return { ...project, boards: [...project.boards, newBoard] };
      })
    );
    setActiveBoardId(newBoard.id);
  };

  const allTasks = Object.values(activeBoard.tasks);
  const totalCount = allTasks.length;
  const doneColumn = activeBoard.columns.find((col) => col.id === "col-done");
  const doneCount = doneColumn?.taskIds.length ?? 0;
  const overdueCount = allTasks.filter(isTaskOverdue).length;

  return (
    <div
      className={`min-h-screen grid-bg px-6 py-6 ${
        theme === "dark" ? "text-slate-100" : "text-black"
      }`}
    >
      <header
        className={`${
          theme === "dark" ? "glass" : "light-glass"
        } rounded-3xl px-6 py-4 shadow-2xl shadow-slate-950/20`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importData(file);
            event.currentTarget.value = "";
          }}
        />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-500/80">
              AI Ops
            </p>
            <h1 className="text-2xl font-semibold text-black drop-shadow-[0_1px_0_rgba(255,255,255,0.6)] dark:text-slate-100">
              {t.appName}
            </h1>
            {notice && (
              <p className="mt-2 text-xs text-emerald-500">{notice}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-slate-500 dark:text-slate-300">
              <div className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1">
                {t.stats}: {t.total} {totalCount} · {t.doneCount} {doneCount} · {t.overdueCount} {overdueCount}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-white/70 px-3 py-2 text-xs dark:bg-white/5">
              <span className="text-black dark:text-slate-300">{t.project}</span>
              <select
                className="rounded-lg border border-slate-200/70 bg-white px-2 py-1 text-xs text-black dark:border-transparent dark:bg-slate-900/60 dark:text-slate-100"
                value={activeProjectId}
                onChange={(event) => setActiveProjectId(event.target.value)}
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <button
                onClick={addProject}
                className="rounded-full border border-cyan-500/40 px-2 py-1 text-[10px] text-cyan-200 hover:bg-cyan-500/10"
              >
                + {t.newProject}
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/70 px-3 py-2 text-xs dark:bg-white/5">
              <span className="text-black dark:text-slate-300">{t.board}</span>
              <select
                className="rounded-lg border border-slate-200/70 bg-white px-2 py-1 text-xs text-black dark:border-transparent dark:bg-slate-900/60 dark:text-slate-100"
                value={activeBoardId}
                onChange={(event) => setActiveBoardId(event.target.value)}
              >
                {activeProject.boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.name}
                  </option>
                ))}
              </select>
              <button
                onClick={addBoard}
                className="rounded-full border border-cyan-500/40 px-2 py-1 text-[10px] text-cyan-200 hover:bg-cyan-500/10"
              >
                + {t.newBoard}
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/70 px-3 py-2 text-xs dark:bg-white/5">
              <button
                onClick={exportData}
                className="rounded-full border border-cyan-500/40 px-3 py-1 text-[10px] text-cyan-600 hover:bg-cyan-500/10 dark:text-cyan-200"
              >
                {t.exportData}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-full border border-indigo-400/40 px-3 py-1 text-[10px] text-indigo-600 hover:bg-indigo-500/10 dark:text-indigo-200"
              >
                {t.importData}
              </button>
              <button
                onClick={copySummary}
                className="rounded-full border border-emerald-400/40 px-3 py-1 text-[10px] text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-200"
              >
                {t.copySummary}
              </button>
              <button
                onClick={copySyncBrief}
                className="rounded-full border border-amber-400/40 px-3 py-1 text-[10px] text-amber-600 hover:bg-amber-500/10 dark:text-amber-200"
              >
                {t.syncBrief}
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/70 px-3 py-2 text-xs dark:bg-white/5">
              <span className="text-black dark:text-slate-300">{t.language}</span>
              <button
                onClick={() => setLang(lang === "zh" ? "en" : "zh")}
                className="rounded-full border border-indigo-400/40 px-3 py-1 text-[10px] uppercase text-indigo-600 dark:text-indigo-200"
              >
                {lang === "zh" ? "EN" : "中文"}
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/70 px-3 py-2 text-xs dark:bg-white/5">
              <span className="text-black dark:text-slate-300">{t.theme}</span>
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="rounded-full border border-emerald-400/40 px-3 py-1 text-[10px] uppercase text-emerald-600 dark:text-emerald-200"
              >
                {theme === "dark" ? t.dark : t.light}
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/70 px-3 py-2 text-xs dark:bg-white/5">
              <button
                onClick={() => setActivityOpen(true)}
                className="rounded-full border border-fuchsia-400/40 px-3 py-1 text-[10px] text-fuchsia-600 hover:bg-fuchsia-500/10 dark:text-fuchsia-200"
              >
                {t.showActivity}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/70 px-4 py-3 text-xs text-black dark:bg-white/5 dark:text-slate-200">
          <span className="text-[10px] uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
            {t.filters}
          </span>
          <input
            className="rounded-full border border-slate-200/60 bg-white px-3 py-1 text-xs text-black dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
            placeholder={t.search}
            value={filters.query}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, query: event.target.value }))
            }
          />
          <input
            className="rounded-full border border-slate-200/60 bg-white px-3 py-1 text-xs text-black dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
            placeholder={t.tags}
            value={filters.tag}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, tag: event.target.value }))
            }
          />
          <select
            className="rounded-full border border-slate-200/60 bg-white px-3 py-1 text-xs text-black dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
            value={filters.assignee}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, assignee: event.target.value }))
            }
          >
            <option value="all">{t.assigneeAll}</option>
            {assignees.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            className="rounded-full border border-slate-200/60 bg-white px-3 py-1 text-xs text-black dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
            value={filters.priority}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                priority: event.target.value as Filters["priority"],
              }))
            }
          >
            <option value="all">{t.priorityAll}</option>
            <option value="high">{t.high}</option>
            <option value="medium">{t.medium}</option>
            <option value="low">{t.low}</option>
          </select>
          <select
            className="rounded-full border border-slate-200/60 bg-white px-3 py-1 text-xs text-black dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
            value={filters.due}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                due: event.target.value as Filters["due"],
              }))
            }
          >
            <option value="all">{t.dueAll}</option>
            <option value="overdue">{t.overdue}</option>
            <option value="today">{t.today}</option>
            <option value="week">{t.week}</option>
          </select>
          <button
            onClick={() =>
              setFilters({
                query: "",
                assignee: "all",
                priority: "all",
                tag: "",
                due: "all",
              })
            }
            className="rounded-full border border-slate-200/60 px-3 py-1 text-[10px] text-slate-600 hover:bg-slate-200/40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
          >
            {t.clearFilters}
          </button>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-4">
        {mounted ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragEnd={handleDragEnd}
            onDragStart={({ active }) => setActiveTaskId(String(active.id))}
            onDragCancel={() => setActiveTaskId(null)}
          >
            {activeBoard.columns.map((column) => {
              const tasks = column.taskIds
                .map((id) => activeBoard.tasks[id])
                .filter((task): task is Task => Boolean(task))
                .filter(filterTask);
              return (
                <div
                  key={column.id}
                  className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white/70 p-4 shadow-lg dark:border-white/10 dark:bg-slate-950/50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-black dark:text-slate-100">
                        {column.title}
                      </h2>
                      <p className="text-[10px] text-black dark:text-slate-400">
                        {tasks.length} items
                      </p>
                    </div>
                    <button
                      onClick={() => openDraft(column.id)}
                      className="rounded-full border border-cyan-400/40 px-3 py-1 text-[10px] text-cyan-600 hover:bg-cyan-500/10 dark:text-cyan-200"
                    >
                      + {t.addCard}
                    </button>
                  </div>

                  <ColumnDroppable id={column.id}>
                    <SortableContext
                      items={column.taskIds}
                      strategy={verticalListSortingStrategy}
                    >
                      {tasks.length === 0 && (
                        <div className="rounded-lg border border-dashed border-slate-200 py-4 text-center text-xs text-slate-400 dark:border-white/10">
                          {t.empty}
                        </div>
                      )}
                      {tasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          isOverdue={isTaskOverdue(task)}
                          overdueLabel={t.overdue}
                          onClick={() => openDraft(column.id, task)}
                        />
                      ))}
                    </SortableContext>
                  </ColumnDroppable>
                </div>
              );
            })}
            <DragOverlay>
              <OverlayCard task={activeTaskId ? activeBoard.tasks[activeTaskId] : undefined} />
            </DragOverlay>
          </DndContext>
        ) : null}
      </section>

      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-950/90 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">
                {t.editCard}
              </h3>
              <button
                onClick={() => setDraft(null)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                {t.cancel}
              </button>
            </div>
            <div className="mt-4 grid gap-3 text-xs text-slate-200">
              <label className="grid gap-2">
                {t.title}
                <input
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                  value={draft.title}
                  onChange={(event) =>
                    setDraft({ ...draft, title: event.target.value })
                  }
                />
              </label>
              <label className="grid gap-2">
                {t.description}
                <textarea
                  className="min-h-[80px] rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                  value={draft.description}
                  onChange={(event) =>
                    setDraft({ ...draft, description: event.target.value })
                  }
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-2">
                  {t.assignee}
                  <div className="flex flex-wrap gap-2">
                    {assignees.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setDraft({ ...draft, assignee: name })}
                        className={`rounded-full border px-3 py-1 text-[10px] transition ${
                          draft.assignee === name
                            ? "border-cyan-400/60 bg-cyan-500/20 text-cyan-200"
                            : "border-white/10 bg-white/5 text-slate-300 hover:border-cyan-400/40"
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </label>
                <label className="grid gap-2">
                  {t.priority}
                  <select
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                    value={draft.priority}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        priority: event.target.value as Draft["priority"],
                      })
                    }
                  >
                    <option value="high">{t.high}</option>
                    <option value="medium">{t.medium}</option>
                    <option value="low">{t.low}</option>
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-2">
                  {t.tags}
                  <input
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                    value={draft.tags}
                    onChange={(event) =>
                      setDraft({ ...draft, tags: event.target.value })
                    }
                    placeholder="AI,研究"
                  />
                </label>
                <label className="grid gap-2">
                  {t.dueDate}
                  <input
                    type="date"
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                    value={draft.dueDate}
                    onChange={(event) =>
                      setDraft({ ...draft, dueDate: event.target.value })
                    }
                  />
                </label>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between">
              {draft.id ? (
                <button
                  onClick={deleteDraft}
                  className="text-xs text-rose-300 hover:text-rose-200"
                >
                  {t.delete}
                </button>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDraft(null)}
                  className="rounded-full border border-white/10 px-4 py-2 text-xs text-slate-200"
                >
                  {t.cancel}
                </button>
                <button
                  onClick={saveDraft}
                  className="rounded-full bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950"
                >
                  {t.save}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activityOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-950/90 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">
                {t.activityLog}
              </h3>
              <button
                onClick={() => setActivityOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                {t.cancel}
              </button>
            </div>
            <div className="mt-4 max-h-[360px] space-y-2 overflow-auto text-xs">
              {activities.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-slate-400">
                  {t.activityEmpty}
                </div>
              ) : (
                activities.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-200"
                  >
                    <div className="flex items-center justify-between">
                      <span>{item.message}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
