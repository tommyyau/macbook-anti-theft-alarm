# MacBook Anti-Theft Alarm

A simple but effective anti-theft alarm system for MacBooks that detects when someone tries to close your laptop lid and triggers a loud alarm.

## 🛡️ Features

- **Lid Monitoring**: Instantly detects when your MacBook lid is closed
- **Admin Protection**: Requires admin password to arm/disarm (prevents thieves from simply clicking "stop")
- **Volume Control**: Adjustable alarm volume from 10% to 100%
- **System Integration**: Prevents system sleep while armed
- **Clean UI**: Modern, intuitive interface with prominent emergency stop button

## 📦 Installation

### Option 1: Download DMG (Recommended)

**Direct Download:**
- [Download DMG File](https://github.com/tommyyau/macbook-anti-theft-alarm/raw/main/MacBook%20Anti-Theft%20Alarm-1.0.0-arm64.dmg) (89MB)

**Or from Releases:**
1. Go to the [Releases](https://github.com/tommyyau/macbook-anti-theft-alarm/releases) page
2. Download the latest `MacBook Anti-Theft Alarm-1.0.0-arm64.dmg` file
3. Double-click the DMG file to mount it
4. Drag the app to your Applications folder
5. Eject the DMG

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
npm run build-dmg
```

## 🚀 Usage

1. **Launch the app** from your Applications folder
2. **Arm the alarm** - You'll be prompted for your admin password to prevent system sleep
3. **Minimize to system tray** - The app continues running in the background
4. **If someone closes your lid** - The alarm triggers immediately with a loud sound
5. **Stop the alarm** - Click the prominent "Stop Alarm" button and enter your admin password

## 🔐 Security Features

- **Admin Authentication**: Both arming and disarming require your macOS admin password
- **System Integration**: Uses macOS system commands to prevent sleep and monitor lid state
- **Background Operation**: Continues monitoring even when the app is minimized

## ⚠️ Important Notes

- **macOS Gatekeeper**: When you first run the app, macOS may show a security warning. Click "Open Anyway" in System Preferences > Security & Privacy
- **Admin Permissions**: The app requires admin privileges to prevent system sleep and monitor hardware
- **Volume Control**: Adjust the alarm volume before arming to your preferred level

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

**Permission denied errors?**
- The app needs admin access to monitor hardware and prevent sleep
- Enter your password when prompted

## 🔄 Updates

The app will automatically check for updates. New releases will be available on the [GitHub Releases](https://github.com/tommyyau/macbook-anti-theft-alarm/releases) page. 