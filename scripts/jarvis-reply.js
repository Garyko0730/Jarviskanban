#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
};

const syncFile = getArg("file") || process.env.SYNC_FILE;
const taskId = getArg("taskId");
const taskTitle = getArg("title");
const content = getArg("message");
const markComplete = args.includes("--complete");

if (!syncFile || !content) {
  console.error("Usage: jarvis-reply --file <sync.json> --message <text> [--taskId <id> | --title <title>] [--complete]");
  process.exit(1);
}

const normalize = (value) => (value || "").trim().toLowerCase();

const resolveTarget = () => {
  if (!fs.existsSync(syncFile)) return null;
  try {
    const raw = fs.readFileSync(syncFile, "utf8");
    const data = JSON.parse(raw);
    const project = data.projects?.find((p) => p.id === data.activeProjectId) || data.projects?.[0];
    const board = project?.boards?.find((b) => b.id === data.activeBoardId) || project?.boards?.[0];
    if (!board || !board.columns || !board.tasks) return null;

    if (taskId && board.tasks[taskId]) return { id: taskId, title: board.tasks[taskId].title };

    if (taskTitle) {
      const exact = Object.values(board.tasks).find(
        (t) => normalize(t.title) === normalize(taskTitle)
      );
      if (exact) return { id: exact.id, title: exact.title };

      const fuzzy = Object.values(board.tasks).find(
        (t) => normalize(t.title).includes(normalize(taskTitle))
      );
      if (fuzzy) return { id: fuzzy.id, title: fuzzy.title };
    }

    const progress = board.columns.find((c) => c.id === "col-progress");
    if (progress) {
      const candidates = progress.taskIds
        .map((id) => board.tasks[id])
        .filter((t) => t && t.assignee && t.assignee.toLowerCase().includes("jarvis"));
      if (candidates.length > 0) {
        const latest = candidates[candidates.length - 1];
        return { id: latest.id, title: latest.title };
      }
    }

    return null;
  } catch {
    return null;
  }
};

const outDir = path.resolve(process.cwd(), ".sync");
const queuePath = path.resolve(outDir, "assistant-replies.json");

fs.mkdirSync(outDir, { recursive: true });

let queue = [];
if (fs.existsSync(queuePath)) {
  try {
    queue = JSON.parse(fs.readFileSync(queuePath, "utf8"));
  } catch {
    queue = [];
  }
}

const resolved = resolveTarget();

queue.push({
  id: `reply-${Date.now()}-${Math.random()}`,
  taskId: resolved?.id ?? taskId ?? null,
  title: resolved?.title ?? taskTitle ?? null,
  content,
  markComplete,
  createdAt: new Date().toISOString(),
  syncFile,
});

fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2));
console.log("[jarvis-reply] queued");
