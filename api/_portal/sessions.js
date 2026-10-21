/**
 * API: GET /api/portal/sessions
 * Retrieves the timeline and calendar of community sessions with personal attendance.
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

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead ? res.writeHead(200) : res.status(200);
        return res.end ? res.end() : res.send();
    }

    if (req.method !== 'GET') {
        res.writeHead ? res.writeHead(405, { 'Content-Type': 'application/json' }) : res.status(405);
        return res.end ? res.end(JSON.stringify({ error: 'Method not allowed' })) : res.send();
    }

    try {
        const token = StudentService.extractTokenFromReq(req);
        const session = token ? StudentService.verifyToken(token) : null;
        const studentId = session ? session.sub : null;

        const [sessionsRes, attendanceRes] = await Promise.all([
            fetch(`${SUPABASE_URL}/rest/v1/nusc_sessions?order=session_date.asc`, { headers: getHeaders() }),
            studentId ? fetch(`${SUPABASE_URL}/rest/v1/nusc_attendance?student_id=eq.${encodeURIComponent(studentId)}`, { headers: getHeaders() }) : Promise.resolve(null)
        ]);

        const sessions = sessionsRes.ok ? await sessionsRes.json() : [];
        const attendanceList = (attendanceRes && attendanceRes.ok) ? await attendanceRes.json() : [];

        const attendanceMap = new Map();
        attendanceList.forEach(a => {
            attendanceMap.set(a.session_id, a.status);
        });

        const now = new Date();
        const enriched = sessions.map(s => {
            const sDate = new Date(s.session_date);
            const myStatus = attendanceMap.get(s.id) || null;
            let timelineGroup = 'upcoming';
            if (sDate < now) {
                timelineGroup = 'completed';
            }
            if (s.status === 'cancelled') {
                timelineGroup = 'cancelled';
            }

            return {
                id: s.id,
                title: s.title,
                description: s.description,
                sessionDate: s.session_date,
                durationMinutes: s.duration_minutes || 60,
                speakerName: s.speaker_name,
                wave: s.wave || 'All',
                location: s.location,
                meetingLink: s.meeting_link,
                sessionType: s.session_type,
                prepMaterials: s.prep_materials,
                practiceProblems: s.practice_problems || [],
                status: s.status,
                timelineGroup,
                myAttendanceStatus: myStatus
            };
        });

        res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
        res.end ? res.end(JSON.stringify({ success: true, sessions: enriched })) : res.send({ success: true, sessions: enriched });

    } catch (err) {
        res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
        res.end ? res.end(JSON.stringify({ error: err.message })) : res.send({ error: err.message });
    }
};
