"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
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
  },
} as const;

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
    assignee: "Ko先生",
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

const getId = () =>
  globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random()}`;

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
}: {
  task: Task;
  onClick: () => void;
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
      ? "text-rose-300 bg-rose-500/10 border-rose-400/30"
      : task.priority === "medium"
      ? "text-amber-300 bg-amber-500/10 border-amber-400/30"
      : "text-emerald-300 bg-emerald-500/10 border-emerald-400/30";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-grab rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-lg shadow-slate-200/60 transition active:cursor-grabbing dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100 dark:shadow-slate-950/30 ${
        isDragging ? "opacity-60" : "opacity-100"
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-100">{task.title}</h4>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${priorityColor}`}
        >
          {task.priority}
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-600 line-clamp-2 dark:text-slate-300">
        {task.description}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
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

  const t = i18n[lang];

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    const savedLang = localStorage.getItem(langKey) as Lang | null;
    const savedTheme = localStorage.getItem(themeKey) as "dark" | "light" | null;
    if (savedLang) setLang(savedLang);
    if (savedTheme) setTheme(savedTheme);
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

  const handleDragEnd = ({ active, over }: { active: any; over: any }) => {
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

      if (source.id === target.id) {
        const oldIndex = source.taskIds.indexOf(activeId);
        const newIndex = source.taskIds.indexOf(overId);
        if (oldIndex >= 0 && newIndex >= 0) {
          source.taskIds = arrayMove(source.taskIds, oldIndex, newIndex);
        }
      } else {
        source.taskIds = source.taskIds.filter((id) => id !== activeId);
        const insertIndex = target.taskIds.indexOf(overId);
        if (insertIndex >= 0) {
          target.taskIds.splice(insertIndex, 0, activeId);
        } else {
          target.taskIds.push(activeId);
        }
      }

      return { ...board, columns };
    });
    setActiveTaskId(null);
  };

  const openDraft = (columnId: string, task?: Task) => {
    setDraft({
      id: task?.id,
      columnId,
      title: task?.title ?? "",
      description: task?.description ?? "",
      assignee: task?.assignee ?? "",
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

  return (
    <div
      className={`min-h-screen grid-bg px-6 py-6 ${
        theme === "dark" ? "text-slate-100" : "text-slate-900"
      }`}
    >
      <header
        className={`${
          theme === "dark" ? "glass" : "light-glass"
        } rounded-3xl px-6 py-4 shadow-2xl shadow-slate-950/20`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-500/80">
              AI Ops
            </p>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {t.appName}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-white/70 px-3 py-2 text-xs dark:bg-white/5">
              <span className="text-slate-600 dark:text-slate-300">{t.project}</span>
              <select
                className="rounded-lg bg-white px-2 py-1 text-xs text-slate-900 dark:bg-slate-900/60 dark:text-slate-100"
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
              <span className="text-slate-600 dark:text-slate-300">{t.board}</span>
              <select
                className="rounded-lg bg-white px-2 py-1 text-xs text-slate-900 dark:bg-slate-900/60 dark:text-slate-100"
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
              <span className="text-slate-600 dark:text-slate-300">{t.language}</span>
              <button
                onClick={() => setLang(lang === "zh" ? "en" : "zh")}
                className="rounded-full border border-indigo-400/40 px-3 py-1 text-[10px] uppercase text-indigo-600 dark:text-indigo-200"
              >
                {lang === "zh" ? "EN" : "中文"}
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/70 px-3 py-2 text-xs dark:bg-white/5">
              <span className="text-slate-600 dark:text-slate-300">{t.theme}</span>
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="rounded-full border border-emerald-400/40 px-3 py-1 text-[10px] uppercase text-emerald-600 dark:text-emerald-200"
              >
                {theme === "dark" ? t.dark : t.light}
              </button>
            </div>
          </div>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragEnd={handleDragEnd}
          onDragStart={({ active }) => setActiveTaskId(String(active.id))}
          onDragCancel={() => setActiveTaskId(null)}
        >
          {activeBoard.columns.map((column) => {
            const tasks = column.taskIds.map((id) => activeBoard.tasks[id]);
            return (
              <div
                key={column.id}
                className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white/70 p-4 shadow-lg dark:border-white/10 dark:bg-slate-950/50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {column.title}
                    </h2>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
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
                  <input
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                    value={draft.assignee}
                    onChange={(event) =>
                      setDraft({ ...draft, assignee: event.target.value })
                    }
                  />
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
    </div>
  );
}
