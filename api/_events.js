/**
 * API: /api/events
 * Events Management Endpoint
 * Single source of truth for public training schedule and admin events
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead ? res.writeHead(200) : res.status(200);
        res.end ? res.end() : res.send();
        return;
    }

    // GET /api/events -> Returns real events
    if (req.method === 'GET') {
        const events = DB.getEvents();
        res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
        const out = JSON.stringify({ events: events, count: events.length });
        res.end ? res.end(out) : res.send(out);
        return;
    }

    // POST /api/events -> Create Event (Admin Only)
    if (req.method === 'POST') {
        const session = DB.requireAuth(req, res);
        if (!session) return;

        const body = await parseBody(req);
        if (!body.title || !body.category) {
            res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
            const err = JSON.stringify({ error: 'Title and category are required.' });
            res.end ? res.end(err) : res.send(err);
            return;
        }

        const newEvent = DB.saveEvent(body);
        res.writeHead ? res.writeHead(201, { 'Content-Type': 'application/json' }) : res.status(201);
        const out = JSON.stringify({ success: true, event: newEvent });
        res.end ? res.end(out) : res.send(out);
        return;
    }

    // PUT /api/events -> Update Event (Admin Only)
    if (req.method === 'PUT' || req.method === 'PATCH') {
        const session = DB.requireAuth(req, res);
        if (!session) return;

        const body = await parseBody(req);
        const id = body.id;
        const updates = Object.assign({}, body.updates || body);
        delete updates.id;

        if (!id) {
            res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
            const err = JSON.stringify({ error: 'Event ID is required.' });
            res.end ? res.end(err) : res.send(err);
            return;
        }

        const updated = DB.updateEvent(id, updates);
        if (!updated) {
            res.writeHead ? res.writeHead(404, { 'Content-Type': 'application/json' }) : res.status(404);
            const err = JSON.stringify({ error: 'Event not found.' });
            res.end ? res.end(err) : res.send(err);
            return;
        }

        res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
        const out = JSON.stringify({ success: true, event: updated });
        res.end ? res.end(out) : res.send(out);
        return;
    }

    // DELETE /api/events -> Delete Event (Admin Only)
    if (req.method === 'DELETE') {
        const session = DB.requireAuth(req, res);
        if (!session) return;

        const body = await parseBody(req);
        const { id } = body;

        if (!id) {
            res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
            const err = JSON.stringify({ error: 'Event ID is required.' });
            res.end ? res.end(err) : res.send(err);
            return;
        }

        DB.deleteEvent(id);
        res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
        const out = JSON.stringify({ success: true, message: 'Event deleted.' });
        res.end ? res.end(out) : res.send(out);
        return;
    }

    res.writeHead ? res.writeHead(405, { 'Content-Type': 'application/json' }) : res.status(405);
    res.end ? res.end(JSON.stringify({ error: 'Method not allowed' })) : res.send({ error: 'Method not allowed' });
};
