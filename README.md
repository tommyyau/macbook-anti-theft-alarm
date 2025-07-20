# MacBook Anti-Theft Alarm 🛡️

A simple yet effective Electron-based anti-theft alarm system designed specifically for MacBooks and other laptops. This application helps protect your device in public spaces by triggering a loud alarm when someone attempts to close the lid or put the system to sleep while you're away.

## ✨ Features

- 🛡️ **One-Click Protection** - Simple arm/disarm functionality
- 🔍 **Lid Close Detection** - Monitors system suspend events
- 🚨 **Loud Alarm Sound** - Generated audio alarm to alert nearby people
- 📱 **System Tray Integration** - Runs discreetly in the background
- 🎯 **Cross-Platform** - Works on macOS, Windows, and Linux
- ⌨️ **Keyboard Shortcuts** - Quick access to all functions
- 🎨 **Clean Interface** - Modern, intuitive design

## 🚀 Quick Start

### Prerequisites
- Node.js (version 16 or higher)
- npm (comes with Node.js)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/macbook-anti-theft-alarm.git
   cd macbook-anti-theft-alarm
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the application**
   ```bash
   npm start
   ```

## 📖 How It Works

1. **Arm the alarm** before leaving your MacBook unattended
2. **Minimize the app** - it continues running in the system tray
3. If someone **closes the lid** or puts the system to sleep, the alarm triggers
4. **Return and disarm** to safely use your MacBook again

## 🎮 Usage

### Basic Operation
- Click **"🛡️ Arm Alarm"** to activate protection
- The status will change to **"Armed & Protected"**
- Close or minimize the app (it stays running in system tray)
- If someone closes the laptop lid, the alarm will trigger
- Return and click **"🔓 Disarm Alarm"** to stop protection

### Keyboard Shortcuts
- **Space/Enter**: Toggle arm/disarm
- **Escape**: Disarm alarm or stop alarm if triggered

### System Tray
- Click the tray icon to show/hide the app
- Right-click for context menu with status and quit option

## 🛠️ Building for Distribution

Create standalone executables for different platforms:

### macOS
```bash
npm run build-mac
```

### Windows
```bash
npm run build-win
```

### Linux
```bash
npm run build-linux
```

Built applications will be available in the `dist` folder.

## 🔧 Technical Details

### What Triggers the Alarm
- System suspend events (lid close)
- Screen saver activation (on macOS)
- App window forced closure while armed

### Alarm Sound
- Generated using Web Audio API
- Siren-like sound that loops until stopped
- No external audio files required

### Platform Support
- **macOS**: Full support with power monitoring
- **Windows**: Basic support with system events
- **Linux**: Basic support with system events

## 🛡️ Security Notes

⚠️ **Important**: This app provides **deterrent-level security**, not professional theft protection. It works best in public spaces where noise will attract attention. Consider additional security measures for high-value scenarios.

## 🐛 Troubleshooting

### App Won't Start
- Ensure Node.js is installed (`node --version`)
- Run `npm install` to install dependencies
- Check for error messages in the terminal

### Alarm Not Triggering
- Ensure the app has proper system permissions
- On macOS, you may need to grant accessibility permissions
- Test by arming the alarm and manually closing the app window

### No Sound
- Check system volume levels
- Browser security may block audio on first load - click anywhere in the app first
- Audio context requires user interaction to start

## 🎨 Customization

### Changing Alarm Sound
Modify the `playAlarmSound()` function in `renderer.js` to adjust:
- Frequency (pitch)
- Volume
- Sound pattern

### Adjusting UI
Edit `styles.css` to customize:
- Colors and themes
- Button styles
- Animation effects

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Setup
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- Inspired by the need for simple, effective laptop protection
- Thanks to the open-source community for the tools and libraries used

---

**Version 1.0.0** | Made with ❤️ for laptop security 