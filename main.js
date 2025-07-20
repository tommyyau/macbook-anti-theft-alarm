const { app, BrowserWindow, ipcMain, powerMonitor, systemPreferences, Tray, Menu, nativeImage, screen, dialog } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const sudo = require('sudo-prompt');

let mainWindow;
let tray = null;
let isAlarmArmed = false;
let alarmTriggered = false;
let lidMonitorInterval = null;
let lastDisplayCount = 0;

// Enable live reload for development
if (process.env.NODE_ENV === 'development') {
  require('electron-reload')(__dirname);
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 520,
    height: 800,
    minWidth: 480,
    minHeight: 650,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    resizable: true,
    titleBarStyle: 'hiddenInset',
    show: false,
    useContentSize: true
  });

  // Load the app
  mainWindow.loadFile('index.html');

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Auto-resize window to fit content
    autoResizeWindow();
  });

  // Handle window close - minimize to tray instead
  mainWindow.on('close', (event) => {
    if (isAlarmArmed && !alarmTriggered) {
      event.preventDefault();
      triggerAlarm('Window closed while alarm was armed!');
    } else if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  
  // Handle resize requests from renderer
  ipcMain.handle('resize-window', () => {
    autoResizeWindow();
  });
}

// Auto-resize window to fit content
function autoResizeWindow() {
  if (!mainWindow) return;
  
  // Use a much simpler approach - just set a larger default size
  // since the auto-resize JavaScript keeps failing
  const newWidth = 520;
  const newHeight = 800;
  
  mainWindow.setSize(newWidth, newHeight);
  mainWindow.center();
  
  console.log(`Window resized to ${newWidth}x${newHeight}`);
}

function createTray() {
  // Create tray icon
  const trayIconPath = path.join(__dirname, 'assets', 'icons', 'tray-icon.png');
  const fallbackIconPath = path.join(__dirname, 'assets', 'icons', 'icon.png');
  
  let trayIcon;
  if (require('fs').existsSync(trayIconPath)) {
    trayIcon = nativeImage.createFromPath(trayIconPath);
  } else if (require('fs').existsSync(fallbackIconPath)) {
    trayIcon = nativeImage.createFromPath(fallbackIconPath);
  } else {
    // Fallback to a simple colored circle if no icon found
    trayIcon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
  }
  
  trayIcon = trayIcon.resize({ width: 16, height: 16 });
  tray = new Tray(trayIcon);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        mainWindow.show();
      }
    },
    {
      label: 'Armed Status',
      enabled: false,
      label: isAlarmArmed ? 'Status: ARMED' : 'Status: Disarmed'
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  tray.setToolTip('MacShieldAlarm');
  
  tray.on('click', () => {
    mainWindow.show();
  });
}

function requestAdminPermission() {
  return new Promise((resolve, reject) => {
    const options = {
      name: 'MacBook AntiTheft Alarm',  // Removed hyphens - only alphanumeric and spaces allowed
    };
    
    console.log('🔐 Requesting admin permission to disable system sleep...');
    
    sudo.exec('pmset -a disablesleep 1', options, (error, stdout, stderr) => {
      if (error) {
        console.log('❌ Admin permission denied or failed:', error.message);
        reject(error);
      } else {
        console.log('✅ Successfully disabled system sleep with admin privileges');
        resolve(stdout);
      }
    });
  });
}

// Add the missing function for disarm permission
function requestDisarmPermission() {
  return new Promise((resolve, reject) => {
    const options = {
      name: 'MacBook AntiTheft Alarm',
    };
    
    console.log('🔐 Requesting admin permission to disarm/stop alarm...');
    
    // DON'T hide alarm or stop sound - just reduce window priority so dialog can appear
    if (alarmTriggered) {
      mainWindow.setAlwaysOnTop(false, 'floating', 1);
      // Keep the alarm sound playing!
    }
    
    // Use a simple command that requires admin to verify password
    // Using 'echo' with sudo just to verify the password is correct
    sudo.exec('echo "Password verified"', options, (error, stdout, stderr) => {
      if (error) {
        console.log('❌ Admin password incorrect or cancelled');
        // Restore always-on-top if auth failed and alarm is still triggered
        if (alarmTriggered) {
          mainWindow.setAlwaysOnTop(true);
        }
        reject(error);
      } else {
        console.log('✅ Admin password verified successfully');
        resolve(stdout);
      }
    });
  });
}

async function startLidMonitoring() {
  if (lidMonitorInterval) return;
  
  console.log('🛡️ Starting lid monitoring with sleep prevention...');
  
  if (process.platform === 'darwin') {
    try {
      // Request admin permission and execute pmset command in one step
      console.log('🔑 Admin permission required to prevent system sleep...');
      await requestAdminPermission();
      
      // No need for additional pmset command - already done in requestAdminPermission
      console.log('✅ System sleep prevention configured');
      
      // Start caffeinate as additional backup
      exec('caffeinate -d -i -m -s -u &', (error) => {
        if (!error) {
          console.log('✅ Additional caffeinate protection started');
        }
      });
      
      // Verify it worked
      setTimeout(() => {
        exec('pmset -g', (error, stdout) => {
          if (stdout.includes('disablesleep') && stdout.includes('1')) {
            console.log('✅ VERIFIED: System sleep is disabled');
            mainWindow.webContents.send('sleep-prevention-success');
          } else if (stdout.includes('sleep prevented')) {
            console.log('✅ VERIFIED: Sleep prevention active (via caffeinate)');
            mainWindow.webContents.send('sleep-prevention-success');
          } else {
            console.log('⚠️  Sleep prevention status unclear, but alarm is armed');
          }
        });
      }, 1000);
      
    } catch (error) {
      console.log('❌ Admin permission denied, using fallback...');
      mainWindow.webContents.send('admin-permission-denied');
      
      // Fallback to caffeinate only
      exec('caffeinate -d -i -m -s -u &', (error) => {
        if (!error) {
          console.log('✅ Fallback caffeinate started (limited protection)');
        } else {
          console.log('❌ All sleep prevention methods failed');
          mainWindow.webContents.send('sleep-prevention-failed');
          return;
        }
      });
    }
  }
  
  // Start monitoring after sleep prevention is set up
  console.log('✅ Starting lid detection monitoring...');
  
  // Initialize baseline values
  const displays = screen.getAllDisplays();
  lastDisplayCount = displays.length;
  
  // Monitor every 25ms for ultra-fast detection
  lidMonitorInterval = setInterval(() => {
    if (!isAlarmArmed || alarmTriggered) return;
    checkLidState();
  }, 25);
  
  // Monitor display changes
  screen.on('display-removed', () => {
    if (isAlarmArmed && !alarmTriggered) {
      console.log('🚨 DISPLAY REMOVED - TRIGGERING ALARM');
      triggerAlarm('Display disconnected - THIEF DETECTED!');
    }
  });
}

function stopLidMonitoring() {
  if (lidMonitorInterval) {
    clearInterval(lidMonitorInterval);
    lidMonitorInterval = null;
    console.log('🛑 Stopped lid monitoring');
    
    // Re-enable system sleep when disarmed (non-blocking, no additional password)
    if (process.platform === 'darwin') {
      // Just try to re-enable sleep without sudo (will work if we already have admin rights)
      exec('pmset -a disablesleep 0', (error) => {
        if (!error) {
          console.log('✅ Re-enabled system sleep');
        } else {
          console.log('⚠️ Could not re-enable system sleep (will reset on restart)');
        }
      });
      
      // Kill caffeinate processes
      exec('pkill caffeinate', () => {
        console.log('✅ Stopped caffeinate processes');
      });
    }
  }
}

function checkLidState() {
  if (process.platform === 'darwin') {
    // Check clamshell state
    exec('ioreg -r -k AppleClamshellState | grep AppleClamshellState', (error, stdout) => {
      if (error) return;
      if (stdout.includes('Yes') && isAlarmArmed && !alarmTriggered) {
        console.log('🚨 CLAMSHELL CLOSED - TRIGGERING ALARM');
        triggerAlarm('MacBook lid CLOSED - THIEF DETECTED!');
      }
    });
  }
  
  // Monitor display count changes
  try {
    const currentDisplays = screen.getAllDisplays();
    if (currentDisplays.length < lastDisplayCount && isAlarmArmed && !alarmTriggered) {
      console.log('🚨 DISPLAY COUNT DECREASED - TRIGGERING ALARM');
      triggerAlarm('Display removed - THEFT DETECTED!');
    }
    lastDisplayCount = currentDisplays.length;
  } catch (e) {
    if (isAlarmArmed && !alarmTriggered) {
      console.log('🚨 SCREEN API FAILED - TRIGGERING ALARM');
      triggerAlarm('Screen API failed - lid closing detected!');
    }
  }
}

function triggerAlarm(reason) {
  console.log('🚨 ALARM TRIGGERED:', reason);
  alarmTriggered = true;
  
  // Show the window prominently
  mainWindow.show();
  mainWindow.focus();
  mainWindow.setAlwaysOnTop(true);
  
  // Send alarm trigger to renderer
  mainWindow.webContents.send('alarm-triggered', reason);
  
  // Update tray
  updateTray();
}

function updateTray() {
  if (tray) {
    const menuItems = [
      {
        label: 'Show App',
        click: () => {
          mainWindow.show();
        }
      },
      {
        label: alarmTriggered ? 'Status: ALARM TRIGGERED!' : isAlarmArmed ? 'Status: ARMED' : 'Status: Disarmed',
        enabled: false
      },
      { type: 'separator' }
    ];
    
    // Add different quit options based on alarm state
    if (alarmTriggered) {
      // When alarm is triggered, add a force quit option
      menuItems.push({
        label: 'Force Quit (Admin Required)',
        click: async () => {
          try {
            // Request admin permission to force quit
            await requestDisarmPermission();
            app.isQuitting = true;
            app.quit();
          } catch (error) {
            console.log('❌ Admin permission denied for force quit');
          }
        }
      });
    } else {
      // Normal quit option
      menuItems.push({
        label: 'Quit',
        click: () => {
          app.isQuitting = true;
          app.quit();
        }
      });
    }
    
    const contextMenu = Menu.buildFromTemplate(menuItems);
    tray.setContextMenu(contextMenu);
  }
}

// App event handlers
app.whenReady().then(() => {
  createWindow();
  createTray();
  
  // Backup power monitoring
  powerMonitor.on('suspend', () => {
    if (isAlarmArmed && !alarmTriggered) {
      triggerAlarm('System suspended (backup detection)!');
    }
  });
  
  // Handle Cmd+Q (macOS) and Ctrl+Q (Windows/Linux) properly
  const template = [
    {
      label: 'MacShieldAlarm',
      submenu: [
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.isQuitting = true;
            app.quit();
          }
        }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle app quit properly
app.on('before-quit', (event) => {
  // If alarm is armed and not triggered, prevent quit and trigger alarm
  if (isAlarmArmed && !alarmTriggered) {
    event.preventDefault();
    triggerAlarm('App quit attempted while alarm was armed!');
    return;
  }
  
  // Set the quitting flag to prevent window close event from hiding the window
  app.isQuitting = true;
  
  // Clean up resources
  if (lidMonitorInterval) {
    clearInterval(lidMonitorInterval);
    lidMonitorInterval = null;
  }
  
  // Re-enable system sleep when quitting
  if (process.platform === 'darwin') {
    exec('pmset -a disablesleep 0', () => {});
    exec('pkill caffeinate', () => {});
  }
  
  // Remove tray
  if (tray) {
    tray.destroy();
    tray = null;
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

// IPC handlers for communication with renderer process
ipcMain.handle('arm-alarm', async () => {
  isAlarmArmed = true;
  alarmTriggered = false;
  
  console.log('🔧 ARMING ALARM...');
  
  try {
    await startLidMonitoring();
    updateTray();
    console.log('✅ Alarm ARMED successfully');
    return true;
  } catch (error) {
    console.log('❌ Failed to arm alarm:', error);
    isAlarmArmed = false;
    return false;
  }
});

ipcMain.handle('disarm-alarm', async () => {
  try {
    console.log('🔐 Requesting admin permission to disarm alarm...');
    
    // Temporarily disable always-on-top so password dialog can appear
    mainWindow.setAlwaysOnTop(false);
    
    // Show a clear message that password is required
    mainWindow.webContents.send('requesting-admin-password');
    
    // Request admin permission
    await requestDisarmPermission();
    
    isAlarmArmed = false;
    alarmTriggered = false;
    stopLidMonitoring();
    updateTray();
    console.log('✅ Alarm DISARMED with admin permission');
    
    // Send success event
    mainWindow.webContents.send('alarm-disarmed-success');
    return true;
  } catch (error) {
    console.log('❌ Admin permission denied - alarm remains armed');
    // Restore always-on-top if permission denied and alarm is still triggered
    if (alarmTriggered) {
      mainWindow.setAlwaysOnTop(true);
    }
    mainWindow.webContents.send('disarm-denied');
    return false;
  }
});

ipcMain.handle('get-alarm-status', () => {
  return {
    armed: isAlarmArmed,
    triggered: alarmTriggered
  };
});

ipcMain.handle('stop-alarm', async () => {
  try {
    console.log('🔐 Requesting admin permission to stop alarm...');
    
    // Temporarily disable always-on-top so password dialog can appear
    mainWindow.setAlwaysOnTop(false);
    
    // Show a clear message that password is required
    mainWindow.webContents.send('requesting-admin-password');
    
    // Request admin permission
    await requestDisarmPermission();
    
    // Stop the alarm AND disarm it completely
    alarmTriggered = false;
    isAlarmArmed = false; // Automatically disarm
    mainWindow.setAlwaysOnTop(false); // Remove always-on-top
    stopLidMonitoring(); // Stop lid monitoring
    updateTray();
    console.log('✅ Alarm STOPPED & DISARMED with admin permission');
    
    // Send success event (only this one, no separate disarm event)
    mainWindow.webContents.send('alarm-stopped-success');
    
    return true;
  } catch (error) {
    console.log('❌ Admin permission denied - alarm continues');
    // Restore always-on-top if permission denied
    mainWindow.setAlwaysOnTop(true);
    mainWindow.webContents.send('stop-denied');
    return false;
  }
});