/**
 * API: /api/admin/sessions
 * Admin session creation, management, scheduling, and cancellation.
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead ? res.writeHead(200) : res.status(200);
        return res.end ? res.end() : res.send();
    }

    const session = DB.requireAuth(req, res);
    if (!session) return;

    // GET /api/admin/sessions
    if (req.method === 'GET') {
        try {
            const resSessions = await fetch(`${SUPABASE_URL}/rest/v1/nusc_sessions?order=session_date.desc`, { headers: getHeaders() });
            const list = resSessions.ok ? await resSessions.json() : [];

            res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
            res.end ? res.end(JSON.stringify({ success: true, count: list.length, sessions: list })) : res.send();
        } catch (e) {
            res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
            res.end ? res.end(JSON.stringify({ error: e.message })) : res.send();
        }
        return;
    }

    // POST /api/admin/sessions
    if (req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const { title, description, sessionDate, durationMinutes, speakerName, wave, location, meetingLink, sessionType, prepMaterials, practiceProblems } = body;

            if (!title || !sessionDate) {
                res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
                return res.end ? res.end(JSON.stringify({ error: 'Title and sessionDate are required' })) : res.send();
            }

            const record = {
                title: String(title).trim(),
                description: description ? String(description).trim() : null,
                session_date: new Date(sessionDate).toISOString(),
                duration_minutes: durationMinutes ? parseInt(durationMinutes, 10) : 60,
                speaker_name: speakerName ? String(speakerName).trim() : null,
                wave: wave || 'All',
                location: location ? String(location).trim() : 'Online (Google Meet)',
                meeting_link: meetingLink ? String(meetingLink).trim() : null,
                session_type: sessionType || 'Workshop',
                prep_materials: prepMaterials ? String(prepMaterials).trim() : null,
                practice_problems: Array.isArray(practiceProblems) ? practiceProblems : [],
                status: 'upcoming',
                created_at: new Date().toISOString()
            };

            const postRes = await fetch(`${SUPABASE_URL}/rest/v1/nusc_sessions`, {
                method: 'POST',
                headers: Object.assign({}, getHeaders(), { 'Prefer': 'return=representation' }),
                body: JSON.stringify(record)
            });

            if (!postRes.ok) throw new Error('Database error creating session.');
            const saved = await postRes.json();
            const s = Array.isArray(saved) ? saved[0] : saved;

            res.writeHead ? res.writeHead(201, { 'Content-Type': 'application/json' }) : res.status(201);
            res.end ? res.end(JSON.stringify({ success: true, session: s })) : res.send();

        } catch (e) {
            res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
            res.end ? res.end(JSON.stringify({ error: e.message })) : res.send();
        }
        return;
    }

    // PATCH /api/admin/sessions
    if (req.method === 'PATCH') {
        try {
            const body = await parseBody(req);
            const { id, ...updates } = body;

            if (!id) {
                res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
                return res.end ? res.end(JSON.stringify({ error: 'Session id is required' })) : res.send();
            }

            const payload = {};
            if (updates.title !== undefined) payload.title = updates.title;
            if (updates.description !== undefined) payload.description = updates.description;
            if (updates.sessionDate !== undefined) payload.session_date = new Date(updates.sessionDate).toISOString();
            if (updates.durationMinutes !== undefined) payload.duration_minutes = updates.durationMinutes;
            if (updates.speakerName !== undefined) payload.speaker_name = updates.speakerName;
            if (updates.wave !== undefined) payload.wave = updates.wave;
            if (updates.location !== undefined) payload.location = updates.location;
            if (updates.meetingLink !== undefined) payload.meeting_link = updates.meetingLink;
            if (updates.sessionType !== undefined) payload.session_type = updates.sessionType;
            if (updates.status !== undefined) payload.status = updates.status;
            if (updates.prepMaterials !== undefined) payload.prep_materials = updates.prepMaterials;
            if (updates.practiceProblems !== undefined) payload.practice_problems = updates.practiceProblems;

            const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/nusc_sessions?id=eq.${encodeURIComponent(id)}`, {
                method: 'PATCH',
                headers: Object.assign({}, getHeaders(), { 'Prefer': 'return=representation' }),
                body: JSON.stringify(payload)
            });

            if (!patchRes.ok) throw new Error('Database error updating session.');
            const saved = await patchRes.json();
            const s = Array.isArray(saved) ? saved[0] : saved;

            res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
            res.end ? res.end(JSON.stringify({ success: true, session: s })) : res.send();

        } catch (e) {
            res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
            res.end ? res.end(JSON.stringify({ error: e.message })) : res.send();
        }
        return;
    }

    // DELETE /api/admin/sessions
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
                return res.end ? res.end(JSON.stringify({ error: 'Session id is required' })) : res.send();
            }

            const delRes = await fetch(`${SUPABASE_URL}/rest/v1/nusc_sessions?id=eq.${encodeURIComponent(id)}`, {
                method: 'DELETE',
                headers: getHeaders()
            });

            if (!delRes.ok) throw new Error('Database error deleting session.');

            res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
            res.end ? res.end(JSON.stringify({ success: true, message: `Session ${id} deleted.` })) : res.send();

        } catch (e) {
            res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
            res.end ? res.end(JSON.stringify({ error: e.message })) : res.send();
        }
        return;
    }

    res.writeHead ? res.writeHead(405, { 'Content-Type': 'application/json' }) : res.status(405);
    res.end ? res.end() : res.send();
};
