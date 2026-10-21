/**
 * API: /api/participants
 * Participant Training Recruitment Registration & Management
 * Integrated with Supabase PostgreSQL (public.nusc_participants).
 */

const DB = require('./_db');
const CloudDB = require('./_cloud');

const ALLOWED_FACULTIES = [
    'Computers and AI',
    'Science',
    'Vet',
    'Pharmacy',
    'Business',
    'Tourism',
    'Sports'
];

function validateEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email.trim());
}

function validatePhone(phone) {
    if (!phone || typeof phone !== 'string') return false;
    const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
    const re = /^(\+?20|0020)?0?1[0125]\d{8}$/; // Egyptian mobile standard
    const intlRe = /^\+?[1-9]\d{7,14}$/; // International fallback
    return re.test(cleaned) || intlRe.test(cleaned);
}

function parseBody(req) {
    return new Promise((resolve) => {
        if (req.body && typeof req.body === 'object') {
            return resolve(req.body);
        }
        let data = '';
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => {
            try {
                resolve(data ? JSON.parse(data) : {});
            } catch (e) {
                resolve({});
            }
        });
    });
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead ? res.writeHead(200) : res.status(200);
        res.end ? res.end() : res.send();
        return;
    }

    // GET /api/participants
    if (req.method === 'GET') {
        const urlObj = new URL(req.url, 'http://localhost');
        const lookup = urlObj.searchParams.get('id') || urlObj.searchParams.get('lookup') || urlObj.searchParams.get('email') || urlObj.searchParams.get('phone');

        // Public Participant Lookup / Status Check
        if (lookup) {
            try {
                const part = await CloudDB.getParticipantByQuery(lookup);
                if (!part) {
                    res.writeHead ? res.writeHead(404, { 'Content-Type': 'application/json' }) : res.status(404);
                    const out = JSON.stringify({ error: 'No participant registration found matching this query.' });
                    res.end ? res.end(out) : res.send(out);
                    return;
                }
                res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
                const out = JSON.stringify({ success: true, participant: part });
                res.end ? res.end(out) : res.send(out);
                return;
            } catch (err) {
                console.error('[API participant lookup error]:', err.message);
                res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
                res.end ? res.end(JSON.stringify({ error: 'Lookup failed: ' + err.message })) : res.send({ error: err.message });
                return;
            }
        }

        // Admin Listing (Auth required)
        const session = DB.requireAuth(req, res);
        if (!session) return;

        try {
            const list = await CloudDB.getParticipants();
            res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
            const out = JSON.stringify({
                success: true,
                participants: list,
                count: list.length
            });
            res.end ? res.end(out) : res.send(out);
        } catch (err) {
            console.error('[API participants GET Error]:', err.message);
            res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
            res.end ? res.end(JSON.stringify({ error: 'Database read failed: ' + err.message })) : res.send({ error: err.message });
        }
        return;
    }

    // POST /api/participants -> Recruitment is officially CLOSED
    if (req.method === 'POST') {
        res.writeHead ? res.writeHead(403, { 'Content-Type': 'application/json' }) : res.status(403);
        const err = JSON.stringify({
            error: 'Participant recruitment is now officially closed. Thank you for your interest!',
            code: 'RECRUITMENT_CLOSED'
        });
        res.end ? res.end(err) : res.send(err);
        return;
    }

    res.writeHead ? res.writeHead(405, { 'Content-Type': 'application/json' }) : res.status(405);
    res.end ? res.end(JSON.stringify({ error: 'Method not allowed' })) : res.send({ error: 'Method not allowed' });
};
