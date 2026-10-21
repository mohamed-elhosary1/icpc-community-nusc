/**
 * API: /api/portal/profile
 * GET: Retrieves profile details.
 * PATCH: Updates allowed personal profile fields.
 * POST: Changes password with old password verification.
 */

const StudentService = require('../_student');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gpzwlxbmgpmydgywxtdo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_zbshKRcot5UDfjvtMJx4gQ_c9a9-of9';

function getHeaders() {
    return {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
    };
}

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
    res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead ? res.writeHead(200) : res.status(200);
        return res.end ? res.end() : res.send();
    }

    const token = StudentService.extractTokenFromReq(req);
    const session = token ? StudentService.verifyToken(token) : null;
    if (!session || !session.sub) {
        res.writeHead ? res.writeHead(401, { 'Content-Type': 'application/json' }) : res.status(401);
        return res.end ? res.end(JSON.stringify({ error: 'Authentication required' })) : res.send();
    }

    // GET Profile
    if (req.method === 'GET') {
        try {
            const user = await StudentService.getUserById(session.sub);
            if (!user) {
                res.writeHead ? res.writeHead(404, { 'Content-Type': 'application/json' }) : res.status(404);
                return res.end ? res.end(JSON.stringify({ error: 'User not found' })) : res.send();
            }

            res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
            res.end ? res.end(JSON.stringify({
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    fullName: user.full_name,
                    phone: user.phone,
                    role: user.role,
                    wave: user.wave,
                    faculty: user.faculty,
                    academicYear: user.academic_year,
                    codeforcesHandle: user.codeforces_handle,
                    cfVerified: user.cf_verified,
                    cfVerificationToken: user.cf_verification_token,
                    avatarUrl: user.avatar_url,
                    bio: user.bio,
                    createdAt: user.created_at,
                    lastLoginAt: user.last_login_at
                }
            })) : res.send();

        } catch (e) {
            res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
            res.end ? res.end(JSON.stringify({ error: e.message })) : res.send({ error: e.message });
        }
        return;
    }

    // PATCH Profile Details
    if (req.method === 'PATCH') {
        try {
            const body = await parseBody(req);
            const { phone, faculty, academicYear, bio, avatarUrl } = body;

            const payload = {};
            if (phone !== undefined) payload.phone = String(phone).trim();
            if (faculty !== undefined) payload.faculty = String(faculty).trim();
            if (academicYear !== undefined) payload.academic_year = String(academicYear).trim();
            if (bio !== undefined) payload.bio = String(bio).slice(0, 300).trim();
            if (avatarUrl !== undefined) payload.avatar_url = String(avatarUrl).trim();

            const patchUrl = `${SUPABASE_URL}/rest/v1/nusc_users?id=eq.${encodeURIComponent(session.sub)}`;
            const patchRes = await fetch(patchUrl, {
                method: 'PATCH',
                headers: Object.assign({}, getHeaders(), { 'Prefer': 'return=representation' }),
                body: JSON.stringify(payload)
            });

            if (!patchRes.ok) {
                throw new Error('Failed to update profile settings.');
            }

            const updated = await patchRes.json();
            const u = Array.isArray(updated) ? updated[0] : updated;

            res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
            res.end ? res.end(JSON.stringify({ success: true, user: u })) : res.send({ success: true, user: u });

        } catch (e) {
            res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
            res.end ? res.end(JSON.stringify({ error: e.message })) : res.send({ error: e.message });
        }
        return;
    }

    // POST: Change Password
    if (req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const { currentPassword, newPassword } = body;

            if (!currentPassword || !newPassword) {
                res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
                return res.end ? res.end(JSON.stringify({ error: 'Current password and new password are required.' })) : res.send();
            }

            if (newPassword.length < 8) {
                res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
                return res.end ? res.end(JSON.stringify({ error: 'New password must be at least 8 characters long.' })) : res.send();
            }

            const user = await StudentService.getUserById(session.sub);
            if (!user) {
                res.writeHead ? res.writeHead(404, { 'Content-Type': 'application/json' }) : res.status(404);
                return res.end ? res.end(JSON.stringify({ error: 'User not found' })) : res.send();
            }

            const isMatch = StudentService.verifyPassword(currentPassword, user.password_hash, user.password_salt);
            if (!isMatch) {
                res.writeHead ? res.writeHead(401, { 'Content-Type': 'application/json' }) : res.status(401);
                return res.end ? res.end(JSON.stringify({ error: 'Incorrect current password.' })) : res.send();
            }

            const { hash, salt } = StudentService.hashPassword(newPassword);
            const patchUrl = `${SUPABASE_URL}/rest/v1/nusc_users?id=eq.${encodeURIComponent(session.sub)}`;
            await fetch(patchUrl, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify({ password_hash: hash, password_salt: salt })
            });

            res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
            res.end ? res.end(JSON.stringify({ success: true, message: 'Password updated successfully.' })) : res.send({ success: true });

        } catch (e) {
            res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
            res.end ? res.end(JSON.stringify({ error: e.message })) : res.send({ error: e.message });
        }
        return;
    }

    res.writeHead ? res.writeHead(405, { 'Content-Type': 'application/json' }) : res.status(405);
    res.end ? res.end() : res.send();
};
