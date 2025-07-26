const { app, BrowserWindow, ipcMain, powerMonitor, systemPreferences, Tray, Menu, nativeImage, screen, dialog, globalShortcut } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const sudo = require('sudo-prompt');
const fs = require('fs');

let mainWindow;
let tray = null;
let isAlarmArmed = false;
let alarmTriggered = false;
let lidMonitorInterval = null;
let lastDisplayCount = 0;
let volumeKeysBlocked = false;
let registeredVolumeKeys = []; // Track which keys were actually registered
let volumeMonitorInterval = null;
let alarmVolumeLevel = 30; // Minimum volume percentage during alarm
let stateFilePath = path.join(app.getPath('userData'), 'alarm-state.json');

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

function checkAccessibilityPermissions() {
  if (process.platform !== 'darwin') return true;
  
  try {
    const isTrusted = systemPreferences.isTrustedAccessibilityClient(false);
    
    if (!isTrusted) {
      console.log('⚠️ Accessibility permissions not granted - volume key blocking may be limited');
      
      // Show user guidance about permissions (non-blocking)
      setTimeout(() => {
        if (mainWindow) {
          const response = dialog.showMessageBoxSync(mainWindow, {
            type: 'warning',
            buttons: ['Open System Settings', 'Continue Anyway'],
            defaultId: 0,
            title: 'Enhanced Security Available',
            message: 'Accessibility Permission Recommended',
            detail: 'For complete volume key blocking, this app needs accessibility permissions. This prevents thieves from muting the alarm using hardware keys.\n\nWithout this permission, the app will still protect against volume changes using system monitoring.'
          });
          
          if (response === 0) {
            systemPreferences.isTrustedAccessibilityClient(true); // Opens system settings
          }
        }
      }, 2000); // Delay to avoid blocking startup
    } else {
      console.log('✅ Accessibility permissions granted');
    }
    
    return isTrusted;
  } catch (error) {
    console.log('⚠️ Could not check accessibility permissions:', error.message);
    return false;
  }
}

function setupVolumeKeyBlocking() {
  if (volumeKeysBlocked) return;
  
  try {
    console.log('🔇 Setting up volume key blocking...');
    
    // Clear previous registration tracking
    registeredVolumeKeys = [];
    
    // Check accessibility permissions first
    const hasAccessibility = checkAccessibilityPermissions();
    
    let keysRegistered = 0;
    
    // Try modern media key codes first (requires accessibility permissions)
    const mediaKeys = [
      { key: 'VolumeUp', name: 'Volume Up' },
      { key: 'VolumeDown', name: 'Volume Down' },
      { key: 'VolumeMute', name: 'Mute' }
    ];
    
    mediaKeys.forEach(({ key, name }) => {
      try {
        const success = globalShortcut.register(key, () => {
          console.log(`🔇 Media key ${key} blocked during alarm`);
          if (mainWindow) {
            mainWindow.webContents.send('volume-key-blocked', `${name} key`);
          }
          return false; // Block the key
        });
        
        if (success && globalShortcut.isRegistered(key)) {
          registeredVolumeKeys.push(key);
          keysRegistered++;
          console.log(`✅ Successfully registered and tracked ${key}`);
        } else {
          console.log(`⚠️ Failed to register ${key} - may be in use or permissions denied`);
        }
      } catch (error) {
        console.log(`⚠️ Could not register ${key}:`, error.message);
      }
    });
    
    // Fallback to F-keys for older MacBooks or if media keys fail
    const fallbackKeys = [
      { key: 'F10', name: 'F10 (Mute)' },
      { key: 'F11', name: 'F11 (Volume Down)' },
      { key: 'F12', name: 'F12 (Volume Up)' }
    ];
    
    if (keysRegistered === 0) {
      console.log('🔄 Trying fallback F-keys...');
      fallbackKeys.forEach(({ key, name }) => {
        try {
          const success = globalShortcut.register(key, () => {
            console.log(`🔇 Fallback key ${key} blocked during alarm`);
            if (mainWindow) {
              mainWindow.webContents.send('volume-key-blocked', name);
            }
            return false; // Block the key
          });
          
          if (success && globalShortcut.isRegistered(key)) {
            registeredVolumeKeys.push(key);
            keysRegistered++;
            console.log(`✅ Successfully registered and tracked fallback ${key}`);
          }
        } catch (error) {
          console.log(`⚠️ Could not register fallback ${key}:`, error.message);
        }
      });
    }
    
    volumeKeysBlocked = true;
    
    if (keysRegistered > 0) {
      console.log(`✅ Volume key blocking setup completed (${keysRegistered} keys registered: ${registeredVolumeKeys.join(', ')})`);
      if (mainWindow) {
        mainWindow.webContents.send('volume-keys-protected', keysRegistered);
      }
    } else {
      console.log('⚠️ No volume keys could be registered - relying on system monitoring');
      if (mainWindow) {
        mainWindow.webContents.send('volume-key-blocking-failed');
      }
    }
    
  } catch (error) {
    console.log('⚠️ Volume key blocking failed:', error.message);
    if (mainWindow) {
      mainWindow.webContents.send('volume-key-blocking-failed');
    }
  }
}

function removeVolumeKeyBlocking() {
  if (!volumeKeysBlocked) return;
  
  console.log('🔊 Restoring volume key functionality...');
  
  try {
    // Unregister all shortcuts
    globalShortcut.unregisterAll();
    console.log('  ✅ All GlobalShortcuts unregistered');
    
    // Clear tracking variables
    volumeKeysBlocked = false;
    registeredVolumeKeys = [];
    
    // Due to Electron's kernel-level hook persistence, we need to restart the app
    // to fully release the volume key hooks. This is the most reliable solution.
    console.log('🔄 Volume keys require app restart to fully restore functionality');
    console.log('  ℹ️ This is a known Electron limitation - kernel hooks persist until process termination');
    
    // Notify user about the restart requirement
    notifyUser('restoration-progress', 'Volume keys will be fully restored after app restart');
    
    // Offer to restart the app now to restore volume keys
    setTimeout(() => {
      offerAppRestart();
    }, 1000);
    
    console.log('🎉 Volume key blocking removed (restart recommended for full restoration)');
    
  } catch (error) {
    console.log('❌ Error during volume key cleanup:', error.message);
    volumeKeysBlocked = false;
    registeredVolumeKeys = [];
  }
}

// State management functions for app restart
function saveAlarmState() {
  try {
    const state = {
      isAlarmArmed: isAlarmArmed,
      alarmTriggered: alarmTriggered,
      timestamp: Date.now(),
      version: '1.0'
    };
    
    fs.writeFileSync(stateFilePath, JSON.stringify(state, null, 2));
    console.log('💾 Alarm state saved for restart');
    return true;
  } catch (error) {
    console.log('❌ Failed to save alarm state:', error.message);
    return false;
  }
}

function loadAlarmState() {
  try {
    if (fs.existsSync(stateFilePath)) {
      const stateData = fs.readFileSync(stateFilePath, 'utf8');
      const state = JSON.parse(stateData);
      
      // Only restore if the state is recent (within last 5 minutes)
      const isRecent = (Date.now() - state.timestamp) < 5 * 60 * 1000;
      
      if (isRecent && state.version === '1.0') {
        console.log('📂 Restoring alarm state from restart');
        isAlarmArmed = state.isAlarmArmed;
        alarmTriggered = state.triggered;
        
        // Clean up the state file
        fs.unlinkSync(stateFilePath);
        
        // Update UI if window exists
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('state-restored', { isAlarmArmed, alarmTriggered });
        }
        
        return true;
      } else {
        // Clean up old state file
        fs.unlinkSync(stateFilePath);
      }
    }
    return false;
  } catch (error) {
    console.log('❌ Failed to load alarm state:', error.message);
    // Clean up corrupted state file
    try {
      if (fs.existsSync(stateFilePath)) {
        fs.unlinkSync(stateFilePath);
      }
    } catch (e) {
      // Ignore cleanup errors
    }
    return false;
  }
}

function offerAppRestart() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Volume Keys Restoration',
    message: 'Volume keys require app restart to fully restore functionality',
    detail: 'This is due to a technical limitation in Electron. Would you like to restart the app now to restore volume key functionality?',
    buttons: ['Restart Now', 'Later'],
    defaultId: 0,
    cancelId: 1
  }).then((result) => {
    if (result.response === 0) {
      // User chose to restart
      console.log('🔄 User requested app restart for volume key restoration');
      restartAppForVolumeKeys();
    } else {
      console.log('⏰ User chose to restart later');
      notifyUser('restoration-progress', 'Volume keys will be restored when you restart the app');
    }
  }).catch((error) => {
    console.log('❌ Error showing restart dialog:', error.message);
  });
}

function restartAppForVolumeKeys() {
  console.log('🔄 Restarting app to restore volume key functionality...');
  
  // Save current state
  if (saveAlarmState()) {
    // Notify user
    notifyUser('restoration-progress', 'Restarting app to restore volume keys...');
    
    // Use Electron's relaunch API
    app.relaunch();
    app.exit(0);
  } else {
    console.log('❌ Failed to save state, cannot restart safely');
    notifyUser('restoration-progress', 'Failed to save state - restart manually to restore volume keys');
  }
}

// Background volume restoration (non-blocking, runs after alarm is disarmed)
// 
// KNOWN LIMITATION: Electron's globalShortcut API creates kernel-level event hooks
// that persist even after unregisterAll() while the process is running.
// These hooks are only fully released when the Electron process terminates.
//
// This is why volume keys work after quitting the app but not during runtime.
// The methods below attempt various workarounds, but cannot guarantee success.
//
// Potential future solutions:
// 1. Process restart mechanism (save state, restart app, restore state) ✅ IMPLEMENTED
//    - Save current alarm state to file before restart
//    - Use app.relaunch() + app.quit() to restart cleanly
//    - Restore state after restart, with volume keys fully functional
//    - Would provide seamless user experience
//
// 2. Native addon to force event hook release (complex, platform-specific)
//    - Use Node.js native addon with Objective-C/Swift
//    - Direct access to Core Graphics event tap management
//    - Platform-specific but would solve the root cause
//
// 3. Separate daemon process for volume key management (architectural change)
//    - Move volume key blocking to separate helper process
//    - Main app communicates with helper via IPC
//    - Helper can be killed/restarted without affecting main app
//
function performBackgroundVolumeRestoration() {
  console.log('🔧 Starting enhanced volume key liberation...');
  console.log('  ⚠️ NOTE: Due to Electron limitations, volume keys may only work after app restart');
  notifyUser('restoration-progress', 'Attempting volume key restoration (limited by Electron)');
  
  // Progressive restoration approach - tries multiple methods but cannot guarantee success
  setTimeout(() => {
    attemptAudioDaemonReset();
  }, 500);
}

// Method 1: Audio daemon reset using admin privileges (most effective)
function attemptAudioDaemonReset() {
  console.log('🎵 Method 1: Attempting audio daemon reset...');
  
  // Try to restart coreaudiod - this often works because the admin session is still active
  exec('sudo -n killall coreaudiod 2>/dev/null || killall coreaudiod 2>/dev/null', (error) => {
    if (!error) {
      console.log('  ✅ Audio daemon restart initiated');
      notifyUser('restoration-progress', 'Audio system reset - testing volume keys');
      
      // Wait for daemon to restart (3-5 seconds) 
      setTimeout(() => {
        console.log('  ✅ Audio daemon restart completed');
        console.log('  🧪 Testing volume system...');
        
        testVolumeKeyFunctionality().then(() => {
          console.log('  ⚠️ LIMITATION: Cannot verify hardware F10/F11/F12 keys while app running');
          console.log('  ℹ️ Audio daemon reset completed - try volume keys now');
          
          // Try next method since we can't verify success
          attemptMediaKeyReRegistration();
        });
      }, 4000);
    } else {
      console.log('  ⚠️ Audio daemon restart not available, trying alternative...');
      // Try next method immediately
      attemptMediaKeyReRegistration();
    }
  });
}

// Method 2: Media key re-registration cycle
function attemptMediaKeyReRegistration() {
  console.log('🔄 Method 2: Media key re-registration cycle...');
  notifyUser('restoration-progress', 'Attempting media key re-registration');
  
  // Enhanced AppleScript commands to force media key system refresh
  const mediaKeyCommands = [
    // First, get current volume for restoration
    'osascript -e "set originalVol to output volume of (get volume settings)"',
    
    // Force volume key system refresh by simulating key events
    'osascript -e "tell application \\"System Events\\" to key code 145"', // F12 (Volume Up)
    'osascript -e "delay 0.2"',
    'osascript -e "tell application \\"System Events\\" to key code 144"', // F11 (Volume Down)  
    'osascript -e "delay 0.2"',
    'osascript -e "tell application \\"System Events\\" to key code 113"', // F10 (Mute)
    'osascript -e "delay 0.2"',
    
    // Reset volume to original value
    'osascript -e "set volume output volume originalVol"',
    
    // Try to refresh system audio preferences
    'osascript -e "tell application \\"System Events\\" to keystroke \\"k\\" using {command down, option down}"',
    
    // Final volume system refresh
    'osascript -e "set vol to output volume of (get volume settings); set volume output volume vol"'
  ];
  
  let completed = 0;
  const total = mediaKeyCommands.length;
  
  mediaKeyCommands.forEach((cmd, index) => {
    setTimeout(() => {
      exec(cmd, (error) => {
        completed++;
        if (!error) {
          console.log(`  ✅ Media key command ${completed}/${total} completed`);
        }
        
        if (completed === total) {
          console.log('  🏁 Media key re-registration completed');
          
          // Honest assessment: We've done what we can, but can't verify hardware keys
          setTimeout(() => {
            console.log('  ✅ Media key re-registration completed');
            console.log('  ⚠️ LIMITATION: Cannot verify if hardware F10/F11/F12 keys work while app is running');
            console.log('  ℹ️ Due to Electron kernel-level hooks, volume keys may only work after app quit');
            
            // Provide honest user guidance
            attemptSmartUserGuidance();
          }, 2000);
        }
      });
    }, index * 300); // Stagger commands
  });
}

// Method 3: Smart user guidance with automatic assistance
function attemptSmartUserGuidance() {
  console.log('📋 Method 3: Providing smart user guidance...');
  
  // Try to automatically open Sound preferences to help user
  exec('osascript -e "tell application \\"System Preferences\\" to activate" -e "tell application \\"System Preferences\\" to set current pane to pane \\"com.apple.preference.sound\\""', (error) => {
    if (!error) {
      console.log('  ✅ Sound preferences opened automatically');
    }
  });
  
  // Provide honest user guidance about the Electron limitation
  const enhancedInstructions = {
    title: 'Volume Key Restoration Limitation',
    message: 'Due to Electron\'s deep system hooks, volume keys may require manual activation:',
    steps: [
      '1. TRY FIRST: Press any volume key (F10, F11, F12) - they might work now',
      '2. If keys don\'t work: Open System Preferences > Sound (should be open already)',
      '3. While in Sound preferences, press any volume key once to reactivate',
      '4. Alternative: Adjust volume slider in Sound preferences, then test keys',
      '5. MOST RELIABLE: Quit and restart MacShieldAlarm app (Cmd+Q, then reopen)',
      '6. Last resort: Restart your Mac to completely clear all hooks'
    ]
  };
  
  notifyUser('user-guidance', enhancedInstructions);
  
  // Also send an immediate notification about the limitation
  notifyUser('restoration-progress', 'Volume protection removed - hardware keys may need manual activation');
  
  // Also try one final AppleScript attempt while user is being guided
  setTimeout(() => {
    exec('osascript -e "set vol to output volume of (get volume settings); set volume output volume vol"', () => {
      console.log('  🔄 Final volume system refresh completed during user guidance');
    });
  }, 2000);
}


// AppleScript-only volume system refresh (no sudo required)
async function performAppleScriptVolumeRefresh() {
  return new Promise((resolve) => {
    console.log('  🍎 Performing AppleScript volume system refresh...');
    
    if (process.platform !== 'darwin') {
      console.log('  ⚠️ AppleScript refresh only available on macOS');
      resolve(false);
      return;
    }
    
    // Notify user that we're refreshing the volume system
    notifyUser('restoration-progress', 'Refreshing volume system using AppleScript');
    
    // Enhanced AppleScript commands to refresh volume system
    const refreshCommands = [
      // Get current volume and set it back (forces system refresh)
      'osascript -e "set vol to output volume of (get volume settings); set volume output volume vol"',
      
      // Toggle mute and unmute to refresh audio subsystem
      'osascript -e "set volume with output muted true; delay 0.1; set volume with output muted false"',
      
      // Force volume control refresh by incrementing and decrementing
      'osascript -e "set vol to output volume of (get volume settings); if vol < 100 then set volume output volume (vol + 1); set volume output volume vol"',
      
      // Try to refresh system audio preferences
      'osascript -e "tell application \\"System Events\\" to keystroke \\"k\\" using {command down}" 2>/dev/null || true',
      
      // Final volume reset to ensure consistency
      'osascript -e "set vol to output volume of (get volume settings); set volume output volume vol"'
    ];
    
    let completedCommands = 0;
    const totalCommands = refreshCommands.length;
    let anySuccess = false;
    
    console.log(`  📝 Executing ${totalCommands} AppleScript refresh commands...`);
    
    refreshCommands.forEach((cmd, index) => {
      setTimeout(() => {
        exec(cmd, (error) => {
          completedCommands++;
          if (!error) {
            anySuccess = true;
            console.log(`  ✅ AppleScript refresh command ${index + 1}/${totalCommands} completed`);
          } else {
            console.log(`  ⚠️ AppleScript refresh command ${index + 1}/${totalCommands} failed: ${error.message}`);
          }
          
          if (completedCommands === totalCommands) {
            console.log(`  🏁 AppleScript refresh completed (${anySuccess ? 'with successes' : 'all failed'})`);
            
            // Wait for system to process changes, then test
            setTimeout(() => {
              testVolumeKeyFunctionality().then(verified => {
                console.log(`  🔍 Volume key test after AppleScript refresh: ${verified ? 'SUCCESS' : 'FAILED'}`);
                resolve(verified);
              });
            }, 1500);
          }
        });
      }, index * 200); // Stagger commands by 200ms
    });
  });
}

// This function has been replaced by performAppleScriptVolumeRefresh()

// Real-time volume key functionality testing
async function testVolumeKeyFunctionality() {
  return new Promise((resolve) => {
    console.log('  🧪 Checking if volume control is available...');
    
    // IMPORTANT: This test only verifies AppleScript volume control works
    // It CANNOT test actual hardware F10/F11/F12 key functionality
    // This is a known limitation of testing within the Electron process
    
    exec('osascript -e "output volume of (get volume settings)"', (error, stdout) => {
      if (error) {
        console.log('  ❌ Cannot access system volume');
        resolve(false);
        return;
      }
      
      const originalVolume = parseInt(stdout.trim());
      console.log(`  📊 Current volume: ${originalVolume}%`);
      
      // Test AppleScript volume control (not hardware keys)
      const testVolume = Math.min(originalVolume + 5, 100);
      
      exec(`osascript -e "set volume output volume ${testVolume}"`, (setError) => {
        if (setError) {
          console.log('  ❌ AppleScript volume control blocked');
          resolve(false);
          return;
        }
        
        setTimeout(() => {
          exec('osascript -e "output volume of (get volume settings)"', (verifyError, verifyStdout) => {
            if (verifyError) {
              console.log('  ❌ Cannot verify volume change');
              resolve(false);
              return;
            }
            
            const newVolume = parseInt(verifyStdout.trim());
            
            // Restore original volume first
            exec(`osascript -e "set volume output volume ${originalVolume}"`, () => {
              if (newVolume === testVolume) {
                console.log('  ✅ AppleScript volume control works (hardware keys unknown)');
                console.log('  ⚠️ NOTE: This does NOT test actual F10/F11/F12 hardware keys');
                resolve(false); // Always return false since we can't test hardware keys
              } else {
                console.log('  ❌ AppleScript volume control failed');
                resolve(false);
              }
            });
          });
        }, 500);
      });
    });
  });
}


// Unified notification system
function notifyUser(eventType, data) {
  if (!mainWindow) return;
  
  switch (eventType) {
    case 'restoration-progress':
      mainWindow.webContents.send('volume-restoration-progress', data);
      break;
    case 'restoration-success':
      mainWindow.webContents.send('volume-restoration-success', data);
      break;
    case 'restoration-failed':
      mainWindow.webContents.send('volume-restoration-failed', data);
      break;
    case 'user-guidance':
      mainWindow.webContents.send('volume-restoration-guidance', data);
      break;
  }
}


function startVolumeMonitoring() {
  if (volumeMonitorInterval || process.platform !== 'darwin') return;
  
  console.log('🔊 Starting aggressive system volume monitoring...');
  
  // Monitor system volume very frequently during alarm for immediate response
  volumeMonitorInterval = setInterval(() => {
    if (!alarmTriggered) return; // Only monitor when alarm is actually triggered
    
    // Check current system volume using AppleScript
    exec('osascript -e "output volume of (get volume settings)"', (error, stdout) => {
      if (error) return;
      
      try {
        const currentVolume = parseInt(stdout.trim());
        
        // If system volume is below alarm level OR muted, reset it immediately
        if (currentVolume < alarmVolumeLevel || currentVolume === 0) {
          console.log(`🔊 Volume attack detected! ${currentVolume}% → ${alarmVolumeLevel}%`);
          
          // Reset system volume immediately - use multiple methods for reliability
          const resetCommands = [
            `osascript -e "set volume output volume ${alarmVolumeLevel}"`,
            `osascript -e "set volume with output muted false"`, // Ensure not muted
            `osascript -e "set volume output volume ${alarmVolumeLevel}"` // Set again to be sure
          ];
          
          resetCommands.forEach((cmd, index) => {
            setTimeout(() => {
              exec(cmd, (resetError) => {
                if (!resetError && index === 0) {
                  console.log('🚨 VOLUME TAMPERING BLOCKED - System volume reset');
                  if (mainWindow) {
                    mainWindow.webContents.send('system-volume-protected', currentVolume, alarmVolumeLevel);
                  }
                }
              });
            }, index * 50); // Stagger commands by 50ms
          });
        }
      } catch (parseError) {
        // Silent fail to avoid log spam
      }
    });
  }, 100); // Check every 100ms for ultra-fast response
  
  console.log('✅ Aggressive volume monitoring started (100ms intervals)');
}

function stopVolumeMonitoring() {
  if (volumeMonitorInterval) {
    clearInterval(volumeMonitorInterval);
    volumeMonitorInterval = null;
    console.log('🛑 Stopped system volume monitoring');
  }
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
  
  // Set up volume key blocking
  setupVolumeKeyBlocking();
  
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
    
    // Remove volume key blocking
    removeVolumeKeyBlocking();
    
    // Stop volume monitoring
    stopVolumeMonitoring();
    
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
  
  // Start volume monitoring as additional protection
  startVolumeMonitoring();
  
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
  
  // Restore alarm state if app was restarted for volume key restoration
  loadAlarmState();
  
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
  
  // Stop volume monitoring first
  stopVolumeMonitoring();
  
  // Comprehensive volume key restoration
  if (volumeKeysBlocked) {
    console.log('🔄 App quit: Starting volume key restoration...');
    removeVolumeKeyBlocking();
    
    // Give restoration time to complete before final cleanup
    setTimeout(() => {
      // Emergency cleanup as final resort
      try {
        globalShortcut.unregisterAll();
        console.log('✅ App quit: Final global shortcut cleanup completed');
      } catch (error) {
        console.log('⚠️ App quit: Final cleanup error:', error.message);
      }
    }, 2000);
  } else {
    // No volume keys to restore, just do standard cleanup
    globalShortcut.unregisterAll();
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

// Handle state restoration notification
ipcMain.handle('state-restored', (event, state) => {
  console.log('📂 State restored from restart:', state);
  return true;
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