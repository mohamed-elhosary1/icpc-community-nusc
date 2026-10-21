/**
 * API: POST /api/auth/student-login
 * Unified student, mentor, and admin login endpoint.
 */

const StudentService = require('../_student');

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

    try {
        const body = await parseBody(req);
        const { identifier, email, username, password } = body;
        const loginId = identifier || email || username;

        if (!loginId || !password) {
            res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
            return res.end ? res.end(JSON.stringify({ error: 'Please enter your email or username and password.' })) : res.send({ error: 'Please enter your email or username and password.' });
        }

        const result = await StudentService.login({ identifier: loginId, password });

        const cookieName = result.isAdmin ? 'nusc_admin_token' : 'nusc_session_token';
        res.setHeader('Set-Cookie', `${cookieName}=${result.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=1209600`);

        res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
        const out = JSON.stringify({
            success: true,
            token: result.token,
            isAdmin: result.isAdmin,
            user: result.user
        });
        res.end ? res.end(out) : res.send(out);

    } catch (err) {
        res.writeHead ? res.writeHead(401, { 'Content-Type': 'application/json' }) : res.status(401);
        res.end ? res.end(JSON.stringify({ error: err.message || 'Invalid credentials.' })) : res.send({ error: err.message || 'Invalid credentials.' });
    }
};
