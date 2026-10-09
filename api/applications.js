/**
 * API: /api/applications
 * Applications Management Endpoint (Supabase PostgreSQL Persistence)
 * Saves all organizing team applications directly to the production database.
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

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead ? res.writeHead(200) : res.status(200);
        res.end ? res.end() : res.send();
        return;
    }

    // GET /api/applications -> Returns applications directly from production database
    if (req.method === 'GET') {
        const session = DB.requireAuth(req, res);
        if (!session) return;

        try {
            const apps = await CloudDB.getApplications();
            res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
            const out = JSON.stringify({
                applications: apps,
                count: apps.length
            });
            res.end ? res.end(out) : res.send(out);
        } catch (err) {
            console.error('[API applications GET Error]:', err.message);
            res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
            res.end ? res.end(JSON.stringify({ error: 'Database read failed: ' + err.message })) : res.send({ error: err.message });
        }
        return;
    }

    // POST /api/applications -> Form Submission directly into PostgreSQL
    if (req.method === 'POST') {
        const body = await parseBody(req);

        if (!body.fullName || !body.email || !body.firstPreference) {
            res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
            const err = JSON.stringify({ error: 'Missing required applicant fields.' });
            res.end ? res.end(err) : res.send(err);
            return;
        }

        try {
            const newApp = await CloudDB.saveApplication(body);
            res.writeHead ? res.writeHead(201, { 'Content-Type': 'application/json' }) : res.status(201);
            const out = JSON.stringify({ success: true, application: newApp });
            res.end ? res.end(out) : res.send(out);
        } catch (err) {
            console.error('[API applications POST Error]:', err.message);
            res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
            const errOut = JSON.stringify({ error: 'Database persistence error: ' + err.message });
            res.end ? res.end(errOut) : res.send(errOut);
        }
        return;
    }

    // PATCH /api/applications -> Admin Update in PostgreSQL
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

        try {
            const updated = await CloudDB.updateApplication(id, updates);
            if (!updated) {
                res.writeHead ? res.writeHead(404, { 'Content-Type': 'application/json' }) : res.status(404);
                const err = JSON.stringify({ error: 'Application not found.' });
                res.end ? res.end(err) : res.send(err);
                return;
            }

            res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
            const out = JSON.stringify({ success: true, application: updated });
            res.end ? res.end(out) : res.send(out);
        } catch (err) {
            console.error('[API applications PATCH Error]:', err.message);
            res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
            res.end ? res.end(JSON.stringify({ error: err.message })) : res.send({ error: err.message });
        }
        return;
    }

    // DELETE /api/applications -> Admin Delete in PostgreSQL
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

        try {
            await CloudDB.deleteApplication(id);
            res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
            const out = JSON.stringify({ success: true, message: 'Application deleted from database.' });
            res.end ? res.end(out) : res.send(out);
        } catch (err) {
            console.error('[API applications DELETE Error]:', err.message);
            res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
            res.end ? res.end(JSON.stringify({ error: err.message })) : res.send({ error: err.message });
        }
        return;
    }

    res.writeHead ? res.writeHead(405, { 'Content-Type': 'application/json' }) : res.status(405);
    res.end ? res.end(JSON.stringify({ error: 'Method not allowed' })) : res.send({ error: 'Method not allowed' });
};
