/* Audio Recording & Playback Logic for FireFly Chat */

let mediaRecorder = null;
let audioChunks = [];
let recordStartTime = 0;
let recordInterval = null;

// Toggle Recording (Started by Mic Button)
async function toggleAudioRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        // Should ignore or stop?
        return;
    }

    // Check Permissions
    try {
        const supportedType = MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4;codecs=mp4a.40.2'
            : 'audio/webm;codecs=opus';

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        startRecording(stream, supportedType);
    } catch (err) {
        console.error('Mic permission denied', err);
        // Show notification if possible
        if (window.fireflyChat) window.fireflyChat.showNotification('Microphone access required', 'error');
        else alert('Microphone access required');
    }
}

function startRecording(stream, mimeType) {
    try {
        mediaRecorder = new MediaRecorder(stream, { mimeType });
    } catch (e) {
        console.warn('MimeType not supported, falling back to default', mimeType);
        mediaRecorder = new MediaRecorder(stream);
    }
    audioChunks = [];

    mediaRecorder.ondataavailable = event => {
        audioChunks.push(event.data);
    };

    mediaRecorder.start();
    recordStartTime = Date.now();

    // Show UI
    const ui = document.getElementById('recording-ui');
    const micBtn = document.getElementById('mic-btn');
    if (ui) ui.style.display = 'flex';
    if (micBtn) {
        micBtn.classList.add('recording');
        micBtn.style.display = 'none'; // Hide main button while recording overlay is active
    }

    updateTimer();
    recordInterval = setInterval(updateTimer, 1000);
}

function updateTimer() {
    const diff = Math.floor((Date.now() - recordStartTime) / 1000);
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    const timer = document.getElementById('recording-timer');
    if (timer) timer.textContent = `${m}:${s.toString().padStart(2, '0')}`;
}

async function stopAndSendRecording() {
    if (!mediaRecorder) return;

    // Current duration string
    const timerEl = document.getElementById('recording-timer');
    const durationStr = timerEl ? timerEl.textContent : "0:00";

    mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, {
            type: MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm'
        });

        if (audioBlob.size < 500) {
            console.warn('⚠️ Audio recording too small, likely empty.');
            if (window.fireflyChat) window.fireflyChat.showNotification('Recording failed: No sound detected', 'warning');
            resetRecordingUI();
            return;
        }

        await uploadAndSendAudio(audioBlob, durationStr);
    };

    mediaRecorder.stop();
    resetRecordingUI();
}

function cancelRecording() {
    if (mediaRecorder) {
        mediaRecorder.onstop = null; // Prevent send
        mediaRecorder.stop();
    }
    resetRecordingUI();
}

function resetRecordingUI() {
    clearInterval(recordInterval);
    const ui = document.getElementById('recording-ui');
    if (ui) ui.style.display = 'none';

    const micBtn = document.getElementById('mic-btn');
    if (micBtn) {
        micBtn.classList.remove('recording');
        micBtn.style.display = 'flex'; // Show it back
    }

    // Stop tracks to release mic
    if (mediaRecorder && mediaRecorder.stream) {
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    mediaRecorder = null;
    audioChunks = [];
}

async function uploadAndSendAudio(blob, durationStr) {
    // Check if chat is active
    if (!window.fireflyChat || !window.fireflyChat.currentPeer) {
        console.warn('No active chat');
        return;
    }

    // Show simple notification
    window.fireflyChat.showNotification('Processing audio...', 'info');

    try {
        // Convert Blob to Base64 (Data URL) to bypass CORS issues with Storage
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            const base64Audio = reader.result;

            console.log('Voice note converted to base64, size:', Math.round(base64Audio.length / 1024), 'KB');

            // Send logic
            if (window.fireflyChat.sendAudioMessage) {
                await window.fireflyChat.sendAudioMessage(base64Audio, durationStr);
            } else {
                console.error('sendAudioMessage method missing');
            }
        };
    } catch (e) {
        console.error('Audio processing failed', e);
        window.fireflyChat.showNotification('Failed to process audio', 'error');
    }
}

// Global functions for HTML access
window.toggleAudioRecording = toggleAudioRecording;
window.stopAndSendRecording = stopAndSendRecording;
window.cancelRecording = cancelRecording;
