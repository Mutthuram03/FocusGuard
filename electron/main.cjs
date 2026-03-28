const { app, BrowserWindow, ipcMain, powerMonitor } = require('electron');
const path = require('path');
const { uIOhook, UiohookKey } = require('uiohook-napi');
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow;

// Track global input events
uIOhook.on('keydown', (e) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('global-keystroke');
  }
});

let lastMouseMoveTime = 0;
uIOhook.on('mousemove', (e) => {
  const now = Date.now();
  if (now - lastMouseMoveTime > 100) { // Throttle to every 100ms
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('global-mousemove');
    }
    lastMouseMoveTime = now;
  }
});
uIOhook.on('mousedown', (e) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('global-click');
    }
});

uIOhook.start();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      sandbox: false, // Ensure we can access node APIs if needed (though contextIsolation handles safety)
      preload: path.join(__dirname, 'preload.cjs'),
    },
    frame: true, // Use standard OS frame to ensure window is drawn correctly
    transparent: false, // Disable transparency to fix "black window" issue on Windows
    autoHideMenuBar: true,
    alwaysOnTop: false, // Let user manage window stacking
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  if (isDev) {
    console.log('Loading development URL...');
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Monitor system idle status
  setInterval(() => {
    // Check if system is idle (in seconds)
    const idleTime = powerMonitor.getSystemIdleTime();
    
    // We send this true system idle time to React
    if (mainWindow) {
      mainWindow.webContents.send('system-idle-status', idleTime);
    }
  }, 1000);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});