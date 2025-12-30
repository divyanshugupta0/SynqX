// Firebase Configuration
// Synced from noxlogin.html - Last updated: 2025-12-28
const firebaseConfig = {
    apiKey: "AIzaSyCE6TCWkVX_1MZgCn8vt0pEek9NHMzOTxY",
    authDomain: "firefly-nox.firebaseapp.com",
    databaseURL: "https://firefly-nox-default-rtdb.firebaseio.com",
    projectId: "firefly-nox",
    storageBucket: "firefly-nox.firebasestorage.app",
    messagingSenderId: "559331235791",
    appId: "1:559331235791:web:a700ea6ecf6a9167c7a4ba",
    measurementId: "G-SYE8N2HCYH"
};

// Initialize Firebase
if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    } else {
        firebase.app(); // Use existing instance
    }
    console.log('Firebase initialized successfully');
} else {
    console.error('Firebase SDK not loaded');
}

// Firebase Database Reference
const database = firebase.database();
const storage = firebase.storage();

// Export for use in other files
window.firebaseDB = database;
window.firebaseStorage = storage;
