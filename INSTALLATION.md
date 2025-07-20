# Installation Guide

## Downloading and Installing MacShieldAlarm

### Option 1: Install from GitHub Release (Recommended)

1. **Download the DMG**: Go to the [Releases page](https://github.com/tommyyau/macbook-anti-theft-alarm/releases) and download the latest `.dmg` file, or download directly: **[MacShieldAlarm-1.0.0-arm64.dmg](MacShieldAlarm-1.0.0-arm64.dmg)** (96.8 MB)

2. **Handle "Corrupt" DMG Warning**: When you try to open the DMG, macOS may show a warning that the app is "corrupt" or "damaged". This is normal for unsigned apps. Here's how to fix it:

   **Method A - Right-click and Open:**
   - Right-click on the app in the Applications folder
   - Select "Open" from the context menu
   - Click "Open" in the security dialog that appears
   - The app will now run normally

   **Method B - System Preferences:**
   - Go to System Preferences > Security & Privacy
   - Click the "General" tab
   - Look for a message about the blocked app
   - Click "Open Anyway"

3. **Install the App**: Drag the app from the DMG to your Applications folder.

### Option 2: Build from Source (For Developers)

If you want to build the app yourself:

```bash
# Clone the repository
git clone https://github.com/tommyyau/macbook-anti-theft-alarm.git
cd macbook-anti-theft-alarm

# Install dependencies
npm install

# Build the app
npm run dev-build

# The DMG will be created in the `dist` folder
```

### Option 3: Run in Development Mode

For testing without building:

```bash
# Clone and install dependencies
git clone https://github.com/tommyyau/macbook-anti-theft-alarm.git
cd macbook-anti-theft-alarm
npm install

# Run in development mode
npm start
```

## Why Does This Happen?

The "corrupt" warning appears because:

1. **No Code Signing**: The app isn't signed with an Apple Developer certificate
2. **No Notarization**: The app isn't notarized by Apple
3. **Gatekeeper Protection**: macOS Gatekeeper blocks unsigned apps by default

This is common for open-source projects that don't have Apple Developer accounts ($99/year).

## Security Note

The app is safe to use. The "corrupt" warning is just macOS being cautious about unsigned software. You can verify the source code on GitHub before installing.

## Troubleshooting

### App Won't Open After Installation

1. **Check Gatekeeper**: Make sure you've allowed the app through Gatekeeper (see Option 1 above)
2. **Check Permissions**: The app needs microphone and camera permissions to function
3. **Check Admin Rights**: The app needs admin privileges to disable system sleep

### Permission Issues

The app requires several permissions:
- **Microphone**: For the alarm sound
- **Camera**: For motion detection (if implemented)
- **Admin Rights**: To disable system sleep when armed

Grant these permissions when prompted.

## Support

If you continue to have issues:
1. Check the [Issues page](https://github.com/tommyyau/macbook-anti-theft-alarm/issues)
2. Create a new issue with details about your problem
3. Include your macOS version and any error messages 