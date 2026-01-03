/**
 * FireChat Audio Call Module
 * Draggable popup with WebRTC audio calling via Firebase signaling
 */

(function () {
    'use strict';

    // Prevent double initialization
    if (window.FireChatAudioCall) {
        console.log('✅ Audio Call module already loaded');
        return;
    }

    console.log('🎤 Initializing Audio Call module...');

    class AudioCallManager {
        constructor() {
            this.localStream = null;
            this.peerConnection = null;
            this.callPopup = null;
            this.callState = 'idle'; // idle, calling, ringing, connected, reconnecting, ended
            this.callTimer = null;
            this.callDuration = 0;
            this.isMuted = false;
            this.isSpeakerOn = true;
            this.currentPeer = null;
            this.callId = null;
            this.isInitiator = false;

            // Connection health monitoring
            this.isReconnecting = false;
            this.reconnectAttempts = 0;
            this.maxReconnectAttempts = 5;
            this.lastAudioActivity = Date.now();
            this.audioActivityChecker = null;
            this.audioActivityTimeout = 5000; // 5 seconds without audio = reconnecting
            this.pausedDuration = 0; // Timer state when paused
            this.connectionQuality = 'good'; // good, slow, poor

            // STUN/TURN servers for WebRTC
            this.iceServers = {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' }
                ]
            };

            this.init();
        }

        init() {
            this.createCallPopup();
            this.setupFirebaseListeners();

            // Make startAudioCall globally available
            window.startAudioCall = () => this.initiateCall();
        }

        /**
         * Get optimized audio constraints based on network quality
         */
        getOptimizedAudioConstraints() {
            // Check current network quality from messageQueue if available
            let networkQuality = 'good';
            if (window.messageQueue && window.messageQueue.getConnectionQuality) {
                networkQuality = window.messageQueue.getConnectionQuality().quality || 'good';
            }

            // Also check Network Information API
            if ('connection' in navigator) {
                const conn = navigator.connection;
                if (conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g') {
                    networkQuality = 'poor';
                } else if (conn.effectiveType === '3g') {
                    networkQuality = 'slow';
                }
            }

            console.log(`📶 Audio call network quality: ${networkQuality}`);

            // Base constraints with noise handling
            const baseConstraints = {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            };

            switch (networkQuality) {
                case 'poor':
                    // Very low bandwidth - minimal audio
                    return {
                        ...baseConstraints,
                        sampleRate: 8000, // Phone quality
                        channelCount: 1,
                        sampleSize: 8
                    };
                case 'slow':
                    // Limited bandwidth - reduced quality
                    return {
                        ...baseConstraints,
                        sampleRate: 16000, // Good speech quality
                        channelCount: 1,
                        sampleSize: 16
                    };
                default:
                    // Good connection - high quality
                    return {
                        ...baseConstraints,
                        sampleRate: 48000,
                        channelCount: 1,
                        sampleSize: 16
                    };
            }
        }

        createCallPopup() {
            // Remove existing popup if any
            const existing = document.getElementById('audio-call-popup');
            if (existing) existing.remove();

            const popup = document.createElement('div');
            popup.id = 'audio-call-popup';
            popup.className = 'audio-call-popup';
            popup.style.display = 'none';

            popup.innerHTML = `
                <!-- Draggable Header -->
                <div class="call-popup-header" id="call-drag-handle">
                    <div class="call-encryption">
                        <i class="material-icons" style="font-size: 14px;">lock</i>
                        <span>End-to-end encrypted</span>
                    </div>
                    <div class="call-window-controls">
                        <button class="call-window-btn" onclick="window.audioCallManager.toggleMinimize()">
                            <i class="material-icons">remove</i>
                        </button>
                    </div>
                </div>

                <!-- Main Call Content -->
                <div class="call-popup-body">
                    <div class="call-avatar-container">
                        <div class="call-avatar" id="call-avatar">
                            <img src="anony.jpg" alt="User">
                        </div>
                        <div class="call-pulse-ring"></div>
                    </div>
                    
                    <div class="call-info-group">
                        <div class="call-user-name" id="call-user-name">User</div>
                        <div class="call-status" id="call-status">Calling...</div>
                        <div class="call-timer" id="call-timer" style="display: none;">00:00</div>
                    </div>
                </div>

                <!-- OUTGOING CALL Controls (shown for caller) -->
                <div class="call-popup-footer" id="outgoing-controls">
                    <div class="call-controls-row">
                        <!-- Maximize Button (Hidden in full mode, shown in minimized) -->
                        <button class="call-control-btn minimized-maximize-btn" onclick="window.audioCallManager.toggleMinimize()" title="Maximize">
                            <i class="material-icons">open_in_full</i>
                        </button>
                        
                        <button class="call-control-btn" id="btn-camera" onclick="window.audioCallManager.toggleCamera()" title="Camera off">
                            <i class="material-icons">videocam_off</i>
                            <span class="control-dropdown"><i class="material-icons">expand_more</i></span>
                        </button>
                        <button class="call-control-btn" id="btn-mute" onclick="window.audioCallManager.toggleMute()" title="Mute">
                            <i class="material-icons">mic</i>
                            <span class="control-dropdown"><i class="material-icons">expand_more</i></span>
                        </button>
                    </div>
                    
                    <div class="call-actions-row">
                        <button class="call-action-btn" onclick="window.audioCallManager.toggleEmoji()" title="React">
                            <i class="material-icons">emoji_emotions</i>
                        </button>
                        <button class="call-action-btn" onclick="window.audioCallManager.toggleRaiseHand()" title="Raise hand">
                            <i class="material-icons">pan_tool</i>
                        </button>
                        <button class="call-action-btn" onclick="window.audioCallManager.shareScreen()" title="Share screen">
                            <i class="material-icons">screen_share</i>
                        </button>
                        <button class="call-action-btn" onclick="window.audioCallManager.addParticipant()" title="Add people">
                            <i class="material-icons">person_add</i>
                        </button>
                    </div>

                    <button class="call-end-btn" id="btn-end-call" onclick="window.audioCallManager.endCall()" title="End call">
                        <i class="material-icons">call_end</i>
                    </button>
                </div>

                <!-- INCOMING CALL Controls (shown for receiver) -->
                <div class="call-popup-footer call-incoming-footer" id="incoming-controls" style="display: none;">
                    <div class="call-incoming-text">Incoming voice call</div>
                    <div class="call-incoming-actions">
                        <button class="call-decline-btn" onclick="window.audioCallManager.endCall()" title="Decline">
                            <i class="material-icons">call_end</i>
                        </button>
                        <button class="call-accept-btn" onclick="window.audioCallManager.acceptCall()" title="Accept">
                            <i class="material-icons">call</i>
                        </button>
                    </div>
                </div>

                <!-- Audio elements (hidden) -->
                <audio id="remote-audio" autoplay></audio>
                <audio id="ringtone" loop>
                    <source src="https://assets.mixkit.co/sfx/preview/mixkit-phone-ring-1356.mp3" type="audio/mpeg">
                </audio>
            `;

            document.body.appendChild(popup);
            this.callPopup = popup;
            this.makeDraggable(popup);
        }

        makeDraggable(element) {
            // Drag handle is the element itself now to support minimized mode dragging
            // We just need to filter out button clicks
            let isDragging = false;
            let startX, startY, startLeft, startTop;

            const isInteractive = (target) => {
                return target.closest('button') || target.closest('.call-window-btn') ||
                    target.closest('.call-control-btn') || target.closest('.call-action-btn') ||
                    target.closest('.call-end-btn') || target.closest('.call-accept-btn') ||
                    target.closest('.call-decline-btn');
            };

            const onMouseDown = (e) => {
                // If interactive element, ignore
                if (isInteractive(e.target)) return;

                // SMART DRAG LOGIC:
                // 1. If minimized: allow drag from ANYWHERE on the element
                // 2. If NOT minimized: allow drag ONLY from the header
                const isMinimized = element.classList.contains('minimized');
                const isHeader = e.target.closest('.call-popup-header');

                if (!isMinimized && !isHeader) return;

                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;

                const rect = element.getBoundingClientRect();
                startLeft = rect.left;
                startTop = rect.top;

                // Clear transform to allow free positioning
                element.style.transform = 'none';
                element.style.left = startLeft + 'px';
                element.style.top = startTop + 'px';
                element.style.transition = 'none';
                element.style.cursor = 'grabbing';
            };

            element.addEventListener('mousedown', onMouseDown);

            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;

                const dx = e.clientX - startX;
                const dy = e.clientY - startY;

                let newLeft = startLeft + dx;
                let newTop = startTop + dy;

                const maxLeft = window.innerWidth - element.offsetWidth;
                const maxTop = window.innerHeight - element.offsetHeight;

                newLeft = Math.max(0, Math.min(newLeft, maxLeft));
                newTop = Math.max(0, Math.min(newTop, maxTop));

                element.style.left = newLeft + 'px';
                element.style.top = newTop + 'px';
                element.style.right = 'auto';
                element.style.bottom = 'auto';
            });

            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    element.style.transition = '';
                    element.style.cursor = '';
                }
            });

            // Touch support for mobile dragging
            element.addEventListener('touchstart', (e) => {
                if (isInteractive(e.target)) return;

                // SMART DRAG LOGIC (TOUCH):
                const isMinimized = element.classList.contains('minimized');
                const isHeader = e.target.closest('.call-popup-header');

                if (!isMinimized && !isHeader) return;

                // Prevent default to stop scroll
                if (e.cancelable) e.preventDefault();

                const touch = e.touches[0];
                isDragging = true;
                startX = touch.clientX;
                startY = touch.clientY;

                const rect = element.getBoundingClientRect();
                startLeft = rect.left;
                startTop = rect.top;

                element.style.transform = 'none';
                element.style.left = startLeft + 'px';
                element.style.top = startTop + 'px';
            }, { passive: false });

            document.addEventListener('touchmove', (e) => {
                if (!isDragging) return;

                // Prevent scroll while dragging
                if (e.cancelable) e.preventDefault();

                const touch = e.touches[0];
                const dx = touch.clientX - startX;
                const dy = touch.clientY - startY;
                let newLeft = startLeft + dx;
                let newTop = startTop + dy;

                const maxLeft = window.innerWidth - element.offsetWidth;
                const maxTop = window.innerHeight - element.offsetHeight;
                newLeft = Math.max(0, Math.min(newLeft, maxLeft));
                newTop = Math.max(0, Math.min(newTop, maxTop));

                element.style.left = newLeft + 'px';
                element.style.top = newTop + 'px';
                element.style.right = 'auto';
                element.style.bottom = 'auto';
            }, { passive: false });

            document.addEventListener('touchend', () => isDragging = false);
        }

        setupFirebaseListeners() {
            if (!firebase || !firebase.database) {
                console.warn('Firebase not available for call signaling');
                return;
            }

            // Get current user
            firebase.auth().onAuthStateChanged((user) => {
                if (user) {
                    this.currentUser = user;
                    this.listenForIncomingCalls();
                }
            });
        }

        listenForIncomingCalls() {
            if (!this.currentUser) return;

            const callsRef = firebase.database().ref(`calls/${this.currentUser.uid}`);

            callsRef.on('child_added', async (snapshot) => {
                const callData = snapshot.val();
                if (callData && callData.type === 'offer') {
                    // Check if already in a call
                    if (this.callState !== 'idle') {
                        // User is busy - send busy signal and remove call data
                        console.log('User is busy, declining call');

                        // Get caller info for notification
                        const callerSnapshot = await firebase.database().ref(`users/${callData.from}`).once('value');
                        const caller = callerSnapshot.val() || {};
                        const callerName = caller.name || caller.username || 'Someone';

                        this.showNotification(`${callerName} tried to call (you're busy)`, 'info');

                        // Remove the call data to decline
                        firebase.database().ref(`calls/${this.currentUser.uid}/${snapshot.key}`).remove();

                        // Also notify caller they're busy
                        firebase.database().ref(`calls/${callData.from}/${snapshot.key}`).update({
                            busy: true,
                            busyMessage: 'User is on another call'
                        });

                        return;
                    }

                    this.handleIncomingCall(snapshot.key, callData);
                }
            });
        }

        async handleIncomingCall(callId, callData) {
            this.callId = callId;
            this.callState = 'ringing';
            this.isInitiator = false;

            // Get caller info
            const callerSnapshot = await firebase.database().ref(`users/${callData.from}`).once('value');
            const caller = callerSnapshot.val() || {};

            this.currentPeer = {
                uid: callData.from,
                name: caller.name || caller.username || 'Unknown',
                profilePicture: caller.profilePicture || 'anony.jpg'
            };

            this.showCallPopup('incoming');
            this.playRingtone();
        }

        async initiateCall() {
            if (!window.fireflyChat || !window.fireflyChat.currentPeer) {
                this.showNotification('Select a contact to call', 'error');
                return;
            }

            if (this.callState !== 'idle') {
                this.showNotification('Already in a call', 'error');
                return;
            }

            this.currentPeer = window.fireflyChat.currentPeer;
            this.isInitiator = true;
            this.callState = 'calling';
            this.callId = Date.now().toString();

            this.showCallPopup('outgoing');

            try {
                // Get optimized audio constraints based on network quality
                const audioConstraints = this.getOptimizedAudioConstraints();

                this.localStream = await navigator.mediaDevices.getUserMedia({
                    audio: audioConstraints,
                    video: false
                });

                // Create peer connection
                this.createPeerConnection();

                // Add local stream to peer connection
                this.localStream.getTracks().forEach(track => {
                    this.peerConnection.addTrack(track, this.localStream);
                });

                // Create and send offer
                const offer = await this.peerConnection.createOffer();
                await this.peerConnection.setLocalDescription(offer);

                // Send offer via Firebase
                await firebase.database().ref(`calls/${this.currentPeer.uid}/${this.callId}`).set({
                    type: 'offer',
                    from: this.currentUser.uid,
                    offer: {
                        type: offer.type,
                        sdp: offer.sdp
                    },
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                });

                // Listen for answer
                this.listenForAnswer();

                // Listen for call termination from other side
                this.listenForCallEnd();

            } catch (error) {
                console.error('Call initiation error:', error);
                this.showNotification('Could not start call: ' + error.message, 'error');
                this.endCall();
            }
        }

        createPeerConnection() {
            this.peerConnection = new RTCPeerConnection(this.iceServers);

            // ICE candidate handling
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    const targetUid = this.isInitiator ? this.currentPeer.uid : this.currentPeer.uid;
                    firebase.database().ref(`calls/${targetUid}/${this.callId}/candidates`).push({
                        candidate: event.candidate.toJSON(),
                        from: this.currentUser.uid
                    });
                }
            };

            // Remote stream handling - handles both audio and screen share video
            this.peerConnection.ontrack = (event) => {
                console.log('Received remote track:', event.track.kind);

                if (event.track.kind === 'audio') {
                    // Audio track - use existing audio element
                    const remoteAudio = document.getElementById('remote-audio');
                    if (remoteAudio) {
                        remoteAudio.srcObject = event.streams[0];
                    }
                } else if (event.track.kind === 'video') {
                    // Video track - screen share from remote user
                    console.log('Received screen share from remote user');
                    this.showRemoteScreenShare(event.streams[0], event.track);
                }
            };

            // Connection state changes
            this.peerConnection.onconnectionstatechange = () => {
                console.log('Connection state:', this.peerConnection.connectionState);

                switch (this.peerConnection.connectionState) {
                    case 'connected':
                        this.onCallConnected();
                        break;
                    case 'disconnected':
                        // Don't end immediately - try to reconnect
                        this.handleConnectionInterruption();
                        break;
                    case 'failed':
                        // Connection completely failed
                        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                            this.showNotification('Call failed - connection lost', 'error');
                            this.endCall();
                        } else {
                            this.handleConnectionInterruption();
                        }
                        break;
                }
            };

            // ICE connection state for more granular connection monitoring
            this.peerConnection.oniceconnectionstatechange = () => {
                console.log('ICE connection state:', this.peerConnection.iceConnectionState);

                switch (this.peerConnection.iceConnectionState) {
                    case 'checking':
                        // Still connecting
                        break;
                    case 'connected':
                    case 'completed':
                        this.handleConnectionRestored();
                        break;
                    case 'disconnected':
                        this.handleConnectionInterruption();
                        break;
                    case 'failed':
                        if (this.reconnectAttempts < this.maxReconnectAttempts) {
                            this.attemptReconnect();
                        } else {
                            this.endCall();
                        }
                        break;
                }
            };

            // Listen for negotiation needed (when tracks are added/removed)
            this.peerConnection.onnegotiationneeded = async () => {
                console.log('Negotiation needed');
                // Only the initiator should create offer on negotiationneeded during mid-call updates
                if (this.callState === 'connected') {
                    await this.renegotiateConnection();
                }
            };

            // Listen for ICE candidates
            this.listenForIceCandidates();

            // Listen for renegotiation offers
            this.listenForRenegotiation();

            // Listen for call events (emoji, raise hand)
            this.listenForCallEvents();

            // Start connection quality monitoring
            this.startConnectionMonitoring();
        }

        async renegotiateConnection() {
            if (!this.peerConnection || this.peerConnection.signalingState !== 'stable') {
                console.log('Cannot renegotiate: connection not stable');
                return;
            }

            try {
                console.log('Creating renegotiation offer...');

                const offer = await this.peerConnection.createOffer();
                await this.peerConnection.setLocalDescription(offer);

                // Send renegotiation offer via Firebase
                await firebase.database().ref(`calls/${this.currentPeer.uid}/${this.callId}/renegotiate`).set({
                    type: 'offer',
                    from: this.currentUser.uid,
                    offer: {
                        type: offer.type,
                        sdp: offer.sdp
                    },
                    timestamp: Date.now()
                });

                console.log('Renegotiation offer sent');
            } catch (error) {
                console.error('Renegotiation error:', error);
            }
        }

        listenForRenegotiation() {
            if (!this.callId || !this.currentUser) return;

            const renegotiateRef = firebase.database().ref(`calls/${this.currentUser.uid}/${this.callId}/renegotiate`);

            renegotiateRef.on('value', async (snapshot) => {
                const data = snapshot.val();
                if (!data || data.from === this.currentUser.uid) return;

                if (data.type === 'offer' && data.offer && this.peerConnection) {
                    console.log('Received renegotiation offer');

                    try {
                        await this.peerConnection.setRemoteDescription(
                            new RTCSessionDescription(data.offer)
                        );

                        const answer = await this.peerConnection.createAnswer();
                        await this.peerConnection.setLocalDescription(answer);

                        // Send answer back
                        await firebase.database().ref(`calls/${this.currentPeer.uid}/${this.callId}/renegotiate`).set({
                            type: 'answer',
                            from: this.currentUser.uid,
                            answer: {
                                type: answer.type,
                                sdp: answer.sdp
                            },
                            timestamp: Date.now()
                        });

                        console.log('Renegotiation answer sent');
                    } catch (e) {
                        console.error('Error handling renegotiation offer:', e);
                    }
                } else if (data.type === 'answer' && data.answer && this.peerConnection) {
                    console.log('Received renegotiation answer');

                    try {
                        if (this.peerConnection.signalingState === 'have-local-offer') {
                            await this.peerConnection.setRemoteDescription(
                                new RTCSessionDescription(data.answer)
                            );
                            console.log('Renegotiation complete');
                        }
                    } catch (e) {
                        console.error('Error handling renegotiation answer:', e);
                    }
                }
            });
        }

        listenForAnswer() {
            const answerRef = firebase.database().ref(`calls/${this.currentUser.uid}/${this.callId}`);
            this.answerListenerRef = answerRef;
            this.remoteDescriptionSet = false;

            answerRef.on('value', async (snapshot) => {
                const data = snapshot.val();

                // Check if user is busy
                if (data && data.busy) {
                    console.log('User is busy');
                    this.updateCallStatus('User is busy...');
                    this.showNotification(data.busyMessage || 'User is on another call', 'info');

                    // End call after 3 seconds
                    setTimeout(() => {
                        this.endCall();
                    }, 3000);
                    return;
                }

                // Only process if we have an answer, haven't set it yet, and peer connection exists
                if (data && data.answer && !this.remoteDescriptionSet && this.peerConnection) {
                    // Check peer connection state
                    if (this.peerConnection.signalingState === 'have-local-offer') {
                        try {
                            this.remoteDescriptionSet = true;
                            await this.peerConnection.setRemoteDescription(
                                new RTCSessionDescription(data.answer)
                            );
                            console.log('Remote description set successfully');

                            // Process any queued ICE candidates
                            this.processQueuedCandidates();
                        } catch (e) {
                            console.error('Error setting remote description:', e);
                            this.remoteDescriptionSet = false;
                        }
                    }
                }
            });
        }

        listenForIceCandidates() {
            const candidatesRef = firebase.database().ref(`calls/${this.currentUser.uid}/${this.callId}/candidates`);
            this.candidatesListenerRef = candidatesRef;
            this.iceCandidateQueue = [];

            candidatesRef.on('child_added', async (snapshot) => {
                const data = snapshot.val();
                if (data && data.candidate && data.from !== this.currentUser.uid) {
                    // If remote description isn't set yet, queue the candidate
                    if (!this.peerConnection || !this.peerConnection.remoteDescription) {
                        this.iceCandidateQueue.push(data.candidate);
                        return;
                    }

                    try {
                        await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                    } catch (e) {
                        // Only log if it's not a benign error
                        if (!e.message.includes('location is null')) {
                            console.warn('Error adding ICE candidate:', e.message);
                        }
                    }
                }
            });
        }

        async processQueuedCandidates() {
            if (!this.peerConnection || !this.iceCandidateQueue) return;

            console.log(`Processing ${this.iceCandidateQueue.length} queued ICE candidates`);

            for (const candidate of this.iceCandidateQueue) {
                try {
                    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (e) {
                    console.warn('Error adding queued ICE candidate:', e.message);
                }
            }

            this.iceCandidateQueue = [];
        }


        // Listen for call termination from the other party
        listenForCallEnd() {
            if (!this.callId || !this.currentUser) return;

            // Determine where the call data lives based on role
            // Initiator listens to Peer's node (where offer was sent)
            // Receiver listens to Own node (where offer was received)
            let targetUid = this.currentUser.uid;

            if (this.isInitiator && this.currentPeer) {
                targetUid = this.currentPeer.uid;
            }

            const callRef = firebase.database().ref(`calls/${targetUid}/${this.callId}`);

            // Skip the initial callback - only react to CHANGES after setup
            let initialLoad = true;

            callRef.on('value', (snapshot) => {
                // Skip first callback (initial load)
                if (initialLoad) {
                    initialLoad = false;
                    return;
                }

                // If data is null, call has ended
                if (!snapshot.exists() && this.callState !== 'idle') {
                    console.log('Call ended (remote data removed)');
                    this.showNotification('Call ended', 'info');
                    this.endCallLocally();
                }
            });

            this.callEndListenerRef = callRef;
        }

        // End call locally without trying to remove Firebase data
        endCallLocally() {
            console.log('Ending call locally...');

            // Stop screen sharing if active
            if (this.screenStream) {
                this.screenStream.getTracks().forEach(track => track.stop());
                this.screenStream = null;
                this.screenSender = null;
            }

            // Stop local stream
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop());
                this.localStream = null;
            }

            // Close peer connection
            if (this.peerConnection) {
                this.peerConnection.close();
                this.peerConnection = null;
            }

            // Turn off ALL Firebase listeners
            if (this.callEndListenerRef) {
                this.callEndListenerRef.off();
                this.callEndListenerRef = null;
            }
            if (this.eventsListenerRef) {
                this.eventsListenerRef.off();
                this.eventsListenerRef = null;
            }
            if (this.answerListenerRef) {
                this.answerListenerRef.off();
                this.answerListenerRef = null;
            }
            if (this.candidatesListenerRef) {
                this.candidatesListenerRef.off();
                this.candidatesListenerRef = null;
            }
            if (this.renegotiateListenerRef) {
                this.renegotiateListenerRef.off();
                this.renegotiateListenerRef = null;
            }

            // Save call log if not already saved (avoid duplicates?)
            // If remote ended it, we should log it.
            if (this.callState !== 'idle') {
                const type = this.isInitiator ? 'outgoing' : 'incoming';
                let status = 'completed';
                if (this.callDuration === 0) {
                    // If duration 0 and remote ended, it's either declined or missed (if incoming) or just cancelled (if outgoing)
                    // If I am initiator and remote ended -> Declined.
                    // If I am receiver and remote ended -> Missed (if I didn't answer yet?) or Cancelled by caller.
                    if (this.isInitiator) status = 'declined';
                    else status = 'missed'; // simplified
                }
                this.saveCallLog(type, status);
            }

            // Stop timer and ringtone
            this.stopTimer();
            this.stopRingtone();

            // Stop connection monitoring
            this.stopConnectionMonitoring();

            // FULL STATE RESET
            this.callState = 'idle';
            this.callId = null;
            this.isMuted = false;
            this.remoteScreenActive = false;
            this.isHandRaised = false;
            this.isReconnecting = false;
            this.reconnectAttempts = 0;
            this.pausedDuration = 0;
            this.connectionQuality = 'good';

            // Reset UI buttons for Camera/Mute
            const cameraBtn = document.getElementById('btn-camera');
            if (cameraBtn) cameraBtn.classList.remove('active');

            const muteBtn = document.getElementById('btn-mute');
            if (muteBtn) {
                muteBtn.classList.remove('active');
                const icon = muteBtn.querySelector('i.material-icons');
                if (icon) icon.textContent = 'mic';
            }

            // Hide screen share previews and restore avatar
            const screenPreview = this.callPopup?.querySelector('.screen-share-preview');
            const remoteScreen = this.callPopup?.querySelector('.remote-screen-share');
            const avatarContainer = this.callPopup?.querySelector('.call-avatar-container');
            const handIndicator = this.callPopup?.querySelector('.hand-raised-indicator');

            if (screenPreview) screenPreview.style.display = 'none';
            if (remoteScreen) remoteScreen.style.display = 'none';
            if (handIndicator) handIndicator.style.display = 'none';
            if (avatarContainer) avatarContainer.style.display = '';

            // Hide popup immediately
            this.hideCallPopup();
        }




        async acceptCall() {
            this.stopRingtone();
            this.callState = 'connecting';
            this.updateCallStatus('Connecting...');

            // Switch from incoming to outgoing controls
            const outgoingControls = document.getElementById('outgoing-controls');
            const incomingControls = document.getElementById('incoming-controls');
            if (outgoingControls) outgoingControls.style.display = 'flex';
            if (incomingControls) incomingControls.style.display = 'none';

            try {
                // Get optimized audio constraints based on network quality
                const audioConstraints = this.getOptimizedAudioConstraints();

                this.localStream = await navigator.mediaDevices.getUserMedia({
                    audio: audioConstraints,
                    video: false
                });

                this.createPeerConnection();

                this.localStream.getTracks().forEach(track => {
                    this.peerConnection.addTrack(track, this.localStream);
                });

                // Get the offer
                const callSnapshot = await firebase.database()
                    .ref(`calls/${this.currentUser.uid}/${this.callId}`)
                    .once('value');
                const callData = callSnapshot.val();

                if (callData && callData.offer) {
                    await this.peerConnection.setRemoteDescription(
                        new RTCSessionDescription(callData.offer)
                    );

                    const answer = await this.peerConnection.createAnswer();
                    await this.peerConnection.setLocalDescription(answer);

                    // Send answer back
                    await firebase.database().ref(`calls/${this.currentPeer.uid}/${this.callId}`).update({
                        answer: {
                            type: answer.type,
                            sdp: answer.sdp
                        }
                    });

                    // Listen for call termination from other side
                    this.listenForCallEnd();
                }

            } catch (error) {
                console.error('Error accepting call:', error);
                this.showNotification('Could not accept call', 'error');
                this.endCall();
            }
        }

        onCallConnected() {
            this.callState = 'connected';
            this.stopRingtone();
            this.updateCallStatus('');
            this.startTimer();

            // Hide pulse animation
            const pulseRing = this.callPopup.querySelector('.call-pulse-ring');
            if (pulseRing) pulseRing.style.display = 'none';

            // Ensure outgoing controls are visible (for both caller and receiver after accepting)
            const outgoingControls = this.callPopup.querySelector('#outgoing-controls');
            const incomingControls = this.callPopup.querySelector('#incoming-controls');

            if (outgoingControls) {
                outgoingControls.style.display = 'flex';
                outgoingControls.style.visibility = 'visible';
            }
            if (incomingControls) {
                incomingControls.style.display = 'none';
                incomingControls.style.visibility = 'hidden';
            }
        }

        startTimer() {
            this.callDuration = 0;
            const timerEl = document.getElementById('call-timer');
            if (timerEl) timerEl.style.display = 'block';

            this.callTimer = setInterval(() => {
                this.callDuration++;
                const minutes = Math.floor(this.callDuration / 60).toString().padStart(2, '0');
                const seconds = (this.callDuration % 60).toString().padStart(2, '0');
                if (timerEl) timerEl.textContent = `${minutes}:${seconds}`;
            }, 1000);
        }

        stopTimer() {
            if (this.callTimer) {
                clearInterval(this.callTimer);
                this.callTimer = null;
            }
        }

        /**
         * Pause timer during reconnection
         */
        pauseTimer() {
            if (this.callTimer) {
                this.pausedDuration = this.callDuration;
                clearInterval(this.callTimer);
                this.callTimer = null;
                console.log(`⏸️ Timer paused at ${this.pausedDuration}s`);
            }
        }

        /**
         * Resume timer after successful reconnection
         */
        resumeTimer() {
            if (this.pausedDuration > 0 && !this.callTimer) {
                this.callDuration = this.pausedDuration;
                const timerEl = document.getElementById('call-timer');

                this.callTimer = setInterval(() => {
                    this.callDuration++;
                    const minutes = Math.floor(this.callDuration / 60).toString().padStart(2, '0');
                    const seconds = (this.callDuration % 60).toString().padStart(2, '0');
                    if (timerEl) timerEl.textContent = `${minutes}:${seconds}`;
                }, 1000);

                // Restore timer display
                if (timerEl) {
                    timerEl.style.display = 'block';
                    timerEl.style.color = ''; // Reset color
                }

                console.log(`▶️ Timer resumed from ${this.pausedDuration}s`);
                this.pausedDuration = 0;
            }
        }

        /**
         * Handle connection interruption - show reconnecting status
         */
        handleConnectionInterruption() {
            if (this.isReconnecting) return; // Already handling

            this.isReconnecting = true;
            this.callState = 'reconnecting';
            this.reconnectAttempts++;

            console.log(`🔄 Connection interrupted (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

            // Pause the timer
            this.pauseTimer();

            // Show reconnecting status instead of timer
            const timerEl = document.getElementById('call-timer');
            const statusEl = document.getElementById('call-status');

            if (timerEl) {
                timerEl.textContent = 'Reconnecting...';
                timerEl.style.color = '#f59e0b'; // Amber color
                timerEl.style.display = 'block';
            }

            if (statusEl) {
                statusEl.textContent = 'Poor connection';
                statusEl.style.color = '#f59e0b';
            }

            // Show notification
            this.showNotification('Connection interrupted, reconnecting...', 'warning');

            // Set a timeout to end call if reconnection fails
            this.reconnectTimeout = setTimeout(() => {
                if (this.isReconnecting) {
                    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                        this.showNotification('Call ended - could not reconnect', 'error');
                        this.endCall();
                    } else {
                        this.attemptReconnect();
                    }
                }
            }, 10000); // 10 seconds to reconnect
        }

        /**
         * Handle connection restored - resume normal call
         */
        handleConnectionRestored() {
            if (!this.isReconnecting && this.callState === 'connected') return;

            console.log('✅ Connection restored!');

            // Clear reconnect timeout
            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout);
                this.reconnectTimeout = null;
            }

            this.isReconnecting = false;
            this.reconnectAttempts = 0;
            this.callState = 'connected';

            // Resume the timer
            this.resumeTimer();

            // Update status
            const statusEl = document.getElementById('call-status');
            if (statusEl) {
                statusEl.textContent = '';
                statusEl.style.color = '';
            }

            // Show success notification
            this.showNotification('Connection restored', 'success');
        }

        /**
         * Attempt to reconnect via ICE restart
         */
        async attemptReconnect() {
            if (!this.peerConnection || !this.isInitiator) return;

            console.log('🔄 Attempting ICE restart...');

            try {
                // Create new offer with ICE restart
                const offer = await this.peerConnection.createOffer({ iceRestart: true });
                await this.peerConnection.setLocalDescription(offer);

                // Send restart offer via Firebase
                await firebase.database().ref(`calls/${this.currentPeer.uid}/${this.callId}/restart`).set({
                    type: 'offer',
                    from: this.currentUser.uid,
                    offer: {
                        type: offer.type,
                        sdp: offer.sdp
                    },
                    timestamp: Date.now()
                });

                console.log('📤 ICE restart offer sent');
            } catch (error) {
                console.error('ICE restart failed:', error);
            }
        }

        /**
         * Start connection quality monitoring
         */
        startConnectionMonitoring() {
            // Monitor connection stats periodically
            this.statsInterval = setInterval(async () => {
                if (!this.peerConnection || this.callState !== 'connected') return;

                try {
                    const stats = await this.peerConnection.getStats();
                    let audioPacketsLost = 0;
                    let audioPacketsReceived = 0;
                    let roundTripTime = 0;

                    stats.forEach(report => {
                        if (report.type === 'inbound-rtp' && report.mediaType === 'audio') {
                            audioPacketsLost = report.packetsLost || 0;
                            audioPacketsReceived = report.packetsReceived || 0;
                            this.lastAudioActivity = Date.now();
                        }
                        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                            roundTripTime = report.currentRoundTripTime || 0;
                        }
                    });

                    // Calculate packet loss percentage
                    const totalPackets = audioPacketsReceived + audioPacketsLost;
                    const lossPercentage = totalPackets > 0 ? (audioPacketsLost / totalPackets) * 100 : 0;

                    // Update connection quality
                    if (lossPercentage > 10 || roundTripTime > 0.5) {
                        this.connectionQuality = 'poor';
                    } else if (lossPercentage > 3 || roundTripTime > 0.2) {
                        this.connectionQuality = 'slow';
                    } else {
                        this.connectionQuality = 'good';
                    }

                    // Check for audio inactivity (no packets received)
                    const timeSinceLastAudio = Date.now() - this.lastAudioActivity;
                    if (timeSinceLastAudio > this.audioActivityTimeout && this.callState === 'connected') {
                        console.warn(`⚠️ No audio activity for ${timeSinceLastAudio}ms`);
                        this.handleConnectionInterruption();
                    }

                } catch (e) {
                    console.warn('Stats collection error:', e);
                }
            }, 2000); // Check every 2 seconds
        }

        /**
         * Stop connection monitoring
         */
        stopConnectionMonitoring() {
            if (this.statsInterval) {
                clearInterval(this.statsInterval);
                this.statsInterval = null;
            }
            if (this.audioActivityChecker) {
                clearInterval(this.audioActivityChecker);
                this.audioActivityChecker = null;
            }
            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout);
                this.reconnectTimeout = null;
            }
        }


        showCallPopup(type) {
            if (!this.callPopup) return;

            console.log('showCallPopup called with type:', type);

            // Update avatar and name
            const avatarImg = this.callPopup.querySelector('#call-avatar img');
            const userName = this.callPopup.querySelector('#call-user-name');
            const callStatus = this.callPopup.querySelector('#call-status');
            const timerEl = this.callPopup.querySelector('#call-timer');
            const outgoingControls = this.callPopup.querySelector('#outgoing-controls');
            const incomingControls = this.callPopup.querySelector('#incoming-controls');

            console.log('Elements found:', {
                outgoingControls: !!outgoingControls,
                incomingControls: !!incomingControls
            });

            if (this.currentPeer) {
                if (avatarImg) avatarImg.src = this.currentPeer.profilePicture || 'anony.jpg';
                if (userName) userName.textContent = this.currentPeer.name || 'User';
            }

            // Toggle between incoming and outgoing controls
            if (type === 'incoming') {
                console.log('Showing INCOMING controls');
                if (callStatus) callStatus.textContent = 'Incoming voice call...';
                if (outgoingControls) {
                    outgoingControls.style.display = 'none';
                    outgoingControls.style.visibility = 'hidden';
                }
                if (incomingControls) {
                    incomingControls.style.display = 'flex';
                    incomingControls.style.visibility = 'visible';
                }
            } else {
                console.log('Showing OUTGOING controls');
                if (callStatus) callStatus.textContent = 'Calling...';
                if (outgoingControls) {
                    outgoingControls.style.display = 'flex';
                    outgoingControls.style.visibility = 'visible';
                }
                if (incomingControls) {
                    incomingControls.style.display = 'none';
                    incomingControls.style.visibility = 'hidden';
                }
            }

            if (timerEl) timerEl.style.display = 'none';

            // Show pulse animation
            const pulseRing = this.callPopup.querySelector('.call-pulse-ring');
            if (pulseRing) pulseRing.style.display = 'block';

            // Position popup at center initially
            this.callPopup.style.display = 'flex';
            this.callPopup.classList.remove('minimized'); // Reset minimized state
            this.callPopup.style.left = '50%';
            this.callPopup.style.top = '50%';
            this.callPopup.style.right = 'auto'; // Reset potential minimized styling
            this.callPopup.style.bottom = 'auto';
            this.callPopup.style.transform = 'translate(-50%, -50%)';
        }

        hideCallPopup() {
            if (this.callPopup) {
                this.callPopup.style.display = 'none';
            }
        }

        updateCallStatus(status) {
            const statusEl = document.getElementById('call-status');
            if (statusEl) statusEl.textContent = status;
        }

        toggleMute() {
            if (!this.localStream) return;

            this.isMuted = !this.isMuted;
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = !this.isMuted;
            });

            const muteBtn = document.getElementById('btn-mute');
            if (muteBtn) {
                const icon = muteBtn.querySelector('i.material-icons');
                if (icon) {
                    icon.textContent = this.isMuted ? 'mic_off' : 'mic';
                }
                muteBtn.classList.toggle('active', this.isMuted);
            }
        }

        toggleCamera() {
            // For audio-only calls, this just toggles the visual state
            const cameraBtn = document.getElementById('btn-camera');
            if (cameraBtn) {
                cameraBtn.classList.toggle('active');
            }
        }

        async toggleEmoji() {
            // Send heart emoji
            await this.sendCallEvent('emoji', { type: 'heart', content: '❤️' });

            // Show locally too
            this.showEmojiReaction('❤️');
        }

        async toggleRaiseHand() {
            this.isHandRaised = !this.isHandRaised;

            await this.sendCallEvent('raise-hand', { raised: this.isHandRaised });

            if (this.isHandRaised) {
                this.showNotification('You raised your hand', 'info');
                // Update button state (optional visual feedback)
                const handBtn = this.callPopup?.querySelector('.call-action-btn[title="Raise hand"]');
                if (handBtn) handBtn.style.color = '#00a884';
            } else {
                this.showNotification('You lowered your hand', 'info');
                const handBtn = this.callPopup?.querySelector('.call-action-btn[title="Raise hand"]');
                if (handBtn) handBtn.style.color = '';
            }
        }

        async sendCallEvent(type, payload) {
            if (!this.callId || !this.currentPeer) return;

            const eventData = {
                type: type,
                from: this.currentUser.uid,
                payload: payload,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };

            // Push to peer's events
            await firebase.database().ref(`calls/${this.currentPeer.uid}/${this.callId}/events`).push(eventData);
        }

        listenForCallEvents() {
            const eventsRef = firebase.database().ref(`calls/${this.currentUser.uid}/${this.callId}/events`);
            this.eventsListenerRef = eventsRef;

            eventsRef.on('child_added', (snapshot) => {
                const event = snapshot.val();
                if (!event) return;

                // Ignore old events (older than 10 seconds)
                if (Date.now() - event.timestamp > 10000) return;

                if (event.type === 'emoji') {
                    this.showEmojiReaction(event.payload.content);
                } else if (event.type === 'raise-hand') {
                    this.showHandRaised(event.payload.raised, this.currentPeer.name);
                }
            });
        }

        showEmojiReaction(emoji) {
            const container = this.callPopup?.querySelector('.call-popup-body');
            if (!container) return;

            const emojiEl = document.createElement('div');
            emojiEl.textContent = emoji;
            emojiEl.style.position = 'absolute';
            emojiEl.style.fontSize = '40px';
            emojiEl.style.bottom = '100px';
            emojiEl.style.left = '50%';
            emojiEl.style.transform = 'translateX(-50%) scale(0)';
            emojiEl.style.transition = 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            emojiEl.style.zIndex = '100';
            emojiEl.style.pointerEvents = 'none';

            container.appendChild(emojiEl);

            // Animate in
            requestAnimationFrame(() => {
                emojiEl.style.transform = 'translateX(-50%) scale(1.5)';
                emojiEl.style.bottom = '150px';
                emojiEl.style.opacity = '1';

                // Animate out
                setTimeout(() => {
                    emojiEl.style.transform = 'translateX(-50%) scale(2)';
                    emojiEl.style.opacity = '0';
                    setTimeout(() => emojiEl.remove(), 500);
                }, 1500);
            });
        }

        showHandRaised(isRaised, name) {
            let handIndicator = this.callPopup?.querySelector('.hand-raised-indicator');

            if (isRaised) {
                if (!handIndicator) {
                    handIndicator = document.createElement('div');
                    handIndicator.className = 'hand-raised-indicator';
                    handIndicator.innerHTML = `
                        <i class="material-icons">pan_tool</i>
                        <span>${name || 'User'} raised hand</span>
                    `;
                    handIndicator.style.position = 'absolute';
                    handIndicator.style.top = '80px';
                    handIndicator.style.left = '50%';
                    handIndicator.style.transform = 'translateX(-50%)';
                    handIndicator.style.background = 'rgba(0, 168, 132, 0.9)';
                    handIndicator.style.color = 'white';
                    handIndicator.style.padding = '8px 16px';
                    handIndicator.style.borderRadius = '20px';
                    handIndicator.style.display = 'flex';
                    handIndicator.style.alignItems = 'center';
                    handIndicator.style.gap = '8px';
                    handIndicator.style.fontSize = '14px';
                    handIndicator.style.zIndex = '10';
                    handIndicator.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';

                    const container = this.callPopup?.querySelector('.call-popup-body');
                    if (container) container.appendChild(handIndicator);
                }
                handIndicator.style.display = 'flex';
                this.showNotification(`${name || 'User'} raised their hand`, 'info');
            } else {
                if (handIndicator) {
                    handIndicator.style.display = 'none';
                }
            }
        }

        async shareScreen() {
            if (!this.peerConnection || this.callState !== 'connected') {
                this.showNotification('Must be in an active call to share screen', 'error');
                return;
            }

            // If already sharing, stop sharing
            if (this.screenStream) {
                this.stopScreenShare();
                return;
            }

            // Check if other person is already sharing
            if (this.remoteScreenActive) {
                this.showNotification('Cannot share screen while the other person is sharing', 'error');
                return;
            }

            try {
                // Get screen capture - video only, mic audio continues separately
                this.screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        cursor: 'always',
                        displaySurface: 'monitor'
                    },
                    audio: false // Don't capture system audio, mic audio continues for voice
                });

                console.log('Screen capture started');

                // Get video track from screen stream
                const screenTrack = this.screenStream.getVideoTracks()[0];

                // Add video track to peer connection (onnegotiationneeded will trigger renegotiation)
                const sender = this.peerConnection.addTrack(screenTrack, this.screenStream);
                this.screenSender = sender;

                // Listen for when user stops sharing via browser UI
                screenTrack.onended = () => {
                    console.log('Screen share stopped by user');
                    this.stopScreenShare();
                };

                // Update UI - show screen share preview
                this.showScreenSharePreview();

                // Update button state
                const shareBtn = this.callPopup?.querySelector('.call-action-btn[title="Share screen"]');
                if (shareBtn) {
                    shareBtn.classList.add('active');
                    shareBtn.style.background = '#00a884';
                }

                this.showNotification('Screen sharing started', 'info');

            } catch (error) {
                console.error('Screen share error:', error);
                if (error.name === 'NotAllowedError') {
                    this.showNotification('Screen sharing was cancelled', 'info');
                } else {
                    this.showNotification('Failed to share screen: ' + error.message, 'error');
                }
            }
        }

        stopScreenShare() {
            if (this.screenStream) {
                this.screenStream.getTracks().forEach(track => track.stop());
                this.screenStream = null;
            }

            // Remove track from peer connection
            if (this.screenSender && this.peerConnection) {
                try {
                    this.peerConnection.removeTrack(this.screenSender);
                } catch (e) {
                    console.warn('Error removing screen track:', e);
                }
                this.screenSender = null;
            }

            // Hide preview
            this.hideScreenSharePreview();

            // Update button state
            const shareBtn = this.callPopup?.querySelector('.call-action-btn[title="Share screen"]');
            if (shareBtn) {
                shareBtn.classList.remove('active');
                shareBtn.style.background = '';
            }

            this.showNotification('Screen sharing stopped', 'info');
        }

        showScreenSharePreview() {
            // Hide avatar area when showing local screen share (SynqX style)
            const avatarContainer = this.callPopup?.querySelector('.call-avatar-container');
            if (avatarContainer) avatarContainer.style.display = 'none';

            // Create preview container if it doesn't exist
            let preview = this.callPopup?.querySelector('.screen-share-preview');
            if (!preview) {
                preview = document.createElement('div');
                preview.className = 'screen-share-preview';
                preview.innerHTML = `
                    <div class="screen-share-label">
                        <i class="material-icons">screen_share</i>
                        <span>You are sharing your screen</span>
                    </div>
                    <video id="screen-preview" autoplay muted playsinline></video>
                    <button class="stop-share-btn" onclick="window.audioCallManager.stopScreenShare()">
                        Stop Sharing
                    </button>
                `;

                // Insert before the body content
                const body = this.callPopup?.querySelector('.call-popup-body');
                if (body) {
                    body.insertBefore(preview, body.firstChild);
                }
            }

            // Set video source
            const video = preview.querySelector('#screen-preview');
            if (video && this.screenStream) {
                video.srcObject = this.screenStream;
            }

            preview.style.display = 'flex';
        }

        hideScreenSharePreview() {
            // Show avatar again
            const avatarContainer = this.callPopup?.querySelector('.call-avatar-container');
            if (avatarContainer) avatarContainer.style.display = '';

            const preview = this.callPopup?.querySelector('.screen-share-preview');
            if (preview) {
                const video = preview.querySelector('#screen-preview');
                if (video) video.srcObject = null;
                preview.style.display = 'none';
            }
        }

        showRemoteScreenShare(stream, track) {
            // Set flag to prevent local screen share while remote is active
            this.remoteScreenActive = true;

            // Hide avatar area when showing remote screen (SynqX style)
            const avatarContainer = this.callPopup?.querySelector('.call-avatar-container');
            if (avatarContainer) avatarContainer.style.display = 'none';

            // Create remote screen share container if it doesn't exist
            let remoteScreen = this.callPopup?.querySelector('.remote-screen-share');
            if (!remoteScreen) {
                remoteScreen = document.createElement('div');
                remoteScreen.className = 'remote-screen-share';
                remoteScreen.innerHTML = `
                    <div class="remote-screen-label">
                        <i class="material-icons">screen_share</i>
                        <span>${this.currentPeer?.name || 'User'} is sharing their screen</span>
                    </div>
                    <video id="remote-screen-video" autoplay playsinline></video>
                `;

                // Insert at top of popup body
                const body = this.callPopup?.querySelector('.call-popup-body');
                if (body) {
                    body.insertBefore(remoteScreen, body.firstChild);
                }
            }

            // Set video source
            const video = remoteScreen.querySelector('#remote-screen-video');
            if (video) {
                video.srcObject = stream;
            }

            remoteScreen.style.display = 'flex';

            // Listen for track ended
            track.onended = () => {
                console.log('Remote screen share ended');
                this.hideRemoteScreenShare();
            };

            this.showNotification(`${this.currentPeer?.name || 'User'} is sharing their screen`, 'info');
        }

        hideRemoteScreenShare() {
            // Clear flag
            this.remoteScreenActive = false;

            // Show avatar again
            const avatarContainer = this.callPopup?.querySelector('.call-avatar-container');
            if (avatarContainer) avatarContainer.style.display = '';

            const remoteScreen = this.callPopup?.querySelector('.remote-screen-share');
            if (remoteScreen) {
                const video = remoteScreen.querySelector('#remote-screen-video');
                if (video) video.srcObject = null;
                remoteScreen.style.display = 'none';
            }
        }

        addParticipant() {
            this.showNotification('Group calls coming soon', 'info');
        }

        openMenu() {
            this.showNotification('More options coming soon', 'info');
        }

        toggleMinimize() {
            if (!this.callPopup) return;

            // Toggle class
            this.callPopup.classList.toggle('minimized');

            // If maximizing (removing minimized class), reset position to center
            if (!this.callPopup.classList.contains('minimized')) {
                this.callPopup.style.left = '50%';
                this.callPopup.style.top = '50%';
                this.callPopup.style.transform = 'translate(-50%, -50%)';
            } else {
                // Minimizing: Reset transform for drag logic
                this.callPopup.style.transform = 'none';
                // Default minimized position (bottom-rightish or where dragged)
                // We let it stay where it is or reset to default if needed. 
                // For now, let's reset to bottom right to be safe if it's the first time
                if (!this.callPopup.style.left || this.callPopup.style.left === '50%') {
                    this.callPopup.style.left = 'auto';
                    this.callPopup.style.right = '20px';
                    this.callPopup.style.top = 'auto';
                    this.callPopup.style.bottom = '20px';
                }
            }
        }



        endCall() {
            console.log('Ending call...');

            // Turn off Firebase listeners first to prevent race conditions
            if (this.callEndListenerRef) {
                this.callEndListenerRef.off();
                this.callEndListenerRef = null;
            }
            if (this.eventsListenerRef) {
                this.eventsListenerRef.off();
                this.eventsListenerRef = null;
            }

            // Stop screen sharing if active
            if (this.screenStream) {
                this.screenStream.getTracks().forEach(track => track.stop());
                this.screenStream = null;
                this.screenSender = null;
            }

            // Stop local stream
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop());
                this.localStream = null;
            }

            // Close peer connection
            if (this.peerConnection) {
                this.peerConnection.close();
                this.peerConnection = null;
            }

            // Cleanup Firebase - this will trigger the other party's listener
            if (this.callId && this.currentUser) {
                firebase.database().ref(`calls/${this.currentUser.uid}/${this.callId}`).remove();
                if (this.currentPeer) {
                    firebase.database().ref(`calls/${this.currentPeer.uid}/${this.callId}`).remove();
                }
            }

            // Save call log (I ended call)
            const type = this.isInitiator ? 'outgoing' : 'incoming';
            let status = 'completed';
            if (this.callDuration === 0) {
                status = this.isInitiator ? 'cancelled' : 'declined';
            }
            this.saveCallLog(type, status);

            // Stop timer and ringtone
            this.stopTimer();
            this.stopRingtone();

            // Reset state
            this.callState = 'idle';
            this.callId = null;
            this.isMuted = false;
            this.remoteScreenActive = false;
            this.isHandRaised = false;

            // Reset UI buttons for Camera/Mute
            const cameraBtn = document.getElementById('btn-camera');
            if (cameraBtn) cameraBtn.classList.remove('active');

            const muteBtn = document.getElementById('btn-mute');
            if (muteBtn) {
                muteBtn.classList.remove('active');
                const icon = muteBtn.querySelector('i.material-icons');
                if (icon) icon.textContent = 'mic';
            }

            // Hide screen share previews and restore avatar
            const screenPreview = this.callPopup?.querySelector('.screen-share-preview');
            const remoteScreen = this.callPopup?.querySelector('.remote-screen-share');
            const avatarContainer = this.callPopup?.querySelector('.call-avatar-container');
            const handIndicator = this.callPopup?.querySelector('.hand-raised-indicator');

            if (screenPreview) screenPreview.style.display = 'none';
            if (remoteScreen) remoteScreen.style.display = 'none';
            if (handIndicator) handIndicator.style.display = 'none';
            if (avatarContainer) avatarContainer.style.display = '';

            // Hide popup immediately
            this.hideCallPopup();
        }

        playRingtone() {
            const ringtone = document.getElementById('ringtone');
            if (ringtone) {
                ringtone.play().catch(() => { });
            }
        }

        stopRingtone() {
            const ringtone = document.getElementById('ringtone');
            if (ringtone) {
                ringtone.pause();
                ringtone.currentTime = 0;
            }
        }

        async saveCallLog(type, status) {
            if (!this.currentUser || !this.currentPeer) return;

            const logData = {
                peerId: this.currentPeer.uid,
                peerName: this.currentPeer.name,
                peerImage: this.currentPeer.profilePicture || 'anony.jpg',
                type: type, // 'incoming' or 'outgoing'
                status: status, // 'completed', 'missed', 'declined'
                duration: this.callDuration || 0,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };

            // Save to my history
            await firebase.database().ref(`calls_history/${this.currentUser.uid}`).push(logData);
        }

        loadCallHistory() {
            if (!this.currentUser) return;
            const historyRef = firebase.database().ref(`calls_history/${this.currentUser.uid}`).limitToLast(50);
            const listContainer = document.getElementById('calls-list');

            if (!listContainer) return;

            historyRef.on('value', (snapshot) => {
                const logs = [];
                snapshot.forEach(child => {
                    logs.push({ id: child.key, ...child.val() });
                });

                // Sort by timestamp desc
                logs.sort((a, b) => b.timestamp - a.timestamp);

                if (logs.length === 0) {
                    listContainer.innerHTML = `
                        <div class="empty-state" style="text-align: center; padding: 20px; color: var(--text-secondary);">
                            <i class="material-icons" style="font-size: 48px; opacity: 0.5; margin-bottom: 10px;">history</i>
                            <p>No recent calls</p>
                        </div>
                    `;
                    return;
                }

                listContainer.innerHTML = logs.map(log => {
                    const date = new Date(log.timestamp);
                    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const dateStr = date.toLocaleDateString();

                    const icon = log.type === 'incoming'
                        ? (log.status === 'missed' ? 'call_missed' : 'call_received')
                        : 'call_made';

                    const color = log.status === 'missed' ? '#ef4444' : (log.status === 'declined' ? '#f59e0b' : '#00a884');

                    const durationText = log.duration > 0
                        ? `${Math.floor(log.duration / 60)}:${(log.duration % 60).toString().padStart(2, '0')}`
                        : '';

                    return `
                        <div class="call-log-item" style="display: flex; align-items: center; padding: 12px; border-bottom: 1px solid rgba(134, 150, 160, 0.15);">
                            <img src="${log.peerImage}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; margin-right: 12px;">
                            <div style="flex: 1;">
                                <div style="color: var(--text-primary, #e9edef); font-weight: 500; font-size: 16px;">${log.peerName}</div>
                                <div style="display: flex; align-items: center; gap: 4px; color: var(--text-secondary, #8696a0); font-size: 13px; margin-top: 2px;">
                                    <i class="material-icons" style="font-size: 14px; color: ${color};">${icon}</i>
                                    <span>${log.status === 'missed' ? 'Missed' : (log.type === 'incoming' ? 'Incoming' : 'Outgoing')}</span>
                                    ${durationText ? `<span>• ${durationText}</span>` : ''}
                                </div>
                            </div>
                            <div style="color: var(--text-secondary, #8696a0); font-size: 12px;">
                                <div>${dateStr}</div>
                                <div>${timeStr}</div>
                            </div>
                        </div>
                    `;
                }).join('');
            });
        }

        toggleEmoji() {
            // Check if reaction bar already exists
            let reactionBar = this.callPopup?.querySelector('.call-reaction-bar');
            if (reactionBar) {
                // Toggle visibility
                reactionBar.style.display = reactionBar.style.display === 'none' ? 'flex' : 'none';
                return;
            }

            // Create it
            reactionBar = document.createElement('div');
            reactionBar.className = 'call-reaction-bar';
            reactionBar.innerHTML = `
                <div class="reaction-item" onclick="window.audioCallManager.sendReaction('❤️')">❤️</div>
                <div class="reaction-item" onclick="window.audioCallManager.sendReaction('👍')">👍</div>
                <div class="reaction-item" onclick="window.audioCallManager.sendReaction('😂')">😂</div>
                <div class="reaction-item" onclick="window.audioCallManager.sendReaction('😮')">😮</div>
                <div class="reaction-item" onclick="window.audioCallManager.sendReaction('😢')">😢</div>
                <div class="reaction-item" onclick="window.audioCallManager.sendReaction('👏')">👏</div>
            `;

            // Add styles inline or via class
            Object.assign(reactionBar.style, {
                position: 'absolute',
                bottom: '100px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(31, 44, 52, 0.95)',
                padding: '8px 16px',
                borderRadius: '50px',
                display: 'flex',
                gap: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                backdropFilter: 'blur(10px)',
                zIndex: '100',
                border: '1px solid rgba(134, 150, 160, 0.2)'
            });

            // Make items clickable
            const items = reactionBar.querySelectorAll('.reaction-item');
            items.forEach(item => {
                Object.assign(item.style, {
                    fontSize: '24px',
                    cursor: 'pointer',
                    transition: 'transform 0.2s',
                    userSelect: 'none'
                });
                item.onmouseover = () => item.style.transform = 'scale(1.2)';
                item.onmouseout = () => item.style.transform = 'scale(1)';
            });

            const container = this.callPopup?.querySelector('.call-popup-body');
            if (container) container.appendChild(reactionBar);
        }

        async sendReaction(emoji) {
            await this.sendCallEvent('emoji', { type: 'reaction', content: emoji });
            this.showEmojiReaction(emoji);

            // Hide bar after selection
            const reactionBar = this.callPopup?.querySelector('.call-reaction-bar');
            if (reactionBar) reactionBar.style.display = 'none';
        }

        showNotification(message, type = 'info') {
            if (window.fireflyChat && window.fireflyChat.showNotification) {
                window.fireflyChat.showNotification(message, type);
            } else {
                console.log(`[${type}] ${message}`);
            }
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.audioCallManager = new AudioCallManager();
            window.FireChatAudioCall = true;
        });
    } else {
        window.audioCallManager = new AudioCallManager();
        window.FireChatAudioCall = true;
    }

})();
