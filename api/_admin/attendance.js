/**
 * API: /api/admin/attendance
 * GET: Lists attendance records for a session.
 * POST: Records or corrects student attendance.
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead ? res.writeHead(200) : res.status(200);
        return res.end ? res.end() : res.send();
    }

    const session = DB.requireAuth(req, res);
    if (!session) return;

    // GET Attendance
    if (req.method === 'GET') {
        try {
            const urlObj = new URL(req.url, 'http://localhost');
            const sessionId = urlObj.searchParams.get('sessionId');

            if (!sessionId) {
                res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
                return res.end ? res.end(JSON.stringify({ error: 'sessionId parameter is required' })) : res.send();
            }

            // Fetch session attendance + student list
            const [attRes, stuRes] = await Promise.all([
                fetch(`${SUPABASE_URL}/rest/v1/nusc_attendance?session_id=eq.${encodeURIComponent(sessionId)}`, { headers: getHeaders() }),
                fetch(`${SUPABASE_URL}/rest/v1/nusc_users?select=id,full_name,wave,email,codeforces_handle&status=eq.active&order=full_name.asc`, { headers: getHeaders() })
            ]);

            const attList = attRes.ok ? await attRes.json() : [];
            const students = stuRes.ok ? await stuRes.json() : [];

            const attMap = new Map();
            attList.forEach(a => attMap.set(a.student_id, a));

            const combined = students.map(s => {
                const a = attMap.get(s.id);
                return {
                    studentId: s.id,
                    fullName: s.full_name,
                    email: s.email,
                    wave: s.wave,
                    codeforcesHandle: s.codeforces_handle,
                    status: a ? a.status : 'not_recorded',
                    notes: a ? a.notes : null,
                    recordedAt: a ? a.recorded_at : null
                };
            });

            res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
            res.end ? res.end(JSON.stringify({
                success: true,
                sessionId,
                records: combined,
                presentCount: attList.filter(a => a.status === 'present').length,
                absentCount: attList.filter(a => a.status === 'absent').length
            })) : res.send();

        } catch (e) {
            res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
            res.end ? res.end(JSON.stringify({ error: e.message })) : res.send();
        }
        return;
    }

    // POST: Mark / Update Attendance
    if (req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const { sessionId, studentId, status, notes, records } = body;

            if (!sessionId) {
                res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
                return res.end ? res.end(JSON.stringify({ error: 'sessionId is required' })) : res.send();
            }

            // Batch update support
            if (Array.isArray(records)) {
                const upsertRows = records.map(r => ({
                    session_id: sessionId,
                    student_id: r.studentId,
                    status: r.status || 'present',
                    notes: r.notes ? String(r.notes).trim() : null,
                    recorded_at: new Date().toISOString()
                }));

                const postRes = await fetch(`${SUPABASE_URL}/rest/v1/nusc_attendance`, {
                    method: 'POST',
                    headers: Object.assign({}, getHeaders(), {
                        'Prefer': 'resolution=merge-duplicates,return=representation'
                    }),
                    body: JSON.stringify(upsertRows)
                });

                if (!postRes.ok) {
                    const errText = await postRes.text();
                    throw new Error(`Database error: ${errText}`);
                }

                res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
                return res.end ? res.end(JSON.stringify({ success: true, count: upsertRows.length })) : res.send();
            }

            if (!studentId || !status) {
                res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
                return res.end ? res.end(JSON.stringify({ error: 'studentId and status are required' })) : res.send();
            }

            const record = {
                session_id: sessionId,
                student_id: studentId,
                status: status, // present, absent, excused
                notes: notes ? String(notes).trim() : null,
                recorded_at: new Date().toISOString()
            };

            const upsertUrl = `${SUPABASE_URL}/rest/v1/nusc_attendance`;
            const postRes = await fetch(upsertUrl, {
                method: 'POST',
                headers: Object.assign({}, getHeaders(), {
                    'Prefer': 'resolution=merge-duplicates,return=representation'
                }),
                body: JSON.stringify(record)
            });

            if (!postRes.ok) {
                const errText = await postRes.text();
                throw new Error(`Database error: ${errText}`);
            }

            const result = await postRes.json();
            res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
            res.end ? res.end(JSON.stringify({ success: true, record: Array.isArray(result) ? result[0] : result })) : res.send();

        } catch (e) {
            res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
            res.end ? res.end(JSON.stringify({ error: e.message })) : res.send();
        }
        return;
    }

    res.writeHead ? res.writeHead(405, { 'Content-Type': 'application/json' }) : res.status(405);
    res.end ? res.end() : res.send();
};
