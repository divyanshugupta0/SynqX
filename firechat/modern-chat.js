// Modern Online Chat Application - FireFly-NOX
// Clean implementation for web-based messaging

class FireflyChat {
    constructor() {
        this.currentUser = null;
        this.currentPeer = null;
        this.messages = new Map();
        this.contacts = new Map();
        this.isConnected = false;

        this.init();
    }

    async init() {
        console.log('🚀 Initializing FireFly Chat...');

        // Check authentication
        if (!this.checkAuth()) {
            return;
        }

        // Load user data
        await this.loadUserData();

        // Load user settings from Firebase
        if (window.settingsManager) {
            await window.settingsManager.loadSettings();
        }

        // Initialize UI
        this.initializeUI();

        // Set up Firebase listeners
        this.setupFirebaseListeners();

        // Load saved contacts
        this.loadContacts();

        console.log('✅ FireFly Chat initialized successfully');

        // Hide App Loader
        setTimeout(() => {
            const loader = document.getElementById('app-loader');
            if (loader) {
                loader.style.transition = 'opacity 0.5s ease';
                loader.style.opacity = '0';
                setTimeout(() => {
                    loader.style.display = 'none';
                }, 500);
            }
        }, 1500); // Keep loader for a moment to ensure render
    }

    checkAuth() {
        console.log('🔐 Checking authentication...');

        const isLoggedOut = localStorage.getItem('isLoggedOut') === 'true';

        // If user explicitly logged out, redirect
        if (isLoggedOut) {
            console.warn('❌ User logged out, redirecting...');
            window.location.href = 'noxlogin.html';
            return false;
        }

        // Check for any form of user data
        const sessionUser = sessionStorage.getItem('currentUser');
        const userId = localStorage.getItem('userId');
        const userName = localStorage.getItem('userName');

        // If we have ANY user data, consider them authenticated
        if (sessionUser || userId || userName) {
            console.log('✅ User authenticated');
            localStorage.setItem('isLoggedOut', 'false');
            return true;
        }

        // No user data at all - redirect to login
        console.warn('❌ No authentication found');
        window.location.href = 'noxlogin.html';
        return false;
    }

    async loadUserData() {
        console.log('📥 Loading user data...');

        try {
            // First, try to get from session storage
            const sessionUser = sessionStorage.getItem('currentUser');
            if (sessionUser) {
                this.currentUser = JSON.parse(sessionUser);
                console.log('✅ Loaded from session:', this.currentUser.name);
            } else {
                // Build user from localStorage
                this.currentUser = {
                    uid: localStorage.getItem('userId'),
                    name: localStorage.getItem('userName') || 'User',
                    username: localStorage.getItem('userName') || 'User',
                    profilePicture: localStorage.getItem('userProfilePic') || 'anony.jpg'
                };
                console.log('📦 Built from localStorage:', this.currentUser.name);
            }

            // Now fetch fresh data from Firebase database
            if (window.messageRouter && window.messageRouter.database && this.currentUser.uid) {
                console.log('🔄 Fetching from Firebase...');

                try {
                    const userRef = window.messageRouter.database.ref(`users/${this.currentUser.uid}`);
                    const snapshot = await userRef.once('value');

                    if (snapshot.exists()) {
                        const firebaseData = snapshot.val();

                        // Merge Firebase data with current user
                        this.currentUser = {
                            uid: this.currentUser.uid,
                            ...firebaseData,
                            // Preserve UID
                        };

                        // Update localStorage with fresh data
                        localStorage.setItem('userName', this.currentUser.name || this.currentUser.username);
                        if (this.currentUser.profilePicture) {
                            localStorage.setItem('userProfilePic', this.currentUser.profilePicture);
                        }

                        // Update sessionStorage
                        sessionStorage.setItem('currentUser', JSON.stringify(this.currentUser));

                        console.log('✅ Updated from Firebase:', this.currentUser);
                    } else {
                        console.warn('⚠️ User not found in Firebase database');
                    }
                } catch (firebaseError) {
                    console.warn('⚠️ Firebase fetch failed:', firebaseError.message);
                    console.log('📦 Using cached data');
                }
            } else {
                console.warn('⚠️ Firebase not available, using cached data');
            }

            // Update UI with user data
            const profileIcon = document.querySelector('#profile-icon img');
            if (profileIcon && this.currentUser.profilePicture) {
                profileIcon.src = this.currentUser.profilePicture;
            }

            // Update profile modal if present
            const profileNameInput = document.getElementById('profile-name-input');
            if (profileNameInput) {
                profileNameInput.value = this.currentUser.name || '';
            }

            const profileImgPreview = document.getElementById('profile-img-preview');
            if (profileImgPreview && this.currentUser.profilePicture) {
                profileImgPreview.src = this.currentUser.profilePicture;
            }

            console.log('✅ User data loaded:', this.currentUser.name);
        } catch (error) {
            console.error('❌ Error loading user data:', error);
        }
    }
    initializeUI() {
        console.log('🎨 Initializing UI...');

        // Sidebar icon handlers
        const sidebarIcons = document.querySelectorAll('.sidebar-icon');
        if (sidebarIcons.length > 0) {
            // Chat icon (index 0)
            if (sidebarIcons[0]) {
                sidebarIcons[0].addEventListener('click', () => {
                    console.log('Chat view');
                    this.showNotification('Chat view', 'info');
                });
            }

            // People icon (index 1)
            if (sidebarIcons[1]) {
                sidebarIcons[1].addEventListener('click', () => {
                    console.log('People view');
                    this.showContactsModal(); // Or openUsersModal
                });
            }

            // Calls icon (index 2)
            if (sidebarIcons[2]) {
                sidebarIcons[2].addEventListener('click', () => {
                    console.log('Calls view');
                    if (window.openCallsModal) window.openCallsModal();
                });
            }

            // Settings icon (index 3)
            if (sidebarIcons[3]) {
                sidebarIcons[3].addEventListener('click', () => {
                    console.log('Settings view');
                    this.showSettingsModal();
                });
            }
        }

        // Message input auto-resize & URL Preview
        const messageInput = document.getElementById('message-input');
        if (messageInput) {
            // Assign method to class for external use
            this.updateInputButtons = () => {
                const hasText = messageInput.value.trim().length > 0;
                const sendBtn = document.getElementById('send-btn');
                const micBtn = document.getElementById('mic-btn');
                if (sendBtn && micBtn) {
                    sendBtn.style.display = hasText ? 'flex' : 'none';
                    micBtn.style.display = hasText ? 'none' : 'flex';
                }
            };

            // Run once on init
            this.updateInputButtons();

            let inputDebounceTimer;
            messageInput.addEventListener('input', () => {
                messageInput.style.height = 'auto';
                messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';

                // Update buttons on input
                this.updateInputButtons();

                // URL Preview Logic with Debounce
                const text = messageInput.value;
                const urlRegex = /(https?:\/\/[^\s]+)/g;
                const match = text.match(urlRegex);
                const previewPanel = document.getElementById('url-preview-panel');

                if (match && match.length > 0) {
                    const url = match[0];

                    // Show basic preview immediately if hidden
                    if (previewPanel && previewPanel.style.display === 'none') {
                        previewPanel.style.display = 'flex';
                        // Reset to placeholder state
                        document.getElementById('url-preview-title').textContent = 'Loading preview...';
                        document.getElementById('url-preview-domain').textContent = new URL(url).hostname;
                        document.getElementById('url-preview-thumb').innerHTML = '<i class="material-icons">link</i>';
                    }

                    // Debounce fetching metadata
                    clearTimeout(inputDebounceTimer);
                    inputDebounceTimer = setTimeout(async () => {
                        try {
                            const encodeUrl = encodeURIComponent(url);
                            const response = await fetch(`https://api.microlink.io/?url=${encodeUrl}&palette=true`);
                            const data = await response.json();

                            if (data.status === 'success') {
                                const meta = data.data;
                                document.getElementById('url-preview-title').textContent = meta.title || meta.url;
                                document.getElementById('url-preview-domain').textContent = meta.publisher || new URL(url).hostname;

                                if (meta.image && meta.image.url) {
                                    document.getElementById('url-preview-thumb').innerHTML = `<img src="${meta.image.url}" alt="preview">`;
                                    // Store meta for sending
                                    window.currentLinkMeta = {
                                        title: meta.title,
                                        desc: meta.description,
                                        image: meta.image.url,
                                        url: meta.url,
                                        domain: meta.publisher || new URL(url).hostname
                                    };
                                } else {
                                    window.currentLinkMeta = null;
                                }
                            }
                        } catch (err) {
                            console.warn('Link preview fetch failed', err);
                        }
                    }, 500); // Wait 500ms after typing stops

                } else {
                    if (previewPanel && (!text || text.trim() === '')) {
                        previewPanel.style.display = 'none';
                        window.currentLinkMeta = null;
                    }
                }
            });

            // Send on Enter (Shift+Enter for new line)
            // Ctrl/Cmd + E for emoji picker
            messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                } else if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                    e.preventDefault();
                    if (typeof triggerNativeEmoji === 'function') {
                        triggerNativeEmoji();
                    }
                }
            });
        }

        // Profile icon click
        const profileIcon = document.getElementById('profile-icon');
        if (profileIcon) {
            profileIcon.addEventListener('click', () => {
                console.log('Opening profile modal');
                this.openProfileModal();
            });
        }

        // File input
        const fileInput = document.getElementById('file-input');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.handleFileUpload(e.target.files);
            });
        }

        // Attach button - trigger file input
        const attachBtn = document.querySelector('.input-btn:nth-child(3)');
        if (attachBtn) {
            attachBtn.addEventListener('click', () => {
                console.log('Attach button clicked');
                document.getElementById('file-input')?.click();
            });
        }

        // Profile picture preview
        const profilePicInput = document.getElementById('profile-pic-input');
        if (profilePicInput) {
            profilePicInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        document.getElementById('profile-img-preview').src = e.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        console.log('✅ UI initialized');
    }

    showContactsModal() {
        if (typeof window.openUsersModal === 'function') {
            window.openUsersModal();
        } else {
            this.showNotification('Users modal not loaded yet', 'error');
        }
    }

    showSettingsModal() {
        if (typeof window.openSettingsModal === 'function') {
            window.openSettingsModal();
        } else {
            this.showNotification('Settings modal not loaded yet', 'error');
        }
    }

    async setupFirebaseListeners() {
        if (!window.messageRouter) {
            console.warn('⚠️ MessageRouter not available, some features may be limited');
            return;
        }

        // Update online status
        window.messageRouter.updateOnlineStatus(true);

        // Load blocked users for filtering
        try {
            const blockedRef = window.messageRouter.database.ref(`users/${this.currentUser.uid}/blocked`);
            const snapshot = await blockedRef.once('value');
            const blockedIds = snapshot.val();
            this.blockedUsersSet = new Set(Object.keys(blockedIds || {}));
            console.log('🚫 Loaded blocked users:', this.blockedUsersSet.size);

            // Listen for changes to blocked list
            blockedRef.on('value', (snap) => {
                const updated = snap.val();
                this.blockedUsersSet = new Set(Object.keys(updated || {}));
            });
        } catch (e) { console.error('Error loading blocked list', e); }

        // Monitor for blocked users trying to connect (re-creating chat node)
        // This catches NEW attempts from blocked users
        // Monitor for blocked users and New Chats (Both Permanent and Temp)
        const handleIncomingChatNode = async (snapshot) => {
            const senderId = snapshot.key;

            // CHECK: Is this a blocked user?
            if (this.blockedUsersSet && this.blockedUsersSet.has(senderId)) {
                let senderName = 'Blocked User';
                try {
                    const userSnap = await window.messageRouter.database.ref(`users/${senderId}`).once('value');
                    const user = userSnap.val();
                    if (user) senderName = user.name || user.username || 'Blocked User';
                } catch (e) { }

                this.showNotification(`Blocked user ${senderName} tried to connect`, 'warning');
                snapshot.ref.remove();
                console.log(`🚫 Blocked connection attempt from ${senderId}`);
            }
            // CHECK: Is this a NEW contact?
            else if (!this.contacts.has(senderId) && senderId !== this.currentUser.uid) {
                console.log('📬 New chat discovered from:', senderId);
                try {
                    const userSnap = await window.messageRouter.database.ref(`users/${senderId}`).once('value');
                    const user = userSnap.val();
                    if (user) {
                        const newContact = {
                            uid: senderId,
                            name: user.name || user.username,
                            username: user.username,
                            profilePicture: user.profilePicture,
                            lastRead: 0
                        };
                        this.addToContacts(newContact);
                        this.showNotification(`New message from ${newContact.name}`, 'info');
                    }
                } catch (e) {
                    console.error('Error adding new contact:', e);
                }
            }
        };

        window.messageRouter.database.ref(`messages/${this.currentUser.uid}`).on('child_added', handleIncomingChatNode);
        window.messageRouter.database.ref(`temp_messages/${this.currentUser.uid}`).on('child_added', handleIncomingChatNode);


        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            if (window.messageRouter) {
                window.messageRouter.cleanup(); // Use the new cleanup method
            }
        });
    }

    async connectToUser() {
        const usernameInput = document.getElementById('username-input');
        const username = usernameInput ? usernameInput.value.trim() : '';

        if (!username) {
            this.showNotification('Please enter a username', 'error');
            return;
        }

        if (username === this.currentUser.name || username === this.currentUser.username) {
            this.showNotification('You cannot chat with yourself!', 'error');
            return;
        }

        console.log('🔗 Connecting to:', username);
        this.showLoading(true);

        // Add timeout to prevent hanging
        const timeout = setTimeout(() => {
            this.showLoading(false);
            this.showNotification('Connection timeout - user may not exist', 'error');
        }, 10000); // 10 second timeout

        try {
            // Search for user in Firebase
            if (window.messageRouter && window.messageRouter.database) {
                const usersRef = window.messageRouter.database.ref('users');
                const snapshot = await usersRef.once('value');

                clearTimeout(timeout); // Clear timeout on success

                let foundUser = null;
                snapshot.forEach((child) => {
                    const user = child.val();
                    if (user.username === username || user.name === username) {
                        foundUser = {
                            uid: child.key,
                            ...user
                        };
                    }
                });

                if (foundUser) {
                    this.currentPeer = foundUser;
                    this.openChatWithPeer(foundUser);
                    this.addToContacts(foundUser);
                    usernameInput.value = '';
                    this.showNotification(`Connected with ${foundUser.name || foundUser.username}`, 'success');
                    console.log('✅ Connected to:', foundUser.name);
                } else {
                    this.showNotification(`User "${username}" not found`, 'error');
                    console.log('❌ User not found:', username);
                }
            } else {
                clearTimeout(timeout);
                this.showNotification('Firebase not initialized', 'error');
                console.error('❌ Firebase not available');
            }
        } catch (error) {
            clearTimeout(timeout);
            console.error('❌ Error connecting to user:', error);
            this.showNotification('Failed to connect: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    openChatWithPeer(peer) {
        this.currentPeer = peer;
        this.isConnected = true;

        // Clear unread count & refresh list
        if (this.unreadCounts) this.unreadCounts.set(peer.uid, 0);

        // Show Input Area
        const inputArea = document.getElementById('chat-input-area');
        if (inputArea) inputArea.style.display = 'flex';

        // Update lastRead for persistent tracking
        if (this.contacts.has(peer.uid)) {
            const contact = this.contacts.get(peer.uid);
            contact.lastRead = Date.now();
            this.contacts.set(peer.uid, contact);
            this.saveContacts();
        }

        this.updateContactsList();

        // Update header
        const mainHeader = document.getElementById('chat-main-header');
        if (mainHeader) mainHeader.style.display = 'flex';
        const headerAvatar = document.getElementById('chat-header-avatar');
        const headerName = document.getElementById('chat-header-name');
        const status = document.getElementById('connection-status');

        if (headerAvatar) {
            headerAvatar.src = peer.profilePicture || 'anony.jpg';
            headerAvatar.style.display = 'block';
        }
        if (headerName) {
            headerName.textContent = peer.name || peer.username;
        }
        if (status) {
            status.innerHTML = '<span class="status-dot"></span><span>Online</span>';
        }

        /* --- UPDATE INFO PANEL --- */

        // 1. Basic Profile Info
        const infoAvatar = document.getElementById('peer-avatar');
        if (infoAvatar) infoAvatar.src = peer.profilePicture || 'anony.jpg';

        const infoName = document.getElementById('peer-name');
        if (infoName) infoName.textContent = peer.name || peer.username;

        const infoUsername = document.getElementById('peer-username-display');
        if (infoUsername) infoUsername.textContent = '@' + (peer.username || peer.name);

        // 2. Fetch About Info
        const infoAbout = document.getElementById('peer-about');
        if (infoAbout) {
            // Priority 1: Show local data if available
            // Priority 2: Show default text
            // Prefer displaying something immediately over text "Loading..." which looks broken
            infoAbout.textContent = peer.about || 'Hey there! I am using FireFly.';

            if (window.messageRouter && window.messageRouter.database) {
                window.messageRouter.database.ref('users/' + peer.uid + '/about').once('value').then(snap => {
                    const fetchedAbout = snap.val();
                    // usage: fetchedAbout (if true-ish) OR default
                    infoAbout.textContent = fetchedAbout || 'Hey there! I am using FireFly.';

                    // Update local peer object for next time
                    if (fetchedAbout) {
                        peer.about = fetchedAbout;
                        // Ideally we should save this update to contacts, but peer might be a copy
                        if (this.contacts.has(peer.uid)) {
                            this.contacts.get(peer.uid).about = fetchedAbout;
                            this.saveContacts();
                        }
                    }
                }).catch((e) => {
                    console.warn('Failed to fetch about:', e);
                    // Keep showing whatever we are showing (local or default)
                });
            }
        }

        // 3. Populate Media Grid
        const mediaGrid = document.getElementById('media-grid');
        const mediaCountDisplay = document.getElementById('media-count');

        if (window.messageRouter && (mediaGrid || mediaCountDisplay)) {
            // Fetch more history to find media
            window.messageRouter.getMessageHistory(peer.uid, 100).then(messages => {
                // Filter for images and gifs, newest first
                const mediaMessages = messages.filter(m => m.type === 'image' || m.type === 'gif').reverse();

                if (mediaCountDisplay) mediaCountDisplay.textContent = mediaMessages.length;

                if (mediaGrid) {
                    mediaGrid.innerHTML = '';
                    if (mediaMessages.length === 0) {
                        mediaGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #8696a0; font-size: 13px; padding: 10px;">No media shared</div>';
                    } else {
                        // Show top 6
                        mediaMessages.slice(0, 6).forEach(msg => {
                            const thumb = document.createElement('div');
                            thumb.className = 'media-thumb';
                            // Use msg.image for image type, msg.content for GIFs
                            const mediaSrc = msg.image || msg.content;
                            thumb.innerHTML = `<img src="${mediaSrc}" alt="media" style="width:100%; height:100%; object-fit:cover;">`;
                            thumb.onclick = () => {
                                // Use image preview modal
                                if (typeof openImagePreview === 'function') {
                                    openImagePreview(mediaSrc);
                                } else {
                                    window.open(mediaSrc, '_blank');
                                }
                            };
                            mediaGrid.appendChild(thumb);
                        });
                    }
                }
            });
        }
        /* ------------------------- */

        // Clear and show messages area
        this.clearMessagesArea();

        // Load message history
        this.loadMessageHistory(peer.uid);

        // Detach listeners from previous chat if any
        if (this.previousPeerId && window.messageRouter) {
            window.messageRouter.detachListener(`messages_${this.previousPeerId}`);
            window.messageRouter.detachListener(`pending_${this.previousPeerId}`);
            console.log(`🔇 Detached listeners from previous peer: ${this.previousPeerId}`);
        }

        // Listen for new messages from this peer
        if (window.messageRouter) {
            window.messageRouter.listenForMessages(peer.uid, (message) => {
                // Double-check the message is from the current peer
                if (this.currentPeer && message.sender !== this.currentUser.uid) {
                    this.displayMessage(message, 'received');
                }
            });
        }

        // Track current peer for cleanup when switching
        this.previousPeerId = peer.uid;

        console.log('✅ Chat opened with:', peer.name || peer.username);
    }

    async sendMessage() {
        if (!this.currentPeer) {
            this.showNotification('No active chat', 'error');
            return;
        }

        const messageInput = document.getElementById('message-input');
        const rawText = messageInput.value;

        // Check if message is empty (only whitespace)
        if (!rawText.trim()) {
            return;
        }

        // Preserve the original text with newlines
        const text = rawText;

        const message = {
            text: text,
            type: 'text',
            timestamp: Date.now(),
            sender: this.currentUser.uid,
            senderName: this.currentUser.name || this.currentUser.username || 'User'
        };

        // Attach Reply Context
        if (window.messageToReply) {
            message.replyContext = {
                replyToId: window.messageToReply.timestamp, // or ID
                replyToName: window.messageToReply.senderName,
                replyToText: window.messageToReply.text || (window.messageToReply.type === 'image' ? 'Photo' : 'Message'),
                replyToType: window.messageToReply.type,
                replyToImage: (window.messageToReply.type === 'image' ? (window.messageToReply.image || window.messageToReply.content) : null)
            };
            window.cancelReply();
        }

        // Attach link metadata if it exists
        if (window.currentLinkMeta) {
            message.linkMeta = window.currentLinkMeta;
            window.currentLinkMeta = null;
        }

        // Display immediately
        this.displayMessage(message, 'sent');

        // Clear input
        messageInput.value = '';
        messageInput.style.height = 'auto';
        if (typeof this.updateInputButtons === 'function') this.updateInputButtons(); // Restore Mic Button
        if (window.clearUrlPreview) window.clearUrlPreview();

        // Send via Firebase
        if (window.messageRouter) {
            try {
                await window.messageRouter.sendMessage(this.currentPeer.uid, message);
                console.log('✅ Message sent');
            } catch (error) {
                console.error('❌ Error sending message:', error);
                this.showNotification('Failed to send message', 'error');
            }
        }
    }

    displayMessage(message, type = 'received') {
        // Check if it's an image message
        if (message.type === 'image') {
            return this.displayImageMessage(message, type);
        }

        // Check if it's a GIF message
        if (message.type === 'gif') {
            return this.displayGifMessage(message, type);
        }

        // Check if it's an Audio message
        if (message.type === 'audio') {
            return this.displayAudioMessage(message, type);
        }

        // Register message for robust handling
        if (message && message.timestamp) {
            window.messageRegistry[message.timestamp] = message;
        }

        const container = document.getElementById('messages-container');
        if (!container) return;

        // Remove empty state if present
        const emptyState = container.querySelector('[style*="text-align: center"]');
        if (emptyState) {
            emptyState.remove();
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `message-container ${type}`;

        const time = new Date(message.timestamp || Date.now());
        const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        // Get avatar - use current peer's pic for received, current user's for sent
        let avatarSrc = 'anony.jpg';
        if (type === 'sent' && this.currentUser) {
            avatarSrc = this.currentUser.profilePicture || 'anony.jpg';
        } else if (type === 'received' && this.currentPeer) {
            avatarSrc = this.currentPeer.profilePicture || 'anony.jpg';
        }

        // --- Link Preview Detection ---
        // --- Reply Context ---
        let replyContextHTML = '';
        if (message.replyContext) {
            const rc = message.replyContext;
            const icon = rc.replyToType === 'image' ? '<i class="material-icons reply-context-media-icon">photo</i>' : '';

            let thumbHTML = '';
            if (rc.replyToImage) {
                thumbHTML = `<div class="reply-context-thumb"><img src="${rc.replyToImage}"></div>`;
            }

            replyContextHTML = `
                <div class="reply-context" onclick="/* Scroll to message logic could go here */">
                    ${thumbHTML}
                    <div class="reply-context-content">
                        <div class="reply-context-name">${this.escapeHtml(rc.replyToName)}</div>
                        <div class="reply-context-text">${icon}${this.escapeHtml(rc.replyToText)}</div>
                    </div>
                </div>
            `;
        }

        // --- Link Preview Detection ---
        let msgContent = this.escapeHtml(message.text || message.message);
        let linkPreviewHTML = '';

        // Simple regex to detect URLs for linkification
        const urlRegex = /(https?:\/\/[^\s]+)/g;

        // Check for Rich Metadata attached to message
        if (message.linkMeta) {
            const meta = message.linkMeta;
            linkPreviewHTML = `
                <div class="rich-link-card" onclick="window.open('${meta.url}', '_blank')">
                    <img src="${meta.image || ''}" class="rich-link-image" onerror="this.style.display='none'">
                    <div class="rich-link-content">
                        <div class="rich-link-title">${this.escapeHtml(meta.title)}</div>
                        <div class="rich-link-desc">${this.escapeHtml(meta.desc || '')}</div>
                        <div class="rich-link-domain">${this.escapeHtml(meta.domain)}</div>
                    </div>
                </div>
            `;

            // Linkify text
            msgContent = msgContent.replace(urlRegex, (url) => {
                return `<a href="${url}" target="_blank">${url}</a>`;
            });

        } else {
            // Fallback: Client-side detection for old messages or failures
            const urls = (message.text || message.message).match(urlRegex);
            if (urls && urls.length > 0) {
                const url = urls[0];
                try {
                    const urlObj = new URL(url);
                    const domain = urlObj.hostname;

                    // Simple card only (no image)
                    linkPreviewHTML = `
                        <div class="link-preview-container" onclick="window.open('${url}', '_blank')">
                            <div class="link-preview-content">
                                <div class="link-preview-title">${domain}</div>
                                <div class="link-preview-desc">${url}</div>
                                <div class="link-preview-domain">${domain}</div>
                            </div>
                        </div>
                    `;

                    msgContent = msgContent.replace(urlRegex, (url) => {
                        return `<a href="${url}" target="_blank">${url}</a>`;
                    });

                } catch (e) {
                    // Invalid URL
                }
            }
        }
        // ------------------------------

        messageDiv.innerHTML = `
            <div class="message-avatar">
                <img src="${avatarSrc}" alt="Avatar">
            </div>
            <div class="message-content">
                <div class="message-bubble">
                    ${replyContextHTML}
                    ${linkPreviewHTML}
                    <div class="message-text" style="white-space: pre-wrap;">${msgContent}</div>
                    <div class="message-time">${timeStr}</div>
                </div>
            </div>
            
            <!-- Message Options Context Menu -->
             <div class="message-options-container" style="position: relative; align-self: center; margin-left: 8px;">
                 <i class="material-icons message-options-btn" onclick="toggleMessageOptions(this)" 
                    style="font-size: 16px; color: #8696a0; cursor: pointer; opacity: 0; transition: opacity 0.2s;">
                    keyboard_arrow_down
                 </i>
                 <div class="message-options-dropdown" style="display: none; position: absolute; top: 20px; right: 0; background: #233138; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); z-index: 100; min-width: 150px; overflow: hidden; padding: 4px 0;">
                     <div class="msg-opt-item" onclick="window.handleMessageAction('${message.timestamp}', 'reply')" 
                          style="padding: 10px 16px; color: #d1d7db; cursor: pointer; display: flex; align-items: center; font-size: 14px;">
                         <i class="material-icons" style="font-size: 20px; margin-right: 12px; color: #8696a0;">reply</i> Reply
                     </div>
                     <div class="msg-opt-item" onclick="window.handleMessageAction('${message.timestamp}', 'forward')" 
                          style="padding: 10px 16px; color: #d1d7db; cursor: pointer; display: flex; align-items: center; font-size: 14px; hover:background: #111b21;">
                         <i class="material-icons" style="font-size: 20px; margin-right: 12px; color: #8696a0;">forward</i> Forward
                     </div>
                     <div class="msg-opt-item" onclick="navigator.clipboard.writeText('${this.escapeHtml(message.text || '')}')"
                          style="padding: 10px 16px; color: #d1d7db; cursor: pointer; display: flex; align-items: center; font-size: 14px;">
                         <i class="material-icons" style="font-size: 20px; margin-right: 12px; color: #8696a0;">content_copy</i> Copy
                     </div>
                     <div class="msg-opt-item" onclick="window.handleMessageAction('${message.timestamp}', 'delete')"
                          style="padding: 10px 16px; color: #ef4444; cursor: pointer; display: flex; align-items: center; font-size: 14px;">
                         <i class="material-icons" style="font-size: 20px; margin-right: 12px; color: #ef4444;">delete</i> Delete
                     </div>
                 </div>
             </div>
        `;

        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;

        // Animate in
        setTimeout(() => {
            messageDiv.style.opacity = '0';
            messageDiv.style.transform = 'translateY(20px)';
            setTimeout(() => {
                messageDiv.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                messageDiv.style.opacity = '1';
                messageDiv.style.transform = 'translateY(0)';
            }, 10);
        }, 10);
    }

    handleIncomingMessage(message) {
        if (this.currentPeer && message.sender === this.currentPeer.uid) {
            this.displayMessage(message, 'received');
        } else {
            // Show notification for messages from other users
            const senderName = message.senderName || 'Someone';
            this.showNotification(`New message from ${senderName}`, 'info');

            // Play sound if enabled
            if (window.settingsManager) {
                window.settingsManager.playNotificationSound();

                // Show desktop notification if enabled
                const messagePreview = message.text ? (message.text.length > 50 ? message.text.substring(0, 50) + '...' : message.text) : 'New message';
                window.settingsManager.showDesktopNotification(
                    senderName,
                    messagePreview,
                    message.senderProfilePic || 'anony.jpg'
                );
            }
        }
    }

    async loadMessageHistory(peerId) {
        if (!window.messageRouter) return;

        try {
            console.log('📜 Loading message history for peer:', peerId);

            // First, fetch any PENDING messages (not yet delivered)
            const pendingMessages = await window.messageRouter.fetchPendingMessages(peerId);
            console.log('📬 Pending messages fetched:', pendingMessages?.length || 0);

            // Then get normal message history
            const history = await window.messageRouter.getMessageHistory(peerId, 50);
            console.log('📜 History messages:', history?.length || 0);

            // Combine pending + history, sort by timestamp, remove duplicates
            const allMessages = [...(pendingMessages || []), ...(history || [])];
            const uniqueMessages = [];
            const seen = new Set();

            allMessages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

            for (const msg of allMessages) {
                const key = `${msg.timestamp}-${msg.type || 'text'}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueMessages.push(msg);
                }
            }

            console.log('📜 Total unique messages:', uniqueMessages.length);

            if (uniqueMessages.length > 0) {
                uniqueMessages.forEach(msg => {
                    const type = msg.sender === this.currentUser.uid ? 'sent' : 'received';
                    this.displayMessage(msg, type);
                });
            } else {
                console.log('📜 No messages found');
            }
        } catch (error) {
            console.error('❌ Error loading message history:', error);
        }
    }

    async handleFileUpload(files) {
        if (!files || files.length === 0) return;
        if (!this.currentPeer) {
            this.showNotification('No active chat', 'error');
            return;
        }

        const file = files[0];

        if (file.type.startsWith('image/')) {
            // await this.sendImage(file);
            window.openImageCaptionPanel(file);
        } else {
            this.showNotification('Only images are supported currently', 'info');
        }
    }

    async sendImage(file) {
        this.showLoading(true);

        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const img = new Image();
                img.onload = async () => {
                    // Compress image
                    const maxSize = 1024;
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

                    const compressed = canvas.toDataURL('image/jpeg', 0.7);

                    const message = {
                        type: 'image',
                        image: compressed,
                        timestamp: Date.now(),
                        sender: this.currentUser.uid,
                        senderName: this.currentUser.name || this.currentUser.username || 'User'
                    };

                    // Display and send
                    this.displayImageMessage(message, 'sent');

                    if (window.messageRouter) {
                        await window.messageRouter.sendMessage(this.currentPeer.uid, message);
                    }

                    this.showLoading(false);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('❌ Error sending image:', error);
            this.showNotification('Failed to send image', 'error');
            this.showLoading(false);
        }
    }

    async sendGifMessage(gifUrl) {
        if (!this.currentPeer) {
            this.showNotification('No active chat', 'error');
            return;
        }

        const message = {
            type: 'gif',
            content: gifUrl,
            timestamp: Date.now(),
            sender: this.currentUser.uid,
            senderName: this.currentUser.name || this.currentUser.username || 'User'
        };

        // Display GIF message immediately
        this.displayGifMessage(message, 'sent');

        // Send via Firebase
        if (window.messageRouter) {
            try {
                await window.messageRouter.sendMessage(this.currentPeer.uid, message);
                console.log('✅ GIF sent');
            } catch (error) {
                console.error('❌ Error sending GIF:', error);
                this.showNotification('Failed to send GIF', 'error');
            }
        }
    }

    displayGifMessage(message, type) {
        // Register message
        if (message && message.timestamp) {
            window.messageRegistry[message.timestamp] = message;
        }

        const container = document.getElementById('messages-container');
        if (!container) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `message-container ${type}`;

        const time = new Date(message.timestamp);
        const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        let avatarSrc = 'anony.jpg';
        if (type === 'sent' && this.currentUser) {
            avatarSrc = this.currentUser.profilePicture || 'anony.jpg';
        } else if (type === 'received' && this.currentPeer) {
            avatarSrc = this.currentPeer.profilePicture || 'anony.jpg';
        }

        messageDiv.innerHTML = `
            <div class="message-avatar">
                <img src="${avatarSrc}" alt="Avatar">
            </div>
            <div class="message-content">
                <div class="message-bubble image-message">
                    <!-- Message Options inside bubble -->
                    <div class="message-options-container" style="position: absolute; top: 8px; right: 8px; z-index: 10;">
                        <i class="material-icons message-options-btn" onclick="toggleMessageOptions(this)" 
                           style="font-size: 18px; color: rgba(255,255,255,0.8); cursor: pointer; opacity: 0; transition: opacity 0.2s; 
                                  background: rgba(0,0,0,0.4); border-radius: 50%; padding: 4px;">
                           keyboard_arrow_down
                        </i>
                        <div class="message-options-dropdown" style="display: none; position: absolute; top: 30px; right: 0; background: #233138; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); z-index: 100; min-width: 150px; overflow: hidden; padding: 4px 0;">
                            <div class="msg-opt-item" onclick="window.handleMessageAction('${message.timestamp}', 'reply')" 
                                 style="padding: 10px 16px; color: #d1d7db; cursor: pointer; display: flex; align-items: center; font-size: 14px;">
                                <i class="material-icons" style="font-size: 20px; margin-right: 12px; color: #8696a0;">reply</i> Reply
                            </div>
                            <div class="msg-opt-item" onclick="window.handleMessageAction('${message.timestamp}', 'forward')" 
                                 style="padding: 10px 16px; color: #d1d7db; cursor: pointer; display: flex; align-items: center; font-size: 14px;">
                                <i class="material-icons" style="font-size: 20px; margin-right: 12px; color: #8696a0;">forward</i> Forward
                            </div>
                            <div class="msg-opt-item" onclick="window.handleMessageAction('${message.timestamp}', 'delete')"
                                 style="padding: 10px 16px; color: #ef4444; cursor: pointer; display: flex; align-items: center; font-size: 14px;">
                                <i class="material-icons" style="font-size: 20px; margin-right: 12px; color: #ef4444;">delete</i> Delete
                            </div>
                        </div>
                    </div>
                    
                    <div class="image-loading-container is-loading">
                        <img src="${message.content}" alt="GIF" class="chat-media loading" 
                             style="max-width: 100% !important; height: auto !important; border-radius: 8px; display: block;" 
                             onclick="openImagePreview('${message.content}')"
                             onload="this.classList.remove('loading'); this.parentElement.classList.remove('is-loading');">
                        
                        <div class="image-loader-overlay">
                             <svg class="circular-loader" viewBox="25 25 50 50">
                                 <circle class="loader-path" cx="50" cy="50" r="20" fill="none" stroke-width="4" stroke-miterlimit="10"/>
                             </svg>
                        </div>
                    </div>
                    <div class="message-time">${timeStr}</div>
                </div>
            </div>
        `;

        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;
    }

    displayImageMessage(message, type) {
        // Register message
        if (message && message.timestamp) {
            window.messageRegistry[message.timestamp] = message;
        }

        const container = document.getElementById('messages-container');
        if (!container) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `message-container ${type}`;

        const time = new Date(message.timestamp);
        const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        let avatarSrc = 'anony.jpg';
        if (type === 'sent' && this.currentUser) {
            avatarSrc = this.currentUser.profilePicture || 'anony.jpg';
        } else if (type === 'received' && this.currentPeer) {
            avatarSrc = this.currentPeer.profilePicture || 'anony.jpg';
        }

        const imgId = `img-${message.timestamp}`;

        messageDiv.innerHTML = `
            <div class="message-avatar">
                <img src="${avatarSrc}" alt="Avatar">
            </div>
            <div class="message-content">
                <div class="message-bubble image-message">
                    ${message.replyContext ? `
                    <div class="reply-context" style="margin-bottom: 6px;">
                        ${message.replyContext.replyToImage ? `<div class="reply-context-thumb"><img src="${message.replyContext.replyToImage}"></div>` : ''}
                        <div class="reply-context-content">
                            <div class="reply-context-name">${this.escapeHtml(message.replyContext.replyToName)}</div>
                            <div class="reply-context-text">
                                ${message.replyContext.replyToType === 'image' ? '<i class="material-icons reply-context-media-icon">photo</i>' : ''}
                                ${this.escapeHtml(message.replyContext.replyToText)}
                            </div>
                        </div>
                    </div>` : ''}
                    
                    <!-- Message Options inside bubble -->
                    <div class="message-options-container" style="position: absolute; top: 8px; right: 8px; z-index: 10;">
                        <i class="material-icons message-options-btn" onclick="toggleMessageOptions(this)" 
                           style="font-size: 18px; color: rgba(255,255,255,0.8); cursor: pointer; opacity: 0; transition: opacity 0.2s; 
                                  background: rgba(0,0,0,0.4); border-radius: 50%; padding: 4px;">
                           keyboard_arrow_down
                        </i>
                        <div class="message-options-dropdown" style="display: none; position: absolute; top: 30px; right: 0; background: #233138; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); z-index: 100; min-width: 150px; overflow: hidden; padding: 4px 0;">
                            <div class="msg-opt-item" onclick="window.handleMessageAction('${message.timestamp}', 'reply')" 
                                 style="padding: 10px 16px; color: #d1d7db; cursor: pointer; display: flex; align-items: center; font-size: 14px;">
                                <i class="material-icons" style="font-size: 20px; margin-right: 12px; color: #8696a0;">reply</i> Reply
                            </div>
                            <div class="msg-opt-item" onclick="window.handleMessageAction('${message.timestamp}', 'forward')" 
                                 style="padding: 10px 16px; color: #d1d7db; cursor: pointer; display: flex; align-items: center; font-size: 14px;">
                                <i class="material-icons" style="font-size: 20px; margin-right: 12px; color: #8696a0;">forward</i> Forward
                            </div>
                            <div class="msg-opt-item" onclick="window.handleMessageAction('${message.timestamp}', 'delete')"
                                 style="padding: 10px 16px; color: #ef4444; cursor: pointer; display: flex; align-items: center; font-size: 14px;">
                                <i class="material-icons" style="font-size: 20px; margin-right: 12px; color: #ef4444;">delete</i> Delete
                            </div>
                        </div>
                    </div>
                    
                    <div class="image-loading-container is-loading">
                        <img src="${message.image}" id="${imgId}" alt="Shared image" class="chat-media loading" 
                             style="max-width: 100% !important; height: auto !important; border-radius: 8px; display: block;" 
                             onclick="openImagePreview('${message.image}')"
                             onload="this.classList.remove('loading'); this.parentElement.classList.remove('is-loading');">
                        
                        <div class="image-loader-overlay">
                             <svg class="circular-loader" viewBox="25 25 50 50">
                                 <circle class="loader-path" cx="50" cy="50" r="20" fill="none" stroke-width="4" stroke-miterlimit="10"/>
                             </svg>
                             <i class="material-icons" style="color: white; font-size: 16px; position: absolute;">close</i>
                        </div>
                    </div>

                    ${message.text ? `<div class="image-caption-text">${this.escapeHtml(message.text)}</div>` : ''}
                    <div class="message-time">${timeStr}</div>
                </div>
            </div>
        `;

        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;
    }

    addToContacts(user) {
        this.contacts.set(user.uid, user);
        this.updateContactsList();
        this.saveContacts();

        // Set up profile listener for this new contact
        this.setupProfileListenerForContact(user.uid);
        if (this.setupUnreadListener) this.setupUnreadListener(user.uid);
    }

    // Set up listener for a single contact
    setupProfileListenerForContact(uid) {
        if (!window.messageRouter?.database) return;

        const profileRef = window.messageRouter.database.ref(`users/${uid}`);

        profileRef.on('value', (snapshot) => {
            const updatedProfile = snapshot.val();

            if (updatedProfile) {
                const currentContact = this.contacts.get(uid);
                const updatedContact = {
                    uid: uid,
                    name: updatedProfile.name || currentContact?.name,
                    username: updatedProfile.username || currentContact?.username,
                    profilePicture: updatedProfile.profilePicture || currentContact?.profilePicture
                };

                this.contacts.set(uid, updatedContact);
                this.saveContacts();
                this.updateContactsList();

                if (this.currentPeer && this.currentPeer.uid === uid) {
                    this.currentPeer = updatedContact;
                    this.updateCurrentPeerUI(updatedContact);
                }

                console.log(`✅ Auto-updated profile for: ${updatedContact.name}`);
            }
        });
    }

    updateContactsList() {
        const contactsList = document.getElementById('contacts-list');
        if (!contactsList) return;

        contactsList.innerHTML = '';

        this.contacts.forEach((contact, uid) => {
            const contactDiv = document.createElement('div');
            contactDiv.className = 'contact-item';
            if (this.currentPeer && this.currentPeer.uid === uid) {
                contactDiv.classList.add('active');
            }

            // Unread Count
            const unread = this.unreadCounts ? (this.unreadCounts.get(uid) || 0) : 0;
            const badgeHTML = unread > 0 ? `<div class="unread-badge">${unread}</div>` : '';

            contactDiv.innerHTML = `
                <div class="contact-avatar">
                    <img src="${contact.profilePicture || 'anony.jpg'}" alt="${contact.name}">
                </div>
                <div class="contact-info">
                    <div class="contact-name">${contact.name || contact.username}</div>
                    <div class="contact-status">Click to chat</div>
                </div>
                ${badgeHTML}
                <div class="contact-menu-btn" onclick="event.stopPropagation(); window.fireflyChat.showContextMenu(event, '${uid}')">
                    <i class="material-icons" style="font-size: 16px;">more_vert</i>
                </div>
            `;

            contactDiv.addEventListener('click', () => {
                this.openChatWithPeer(contact);
            });

            contactsList.appendChild(contactDiv);
        });
    }

    setupUnreadListener(uid) {
        if (!window.messageRouter?.database) return;
        if (uid === this.currentUser.uid) return;

        if (!this.unreadCounts) this.unreadCounts = new Map();
        if (!this.unreadListeners) this.unreadListeners = new Set();
        // Buffer 60s
        if (!this.appLoadTime) this.appLoadTime = Date.now() - 60000;

        if (this.unreadListeners.has(uid)) return;

        this.unreadListeners.add(uid);

        const handleUnread = (snapshot) => {
            const msg = snapshot.val();
            if (!msg) return;

            const contact = this.contacts.get(uid);
            const threshold = contact?.lastRead || this.appLoadTime;

            if (msg.timestamp > threshold &&
                (!this.currentPeer || this.currentPeer.uid !== uid)) {

                const current = this.unreadCounts.get(uid) || 0;
                this.unreadCounts.set(uid, current + 1);
                this.updateContactsList();
            }
        };

        window.messageRouter.database.ref(`messages/${this.currentUser.uid}/${uid}`).limitToLast(1).on('child_added', handleUnread);
        window.messageRouter.database.ref(`temp_messages/${this.currentUser.uid}/${uid}`).limitToLast(1).on('child_added', handleUnread);
    }

    // Context Menu Handling
    showContextMenu(event, uid) {
        event.preventDefault();
        this.contextMenuTargetUid = uid;

        const menu = document.getElementById('contact-context-menu');
        if (menu) {
            menu.style.display = 'block';
            menu.style.top = `${event.clientY}px`;
            menu.style.left = `${event.clientX - 160}px`; // Show to the left of the cursor/button

            // Close menu when clicking elsewhere
            const closeMenu = () => {
                menu.style.display = 'none';
                document.removeEventListener('click', closeMenu);
            };

            setTimeout(() => {
                document.addEventListener('click', closeMenu);
            }, 10);
        }
    }

    async handleContextMenuAction(action) {
        const uid = this.contextMenuTargetUid;
        if (!uid) return;

        switch (action) {
            case 'profile':
                // Show user profile (you might want to implement a read-only profile modal)
                console.log('View profile for:', uid);
                // For now just open chat which shows info
                const contact = this.contacts.get(uid);
                if (contact) this.openChatWithPeer(contact);
                break;

            case 'disconnect':
                if (confirm('Disconnect from this user?')) {
                    await this.disconnectUser(uid);
                }
                break;

            case 'delete':
                if (confirm('Remove this chat from your list?')) {
                    await this.disconnectUser(uid);
                }
                break;

            case 'block':
                window.openConfirmBlockModal(uid);
                break;
        }
    }

    saveContacts() {
        const contactsData = Array.from(this.contacts.entries());
        localStorage.setItem('chatContacts', JSON.stringify(contactsData));
    }

    loadContacts() {
        const saved = localStorage.getItem('chatContacts');
        if (saved) {
            try {
                const rawContacts = JSON.parse(saved);
                this.contacts = new Map();
                const processedUsernames = new Set();

                // Advanced Deduplication & Cleanup
                // 1. First Pass: Add valid entries with proper keys
                rawContacts.forEach(([key, user]) => {
                    if (key && key !== 'undefined' && user && user.username) {
                        this.contacts.set(key, user);
                        processedUsernames.add(user.username);
                    }
                });

                // 2. Second Pass: Check for any orphaned entries that we might want to keep
                // (Only if we don't already have that username)
                rawContacts.forEach(([key, user]) => {
                    if (!user || !user.username) return;

                    if ((!key || key === 'undefined') && !processedUsernames.has(user.username)) {
                        // Attempt to recover using user.uid if available
                        const newKey = user.uid || key;
                        if (newKey && newKey !== 'undefined') {
                            this.contacts.set(newKey, user);
                            processedUsernames.add(user.username);
                        }
                    }
                });

                // Save cleaned connection list
                if (this.contacts.size !== rawContacts.length) {
                    this.saveContacts();
                    console.log('🧹 cleanup: Removed duplicate/invalid contacts');
                }

                this.updateContactsList();
                this.setupProfileListeners();

                // Init Unread
                if (!this.unreadCounts) this.unreadCounts = new Map();
                this.contacts.forEach((c, k) => this.setupUnreadListener(k));
            } catch (error) {
                console.error('Error loading contacts:', error);
            }
        }
    }

    // Listen for profile updates of contacts
    setupProfileListeners() {
        if (!window.messageRouter?.database) return;

        this.contacts.forEach((contact, uid) => {
            this.setupProfileListenerForContact(uid);
        });

        console.log(`👀 Watching ${this.contacts.size} contacts for profile changes`);
    }

    // Update current peer's UI elements
    updateCurrentPeerUI(peer) {
        // Update info panel
        const peerAvatar = document.getElementById('peer-avatar');
        const peerName = document.getElementById('peer-name');
        const peerUsername = document.getElementById('peer-username');

        if (peerAvatar) peerAvatar.src = peer.profilePicture || 'anony.jpg';
        if (peerName) peerName.textContent = peer.name || peer.username;
        if (peerUsername) peerUsername.textContent = '@' + (peer.username || peer.name);

        // Update header
        const status = document.getElementById('connection-status');
        if (status) {
            status.innerHTML = `
                <span class="status-dot"></span>
                <span>Chatting with ${peer.name || peer.username}</span>
            `;
        }

        console.log(`🔄 Updated UI for current peer: ${peer.name}`);
    }

    clearMessagesArea() {
        const container = document.getElementById('messages-container');
        if (container) {
            container.innerHTML = '';
        }
    }

    showWelcomeScreen() {
        const container = document.getElementById('messages-container');
        if (container) {
            container.innerHTML = `
            <div id="welcome-screen" style="height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #e9edef; text-align: center; padding: 0 40px;">
                <i class="material-icons-outlined" style="font-size: 100px; color: #41525d; margin-bottom: 40px;">chat_bubble_outline</i>
                <h1 style="font-weight: 300; font-size: 32px; margin-bottom: 20px;">FireFly Chat for Windows</h1>
                <p style="color: #8696a0; font-size: 14px; line-height: 20px; max-width: 460px;">Send and receive messages without keeping your phone online.<br>Use FireFly Chat on up to 4 linked devices and 1 phone at the same time.</p>
                <div style="margin-top: auto; padding-bottom: 40px; color: #667781; font-size: 13px; display: flex; align-items: center; gap: 6px;">
                    <i class="material-icons" style="font-size: 12px;">lock</i>
                    <span>Your personal messages are end-to-end encrypted</span>
                </div>
            </div>`;
        }
        const inputArea = document.getElementById('chat-input-area');
        if (inputArea) inputArea.style.display = 'none';

        const mainHeader = document.getElementById('chat-main-header');
        if (mainHeader) mainHeader.style.display = 'none';
    }

    openProfileModal(fromSettings = false) {
        // Close other modals first
        document.getElementById('settings-modal').classList.remove('active');
        document.getElementById('users-modal').classList.remove('active');
        document.getElementById('blocked-users-modal').classList.remove('active');

        const modal = document.getElementById('profile-modal');
        if (modal) modal.classList.add('active');

        // Update Nav Icon
        document.querySelectorAll('.sidebar-icon').forEach(i => i.classList.remove('active'));
        if (fromSettings) {
            const nav = document.getElementById('nav-settings');
            if (nav) nav.classList.add('active');
        } else {
            const nav = document.getElementById('profile-icon');
            if (nav) nav.classList.add('active');
        }

        // Populate Data
        if (this.currentUser) {
            const nameInput = document.getElementById('profile-name-edit');
            const aboutInput = document.getElementById('profile-about-edit');
            const avatar = document.getElementById('profile-large-avatar');
            const usernameDisplay = document.getElementById('profile-username-display');
            const emailDisplay = document.getElementById('profile-email-display');

            if (nameInput) nameInput.value = this.currentUser.name || '';
            if (aboutInput) aboutInput.value = this.currentUser.about || 'Hey there! I am using FireFly.';
            if (avatar && this.currentUser.profilePicture) {
                avatar.src = this.currentUser.profilePicture;
            }
            if (usernameDisplay) usernameDisplay.textContent = this.currentUser.username || '@' + (this.currentUser.email?.split('@')[0] || 'user');
            if (emailDisplay) emailDisplay.textContent = this.currentUser.email || '';
        }
    }

    updateProfileIcon(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.getElementById('profile-large-avatar');
                if (img) img.src = e.target.result;

                // Auto-save logic
                if (window.profileManager) {
                    window.profileManager.saveProfile(
                        document.getElementById('profile-name-edit').value,
                        input.files[0]
                    ).then(() => this.showNotification('Profile photo updated', 'success'));
                }
            };
            reader.readAsDataURL(input.files[0]);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        if (!notification) return;

        const colors = {
            success: 'linear-gradient(135deg, #00ff88, #00d9ff)',
            error: 'linear-gradient(135deg, #ff006e, #ff6b35)',
            info: 'linear-gradient(135deg, #667eea, #764ba2)'
        };

        notification.textContent = message;
        notification.style.background = colors[type] || colors.info;
        notification.style.transform = 'translateX(0)';

        setTimeout(() => {
            notification.style.transform = 'translateX(400px)';
        }, 3000);

        console.log(`${type.toUpperCase()}: ${message}`);
    }

    showLoading(show) {
        // Implementation if needed
    }

    // Block User
    async blockUser(uid) {
        if (!uid || !window.messageRouter?.database) return;

        try {
            // 1. Add to blocked list in Firebase
            await window.messageRouter.database.ref(`users/${this.currentUser.uid}/blocked/${uid}`).set(true);

            // 2. Delete all chat history
            await window.messageRouter.database.ref(`messages/${this.currentUser.uid}/${uid}`).remove();
            await window.messageRouter.database.ref(`messages/${uid}/${this.currentUser.uid}`).remove();
            // Also delete temp messages
            await window.messageRouter.database.ref(`temp_messages/${this.currentUser.uid}/${uid}`).remove();
            await window.messageRouter.database.ref(`temp_messages/${uid}/${this.currentUser.uid}`).remove();

            // 3. Remove from contacts (Disconnection)
            this.contacts.delete(uid);
            this.saveContacts();
            this.updateContactsList();

            // 4. Detach listeners
            if (window.messageRouter) {
                window.messageRouter.detachListener(`messages_${uid}`);
                window.messageRouter.detachListener(`temp_messages_${uid}`);
            }

            // 5. Update UI if currently chatting
            if (this.currentPeer && this.currentPeer.uid === uid) {
                this.currentPeer = null;
                this.isConnected = false;
                this.showWelcomeScreen();
                const status = document.getElementById('connection-status');
                if (status) status.innerHTML = '<span class="status-dot"></span><span>Select a contact to chat</span>';
            }

            this.showNotification('User blocked successfully', 'success');

        } catch (error) {
            console.error('Error blocking user:', error);
            this.showNotification('Failed to block user', 'error');
        }
    }

    // Unblock User
    async unblockUser(uid) {
        if (!uid || !window.messageRouter?.database) return;

        try {
            await window.messageRouter.database.ref(`users/${this.currentUser.uid}/blocked/${uid}`).remove();
            this.showNotification('User unblocked', 'success');
            this.loadBlockedUsers(); // Refresh list
        } catch (error) {
            console.error('Error unblocking user:', error);
            this.showNotification('Failed to unblock user', 'error');
        }
    }

    // Load Blocked Users
    async loadBlockedUsers() {
        if (!window.messageRouter?.database) return;

        const list = document.getElementById('blocked-users-list');
        list.innerHTML = '<div class="loading-spinner" style="width: 30px; height: 30px; margin: 20px auto;"></div>';

        try {
            const snapshot = await window.messageRouter.database.ref(`users/${this.currentUser.uid}/blocked`).once('value');
            const blockedIds = snapshot.val();

            list.innerHTML = '';

            if (!blockedIds) {
                list.innerHTML = '<p style="text-align: center; opacity: 0.6; padding: 20px;">No blocked users</p>';
                return;
            }

            // Fetch details for each blocked user
            for (const uid of Object.keys(blockedIds)) {
                const userSnapshot = await window.messageRouter.database.ref(`users/${uid}`).once('value');
                const user = userSnapshot.val();

                if (user) {
                    const div = document.createElement('div');
                    div.className = 'blocked-user-item';
                    div.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <img src="${user.profilePicture || 'anony.jpg'}" style="width: 40px; height: 40px; border-radius: 8px; object-fit: cover;">
                            <div>
                                <div style="font-weight: 600;">${user.name || 'User'}</div>
                                <div style="font-size: 11px; opacity: 0.6;">Blocked</div>
                            </div>
                        </div>
                        <button class="unblock-btn" onclick="window.fireflyChat.unblockUser('${uid}')">Unblock</button>
                    `;
                    list.appendChild(div);
                }
            }
        } catch (error) {
            console.error('Error loading blocked users:', error);
            list.innerHTML = '<p style="text-align: center; opacity: 0.6;">Error loading list</p>';
        }
    }

    // Disconnect User
    async disconnectUser(uid) {
        if (!this.contacts.has(uid)) return;

        // Notify user
        // We can send a system-like message or just rely on them disappearing from our list
        // User asked to "notify another user"
        try {
            await window.messageRouter.sendMessage(uid, {
                text: 'User disconnected.',
                type: 'system', // Special type
                timestamp: Date.now()
            });
        } catch (e) { console.error('Error sending disconnect notification', e); }

        this.contacts.delete(uid);
        this.saveContacts();
        this.updateContactsList();

        if (this.currentPeer && this.currentPeer.uid === uid) {
            this.currentPeer = null;
            this.showWelcomeScreen();
            document.getElementById('connection-status').innerHTML = '<span>Disconnected</span>';
        }

        this.showNotification('Disconnected from user', 'info');
    }

    // Unfriend User (Same as disconnect but implies permanent removal from "friends" list if we had one)
    async unfriendUser(uid) {
        // For now, treats same as disconnect but without notification if preferred, or implies mutual removal.
        // Implementing as local removal + notification.
        await this.disconnectUser(uid);
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = show ? 'flex' : 'none';
        }
    }

    showNotification(message, type = 'info') {
        const toast = document.getElementById('notification');
        if (!toast) return;

        let icon = 'info';
        if (type === 'success') icon = 'check_circle';
        if (type === 'error') icon = 'error_outline';

        toast.innerHTML = `<i class="material-icons">${icon}</i><span>${message}</span>`;
        toast.className = 'notification-toast show ' + type;

        if (this.notificationTimeout) clearTimeout(this.notificationTimeout);
        this.notificationTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// Global functions for HTML onclick handlers
function connectToUser() {
    if (window.fireflyChat) {
        window.fireflyChat.connectToUser();
    }
}

function sendMessage() {
    if (window.fireflyChat) {
        window.fireflyChat.sendMessage();
    }
}

function attachFile() {
    document.getElementById('file-input')?.click();
}

function closeProfileModal() {
    document.getElementById('profile-modal').classList.remove('active');
}

async function saveProfile() {
    if (!window.fireflyChat || !window.profileManager) return;

    const nameInput = document.getElementById('profile-name-edit');
    const aboutInput = document.getElementById('profile-about-edit');
    const picInput = document.getElementById('profile-file-input');

    const name = nameInput?.value.trim();
    const about = aboutInput?.value.trim();
    const file = picInput?.files?.[0];

    try {
        const userId = window.fireflyChat.currentUser.uid;

        // Save to Firebase
        if (window.messageRouter && window.messageRouter.database && userId) {
            const updates = {};

            if (name) {
                updates.name = name;
                window.fireflyChat.currentUser.name = name;
                localStorage.setItem('userName', name);
            }

            if (about) {
                updates.about = about;
                window.fireflyChat.currentUser.about = about;
            }

            if (Object.keys(updates).length > 0) {
                updates.lastUpdated = Date.now();
                await window.messageRouter.database.ref(`users/${userId}`).update(updates);
                console.log('✅ Profile saved to Firebase:', updates);

                // Update session storage
                sessionStorage.setItem('currentUser', JSON.stringify(window.fireflyChat.currentUser));

                if (window.fireflyChat.showNotification) {
                    window.fireflyChat.showNotification('Profile updated!', 'success');
                }
            }
        }

        if (file) {
            const result = await window.profileManager.uploadProfilePicture(file);
            if (result.success) {
                window.fireflyChat.currentUser.profilePicture = result.base64;
                localStorage.setItem('userProfilePic', result.base64);

                const profileIcon = document.querySelector('#profile-icon img');
                if (profileIcon) profileIcon.src = result.base64;
                const largeAvatar = document.getElementById('profile-large-avatar');
                if (largeAvatar) largeAvatar.src = result.base64;
            }
        }

        // Save to Firebase
        if (window.profileManager && name) {
            await window.profileManager.saveProfile(name, file);
        }

        // Optional: Feedback (can be removed for true silent auto-save)
        // window.fireflyChat.showNotification('Profile saved', 'success');
    } catch (error) {
        console.error('❌ Error saving profile:', error);
        if (window.fireflyChat?.showNotification) {
            window.fireflyChat.showNotification('Failed to save profile', 'error');
        }
    }
}

function logout() {
    // Cleanup listeners before logout
    if (window.messageRouter) {
        window.messageRouter.cleanup();
    }

    localStorage.setItem('isLoggedOut', 'true');
    sessionStorage.clear();
    window.location.href = 'noxlogin.html';
}

function toggleInfoPanel() {
    const panel = document.getElementById('info-panel');
    if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
}

async function clearChat() {
    if (!window.fireflyChat?.currentPeer) {
        window.fireflyChat?.showNotification('No active chat to clear', 'error');
        return;
    }

    if (confirm('Clear all messages? This will delete the chat history from both sides.')) {
        try {
            const currentUserId = window.fireflyChat.currentUser.uid;
            const peerId = window.fireflyChat.currentPeer.uid;

            if (window.messageRouter?.database) {
                // Delete messages in both directions
                await window.messageRouter.database.ref(`messages/${currentUserId}/${peerId}`).remove();
                await window.messageRouter.database.ref(`messages/${peerId}/${currentUserId}`).remove();

                // Clear UI
                window.fireflyChat.clearMessagesArea();
                window.fireflyChat.showNotification('Chat history deleted', 'success');
            }
        } catch (error) {
            console.error('Error clearing chat:', error);
            window.fireflyChat?.showNotification('Failed to clear chat', 'error');
        }
    }
}

async function endChat() {
    if (!window.fireflyChat?.currentPeer) {
        window.fireflyChat?.showNotification('No active chat to end', 'error');
        return;
    }

    if (confirm('End this chat? This will delete all messages permanently.')) {
        try {
            const currentUserId = window.fireflyChat.currentUser.uid;
            const peerId = window.fireflyChat.currentPeer.uid;

            // Delete messages from Firebase
            if (window.messageRouter?.database) {
                await window.messageRouter.database.ref(`messages/${currentUserId}/${peerId}`).remove();
                await window.messageRouter.database.ref(`messages/${peerId}/${currentUserId}`).remove();
            }

            // Detach listener for this peer
            if (window.messageRouter) {
                window.messageRouter.detachListener(`messages_${peerId}`);
            }

            // Reset UI
            window.fireflyChat.currentPeer = null;
            window.fireflyChat.isConnected = false;
            // Reset UI
            window.fireflyChat.currentPeer = null;
            window.fireflyChat.isConnected = false;
            window.fireflyChat.showWelcomeScreen();

            const status = document.getElementById('connection-status');
            if (status) {
                status.innerHTML = '<span class="status-dot"></span><span>Select a contact to chat</span>';
            }

            window.fireflyChat.showNotification('Chat ended and deleted', 'success');
        } catch (error) {
            console.error('Error ending chat:', error);
            window.fireflyChat?.showNotification('Failed to end chat', 'error');
        }
    }
}

function openImagePreview(src) {
    const modal = document.createElement('div');
    modal.className = 'image-preview-modal';
    modal.innerHTML = `<img src="${src}" alt="Image">`;
    modal.onclick = () => modal.remove();
    document.body.appendChild(modal);
}

function searchMessages() {
    window.fireflyChat?.showNotification('Search feature coming soon!', 'info');
}

function selectEmoji() {
    if (typeof window.openEmojiPicker === 'function') {
        window.openEmojiPicker();
    } else {
        window.fireflyChat?.showNotification('Emoji picker not loaded yet', 'error');
    }
}

// Global wrapper for Profile Modal
function openProfileModal(fromSettings = false) {
    // Close other panels
    document.getElementById('calls-modal')?.classList.remove('active');

    if (window.fireflyChat) {
        window.fireflyChat.openProfileModal(fromSettings);
    } else {
        console.error('FireflyChat not initialized');
    }
}


// Initialize chat when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.fireflyChat = new FireflyChat();
    });
} else {
    // Already loaded
    window.fireflyChat = new FireflyChat();
}

// Define toggleMessageOptions globally
window.toggleMessageOptions = function (btn) {
    const menu = btn.nextElementSibling;
    if (menu) {
        // Toggle
        const isVisible = menu.style.display === 'block';

        // Hide all others first
        document.querySelectorAll('.message-options-dropdown').forEach(d => {
            d.style.display = 'none';
            // Remove active class from containers
            const container = d.closest('.message-container');
            if (container) container.classList.remove('has-active-menu');
        });

        if (!isVisible) {
            menu.style.display = 'block';

            // Add active class to current container
            const currentContainer = btn.closest('.message-container');
            if (currentContainer) currentContainer.classList.add('has-active-menu');

            // Dynamic positioning: Check if menu overflows viewport
            const menuRect = menu.getBoundingClientRect();
            const viewportHeight = window.innerHeight;

            // If menu bottom is below viewport, flip it to open upward
            if (menuRect.bottom > viewportHeight - 20) {
                menu.style.top = 'auto';
                menu.style.bottom = '100%';
                menu.style.marginBottom = '4px';
            } else {
                menu.style.top = '20px';
                menu.style.bottom = 'auto';
                menu.style.marginBottom = '0';
            }

            // Auto close on click elsewhere
            const close = (e) => {
                if (!menu.contains(e.target) && e.target !== btn) {
                    menu.style.display = 'none';
                    if (currentContainer) currentContainer.classList.remove('has-active-menu');
                    document.removeEventListener('click', close);
                }
            };
            setTimeout(() => document.addEventListener('click', close), 0);
        }
    }

    // Stop propagation to prevent document click handler from closing it immediately
    if (event) event.stopPropagation();
};

// Global Bindings for HTML onclicks
window.sendMessage = () => window.fireflyChat?.sendMessage();
window.attachFile = () => document.getElementById('file-input')?.click();
window.filterContacts = (filter) => {
    // Implement or wrap existing filter logic
    const chips = document.querySelectorAll('.chip');
    chips.forEach(c => c.classList.remove('active'));
    // Find chip with matching onclick or text?
    // Usually the HTML has it as onclick="filterContacts('all')"
    // So we just need to ensure the logic exists
    const contacts = document.querySelectorAll('.contact-item');
    contacts.forEach(contact => {
        if (filter === 'all') contact.style.display = 'flex';
        else if (filter === 'unread') {
            const hasUnread = contact.querySelector('.unread-badge');
            contact.style.display = hasUnread ? 'flex' : 'none';
        }
        // ... handled in chat.html mostly, but good to have here
    });
};

function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.add('active');

    document.querySelectorAll('.sidebar-icon').forEach(i => i.classList.remove('active'));
    const nav = document.querySelector('.sidebar-icon:nth-child(3)'); // Approximate selector if ID missing
    // or keep original logic if ID exists
}


// --- Forward Message Logic ---
window.messageToForward = null;

window.openForwardModal = function (message) {
    window.messageToForward = message;
    const modal = document.getElementById('forward-message-modal');
    const list = document.getElementById('forward-users-list');

    // Clear previous search
    document.getElementById('forward-search-input').value = '';

    if (modal) {
        modal.style.display = 'flex';

        // Populate with recent chats/contacts
        // In a real app we might dedup or filter, but for now we iterate peers
        if (list && window.fireflyChat) {
            list.innerHTML = '';

            // Re-use logic from loadContacts but simplistic for now
            // We'll iterate contacts array from fireflyChat if available or messageRouter logic
            // Assuming window.fireflyChat.contacts is available or re-fetch

            // For now, let's grab from the DOM side-panel or cached list
            // Better: use window.contacts cache if it existed, or iterate peers from history

            // Simple approach: Use existing 'contacts' array from main class
            const contacts = window.fireflyChat.contacts || [];
            // Also include active chats if not in contacts?
            // Let's just use contacts array for MVP as it holds "people we know"

            contacts.forEach(user => {
                if (user.uid === window.fireflyChat.currentUser.uid) return; // Don't forward to self (optional)

                const div = document.createElement('div');
                div.className = 'contact-item';
                div.style.padding = '10px 15px';
                div.style.display = 'flex';
                div.style.alignItems = 'center';
                div.style.cursor = 'pointer';
                div.style.borderBottom = '1px solid rgba(255,255,255,0.05)';

                div.innerHTML = `
                    <img src="${user.profilePicture || 'anony.jpg'}" style="width: 40px; height: 40px; border-radius: 50%; margin-right: 12px;">
                    <div style="flex:1;">
                        <div style="color: var(--text-primary); font-weight: 500;">${user.name || user.username}</div>
                        <div style="color: var(--text-secondary); font-size: 12px;">${user.about || 'Available'}</div>
                    </div>
                    <i class="material-icons" style="color: var(--accent);">send</i>
                `;

                div.onclick = () => window.forwardMessageTo(user.uid, user.name);
                list.appendChild(div);
            });
        }
    }
};

window.closeForwardModal = function () {
    const modal = document.getElementById('forward-message-modal');
    if (modal) modal.style.display = 'none';
    window.messageToForward = null;
};

window.forwardMessageTo = async function (userId, userName) {
    if (!window.messageToForward || !window.messageRouter || !window.fireflyChat) return;

    const originalMsg = window.messageToForward;

    // Construct new message based on original
    const newMessage = {
        text: originalMsg.text || originalMsg.message || '',
        type: originalMsg.type || 'text',
        timestamp: Date.now(),
        sender: window.fireflyChat.currentUser.uid,
        senderName: window.fireflyChat.currentUser.name || 'User',
        linkMeta: originalMsg.linkMeta || null,
        // Ensure image property is set for image messages
        image: originalMsg.image || originalMsg.content || null,
        content: originalMsg.content || originalMsg.image || null,
        fileName: originalMsg.fileName || null,
        fileSize: originalMsg.fileSize || null,
        forwarded: true // Mark as forwarded
    };

    // If text message has linkMeta but text is empty/different, ensure text is carried
    if (originalMsg.linkMeta && !newMessage.text) {
        newMessage.text = originalMsg.linkMeta.url;
    }

    // Send
    try {
        await window.messageRouter.sendMessage(userId, newMessage);
        window.fireflyChat.showNotification(`Forwarded to ${userName}`, 'success');
        window.closeForwardModal();

        // If we are currently chatting with this user, it will auto-appear.
        // If we are elsewhere, we stay elsewhere.

    } catch (e) {
        console.error('Forward failed', e);
        window.fireflyChat.showNotification('Failed to forward message', 'error');
    }
};

// --- Delete Message Logic ---
window.messageToDelete = null;

window.openDeleteModal = function (message) {
    window.messageToDelete = message;
    const modal = document.getElementById('delete-message-modal');

    // Check ownership
    const isMyMessage = (message.sender === window.fireflyChat.currentUser.uid);
    // Find the button by ID
    const deleteEveryoneBtn = document.getElementById('btn-delete-everyone');

    if (deleteEveryoneBtn) {
        // "Delete for everyone" only allowed if I sent it
        deleteEveryoneBtn.style.display = isMyMessage ? 'block' : 'none';
    }

    if (modal) modal.style.display = 'flex';
};

window.closeDeleteModal = function () {
    const modal = document.getElementById('delete-message-modal');
    if (modal) modal.style.display = 'none';
    window.messageToDelete = null;
};

window.confirmDelete = async function (forEveryone) {
    if (!window.messageToDelete || !window.fireflyChat.currentPeer) {
        console.error('❌ Cannot delete: message or peer missing');
        return;
    }

    const message = window.messageToDelete;
    const peerId = window.fireflyChat.currentPeer.uid;
    const messageId = message.id;
    const messageTimestamp = message.timestamp;

    console.log(`🗑️ Confirming delete - ID: ${messageId}, Timestamp: ${messageTimestamp}, forEveryone: ${forEveryone}`);

    if (!messageId && !messageTimestamp) {
        window.fireflyChat.showNotification('Cannot delete: Message ID missing', 'error');
        window.closeDeleteModal();
        return;
    }

    // Call Router
    if (window.messageRouter) {
        const result = await window.messageRouter.deleteMessage(peerId, messageId || messageTimestamp, forEveryone);

        if (result.success) {
            window.fireflyChat.showNotification('Message deleted', 'success');

            // Clear and reload chat history for this peer
            window.fireflyChat.clearMessagesArea();
            await window.fireflyChat.loadMessageHistory(peerId);
        } else {
            window.fireflyChat.showNotification('Failed to delete message', 'error');
        }
    } else {
        console.error('❌ messageRouter not available');
    }

    window.closeDeleteModal();
};

function closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.remove('active');
}

function openBlockedModal() {
    const modal = document.getElementById('blocked-users-modal');
    if (modal) {
        modal.classList.add('active');
        if (window.fireflyChat) window.fireflyChat.loadBlockedUsers();
    }
}

function closeBlockedModal() {
    const modal = document.getElementById('blocked-users-modal');
    if (modal) modal.classList.remove('active');
}

function openChatsView() {
    document.querySelectorAll('.sidebar-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.sidebar-icon').forEach(i => i.classList.remove('active'));
    const nav = document.getElementById('nav-chat');
    if (nav) nav.classList.add('active');
}

// URL Preview Helpers
window.closeUrlPreview = function () {
    const previewPanel = document.getElementById('url-preview-panel');
    if (previewPanel) {
        previewPanel.style.display = 'none';
    }
};


window.clearUrlPreview = window.closeUrlPreview;



console.log('✅ Modern Chat Script Loaded');

// Toggle Info Panel Window Function
window.toggleInfoPanel = function () {
    const panel = document.getElementById('info-panel');
    const app = document.querySelector('.chat-app');

    // Toggle active class instead of just display for better CSS control
    if (panel.style.display === 'none' || !panel.style.display || panel.style.display === '') {
        panel.style.display = 'flex';
        app.classList.add('info-panel-open');
        // Refresh info if chat actsve
        if (window.fireflyChat && window.fireflyChat.currentPeer) {
            window.fireflyChat.openChatWithPeer(window.fireflyChat.currentPeer);
        }
    } else {
        panel.style.display = 'none';
        app.classList.remove('info-panel-open');
    }
};

// --- Media Gallery Logic ---

window.galleryData = []; // Cache

window.openMediaGallery = async function () {
    const view = document.getElementById('media-gallery-view');
    const panel = document.getElementById('info-panel');
    if (!view || !panel) return;

    if (!window.fireflyChat || !window.fireflyChat.currentPeer) return;

    const peer = window.fireflyChat.currentPeer;
    document.getElementById('gallery-peer-name').textContent = peer.name || peer.username;

    view.style.display = 'flex';

    // Fetch deep history for gallery
    if (window.messageRouter) {
        // Fetch last 500 messages for gallery
        window.galleryData = await window.messageRouter.getMessageHistory(peer.uid, 500);
    }

    switchGalleryTab('media');
};

window.closeMediaGallery = function () {
    const view = document.getElementById('media-gallery-view');
    if (view) view.style.display = 'none';
};

window.switchGalleryTab = function (tabName) {
    // UI Updates
    document.querySelectorAll('.gallery-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.gallery-tab').forEach(t => {
        if (t.textContent.toLowerCase() === tabName) t.classList.add('active');
    });

    document.querySelectorAll('.gallery-section').forEach(s => s.style.display = 'none');
    document.getElementById(`gallery-${tabName}`).style.display = 'block';

    renderGalleryContent(tabName);
};

function renderGalleryContent(tab) {
    const container = document.getElementById(`gallery-${tab}`);
    container.innerHTML = '';
    const messages = window.galleryData || [];

    if (tab === 'media') {
        const images = messages.filter(m => m.type === 'image' || m.type === 'gif');
        if (images.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px; color:#8696a0;">No media found</div>';
            return;
        }

        const groups = groupMessagesByMonth(images);

        for (const [month, msgs] of Object.entries(groups)) {
            const header = document.createElement('div');
            header.className = 'gallery-section-header';
            header.textContent = month.toUpperCase();
            container.appendChild(header);

            const grid = document.createElement('div');
            grid.className = 'gallery-grid';

            msgs.forEach(msg => {
                const item = document.createElement('div');
                item.className = 'gallery-item';
                const mediaSrc = msg.image || msg.content;
                item.innerHTML = `<img src="${mediaSrc}" loading="lazy">`;
                item.onclick = () => {
                    // Use image preview modal
                    if (typeof openImagePreview === 'function') {
                        openImagePreview(mediaSrc);
                    } else {
                        window.open(mediaSrc, '_blank');
                    }
                };
                grid.appendChild(item);
            });
            container.appendChild(grid);
        }

    } else if (tab === 'links') {
        // Filter messages with links
        const linkMessages = messages.filter(m => {
            const hasMeta = !!m.linkMeta;
            const hasUrl = /(https?:\/\/[^\s]+)/g.test(m.text || m.message || '');
            return hasMeta || hasUrl;
        });

        if (linkMessages.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px; color:#8696a0;">No links found</div>';
            return;
        }

        linkMessages.forEach(msg => {
            let meta = msg.linkMeta;

            // Handle basic text URLs if no meta
            let url = meta ? meta.url : (msg.text || msg.message).match(/(https?:\/\/[^\s]+)/)[0];
            let title = meta ? meta.title : url;
            let domain = meta ? meta.domain : new URL(url).hostname;
            let desc = meta ? meta.desc : '';

            // Extract date
            let date = new Date(msg.timestamp);
            let dateStr = date.toLocaleDateString();

            const item = document.createElement('div');
            item.className = 'gallery-list-item';
            item.onclick = () => window.open(url, '_blank');

            let thumbHTML = `<div class="gallery-list-thumb"><i class="material-icons" style="color:#8696a0;">link</i></div>`;
            if (meta && meta.image) {
                thumbHTML = `<div class="gallery-list-thumb"><img src="${meta.image}"></div>`;
            }

            item.innerHTML = `
                    ${thumbHTML}
                    <div class="gallery-list-content">
                        <div class="gallery-list-title">${title}</div>
                        <div class="gallery-list-desc">${domain} • ${dateStr}</div>
                    </div>
                 `;
            container.appendChild(item);
        });

    } else if (tab === 'docs') {
        const files = messages.filter(m => m.type === 'file');
        if (files.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px; color:#8696a0;">No documents found</div>';
            return;
        }
        // Logic for docs
        files.forEach(msg => {
            // Placeholder rendering for docs
            const item = document.createElement('div');
            item.className = 'gallery-list-item';
            item.innerHTML = `
                <div class="gallery-list-thumb" style="background:#202c33;"><i class="material-icons" style="color:#e9edef;">description</i></div>
                <div class="gallery-list-content">
                    <div class="gallery-list-title">${msg.fileName || 'Document'}</div>
                    <div class="gallery-list-desc">${new Date(msg.timestamp).toLocaleDateString()}</div>
                </div>
             `;
            container.appendChild(item);
        });
    }
}

function groupMessagesByMonth(messages) {
    const groups = {};
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    // Sort desc
    messages.sort((a, b) => b.timestamp - a.timestamp);

    messages.forEach(msg => {
        const date = new Date(msg.timestamp);
        const monthYear = `${months[date.getMonth()]} ${date.getFullYear()}`;

        // Check if "This Month"
        const now = new Date();
        const label = (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) ? "This Month" : monthYear;

        if (!groups[label]) groups[label] = [];
        groups[label].push(msg);
    });
    return groups;
}

// --- Reply Logic ---
window.replyToMessage = function (message) {
    if (!message) return;

    // Store message
    window.messageToReply = message;

    // Show UI
    const panel = document.getElementById('reply-preview-panel');
    const name = document.getElementById('reply-to-name');
    const text = document.getElementById('reply-to-text');
    const thumb = document.getElementById('reply-preview-thumb');
    const thumbImg = document.getElementById('reply-preview-img');
    const input = document.getElementById('message-input');

    if (panel) panel.style.display = 'flex';
    if (name) name.textContent = message.senderName || 'User';

    let displayText = message.text || message.message || '';
    if (message.type === 'image') displayText = 'Photo';
    if (text) text.textContent = displayText;

    if (message.type === 'image' && thumb && thumbImg) {
        thumb.style.display = 'block';
        thumbImg.src = message.image || message.content;
    } else if (thumb) {
        thumb.style.display = 'none';
    }

    if (input) input.focus();
};

window.cancelReply = function () {
    window.messageToReply = null;
    const panel = document.getElementById('reply-preview-panel');
    if (panel) panel.style.display = 'none';
};

// --- Full-Screen Image Editor Panel Logic ---
window.pendingImages = []; // Array for multiple images
window.currentImageIndex = 0;

window.openImageCaptionPanel = function (file) {
    // Use the new full-screen editor
    window.openImageEditor(file);
};

window.openImageEditor = function (file) {
    if (!file) return;
    window.pendingImages = [file];
    window.currentImageIndex = 0;

    const panel = document.getElementById('image-editor-panel');
    const preview = document.getElementById('editor-preview-image');
    const thumbnails = document.getElementById('editor-thumbnails');
    const captionInput = document.getElementById('editor-caption-input');

    if (!panel || !preview) return;

    // Read and display image
    const reader = new FileReader();
    reader.onload = (e) => {
        preview.src = e.target.result;

        // Create thumbnail
        if (thumbnails) {
            thumbnails.innerHTML = '';
            const thumb = document.createElement('div');
            thumb.className = 'thumb-item active';
            thumb.innerHTML = `<img src="${e.target.result}">`;
            thumb.onclick = () => selectEditorImage(0);
            thumbnails.appendChild(thumb);
        }

        // Show panel
        panel.style.display = 'flex';
        if (captionInput) captionInput.focus();
    };
    reader.readAsDataURL(file);
};

window.closeImageEditor = function () {
    const panel = document.getElementById('image-editor-panel');
    const captionInput = document.getElementById('editor-caption-input');
    const previewImage = document.getElementById('editor-preview-image');
    const thumbnailStrip = document.getElementById('editor-thumbnails');

    if (panel) panel.style.display = 'none';
    if (captionInput) captionInput.value = '';
    if (previewImage) previewImage.src = '';
    if (thumbnailStrip) thumbnailStrip.innerHTML = '';

    // Reset all state
    window.pendingImages = [];
    window.currentImageIndex = 0;
    window.editedImageDataUrl = null;
    window.currentFilter = 'none';
    window.imageRotation = 0;
    window.cropModeActive = false;

    // Clear any file input to allow re-selecting same file
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => input.value = '');
};

window.addMoreImages = function () {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;

    input.onchange = (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            if (file.type.startsWith('image/')) {
                window.pendingImages.push(file);
                addEditorThumbnail(file, window.pendingImages.length - 1);
            }
        });
    };

    input.click();
};

function addEditorThumbnail(file, index) {
    const thumbnails = document.getElementById('editor-thumbnails');
    if (!thumbnails) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const thumb = document.createElement('div');
        thumb.className = 'thumb-item';
        thumb.innerHTML = `<img src="${e.target.result}">`;
        thumb.onclick = () => selectEditorImage(index);
        thumbnails.appendChild(thumb);
    };
    reader.readAsDataURL(file);
}

window.selectEditorImage = function (index) {
    if (index < 0 || index >= window.pendingImages.length) return;

    window.currentImageIndex = index;
    const preview = document.getElementById('editor-preview-image');
    const thumbnails = document.getElementById('editor-thumbnails');

    // Update active state
    if (thumbnails) {
        const thumbItems = thumbnails.querySelectorAll('.thumb-item');
        thumbItems.forEach((t, i) => {
            t.classList.toggle('active', i === index);
        });
    }

    // Load selected image into preview
    const reader = new FileReader();
    reader.onload = (e) => {
        if (preview) preview.src = e.target.result;
    };
    reader.readAsDataURL(window.pendingImages[index]);
};

window.downloadPreviewImage = function () {
    const preview = document.getElementById('editor-preview-image');
    if (!preview || !preview.src) return;

    const link = document.createElement('a');
    link.download = `image_${Date.now()}.png`;
    link.href = preview.src;
    link.click();
};

window.sendEditorImage = async function () {
    if (!window.fireflyChat || window.pendingImages.length === 0) return;

    const caption = document.getElementById('editor-caption-input')?.value.trim() || '';
    const preview = document.getElementById('editor-preview-image');

    // Get current edits
    const filter = window.currentFilter || 'none';
    const rotation = window.imageRotation || 0;
    const hasEdits = window.editedImageDataUrl || filter !== 'none' || rotation !== 0;

    if (hasEdits && preview) {
        // Always capture the current preview state with all edits applied
        // This captures: crop (already in preview.src) + filter + rotation
        const finalImageDataUrl = await captureFinalImage(preview, filter, rotation);
        await sendImageDataUrl(finalImageDataUrl, caption);
    } else {
        // No edits at all - send all original images
        for (let i = 0; i < window.pendingImages.length; i++) {
            const file = window.pendingImages[i];
            const imageCaption = (i === 0) ? caption : '';
            await processAndSendImage(file, imageCaption);
        }
    }

    // Reset and close editor
    window.currentFilter = 'none';
    window.imageRotation = 0;
    window.editedImageDataUrl = null;
    window.closeImageEditor();
};

// Capture the final image with all current edits (crop already in src, then apply filter + rotation)
async function captureFinalImage(imgElement, filter, rotation) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            // Handle rotation dimensions
            const isRotated90 = Math.abs(rotation % 180) === 90;
            const canvasWidth = isRotated90 ? img.height : img.width;
            const canvasHeight = isRotated90 ? img.width : img.height;

            const canvas = document.createElement('canvas');
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            const ctx = canvas.getContext('2d');

            // Apply filter
            const filters = {
                'none': 'none',
                'pop': 'saturate(1.5) contrast(1.1)',
                'bw': 'grayscale(1)',
                'cool': 'sepia(0.2) hue-rotate(180deg)',
                'chrome': 'contrast(1.2) brightness(1.1)',
                'film': 'sepia(0.3) contrast(1.1)'
            };
            ctx.filter = filters[filter] || 'none';

            // Apply rotation
            if (rotation !== 0) {
                ctx.translate(canvasWidth / 2, canvasHeight / 2);
                ctx.rotate((rotation * Math.PI) / 180);
                ctx.drawImage(img, -img.width / 2, -img.height / 2);
            } else {
                ctx.drawImage(img, 0, 0);
            }

            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            resolve(dataUrl);
        };
        // Use the current preview src (which may already be cropped)
        img.src = imgElement.src;
    });
}

// Capture edited image to canvas and return data URL
async function captureEditedImage(imgElement, filter, rotation) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            // Determine canvas size based on rotation
            const isRotated90 = Math.abs(rotation % 180) === 90;
            const canvasWidth = isRotated90 ? img.height : img.width;
            const canvasHeight = isRotated90 ? img.width : img.height;

            const canvas = document.createElement('canvas');
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            const ctx = canvas.getContext('2d');

            // Apply CSS filter to canvas context (modern browsers support this)
            const filters = {
                'none': 'none',
                'pop': 'saturate(1.5) contrast(1.1)',
                'bw': 'grayscale(1)',
                'cool': 'sepia(0.2) hue-rotate(180deg)',
                'chrome': 'contrast(1.2) brightness(1.1)',
                'film': 'sepia(0.3) contrast(1.1)'
            };
            ctx.filter = filters[filter] || 'none';

            // Apply rotation
            ctx.translate(canvasWidth / 2, canvasHeight / 2);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.drawImage(img, -img.width / 2, -img.height / 2);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            resolve(dataUrl);
        };
        img.src = imgElement.src;
    });
}

// Send image from data URL directly
async function sendImageDataUrl(dataUrl, caption) {
    console.log('📷 Sending edited image. Size:', Math.round(dataUrl.length / 1024), 'KB');

    const message = {
        type: 'image',
        image: dataUrl,
        text: caption,
        timestamp: Date.now(),
        sender: window.fireflyChat.currentUser.uid,
        senderName: window.fireflyChat.currentUser.name || 'User'
    };

    // Check reply context
    if (window.messageToReply) {
        message.replyContext = {
            replyToId: window.messageToReply.timestamp,
            replyToName: window.messageToReply.senderName,
            replyToText: window.messageToReply.text || (window.messageToReply.type === 'image' ? 'Photo' : 'Message'),
            replyToType: window.messageToReply.type,
            replyToImage: (window.messageToReply.type === 'image' ? (window.messageToReply.image || window.messageToReply.content) : null)
        };
        window.cancelReply();
    }

    // Display locally first
    window.fireflyChat.displayImageMessage(message, 'sent');

    // Send to Firebase
    if (window.messageRouter) {
        try {
            const result = await window.messageRouter.sendMessage(window.fireflyChat.currentPeer.uid, message);
            console.log('📷 Image send result:', result);
        } catch (err) {
            console.error('📷 Error sending image:', err);
        }
    }
}

// Legacy compatibility
window.cancelImageSend = window.closeImageEditor;
window.sendImageWithCaption = window.sendEditorImage;

// --- Editor Tool Functions ---
window.currentEditorTool = null;
window.currentEditorColor = '#00a884';
window.currentFilter = 'none';
window.cropModeActive = false;
window.imageRotation = 0;

window.toggleCropMode = function () {
    window.cropModeActive = !window.cropModeActive;

    const cropContainer = document.getElementById('crop-container');
    const cropControls = document.getElementById('crop-controls');
    const cropBtn = document.querySelector('.toolbar-btn[data-tool="crop"]');
    const previewImg = document.getElementById('editor-preview-image');
    const cropBox = document.getElementById('crop-box');

    if (cropContainer) cropContainer.style.display = window.cropModeActive ? 'block' : 'none';
    if (cropControls) cropControls.style.display = window.cropModeActive ? 'flex' : 'none';
    if (cropBtn) cropBtn.classList.toggle('active', window.cropModeActive);

    // Position crop container to match image bounds
    if (window.cropModeActive && previewImg && cropContainer) {
        const imgRect = previewImg.getBoundingClientRect();
        const parentRect = previewImg.parentElement.getBoundingClientRect();

        cropContainer.style.left = (imgRect.left - parentRect.left) + 'px';
        cropContainer.style.top = (imgRect.top - parentRect.top) + 'px';
        cropContainer.style.width = imgRect.width + 'px';
        cropContainer.style.height = imgRect.height + 'px';
        cropContainer.style.right = 'auto';
        cropContainer.style.bottom = 'auto';

        // Reset crop box to full image
        if (cropBox) {
            cropBox.style.top = '0';
            cropBox.style.left = '0';
            cropBox.style.right = '0';
            cropBox.style.bottom = '0';
        }

        // Initialize crop handle drag
        initCropHandles();
    }

    // Hide other panels when entering crop mode
    if (window.cropModeActive) {
        document.getElementById('editor-filters-panel')?.classList.remove('active');
        document.getElementById('editor-shape-dropdown')?.classList.remove('active');
        document.getElementById('editor-color-palette')?.classList.remove('active');
    }
};

// Initialize draggable crop handles
function initCropHandles() {
    const cropBox = document.getElementById('crop-box');
    const cropContainer = document.getElementById('crop-container');
    if (!cropBox || !cropContainer) return;

    const handles = cropBox.querySelectorAll('.crop-handle');

    handles.forEach(handle => {
        handle.onmousedown = (e) => {
            e.preventDefault();
            const startX = e.clientX;
            const startY = e.clientY;
            const startRect = cropBox.getBoundingClientRect();
            const containerRect = cropContainer.getBoundingClientRect();
            const handleClass = handle.className;

            const onMouseMove = (e) => {
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;

                let newTop = startRect.top - containerRect.top;
                let newLeft = startRect.left - containerRect.left;
                let newWidth = startRect.width;
                let newHeight = startRect.height;

                // Handle corner/edge resize
                if (handleClass.includes('top')) {
                    newTop = Math.max(0, Math.min(newTop + deltaY, newTop + newHeight - 50));
                    newHeight = startRect.height - deltaY;
                }
                if (handleClass.includes('bottom')) {
                    newHeight = Math.max(50, Math.min(startRect.height + deltaY, containerRect.height - newTop));
                }
                if (handleClass.includes('left')) {
                    newLeft = Math.max(0, Math.min(newLeft + deltaX, newLeft + newWidth - 50));
                    newWidth = startRect.width - deltaX;
                }
                if (handleClass.includes('right')) {
                    newWidth = Math.max(50, Math.min(startRect.width + deltaX, containerRect.width - newLeft));
                }

                // Clamp values
                newHeight = Math.max(50, newHeight);
                newWidth = Math.max(50, newWidth);

                cropBox.style.top = newTop + 'px';
                cropBox.style.left = newLeft + 'px';
                cropBox.style.width = newWidth + 'px';
                cropBox.style.height = newHeight + 'px';
                cropBox.style.right = 'auto';
                cropBox.style.bottom = 'auto';
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };
    });

    // Make crop box itself draggable (move entire box)
    cropBox.onmousedown = (e) => {
        if (e.target !== cropBox) return; // Only if clicking the box, not handles
        e.preventDefault();

        const startX = e.clientX;
        const startY = e.clientY;
        const startRect = cropBox.getBoundingClientRect();
        const containerRect = cropContainer.getBoundingClientRect();

        const onMouseMove = (e) => {
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            let newTop = startRect.top - containerRect.top + deltaY;
            let newLeft = startRect.left - containerRect.left + deltaX;

            // Clamp to container bounds
            newTop = Math.max(0, Math.min(newTop, containerRect.height - startRect.height));
            newLeft = Math.max(0, Math.min(newLeft, containerRect.width - startRect.width));

            cropBox.style.top = newTop + 'px';
            cropBox.style.left = newLeft + 'px';
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };
}

window.rotateCropLeft = function () {
    window.imageRotation = (window.imageRotation - 90) % 360;
    applyImageRotation();
};

window.rotateCropRight = function () {
    window.imageRotation = (window.imageRotation + 90) % 360;
    applyImageRotation();
};

function applyImageRotation() {
    const preview = document.getElementById('editor-preview-image');
    if (preview) {
        preview.style.transform = `rotate(${window.imageRotation}deg)`;
    }
}

window.resetCrop = function () {
    window.imageRotation = 0;
    applyImageRotation();

    // Reset crop box to full container
    const cropBox = document.getElementById('crop-box');
    const cropContainer = document.getElementById('crop-container');
    if (cropBox && cropContainer) {
        cropBox.style.top = '0';
        cropBox.style.left = '0';
        cropBox.style.right = '0';
        cropBox.style.bottom = '0';
        cropBox.style.width = 'auto';
        cropBox.style.height = 'auto';
    }
};

window.selectEditorTool = function (tool) {
    window.currentEditorTool = tool;

    // Exit crop mode if active
    if (window.cropModeActive) {
        window.cropModeActive = false;
        const cropContainer = document.getElementById('crop-container');
        const cropControls = document.getElementById('crop-controls');
        if (cropContainer) cropContainer.style.display = 'none';
        if (cropControls) cropControls.style.display = 'none';
    }

    // Update toolbar UI
    document.querySelectorAll('.editor-toolbar .toolbar-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === tool);
    });

    // Show/hide color palette for drawing tools
    const colorPalette = document.getElementById('editor-color-palette');
    if (colorPalette) {
        const showPalette = ['draw', 'text', 'shapes', 'pixelate'].includes(tool);
        colorPalette.classList.toggle('active', showPalette);
    }

    // Hide other panels
    const filtersPanel = document.getElementById('editor-filters-panel');
    const shapeDropdown = document.getElementById('editor-shape-dropdown');
    if (filtersPanel) filtersPanel.classList.remove('active');
    if (shapeDropdown) shapeDropdown.classList.remove('active');
};

window.toggleFiltersPanel = function () {
    const panel = document.getElementById('editor-filters-panel');
    if (!panel) return;

    const isActive = panel.classList.contains('active');

    // Hide other panels
    document.getElementById('editor-shape-dropdown')?.classList.remove('active');
    document.getElementById('editor-color-palette')?.classList.remove('active');

    panel.classList.toggle('active', !isActive);

    // Update filter thumbnails
    if (!isActive) {
        const preview = document.getElementById('editor-preview-image');
        if (preview && preview.src) {
            ['none', 'pop', 'bw', 'cool', 'chrome', 'film'].forEach(filter => {
                const thumb = document.getElementById(`filter-thumb-${filter}`);
                if (thumb) thumb.src = preview.src;
            });
        }
    }

    // Highlight filters button
    document.querySelector('.toolbar-btn[data-tool="filters"]')?.classList.toggle('active', !isActive);
};

window.applyFilter = function (filterName) {
    window.currentFilter = filterName;
    const preview = document.getElementById('editor-preview-image');
    if (!preview) return;

    const filters = {
        'none': 'none',
        'pop': 'saturate(1.5) contrast(1.1)',
        'bw': 'grayscale(1)',
        'cool': 'sepia(0.2) hue-rotate(180deg)',
        'chrome': 'contrast(1.2) brightness(1.1)',
        'film': 'sepia(0.3) contrast(1.1)'
    };

    preview.style.filter = filters[filterName] || 'none';

    // Update filter items UI
    document.querySelectorAll('.filter-item').forEach(item => {
        item.classList.toggle('active', item.dataset.filter === filterName);
    });
};

window.toggleShapeDropdown = function () {
    const dropdown = document.getElementById('editor-shape-dropdown');
    if (!dropdown) return;

    const isActive = dropdown.classList.contains('active');

    // Hide other panels
    document.getElementById('editor-filters-panel')?.classList.remove('active');

    dropdown.classList.toggle('active', !isActive);

    // Highlight shapes button
    document.querySelector('.toolbar-btn[data-tool="shapes"]')?.classList.toggle('active', !isActive);
};

window.selectShape = function (shape) {
    console.log('Selected shape:', shape);

    // Update shape buttons UI
    document.querySelectorAll('.shape-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.shape === shape);
    });

    // Hide dropdown
    document.getElementById('editor-shape-dropdown')?.classList.remove('active');

    // Show color palette for shapes
    document.getElementById('editor-color-palette')?.classList.add('active');
};

window.selectEditorColor = function (color) {
    window.currentEditorColor = color;

    // Update color dots UI
    document.querySelectorAll('.color-dot').forEach(dot => {
        dot.classList.toggle('active', dot.dataset.color === color);
    });
};

window.editorUndo = function () {
    console.log('Undo action (placeholder)');
    // Placeholder for undo functionality
};

// Track if the image has been edited
window.editedImageDataUrl = null;

window.applyEditorChanges = async function () {
    // If in crop mode, apply the crop
    if (window.cropModeActive) {
        await applyCrop();
    }

    // Close all panels
    document.getElementById('editor-filters-panel')?.classList.remove('active');
    document.getElementById('editor-shape-dropdown')?.classList.remove('active');

    // Exit crop mode
    if (window.cropModeActive) {
        window.cropModeActive = false;
        document.getElementById('crop-container').style.display = 'none';
        document.getElementById('crop-controls').style.display = 'none';
        document.querySelector('.toolbar-btn[data-tool="crop"]')?.classList.remove('active');

        // Auto-move to next tool (draw)
        selectEditorTool('draw');
    }
};

// Actually crop the image based on crop box position
async function applyCrop() {
    const preview = document.getElementById('editor-preview-image');
    const cropBox = document.getElementById('crop-box');
    const cropContainer = document.getElementById('crop-container');

    if (!preview || !cropBox || !cropContainer) return;

    const containerRect = cropContainer.getBoundingClientRect();
    const cropRect = cropBox.getBoundingClientRect();
    const imgRect = preview.getBoundingClientRect();

    // Calculate crop region relative to the actual image
    const scaleX = preview.naturalWidth / imgRect.width;
    const scaleY = preview.naturalHeight / imgRect.height;

    const cropX = (cropRect.left - imgRect.left) * scaleX;
    const cropY = (cropRect.top - imgRect.top) * scaleY;
    const cropWidth = cropRect.width * scaleX;
    const cropHeight = cropRect.height * scaleY;

    // Create canvas and crop
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, cropWidth);
            canvas.height = Math.max(1, cropHeight);
            const ctx = canvas.getContext('2d');

            // Apply current filter if any
            const filters = {
                'none': 'none',
                'pop': 'saturate(1.5) contrast(1.1)',
                'bw': 'grayscale(1)',
                'cool': 'sepia(0.2) hue-rotate(180deg)',
                'chrome': 'contrast(1.2) brightness(1.1)',
                'film': 'sepia(0.3) contrast(1.1)'
            };
            ctx.filter = filters[window.currentFilter] || 'none';

            // Apply rotation if any
            if (window.imageRotation !== 0) {
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate((window.imageRotation * Math.PI) / 180);
                ctx.translate(-canvas.width / 2, -canvas.height / 2);
            }

            // Draw cropped region
            ctx.drawImage(
                img,
                cropX, cropY, cropWidth, cropHeight,  // Source region
                0, 0, canvas.width, canvas.height      // Destination
            );

            // Update preview with cropped image
            const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
            preview.src = croppedDataUrl;
            window.editedImageDataUrl = croppedDataUrl;

            // Reset transforms since they're now baked in
            preview.style.filter = 'none';
            preview.style.transform = 'none';
            window.currentFilter = 'none';
            window.imageRotation = 0;

            // Update thumbnail
            const thumbContainer = document.getElementById('editor-thumbnails');
            if (thumbContainer && thumbContainer.firstChild) {
                const thumbImg = thumbContainer.firstChild.querySelector('img');
                if (thumbImg) thumbImg.src = croppedDataUrl;
            }

            resolve();
        };
        img.src = preview.src;
    });
}

window.toggleFontSelector = function () {
    console.log('Font selector toggle (placeholder)');
    // Placeholder for font selection
};

window.toggleTextBackground = function () {
    const toggle = document.querySelector('.background-toggle');
    if (toggle) {
        toggle.classList.toggle('active');
    }
};

window.deleteSelectedElement = function () {
    console.log('Delete selected element (placeholder)');
    // Placeholder for deleting drawn elements
};

async function processAndSendImage(file, caption) {
    // Compress and send
    const reader = new FileReader();
    reader.onload = async (e) => {
        const img = new Image();
        img.onload = async () => {
            // Compress
            const maxSize = 1024;
            let width = img.width;
            let height = img.height;
            if (width > maxSize || height > maxSize) {
                if (width > height) { height = (height / width) * maxSize; width = maxSize; }
                else { width = (width / height) * maxSize; height = maxSize; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.7);

            const message = {
                type: 'image',
                image: compressed,
                text: caption, // Add caption
                timestamp: Date.now(),
                sender: window.fireflyChat.currentUser.uid,
                senderName: window.fireflyChat.currentUser.name || 'User'
            };

            // Check reply context
            if (window.messageToReply) {
                message.replyContext = {
                    replyToId: window.messageToReply.timestamp, // or ID
                    replyToName: window.messageToReply.senderName,
                    replyToText: window.messageToReply.text || (window.messageToReply.type === 'image' ? 'Photo' : 'Message'),
                    replyToType: window.messageToReply.type,
                    replyToImage: (window.messageToReply.type === 'image' ? (window.messageToReply.image || window.messageToReply.content) : null)
                };
                // Clear reply after send
                window.cancelReply();
            }

            // Display
            window.fireflyChat.displayImageMessage(message, 'sent');
            // Send
            if (window.messageRouter) {
                await window.messageRouter.sendMessage(window.fireflyChat.currentPeer.uid, message);
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Override handleFileUpload in class prototype or hook
// Since we can't easily edit the class method in place without replacing it,
// we will intercept it by overwriting the class method on the instance if possible,

// --- Robust Message Handling Registry ---
window.messageRegistry = {};

window.handleMessageAction = function (timestamp, action) {
    const message = window.messageRegistry[timestamp];
    if (!message) {
        console.error('Message not found in registry:', timestamp);
        return;
    }

    switch (action) {
        case 'reply':
            window.replyToMessage(message);
            break;
        case 'forward':
            if (typeof window.openForwardModal === 'function') {
                window.openForwardModal(message);
            }
            break;
        case 'delete':
            if (typeof window.openDeleteModal === 'function') {
                window.openDeleteModal(message);
            }
            break;
    }

    // Hide all menus
    document.querySelectorAll('.message-options-dropdown').forEach(d => {
        d.style.display = 'none';
        const container = d.closest('.message-container');
        if (container) container.classList.remove('has-active-menu');
    });
};

// ==========================================
// Audio Message Extensions
// ==========================================

if (typeof FireflyChat !== 'undefined') {
    FireflyChat.prototype.displayAudioMessage = function (message, type) {
        // Register message for robust handling
        if (message && message.timestamp) {
            window.messageRegistry[message.timestamp] = message;
            // Also store as string key to be safe for HTML lookups
            window.messageRegistry[String(message.timestamp)] = message;
        }

        const container = document.getElementById('messages-container');
        if (!container) return;

        // Remove empty state if present
        const emptyState = container.querySelector('[style*="text-align: center"]');
        if (emptyState) emptyState.remove();

        const messageDiv = document.createElement('div');
        messageDiv.className = `message-container ${type}`;

        const time = new Date(message.timestamp);
        const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        // Waveform: Use more bars for better look, and vary the heights more naturally
        const waveformHTML = Array(35).fill(0).map(() => {
            const height = Math.floor(Math.random() * 20 + 4);
            return `<div class="waveform-bar" style="height: ${height}px"></div>`;
        }).join('');

        const avatarSrc = type === 'sent'
            ? (this.currentUser.profilePicture || 'anony.jpg')
            : (this.currentPeer.profilePicture || 'anony.jpg');

        const bubbleInner = `
            <div class="audio-bubble-inner">
                 <div class="audio-avatar-wrapper" style="width: 48px; height: 48px; flex-shrink: 0; position: relative;">
                     <img src="${avatarSrc}" class="audio-msg-avatar" alt="Avatar" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover;">
                     <div class="audio-mic-badge"><i class="material-icons" style="font-size: 14px;">mic</i></div>
                 </div>
                 <div class="audio-player-controls">
                     <div class="audio-top-row">
                         <div class="audio-play-btn" onclick="window.playAudioMessage(this, '${message.timestamp}')">
                             <i class="material-icons">play_arrow</i>
                         </div>
                         <div class="audio-waveform-static">
                             ${waveformHTML}
                         </div>
                     </div>
                     <div class="audio-meta-row">
                         <span class="audio-duration">${message.duration || '0:00'}</span>
                         <span class="audio-time">${timeStr}</span>
                     </div>
                 </div>
            </div>
        `;

        messageDiv.innerHTML = `
            <div class="message-avatar">
                <img src="${avatarSrc}" alt="Avatar">
            </div>
            <div class="message-content">
                <div class="message-bubble audio-message">
                    ${bubbleInner}
                </div>
            </div>
             <div class="message-options-container" style="position: relative; align-self: center; margin-left: 4px;">
                 <i class="material-icons message-options-btn" onclick="toggleMessageOptions(this)" 
                    style="font-size: 16px; color: #8696a0; cursor: pointer; opacity: 0; transition: opacity 0.2s;">
                    keyboard_arrow_down
                 </i>
                 <div class="message-options-dropdown" style="display: none; position: absolute; top: 20px; right: 0; background: #233138; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); z-index: 100; min-width: 150px; overflow: hidden; padding: 4px 0;">
                     <div class="msg-opt-item" onclick="window.handleMessageAction('${message.timestamp}', 'reply')"
                          style="padding: 10px 16px; color: #d1d7db; cursor: pointer; display: flex; align-items: center; font-size: 14px;">
                         <i class="material-icons" style="font-size: 20px; margin-right: 12px; color: #8696a0;">reply</i> Reply
                     </div>
                     <div class="msg-opt-item" onclick="window.handleMessageAction('${message.timestamp}', 'delete')"
                          style="padding: 10px 16px; color: #ef4444; cursor: pointer; display: flex; align-items: center; font-size: 14px;">
                         <i class="material-icons" style="font-size: 20px; margin-right: 12px; color: #ef4444;">delete</i> Delete
                     </div>
                 </div>
             </div>
        `;

        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;
    };

    FireflyChat.prototype.sendAudioMessage = async function (audioUrl, duration) {
        if (!this.currentPeer) return;

        const message = {
            type: 'audio',
            audio: audioUrl,
            duration: duration,
            timestamp: Date.now(),
            sender: this.currentUser.uid,
            senderName: this.currentUser.name || 'User'
        };

        this.displayAudioMessage(message, 'sent');

        if (window.messageRouter) {
            try {
                await window.messageRouter.sendMessage(this.currentPeer.uid, message);
                console.log('✅ Audio Message sent');
            } catch (error) {
                console.error('❌ Error sending audio:', error);
                this.showNotification('Failed to send audio', 'error');
            }
        }
    };
}

window.currentAudioObj = null;
window.currentAudioBtn = null;

window.playAudioMessage = function (btn, timestamp) {
    const icon = btn.querySelector('i');
    if (!icon) return;

    // Get message from registry (handle both numeric and string keys)
    const message = window.messageRegistry[timestamp] || window.messageRegistry[Number(timestamp)];
    const url = (message && message.audio) ? message.audio : null;

    if (!url) {
        console.error('Audio lookup failed for:', timestamp);
        // Fallback: If timestamp actually starts with data: its the URL itself (legacy support)
        if (typeof timestamp === 'string' && timestamp.startsWith('data:')) {
            window.playAudioMessageReal(btn, timestamp);
        }
        return;
    }

    window.playAudioMessageReal(btn, url);
};

window.playAudioMessageReal = function (btn, url) {
    const icon = btn.querySelector('i');

    // Toggle current
    if (window.currentAudioObj && window.currentAudioObj.src === url) {
        if (window.currentAudioObj.paused) {
            window.currentAudioObj.play();
            icon.textContent = 'pause';
        } else {
            window.currentAudioObj.pause();
            icon.textContent = 'play_arrow';
        }
        return;
    }

    // Stop existing
    if (window.currentAudioObj) {
        window.currentAudioObj.pause();
        if (window.currentAudioBtn) {
            const prevIcon = window.currentAudioBtn.querySelector('i');
            if (prevIcon) prevIcon.textContent = 'play_arrow';
        }
    }

    try {
        const audio = new Audio(url);
        window.currentAudioObj = audio;
        window.currentAudioBtn = btn;

        icon.textContent = 'pause';

        audio.play().catch(e => {
            console.error('Playback failed', e);
            icon.textContent = 'play_arrow';
        });

        audio.onended = () => {
            icon.textContent = 'play_arrow';
            window.currentAudioObj = null;
        };
    } catch (e) {
        console.error('Error in audio playback:', e);
    }
};
// OR just update the class method in the file (I will update sendMessage below too).



// Add listener to header title container to toggle panel
document.addEventListener('DOMContentLoaded', () => {
    // Add click handler to the header title/avatar wrapper
    const headerTitleInfo = document.querySelector('.header-title > div');
    if (headerTitleInfo) {
        headerTitleInfo.style.cursor = 'pointer';
        headerTitleInfo.onclick = () => window.toggleInfoPanel();
    }
});
