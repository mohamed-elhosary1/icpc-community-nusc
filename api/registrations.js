/**
 * API: /api/registrations
 * Event Registrations Endpoint (Supabase PostgreSQL Persistence)
 * Handles real event signups, server-side university validation, duplicate prevention,
 * unique registration ID issuance, and authorized admin data retrieval.
 */

const DB = require('./_db');
const CloudDB = require('./_cloud');

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

function validateEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email.trim());
}

function validatePhone(phone) {
    if (!phone || typeof phone !== 'string') return false;
    const clean = phone.replace(/[\s\-\(\)\+]/g, '');
    return clean.length >= 8 && clean.length <= 16;
}

const ALLOWED_FACULTIES = [
    'Vet',
    'Pharmacy',
    'Science',
    'Computers and AI',
    'Business',
    'Tourism',
    'Sports'
];

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead ? res.writeHead(200) : res.status(200);
        res.end ? res.end() : res.send();
        return;
    }

    // GET /api/registrations?eventId=... -> Admin View
    if (req.method === 'GET') {
        const session = DB.requireAuth(req, res);
        if (!session) return;

        try {
            const url = new URL(req.url, 'http://localhost');
            const eventId = url.searchParams.get('eventId');
            const code = url.searchParams.get('code');

            if (code) {
                const single = await CloudDB.getRegistrationByCode(code);
                res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
                res.end ? res.end(JSON.stringify({ registration: single })) : res.send({ registration: single });
                return;
            }

            const regs = await CloudDB.getEventRegistrations(eventId);
            res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
            const out = JSON.stringify({
                registrations: regs,
                count: regs.length,
                eventId: eventId || 'all'
            });
            res.end ? res.end(out) : res.send(out);
        } catch (err) {
            console.error('[API registrations GET Error]:', err.message);
            res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
            res.end ? res.end(JSON.stringify({ error: 'Database read failed: ' + err.message })) : res.send({ error: err.message });
        }
        return;
    }

    // POST /api/registrations -> All Event Registrations are completely CLOSED
    if (req.method === 'POST') {
        res.writeHead ? res.writeHead(403, { 'Content-Type': 'application/json' }) : res.status(403);
        const err = JSON.stringify({
            error: 'Event registrations are closed. There are currently no active events open for registration.',
            code: 'REGISTRATIONS_CLOSED'
        });
        res.end ? res.end(err) : res.send(err);
        return;
    }


    res.writeHead ? res.writeHead(405, { 'Content-Type': 'application/json' }) : res.status(405);
    res.end ? res.end(JSON.stringify({ error: 'Method not allowed' })) : res.send({ error: 'Method not allowed' });
};
