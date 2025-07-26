# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Plan & Review

### Before starting work
- Always in plan mode to make a plan
- After get the plan, make sure you Write the plan to .claude/tasks/TASK_NAME.md.
- The plan should be a detailed implementation plan and the reasoning behind them, as well as tasks broken down.
- If the task require external knowledge or certain package, also research to get latest knowledge (Use Task tool for research)
- Don't over plan it, always think MVP.
- Once you write the plan, firstly ask me to review it. Do not continue until I approve the plan.
### While implementing
- You should update the plan as you work.
- After you complete tasks in the plan, you should update and append detailed descriptions of the changes you made, so following tasks can be easily hand over to other engineers.



## Commands

### Development
- `npm start` - Run the app in development mode
- `npm install` - Install dependencies

### Building
- `npm run build` - Build the app using electron-builder
- `npm run build-mac` - Build macOS app only
- `npm run build-dmg` - Build DMG for distribution
- `npm run dev-build` - Build DMG without publishing (development)
- `npm run build-dmg-unsigned` - Build unsigned DMG

### Testing & Scripts
- `npm run test-install` - Run installation test script
- `npm run setup-icons` - Set up application icons

## Architecture

### Electron App Structure
This is an Electron-based macOS anti-theft alarm application with three main components:

**Main Process (`main.js`)**:
- Window management and tray functionality
- System integration (sleep prevention, lid monitoring)
- Admin permission handling via `sudo-prompt`
- Hardware monitoring using macOS `ioreg` and `pmset` commands
- IPC communication with renderer process

**Renderer Process (`renderer.js`)**:
- UI management and user interactions
- Web Audio API for alarm sound generation
- Volume control and settings persistence
- Event handling for keyboard shortcuts and user actions

**UI (`index.html` + `styles.css`)**:
- Clean, modern interface with status indicators
- Volume controls and arm/disarm buttons
- Alarm overlay with emergency stop functionality

### Security Features
- **Admin Authentication**: Both arming and disarming require macOS admin password via `sudo-prompt`
- **Sleep Prevention**: Uses `pmset` and `caffeinate` to prevent system sleep when armed
- **Lid Detection**: Monitors clamshell state via `ioreg -r -k AppleClamshellState`
- **Display Monitoring**: Tracks display count changes to detect disconnection
- **Bypass Prevention**: Blocks common quit attempts (Cmd+W, Alt+F4) when armed

### Build Configuration
- Uses `electron-builder` for packaging
- DMG creation with custom window layout
- Icon and entitlements configuration in `build/` directory
- Notarization script for macOS distribution (`scripts/notarize.js`)

### File Organization
- Root files: Main application code (`main.js`, `renderer.js`, `index.html`, `styles.css`)
- `assets/icons/`: Application and tray icons
- `scripts/`: Build and utility scripts
- `build/`: Build configuration and resources
- `dist/`: Output directory for built applications

## Important Notes

### macOS Specific Requirements
- Admin permissions are required for lid monitoring and sleep prevention
- Uses macOS system commands (`ioreg`, `pmset`, `caffeinate`)
- Gatekeeper warnings expected for unsigned builds

### Development Focus
The app prioritizes security and tamper-resistance - changes should maintain admin authentication requirements and prevent easy bypass methods.

### Testing
Manual testing required on macOS for hardware integration features. The lid detection and sleep prevention features cannot be easily unit tested.