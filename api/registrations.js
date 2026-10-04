/**
 * API: /api/registrations
 * Event Registrations Endpoint
 * Real participant signups & Admin Tracking
 */

const DB = require('./_db');

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

        const url = new URL(req.url, 'http://localhost');
        const eventId = url.searchParams.get('eventId') || 'evt_programming_basics';
        const regs = DB.getRegistrations(eventId);

        res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
        const out = JSON.stringify({ registrations: regs, count: regs.length, eventId: eventId });
        res.end ? res.end(out) : res.send(out);
        return;
    }

    // POST /api/registrations -> Public Signup for Workshop
    if (req.method === 'POST') {
        const body = await parseBody(req);
        const { eventId, fullName, email, phone, university } = body;

        if (!fullName || !email) {
            res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
            const err = JSON.stringify({ error: 'Full name and email are required.' });
            res.end ? res.end(err) : res.send(err);
            return;
        }

        const targetEvent = eventId || 'evt_programming_basics';
        const newReg = DB.saveRegistration(targetEvent, { fullName, email, phone, university });

        res.writeHead ? res.writeHead(201, { 'Content-Type': 'application/json' }) : res.status(201);
        const out = JSON.stringify({ success: true, registration: newReg });
        res.end ? res.end(out) : res.send(out);
        return;
    }

    // PATCH /api/registrations -> Update Status
    if (req.method === 'PATCH') {
        const session = DB.requireAuth(req, res);
        if (!session) return;

        const body = await parseBody(req);
        const { eventId, regId, status } = body;

        if (!eventId || !regId || !status) {
            res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
            const err = JSON.stringify({ error: 'eventId, regId, and status are required.' });
            res.end ? res.end(err) : res.send(err);
            return;
        }

        const updated = DB.updateRegistrationStatus(eventId, regId, status);
        res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
        const out = JSON.stringify({ success: true, registration: updated });
        res.end ? res.end(out) : res.send(out);
        return;
    }

    res.writeHead ? res.writeHead(405, { 'Content-Type': 'application/json' }) : res.status(405);
    res.end ? res.end(JSON.stringify({ error: 'Method not allowed' })) : res.send({ error: 'Method not allowed' });
};
