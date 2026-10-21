/**
 * API: /api/admin/students
 * Admin student management: list, filter, search, update wave, toggle CF verification, suspend/reactivate.
 */

const DB = require('../_db');

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
    res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead ? res.writeHead(200) : res.status(200);
        return res.end ? res.end() : res.send();
    }

    const session = DB.requireAuth(req, res);
    if (!session) return;

    // GET /api/admin/students
    if (req.method === 'GET') {
        try {
            const urlObj = new URL(req.url, 'http://localhost');
            const wave = urlObj.searchParams.get('wave');
            const status = urlObj.searchParams.get('status');
            const search = urlObj.searchParams.get('search');

            let queryUrl = `${SUPABASE_URL}/rest/v1/nusc_users?order=created_at.desc`;
            if (wave && wave !== 'All') queryUrl += `&wave=eq.${encodeURIComponent(wave)}`;
            if (status && status !== 'All') queryUrl += `&status=eq.${encodeURIComponent(status)}`;
            if (search) {
                const s = encodeURIComponent(`*${search}*`);
                queryUrl += `&or=(full_name.ilike.${s},email.ilike.${s},registration_code.ilike.${s},codeforces_handle.ilike.${s})`;
            }

            const resUsers = await fetch(queryUrl, { headers: getHeaders() });
            const users = resUsers.ok ? await resUsers.json() : [];

            // Don't expose password hashes or salts to frontend
            const safeUsers = users.map(u => ({
                id: u.id,
                fullName: u.full_name,
                email: u.email,
                phone: u.phone,
                role: u.role,
                wave: u.wave,
                faculty: u.faculty,
                academicYear: u.academic_year,
                registrationCode: u.registration_code,
                codeforcesHandle: u.codeforces_handle,
                cfVerified: u.cf_verified,
                cfVerificationToken: u.cf_verification_token,
                status: u.status,
                createdAt: u.created_at,
                lastLoginAt: u.last_login_at
            }));

            res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
            res.end ? res.end(JSON.stringify({ success: true, count: safeUsers.length, students: safeUsers })) : res.send();

        } catch (e) {
            res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
            res.end ? res.end(JSON.stringify({ error: e.message })) : res.send();
        }
        return;
    }

    // PATCH /api/admin/students
    if (req.method === 'PATCH') {
        try {
            const body = await parseBody(req);
            const { studentId, wave, cfVerified, status, role } = body;

            if (!studentId) {
                res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
                return res.end ? res.end(JSON.stringify({ error: 'studentId is required' })) : res.send();
            }

            const payload = {};
            if (wave !== undefined) payload.wave = wave;
            if (cfVerified !== undefined) payload.cf_verified = Boolean(cfVerified);
            if (status !== undefined) payload.status = status;
            if (role !== undefined) payload.role = role;
            if (body.unlinkCf) {
                payload.codeforces_handle = null;
                payload.cf_verified = false;
                payload.cf_verification_token = null;
            } else if (body.codeforcesHandle !== undefined) {
                payload.codeforces_handle = body.codeforcesHandle ? String(body.codeforcesHandle).trim() : null;
            }

            const patchUrl = `${SUPABASE_URL}/rest/v1/nusc_users?id=eq.${encodeURIComponent(studentId)}`;
            const patchRes = await fetch(patchUrl, {
                method: 'PATCH',
                headers: Object.assign({}, getHeaders(), { 'Prefer': 'return=representation' }),
                body: JSON.stringify(payload)
            });

            if (!patchRes.ok) throw new Error('Database error updating student.');

            const updated = await patchRes.json();
            const u = Array.isArray(updated) ? updated[0] : updated;

            res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
            res.end ? res.end(JSON.stringify({ success: true, student: u })) : res.send();

        } catch (e) {
            res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
            res.end ? res.end(JSON.stringify({ error: e.message })) : res.send();
        }
        return;
    }

    res.writeHead ? res.writeHead(405, { 'Content-Type': 'application/json' }) : res.status(405);
    res.end ? res.end() : res.send();
};
