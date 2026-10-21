/**
 * API: /api/admin/mentors
 * Admin mentor communication management: broadcast announcements & direct feedback.
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead ? res.writeHead(200) : res.status(200);
        return res.end ? res.end() : res.send();
    }

    const session = DB.requireAuth(req, res);
    if (!session) return;

    // GET /api/admin/mentors
    if (req.method === 'GET') {
        try {
            const resFeedback = await fetch(`${SUPABASE_URL}/rest/v1/nusc_mentor_feedback?order=created_at.desc`, { headers: getHeaders() });
            const list = resFeedback.ok ? await resFeedback.json() : [];

            res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
            res.end ? res.end(JSON.stringify({ success: true, count: list.length, items: list })) : res.send();
        } catch (e) {
            res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
            res.end ? res.end(JSON.stringify({ error: e.message })) : res.send();
        }
        return;
    }

    // POST /api/admin/mentors: Publish announcement or personal feedback
    if (req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const { type, studentId, title, content, recommendedProblems } = body;

            if (!content) {
                res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
                return res.end ? res.end(JSON.stringify({ error: 'Content is required.' })) : res.send();
            }

            const record = {
                type: type || 'announcement', // announcement, personal_feedback, problem_recommendation
                student_id: studentId || null,
                title: title ? String(title).trim() : null,
                content: String(content).trim(),
                recommended_problems: Array.isArray(recommendedProblems) ? recommendedProblems : [],
                is_read: false,
                created_at: new Date().toISOString()
            };

            const postRes = await fetch(`${SUPABASE_URL}/rest/v1/nusc_mentor_feedback`, {
                method: 'POST',
                headers: Object.assign({}, getHeaders(), { 'Prefer': 'return=representation' }),
                body: JSON.stringify(record)
            });

            if (!postRes.ok) throw new Error('Database error saving feedback.');
            const saved = await postRes.json();

            res.writeHead ? res.writeHead(201, { 'Content-Type': 'application/json' }) : res.status(201);
            res.end ? res.end(JSON.stringify({ success: true, item: Array.isArray(saved) ? saved[0] : saved })) : res.send();

        } catch (e) {
            res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
            res.end ? res.end(JSON.stringify({ error: e.message })) : res.send();
        }
        return;
    }

    // DELETE /api/admin/mentors
    if (req.method === 'DELETE') {
        try {
            const urlObj = new URL(req.url, 'http://localhost');
            let id = urlObj.searchParams.get('id');
            if (!id) {
                const body = await parseBody(req);
                id = body.id;
            }

            if (!id) {
                res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
                return res.end ? res.end(JSON.stringify({ error: 'Feedback id is required.' })) : res.send();
            }

            const delRes = await fetch(`${SUPABASE_URL}/rest/v1/nusc_mentor_feedback?id=eq.${encodeURIComponent(id)}`, {
                method: 'DELETE',
                headers: getHeaders()
            });

            if (!delRes.ok) throw new Error('Database error deleting feedback item.');

            res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
            res.end ? res.end(JSON.stringify({ success: true, message: `Feedback ${id} deleted.` })) : res.send();

        } catch (e) {
            res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
            res.end ? res.end(JSON.stringify({ error: e.message })) : res.send();
        }
        return;
    }

    res.writeHead ? res.writeHead(405, { 'Content-Type': 'application/json' }) : res.status(405);
    res.end ? res.end() : res.send();
};
