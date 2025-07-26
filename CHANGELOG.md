# Changelog

All notable changes to MacShieldAlarm will be documented in this file.

## [1.0.1] - 2024-12-19

### 🆕 Added
- **Volume Key Blocking**: Hardware volume keys (F10, F11, F12) are now blocked during alarm state to prevent thieves from silencing the alarm
- **Volume Slider Protection**: App volume slider is locked with visual indicator during alarm to prevent tampering
- **System Volume Monitoring**: Continuous monitoring of system volume with automatic reset if tampering is detected
- **App Restart Mechanism**: Smart restart functionality to fully restore volume key functionality after disarming
- **State Preservation**: Alarm state is maintained across app restarts for seamless user experience
- **Enhanced User Notifications**: Comprehensive notifications for volume protection status and restoration progress

### 🔧 Technical Changes
- Added `globalShortcut` API integration for volume key blocking
- Implemented volume monitoring with 100ms intervals during alarm
- Added state management system for app restart functionality
- Enhanced error handling for volume key registration failures
- Added IPC event handlers for volume protection status updates

### 🛡️ Security Enhancements
- **Multi-layer Volume Protection**: Hardware keys, app interface, and system volume are all protected
- **Admin Authentication Integration**: Volume protection is only removed after correct admin password
- **Graceful Fallback**: Continues protection even if some volume blocking methods fail
- **Real-time Monitoring**: Prevents volume changes from any source during alarm

### 🐛 Fixed
- Volume keys now properly restore functionality after alarm disarm (via app restart)
- Improved error handling for volume key registration failures
- Enhanced user feedback for volume protection status

### 📝 Documentation
- Updated README with comprehensive volume protection system documentation
- Added troubleshooting section for volume key restoration
- Updated version number to reflect new features

### 🔄 Known Limitations
- Volume keys require app restart to fully restore functionality due to macOS security limitations
- This is a known Electron limitation where kernel-level hooks persist until process termination
- The app restart mechanism provides a seamless solution to this limitation

## [1.0.0] - 2024-12-18

### 🆕 Initial Release
- **Lid Monitoring**: Detects when MacBook lid is closed and triggers alarm
- **Admin Protection**: Requires admin password to arm/disarm alarm
- **Volume Control**: Adjustable alarm volume from 10% to 100%
- **System Integration**: Prevents system sleep while armed
- **Clean UI**: Modern interface with emergency stop button
- **Background Operation**: Continues monitoring when minimized to tray 