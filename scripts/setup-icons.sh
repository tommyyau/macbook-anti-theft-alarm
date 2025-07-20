#!/bin/bash

echo "🎨 MacShieldAlarm - Icon Setup"
echo "========================================"
echo ""

# Create icon directories
mkdir -p assets/icons
mkdir -p build

echo "📁 Created icon directories:"
echo "   - assets/icons/ (for app icons)"
echo "   - build/ (for build assets)"
echo ""

echo "🖼️  Icon Requirements:"
echo "======================"
echo ""
echo "1. App Icon (assets/icons/icon.png):"
echo "   - Size: 512x512 pixels"
echo "   - Format: PNG with transparency"
echo "   - Purpose: Main app icon for .app bundle"
echo ""
echo "2. Tray Icon (assets/icons/tray-icon.png):"
echo "   - Size: 16x16 pixels (will be auto-resized)"
echo "   - Format: PNG with transparency"
echo "   - Purpose: System tray icon"
echo ""
echo "3. DMG Icon (assets/icons/dmg-icon.png):"
echo "   - Size: 512x512 pixels"
echo "   - Format: PNG with transparency"
echo "   - Purpose: Installer DMG icon"
echo ""

echo "📋 Steps to Add Your Icon:"
echo "=========================="
echo ""
echo "1. Save your alarm siren image as 'icon.png' in assets/icons/"
echo "2. Make sure it's 512x512 pixels with transparency"
echo "3. Run this script again to verify setup"
echo ""
echo "4. Alternative: Use online tools to convert your image:"
echo "   - https://www.icoconverter.com/ (for multiple sizes)"
echo "   - https://cloudconvert.com/png-to-icns (for macOS .icns)"
echo ""

# Check if icon files exist
if [ -f "assets/icons/icon.png" ]; then
    echo "✅ Main icon found: assets/icons/icon.png"
    file_size=$(du -h "assets/icons/icon.png" | cut -f1)
    echo "   Size: $file_size"
else
    echo "❌ Main icon missing: assets/icons/icon.png"
    echo "   Please add your 512x512 PNG icon here"
fi

if [ -f "assets/icons/tray-icon.png" ]; then
    echo "✅ Tray icon found: assets/icons/tray-icon.png"
    file_size=$(du -h "assets/icons/tray-icon.png" | cut -f1)
    echo "   Size: $file_size"
else
    echo "❌ Tray icon missing: assets/icons/tray-icon.png"
    echo "   Will use main icon if available"
fi

echo ""
echo "🔧 Next Steps:"
echo "=============="
echo "1. Add your icon files to assets/icons/"
echo "2. Run 'npm run dev-build' to test with new icons"
echo "3. Check the app and tray icons work correctly"
echo ""
echo "📖 For more help, see: https://www.electron.build/icons" 