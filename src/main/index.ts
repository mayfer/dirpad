import { app, shell, BrowserWindow, ipcMain, Tray, screen, Menu } from 'electron'
import path, { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset';

// Track dock visibility state
let showInDock = true;

// Function to handle showing or hiding the dock
function updateDockVisibility(): void {
  if (process.platform === 'darwin' && app.dock) {
    if (showInDock) {
      app.dock.show();
    } else {
      app.dock.hide();
    }
  }
}

function createWindow(): void {


  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  const tray = new Tray(path.join(__dirname, '../../resources/dirpadTemplate@2x.png'));

  // Function to build and update the context menu
  function createContextMenu() {
    return Menu.buildFromTemplate([
      {
        label: 'Show in Dock',
        type: 'checkbox',
        checked: showInDock,
        click: () => {
          showInDock = !showInDock;
          updateDockVisibility();
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.quit();
        }
      }
    ]);
  }
  
  // Handle right-click to show context menu
  tray.on('right-click', () => {
    const contextMenu = createContextMenu();
    contextMenu.popup();
  });

  // Handle left-click separately to show window
  tray.on('click', () => {
    const trayBounds = tray.getBounds();
    const windowBounds = mainWindow.getBounds();
    const display = screen.getDisplayMatching(trayBounds);
    const screenBounds = display.bounds;

    // Calculate available space to the right of the tray icon
    const distanceToRightEdge = screenBounds.width - (trayBounds.x + trayBounds.width);

    // Determine if the window width is too large to center
    const shouldOffset = windowBounds.width > 2 * distanceToRightEdge;

    const x = shouldOffset
      ? screenBounds.width - windowBounds.width // Align with right edge
      : trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2; // Center under tray

    // Position window below tray icon
    const y = trayBounds.y + trayBounds.height;

    // Ensure x stays within screen bounds
    mainWindow.setPosition(
      Math.round(Math.max(0, Math.min(x, screenBounds.width - windowBounds.width))),
      Math.round(y)
    );
    mainWindow.show();
  });

}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // Initialize dock visibility based on default setting
  updateDockVisibility()

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
