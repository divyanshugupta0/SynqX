// Auth Check - Simple authentication verification

(function () {
    console.log('🔐 Auth Check loaded');

    // Check if user is authenticated
    const isLoggedOut = localStorage.getItem('isLoggedOut') === 'true';
    const userId = localStorage.getItem('userId');
    const sessionUser = sessionStorage.getItem('currentUser');

    if (isLoggedOut || (!userId && !sessionUser)) {
        console.warn('Not authenticated');
        // Don't redirect immediately, let modern-chat.js handle it
    } else {
        console.log('User authenticated');
        localStorage.setItem('isLoggedOut', 'false');
    }
})();
