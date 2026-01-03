/**
 * Message Queue System for SynqX
 * Handles message delivery optimization for slow/unstable connections
 * Features:
 * - Optimistic UI updates
 * - Message queuing and retry logic
 * - Offline support with auto-sync
 * - Delivery status tracking
 * - Connection quality monitoring
 */

class MessageQueue {
    constructor() {
        this.queue = [];
        this.pendingMessages = new Map(); // messageId -> message data
        this.isOnline = navigator.onLine;
        this.connectionQuality = 'good'; // good, slow, offline
        this.retryDelays = [1000, 2000, 5000, 10000, 30000]; // Exponential backoff
        this.maxRetries = 5;
        this.processingQueue = false;
        this.networkCheckInterval = null;

        this.init();
    }

    init() {
        // Monitor online/offline status
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());

        // Load any pending messages from localStorage
        this.loadPendingFromStorage();

        // Start network quality monitoring
        this.startNetworkMonitoring();

        // Process any queued messages on init
        this.processQueue();

        console.log('✅ Message Queue initialized');
    }

    /**
     * Add message to queue with optimistic display
     */
    async queueMessage(recipientId, message, displayCallback) {
        const queuedMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            recipientId,
            message: { ...message, status: 'sending' },
            retries: 0,
            createdAt: Date.now(),
            displayCallback
        };

        // Add to pending map
        this.pendingMessages.set(queuedMessage.id, queuedMessage);

        // Add to queue
        this.queue.push(queuedMessage);

        // Persist to localStorage for offline resilience
        this.savePendingToStorage();

        // Update UI immediately with "sending" status
        this.updateMessageStatus(queuedMessage.id, 'sending');

        // Process queue
        this.processQueue();

        return queuedMessage.id;
    }

    /**
     * Process queued messages
     */
    async processQueue() {
        if (this.processingQueue || this.queue.length === 0) return;

        this.processingQueue = true;

        while (this.queue.length > 0 && this.isOnline) {
            const item = this.queue[0];

            try {
                const success = await this.sendWithRetry(item);

                if (success) {
                    // Remove from queue
                    this.queue.shift();
                    this.pendingMessages.delete(item.id);
                    this.updateMessageStatus(item.id, 'sent');
                } else {
                    // Move to end of queue for retry
                    this.queue.shift();
                    if (item.retries < this.maxRetries) {
                        this.queue.push(item);
                    } else {
                        // Max retries exceeded - mark as failed
                        this.updateMessageStatus(item.id, 'failed');
                        this.pendingMessages.delete(item.id);
                    }
                }
            } catch (error) {
                console.error('Queue processing error:', error);
                break;
            }
        }

        this.savePendingToStorage();
        this.processingQueue = false;
    }

    /**
     * Send message with retry logic
     */
    async sendWithRetry(queuedMessage) {
        const delay = this.retryDelays[Math.min(queuedMessage.retries, this.retryDelays.length - 1)];

        try {
            if (!window.messageRouter) {
                throw new Error('Message router not available');
            }

            // Attempt to send
            const result = await Promise.race([
                window.messageRouter.sendMessage(queuedMessage.recipientId, queuedMessage.message),
                this.timeout(this.connectionQuality === 'slow' ? 30000 : 15000)
            ]);

            if (result && result.success) {
                return true;
            }

            throw new Error('Send failed');
        } catch (error) {
            console.warn(`Message send attempt ${queuedMessage.retries + 1} failed:`, error.message);
            queuedMessage.retries++;

            // Wait before retry
            if (queuedMessage.retries < this.maxRetries) {
                await this.sleep(delay);
            }

            return false;
        }
    }

    /**
     * Update message status in UI
     */
    updateMessageStatus(messageId, status) {
        // Find message element by timestamp or id
        const message = this.pendingMessages.get(messageId);
        if (!message) return;

        const timestamp = message.message.timestamp;

        // Find all possible message elements
        const messageElements = document.querySelectorAll('.message-container.sent');

        messageElements.forEach(el => {
            // Check if this element matches our message (by data attribute or structure)
            const statusIcon = el.querySelector('.message-status-icon');
            const statusContainer = el.querySelector('.message-status');

            if (statusContainer) {
                // Remove existing status classes
                statusContainer.classList.remove('sending', 'sent', 'delivered', 'failed');
                statusContainer.classList.add(status);
            }

            if (statusIcon) {
                switch (status) {
                    case 'sending':
                        statusIcon.innerHTML = '<i class="material-icons" style="font-size: 14px; animation: pulse 1s infinite;">schedule</i>';
                        statusIcon.title = 'Sending...';
                        break;
                    case 'sent':
                        statusIcon.innerHTML = '<i class="material-icons" style="font-size: 14px;">done</i>';
                        statusIcon.title = 'Sent';
                        break;
                    case 'delivered':
                        statusIcon.innerHTML = '<i class="material-icons" style="font-size: 14px;">done_all</i>';
                        statusIcon.title = 'Delivered';
                        break;
                    case 'failed':
                        statusIcon.innerHTML = '<i class="material-icons" style="font-size: 14px; color: #ef4444;">error_outline</i>';
                        statusIcon.title = 'Failed - tap to retry';
                        break;
                }
            }
        });

        // Emit custom event for UI updates
        window.dispatchEvent(new CustomEvent('messageStatusUpdate', {
            detail: { messageId, status, timestamp }
        }));
    }

    /**
     * Retry a failed message
     */
    retryMessage(messageId) {
        const message = this.pendingMessages.get(messageId);
        if (message && message.message.status === 'failed') {
            message.retries = 0;
            message.message.status = 'sending';
            this.queue.push(message);
            this.updateMessageStatus(messageId, 'sending');
            this.processQueue();
        }
    }

    /**
     * Handle coming online
     */
    handleOnline() {
        this.isOnline = true;
        console.log('🌐 Network connected - processing queue');
        this.showNetworkNotification('Back online', 'success');
        this.processQueue();
    }

    /**
     * Handle going offline
     */
    handleOffline() {
        this.isOnline = false;
        this.connectionQuality = 'offline';
        console.log('📴 Network disconnected');
        this.showNetworkNotification('You are offline. Messages will be sent when connection is restored.', 'warning');
    }

    /**
     * Network quality monitoring using performance API
     */
    startNetworkMonitoring() {
        // Check connection type if available
        if ('connection' in navigator) {
            const connection = navigator.connection;

            const updateConnectionQuality = () => {
                const effectiveType = connection.effectiveType;
                const downlink = connection.downlink;

                if (effectiveType === '4g' && downlink > 5) {
                    this.connectionQuality = 'good';
                } else if (effectiveType === '3g' || effectiveType === '4g') {
                    this.connectionQuality = 'slow';
                } else {
                    this.connectionQuality = 'slow';
                }

                console.log(`📶 Connection quality: ${this.connectionQuality} (${effectiveType}, ${downlink}Mbps)`);
            };

            connection.addEventListener('change', updateConnectionQuality);
            updateConnectionQuality();
        }

        // Periodic connectivity check
        this.networkCheckInterval = setInterval(() => {
            this.checkConnectivity();
        }, 30000);
    }

    /**
     * Check real connectivity to Firebase
     */
    async checkConnectivity() {
        if (!navigator.onLine) {
            this.isOnline = false;
            this.connectionQuality = 'offline';
            return;
        }

        try {
            const start = performance.now();

            // Try to ping Firebase
            if (window.firebase && window.firebase.database) {
                await Promise.race([
                    window.firebase.database().ref('.info/connected').once('value'),
                    this.timeout(5000)
                ]);
            }

            const latency = performance.now() - start;

            if (latency < 500) {
                this.connectionQuality = 'good';
            } else if (latency < 2000) {
                this.connectionQuality = 'slow';
            } else {
                this.connectionQuality = 'slow';
            }

            this.isOnline = true;
        } catch (error) {
            this.connectionQuality = 'slow';
        }
    }

    /**
     * Storage helpers for offline resilience
     */
    savePendingToStorage() {
        try {
            const data = Array.from(this.pendingMessages.entries()).map(([id, msg]) => ({
                id,
                recipientId: msg.recipientId,
                message: msg.message,
                retries: msg.retries,
                createdAt: msg.createdAt
            }));
            localStorage.setItem('synqx_pending_messages', JSON.stringify(data));
        } catch (e) {
            console.warn('Failed to save pending messages:', e);
        }
    }

    loadPendingFromStorage() {
        try {
            const data = JSON.parse(localStorage.getItem('synqx_pending_messages') || '[]');
            data.forEach(item => {
                // Only restore messages from last 24 hours
                if (Date.now() - item.createdAt < 24 * 60 * 60 * 1000) {
                    this.pendingMessages.set(item.id, item);
                    this.queue.push(item);
                }
            });

            if (this.queue.length > 0) {
                console.log(`📦 Restored ${this.queue.length} pending messages from storage`);
            }
        } catch (e) {
            console.warn('Failed to load pending messages:', e);
        }
    }

    /**
     * Show network notification and update banner
     */
    showNetworkNotification(message, type) {
        // Update the network status banner
        this.updateNetworkBanner(type, message);

        // Also show toast notification
        if (window.fireflyChat && window.fireflyChat.showNotification) {
            window.fireflyChat.showNotification(message, type);
        }
    }

    /**
     * Update the network status banner in DOM
     */
    updateNetworkBanner(status, message) {
        const banner = document.getElementById('network-status-banner');
        const icon = document.getElementById('network-status-icon');
        const text = document.getElementById('network-status-text');

        if (!banner) return;

        // Remove all status classes
        banner.classList.remove('offline', 'slow', 'online', 'visible');

        switch (status) {
            case 'error':
            case 'warning':
                if (this.connectionQuality === 'offline' || !this.isOnline) {
                    banner.classList.add('offline', 'visible');
                    if (icon) icon.textContent = 'wifi_off';
                    if (text) text.textContent = message || 'You are offline';
                } else {
                    banner.classList.add('slow', 'visible');
                    if (icon) icon.textContent = 'signal_cellular_alt';
                    if (text) text.textContent = message || 'Slow connection';
                }
                break;
            case 'success':
                banner.classList.add('online', 'visible');
                if (icon) icon.textContent = 'wifi';
                if (text) text.textContent = message || 'Back online';

                // Hide after 3 seconds when back online
                setTimeout(() => {
                    banner.classList.remove('visible');
                }, 3000);
                break;
            default:
                // Hide banner for normal state
                banner.classList.remove('visible');
        }
    }


    /**
     * Utility: timeout promise
     */
    timeout(ms) {
        return new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), ms)
        );
    }

    /**
     * Utility: sleep promise
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get current connection quality
     */
    getConnectionQuality() {
        return {
            quality: this.connectionQuality,
            isOnline: this.isOnline,
            pendingCount: this.queue.length
        };
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.networkCheckInterval) {
            clearInterval(this.networkCheckInterval);
        }
        window.removeEventListener('online', this.handleOnline);
        window.removeEventListener('offline', this.handleOffline);
    }
}

/**
 * Image Optimization for slow connections
 */
class ImageOptimizer {
    /**
     * Compress image with quality based on connection
     */
    static async compressForConnection(file, connectionQuality = 'good') {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const img = new Image();
                img.onload = () => {
                    // Adjust parameters based on connection quality
                    let maxSize, quality;

                    switch (connectionQuality) {
                        case 'slow':
                            maxSize = 600;
                            quality = 0.5;
                            break;
                        case 'good':
                        default:
                            maxSize = 1024;
                            quality = 0.7;
                            break;
                    }

                    let width = img.width;
                    let height = img.height;

                    if (width > maxSize || height > maxSize) {
                        if (width > height) {
                            height = (height / width) * maxSize;
                            width = maxSize;
                        } else {
                            width = (width / height) * maxSize;
                            height = maxSize;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Use WebP if supported for better compression
                    const supportsWebP = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
                    const format = supportsWebP ? 'image/webp' : 'image/jpeg';

                    const compressed = canvas.toDataURL(format, quality);

                    const originalSize = file.size;
                    const compressedSize = Math.round((compressed.length * 3) / 4);

                    console.log(`🖼️ Image compressed: ${Math.round(originalSize / 1024)}KB → ${Math.round(compressedSize / 1024)}KB (${Math.round((1 - compressedSize / originalSize) * 100)}% reduction)`);

                    resolve({
                        dataUrl: compressed,
                        width,
                        height,
                        originalSize,
                        compressedSize,
                        format: format.split('/')[1]
                    });
                };
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    /**
     * Generate thumbnail for preview while full image uploads
     */
    static async generateThumbnail(dataUrl, size = 60) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const scale = Math.min(size / img.width, size / img.height);
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // Very small, low quality thumbnail
                resolve(canvas.toDataURL('image/jpeg', 0.3));
            };
            img.src = dataUrl;
        });
    }
}

/**
 * Progressive Image Loader
 * Shows thumbnail first, then loads full image
 */
class ProgressiveImageLoader {
    static createPlaceholder(thumbnail, fullUrl, messageId) {
        const container = document.createElement('div');
        container.className = 'progressive-image-container';
        container.dataset.messageId = messageId;

        container.innerHTML = `
            <img class="progressive-thumbnail blur" src="${thumbnail}" alt="Loading...">
            <img class="progressive-full" src="" alt="Image" style="display: none;">
            <div class="image-loading-spinner">
                <svg class="circular-loader" viewBox="25 25 50 50">
                    <circle class="loader-path" cx="50" cy="50" r="20" fill="none" stroke-width="3" stroke-miterlimit="10"/>
                </svg>
            </div>
        `;

        // Load full image in background
        const fullImg = container.querySelector('.progressive-full');
        const thumbImg = container.querySelector('.progressive-thumbnail');
        const spinner = container.querySelector('.image-loading-spinner');

        fullImg.onload = () => {
            thumbImg.style.display = 'none';
            fullImg.style.display = 'block';
            spinner.style.display = 'none';
        };

        fullImg.src = fullUrl;

        return container;
    }
}

// Initialize and export
if (typeof window !== 'undefined') {
    window.messageQueue = new MessageQueue();
    window.ImageOptimizer = ImageOptimizer;
    window.ProgressiveImageLoader = ProgressiveImageLoader;
}

console.log('✅ Message Queue System loaded');
