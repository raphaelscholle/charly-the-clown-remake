const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('charlyDesktop', {
  fullscreen: () => ipcRenderer.send('desktop:toggle-fullscreen'),
  quit: () => ipcRenderer.send('desktop:quit'),
  onFullscreen: callback => {
    ipcRenderer.on('desktop:fullscreen', (_event, value) => callback(value));
    ipcRenderer.send('desktop:request-fullscreen-state');
  },
});
