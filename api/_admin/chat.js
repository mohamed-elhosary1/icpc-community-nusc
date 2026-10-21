/**
 * API: /api/admin/chat
 * Moderation tools for community chat: delete inappropriate messages, pin announcements.
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead ? res.writeHead(200) : res.status(200);
        return res.end ? res.end() : res.send();
    }

    const session = DB.requireAuth(req, res);
    if (!session) return;

    // DELETE Message
    if (req.method === 'DELETE') {
        try {
            const urlObj = new URL(req.url, 'http://localhost');
            const messageId = urlObj.searchParams.get('id');

            if (!messageId) {
                res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
                return res.end ? res.end(JSON.stringify({ error: 'message id is required' })) : res.send();
            }

            const delRes = await fetch(`${SUPABASE_URL}/rest/v1/nusc_chat_messages?id=eq.${encodeURIComponent(messageId)}`, {
                method: 'DELETE',
                headers: getHeaders()
            });

            if (!delRes.ok) throw new Error('Failed to delete message.');

            res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
            res.end ? res.end(JSON.stringify({ success: true, message: 'Message removed by moderator.' })) : res.send();

        } catch (e) {
            res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
            res.end ? res.end(JSON.stringify({ error: e.message })) : res.send();
        }
        return;
    }

    // PATCH: Pin / Unpin message
    if (req.method === 'PATCH') {
        try {
            const body = await parseBody(req);
            const { messageId, isPinned } = body;

            if (!messageId) {
                res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
                return res.end ? res.end(JSON.stringify({ error: 'messageId is required' })) : res.send();
            }

            const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/nusc_chat_messages?id=eq.${encodeURIComponent(messageId)}`, {
                method: 'PATCH',
                headers: Object.assign({}, getHeaders(), { 'Prefer': 'return=representation' }),
                body: JSON.stringify({ is_pinned: Boolean(isPinned) })
            });

            if (!patchRes.ok) throw new Error('Database error updating pin status.');

            res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
            res.end ? res.end(JSON.stringify({ success: true, isPinned: Boolean(isPinned) })) : res.send();

        } catch (e) {
            res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
            res.end ? res.end(JSON.stringify({ error: e.message })) : res.send();
        }
        return;
    }

    res.writeHead ? res.writeHead(405, { 'Content-Type': 'application/json' }) : res.status(405);
    res.end ? res.end() : res.send();
};
