const { app, BrowserWindow, Menu, ipcMain, screen } = require('electron');
const path = require('node:path');

app.setName('Charly the Clown');
if (process.env.CHARLY_TEST_PROFILE) app.setPath('userData', process.env.CHARLY_TEST_PROFILE);

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const window = new BrowserWindow({
    title: 'Charly the Clown · Run for Fun',
    width: Math.min(1366, width),
    height: Math.min(768, height),
    minWidth: 640,
    minHeight: 360,
    fullscreen: true,
    backgroundColor: '#100d16',
    autoHideMenuBar: true,
    show: false,
    icon: path.join(__dirname, 'charly.ico'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), sandbox: true },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  function sendFullscreen() { window.webContents.send('desktop:fullscreen', window.isFullScreen()); }
  window.on('enter-full-screen', sendFullscreen);
  window.on('leave-full-screen', sendFullscreen);
  ipcMain.on('desktop:request-fullscreen-state', event => {
    if (event.sender === window.webContents) sendFullscreen();
  });
  ipcMain.on('desktop:toggle-fullscreen', event => {
    if (event.sender === window.webContents) window.setFullScreen(!window.isFullScreen());
  });
  ipcMain.on('desktop:quit', event => {
    if (event.sender === window.webContents) window.close();
  });
  window.once('ready-to-show', () => {
    window.show();
    sendFullscreen();
  });
  window.loadFile(path.join(__dirname, '../dist/index.html'));
});
app.on('window-all-closed', () => app.quit());
