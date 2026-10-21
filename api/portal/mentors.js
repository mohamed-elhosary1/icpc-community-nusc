/**
 * API: /api/portal/mentors
 * GET: Retrieves mentor announcements, personal feedback, and recommended problems.
 * POST: Marks feedback as read.
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

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead ? res.writeHead(200) : res.status(200);
        return res.end ? res.end() : res.send();
    }

    const token = StudentService.extractTokenFromReq(req);
    const session = StudentService.verifyToken(token);
    if (!session || !session.sub) {
        res.writeHead ? res.writeHead(401, { 'Content-Type': 'application/json' }) : res.status(401);
        return res.end ? res.end(JSON.stringify({ error: 'Authentication required' })) : res.send();
    }

    // POST: Mark feedback as read
    if (req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const { feedbackId } = body;
            if (!feedbackId) {
                res.writeHead ? res.writeHead(400, { 'Content-Type': 'application/json' }) : res.status(400);
                return res.end ? res.end(JSON.stringify({ error: 'feedbackId is required' })) : res.send();
            }

            const patchUrl = `${SUPABASE_URL}/rest/v1/nusc_mentor_feedback?id=eq.${encodeURIComponent(feedbackId)}&student_id=eq.${encodeURIComponent(session.sub)}`;
            await fetch(patchUrl, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify({ is_read: true })
            });

            res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
            return res.end ? res.end(JSON.stringify({ success: true })) : res.send({ success: true });
        } catch (e) {
            res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
            return res.end ? res.end(JSON.stringify({ error: e.message })) : res.send();
        }
    }

    // GET: Retrieve mentor communication
    if (req.method === 'GET') {
        try {
            const studentId = session.sub;
            // Fetch broadcast announcements + personal feedback
            const queryUrl = `${SUPABASE_URL}/rest/v1/nusc_mentor_feedback?or=(student_id.eq.${encodeURIComponent(studentId)},student_id.is.null)&order=created_at.desc`;
            const resFeedback = await fetch(queryUrl, { headers: getHeaders() });
            const list = resFeedback.ok ? await resFeedback.json() : [];

            const announcements = list.filter(item => item.type === 'announcement' || !item.student_id);
            const personalFeedback = list.filter(item => item.student_id === studentId);
            const recommendedProblems = [];

            list.forEach(item => {
                if (Array.isArray(item.recommended_problems)) {
                    item.recommended_problems.forEach(p => recommendedProblems.push(p));
                }
            });

            res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
            res.end ? res.end(JSON.stringify({
                success: true,
                assignedMentor: {
                    name: 'Coach Abdel Aleem Ahmed',
                    title: 'Head Coach & ICPC World Finalist',
                    organization: 'Coach Academy',
                    avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAdDSXRwoLr7_6ZT2w9ac0W9EX9KZbVHd25e_T4U3bGOyw4biruty7T5e1NIQd_TcQftKvl3T6j0yZ13FdSI9c8WVYzBu0CZrseQnNbJmwoKrfqls9xBihJRNDEnT8xWegEnOek4uVd0H0w1n3MxsebhgQLT5ENEq5_9QEaXFrvLHLHbL5_Bvjh7J2KJULA2zUQL3fyh_wMTBHRBFh8OjrsM7KPnngiPTUFGVaKw5qy7W1sbmNasqgKrEaTM_mzbwklZA'
                },
                announcements,
                personalFeedback,
                recommendedProblems
            })) : res.send();

        } catch (err) {
            res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
            res.end ? res.end(JSON.stringify({ error: err.message })) : res.send({ error: err.message });
        }
    }
};
