// Enhanced Authentication System for FireFly-NOX
// Handles both Firebase and local fallback authentication

(function () {
    'use strict';

    // Configuration
    const SESSION_EXPIRY_DAYS = 30;
    const USERS_STORAGE_KEY = 'firechat_users';

    // Firebase configuration (will be initialized from noxlogin.html)
    let auth, database, app;
    let useLocalFallback = false;

    // =================================================================
    // UTILITY FUNCTIONS
    // =================================================================

    // Generate unique user ID for local storage
    function generateLocalUserId() {
        return 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Validate email format
    function isValidEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }

    //Validate password strength
    function validatePassword(password) {
        const errors = [];

        if (password.length < 6) {
            errors.push('Password must be at least 6 characters long');
        }

        return errors;
    }

    // Hash password (simple - for local storage only)
    async function hashPassword(password) {
        // In production, use proper hashing like bcrypt
        // This is a simple implementation for demo purposes
        const encoder = new TextEncoder();
        const data = encoder.encode(password + 'firechat_salt');
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // =================================================================
    // SESSION MANAGEMENT
    // =================================================================

    // Store user session
    function storeUserSession(userData, rememberMe = false) {
        // Always store in sessionStorage
        sessionStorage.setItem('currentUser', JSON.stringify(userData));

        // Store basic info in localStorage for profile loading
        localStorage.setItem('userName', userData.name || userData.username);
        localStorage.setItem('userId', userData.uid);

        // Store profile picture if available
        if (userData.profilePicture) {
            localStorage.setItem('userProfilePic', userData.profilePicture);
        }

        // If remember me, store encrypted credentials
        if (rememberMe) {
            const sessionData = {
                userData: userData,
                timestamp: Date.now()
            };
            localStorage.setItem('rememberedSession', JSON.stringify(sessionData));
        } else {
            localStorage.removeItem('rememberedSession');
        }

        // Mark user as logged in
        localStorage.setItem('isLoggedOut', 'false');

        console.log('✅ User session stored successfully');
    }

    // Check for existing session
    function checkExistingSession() {
        // Check session storage first
        const currentUser = sessionStorage.getItem('currentUser');
        if (currentUser) {
            try {
                return JSON.parse(currentUser);
            } catch (e) {
                console.error('Error parsing current session:', e);
                sessionStorage.removeItem('currentUser');
            }
        }

        // Check for remembered session
        const remembered = localStorage.getItem('rememberedSession');
        if (remembered) {
            try {
                const sessionData = JSON.parse(remembered);
                const expiryTime = SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

                if (Date.now() - sessionData.timestamp < expiryTime) {
                    // Session still valid
                    sessionData.timestamp = Date.now(); // Refresh
                    localStorage.setItem('rememberedSession', JSON.stringify(sessionData));
                    sessionStorage.setItem('currentUser', JSON.stringify(sessionData.userData));
                    return sessionData.userData;
                } else {
                    // Session expired
                    localStorage.removeItem('rememberedSession');
                }
            } catch (e) {
                console.error('Error parsing remembered session:', e);
                localStorage.removeItem('rememberedSession');
            }
        }

        return null;
    }

    // Clear user session
    function clearUserSession() {
        sessionStorage.removeItem('currentUser');
        localStorage.removeItem('rememberedSession');
        localStorage.setItem('isLoggedOut', 'true');
        console.log('✅ User session cleared');
    }

    // =================================================================
    // LOCAL STORAGE AUTHENTICATION (Fallback)
    // =================================================================

    // Get all users from local storage
    function getLocalUsers() {
        const users = localStorage.getItem(USERS_STORAGE_KEY);
        return users ? JSON.parse(users) : {};
    }

    // Save user to local storage
    function saveLocalUser(email, userData) {
        const users = getLocalUsers();
        users[email.toLowerCase()] = userData;
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    }

    // Find user by username
    function findUserByUsername(username) {
        const users = getLocalUsers();
        for (const email in users) {
            if (users[email].username === username) {
                return users[email];
            }
        }
        return null;
    }

    // Find user by email
    function findUserByEmail(email) {
        const users = getLocalUsers();
        return users[email.toLowerCase()] || null;
    }

    // Check if username exists
    function usernameExists(username) {
        return findUserByUsername(username) !== null;
    }

    // =================================================================
    // FIREBASE AUTHENTICATION
    // =================================================================

    // Initialize Firebase (called from main page)
    window.initializeFirebaseAuth = function (firebaseAuth, firebaseDb, firebaseApp) {
        auth = firebaseAuth;
        database = firebaseDb;
        app = firebaseApp;
        useLocalFallback = false;
        console.log('✅ Firebase authentication initialized');
    };

    // Firebase Sign Up
    async function firebaseSignup(name, username, email, password) {
        try {
            // Create user with email and password
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            console.log('✅ Firebase user created:', user.uid);

            // Store additional user data in database
            const userData = {
                name: name,
                username: username,
                email: email,
                createdAt: Date.now(),
                connectionId: null,
                profilePicture: null,
                lastActive: Date.now()
            };

            await database.ref('users/' + user.uid).set(userData);

            console.log('✅ User data stored in Firebase database');

            return {
                success: true,
                uid: user.uid,
                userData: userData
            };
        } catch (error) {
            console.error('❌ Firebase signup error:', error);
            return {
                success: false,
                error: error.message,
                code: error.code
            };
        }
    }

    // Firebase Login
    async function firebaseLogin(username, password) {
        try {
            // First, find email from username
            const usersSnapshot = await database.ref('users').once('value');

            if (!usersSnapshot.exists()) {
                return {
                    success: false,
                    error: 'No users found in database'
                };
            }

            let userEmail = null;
            let userId = null;

            usersSnapshot.forEach((child) => {
                const userData = child.val();
                if (userData.username === username) {
                    userEmail = userData.email;
                    userId = child.key;
                }
            });

            if (!userEmail) {
                return {
                    success: false,
                    error: 'Username not found'
                };
            }

            // Sign in with email and password
            const userCredential = await auth.signInWithEmailAndPassword(userEmail, password);
            const user = userCredential.user;

            console.log('✅ Firebase login successful:', user.uid);

            // Get user data from database
            const userSnapshot = await database.ref('users/' + user.uid).once('value');
            const userData = userSnapshot.val();

            // Update last active
            await database.ref('users/' + user.uid).update({
                lastActive: Date.now()
            });

            return {
                success: true,
                uid: user.uid,
                userData: {
                    ...userData,
                    uid: user.uid
                }
            };
        } catch (error) {
            console.error('❌ Firebase login error:', error);
            return {
                success: false,
                error: error.message,
                code: error.code
            };
        }
    }

    // =================================================================
    // LOCAL AUTHENTICATION (Fallback)
    // =================================================================

    // Local Signup
    async function localSignup(name, username, email, password) {
        try {
            // Check if user exists
            if (findUserByEmail(email)) {
                return {
                    success: false,
                    error: 'Email already in use'
                };
            }

            if (usernameExists(username)) {
                return {
                    success: false,
                    error: 'Username already taken'
                };
            }

            // Hash password
            const hashedPassword = await hashPassword(password);

            // Create user data
            const uid = generateLocalUserId();
            const userData = {
                uid: uid,
                name: name,
                username: username,
                email: email,
                password: hashedPassword,
                createdAt: Date.now(),
                connectionId: null,
                profilePicture: null
            };

            // Save to local storage
            saveLocalUser(email, userData);

            console.log('✅ Local user created:', uid);

            // Remove password from returned data
            const { password: _, ...userDataWithoutPassword } = userData;

            return {
                success: true,
                uid: uid,
                userData: userDataWithoutPassword
            };
        } catch (error) {
            console.error('❌ Local signup error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Local Login
    async function localLogin(username, password) {
        try {
            const user = findUserByUsername(username);

            if (!user) {
                return {
                    success: false,
                    error: 'Username not found'
                };
            }

            // Hash provided password and compare
            const hashedPassword = await hashPassword(password);

            if (user.password !== hashedPassword) {
                return {
                    success: false,
                    error: 'Incorrect password'
                };
            }

            console.log('✅ Local login successful:', user.uid);

            // Remove password from returned data
            const { password: _, ...userDataWithoutPassword } = user;

            return {
                success: true,
                uid: user.uid,
                userData: userDataWithoutPassword
            };
        } catch (error) {
            console.error('❌ Local login error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // =================================================================
    // PUBLIC API
    // =================================================================

    window.FireChatAuth = {
        // Sign up
        signup: async function (name, username, email, password) {
            // Validate inputs
            if (!name || !username || !email || !password) {
                return { success: false, error: 'All fields are required' };
            }

            if (!isValidEmail(email)) {
                return { success: false, error: 'Invalid email format' };
            }

            const passwordErrors = validatePassword(password);
            if (passwordErrors.length > 0) {
                return { success: false, error: passwordErrors[0] };
            }

            // Use appropriate signup method
            if (useLocalFallback || !auth) {
                return await localSignup(name, username, email, password);
            } else {
                return await firebaseSignup(name, username, email, password);
            }
        },

        // Login
        login: async function (username, password, rememberMe = false) {
            // Validate inputs
            if (!username || !password) {
                return { success: false, error: 'Username and password are required' };
            }

            // Use appropriate login method
            let result;
            if (useLocalFallback || !auth) {
                result = await localLogin(username, password);
            } else {
                result = await firebaseLogin(username, password);
            }

            // If successful, store session
            if (result.success) {
                storeUserSession(result.userData, rememberMe);
            }

            return result;
        },

        // Logout
        logout: async function () {
            try {
                // Sign out from Firebase if using it
                if (!useLocalFallback && auth && auth.currentUser) {
                    await auth.signOut();
                }

                // Clear local session
                clearUserSession();

                return { success: true };
            } catch (error) {
                console.error('❌ Logout error:', error);
                return { success: false, error: error.message };
            }
        },

        // Check session
        checkSession: function () {
            return checkExistingSession();
        },

        // Set fallback mode
        setFallbackMode: function (enabled) {
            useLocalFallback = enabled;
            console.log('Fallback mode:', enabled ? 'ENABLED' : 'DISABLED');
        }
    };

    console.log('✅ FireChat Authentication System loaded');
})();
