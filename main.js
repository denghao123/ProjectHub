const electron = require('electron')
const app = electron.app
const ipcMain=electron.ipcMain
const BrowserWindow = electron.BrowserWindow
const path = require('path')
const url = require('url')
let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false
  })

  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))

  mainWindow.on('closed', function() {
    mainWindow = null
  })
}

app.on('ready', createWindow)

ipcMain.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
});

ipcMain.on('min-window', () => {
    mainWindow.minimize();
});