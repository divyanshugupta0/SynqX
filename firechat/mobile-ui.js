// Mobile UI Logic for FireFly Chat
console.log('📱 Mobile UI Module Loaded');

(function () {
    // Check if we are in mobile view
    const isMobile = () => window.innerWidth <= 768;

    // FIX: Remove 300ms tap delay on touch devices
    // This makes all taps respond immediately without needing double-tap
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        let touchStartX = 0;
        let touchStartY = 0;
        const TAP_THRESHOLD = 10; // Pixels

        document.addEventListener('touchstart', function (e) {
            if (e.touches.length === 1) {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
            }
        }, { passive: true });

        document.addEventListener('touchend', function (e) {
            // Skip if multi-touch
            if (e.changedTouches.length !== 1) return;

            // Check for scroll/movement
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            const dist = Math.hypot(touchEndX - touchStartX, touchEndY - touchStartY);

            // If moved more than threshold, treat as scroll and ignore click
            if (dist > TAP_THRESHOLD) return;

            const target = e.target;
            const clickableElement = target.closest('button, a, [onclick], .clickable, .contact-item, .sidebar-icon, .mobile-nav-item, .mobile-editor-btn, .msg-opt-item, .message-options-btn, .toolbar-btn');

            if (clickableElement) {
                // Prevent double-firing or ghost clicks
                e.preventDefault();
                // Trigger immediate click
                clickableElement.click();
            }
        }, { passive: false });

        console.log('📱 Fast-tap enabled with Scroll Guard');
    }


    // Inject Back Button if not present
    function initMobileUI() {
        // 1. Back Button
        const headerTitleDiv = document.querySelector('.header-title > div');
        if (headerTitleDiv && !document.querySelector('.mobile-back-btn')) {
            const backBtn = document.createElement('div');
            backBtn.className = 'mobile-back-btn';
            backBtn.style.display = 'none'; // Hidden by default (handled by CSS)
            backBtn.innerHTML = '<i class="material-icons">arrow_back</i>';
            backBtn.onclick = (e) => {
                e.stopPropagation();
                window.hideMobileChat();
            };

            // Insert before the avatar
            headerTitleDiv.insertBefore(backBtn, headerTitleDiv.firstChild);
        }

        // 2. Bottom Navigation Bar (Chats, Users, Calls, Settings)
        // Check if exists
        let bottomNav = document.querySelector('.mobile-bottom-nav');
        if (!bottomNav) {
            bottomNav = document.createElement('div');
            bottomNav.className = 'mobile-bottom-nav';
            bottomNav.innerHTML = `
                <div class="mobile-nav-item active" id="mob-nav-chats" onclick="window.handleMobileNav('chats')">
                    <i class="material-icons">chat</i>
                    <span>Chats</span>
                </div>
                <div class="mobile-nav-item" id="mob-nav-users" onclick="window.handleMobileNav('users')">
                     <i class="material-icons">people</i>
                    <span>People</span>
                </div>
                <div class="mobile-nav-item" id="mob-nav-calls" onclick="window.handleMobileNav('calls')">
                     <i class="material-icons">phone_enabled</i>
                    <span>Calls</span>
                </div>
                 <div class="mobile-nav-item" id="mob-nav-settings" onclick="window.handleMobileNav('settings')">
                     <i class="material-icons">settings</i>
                    <span>Settings</span>
                </div>
            `;
            // Append to body
            document.body.appendChild(bottomNav);
        }

        // Hide "Tabs" if they exist (replacing with bottom nav)
        const existingTabs = document.querySelector('.mobile-tabs');
        if (existingTabs) existingTabs.style.display = 'none';

        // Initial check for visibility based on screen size
        updateBottomNavVisibility();
        window.addEventListener('resize', updateBottomNavVisibility);
    }

    function updateBottomNavVisibility() {
        const bottomNav = document.querySelector('.mobile-bottom-nav');
        if (bottomNav) {
            bottomNav.style.display = isMobile() ? 'flex' : 'none';
        }
    }

    // Handle Mobile Navigation
    window.handleMobileNav = function (view) {
        // Update Active State
        document.querySelectorAll('.mobile-nav-item').forEach(el => el.classList.remove('active'));
        document.getElementById(`mob-nav-${view}`)?.classList.add('active');

        // Logic
        if (view === 'chats') {
            window.openChatsView(); // Close modals
        } else if (view === 'users') {
            window.openUsersModal();
        } else if (view === 'calls') {
            window.openCallsModal();
        } else if (view === 'settings') {
            window.openSettingsModal();
        }
    };

    // Global Mobile Functions
    window.showMobileChat = function () {
        if (!isMobile()) return;
        document.body.classList.add('mobile-chat-active');
        // Ensure header is visible (it might be hidden via display:none in desktop 'welcome' state)
        document.getElementById('chat-main-header').style.display = 'flex';
        document.getElementById('chat-input-area').style.display = 'flex';
    };

    window.hideMobileChat = function () {
        document.body.classList.remove('mobile-chat-active');
        // Clear active chat selection visuals in list
        document.querySelectorAll('.contact-item').forEach(c => c.classList.remove('active'));
    };

    // Hook into existing interaction - Single Click Fix
    // We use capture phase to ensure we catch it before any potential stopPropagation
    document.addEventListener('click', (e) => {
        const contactItem = e.target.closest('.contact-item');
        if (contactItem && isMobile()) {
            // Immediate trigger
            window.showMobileChat();
        }
    }, true);

    // Inject "Contact Info" into Menu
    function updateMobileMenu() {
        const menu = document.getElementById('chat-header-menu');
        if (menu && !menu.querySelector('.mobile-info-item')) {
            const infoItem = document.createElement('div');
            infoItem.className = 'menu-item mobile-info-item';
            infoItem.innerHTML = '<i class="material-icons">info</i> Contact Info';
            infoItem.onclick = () => {
                window.toggleChatMenu();
                window.toggleInfoPanel();
            };

            // Insert at top or bottom? SynqX usually has it as 'View Contact' at top
            menu.insertBefore(infoItem, menu.firstChild);
        }
    }

    // Run menu update periodically or when menu opens? 
    // Let's hook into the menu toggle button if possible, or just interval
    setInterval(updateMobileMenu, 2000); // Simple polling to ensure it exists if DOM resets

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initMobileUI();
            updateMobileMenu();
        });
    } else {
        initMobileUI();
        updateMobileMenu();
    }

    // Sticky Menu Handler - Close when clicking outside
    window.stickyMenuHandler = function (e) {
        const menu = document.getElementById('chat-header-menu');
        // If menu is open (display block)
        if (menu && menu.style.display === 'block') {
            const btn = e.target.closest('.header-btn[onclick*="toggleChatMenu"]'); // The toggle button
            const inMenu = e.target.closest('#chat-header-menu');

            // If we clicked OUTSIDE menu AND OUTSIDE toggle button, close it
            if (!inMenu && !btn) {
                menu.style.display = 'none';
            }
        }
    };

    // Use capture phase to intercept clicks
    document.addEventListener('click', window.stickyMenuHandler, true);

    // ===================================================================
    // MOBILE IMAGE EDITOR (Separate Panel)
    // ===================================================================

    // Open mobile image editor
    window.openMobileImageEditor = function (file) {
        if (!file) return;
        console.log('📱 Opening Mobile Image Editor with file:', file.name, file.type, file.size);

        const panel = document.getElementById('mobile-image-editor');
        const previewImg = document.getElementById('mobile-editor-image');
        const captionInput = document.getElementById('mobile-editor-caption');
        const previewContainer = panel?.querySelector('.mobile-editor-preview');

        if (!panel || !previewImg) {
            console.error('Mobile image editor elements not found');
            return;
        }

        // Show panel immediately
        panel.style.display = 'flex';

        // Store file for later use
        window._mobileEditorFile = file;

        // Check if format is natively supported
        const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/avif'];
        const isSupported = supportedTypes.includes(file.type.toLowerCase());

        // Read file
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;

            // Remove any existing placeholder
            const existingPlaceholder = previewContainer?.querySelector('.unsupported-placeholder');
            if (existingPlaceholder) existingPlaceholder.remove();
            previewImg.style.display = 'block';

            if (isSupported) {
                // Direct display for supported formats
                previewImg.src = dataUrl;
                window._mobileEditorImageData = dataUrl;
            } else {
                // Try to convert using Canvas
                console.log('📱 Attempting to convert unsupported format:', file.type);
                convertImageFormat(dataUrl, (convertedDataUrl, success) => {
                    if (success && convertedDataUrl) {
                        console.log('📱 Conversion successful');
                        previewImg.src = convertedDataUrl;
                        window._mobileEditorImageData = convertedDataUrl;
                    } else {
                        // Show placeholder for truly unsupported formats
                        console.log('📱 Conversion failed, showing placeholder');
                        previewImg.style.display = 'none';
                        showUnsupportedPlaceholder(previewContainer, file);
                        window._mobileEditorImageData = dataUrl; // Send original
                    }
                });
            }
            if (captionInput) captionInput.focus();
        };
        reader.readAsDataURL(file);
    };

    // Convert image to JPEG using Canvas
    function convertImageFormat(dataUrl, callback) {
        const img = new Image();
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || img.width;
                canvas.height = img.naturalHeight || img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const converted = canvas.toDataURL('image/jpeg', 0.9);
                callback(converted, true);
            } catch (err) {
                console.error('📱 Canvas conversion error:', err);
                callback(null, false);
            }
        };
        img.onerror = () => {
            console.log('📱 Image format not supported by browser');
            callback(null, false);
        };
        img.src = dataUrl;
    }

    // Show placeholder for unsupported formats
    function showUnsupportedPlaceholder(container, file) {
        if (!container) return;
        const placeholder = document.createElement('div');
        placeholder.className = 'unsupported-placeholder';
        placeholder.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;color:#8696a0;text-align:center;padding:20px;';
        placeholder.innerHTML = `
            <i class="material-icons" style="font-size:64px;margin-bottom:16px;opacity:0.6;">image</i>
            <div style="font-size:16px;margin-bottom:8px;">${file.name}</div>
            <div style="font-size:12px;opacity:0.7;">Preview not available</div>
            <div style="font-size:11px;opacity:0.5;margin-top:4px;">Tap send to share anyway</div>
        `;
        container.appendChild(placeholder);
    }


    // Close mobile image editor
    window.closeMobileImageEditor = function () {
        const panel = document.getElementById('mobile-image-editor');
        const previewImg = document.getElementById('mobile-editor-image');
        const captionInput = document.getElementById('mobile-editor-caption');
        const previewContainer = panel?.querySelector('.mobile-editor-preview');

        if (panel) panel.style.display = 'none';
        if (previewImg) {
            previewImg.src = '';
            previewImg.style.display = 'block';
        }
        if (captionInput) captionInput.value = '';

        // Remove any placeholder
        const placeholder = previewContainer?.querySelector('.unsupported-placeholder');
        if (placeholder) placeholder.remove();

        window._mobileEditorFile = null;
        window._mobileEditorImageData = null;
    };

    // Send image from mobile editor
    window.sendMobileEditorImage = async function () {
        const caption = document.getElementById('mobile-editor-caption')?.value.trim() || '';
        const imageData = window._mobileEditorImageData;

        if (!imageData) {
            console.error('No image data to send');
            return;
        }

        console.log('📱 Sending image from mobile editor');

        // Use existing send function if available
        if (typeof sendImageDataUrl === 'function') {
            await sendImageDataUrl(imageData, caption);
        } else if (window.fireflyChat && typeof window.fireflyChat.sendImage === 'function') {
            await window.fireflyChat.sendImage(imageData, caption);
        } else {
            // Fallback: Build and send message directly
            const message = {
                type: 'image',
                image: imageData,
                text: caption,
                timestamp: Date.now(),
                sender: window.fireflyChat?.currentUser?.uid,
                senderName: window.fireflyChat?.currentUser?.name || 'User'
            };

            if (window.fireflyChat) {
                window.fireflyChat.displayImageMessage(message, 'sent');
            }

            if (window.messageRouter && window.fireflyChat?.currentPeer) {
                await window.messageRouter.sendMessage(window.fireflyChat.currentPeer.uid, message);
            }
        }

        // Close the editor
        window.closeMobileImageEditor();
    };

    // Initialize mobile image editor event listeners
    function initMobileImageEditor() {
        const closeBtn = document.getElementById('mobile-editor-close');
        const sendBtn = document.getElementById('mobile-editor-send');
        const doneBtn = document.getElementById('mobile-editor-done');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                window.closeMobileImageEditor();
            });
        }

        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                window.sendMobileEditorImage();
            });
        }

        if (doneBtn) {
            doneBtn.addEventListener('click', () => {
                // For now, done just acknowledges edits
                console.log('📱 Mobile editor: Done clicked');
            });
        }
    }

    // Override openImageEditor for mobile
    const originalOpenImageEditor = window.openImageEditor;
    window.openImageEditor = function (file) {
        if (isMobile()) {
            window.openMobileImageEditor(file);
        } else if (typeof originalOpenImageEditor === 'function') {
            originalOpenImageEditor(file);
        }
    };

    // Initialize mobile image editor when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMobileImageEditor);
    } else {
        initMobileImageEditor();
    }

    // ===================================================================
    // TOUCH DRAG SUPPORT FOR MINIMIZED CALL POPUP
    // ===================================================================
    function initCallPopupTouchDrag() {
        const callPopup = document.getElementById('audio-call-popup');
        if (!callPopup) return;

        const header = callPopup.querySelector('.call-popup-header');
        if (!header) return;

        let isDragging = false;
        let startY = 0;
        let currentBottom = 80;

        header.addEventListener('touchstart', function (e) {
            // Only allow drag when minimized
            if (!callPopup.classList.contains('minimized')) return;

            isDragging = true;
            startY = e.touches[0].clientY;

            const computedStyle = window.getComputedStyle(callPopup);
            currentBottom = parseInt(computedStyle.bottom) || 80;

            e.preventDefault();
        }, { passive: false });

        document.addEventListener('touchmove', function (e) {
            if (!isDragging) return;

            const deltaY = startY - e.touches[0].clientY;
            let newBottom = currentBottom + deltaY;

            // Clamp to screen bounds
            newBottom = Math.max(20, Math.min(newBottom, window.innerHeight - 100));

            callPopup.style.bottom = newBottom + 'px';
        }, { passive: true });

        document.addEventListener('touchend', function () {
            isDragging = false;
        });
    }

    // Initialize call popup touch drag when popup is created
    const callPopupObserver = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            mutation.addedNodes.forEach(function (node) {
                if (node.id === 'audio-call-popup') {
                    initCallPopupTouchDrag();
                }
            });
        });
    });

    callPopupObserver.observe(document.body, { childList: true, subtree: true });

    // ===================================================================
    // PROFILE PICTURE PREVIEW
    // ===================================================================

    // Open profile picture preview
    window.openProfilePreview = function (imageSrc, userName) {
        if (!imageSrc || imageSrc === 'anony.jpg') {
            console.log('📱 No profile picture to preview');
            return;
        }

        console.log('📱 Opening profile preview for:', userName);

        // Remove existing preview if any
        const existingPreview = document.getElementById('profile-preview-modal');
        if (existingPreview) existingPreview.remove();

        // Create preview modal
        const modal = document.createElement('div');
        modal.id = 'profile-preview-modal';
        modal.className = 'profile-preview-modal';
        modal.innerHTML = `
            <div class="profile-preview-header">
                <button class="profile-preview-close" onclick="closeProfilePreview()">
                    <i class="material-icons">arrow_back</i>
                </button>
                <div class="profile-preview-name">${userName || 'Profile'}</div>
            </div>
            <div class="profile-preview-content">
                <div class="profile-preview-image-container">
                    <img src="${imageSrc}" alt="Profile Picture">
                </div>
            </div>
        `;

        // Click outside to close
        modal.addEventListener('click', function (e) {
            if (e.target === modal) {
                closeProfilePreview();
            }
        });

        document.body.appendChild(modal);

        // Animate in
        requestAnimationFrame(() => {
            modal.classList.add('active');
        });
    };

    // Close profile preview
    window.closeProfilePreview = function () {
        const modal = document.getElementById('profile-preview-modal');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        }
    };

    // Add click handlers to avatars
    function initProfilePreviewHandlers() {
        // Listen for clicks on contact avatars and chat header avatars
        document.addEventListener('click', function (e) {
            // Check if clicked on an avatar in contacts list
            const contactAvatar = e.target.closest('.contact-avatar');
            if (contactAvatar) {
                const img = contactAvatar.querySelector('img');
                const contactItem = contactAvatar.closest('.contact-item');
                const contactName = contactItem?.querySelector('.contact-name')?.textContent;

                if (img && img.src) {
                    e.stopPropagation();
                    window.openProfilePreview(img.src, contactName);
                    return;
                }
            }

            // Check if clicked on chat header avatar
            const headerAvatar = e.target.closest('.header-title .header-avatar');
            if (headerAvatar) {
                const img = headerAvatar.querySelector('img') || headerAvatar;
                const headerName = document.querySelector('.header-title .contact-name')?.textContent ||
                    document.querySelector('.header-title .chat-name')?.textContent;

                if (img && img.src) {
                    e.stopPropagation();
                    window.openProfilePreview(img.src, headerName);
                    return;
                }
            }

            // Check if clicked on info panel avatar
            const infoAvatar = e.target.closest('#info-panel .info-avatar');
            if (infoAvatar) {
                const img = infoAvatar.querySelector('img') || infoAvatar;
                const infoName = document.querySelector('#info-panel .info-name')?.textContent;

                if (img && img.src) {
                    e.stopPropagation();
                    window.openProfilePreview(img.src, infoName);
                    return;
                }
            }

            // Check if clicked on media thumbnail in info panel
            const mediaThumb = e.target.closest('.media-thumb');
            if (mediaThumb) {
                const img = mediaThumb.querySelector('img');
                if (img && img.src) {
                    e.stopPropagation();
                    e.preventDefault();
                    // Use image preview (not profile preview)
                    if (typeof openImagePreview === 'function') {
                        openImagePreview(img.src);
                    }
                    return;
                }
            }

            // Check if clicked on gallery item (in full media gallery view)
            const galleryItem = e.target.closest('.gallery-item');
            if (galleryItem) {
                const img = galleryItem.querySelector('img');
                if (img && img.src) {
                    e.stopPropagation();
                    e.preventDefault();
                    if (typeof openImagePreview === 'function') {
                        openImagePreview(img.src);
                    }
                    return;
                }
            }
        }, true);
    }

    // Setup Mobile Input Styles
    function setupMobileInput() {


        const chatInputArea = document.getElementById('chat-input-area');
        if (!chatInputArea || chatInputArea.getAttribute('data-mobile-enhanced')) return;

        chatInputArea.setAttribute('data-mobile-enhanced', 'true');

        const inputWrapper = chatInputArea.querySelector('.input-wrapper');
        const inputActions = chatInputArea.querySelector('.input-actions');
        const textarea = document.getElementById('message-input');
        const sendBtn = chatInputArea.querySelector('.send-btn');

        // Find existing buttons in input-actions
        const btns = Array.from(inputActions.querySelectorAll('.input-btn'));
        const emojiBtn = btns.find(b => b.innerHTML.includes('emoji_emotions'));
        const attachBtn = btns.find(b => b.innerHTML.includes('attach_file'));

        // 1. Transform Attach Button to + and move it to start of chatInputArea
        if (attachBtn) {
            attachBtn.innerHTML = '<i class="material-icons">add</i>';
            attachBtn.classList.add('mobile-attach-btn');
            // Remove from inputActions and insert at start of chat-input-area
            chatInputArea.insertBefore(attachBtn, chatInputArea.firstChild);
        }

        // 2. Move Emoji Button to start of inputWrapper (Before Textarea)
        if (emojiBtn && inputWrapper) {
            inputWrapper.insertBefore(emojiBtn, inputWrapper.firstChild);
        }

        // 3. Send/Mic Button Logic handled by modern-chat.js
        window.updateMobileSendButton = () => {
            // Placeholder to avoid reference errors elsewhere if called
        };
    }

    // Call mobile input setup
    setupMobileInput();

    // Attempt to hide browser address bar for more space
    setTimeout(() => {
        window.scrollTo(0, 1);
    }, 100);

    // Re-run on resize if transitioning to mobile?
    // Doing DOM manip on resize is risky, better to require reload or just run once if started on mobile.

    // Initialize profile preview handlers
    initProfilePreviewHandlers();

})();
