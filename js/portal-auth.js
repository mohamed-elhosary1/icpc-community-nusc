/**
 * ICPC NUSC — Student & Community Portal Client SDK
 * Handles token storage, route protection, profile fetching, and portal state.
 */

(function (window) {
    'use strict';

    const TOKEN_KEY = 'NUSC_STUDENT_TOKEN';
    const USER_KEY = 'NUSC_STUDENT_USER';

    const PortalAuth = {
        getToken: function () {
            let t = localStorage.getItem(TOKEN_KEY);
            if (!t || t === 'null' || t === 'undefined') {
                // Check if admin token is present
                t = localStorage.getItem('NUSC_REAL_AUTH_TOKEN');
            }
            return t || '';
        },

        setSession: function (token, user) {
            if (token) localStorage.setItem(TOKEN_KEY, token);
            if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
        },

        getUser: function () {
            try {
                const raw = localStorage.getItem(USER_KEY);
                return raw ? JSON.parse(raw) : null;
            } catch (e) {
                return null;
            }
        },

        isAuthenticated: function () {
            const token = this.getToken();
            return !!token && token !== 'null' && token !== 'undefined';
        },

        logout: function () {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            window.location.href = '/login';
        },

        /**
         * Protect route: if not authenticated, redirect to /login
         */
        requireAuth: async function (requiredRole = null) {
            if (!this.isAuthenticated()) {
                const currentPath = encodeURIComponent(window.location.pathname + window.location.search);
                window.location.href = `/login?redirect=${currentPath}`;
                return false;
            }

            try {
                const res = await fetch('/api/auth/me', {
                    headers: { 'Authorization': 'Bearer ' + this.getToken() }
                });

                if (!res.ok) {
                    this.logout();
                    return false;
                }

                const data = await res.json();
                if (!data.authenticated || !data.user) {
                    this.logout();
                    return false;
                }

                // Update local storage with fresh server data
                localStorage.setItem(USER_KEY, JSON.stringify(data.user));

                if (requiredRole && data.user.role !== requiredRole && !data.isAdmin) {
                    alert('You do not have permission to access this area.');
                    window.location.href = '/portal';
                    return false;
                }

                return data.user;

            } catch (e) {
                // Network error, allow cached user if exists
                return this.getUser();
            }
        },

        /**
         * Fetch with automatic Bearer token injection
         */
        fetchWithAuth: async function (url, options = {}) {
            const headers = Object.assign({}, options.headers || {});
            const token = this.getToken();
            if (token) {
                headers['Authorization'] = 'Bearer ' + token;
            }
            options.headers = headers;
            return fetch(url, options);
        }
    };

    window.PortalAuth = PortalAuth;
})(window);
