/**
 * ICPC NUSC — Unified Serverless Gateway Handler
 * Consolidated single function entrypoint for Vercel Hobby deployment.
 * Routes all API calls to corresponding internal service modules.
 */

const url = require('url');
const path = require('path');

const ROUTE_MAP = {
    'auth/login': require('./_auth/login'),
    'auth/student-login': require('./_auth/student-login'),
    'auth/student-register': require('./_auth/student-register'),
    'auth/validate-code': require('./_auth/validate-code'),
    'auth/verify': require('./_auth/verify'),
    'auth/me': require('./_auth/me'),
    'auth/forgot-password': require('./_auth/forgot-password'),
    'auth/reset-password': require('./_auth/reset-password'),
    'auth/logout': require('./_auth/logout'),

    'portal/dashboard': require('./_portal/dashboard'),
    'portal/leaderboard': require('./_portal/leaderboard'),
    'portal/sessions': require('./_portal/sessions'),
    'portal/mentors': require('./_portal/mentors'),
    'portal/chat': require('./_portal/chat'),
    'portal/profile': require('./_portal/profile'),

    'codeforces/link': require('./_codeforces_api/link'),
    'codeforces/stats': require('./_codeforces_api/stats'),

    'admin/students': require('./_admin/students'),
    'admin/codes': require('./_admin/codes'),
    'admin/sessions': require('./_admin/sessions'),
    'admin/attendance': require('./_admin/attendance'),
    'admin/mentors': require('./_admin/mentors'),
    'admin/chat': require('./_admin/chat'),

    'applications': require('./_applications'),
    'events': require('./_events'),
    'participants': require('./_participants'),
    'questions': require('./_questions'),
    'registrations': require('./_registrations'),
    'stats': require('./_stats')
};

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead ? res.writeHead(200) : res.status(200);
        return res.end ? res.end() : res.send();
    }

    const parsed = url.parse(req.url, false);
    let routePath = (parsed.pathname || '').replace(/^\/+/, '');
    
    // Strip leading 'api/' if present
    if (routePath.startsWith('api/')) {
        routePath = routePath.slice(4);
    }
    // Remove trailing slash
    routePath = routePath.replace(/\/+$/, '');

    const handler = ROUTE_MAP[routePath];

    if (handler) {
        return handler(req, res);
    }

    // Health check / root info
    if (!routePath || routePath === 'health') {
        res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
        return res.end ? res.end(JSON.stringify({ status: 'ok', service: 'ICPC NUSC API Gateway', routes: Object.keys(ROUTE_MAP).length })) : res.send();
    }

    res.writeHead ? res.writeHead(404, { 'Content-Type': 'application/json' }) : res.status(404);
    const err = JSON.stringify({ error: `Route not found: /api/${routePath}` });
    return res.end ? res.end(err) : res.send(err);
};
