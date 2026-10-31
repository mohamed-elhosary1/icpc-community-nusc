/**
 * API: GET /api/portal/dashboard
 * Aggregated student portal home overview metrics.
 */

const StudentService = require('../_student');
const CodeforcesService = require('../_codeforces');

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

    const token = StudentService.extractTokenFromReq(req);
    const session = StudentService.verifyToken(token);
    if (!session || !session.sub) {
        res.writeHead ? res.writeHead(401, { 'Content-Type': 'application/json' }) : res.status(401);
        return res.end ? res.end(JSON.stringify({ error: 'Authentication required' })) : res.send();
    }

    try {
        const student = await StudentService.getUserById(session.sub);
        if (!student) {
            res.writeHead ? res.writeHead(404, { 'Content-Type': 'application/json' }) : res.status(404);
            return res.end ? res.end(JSON.stringify({ error: 'Student record not found.' })) : res.send();
        }

        const effectiveHandle = student.codeforces_handle || (student.role === 'admin' ? 'Cassidy233' : null);

        // Parallel queries: CF stats, upcoming sessions, attendance, mentor feedback, wave members
        const [cfStats, sessionsRes, attendanceRes, feedbackRes] = await Promise.all([
            effectiveHandle ? CodeforcesService.getUserInfo(effectiveHandle).catch(() => null) : Promise.resolve(null),
            fetch(`${SUPABASE_URL}/rest/v1/nusc_sessions?order=session_date.asc&limit=5`, { headers: getHeaders() }).catch(() => null),
            fetch(`${SUPABASE_URL}/rest/v1/nusc_attendance?student_id=eq.${encodeURIComponent(student.id)}&select=status`, { headers: getHeaders() }).catch(() => null),
            fetch(`${SUPABASE_URL}/rest/v1/nusc_mentor_feedback?or=(student_id.eq.${encodeURIComponent(student.id)},student_id.is.null)&order=created_at.desc&limit=5`, { headers: getHeaders() }).catch(() => null)
        ]);

        const allSessions = (sessionsRes && sessionsRes.ok) ? await sessionsRes.json() : [];
        const attendanceList = (attendanceRes && attendanceRes.ok) ? await attendanceRes.json() : [];
        const feedbackList = (feedbackRes && feedbackRes.ok) ? await feedbackRes.json() : [];

        // Calculate Wave Rank among community members
        let waveRank = 1;
        let totalInWave = 1;
        try {
            const studentWave = student.wave || 'Wave 1';
            const [waveUsersRes, cacheRes] = await Promise.all([
                fetch(`${SUPABASE_URL}/rest/v1/nusc_users?wave=eq.${encodeURIComponent(studentWave)}&status=eq.active&select=id,codeforces_handle`, { headers: getHeaders() }),
                fetch(`${SUPABASE_URL}/rest/v1/nusc_codeforces_cache?select=handle,solved_count,rating`, { headers: getHeaders() })
            ]);

            const waveUsers = waveUsersRes.ok ? await waveUsersRes.json() : [];
            const cacheList = cacheRes.ok ? await cacheRes.json() : [];
            totalInWave = waveUsers.length || 1;

            const cMap = new Map();
            cacheList.forEach(c => { if (c.handle) cMap.set(c.handle.toLowerCase(), c); });

            const myHandle = (effectiveHandle || '').toLowerCase();
            const myCache = cMap.get(myHandle);
            const mySolved = myCache ? (myCache.solved_count || 0) : (cfStats ? (cfStats.solved_count || cfStats.solvedCount || 0) : 0);
            const myRating = myCache ? (myCache.rating || 0) : (cfStats ? (cfStats.rating || 0) : 0);
            const myScore = (mySolved * 10) + Math.round(myRating * 0.2);

            let rankCount = 1;
            for (const u of waveUsers) {
                if (u.id === student.id) continue;
                const uH = (u.codeforces_handle || '').toLowerCase();
                const uCache = cMap.get(uH);
                const uSolved = uCache ? (uCache.solved_count || 0) : 0;
                const uRating = uCache ? (uCache.rating || 0) : 0;
                const uScore = (uSolved * 10) + Math.round(uRating * 0.2);
                if (uScore > myScore) rankCount++;
            }
            waveRank = rankCount;
        } catch (e) {}

        const now = new Date();
        const completedSessions = allSessions.filter(s => s.status === 'completed' || new Date(s.session_date) <= now);
        const totalCompleted = completedSessions.length;
        const attendedSessions = attendanceList.filter(a => a.status === 'present').length;
        const excusedSessions = attendanceList.filter(a => a.status === 'excused').length;
        const accountableSessions = Math.max(0, totalCompleted - excusedSessions);
        const attendancePct = accountableSessions > 0 ? Math.round((attendedSessions / accountableSessions) * 100) : 100;

        const nextSession = allSessions.find(s => new Date(s.session_date) >= now) || allSessions[0] || null;

        const latestAnnouncement = feedbackList.find(f => f.type === 'announcement') || feedbackList[0] || null;
        const unreadFeedbackCount = feedbackList.filter(f => !f.is_read && f.student_id === student.id).length;

        // Recommendations based on level / CF stats
        const recommendations = [];
        if (!effectiveHandle) {
            recommendations.push({
                type: 'action',
                title: 'Connect your Codeforces Account',
                description: 'Link your handle to track your problems solved, progress, and rankings on the leaderboard.',
                link: '/onboarding/codeforces',
                icon: 'link'
            });
        } else if (!student.cf_verified && student.role !== 'admin') {
            recommendations.push({
                type: 'action',
                title: 'Verify Handle Ownership',
                description: 'Complete the simple profile challenge to get the verified badge on your profile.',
                link: '/onboarding/codeforces',
                icon: 'verified'
            });
        }

        if (nextSession) {
            recommendations.push({
                type: 'session',
                title: `Prepare for: ${nextSession.title}`,
                description: nextSession.prep_materials || 'Review foundational algorithms and bring your questions.',
                link: '/portal/sessions',
                icon: 'event'
            });
        }

        let assignedProblem = null;
        for (const f of feedbackList) {
            if (Array.isArray(f.recommended_problems) && f.recommended_problems.length > 0) {
                assignedProblem = f.recommended_problems[0];
                break;
            }
        }

        if (assignedProblem) {
            recommendations.push({
                type: 'practice',
                title: `Assigned: ${assignedProblem.name || assignedProblem.title || 'Practice Problem'}`,
                description: assignedProblem.topic || assignedProblem.description || 'Recommended by your coach/mentor.',
                link: assignedProblem.url || '/portal/mentors',
                icon: 'assignment'
            });
        } else if (effectiveHandle) {
            recommendations.push({
                type: 'practice',
                title: 'Practice on Codeforces',
                description: 'Solve problems at your target rating to boost your problem count and climb the leaderboard.',
                link: 'https://codeforces.com/problemset',
                icon: 'code'
            });
        }

        res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
        res.end ? res.end(JSON.stringify({
            success: true,
            student: {
                id: student.id,
                fullName: student.full_name,
                email: student.email,
                wave: student.wave || 'Wave 1',
                role: student.role,
                faculty: student.faculty,
                codeforcesHandle: effectiveHandle,
                cfVerified: student.cf_verified,
                cfVerificationToken: student.cf_verification_token,
                avatarUrl: student.avatar_url
            },
            codeforces: {
                rating: cfStats ? (cfStats.rating || 0) : 0,
                maxRating: cfStats ? (cfStats.max_rating || cfStats.maxRating || 0) : 0,
                max_rating: cfStats ? (cfStats.max_rating || cfStats.maxRating || 0) : 0,
                rank: cfStats ? (cfStats.rank || 'Unrated') : 'Unrated',
                solvedCount: cfStats ? (cfStats.solved_count || cfStats.solvedCount || 0) : 0,
                solved_count: cfStats ? (cfStats.solved_count || cfStats.solvedCount || 0) : 0,
                weeklySolved: cfStats ? (cfStats.weekly_solved || cfStats.weeklySolved || 0) : 0,
                weekly_solved: cfStats ? (cfStats.weekly_solved || cfStats.weeklySolved || 0) : 0,
                monthlySolved: cfStats ? (cfStats.monthly_solved || cfStats.monthlySolved || 0) : 0,
                monthly_solved: cfStats ? (cfStats.monthly_solved || cfStats.monthlySolved || 0) : 0,
                recentSubmissions: (cfStats && cfStats.recent_submissions) ? cfStats.recent_submissions : []
            },
            waveRank,
            totalInWave,
            attendance: {
                totalScheduled: totalCompleted,
                attended: attendedSessions,
                absences: Math.max(0, totalCompleted - attendedSessions - excusedSessions),
                percentage: attendancePct
            },
            nextSession,
            announcement: latestAnnouncement,
            unreadFeedbackCount,
            recommendations
        })) : res.send();

    } catch (err) {
        console.error('[dashboard API error]:', err);
        res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
        res.end ? res.end(JSON.stringify({ error: err.message })) : res.send({ error: err.message });
    }
};
