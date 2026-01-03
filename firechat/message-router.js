// Message Router - Firebase message handling

class MessageRouter {
    constructor() {
        this.database = null;
        this.currentUserId = null;
        this.activeListeners = new Map(); // Track active listeners to prevent duplicates
        this.init();
    }

    init() {
        if (typeof firebase !== 'undefined' && firebase.database) {
            this.database = firebase.database();
            this.currentUserId = localStorage.getItem('userId');
            console.log('✅ Message Router initialized');
        } else {
            console.warn('⚠️ Firebase not available');
        }
    }


    async sendMessage(recipientId, message) {
        if (!this.database || !this.currentUserId) {
            console.error('Cannot send message - not initialized');
            return { success: false };
        }

        try {
            // Check if both users have backup enabled
            const senderBackup = (typeof window.settingsManager?.isChatBackupEnabled === 'function') ? window.settingsManager.isChatBackupEnabled() : false;
            const recipientSnapshot = await this.database.ref(`users/${recipientId}/settings/chatBackup`).once('value');
            const recipientBackup = recipientSnapshot.val() ?? false;

            const usePermanent = senderBackup && recipientBackup;

            const messageData = {
                ...message,
                timestamp: message.timestamp || Date.now(),
                read: false,
                delivered: false,
                sender: this.currentUserId
            };

            // ALWAYS send to PENDING path for reliable delivery
            const pendingPath = `pending_messages/${recipientId}/${this.currentUserId}`;
            console.log(`📤 Sending to pending: ${pendingPath}`);

            const messageRef = this.database.ref(pendingPath).push();
            await messageRef.set(messageData);
            console.log(`📤 Pending message saved: ${messageRef.key}, Type: ${message.type || 'text'}`);

            // Save to sender's local storage
            this.saveMessageLocally(recipientId, { ...messageData, id: messageRef.key });

            // If permanent backup, also save to sender's outbox
            if (usePermanent) {
                await this.database.ref(`messages/${this.currentUserId}/${recipientId}`).push().set(messageData);
            }

            // Listen for delivery confirmation (when recipient removes from pending)
            this.listenForDelivery(recipientId, messageRef.key, messageData.timestamp);

            return { success: true, messageId: messageRef.key, isPermanent: usePermanent, timestamp: messageData.timestamp };
        } catch (error) {
            console.error('Error sending message:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Listen for delivery confirmation when pending message is removed
     */
    listenForDelivery(recipientId, messageId, timestamp) {
        const pendingPath = `pending_messages/${recipientId}/${this.currentUserId}/${messageId}`;
        const pendingRef = this.database.ref(pendingPath);

        // Small delay to ensure message is written first
        setTimeout(() => {
            // First check if message exists (it should since we just wrote it)
            pendingRef.once('value').then((snapshot) => {
                if (snapshot.exists()) {
                    console.log(`📨 Message ${messageId} is pending delivery, waiting for confirmation...`);

                    // Now set up listener for when it gets removed
                    const listener = pendingRef.on('value', (snap) => {
                        if (!snap.exists()) {
                            // Message was removed = delivered!
                            console.log(`✅ Message ${messageId} delivered to ${recipientId}`);

                            // Update UI to show "delivered" status
                            if (window.fireflyChat && window.fireflyChat.updateMessageStatusIcon) {
                                window.fireflyChat.updateMessageStatusIcon(timestamp, 'delivered');
                            }

                            // Clean up listener
                            pendingRef.off('value', listener);
                        }
                    });

                    // Timeout to stop listening after 5 minutes
                    setTimeout(() => {
                        pendingRef.off('value', listener);
                    }, 5 * 60 * 1000);
                } else {
                    // Message doesn't exist - might have been delivered already instantly
                    console.log(`⚠️ Message ${messageId} not found in pending - may be delivered instantly`);
                    // Mark as delivered anyway since recipient might have gotten it very fast
                    if (window.fireflyChat && window.fireflyChat.updateMessageStatusIcon) {
                        window.fireflyChat.updateMessageStatusIcon(timestamp, 'delivered');
                    }
                }
            });
        }, 300); // 300ms delay to ensure write completes
    }



    // Fetch pending messages and confirm delivery
    async fetchPendingMessages(peerId) {
        if (!this.database || !this.currentUserId) return [];

        try {
            const pendingPath = `pending_messages/${this.currentUserId}/${peerId}`;
            console.log(`📬 Checking pending: ${pendingPath}`);

            const snapshot = await this.database.ref(pendingPath).once('value');
            const messages = [];

            snapshot.forEach((child) => {
                messages.push({ id: child.key, ...child.val() });
            });

            if (messages.length > 0) {
                console.log(`📬 Found ${messages.length} pending messages`);
                // Confirm delivery - move to permanent storage
                await this.confirmDelivery(peerId, messages);
            }

            return messages;
        } catch (error) {
            console.error('Error fetching pending:', error);
            return [];
        }
    }

    // Move from pending to delivered
    async confirmDelivery(peerId, messages) {
        if (!this.database || !this.currentUserId) return;

        try {
            const updates = {};
            const hasBackup = (typeof window.settingsManager?.isChatBackupEnabled === 'function')
                ? window.settingsManager.isChatBackupEnabled() : false;

            for (const msg of messages) {
                // Remove from pending
                updates[`pending_messages/${this.currentUserId}/${peerId}/${msg.id}`] = null;

                // Save to permanent if backup on
                if (hasBackup) {
                    updates[`messages/${this.currentUserId}/${peerId}/${msg.id}`] = { ...msg, delivered: true };
                }

                // Always save locally
                this.saveMessageLocally(peerId, { ...msg, delivered: true });
            }

            await this.database.ref().update(updates);
            console.log(`✅ Delivery confirmed for ${messages.length} messages`);
        } catch (error) {
            console.error('Error confirming delivery:', error);
        }
    }


    listenForMessages(senderId, callback) {
        if (!this.database || !this.currentUserId) return;

        this.detachListener(`messages_${senderId}`);
        this.detachListener(`pending_${senderId}`);

        const timestamp = Date.now() + 1;

        // Listen on permanent messages path
        const messagesRef = this.database.ref(`messages/${this.currentUserId}/${senderId}`);
        const messagesQuery = messagesRef.orderByChild('timestamp').startAt(timestamp);

        const messagesListener = messagesQuery.on('child_added', (snapshot) => {
            const message = { id: snapshot.key, ...snapshot.val() };
            if (message && callback) {
                callback(message);
            }
        });

        // Listen on PENDING messages path (for new real-time messages)
        const pendingRef = this.database.ref(`pending_messages/${this.currentUserId}/${senderId}`);
        const pendingQuery = pendingRef.orderByChild('timestamp').startAt(timestamp);

        const pendingListener = pendingQuery.on('child_added', async (snapshot) => {
            const message = { id: snapshot.key, ...snapshot.val() };
            if (message && callback) {
                // Save locally and call callback
                this.saveMessageLocally(senderId, message);
                callback(message);

                // Only confirm delivery if user is CURRENTLY viewing this chat
                // This prevents double-tick showing when user is just in contacts list
                const isViewingThisChat = window.fireflyChat &&
                    window.fireflyChat.currentPeer &&
                    window.fireflyChat.currentPeer.uid === senderId;

                if (isViewingThisChat) {
                    await this.confirmDelivery(senderId, [message]);
                } else {
                    console.log(`📬 Message from ${senderId} received but not viewing chat - delivery not confirmed yet`);
                }
            }
        });

        this.activeListeners.set(`messages_${senderId}`, { ref: messagesQuery, listener: messagesListener });
        this.activeListeners.set(`pending_${senderId}`, { ref: pendingQuery, listener: pendingListener });

        console.log(`✅ Listening for messages from: ${senderId} (permanent + pending)`);
    }

    listenForAllMessages(userId, callback) {
        if (!this.database) return;
        this.detachListener('all_messages');
        const messagesRef = this.database.ref(`messages/${userId}`);
        const listener = messagesRef.on('child_added', (snapshot) => {
            snapshot.forEach((childSnapshot) => {
                const message = childSnapshot.val();
                if (message && callback) callback(message);
            });
        });
        this.activeListeners.set('all_messages', { ref: messagesRef, listener: listener });
        console.log(`✅ Listening for all messages for user: ${userId}`);
    }

    async getMessageHistory(peerId, limit = 50) {
        if (!this.database || !this.currentUserId) return [];

        try {
            // Fetch from both permanent and temporary paths
            const permPath = `messages/${this.currentUserId}/${peerId}`;
            const tempPath = `temp_messages/${this.currentUserId}/${peerId}`;

            console.log(`📜 Fetching history from paths:`);
            console.log(`   Permanent: ${permPath}`);
            console.log(`   Temporary: ${tempPath}`);

            const messagesRef = this.database.ref(permPath).limitToLast(limit);
            const tempRef = this.database.ref(tempPath).limitToLast(limit);

            const [messagesSnapshot, tempSnapshot] = await Promise.all([
                messagesRef.once('value'),
                tempRef.once('value')
            ]);

            const messages = [];

            messagesSnapshot.forEach((child) => messages.push({ id: child.key, ...child.val() }));
            tempSnapshot.forEach((child) => messages.push({ id: child.key, ...child.val() }));

            console.log(`📜 Firebase permanent messages: ${messagesSnapshot.numChildren()}, temp: ${tempSnapshot.numChildren()}`);

            // Merge with Local Storage History
            const localMessages = this.getLocalMessages(peerId);
            console.log(`📜 Local storage messages: ${localMessages.length}`);
            messages.push(...localMessages);

            // Deduplicate based on timestamp + text/content (simple approach)
            const uniqueMessages = [];
            const seen = new Set();

            // Sort all by timestamp first
            messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

            for (const msg of messages) {
                // Better unique key that handles images and text messages
                const contentKey = msg.type === 'image'
                    ? (msg.image?.substring(0, 50) || 'img')
                    : (msg.text || msg.message || '');
                const key = `${msg.timestamp}-${msg.type || 'text'}-${contentKey}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueMessages.push(msg);
                }
            }

            return uniqueMessages.slice(-limit);
        } catch (error) {
            console.error('Error getting message history:', error);
            // Fallback to local storage only if network fails
            return this.getLocalMessages(peerId).sort((a, b) => a.timestamp - b.timestamp).slice(-limit);
        }
    }

    async deleteMessage(peerId, messageIdOrTimestamp, forEveryone) {
        if (!this.database || !this.currentUserId || !messageIdOrTimestamp) {
            console.error('❌ Delete failed: missing params');
            return { success: false };
        }

        try {
            const updates = {};
            console.log(`🗑️ Deleting message ${messageIdOrTimestamp} (forEveryone: ${forEveryone})`);

            // Check if messageIdOrTimestamp is a timestamp (number) or an ID (string)
            const isTimestamp = typeof messageIdOrTimestamp === 'number' ||
                (typeof messageIdOrTimestamp === 'string' && !isNaN(messageIdOrTimestamp) && messageIdOrTimestamp.length > 10);

            let messageTimestamp = null;
            let messageId = null;

            if (isTimestamp) {
                messageTimestamp = parseInt(messageIdOrTimestamp);
                console.log(`🗑️ Deleting by timestamp: ${messageTimestamp}`);

                // Find message by timestamp in all paths
                const searchPaths = [
                    `messages/${this.currentUserId}/${peerId}`,
                    `pending_messages/${this.currentUserId}/${peerId}`
                ];

                for (const path of searchPaths) {
                    try {
                        const snap = await this.database.ref(path)
                            .orderByChild('timestamp')
                            .equalTo(messageTimestamp)
                            .once('value');

                        snap.forEach(child => {
                            updates[`${path}/${child.key}`] = null;
                            messageId = child.key;
                            console.log(`🗑️ Found at ${path}: ${child.key}`);
                        });
                    } catch (e) { }
                }
            } else {
                messageId = messageIdOrTimestamp;

                // 1. Delete from My View (all possible paths)
                updates[`messages/${this.currentUserId}/${peerId}/${messageId}`] = null;
                updates[`pending_messages/${this.currentUserId}/${peerId}/${messageId}`] = null;

                // 2. Get the message timestamp for finding it in other places
                const paths = [
                    `messages/${this.currentUserId}/${peerId}/${messageId}`,
                    `pending_messages/${this.currentUserId}/${peerId}/${messageId}`
                ];

                for (const path of paths) {
                    const snap = await this.database.ref(path).once('value');
                    if (snap.exists()) {
                        messageTimestamp = snap.val().timestamp;
                        break;
                    }
                }

                // 3. Delete from Peer's View (For Everyone)
                if (forEveryone && messageTimestamp) {
                    console.log(`🗑️ Attempting delete for everyone with timestamp: ${messageTimestamp}`);

                    // Check all paths in peer's storage
                    const peerPaths = [
                        { path: `messages/${peerId}/${this.currentUserId}`, name: 'messages' },
                        { path: `pending_messages/${peerId}/${this.currentUserId}`, name: 'pending' }
                    ];

                    for (const { path, name } of peerPaths) {
                        try {
                            const peerSnap = await this.database.ref(path)
                                .orderByChild('timestamp')
                                .equalTo(messageTimestamp)
                                .once('value');

                            peerSnap.forEach(child => {
                                updates[`${path}/${child.key}`] = null;
                                console.log(`🗑️ Found in ${name}: ${child.key}`);
                            });
                        } catch (e) {
                            console.log(`Could not check ${name} for peer`);
                        }
                    }
                }

                await this.database.ref().update(updates);
                console.log(`✅ Delete updates applied: ${Object.keys(updates).length} paths`);

                // Also delete from local storage
                this.deleteLocalMessage(peerId, messageId);

                // Also try to delete by timestamp from local storage
                if (messageTimestamp) {
                    this.deleteLocalMessageByTimestamp(peerId, messageTimestamp);
                }
            }

            // Apply updates for timestamp-based deletion
            if (Object.keys(updates).length > 0) {
                await this.database.ref().update(updates);
                console.log(`✅ Delete updates applied: ${Object.keys(updates).length} paths`);
            }

            return { success: true };
        } catch (error) {
            console.error('❌ Delete failed:', error);
            return { success: false, error: error.message };
        }
    }

    deleteLocalMessageByTimestamp(peerId, timestamp) {
        try {
            const key = `firechat_history_${this.currentUserId}_${peerId}`;
            let history = JSON.parse(localStorage.getItem(key) || '[]');
            history = history.filter(m => m.timestamp !== timestamp);
            localStorage.setItem(key, JSON.stringify(history));
        } catch (e) { }
    }

    deleteLocalMessage(peerId, messageId) {
        try {
            const key = `firechat_history_${this.currentUserId}_${peerId}`;
            let history = JSON.parse(localStorage.getItem(key) || '[]');
            // Filter out by ID if present, or we might need another way if local msgs lack IDs?
            // Local messages saved via saveMessageLocally should theoretically have IDs if we passed them.
            // If they don't, we might fail to delete locally.
            history = history.filter(m => m.id !== messageId);
            localStorage.setItem(key, JSON.stringify(history));
        } catch (e) { }
    }

    // --- Local Storage Helpers ---

    saveMessageLocally(peerId, message) {
        try {
            const key = `firechat_history_${this.currentUserId}_${peerId}`;
            let history = JSON.parse(localStorage.getItem(key) || '[]');

            // Add new message
            history.push(message);

            // Limit to last 200 messages per chat to save space
            if (history.length > 200) {
                history = history.slice(-200);
            }

            localStorage.setItem(key, JSON.stringify(history));
        } catch (e) {
            console.warn('Failed to save message locally', e);
        }
    }

    getLocalMessages(peerId) {
        try {
            const key = `firechat_history_${this.currentUserId}_${peerId}`;
            return JSON.parse(localStorage.getItem(key) || '[]');
        } catch (e) {
            return [];
        }
    }

    updateOnlineStatus(online) {
        if (!this.database || !this.currentUserId) return;

        const statusRef = this.database.ref(`users/${this.currentUserId}/status`);
        const connectedRef = this.database.ref('.info/connected');

        if (online) {
            connectedRef.on('value', (snap) => {
                if (snap.val() === true) {
                    // We're connected (or reconnected)!

                    // 1. Set online immediately
                    statusRef.set({
                        online: true,
                        lastSeen: Date.now() // Local time, or use ServerValue.TIMESTAMP
                    });

                    // 2. Queue the offline update
                    statusRef.onDisconnect().update({
                        online: false,
                        lastSeen: firebase.database.ServerValue.TIMESTAMP
                    });
                }
            });
        } else {
            // Manual offline (logout)
            statusRef.update({
                online: false,
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            });
            connectedRef.off();
        }
    }

    // Detach a specific listener by key
    detachListener(key) {
        if (this.activeListeners.has(key)) {
            const { ref } = this.activeListeners.get(key);
            ref.off(); // Detach all listeners from this reference
            this.activeListeners.delete(key);
            console.log(`🔌 Detached listener: ${key}`);
        }
    }

    // Detach all active listeners
    detachAllListeners() {
        this.activeListeners.forEach(({ ref }, key) => {
            ref.off();
            console.log(`🔌 Detached listener: ${key}`);
        });
        this.activeListeners.clear();
    }

    // Cleanup method to be called on logout or page unload
    cleanup() {
        this.detachAllListeners();
        this.updateOnlineStatus(false);
        console.log('🧹 MessageRouter cleaned up');
    }
}

// Initialize and export
if (typeof window !== 'undefined') {
    window.messageRouter = new MessageRouter();
}

console.log('✅ Message Router loaded');
