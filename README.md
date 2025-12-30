# FireFly-NOX Chat Application

A modern, professional real-time chat application with Firebase integration, peer-to-peer connectivity, and comprehensive responsive design for desktop, tablet, and mobile devices.

## ✨ Features

### Core Features
- 🔥 **Firebase Integration** - Real-time message routing and storage
- 👥 **Peer-to-Peer Chat** - Direct connections using PeerJS
- 📸 **Profile Pictures** - Upload, compress to base64, store in Firebase
- 💬 **Real-time Messaging** - Instant message delivery
- 📱 **Fully Responsive** - Optimized for all screen sizes
- 🎨 **Modern UI/UX** - Glassmorphism, gradients, and smooth animations
- 🌙 **Dark Mode Support** - Automatic theme adaptation
- ♿ **Accessible** - WCAG compliant with keyboard navigation
- 📴 **Offline Support** - Works offline with service worker (PWA ready)

### Advanced Features
- **Message History** - Persistent chat history via Firebase
- **Online Status** - Real-time user presence indicators
- **Message Actions** - Edit, delete, and copy messages
- **File Sharing** - Images and videos with preview
- **Voice/Video Calls** - P2P audio/video calling (in development)
- **Custom Themes** - Personalize message colors and wallpapers
- **Multi-device Sync** - Access chats from any device

## 🚀 Setup Instructions

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Firebase account (free)
- Basic web server (for local development)

### Firebase Setup

1. **Create Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Click "Add Project"
   - Name your project (e.g., "FireFly-NOX")
   - Follow the setup wizard

2. **Enable Firebase Services**
   
   **Realtime Database:**
   - In Firebase Console, go to "Realtime Database"
   - Click "Create Database"
   - Start in **test mode** (for development)
   - Location: Choose closest to your users

   **Authentication:**
   - Go to "Authentication" > "Sign-in method"
   - Enable "Email/Password"
   - (Optional) Enable Google, Facebook, etc.

   **Storage** (for advanced file sharing):
   - Go to "Storage"
   - Click "Get Started"
   - Start in **test mode**

3. **Configure Firebase**
   - In Firebase Console, go to Project Settings (⚙️ icon)
   - Scroll to "Your apps" section
   - Click web icon (</>) to add a web app
   - Register app with nickname "FireFly-NOX Web"
   - Copy the Firebase configuration code

4. **Update Firebase Config**
   - Open `firebase-config.js`
   - Replace the placeholder config with your Firebase credentials:

   ```javascript
   const firebaseConfig = {
       apiKey: "YOUR_API_KEY",
       authDomain: "your-project.firebaseapp.com",
       databaseURL: "https://your-project-default-rtdb.firebaseio.com",
       projectId: "your-project-id",
       storageBucket: "your-project.appspot.com",
       messagingSenderId: "123456789",
       appId: "your-app-id"
   };
   ```

5. **Set Firebase Security Rules**

   **Realtime Database Rules:**
   ```json
   {
     "rules": {
       "users": {
         "$uid": {
           ".read": "auth != null",
           ".write": "$uid === auth.uid",
           "profile": {
             ".read": true
           }
         }
       },
       "messages": {
         "$userId": {
           ".read": "$userId === auth.uid",
           ".write": "$userId === auth.uid"
         }
       }
     }
   }
   ```

   **Storage Rules:**
   ```
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /profile-pictures/{userId}/{allPaths=**} {
         allow read: if true;
         allow write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```

### Local Development

1. **Clone or Download**
   ```bash
   git clone <your-repo-url>
   cd firechat
   ```

2. **Serve Locally**
   
   Using Python:
   ```bash
   python -m http.server 8000
   ```

   Using Node.js:
   ```bash
   npx serve .
   ```

   Using VS Code Live Server:
   - Install "Live Server" extension
   - Right-click `chat.html` > "Open with Live Server"

3. **Access Application**
   - Open browser
   - Navigate to `http://localhost:8000/chat.html?uid=your-user-id`
   - Replace `your-user-id` with actual user ID from login

## 📱 Responsive Design

### Desktop (> 1024px)
- Full-featured interface
- Side-by-side chat layout
- Advanced controls and settings
- Keyboard shortcuts

### Tablet (768px - 1024px)
- Optimized touch targets
- Collapsible sidebars
- Responsive grid layout
- Portrait and landscape support

### Mobile (< 768px)
- Stack vertical layout
- Bottom navigation
- Swipe gestures
- Optimized for one-handed use

### Extra Small (< 375px)
- Compact UI elements
- Minimal text
- Essential features only

## 🎨 Customization

### Profile Customization
1. Click profile icon in header
2. Upload profile picture (auto-compressed to 400x400, < 500KB)
3. Choose custom message colors
4. Select chat wallpaper

### Theme Colors
Edit CSS variables in `:root` selector:
```css
:root {
    --primary-color: #667eea;
    --accent-color: #fd746c;
    /* customize more... */
}
```

## 🔒 Security Features

- **End-to-End Encryption**: P2P messages encrypted
- **Authentication Required**: Firebase auth protects data
- **Secure Storage**: Base64 images stored securely
- **HTTPS Only**: Production deployment requires HTTPS
- **XSS Protection**: Input sanitization
- **CSRF Tokens**: Form submissions protected

## 🌐 Browser Support

| Browser | Version |
|---------|---------|
| Chrome | 90+ |
| Firefox | 88+ |
| Safari | 14+ |
| Edge | 90+ |
| Opera | 76+ |

## 📂 Project Structure

```
firechat/
├── chat.html              # Main chat interface
├── chat.css               # Core styles
├── chat-enhancements.css  # Modern responsive enhancements
├── chat.js                # Main application logic
├── firebase-config.js     # Firebase configuration
├── message-router.js      # Message routing system
├── profile-manager.js     # Profile & image management
├── noxlogin.html         # Login/signup page
├── script.js              # Utility functions
├── auth-check.js          # Authentication middleware
├── wall1-7.jpg            # Wallpaper options
└── anony.jpg              # Default profile picture
```

## 🔧 API Reference

### Profile Manager

```javascript
// Upload profile picture
await profileManager.uploadProfilePicture(file);

// Fetch profile
await profileManager.fetchProfile(userId);

// Save complete profile
await profileManager.saveProfile(name, profilePicFile);
```

### Message Router

```javascript
// Send message
await messageRouter.sendMessage(recipientId, message);

// Listen for messages
messageRouter.listenForMessages(senderId, callback);

// Get message history
await messageRouter.getMessageHistory(userId, limit);

// Update online status
await messageRouter.updateOnlineStatus(true);
```

## 🛠️ Troubleshooting

### Firebase Connection Issues
- Verify Firebase config is correct
- Check network connectivity
- Ensure Firebase services are enabled
- Review browser console for errors

### Profile Picture Not Uploading
- Check file size (< 5MB)
- Verify file format (JPG, PNG, GIF)
- Check browser console for errors
- Ensure user is authenticated

### Messages Not Sending
- Verify peer connection established
- Check Firebase Realtime Database rules
- Ensure both users are online
- Review network tab in dev tools

### Mobile Display Issues
- Clear browser cache
- Check viewport meta tag
- Verify CSS enhancements loaded
- Test in multiple browsers

## 📈 Performance Tips

1. **Optimize Images**: Already compressed to 400x400
2. **Enable Gzip**: Configure server compression
3. **Use CDN**: Host static assets on CDN
4. **Lazy Load**: Images load on demand
5. **Cache**: Service worker caches assets

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open pull request

## 📄 License

This project is licensed under the MIT License.

## 👨‍💻 Developer

Created with ❤️ for modern web communication

## 🔮 Roadmap

- [ ] Video calling implementation
- [ ] Group chat support
- [ ] Message encryption
- [ ] Voice messages
- [ ] GIF support
- [ ] Message reactions
- [ ] Read receipts
- [ ] Typing indicators
- [ ] Push notifications
- [ ] Desktop app (Electron)

## 📞 Support

For issues or questions:
- Open GitHub issue
- Check documentation
- Review FAQ section

---

**FireFly-NOX** - Connecting people, one message at a time. 🚀
