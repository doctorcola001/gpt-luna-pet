const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

let petWindow = null;
let tray = null;
let quitting = false;
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

function trayImage() {
  const ico = nativeImage.createFromPath(path.join(__dirname, "assets", "tray-icon.ico"));
  return ico.isEmpty() ? nativeImage.createFromPath(path.join(__dirname, "assets", "tray-icon.png")) : ico;
}

function refreshTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: petWindow && petWindow.isVisible() ? "隐藏桌宠" : "显示桌宠",
      click: togglePetWindow
    },
    { type: "separator" },
    {
      label: "退出 LUNA",
      click: () => {
        quitting = true;
        app.quit();
      }
    }
  ]));
}

function togglePetWindow() {
  if (!petWindow) {
    createPetWindow();
    return;
  }
  if (petWindow.isVisible()) {
    petWindow.hide();
  } else {
    petWindow.showInactive();
    petWindow.setAlwaysOnTop(true, "screen-saver");
  }
  refreshTrayMenu();
}

function createTray() {
  if (tray) return;
  tray = new Tray(trayImage());
  tray.setToolTip("LUNA · 桌宠 · 右键退出");
  tray.on("click", togglePetWindow);
  refreshTrayMenu();
}

function createPetWindow() {
  const area = screen.getPrimaryDisplay().workArea;
  petWindow = new BrowserWindow({
    x: area.x,
    y: area.y,
    width: area.width,
    height: area.height,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    icon: path.join(__dirname, "assets", "app-icon.png"),
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  petWindow.setAlwaysOnTop(true, "screen-saver");
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  petWindow.loadFile(path.join(__dirname, "index.html"));
  petWindow.once("ready-to-show", () => {
    petWindow.showInactive();
    petWindow.setIgnoreMouseEvents(true, { forward: true });
    refreshTrayMenu();
  });
  petWindow.on("show", refreshTrayMenu);
  petWindow.on("hide", refreshTrayMenu);
  petWindow.on("closed", () => {
    petWindow = null;
    refreshTrayMenu();
  });

  screen.on("display-metrics-changed", () => {
    if (!petWindow) return;
    const next = screen.getPrimaryDisplay().workArea;
    petWindow.setBounds(next);
  });
}

ipcMain.on("luna:set-interactive", (event, interactive) => {
  if (!petWindow) return;
  petWindow.setIgnoreMouseEvents(!interactive, { forward: true });
});
ipcMain.on("luna:quit", () => app.quit());
ipcMain.handle("luna:get-version", () => app.getVersion());

function thoughtLines(value) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
  return [];
}

ipcMain.handle("luna:load-thoughts", () => {
  const folder = app.isPackaged ? path.dirname(process.execPath) : __dirname;
  try {
    const data = JSON.parse(fs.readFileSync(path.join(folder, "thoughts.json"), "utf8"));
    return { B: thoughtLines(data.B), C: thoughtLines(data.C) };
  } catch (error) {
    console.warn(`Unable to load thoughts.json: ${error.message}`);
    return { B: [], C: [] };
  }
});

app.whenReady().then(() => {
  app.setName("LUNA 桌宠");
  app.setAppUserModelId("wb40.gpt-luna-pet");
  createTray();
  createPetWindow();
  app.on("activate", () => {
    if (!petWindow) createPetWindow();
    else petWindow.showInactive();
    refreshTrayMenu();
  });
});

app.on("second-instance", () => {
  if (petWindow) petWindow.showInactive();
  refreshTrayMenu();
});
app.on("before-quit", () => { quitting = true; });
app.on("window-all-closed", () => {
  if (!quitting && !tray) app.quit();
});
