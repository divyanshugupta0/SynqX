# 📝 Firebase Configuration Template

## Instructions
1. Copy this file or create a new `firebase-config.js`
2. Replace all placeholder values with your actual Firebase credentials
3. Find your credentials in Firebase Console > Project Settings > Your Apps > Web App

---

## Configuration File

```javascript
// Firebase Configuration
// ⚠️ IMPORTANT: Replace ALL values below with your actual Firebase project credentials

const firebaseConfig = {
    // API Key - Find in Project Settings > General
    apiKey: "YOUR_ACTUAL_API_KEY_HERE",
    
    // Auth Domain - Usually your-project-id.firebaseapp.com
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    
    // Database URL - Find in Realtime Database section
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    
    // Project ID - Your Firebase project identifier
    projectId: "YOUR_PROJECT_ID",
    
    // Storage Bucket - Usually your-project-id.appspot.com
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    
    // Messaging Sender ID - For Firebase Cloud Messaging
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    
    // App ID - Your web app identifier
    appId: "YOUR_APP_ID",
    
    // Measurement ID (Optional - for Google Analytics)
    // measurementId: "G-XXXXXXXXXX"
};

// Initialize Firebase
if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        console.log('✅ Firebase initialized successfully');
    } else {
        firebase.app();
        console.log('✅ Using existing Firebase instance');
    }
} else {
    console.error('❌ Firebase SDK not loaded. Check your internet connection and Firebase CDN links.');
}

// Export Firebase references for use throughout the app
const database = firebase.database();
const auth = firebase.auth();
const storage = firebase.storage();

// Make available globally
window.firebaseDB = database;
window.firebaseAuth = auth;
window.firebaseStorage = storage;

console.log('Firebase Database initialized');
console.log('Firebase Auth initialized');
console.log('Firebase Storage initialized');
```

---

## Example with Real Values

**This is just an EXAMPLE - DO NOT USE THESE VALUES**

```javascript
const firebaseConfig = {
    apiKey: "AIzaSyBpQiRWhGcmxFP-aJJAl5aaVoHRlLqpilQ",
    authDomain: "firechat-app-2024.firebaseapp.com",
    databaseURL: "https://firechat-app-2024-default-rtdb.firebaseio.com",
    projectId: "firechat-app-2024",
    storageBucket: "firechat-app-2024.appspot.com",
    messagingSenderId: "867530942015",
    appId: "1:867530942015:web:f7a8b9c0d1e2f3a4b5c6d7",
    measurementId: "G-ABCDEFGHIJ"
};
```

---

## Where to Find Your Credentials

### Step-by-Step:

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. **Select your project**: Click on your project card
3. **Open Project Settings**: 
   - Click the ⚙️ gear icon next to "Project Overview"
   - Select "Project settings"
4. **Scroll to "Your apps"**: Look for the web app section
5. **View Config**: Click on the config radio button or "Config" button
6. **Copy Values**: Copy each value to your `firebase-config.js`

### Finding Specific Values:

- **apiKey**: Project Settings > General > Web API Key
- **authDomain**: Project Settings > General > (shown in SDK snippet)
- **databaseURL**: Realtime Database > Data tab (look at the URL)
- **projectId**: Project Settings > General > Project ID
- **storageBucket**: Storage > Files tab (look at the URL)
- **messagingSenderId**: Project Settings > Cloud Messaging > Sender ID
- **appId**: Project Settings > Your apps > App ID

---

## Security Best Practices

### ⚠️ Important Security Notes:

1. **API Key in Frontend is OK**: 
   - Firebase API keys are designed to be public
   - Security comes from Firebase Security Rules
   - Never expose private keys or service account credentials

2. **Use Environment Variables** (For production):
   ```javascript
   const firebaseConfig = {
       apiKey: process.env.FIREBASE_API_KEY,
       authDomain: process.env.FIREBASE_AUTH_DOMAIN,
       databaseURL: process.env.FIREBASE_DATABASE_URL,
       projectId: process.env.FIREBASE_PROJECT_ID,
       storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
       messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
       appId: process.env.FIREBASE_APP_ID
   };
   ```

3. **Protect with Security Rules**:
   - Always set up proper Realtime Database rules
   - Implement user authentication
   - Validate data on backend

4. **Restrict API Key** (Optional but recommended):
   - Go to Google Cloud Console
   - Navigate to APIs & Services > Credentials
   - Click on your API key
   - Add HTTP referrer restrictions for your domain

5. **Monitor Usage**:
   - Check Firebase Console > Usage tab
   - Set up billing alerts
   - Monitor for suspicious activity

---

## Testing Your Configuration

### Quick Test Script

Add this temporarily to your HTML file to test:

```html
<script>
// Test Firebase Connection
firebase.database().ref('.info/connected').on('value', function(snapshot) {
    if (snapshot.val() === true) {
        console.log('✅ Connected to Firebase Realtime Database');
        
        // Test write
        firebase.database().ref('test').set({
            message: 'Firebase is working!',
            timestamp: Date.now()
        }).then(() => {
            console.log('✅ Write test successful');
        }).catch((error) => {
            console.error('❌ Write test failed:', error);
        });
    } else {
        console.log('❌ Not connected to Firebase');
    }
});

// Test auth state
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        console.log('✅ User logged in:', user.email);
    } else {
        console.log('ℹ️ No user logged in');
    }
});
</script>
```

---

## Troubleshooting

### Error: "Firebase SDK not loaded"
**Solution**: Check that Firebase CDN scripts are included in your HTML before this config file.

### Error: "Project not found"
**Solution**: Verify projectId matches your Firebase project exactly.

### Error: "Permission denied"
**Solution**: Check your Realtime Database Security Rules and ensure user is authenticated.

### Error: "Invalid API key"
**Solution**: Double-check you copied the apiKey correctly with no extra spaces.

---

## Multiple Environments

### Development vs Production

Create separate config files:

**firebase-config.dev.js** (Development):
```javascript
const firebaseConfig = {
    apiKey: "dev-api-key...",
    projectId: "firechat-dev",
    // ... other dev config
};
```

**firebase-config.prod.js** (Production):
```javascript
const firebaseConfig = {
    apiKey: "prod-api-key...",
    projectId: "firechat-prod",
    // ... other prod config
};
```

Use a build tool to swap between them.

---

## Need Help?

- ✉️ Check setup guide: `SETUP-GUIDE.md`
- 📖 Firebase docs: https://firebase.google.com/docs/web/setup
- 💬 Firebase community: https://firebase.google.com/community

---

**Remember**: After updating your config, refresh your browser and check the console for confirmation messages!
