const { notarize } = require('@electron/notarize');

module.exports = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;  
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;

  // Only notarize if we have the required environment variables
  if (!process.env.APPLE_ID || !process.env.APPLE_ID_PASS) {
    console.log('⚠️  Skipping notarization: APPLE_ID and APPLE_ID_PASS not set');
    return;
  }

  console.log('📦 Notarizing macOS app...');
  
  try {
    await notarize({
      tool: 'notarytool',
      appPath: `${appOutDir}/${appName}.app`,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_ID_PASS,
      teamId: process.env.APPLE_TEAM_ID,
    });
    
    console.log('✅ Notarization completed successfully');
  } catch (error) {
    console.error('❌ Notarization failed:', error);
    throw error;
  }
}; 