const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload script - Bridge between Electron and web content
 * Exposes safe APIs to the renderer process
 */

contextBridge.exposeInMainWorld('electronAPI', {
  // App information
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  
  // Platform information
  platform: process.platform,
  isElectron: true,
  
  // Future APIs can be added here
  // Example: openFileDialog, saveFile, etc.
});

console.log('Preload script loaded successfully');

