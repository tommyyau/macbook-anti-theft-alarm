const { ipcRenderer } = require('electron');

// UI Elements
const statusIndicator = document.getElementById('status-indicator');
const statusTitle = document.getElementById('status-title');
const statusDescription = document.getElementById('status-description');
const armBtn = document.getElementById('arm-btn');
const disarmBtn = document.getElementById('disarm-btn');
const stopAlarmBtn = document.getElementById('stop-alarm-btn');
const stopAlarmButton = document.getElementById('stop-alarm-button');
const alarmSection = document.getElementById('alarm-section');
const alarmReason = document.getElementById('alarm-reason');
const alarmAudio = document.getElementById('alarm-audio');
const volumeSlider = document.getElementById('volume-slider');
const volumeValue = document.getElementById('volume-value');

// Audio context for generating alarm sound
let audioContext;
let oscillator;
let gainNode;
let isAlarmSoundPlaying = false;

// Volume control
let currentVolume = 0.3; // Default 30%
let volumeSliderLocked = false;

// Initialize the app
async function init() {
    await updateUI();
    setupEventListeners();
    setupAudio();
    loadVolume(); // Load saved volume setting
    
    // Debug: Check if volume slider exists
    const slider = document.getElementById('volume-slider');
    console.log('Volume slider found:', !!slider);
    if (slider) {
        console.log('Slider value:', slider.value);
        console.log('Slider min/max:', slider.min, '/', slider.max);
    }
    
    // Request window resize to fit new content
    setTimeout(() => {
        ipcRenderer.invoke('resize-window');
    }, 100);
}

// Set up event listeners
function setupEventListeners() {
    armBtn.addEventListener('click', armAlarm);
    disarmBtn.addEventListener('click', disarmAlarm);
    stopAlarmBtn.addEventListener('click', stopAlarm);
    stopAlarmButton.addEventListener('click', stopAlarm);
    
    // Volume slider event listener
    volumeSlider.addEventListener('input', (event) => {
        updateVolume();
        // Also update track immediately for smooth visual feedback
        const value = parseInt(event.target.value);
        updateSliderTrack(value);
    });
    volumeSlider.addEventListener('change', saveVolume);
    
    // Listen for alarm triggers from main process
    ipcRenderer.on('alarm-triggered', (event, reason) => {
        showAlarmTriggered(reason);
    });
    
    // Listen for admin permission events
    ipcRenderer.on('admin-permission-denied', () => {
        showNotification('⚠️ Admin permission denied. Using fallback protection.', 'warning');
    });
    
    ipcRenderer.on('sleep-prevention-failed', () => {
        showNotification('❌ Could not prevent system sleep. Alarm may not work properly.', 'error');
    });
    
    ipcRenderer.on('disarm-denied', () => {
        showNotification('🔒 Admin password required to disarm alarm!', 'error');
    });
    
    ipcRenderer.on('stop-denied', () => {
        showNotification('🔒 Admin password required to stop alarm!', 'error');
    });
    
    ipcRenderer.on('requesting-admin-password', () => {
        showNotification('🔐 Enter your admin password to continue...', 'info');
    });
    
    // Handle alarm stopped/disarmed events
    ipcRenderer.on('alarm-stopped-success', () => {
        hideAlarmTriggered();
        updateUI();
        showNotification('✅ Alarm stopped and disarmed successfully', 'success');
    });
    
    // Handle volume key protection events
    ipcRenderer.on('volume-keys-protected', (event, keyCount) => {
        if (keyCount > 0) {
            showNotification(`🔇 Volume keys protected - ${keyCount} hardware keys blocked during alarm`, 'info');
        }
    });
    
    // Handle state restoration after app restart
    ipcRenderer.on('state-restored', (event, state) => {
        console.log('📂 State restored from restart:', state);
        updateUI();
        if (state.triggered) {
            showAlarmTriggered('Alarm restored from restart');
        }
        showNotification('🔄 App restarted - volume keys are now fully functional', 'success');
    });
    
    ipcRenderer.on('volume-keys-restored', (event, success, restoredKeys, totalKeys) => {
        if (success) {
            showNotification(`✅ Volume keys restored successfully (${restoredKeys}/${totalKeys} keys)`, 'success');
        } else {
            showNotification('⚠️ Volume key restoration used emergency fallback - keys should work normally', 'warning');
        }
    });
    
    ipcRenderer.on('volume-restoration-verified', (event, success, stillRegistered) => {
        if (success) {
            showNotification('✅ Volume key restoration verified - all functions normal', 'success');
        } else {
            showNotification(`⚠️ Some volume keys may still be affected: ${stillRegistered.join(', ')}`, 'warning');
        }
    });
    
    ipcRenderer.on('volume-restoration-warning', () => {
        showNotification('⚠️ Emergency volume key restoration applied - please test F10/F11/F12 keys', 'warning');
    });
    
    ipcRenderer.on('volume-restoration-failed', () => {
        showNotification('❌ Volume key restoration failed - you may need to restart your Mac', 'error');
    });
    
    // New multi-tier restoration events
    ipcRenderer.on('volume-restoration-progress', (event, tierInfo) => {
        if (tierInfo.includes('Testing volume key functionality')) {
            showNotification(`🧪 ${tierInfo}`, 'info');
        } else if (tierInfo.includes('Volume key functionality verified')) {
            showNotification(`✅ ${tierInfo}`, 'success');
        } else if (tierInfo.includes('Resetting Core Audio daemon')) {
            showNotification(`🔊 ${tierInfo}`, 'warning');
        } else {
            showNotification(`🔄 Volume restoration: ${tierInfo}`, 'info');
        }
    });
    
    ipcRenderer.on('volume-restoration-success', (event, method) => {
        if (method.includes('verified')) {
            showNotification(`🎉 Volume keys fully restored and verified!`, 'success');
        } else {
            showNotification(`✅ Volume keys fully restored via ${method}`, 'success');
        }
    });
    
    ipcRenderer.on('volume-restoration-guidance', (event, instructions) => {
        // Show a more detailed modal or notification for user guidance
        showUserGuidanceModal(instructions);
    });
    
    ipcRenderer.on('volume-key-blocked', (event, keyName) => {
        showNotification(`🔒 ${keyName} blocked - Admin password required to change volume`, 'warning');
    });
    
    ipcRenderer.on('volume-key-blocking-failed', () => {
        showNotification('⚠️ Could not protect all volume keys - app volume still protected', 'warning');
    });
    
    ipcRenderer.on('system-volume-protected', (event, oldVolume, newVolume) => {
        showNotification(`🚨 VOLUME TAMPERING BLOCKED! Reset from ${oldVolume}% to ${newVolume}%`, 'error');
    });
    
    // Handle keyboard shortcuts
    document.addEventListener('keydown', (event) => {
        // Prevent common bypass attempts when alarm is armed or triggered
        const isArmedOrTriggered = statusIndicator.classList.contains('armed') || 
                                 statusIndicator.classList.contains('triggered');
        
        if (isArmedOrTriggered) {
            // Block potentially dangerous key combinations
            if (event.key === 'F4' && event.altKey) { // Alt+F4
                event.preventDefault();
                showNotification('🔒 Admin password required to close app!', 'error');
                return;
            }
            if (event.key === 'w' && event.metaKey) { // Cmd+W
                event.preventDefault();
                showNotification('🔒 Admin password required to close window!', 'error');
                return;
            }
            // Note: Cmd+Q is handled by the main process menu, so we don't need to block it here
        }
        
        if (event.key === 'Escape') {
            event.preventDefault(); // Prevent default ESC behavior
            
            if (document.getElementById('alarm-section').style.display !== 'none') {
                // Alarm is triggered - require admin password to stop
                stopAlarm(); // This will now prompt for admin password
            } else if (statusIndicator.classList.contains('armed')) {
                // Alarm is armed - require admin password to disarm
                disarmAlarm(); // This will now prompt for admin password  
            }
        }
        if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            const status = statusIndicator.classList.contains('armed');
            if (status) {
                disarmAlarm(); // Will require admin password
            } else {
                armAlarm();
            }
        }
    });
}

// Set up audio for alarm
function setupAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.log('Web Audio API not supported', e);
    }
}

// Update volume display and apply to current alarm if playing
function updateVolume() {
    // Block volume changes if slider is locked during alarm
    if (volumeSliderLocked) {
        showNotification('🔒 Volume locked during alarm - Admin password required to change', 'warning');
        // Reset slider to current volume
        volumeSlider.value = Math.round(currentVolume * 100);
        updateSliderTrack(Math.round(currentVolume * 100));
        return;
    }
    
    const volumePercent = parseInt(volumeSlider.value);
    currentVolume = volumePercent / 100; // Convert to 0-1 range
    volumeValue.textContent = volumePercent + '%';
    
    // Update slider track color to show progress
    updateSliderTrack(volumePercent);
    
    // Update gain if alarm is currently playing
    if (gainNode && isAlarmSoundPlaying) {
        gainNode.gain.setValueAtTime(currentVolume, audioContext.currentTime);
    }
}

// Update the slider track color to show volume progress
function updateSliderTrack(volumePercent) {
    const slider = document.getElementById('volume-slider');
    if (slider) {
        // Calculate the exact position where the track should end
        // The track should end at the center of the thumb, not beyond it
        const trackEnd = Math.max(0, Math.min(volumePercent, 100));
        
        // Adjust the end position to account for the thumb size
        // Subtract a small amount to ensure the blue bar doesn't extend beyond the thumb
        const adjustedEnd = Math.max(0, trackEnd - 2);
        
        // Create a gradient that stops exactly at the thumb position
        // Use a sharp cutoff with no overlap
        const gradient = `linear-gradient(to right, #3498db 0%, #3498db ${adjustedEnd}%, #ecf0f1 ${adjustedEnd}%, #ecf0f1 100%)`;
        slider.style.background = gradient;
        
        // Ensure the slider value matches
        slider.value = volumePercent;
        
        console.log('Track updated to:', adjustedEnd + '% (adjusted from ' + trackEnd + '%)');
        console.log('Slider value confirmed:', slider.value);
    } else {
        console.error('Slider not found for track update');
    }
}

// Save volume setting to localStorage
function saveVolume() {
    const volumePercent = parseInt(volumeSlider.value);
    localStorage.setItem('alarmVolume', volumePercent.toString());
    showNotification(`🔊 Volume set to ${volumePercent}%`, 'info');
    
    // Request window resize in case layout changed
    ipcRenderer.invoke('resize-window');
}

// Load volume setting from localStorage
function loadVolume() {
    // Clear any existing localStorage to ensure clean start
    localStorage.removeItem('alarmVolume');
    
    // Always start with 30% for now
    const volumePercent = 30;
    
    // Force set the slider value and ensure it's properly initialized
    if (volumeSlider) {
        // Set the slider value first
        volumeSlider.value = volumePercent;
        
        // Update the display
        volumeValue.textContent = volumePercent + '%';
        
        // Update the current volume for audio
        currentVolume = volumePercent / 100;
        
        // Update the track with a slight delay to ensure DOM is ready
        setTimeout(() => {
            updateSliderTrack(volumePercent);
        }, 50);
        
        console.log('Volume initialized to:', volumePercent + '%');
        console.log('Slider value set to:', volumeSlider.value);
    } else {
        console.error('Volume slider not found!');
    }
}

// Lock volume slider during alarm
function lockVolumeSlider() {
    volumeSliderLocked = true;
    const slider = document.getElementById('volume-slider');
    const volumeLabel = document.querySelector('.volume-label');
    
    if (slider) {
        slider.disabled = true;
        slider.style.opacity = '0.5';
        slider.style.cursor = 'not-allowed';
        slider.title = 'Volume locked during alarm - Admin password required';
    }
    
    if (volumeLabel) {
        volumeLabel.innerHTML = '🔒 Alarm Volume: <span id="volume-value">' + Math.round(currentVolume * 100) + '%</span> (Protected)';
    }
    
    console.log('🔒 Volume slider locked');
}

// Unlock volume slider after alarm is stopped
function unlockVolumeSlider() {
    volumeSliderLocked = false;
    const slider = document.getElementById('volume-slider');
    const volumeLabel = document.querySelector('.volume-label');
    
    if (slider) {
        slider.disabled = false;
        slider.style.opacity = '1';
        slider.style.cursor = 'pointer';
        slider.title = 'Adjust alarm volume from 10% to 100%';
    }
    
    if (volumeLabel) {
        volumeLabel.innerHTML = '🔊 Alarm Volume: <span id="volume-value">' + Math.round(currentVolume * 100) + '%</span>';
    }
    
    console.log('🔊 Volume slider unlocked');
}

// Generate alarm sound using Web Audio API
function playAlarmSound() {
    if (!audioContext || isAlarmSoundPlaying) return;
    
    try {
        isAlarmSoundPlaying = true;
        
        // Create oscillator for the alarm sound
        oscillator = audioContext.createOscillator();
        gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Create a siren-like sound
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        
        // Volume control (0.1 = 10%, 0.5 = 50%, 1.0 = 100%)
        gainNode.gain.setValueAtTime(currentVolume, audioContext.currentTime);
        
        // Create siren effect
        const now = audioContext.currentTime;
        oscillator.frequency.linearRampToValueAtTime(1200, now + 0.5);
        oscillator.frequency.linearRampToValueAtTime(800, now + 1);
        
        oscillator.start();
        
        // Loop the siren sound
        setTimeout(() => {
            if (isAlarmSoundPlaying) {
                stopAlarmSound();
                playAlarmSound();
            }
        }, 1000);
        
    } catch (e) {
        console.error('Error playing alarm sound:', e);
    }
}

function stopAlarmSound() {
    if (oscillator) {
        try {
            oscillator.stop();
            oscillator.disconnect();
        } catch (e) {
            // Oscillator might already be stopped
        }
        oscillator = null;
    }
    isAlarmSoundPlaying = false;
}

// Arm the alarm
async function armAlarm() {
    try {
        await ipcRenderer.invoke('arm-alarm');
        await updateUI();
        
        // Show confirmation
        showNotification('✅ Alarm Armed! Your MacBook is now protected.', 'success');
    } catch (error) {
        console.error('Error arming alarm:', error);
        showNotification('❌ Error arming alarm', 'error');
    }
}

// Disarm the alarm
async function disarmAlarm() {
    try {
        showNotification('🔐 Admin password required to disarm...', 'warning');
        const result = await ipcRenderer.invoke('disarm-alarm');
        if (result) {
            stopAlarmSound();
            hideAlarmTriggered();
            await updateUI();
            showNotification('🔓 Alarm Disarmed', 'success');
        } else {
            showNotification('❌ Admin password required - alarm remains armed!', 'error');
        }
    } catch (error) {
        console.error('Error disarming alarm:', error);
        showNotification('❌ Could not disarm alarm - admin password required!', 'error');
    }
}

// Stop the alarm (when triggered) - automatically disarms after stopping
async function stopAlarm() {
    try {
        showNotification('🔐 Admin password required to stop alarm...', 'warning');
        // The alarm keeps playing while waiting for password!
        const result = await ipcRenderer.invoke('stop-alarm');
        if (result) {
            // Stop the sound AFTER successful authentication
            stopAlarmSound();
            hideAlarmTriggered();
            await updateUI();
            showNotification('🛑 Alarm Stopped & Disarmed', 'success');
        } else {
            showNotification('❌ Admin password required - alarm continues!', 'error');
        }
    } catch (error) {
        console.error('Error stopping alarm:', error);
        showNotification('❌ Could not stop alarm - admin password required!', 'error');
    }
}

// Update UI based on current alarm status
async function updateUI() {
    try {
        const status = await ipcRenderer.invoke('get-alarm-status');
        
        if (status.triggered) {
            // Alarm has been triggered
            statusIndicator.className = 'status-indicator triggered';
            statusIndicator.querySelector('.status-icon').textContent = '🚨';
            statusTitle.textContent = 'ALARM TRIGGERED!';
            statusDescription.textContent = 'Someone attempted to access your MacBook!';
            
            armBtn.disabled = true;
            disarmBtn.disabled = false;
            stopAlarmBtn.style.display = 'block';
        } else if (status.armed) {
            // Alarm is armed
            statusIndicator.className = 'status-indicator armed';
            statusIndicator.querySelector('.status-icon').textContent = '🛡️';
            statusTitle.textContent = 'Armed & Protected';
            statusDescription.textContent = 'Your MacBook is protected. Close the app to hide it.';
            
            armBtn.disabled = true;
            disarmBtn.disabled = false;
            stopAlarmBtn.style.display = 'none';
        } else {
            // Alarm is disarmed
            statusIndicator.className = 'status-indicator disarmed';
            statusIndicator.querySelector('.status-icon').textContent = '🔓';
            statusTitle.textContent = 'Disarmed';
            statusDescription.textContent = 'Your MacBook is not protected';
            
            armBtn.disabled = false;
            disarmBtn.disabled = true;
            stopAlarmBtn.style.display = 'none';
        }
    } catch (error) {
        console.error('Error updating UI:', error);
    }
}

// Show alarm triggered overlay
function showAlarmTriggered(reason) {
    alarmReason.textContent = reason;
    alarmSection.style.display = 'flex';
    playAlarmSound();
    
    // Lock volume slider to prevent tampering
    lockVolumeSlider();
    
    // Flash the screen
    document.body.style.animation = 'none';
    setTimeout(() => {
        document.body.style.animation = 'alarm-flash 0.3s infinite alternate';
    }, 10);
}

// Hide alarm triggered overlay (only after successful auth)
function hideAlarmTriggered() {
    alarmSection.style.display = 'none';
    document.body.style.animation = 'none';
    stopAlarmSound(); // Stop sound only when hiding the alarm
    
    // Unlock volume slider after successful authentication
    unlockVolumeSlider();
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Style the notification
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '12px 20px',
        borderRadius: '8px',
        color: 'white',
        fontWeight: '500',
        zIndex: '9999',
        transform: 'translateX(100%)',
        transition: 'transform 0.3s ease',
        maxWidth: '300px',
        wordWrap: 'break-word'
    });
    
    // Set background color based on type
    switch (type) {
        case 'success':
            notification.style.background = '#27ae60';
            break;
        case 'error':
            notification.style.background = '#e74c3c';
            break;
        case 'warning':
            notification.style.background = '#f39c12';
            break;
        default:
            notification.style.background = '#3498db';
    }
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Show detailed user guidance modal for volume key restoration
function showUserGuidanceModal(instructions) {
    // Remove any existing guidance modal
    const existingModal = document.getElementById('guidance-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create modal overlay
    const modal = document.createElement('div');
    modal.id = 'guidance-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 30px;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        text-align: center;
    `;
    
    // Add title
    const title = document.createElement('h2');
    title.textContent = instructions.title;
    title.style.cssText = `
        margin: 0 0 20px 0;
        color: #2c3e50;
        font-size: 24px;
    `;
    
    // Add message
    const message = document.createElement('p');
    message.textContent = instructions.message;
    message.style.cssText = `
        margin: 0 0 20px 0;
        color: #34495e;
        font-size: 16px;
        line-height: 1.5;
    `;
    
    // Add steps list
    const stepsList = document.createElement('ol');
    stepsList.style.cssText = `
        text-align: left;
        margin: 20px 0;
        padding-left: 20px;
        color: #2c3e50;
    `;
    
    instructions.steps.forEach(step => {
        const listItem = document.createElement('li');
        listItem.textContent = step;
        listItem.style.cssText = `
            margin: 10px 0;
            font-size: 14px;
            line-height: 1.4;
        `;
        stepsList.appendChild(listItem);
    });
    
    // Add close button
    const closeButton = document.createElement('button');
    closeButton.textContent = 'I Understand';
    closeButton.style.cssText = `
        background: #3498db;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 12px 30px;
        font-size: 16px;
        cursor: pointer;
        margin-top: 20px;
        transition: background 0.2s ease;
    `;
    
    closeButton.addEventListener('click', () => {
        modal.remove();
        showNotification('📋 Please test your volume keys (F10/F11/F12)', 'info');
    });
    
    closeButton.addEventListener('mouseenter', () => {
        closeButton.style.background = '#2980b9';
    });
    
    closeButton.addEventListener('mouseleave', () => {
        closeButton.style.background = '#3498db';
    });
    
    // Assemble modal
    modalContent.appendChild(title);
    modalContent.appendChild(message);
    modalContent.appendChild(stepsList);
    modalContent.appendChild(closeButton);
    modal.appendChild(modalContent);
    
    // Add to page
    document.body.appendChild(modal);
    
    // Auto-remove after 30 seconds if user doesn't interact
    setTimeout(() => {
        if (document.getElementById('guidance-modal')) {
            modal.remove();
            showNotification('⏰ Volume key guidance closed automatically', 'info');
        }
    }, 30000);
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', init);

// Resume audio context on user interaction (required by browsers)
document.addEventListener('click', () => {
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
}, { once: true });