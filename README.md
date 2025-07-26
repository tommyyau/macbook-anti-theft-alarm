# MacShieldAlarm

A simple but effective anti-theft alarm system for MacBooks with MacShield protection that detects when someone tries to close your laptop lid and triggers a loud alarm.

## 🛡️ Features

- **Lid Monitoring**: Instantly detects when your MacBook lid is closed
- **Admin Protection**: Requires admin password to arm/disarm (prevents thieves from simply clicking "stop")
- **Volume Key Blocking**: Blocks hardware volume keys (F10, F11, F12) during alarm to prevent silencing
- **Volume Control**: Adjustable alarm volume from 10% to 100% with protection during alarm
- **System Integration**: Prevents system sleep while armed
- **Volume Monitoring**: Continuously monitors and resets system volume if tampered with
- **Clean UI**: Modern, intuitive interface with prominent emergency stop button

## 📦 Installation

**⚠️ Important**: Due to macOS security features, you may see a "corrupt" or "damaged" warning when installing. This is normal for unsigned apps. See the [Installation Guide](INSTALLATION.md) for detailed instructions on how to handle this.

### Option 1: Download DMG (Recommended)

**Latest Release:**
1. Download the latest DMG: **[MacShieldAlarm-1.0.0-arm64.dmg](MacShieldAlarm-1.0.0-arm64.dmg)** (96.8 MB)
2. Follow the [Installation Guide](INSTALLATION.md) to handle the security warning
3. Drag the app to your Applications folder

**From GitHub Releases:**
1. Go to the [Releases](https://github.com/tommyyau/macbook-anti-theft-alarm/releases) page
2. Download the latest `.dmg` file
3. Follow the [Installation Guide](INSTALLATION.md) to handle the security warning
4. Drag the app to your Applications folder

### Option 2: Build from Source

```bash
# Clone the repository
git clone https://github.com/tommyyau/macbook-anti-theft-alarm.git
cd macbook-anti-theft-alarm

# Install dependencies
npm install

# Run the app
npm start

# Build DMG (optional)
npm run dev-build
```

## 🚀 Usage

1. **Launch the app** from your Applications folder
2. **Arm the alarm** - You'll be prompted for your admin password to prevent system sleep
3. **Minimize to system tray** - The app continues running in the background
4. **If someone closes your lid** - The alarm triggers immediately with a loud sound
5. **Stop the alarm** - Click the prominent "Stop Alarm" button and enter your admin password

## 🔐 Security Features

- **Admin Authentication**: Both arming and disarming require your macOS admin password
- **Volume Key Protection**: Hardware volume keys (F10, F11, F12) are blocked during alarm state
- **Volume Tampering Prevention**: App volume slider is locked and system volume is monitored during alarm
- **System Integration**: Uses macOS system commands to prevent sleep and monitor lid state
- **Background Operation**: Continues monitoring even when the app is minimized

## 🔊 Volume Protection System

MacShieldAlarm includes a comprehensive volume protection system to prevent thieves from silencing the alarm:

### **Hardware Volume Key Blocking**
- **F10 (Mute)**: Blocked during alarm to prevent muting
- **F11 (Volume Down)**: Blocked during alarm to prevent volume reduction
- **F12 (Volume Up)**: Blocked during alarm to prevent volume manipulation

### **App-Level Protection**
- **Volume Slider**: Locked with visual indicator during alarm
- **Volume Controls**: Disabled to prevent tampering through the app interface

### **System-Level Monitoring**
- **Continuous Monitoring**: Checks system volume every 100ms during alarm
- **Automatic Reset**: Resets volume to alarm level if detected tampering
- **Real-time Protection**: Prevents volume changes from any source

### **Volume Key Restoration**
- **Smart Restart**: App offers to restart to fully restore volume key functionality
- **State Preservation**: Alarm state is maintained across restarts
- **User Choice**: You can choose to restart immediately or later

## ⚠️ Important Notes

- **macOS Gatekeeper**: When you first run the app, macOS may show a security warning. Click "Open Anyway" in System Preferences > Security & Privacy
- **Admin Permissions**: The app requires admin privileges to prevent system sleep and monitor hardware
- **Volume Control**: Adjust the alarm volume before arming to your preferred level
- **Volume Key Restoration**: After disarming, volume keys may require an app restart to fully restore functionality (this is normal due to macOS security limitations)

## 🛠️ Development

### Prerequisites
- Node.js 18+
- npm
- macOS (for building DMG)

### Build Commands
```bash
npm start          # Run in development mode
npm run build-dmg  # Build DMG for distribution
npm run build-mac  # Build macOS app
```

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## ⚡ Troubleshooting

**App won't start?**
- Check that you have admin privileges
- Try running from terminal: `npm start`

**Alarm not triggering?**
- Ensure the app is armed (green "Armed" status)
- Check that system sleep prevention is active
- Verify volume is not set to 0%

**Volume keys not working after disarming?**
- This is normal due to macOS security limitations
- The app will offer to restart to fully restore volume key functionality
- You can also manually restart the app to restore volume keys

**Permission denied errors?**
- The app needs admin access to monitor hardware and prevent sleep
- Enter your password when prompted

## 🔄 Updates

The app will automatically check for updates. New releases will be available on the [GitHub Releases](https://github.com/tommyyau/macbook-anti-theft-alarm/releases) page.

## 📦 Current Release

**MacShieldAlarm v1.0.1**
- ✅ **NEW**: Volume key blocking (F10, F11, F12) during alarm to prevent silencing
- ✅ **NEW**: Volume slider protection with visual lock indicator during alarm
- ✅ **NEW**: System volume monitoring and automatic reset if tampered with
- ✅ **NEW**: App restart mechanism to fully restore volume key functionality
- ✅ **NEW**: Enhanced user notifications for volume protection status
- ✅ Fixed quit functionality with proper app lifecycle management
- ✅ Updated icon design with rounded corners and MacShield branding
- ✅ Enhanced security with admin password protection
- ✅ Improved UI/UX with better tray integration
- ✅ Renamed to MacShieldAlarm for brand consistency 