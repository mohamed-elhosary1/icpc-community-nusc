/**
 * API: /api/questions
 * Question Catalog Endpoint
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

    // GET /api/questions?dept=...
    if (req.method === 'GET') {
        const url = new URL(req.url, 'http://localhost');
        const dept = url.searchParams.get('dept') || 'all';
        const qs = DB.getQuestions(dept);

        res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
        const out = JSON.stringify({ questions: qs, count: qs.length });
        res.end ? res.end(out) : res.send(out);
        return;
    }

    // POST /api/questions (Admin Only)
    if (req.method === 'POST') {
        const session = DB.requireAuth(req, res);
        if (!session) return;

        const body = await parseBody(req);
        if (!body.question || !body.department) {
            res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
            const err = JSON.stringify({ error: 'Question text and department are required.' });
            res.end ? res.end(err) : res.send(err);
            return;
        }

        const newQ = DB.saveQuestion(body);
        res.writeHead ? res.writeHead(201, { 'Content-Type': 'application/json' }) : res.status(201);
        const out = JSON.stringify({ success: true, question: newQ });
        res.end ? res.end(out) : res.send(out);
        return;
    }

    // PATCH /api/questions (Admin Only)
    if (req.method === 'PATCH') {
        const session = DB.requireAuth(req, res);
        if (!session) return;

        const body = await parseBody(req);
        const { id, updates } = body;

        if (!id) {
            res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
            const err = JSON.stringify({ error: 'Question ID is required.' });
            res.end ? res.end(err) : res.send(err);
            return;
        }

        const updated = DB.updateQuestion(id, updates || {});
        res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
        const out = JSON.stringify({ success: true, question: updated });
        res.end ? res.end(out) : res.send(out);
        return;
    }

    res.writeHead ? res.writeHead(405, { 'Content-Type': 'application/json' }) : res.status(405);
    res.end ? res.end(JSON.stringify({ error: 'Method not allowed' })) : res.send({ error: 'Method not allowed' });
};
