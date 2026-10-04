/**
 * API: POST /api/auth/login
 * Server-side Admin Login
 * Verifies admin credentials strictly on the backend.
 */

const DB = require('../_db');

function parseBody(req) {
    return new Promise((resolve) => {
        if (req.body && typeof req.body === 'object') return resolve(req.body);
        let data = '';
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => {
            try { resolve(JSON.parse(data || '{}')); }
            catch (e) { resolve({}); }
        });
    });
}

module.exports = async (req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead ? res.writeHead(200) : res.status(200);
        res.end ? res.end() : res.send();
        return;
    }

    if (req.method !== 'POST') {
        res.writeHead ? res.writeHead(405, { 'Content-Type': 'application/json' }) : res.status(405);
        const err = JSON.stringify({ error: 'Method not allowed' });
        res.end ? res.end(err) : res.send(err);
        return;
    }

    const body = await parseBody(req);
    const { username, password } = body;

    if (!username || !password) {
        res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
        const err = JSON.stringify({ error: 'Username and password are required.' });
        res.end ? res.end(err) : res.send(err);
        return;
    }

    const isValid = DB.verifyCredentials(username, password);

    if (!isValid) {
        res.writeHead ? res.writeHead(401, { 'Content-Type': 'application/json' }) : res.status(401);
        const err = JSON.stringify({ error: 'Invalid administrator credentials.' });
        res.end ? res.end(err) : res.send(err);
        return;
    }

    // Generate secure session token
    const token = DB.createSessionToken(username);

    // Set secure cookie if possible
    res.setHeader('Set-Cookie', `nusc_admin_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`);

    const result = {
        success: true,
        token: token,
        user: {
            username: DB.ADMIN_USERNAME,
            role: 'Super Admin'
        }
    };

    res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
    const out = JSON.stringify(result);
    res.end ? res.end(out) : res.send(out);
};
