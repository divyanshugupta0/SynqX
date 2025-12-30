// Settings Manager - Sync settings with Firebase
class SettingsManager {
    constructor() {
        this.database = null;
        this.currentUserId = null;
        this.settings = {
            darkMode: true,
            soundAlerts: true,
            desktopNotifications: false,
            chatBackup: false
        };
        this.notificationSound = null;
        this.init();
    }

    init() {
        if (typeof firebase !== 'undefined' && firebase.database) {
            this.database = firebase.database();
            this.currentUserId = localStorage.getItem('userId');
            console.log('✅ Settings Manager initialized');

            // Preload notification sound
            this.notificationSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
            this.notificationSound.volume = 0.5;
        } else {
            console.warn('⚠️ Firebase not available for settings');
        }
    }

    // Load settings from Firebase
    async loadSettings() {
        if (!this.database || !this.currentUserId) {
            console.warn('Cannot load settings - not initialized');
            return this.settings;
        }

        try {
            const snapshot = await this.database.ref(`users/${this.currentUserId}/settings`).once('value');
            const firebaseSettings = snapshot.val();

            if (firebaseSettings) {
                this.settings = { ...this.settings, ...firebaseSettings };
                console.log('✅ Settings loaded from Firebase:', this.settings);
            } else {
                console.log('📝 No settings in Firebase, using defaults');
                // Save defaults to Firebase
                await this.saveSettings();
            }

            this.applySettings();
            return this.settings;
        } catch (error) {
            console.error('❌ Error loading settings:', error);
            return this.settings;
        }
    }

    // Save settings to Firebase
    async saveSettings(newSettings = null) {
        if (newSettings) {
            this.settings = { ...this.settings, ...newSettings };
        }

        if (!this.database || !this.currentUserId) {
            console.warn('Cannot save settings - not initialized');
            return false;
        }

        try {
            await this.database.ref(`users/${this.currentUserId}/settings`).set(this.settings);
            console.log('✅ Settings saved to Firebase:', this.settings);
            this.applySettings();
            return true;
        } catch (error) {
            console.error('❌ Error saving settings:', error);
            return false;
        }
    }

    // Apply settings to UI
    applySettings() {
        // Update toggles
        const darkModeToggle = document.getElementById('dark-mode-toggle');
        const soundToggle = document.getElementById('sound-toggle');
        const desktopNotifToggle = document.getElementById('desktop-notif-toggle');
        const chatBackupToggle = document.getElementById('chat-backup-toggle');

        if (darkModeToggle) darkModeToggle.checked = this.settings.darkMode;
        if (soundToggle) soundToggle.checked = this.settings.soundAlerts;
        if (desktopNotifToggle) desktopNotifToggle.checked = this.settings.desktopNotifications;
        if (chatBackupToggle) chatBackupToggle.checked = this.settings.chatBackup;

        // Apply dark mode
        if (this.settings.darkMode) {
            document.body.classList.remove('light-theme');
        } else {
            document.body.classList.add('light-theme');
        }

        // Request notification permission if enabled
        if (this.settings.desktopNotifications && 'Notification' in window) {
            if (Notification.permission === 'default') {
                Notification.requestPermission();
            }
        }
    }

    // Get current settings from UI
    getSettingsFromUI() {
        return {
            darkMode: document.getElementById('dark-mode-toggle')?.checked ?? true,
            soundAlerts: document.getElementById('sound-toggle')?.checked ?? true,
            desktopNotifications: document.getElementById('desktop-notif-toggle')?.checked ?? false,
            chatBackup: document.getElementById('chat-backup-toggle')?.checked ?? false
        };
    }

    // Play notification sound if enabled
    playNotificationSound() {
        if (this.settings.soundAlerts && this.notificationSound) {
            try {
                this.notificationSound.currentTime = 0; // Reset to start
                this.notificationSound.play().catch(e => {
                    console.warn('Could not play notification sound:', e);
                });
            } catch (error) {
                console.warn('Error playing sound:', error);
            }
        }
    }

    // Show desktop notification if enabled
    showDesktopNotification(title, body, icon = 'anony.jpg') {
        if (this.settings.desktopNotifications && 'Notification' in window) {
            if (Notification.permission === 'granted') {
                try {
                    new Notification(title, {
                        body: body,
                        icon: icon,
                        badge: icon,
                        tag: 'firefly-message',
                        requireInteraction: false
                    });
                } catch (error) {
                    console.warn('Error showing notification:', error);
                }
            } else if (Notification.permission === 'default') {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        this.showDesktopNotification(title, body, icon);
                    }
                });
            }
        }
    }
}

// Initialize globally
if (typeof window !== 'undefined') {
    window.settingsManager = new SettingsManager();
}

console.log('✅ Settings Manager loaded');
