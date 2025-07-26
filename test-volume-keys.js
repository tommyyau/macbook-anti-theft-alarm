#!/usr/bin/env node

/**
 * Test script for volume key blocking functionality
 * This script tests the volume key blocking and restoration features
 */

const { globalShortcut } = require('electron');

console.log('🧪 Testing Volume Key Blocking Functionality');
console.log('===========================================');

// Test 1: Register volume key shortcuts
console.log('\n1. Testing volume key registration...');
let registeredKeys = [];

try {
    const volumeKeys = ['F10', 'F11', 'F12'];
    
    volumeKeys.forEach(key => {
        const success = globalShortcut.register(key, () => {
            console.log(`🔒 ${key} blocked!`);
        });
        
        if (success) {
            registeredKeys.push(key);
            console.log(`✅ ${key} registered successfully`);
        } else {
            console.log(`❌ Failed to register ${key}`);
        }
    });
    
    console.log(`📊 Registered ${registeredKeys.length}/${volumeKeys.length} volume keys`);
    
} catch (error) {
    console.log('❌ Error registering volume keys:', error.message);
}

// Test 2: Check if keys are registered
console.log('\n2. Checking registered shortcuts...');
const isRegistered = globalShortcut.isRegistered('F10');
console.log(`F10 registered: ${isRegistered}`);

// Test 3: Unregister all shortcuts
console.log('\n3. Testing shortcut unregistration...');
try {
    globalShortcut.unregisterAll();
    console.log('✅ All shortcuts unregistered');
    
    // Check if still registered
    const stillRegistered = globalShortcut.isRegistered('F10');
    console.log(`F10 still registered after unregisterAll: ${stillRegistered}`);
    
} catch (error) {
    console.log('❌ Error unregistering shortcuts:', error.message);
}

// Test 4: Test re-registration
console.log('\n4. Testing re-registration...');
try {
    const success = globalShortcut.register('F10', () => {
        console.log('🔒 F10 blocked (re-registered)!');
    });
    
    console.log(`F10 re-registration: ${success ? '✅ Success' : '❌ Failed'}`);
    
    // Clean up
    globalShortcut.unregisterAll();
    console.log('✅ Final cleanup completed');
    
} catch (error) {
    console.log('❌ Error during re-registration:', error.message);
}

console.log('\n🎉 Volume key blocking test completed!');
console.log('\n📝 Notes:');
console.log('- Volume keys may remain blocked until app restart due to Electron limitations');
console.log('- This is expected behavior and the app restart mechanism handles this');
console.log('- Test the actual app to see the full functionality with user interface'); 