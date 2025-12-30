// Profile Manager - Handle profile pictures with Firebase Storage and base64
class ProfileManager {
    constructor() {
        this.database = window.firebaseDB || firebase.database();
        this.currentUserId = null;
        this.maxImageSize = 500 * 1024; // 500KB max for base64 storage
        this.init();
    }

    init() {
        const urlParams = new URLSearchParams(window.location.search);
        this.currentUserId = urlParams.get('uid') || localStorage.getItem('userId');
        console.log('Profile Manager initialized for user:', this.currentUserId);
    }

    // Compress and convert image to base64
    async imageToBase64(file) {
        return new Promise((resolve, reject) => {
            // Check file size
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                reject(new Error('Image size too large. Please select an image under 5MB.'));
                return;
            }

            const reader = new FileReader();

            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // Create canvas for compression
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Calculate new dimensions (max 400x400)
                    const maxDimension = 400;
                    if (width > height && width > maxDimension) {
                        height = (height / width) * maxDimension;
                        width = maxDimension;
                    } else if (height > maxDimension) {
                        width = (width / height) * maxDimension;
                        height = maxDimension;
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Convert to base64 with compression
                    let quality = 0.8;
                    let base64 = canvas.toDataURL('image/jpeg', quality);

                    // Further compress if still too large
                    while (base64.length > this.maxImageSize && quality > 0.1) {
                        quality -= 0.1;
                        base64 = canvas.toDataURL('image/jpeg', quality);
                    }

                    console.log(`Image compressed: ${(base64.length / 1024).toFixed(2)}KB`);
                    resolve(base64);
                };

                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = e.target.result;
            };

            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    // Upload profile picture
    async uploadProfilePicture(file) {
        try {
            if (!this.currentUserId) {
                throw new Error('User ID not available');
            }

            // Show loading indicator
            this.showLoading(true);

            // Convert image to base64
            const base64Image = await this.imageToBase64(file);

            // Save to Firebase at root level (not nested in /profile/)
            await this.database.ref(`users/${this.currentUserId}`).update({
                profilePicture: base64Image,
                profilePictureUpdated: firebase.database.ServerValue.TIMESTAMP
            });

            // Also save to localStorage for offline access
            localStorage.setItem('userProfilePic', base64Image);

            // Update UI
            this.updateProfilePictureUI(base64Image);

            this.showLoading(false);
            console.log('Profile picture uploaded successfully');

            return { success: true, base64: base64Image };
        } catch (error) {
            this.showLoading(false);
            console.error('Error uploading profile picture:', error);
            return { success: false, error: error.message };
        }
    }

    // Fetch profile picture from Firebase
    async fetchProfilePicture(userId = null) {
        try {
            const targetUserId = userId || this.currentUserId;

            if (!targetUserId) {
                throw new Error('User ID not available');
            }

            const snapshot = await this.database.ref(`users/${targetUserId}/profilePicture`).once('value');
            const base64Image = snapshot.val();

            if (base64Image) {
                console.log('Profile picture fetched from Firebase');

                // If it's our own picture, save to localStorage
                if (!userId || userId === this.currentUserId) {
                    localStorage.setItem('userProfilePic', base64Image);
                    this.updateProfilePictureUI(base64Image);
                }

                return { success: true, base64: base64Image };
            } else {
                console.log('No profile picture found in Firebase');
                return { success: false, error: 'No profile picture found' };
            }
        } catch (error) {
            console.error('Error fetching profile picture:', error);
            return { success: false, error: error.message };
        }
    }

    // Update profile picture in UI
    updateProfilePictureUI(base64Image) {
        const profileImages = document.querySelectorAll('.profile-icon img, #profile-image, #preview-image');
        profileImages.forEach(img => {
            if (img) {
                img.src = base64Image;
            }
        });
    }

    // Save complete profile
    async saveProfile(name, profilePicFile = null) {
        try {
            if (!this.currentUserId) {
                throw new Error('User ID not available');
            }

            const profileData = {
                name: name,
                lastUpdated: firebase.database.ServerValue.TIMESTAMP
            };

            // If profile picture provided, upload it first
            if (profilePicFile) {
                await this.uploadProfilePicture(profilePicFile);
                // No need to add to profileData as uploadProfilePicture saves it to Firebase
            }

            // Save name and metadata
            await this.database.ref(`users/${this.currentUserId}`).update(profileData);

            // Save name to localStorage
            localStorage.setItem('userName', name);

            console.log('Profile saved successfully');
            return { success: true };
        } catch (error) {
            console.error('Error saving profile:', error);
            return { success: false, error: error.message };
        }
    }

    // Fetch complete profile
    async fetchProfile(userId = null) {
        try {
            const targetUserId = userId || this.currentUserId;

            if (!targetUserId) {
                throw new Error('User ID not available');
            }

            const snapshot = await this.database.ref(`users/${targetUserId}`).once('value');
            const profile = snapshot.val();

            if (profile) {
                console.log('Profile fetched from Firebase');

                // If it's our own profile, save to localStorage
                if (!userId || userId === this.currentUserId) {
                    if (profile.name) {
                        localStorage.setItem('userName', profile.name);
                    }
                    if (profile.profilePicture) {
                        localStorage.setItem('userProfilePic', profile.profilePicture);
                        this.updateProfilePictureUI(profile.profilePicture);
                    }
                }

                return { success: true, profile };
            } else {
                console.log('No profile found in Firebase');
                return { success: false, error: 'No profile found' };
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
            return { success: false, error: error.message };
        }
    }

    // Show/hide loading indicator
    showLoading(show) {
        let loader = document.getElementById('profile-upload-loader');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'profile-upload-loader';
            loader.innerHTML = `
                <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                     background: rgba(0,0,0,0.8); color: white; padding: 20px 40px; 
                     border-radius: 10px; z-index: 10000; display: none;">
                    <div class="loader" style="border: 3px solid #f3f3f3; border-top: 3px solid #667eea; 
                         border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; 
                         margin: 0 auto 10px;"></div>
                    <p style="margin: 0; text-align: center;">Uploading...</p>
                </div>
            `;
            document.body.appendChild(loader);
        }

        const loaderDiv = loader.querySelector('div');
        if (loaderDiv) {
            loaderDiv.style.display = show ? 'block' : 'none';
        }
    }
}

// Initialize profile manager globally
window.profileManager = new ProfileManager();
console.log('Profile Manager loaded successfully');

// Add spin animation if not present
if (!document.getElementById('profile-manager-styles')) {
    const style = document.createElement('style');
    style.id = 'profile-manager-styles';
    style.innerHTML = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
}
