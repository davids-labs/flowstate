const { app, BrowserWindow, Menu, Tray, globalShortcut, nativeImage, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let compactWindow;
let tray;

// Live timer state for tray display
let timerState = {
  phase: 'idle',
  remaining: 0,
  blockName: '',
  routineName: '',
  isOverdue: false,
};
let trayUpdateInterval = null;

const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 700,
    minWidth: 600,
    minHeight: 400,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#F8FAFC',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/* ── Compact floating timer window (Ctrl+Shift+T) ── */
function toggleCompactWindow() {
  if (compactWindow) {
    compactWindow.close();
    compactWindow = null;
    return;
  }
  compactWindow = new BrowserWindow({
    width: 400,
    height: 100,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const url = isDev ? 'http://localhost:5173/#/compact' : 'file://' + path.join(__dirname, '../dist/index.html#/compact');
  compactWindow.loadURL(url);

  compactWindow.on('closed', () => {
    compactWindow = null;
  });
}

function createTray() {
  // Use a 16x16 empty image if no icon file exists
  let icon;
  const iconPath = path.join(__dirname, 'icon.png');
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) throw new Error('empty');
  } catch {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  updateTrayMenu();

  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    }
  });
}

function formatTrayTime(ms) {
  const absMs = Math.abs(ms);
  const totalSeconds = Math.floor(absMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const prefix = ms < 0 ? '+' : '';
  return `${prefix}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function updateTrayMenu() {
  if (!tray) return;

  const isActive = ['running', 'paused', 'overdue'].includes(timerState.phase);
  const isPaused = timerState.phase === 'paused';

  let tooltip = 'FlowState';
  const menuItems = [
    { label: 'Show FlowState', click: () => mainWindow && mainWindow.show() },
    { label: 'Compact Timer', click: toggleCompactWindow },
  ];

  if (isActive) {
    const timeStr = formatTrayTime(timerState.remaining);
    const statusStr = isPaused ? '⏸' : timerState.isOverdue ? '⏰' : '▶';
    const blockStr = timerState.blockName || 'Focus';
    const routineStr = timerState.routineName ? ` — ${timerState.routineName}` : '';

    tooltip = `${statusStr} ${blockStr}${routineStr} ${timeStr}`;

    menuItems.unshift(
      { label: `${statusStr} ${blockStr} — ${timeStr}`, enabled: false },
      { type: 'separator' },
    );
  }

  menuItems.push(
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  );

  tray.setToolTip(tooltip);
  tray.setContextMenu(Menu.buildFromTemplate(menuItems));
}

// ─── IPC: Timer state from renderer ─────────────────────────────

ipcMain.on('timer-state-update', (_event, state) => {
  timerState = state;
  updateTrayMenu();
});

// Start/stop periodic tray refresh when timer is active
ipcMain.on('timer-active', (_event, isActive) => {
  if (isActive && !trayUpdateInterval) {
    trayUpdateInterval = setInterval(updateTrayMenu, 1000);
  } else if (!isActive && trayUpdateInterval) {
    clearInterval(trayUpdateInterval);
    trayUpdateInterval = null;
    updateTrayMenu();
  }
});

app.on('ready', () => {
  createWindow();
  createTray();

  // Register compact-window shortcut
  globalShortcut.register('CommandOrControl+Shift+T', toggleCompactWindow);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});