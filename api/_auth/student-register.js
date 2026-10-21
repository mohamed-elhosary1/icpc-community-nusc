/**
 * API: POST /api/auth/student-register
 * Creates a student account after verifying the event access code and original email.
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
        const { code, email, password, fullName, phone, faculty, academicYear } = body;

        if (!code || !email || !password) {
            res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
            return res.end ? res.end(JSON.stringify({ error: 'Registration code, email, and password are required.' })) : res.send({ error: 'Registration code, email, and password are required.' });
        }

        const result = await StudentService.registerStudent({
            code,
            email,
            password,
            fullName,
            phone,
            faculty,
            academicYear
        });

        // Set session cookie
        res.setHeader('Set-Cookie', `nusc_session_token=${result.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=1209600`);

        res.writeHead ? res.writeHead(201, { 'Content-Type': 'application/json' }) : res.status(201);
        const out = JSON.stringify({
            success: true,
            token: result.token,
            user: result.user
        });
        res.end ? res.end(out) : res.send(out);

    } catch (err) {
        console.error('[student-register Error]:', err.message);
        const isConflict = err.message.includes('already') || err.message.includes('redeemed');
        const status = isConflict ? 409 : 400;
        res.writeHead ? res.writeHead(status, { 'Content-Type': 'application/json' }) : res.status(status);
        res.end ? res.end(JSON.stringify({ error: err.message })) : res.send({ error: err.message });
    }
};
