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
const intervalMs = Number(getArg("interval") || process.env.SYNC_INTERVAL || 1500);
const outDir = path.resolve(process.cwd(), ".sync");
const latestPath = path.resolve(outDir, getArg("out") || "latest.json");
const summaryPath = path.resolve(outDir, getArg("summary") || "summary.md");
const replyQueuePath = path.resolve(outDir, "assistant-replies.json");

if (!syncFile) {
  console.error("[sync-agent] Missing sync file path. Use --file <path> or set SYNC_FILE.");
  process.exit(1);
}

let lastMtime = 0;
let lastGood = null;

const formatTask = (task) => {
  const who = task.assignee ? ` @${task.assignee}` : "";
  const due = task.dueDate ? ` · ${task.dueDate}` : "";
  const priority = task.priority ? ` · ${task.priority}` : "";
  return `- ${task.title}${who}${priority}${due}`;
};

const renderSummary = (data) => {
  const project = data.projects?.find((p) => p.id === data.activeProjectId) || data.projects?.[0];
  const board = project?.boards?.find((b) => b.id === data.activeBoardId) || project?.boards?.[0];
  const exportedAt = data.exportedAt || new Date().toISOString();

  const lines = [
    "# Sync Summary",
    `- Project: ${project?.name ?? "N/A"}`,
    `- Board: ${board?.name ?? "N/A"}`,
    `- Updated: ${exportedAt}`,
    "",
    "## Columns",
  ];

  if (!board?.columns || !board?.tasks) {
    lines.push("- No data");
    return lines.join("\n");
  }

  board.columns.forEach((column) => {
    const tasks = column.taskIds
      .map((id) => board.tasks[id])
      .filter(Boolean);
    lines.push(`### ${column.title} (${tasks.length})`);
    if (tasks.length === 0) {
      lines.push("- (empty)");
    } else {
      tasks.forEach((task) => lines.push(formatTask(task)));
    }
    lines.push("");
  });

  return lines.join("\n");
};

const writeOutputs = (data) => {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(latestPath, JSON.stringify(data, null, 2));
  fs.writeFileSync(summaryPath, renderSummary(data));
  console.log(`[sync-agent] updated ${new Date().toISOString()} from ${path.basename(syncFile)}`);
};

const pushMessage = (board, content, role = "assistant") => {
  if (!board.messages) board.messages = [];
  board.messages.unshift({
    id: `msg-${Date.now()}-${Math.random()}`,
    role,
    content,
    createdAt: new Date().toISOString(),
  });
  board.messages = board.messages.slice(0, 50);
};

const moveTask = (board, taskId, targetColumnId) => {
  board.columns.forEach((col) => {
    col.taskIds = col.taskIds.filter((id) => id !== taskId);
  });
  const target = board.columns.find((col) => col.id === targetColumnId);
  if (target) target.taskIds.unshift(taskId);
};

const applyQueuedReplies = (data) => {
  if (!fs.existsSync(replyQueuePath)) return false;
  let queue = [];
  try {
    queue = JSON.parse(fs.readFileSync(replyQueuePath, "utf8"));
  } catch {
    queue = [];
  }
  if (!Array.isArray(queue) || queue.length === 0) return false;

  let changed = false;
  const project = data.projects?.find((p) => p.id === data.activeProjectId) || data.projects?.[0];
  const board = project?.boards?.find((b) => b.id === data.activeBoardId) || project?.boards?.[0];
  if (!board || !board.columns || !board.tasks) return false;

  const reviewId = board.columns.find((c) => c.id === "col-review")?.id;

  queue.forEach((item) => {
    if (item.syncFile && path.resolve(item.syncFile) !== path.resolve(syncFile)) return;
    pushMessage(board, item.content, "assistant");

    let task = null;
    if (item.taskId) task = board.tasks[item.taskId];
    if (!task && item.title) {
      task = Object.values(board.tasks).find((t) => t.title === item.title) || null;
    }

    if (task && item.markComplete && reviewId) {
      const tags = task.tags || [];
      if (!tags.includes("完成")) task.tags = Array.from(new Set([...tags, "完成"]));
      moveTask(board, task.id, reviewId);
      pushMessage(board, `任务完成：${task.title}，已移入评审。`, "assistant");
    }
    changed = true;
  });

  fs.writeFileSync(replyQueuePath, JSON.stringify([], null, 2));
  return changed;
};

const updateBoardForJarvis = (data) => {
  const project = data.projects?.find((p) => p.id === data.activeProjectId) || data.projects?.[0];
  const board = project?.boards?.find((b) => b.id === data.activeBoardId) || project?.boards?.[0];
  if (!board || !board.columns || !board.tasks) return false;

  let changed = false;
  const todoId = board.columns.find((c) => c.id === "col-todo")?.id;
  const progressId = board.columns.find((c) => c.id === "col-progress")?.id;
  const reviewId = board.columns.find((c) => c.id === "col-review")?.id;

  if (!todoId || !progressId || !reviewId) return false;

  board.columns.forEach((col) => {
    col.taskIds.forEach((taskId) => {
      const task = board.tasks[taskId];
      if (!task) return;
      const tags = task.tags || [];
      const isJarvis = task.assignee && task.assignee.toLowerCase().includes("jarvis");

      if (col.id === todoId && isJarvis && !tags.includes("已读")) {
        task.tags = Array.from(new Set([...tags, "已读"]));
        moveTask(board, taskId, progressId);
        pushMessage(board, `已读任务：${task.title}，已移入进行中。`);
        changed = true;
      }

      if (col.id === progressId && tags.some((t) => ["完成", "done", "completed"].includes(t.toLowerCase?.() ?? t))) {
        if (!tags.includes("评审中")) {
          task.tags = Array.from(new Set([...tags, "评审中"]));
        }
        moveTask(board, taskId, reviewId);
        pushMessage(board, `任务完成：${task.title}，已移入评审。`);
        changed = true;
      }
    });
  });

  if (applyQueuedReplies(data)) changed = true;

  return changed;
};

const readSyncFile = () => {
  try {
    if (!fs.existsSync(syncFile)) {
      console.warn(`[sync-agent] waiting for ${syncFile}`);
      return;
    }
    const stat = fs.statSync(syncFile);
    if (stat.mtimeMs <= lastMtime) return;
    const raw = fs.readFileSync(syncFile, "utf8");
    const data = JSON.parse(raw);
    const changed = updateBoardForJarvis(data);
    if (changed) {
      data.exportedAt = new Date().toISOString();
      fs.writeFileSync(syncFile, JSON.stringify(data, null, 2));
    }
    lastMtime = stat.mtimeMs;
    lastGood = data;
    writeOutputs(data);
  } catch (error) {
    console.warn(`[sync-agent] failed to read sync file: ${error.message}`);
    if (lastGood) {
      writeOutputs(lastGood);
    }
  }
};

readSyncFile();
setInterval(readSyncFile, Number.isFinite(intervalMs) ? intervalMs : 1500);
