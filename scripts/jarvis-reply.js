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

queue.push({
  id: `reply-${Date.now()}-${Math.random()}`,
  taskId,
  title: taskTitle,
  content,
  markComplete,
  createdAt: new Date().toISOString(),
  syncFile,
});

fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2));
console.log("[jarvis-reply] queued");
