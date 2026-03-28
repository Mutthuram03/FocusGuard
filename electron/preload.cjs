const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onSystemIdle: (callback) => {
    const subscription = (_event, value) => callback(_event, value);
    ipcRenderer.on('system-idle-status', subscription);
    return () => ipcRenderer.removeListener('system-idle-status', subscription);
  },
  onGlobalKeystroke: (callback) => {
    const subscription = (_event, value) => callback(_event, value);
    ipcRenderer.on('global-keystroke', subscription);
    return () => ipcRenderer.removeListener('global-keystroke', subscription);
  },
  onGlobalMouseMove: (callback) => {
    const subscription = (_event, value) => callback(_event, value);
    ipcRenderer.on('global-mousemove', subscription);
    return () => ipcRenderer.removeListener('global-mousemove', subscription);
  },
  onGlobalClick: (callback) => {
      const subscription = (_event, value) => callback(_event, value);
      ipcRenderer.on('global-click', subscription);
      return () => ipcRenderer.removeListener('global-click', subscription);
  }
});