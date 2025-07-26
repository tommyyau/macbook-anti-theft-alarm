# MacShieldAlarm

A simple Electron app that helps protect your MacBook in public spaces by triggering an alarm when someone tries to close the lid while you're away.

## Features

- 🛡️ **Arm/Disarm Protection** - Simple one-click protection
- 🔍 **Lid Close Detection** - Monitors for system suspend events
- 🚨 **Loud Alarm Sound** - Generated audio alarm to alert nearby people
- 📱 **System Tray** - Runs in background when minimized
- 🎯 **Simple Interface** - Clean, intuitive design

## How It Works

1. **Arm the alarm** before leaving your MacBook unattended
2. **Minimize the app** - it continues running in the system tray
3. If someone **closes the lid** or puts the system to sleep, the alarm triggers
4. **Return and disarm** to safely use your MacBook again

## Installation & Setup

### Prerequisites
- Node.js (version 16 or higher)
- npm (comes with Node.js)

### Step 1: Download Files
Create a new folder called `macbook-anti-theft-alarm` and save all the provided files:
- `package.json`
- `main.js`
- `index.html`
- `styles.css`
- `renderer.js`

### Step 2: Install Dependencies
Open Terminal/Command Prompt in the project folder and run:

```bash
npm install
```

### Step 3: Run the App
```bash
npm start
```

The app should launch with a simple interface showing "Disarmed" status.

## Building for Distribution

To create a standalone executable that others can download and run:

### For macOS:
```bash
npm run build-mac
```

### For Windows:
```bash
npm run build-win
```

### For Linux:
```bash
npm run build-linux
```

The built applications will be in the `dist` folder.

## Usage Instructions

### Basic Operation:
1. Click **"🛡️ Arm Alarm"** before leaving your device
2. The status will change to **"Armed & Protected"**
3. Close or minimize the app (it stays running in system tray)
4. If someone closes the laptop lid, the alarm will trigger
5. Return and click **"🔓 Disarm Alarm"** to stop protection

### Keyboard Shortcuts:
- **Space/Enter**: Toggle arm/disarm
- **Escape**: Disarm alarm or stop alarm if triggered

### System Tray:
- Click the tray icon to show/hide the app
- Right-click for context menu with status and quit option

## Technical Details

### What Triggers the Alarm:
- System suspend events (lid close)
- Screen saver activation (on macOS)
- App window forced closure while armed

### Alarm Sound:
- Generated using Web Audio API
- Siren-like sound that loops until stopped
- No external audio files required

### Platform Support:
- **macOS**: Full support with power monitoring
- **Windows**: Basic support with system events
- **Linux**: Basic support with system events

## Troubleshooting

### App Won't Start:
- Make sure Node.js is installed (`node --version`)
- Run `npm install` to install dependencies
- Check for error messages in the terminal

### Alarm Not Triggering:
- Ensure the app has proper system permissions
- On macOS, you may need to grant accessibility permissions
- Test by arming the alarm and manually closing the app window

### No Sound:
- Check system volume levels
- Browser security may block audio on first load - click anywhere in the app first
- Audio context requires user interaction to start

## Customization

### Changing Alarm Sound:
Modify the `playAlarmSound()` function in `renderer.js` to adjust:
- Frequency (pitch)
- Volume
- Sound pattern

### Adjusting UI:
Edit `styles.css` to customize:
- Colors and themes
- Button styles
- Animation effects

## Security Notes

- This app provides **deterrent-level security**, not professional theft protection
- Works best in public spaces where noise will attract attention
- Consider additional security measures for high-value scenarios

## Contributing

Feel free to fork this project and submit pull requests for improvements!

## License

MIT License - Use freely for personal and commercial projects.

---

**Version 1.0.1** | Built with Electron | Made for macOS, Windows, and Linux