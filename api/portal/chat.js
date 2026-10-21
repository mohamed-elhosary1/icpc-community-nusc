/**
 * API: /api/portal/chat
 * GET: Retrieves messages for a specific channel.
 * POST: Sends a message to a channel with validation and spam protection.
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

// In-memory rate limiting map (IP / user -> timestamp)
const lastPostTimes = new Map();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead ? res.writeHead(200) : res.status(200);
        return res.end ? res.end() : res.send();
    }

    const token = StudentService.extractTokenFromReq(req);
    const session = token ? StudentService.verifyToken(token) : null;

    if (!session || !session.sub) {
        res.writeHead ? res.writeHead(401, { 'Content-Type': 'application/json' }) : res.status(401);
        return res.end ? res.end(JSON.stringify({ error: 'Authentication required for community chat' })) : res.send();
    }

    // GET Messages
    if (req.method === 'GET') {
        try {
            const urlObj = new URL(req.url, 'http://localhost');
            const channel = (urlObj.searchParams.get('channel') || 'general').toLowerCase();
            const limit = Math.min(parseInt(urlObj.searchParams.get('limit') || '50', 10), 100);

            const queryUrl = `${SUPABASE_URL}/rest/v1/nusc_chat_messages?channel=eq.${encodeURIComponent(channel)}&order=created_at.asc&limit=${limit}`;
            const resMsg = await fetch(queryUrl, { headers: getHeaders() });
            const messages = resMsg.ok ? await resMsg.json() : [];

            res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
            res.end ? res.end(JSON.stringify({
                success: true,
                channel,
                messages: messages.map(m => ({
                    id: m.id,
                    channel: m.channel,
                    senderId: m.sender_id,
                    senderName: m.sender_name,
                    senderRole: m.sender_role,
                    message: m.message,
                    isPinned: m.is_pinned,
                    createdAt: m.created_at,
                    isMe: m.sender_id === session.sub
                }))
            })) : res.send();

        } catch (err) {
            res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
            res.end ? res.end(JSON.stringify({ error: err.message })) : res.send({ error: err.message });
        }
        return;
    }

    // POST Message
    if (req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const channel = (body.channel || 'general').toLowerCase().trim();
            const rawMessage = (body.message || '').trim();

            if (!rawMessage) {
                res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
                return res.end ? res.end(JSON.stringify({ error: 'Message content cannot be empty.' })) : res.send();
            }

            if (rawMessage.length > 1000) {
                res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
                return res.end ? res.end(JSON.stringify({ error: 'Message exceeds maximum length of 1000 characters.' })) : res.send();
            }

            // Rate limit: 1 post per 2 seconds per user
            const now = Date.now();
            const lastTime = lastPostTimes.get(session.sub) || 0;
            if (now - lastTime < 2000) {
                res.writeHead ? res.writeHead(429, { 'Content-Type': 'application/json' }) : res.status(429);
                return res.end ? res.end(JSON.stringify({ error: 'Please wait a moment before sending another message.' })) : res.send();
            }
            lastPostTimes.set(session.sub, now);

            // Channel permissions: Only mentors or admins can post in 'announcements'
            if (channel === 'announcements' && session.role !== 'admin' && session.role !== 'mentor') {
                res.writeHead ? res.writeHead(403, { 'Content-Type': 'application/json' }) : res.status(403);
                return res.end ? res.end(JSON.stringify({ error: 'Only mentors and administrators can post in Announcements.' })) : res.send();
            }

            const student = await StudentService.getUserById(session.sub);
            const senderName = student ? student.full_name : session.fullName || 'Student';
            const senderRole = student ? student.role : session.role || 'student';

            const record = {
                channel,
                sender_id: session.sub,
                sender_name: senderName,
                sender_role: senderRole,
                message: rawMessage,
                is_pinned: false,
                created_at: new Date().toISOString()
            };

            const postUrl = `${SUPABASE_URL}/rest/v1/nusc_chat_messages`;
            const postRes = await fetch(postUrl, {
                method: 'POST',
                headers: Object.assign({}, getHeaders(), { 'Prefer': 'return=representation' }),
                body: JSON.stringify(record)
            });

            if (!postRes.ok) {
                const errText = await postRes.text();
                throw new Error(`Failed to post message: ${errText}`);
            }

            const saved = await postRes.json();
            const resultMsg = Array.isArray(saved) ? saved[0] : saved;

            res.writeHead ? res.writeHead(201, { 'Content-Type': 'application/json' }) : res.status(201);
            res.end ? res.end(JSON.stringify({ success: true, message: resultMsg })) : res.send({ success: true, message: resultMsg });

        } catch (err) {
            res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
            res.end ? res.end(JSON.stringify({ error: err.message })) : res.send({ error: err.message });
        }
        return;
    }

    res.writeHead ? res.writeHead(405, { 'Content-Type': 'application/json' }) : res.status(405);
    res.end ? res.end() : res.send();
};
