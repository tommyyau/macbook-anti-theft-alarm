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
    width: 500,
    height: 750,
    minWidth: 450,
    minHeight: 600,
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
    } else if (!app.isQuiting) {
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
  
  // Get the content size
  mainWindow.webContents.executeJavaScript(`
    const body = document.body;
    const html = document.documentElement;
    const height = Math.max(
      body.scrollHeight,
      body.offsetHeight,
      html.clientHeight,
      html.scrollHeight,
      html.offsetHeight
    );
    const width = Math.max(
      body.scrollWidth,
      body.offsetWidth,
      html.clientWidth,
      html.scrollWidth,
      html.offsetWidth
    );
    { height: height + 50, width: width + 50 }; // Add padding
  `).then((size) => {
    if (size && size.height && size.width) {
      // Ensure minimum size
      const newHeight = Math.max(size.height, 600);
      const newWidth = Math.max(size.width, 450);
      
      // Resize window to fit content
      mainWindow.setSize(newWidth, newHeight);
      
      // Center the window on screen
      mainWindow.center();
    }
  }).catch((error) => {
    console.log('Auto-resize failed:', error);
  });
}

function createTray() {
  // Create tray icon (using a simple emoji for now)
  const trayIcon = nativeImage.createFromPath(path.join(__dirname, 'tray-icon.png')).resize({ width: 16, height: 16 });
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
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  tray.setToolTip('MacBook Anti-Theft Alarm');
  
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
    
    // Re-enable system sleep when disarmed
    if (process.platform === 'darwin') {
      // Use the existing requestDisarmPermission to get admin rights, then re-enable sleep
      const options = {
        name: 'MacBook AntiTheft Alarm',
      };
      
      sudo.exec('pmset -a disablesleep 0', options, (error) => {
        if (!error) {
          console.log('✅ Re-enabled system sleep with admin privileges');
        } else {
          // Try without sudo as fallback
          exec('pmset -a disablesleep 0', (error) => {
            if (!error) console.log('✅ Re-enabled system sleep (no sudo)');
          });
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
    const contextMenu = Menu.buildFromTemplate([
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
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.isQuiting = true;
          app.quit();
        }
      }
    ]);
    
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
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
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
    
    alarmTriggered = false;
    mainWindow.setAlwaysOnTop(false); // Remove always-on-top
    updateTray();
    console.log('✅ Alarm STOPPED with admin permission');
    
    // Send success event
    mainWindow.webContents.send('alarm-stopped-success');
    
    // Note: We don't stop lid monitoring here - alarm remains armed
    // User must explicitly disarm to stop monitoring
    
    return true;
  } catch (error) {
    console.log('❌ Admin permission denied - alarm continues');
    // Restore always-on-top if permission denied
    mainWindow.setAlwaysOnTop(true);
    mainWindow.webContents.send('stop-denied');
    return false;
  }
});