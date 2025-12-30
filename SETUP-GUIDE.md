# 🚀 Quick Setup Guide for FireFly-NOX

## Step-by-Step Firebase Configuration

### 1. Create Firebase Project (5 minutes)

1. Visit [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project" or "Create a Project"
3. **Project Name**: `FireFly-NOX` (or your preferred name)
4. **Google Analytics**: Optional (you can enable or disable)
5. Click "Create Project" and wait for setup to complete

**Important Note to User**: Remember to add your Firebase configuration credentials to `firebase-config.js`!

---

### 2. Enable Required Services

#### A. Realtime Database
1. In Firebase Console sidebar, click **"Realtime Database"**
2. Click **"Create Database"**
3. **Location**: Choose closest to your target audience
   - US: `us-central1`
   - Europe: `europe-west1`
   - Asia: `asia-southeast1`
4. **Security Rules**: Start in **"Test mode"** (we'll update later)
5. Click **"Enable"**

#### B. Authentication
1. In Firebase Console sidebar, click **"Authentication"**
2. Click **"Get Started"**
3. Go to **"Sign-in method"** tab
4. Enable **"Email/Password"**
   - Toggle the switch ON
   - Click "Save"
5. (Optional) Enable other providers:
   - Google
   - Facebook
   - Apple
   - etc.

#### C. Storage (Optional - for future file uploads)
1. In Firebase Console sidebar, click **"Storage"**
2. Click **"Get Started"**
3. Start in **"Test mode"**
4. Click **"Done"**

---

### 3. Get Your Firebase Configuration

1. In Firebase Console, click the **⚙️ (gear) icon** next to "Project Overview"
2. Select **"Project settings"**
3. Scroll down to **"Your apps"** section
4. Click the **</>** (web) icon to add a web app
5. **App nickname**: `FireFly-NOX Web`
6. **Check** "Also set up Firebase Hosting" (optional)
7. Click **"Register app"**
8. **COPY** the firebaseConfig object shown in the code snippet

Example:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyA...",
  authDomain: "fireflyapplication01.firebaseapp.com",
  databaseURL: "https://fireflyapplication01-default-rtdb.firebaseio.com",
  projectId: "fireflyapplication01",
  storageBucket: "fireflyapplication01.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abc..."
};
```

---

### 4. Update Your Project

1. Open `firebase-config.js` in your code editor
2. **Replace** the placeholder values with your Firebase configuration:

```javascript
// Replace these values with your actual Firebase credentials
const firebaseConfig = {
    apiKey: "YOUR_API_KEY_HERE",           // Replace
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

3. **Save** the file

---

### 5. Set Up Security Rules  

#### Realtime Database Rules

1. Go to **Realtime Database** > **Rules** tab
2. **Replace** the rules with the following:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null",
        ".write": "$uid === auth.uid",
        "profile": {
          ".read": true,
          "profilePicture": {
            ".validate": "newData.val().length < 500000"
          }
        },
        "status": {
          ".read": true
        }
      }
    },
    "messages": {
      "$userId": {
        "$otherUserId": {
          ".read": "$userId === auth.uid",
          ".write": "$userId === auth.uid"
        }
      }
    }
  }
}
```

3. Click **"Publish"**

#### Storage Rules (if enabled)

1. Go to **Storage** > **Rules** tab
2. **Replace** with:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /profile-pictures/{userId}/{fileName} {
      allow read: if true;
      allow write: if request.auth != null 
                   && request.auth.uid == userId
                   && request.resource.size < 5 * 1024 * 1024;
    }
    match /chat-media/{userId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId
                   && request.resource.size < 10 * 1024 * 1024;
    }
  }
}
```

3. Click **"Publish"**

---

### 6. Test Your Setup

1. **Serve the application locally**:
   ```bash
   # Using Python 3
   python -m http.server 8000
   
   # OR using Node.js
   npx serve .
   
   # OR using PHP
   php -S localhost:8000
   ```

2. **Open in browser**:
   ```
   http://localhost:8000/noxlogin.html
   ```

3. **Create a test account**:
   - Sign up with email and password
   - Complete profile setup
   - Upload a test profile picture

4. **Verify in Firebase Console**:
   - Check **Authentication** for new user
   - Check **Realtime Database** for user data
   - Confirm profile picture stored (as base64 in database)

---

### 7. Common Issues & Solutions

#### ❌ "Firebase is not defined"
- **Solution**: Check that Firebase CDN scripts are loaded before your scripts
- Verify internet connection
- Check browser console for script loading errors

#### ❌ "Permission denied" errors
- **Solution**: Review Realtime Database security rules
- User must be authenticated
- UID must match in the database path

#### ❌ Profile picture not saving
- **Solution**: Check file size (< 5MB)
- Verify correct file type (JPG, PNG, GIF)
- Check browser console for errors
- Ensure user is logged in

#### ❌ "Cannot read property 'database' of undefined"
- **Solution**: Firebase config may be incorrect
- Verify all config values are correct
- Check network tab for Firebase initialization errors

#### ❌ Messages not syncing
- **Solution**: Check both users have internet connection
- Verify they're connected as peers
- Check Realtime Database rules allow reads/writes

---

### 8. Production Deployment Checklist

Before deploying to production:

- [ ] Update Database rules to production mode
- [ ] Enable rate limiting to prevent abuse
- [ ] Set up proper authentication flow
- [ ] Enable HTTPS (required for many features)
- [ ] Configure CORS if needed
- [ ] Set up Firebase Hosting or your preferred host
- [ ] Test on multiple devices and browsers
- [ ] Set up error logging/monitoring
- [ ] Configure backup strategy
- [ ] Review and optimize security rules

---

### 9. Firebase Hosting (Optional)

Deploy your app to Firebase Hosting:

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize hosting
firebase init hosting

# Select your project
# Set public directory to current directory
# Configure as single-page app: No
# Set up automatic builds: No

# Deploy
firebase deploy --only hosting
```

Your app will be live at: `https://your-project-id.web.app`

---

### 10. Next Steps

✅ **Completed Setup!** Your FireFly-NOX chat is now ready to use.

**Recommended Enhancements:**
1. Set up email verification
2. Add password reset functionality
3. Implement user blocking/reporting
4. Add message encryption
5. Set up push notifications
6. Create admin dashboard
7. Add analytics tracking
8. Implement file upload to Storage (instead of base64)

---

## 📞 Need Help?

- **Firebase Documentation**: https://firebase.google.com/docs
- **Firebase Community**: https://firebase.google.com/community
- **Stack Overflow**: Tag your questions with `firebase`

---

## 🎉 Congratulations!

You've successfully set up FireFly-NOX with Firebase! 

**Your app now has:**
- ✅ Real-time message routing
- ✅ Secure user authentication
- ✅ Profile picture storage
- ✅ Online status tracking
- ✅ Message history persistence
- ✅ Multi-device sync
- ✅ Scalable cloud backend

**Start chatting and enjoy your modern communication platform!** 🚀
