const { app, BrowserWindow, dialog, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const net = require("net");

let mainWindow;
let nextProcess;
let syncAgent;
let currentPort = 3000;

const userDataPath = app.getPath("userData");
const syncConfigPath = path.join(userDataPath, "sync.json");

const getAppRoot = () => app.getAppPath();

const getUnpackedPath = (relativePath) =>
  app.isPackaged
    ? path.join(process.resourcesPath, "app.asar.unpacked", relativePath)
    : path.join(getAppRoot(), relativePath);

const resolveScript = (relativePath) =>
  app.isPackaged
    ? path.join(process.resourcesPath, "app.asar", relativePath)
    : path.join(getAppRoot(), relativePath);

const loadSyncConfig = () => {
  try {
    if (!fs.existsSync(syncConfigPath)) return null;
    const raw = fs.readFileSync(syncConfigPath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed?.syncFile || null;
  } catch {
    return null;
  }
};

const saveSyncConfig = (syncFile) => {
  fs.mkdirSync(userDataPath, { recursive: true });
  fs.writeFileSync(syncConfigPath, JSON.stringify({ syncFile }, null, 2));
};

const pickSyncFile = async () => {
  const result = await dialog.showOpenDialog({
    title: "Select Jarvis Kanban sync file",
    filters: [{ name: "JSON", extensions: ["json"] }],
    properties: ["openFile", "createDirectory"],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
};

const getElectronBin = () => {
  if (fs.existsSync(process.execPath)) return process.execPath;
  const fallback = app.getPath("exe");
  if (fs.existsSync(fallback)) return fallback;
  return process.execPath;
};

const resolveElectronBin = () => {
  const candidates = [
    process.execPath,
    app.getPath("exe"),
    path.join(process.resourcesPath, "..", `${app.getName()}.exe`),
  ];
  return candidates.find((candidate) => candidate && fs.existsSync(candidate));
};

const spawnSafe = (command, args, options) => {
  if (!command) return null;
  const child = spawn(command, args, options);
  child.on("error", (error) => {
    dialog.showErrorBox(
      "Jarvis Kanban",
      `Failed to start background process: ${error.message}`
    );
  });
  return child;
};

const startSyncAgent = (syncFile) => {
  if (!syncFile) return;
  if (syncAgent) syncAgent.kill();
  const scriptPath = getUnpackedPath("scripts/sync-agent.js");
  const electronBin = resolveElectronBin();
  syncAgent = spawnSafe(
    electronBin,
    ["--run-as-node", scriptPath, "--file", syncFile],
    { stdio: "ignore", cwd: getAppRoot() }
  );
};

const ensureSyncFile = async () => {
  let syncFile = loadSyncConfig();
  if (!syncFile) {
    syncFile = await pickSyncFile();
    if (syncFile) saveSyncConfig(syncFile);
  }
  if (syncFile) startSyncAgent(syncFile);
  return syncFile;
};

const isPortFree = (port) =>
  new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });

const findFreePort = async (start = 3000, end = 3010) => {
  for (let port = start; port <= end; port += 1) {
    // eslint-disable-next-line no-await-in-loop
    const free = await isPortFree(port);
    if (free) return port;
  }
  return start;
};

const waitForServer = (url, timeoutMs = 15000) =>
  new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const req = net.connect({ port: currentPort }, () => {
        req.destroy();
        resolve();
      });
      req.on("error", () => {
        req.destroy();
        if (Date.now() - start > timeoutMs) reject(new Error("Server timeout"));
        else setTimeout(tick, 300);
      });
    };
    tick();
  });

const startNextServer = async () => {
  if (process.env.ELECTRON_DEV === "1") return;
  if (nextProcess) return;
  currentPort = await findFreePort();
  const nextBin = getUnpackedPath("node_modules/next/dist/bin/next");
  const electronBin = resolveElectronBin();
  nextProcess = spawnSafe(
    electronBin,
    ["--run-as-node", nextBin, "start", "-p", String(currentPort)],
    { stdio: "ignore", cwd: getAppRoot() }
  );
  await waitForServer(`http://localhost:${currentPort}`);
};

const createWindow = async () => {
  await startNextServer();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  const targetUrl = process.env.ELECTRON_DEV === "1"
    ? "http://localhost:3000"
    : `http://localhost:${currentPort}`;

  await mainWindow.loadURL(targetUrl);
};

const buildMenu = () => {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Select Sync File",
          click: async () => {
            const syncFile = await pickSyncFile();
            if (syncFile) {
              saveSyncConfig(syncFile);
              startSyncAgent(syncFile);
            }
          },
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

app.whenReady().then(async () => {
  buildMenu();
  await ensureSyncFile();
  await createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (nextProcess) nextProcess.kill();
  if (syncAgent) syncAgent.kill();
});
