#!/bin/bash

echo "🔍 Anti-Theft Alarm - Installation Test"
echo "================================================"
echo ""

# Check if DMG exists
if [ -f "dist/Anti-Theft Alarm-1.0.0-arm64.dmg" ]; then
  echo "✅ DMG file found: dist/Anti-Theft Alarm-1.0.0-arm64.dmg"
  echo "📏 File size: $(du -h "dist/Anti-Theft Alarm-1.0.0-arm64.dmg" | cut -f1)"
    echo ""
    
    echo "📋 Installation Instructions:"
    echo "1. Double-click the DMG file to mount it"
    echo "2. If you see a 'corrupt' or 'damaged' warning:"
    echo "   - Right-click the app in the mounted DMG"
    echo "   - Select 'Open' from the context menu"
    echo "   - Click 'Open' in the security dialog"
    echo "3. Drag the app to your Applications folder"
    echo "4. Eject the DMG"
    echo ""
    
    echo "🔐 First Run Instructions:"
    echo "1. Open the app from Applications folder"
    echo "2. If blocked by Gatekeeper:"
    echo "   - Go to System Preferences > Security & Privacy"
    echo "   - Click 'Open Anyway' next to the app"
    echo "3. Grant microphone and camera permissions when prompted"
    echo "4. Enter admin password when arming the alarm"
    echo ""
    
    echo "🚀 To test the app now:"
    echo "npm start"
    
else
    echo "❌ DMG file not found!"
    echo "Run 'npm run dev-build' to create the DMG first."
fi

echo ""
echo "📖 For detailed instructions, see: INSTALLATION.md" 