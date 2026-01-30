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
