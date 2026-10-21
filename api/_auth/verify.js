/**
 * API: GET /api/auth/verify
 * Server-side Admin Session Verification
 */

const DB = require('../_db');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead ? res.writeHead(200) : res.status(200);
        res.end ? res.end() : res.send();
        return;
    }

    const token = DB.extractToken(req);
    const session = DB.verifySessionToken(token);

    if (!session) {
        res.writeHead ? res.writeHead(401, { 'Content-Type': 'application/json' }) : res.status(401);
        const err = JSON.stringify({ authenticated: false });
        res.end ? res.end(err) : res.send(err);
        return;
    }

    const result = {
        authenticated: true,
        user: {
            username: session.sub || DB.ADMIN_USERNAME,
            role: session.role || 'Super Admin'
        }
    };

    res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
    const out = JSON.stringify(result);
    res.end ? res.end(out) : res.send(out);
};
