import { app, shell, BrowserWindow, ipcMain, Tray, screen, Menu } from 'electron'
import path, { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

// Track dock visibility state
let showInDock = true;
// Declare mainWindow globally so we can access it from different functions
let mainWindow: BrowserWindow | null = null;
// Global tray instance
let tray: Tray | null = null;

// Tray icon paths
const normalIconPath = path.join(__dirname, '../../resources/dirpadTemplate@2x.png');
// const pressedIconPath = path.join(__dirname, '../../resources/dirpadPressedTemplate@2x.png');

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

// Function to update tray icon based on window focus state
function updateTrayIcon(isFocused: boolean): void {
  if (tray) {
    // tray.setImage(isFocused ? pressedIconPath : normalIconPath);
    tray.setImage(normalIconPath);
  }
}

// Link metadata fetching function that runs in main process to avoid CORS
async function fetchLinkMetadata(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DirpadBot/1.0; +https://dirpad.example.com)'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch, status: ${response.status}`);
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Extract metadata
    const title = 
      $('meta[property="og:title"]').attr('content') || 
      $('title').text() || 
      url;
      
    const description = 
      $('meta[property="og:description"]').attr('content') || 
      $('meta[name="description"]').attr('content') || 
      '';
      
    const image = 
      $('meta[property="og:image"]').attr('content') || 
      $('meta[property="twitter:image"]').attr('content') || 
      null;
    
    const domain = new URL(url).hostname;
    
    return {
      url,
      title,
      description,
      image,
      domain
    };
  } catch (error) {
    console.error('Error fetching link metadata:', error);
    return {
      url,
      title: url,
      description: '',
      image: null,
      domain: new URL(url).hostname
    };
  }
}

function createWindow(): BrowserWindow {
  // Create a new window
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#00000000', // Transparent background
    titleBarStyle: 'customButtonsOnHover', // Hide window buttons until hover
    vibrancy: 'under-window', // Add vibrancy/translucency effect on macOS
    transparent: true, // Make the window transparent
    frame: false, // Remove the frame around the window
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Handle window close event to set mainWindow to null
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Add focus/blur handlers
  mainWindow.on('focus', () => {
    updateTrayIcon(true);
  });

  mainWindow.on('blur', () => {
    updateTrayIcon(false);
  });

  return mainWindow;
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
  
  // Register IPC handler for link metadata fetching
  ipcMain.handle('fetch-link-metadata', async (_, url) => {
    console.log('Fetching metadata for:', url);
    return await fetchLinkMetadata(url);
  });

  // Initialize dock visibility based on default setting
  updateDockVisibility()

  // Create the tray with initial normal icon
  tray = new Tray(normalIconPath);

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
    // Check if mainWindow exists and isn't destroyed
    if (!mainWindow || mainWindow.isDestroyed()) {
      // Create a new window if it doesn't exist or was destroyed
      createWindow();
    }

    // Toggle window visibility or focus:
    // 1. If window is visible AND focused, hide it
    // 2. If window is visible but NOT focused, bring it to focus
    // 3. If window is hidden, show it
    if (mainWindow?.isVisible() && mainWindow.isFocused()) {
      // Hide window if it's both visible and focused
      mainWindow.hide();
    } else if (mainWindow?.isVisible()) {
      // If window is visible but not focused, focus it
      mainWindow.focus();
    } else if (mainWindow) {
      const trayBounds = tray!.getBounds();
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
      
      // On macOS, prevent space switching behavior
      if (process.platform === 'darwin') {
        // Make window visible on all workspaces temporarily
        mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        
        // Show the window without activating the application
        mainWindow.showInactive();
        
        // Make it visible only on the current workspace again
        setTimeout(() => {
          if (mainWindow) {
            mainWindow.setVisibleOnAllWorkspaces(false);
            mainWindow.focus(); // Focus window but should now be in current space
          }
        }, 100);
      } else {
        // Original behavior for other platforms
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

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
