/**
 * API: /api/applications
 * Applications Management Endpoint (In-Memory / Pure Ephemeral)
 * No database connection.
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead ? res.writeHead(200) : res.status(200);
        res.end ? res.end() : res.send();
        return;
    }

    // GET /api/applications -> Returns current in-memory applications
    if (req.method === 'GET') {
        const session = DB.requireAuth(req, res);
        if (!session) return;

        const apps = DB.getApplications();

        res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
        const out = JSON.stringify({
            applications: apps,
            count: apps.length
        });
        res.end ? res.end(out) : res.send(out);
        return;
    }

    // POST /api/applications -> Form Submission
    if (req.method === 'POST') {
        const body = await parseBody(req);

        if (!body.fullName || !body.email || !body.firstPreference) {
            res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
            const err = JSON.stringify({ error: 'Missing required applicant fields.' });
            res.end ? res.end(err) : res.send(err);
            return;
        }

        const newApp = DB.saveApplication(body);

        res.writeHead ? res.writeHead(201, { 'Content-Type': 'application/json' }) : res.status(201);
        const out = JSON.stringify({ success: true, application: newApp });
        res.end ? res.end(out) : res.send(out);
        return;
    }

    // PATCH /api/applications -> Admin Update
    if (req.method === 'PATCH') {
        const session = DB.requireAuth(req, res);
        if (!session) return;

        const body = await parseBody(req);
        const id = body.id;
        const updates = Object.assign({}, body.updates || body);
        delete updates.id;

        if (!id) {
            res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
            const err = JSON.stringify({ error: 'Application ID is required.' });
            res.end ? res.end(err) : res.send(err);
            return;
        }

        const updated = DB.updateApplication(id, updates);

        if (!updated) {
            res.writeHead ? res.writeHead(404, { 'Content-Type': 'application/json' }) : res.status(404);
            const err = JSON.stringify({ error: 'Application not found.' });
            res.end ? res.end(err) : res.send(err);
            return;
        }

        res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
        const out = JSON.stringify({ success: true, application: updated });
        res.end ? res.end(out) : res.send(out);
        return;
    }

    // DELETE /api/applications -> Admin Delete
    if (req.method === 'DELETE') {
        const session = DB.requireAuth(req, res);
        if (!session) return;

        const body = await parseBody(req);
        const { id } = body;

        if (!id) {
            res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
            const err = JSON.stringify({ error: 'Application ID is required.' });
            res.end ? res.end(err) : res.send(err);
            return;
        }

        DB.deleteApplication(id);

        res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
        const out = JSON.stringify({ success: true, message: 'Application deleted.' });
        res.end ? res.end(out) : res.send(out);
        return;
    }

    res.writeHead ? res.writeHead(405, { 'Content-Type': 'application/json' }) : res.status(405);
    res.end ? res.end(JSON.stringify({ error: 'Method not allowed' })) : res.send({ error: 'Method not allowed' });
};
