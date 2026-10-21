/**
 * API: GET /api/portal/leaderboard
 * Transparent, multi-view leaderboard with real student records and scoring.
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
        const urlObj = new URL(req.url, 'http://localhost');
        const category = urlObj.searchParams.get('category') || 'weekly'; // weekly, monthly, all_time, wave, most_improved
        const waveFilter = urlObj.searchParams.get('wave');

        // Optional token to identify current user position
        const token = StudentService.extractTokenFromReq(req);
        const session = token ? StudentService.verifyToken(token) : null;
        const currentUserId = session ? session.sub : null;

        // Fetch students and CF cache
        const [usersRes, cacheRes] = await Promise.all([
            fetch(`${SUPABASE_URL}/rest/v1/nusc_users?select=id,full_name,wave,codeforces_handle,cf_verified,avatar_url&status=eq.active`, { headers: getHeaders() }),
            fetch(`${SUPABASE_URL}/rest/v1/nusc_codeforces_cache?select=*`, { headers: getHeaders() })
        ]);

        const users = usersRes.ok ? await usersRes.json() : [];
        const cacheList = cacheRes.ok ? await cacheRes.json() : [];

        const cacheMap = new Map();
        cacheList.forEach(c => {
            if (c.handle) cacheMap.set(c.handle.toLowerCase(), c);
        });

        // Compute scores
        let list = users.map(u => {
            const cf = u.codeforces_handle ? cacheMap.get(u.codeforces_handle.toLowerCase()) : null;
            const solved = cf ? (cf.solved_count || 0) : 0;
            const weeklySolved = cf ? (cf.weekly_solved || 0) : 0;
            const monthlySolved = cf ? (cf.monthly_solved || 0) : 0;
            const rating = cf ? (cf.rating || 0) : 0;
            const maxRating = cf ? (cf.max_rating || 0) : 0;
            const rank = cf ? (cf.rank || 'Unrated') : 'Unrated';

            // Custom ICC Score Formula: (solved * 10) + (weeklySolved * 25) + Math.round(rating * 0.2)
            const iccScore = (solved * 10) + (weeklySolved * 25) + Math.round(rating * 0.2);

            return {
                id: u.id,
                fullName: u.full_name,
                wave: u.wave || 'Wave 1',
                handle: u.codeforces_handle || null,
                cfVerified: !!u.cf_verified,
                avatarUrl: u.avatar_url || null,
                solved,
                weeklySolved,
                monthlySolved,
                rating,
                maxRating,
                rank,
                iccScore,
                isCurrentStudent: u.id === currentUserId
            };
        });

        // Filter by Wave if requested
        if (waveFilter && waveFilter !== 'All') {
            list = list.filter(item => item.wave.toLowerCase() === waveFilter.toLowerCase());
        }

        // Sort based on category
        if (category === 'weekly') {
            list.sort((a, b) => (b.weeklySolved - a.weeklySolved) || (b.rating - a.rating) || (b.solved - a.solved));
        } else if (category === 'monthly') {
            list.sort((a, b) => (b.monthlySolved - a.monthlySolved) || (b.rating - a.rating) || (b.solved - a.solved));
        } else if (category === 'wave') {
            list.sort((a, b) => (b.solved - a.solved) || (b.rating - a.rating));
        } else if (category === 'most_improved') {
            list.sort((a, b) => (b.weeklySolved - a.weeklySolved) || (b.rating - a.rating));
        } else {
            // all_time
            list.sort((a, b) => (b.iccScore - a.iccScore) || (b.solved - a.solved) || (b.rating - a.rating));
        }

        // Add rank indices
        const rankedList = list.map((item, index) => ({
            ...item,
            rankPosition: index + 1
        }));

        const currentStudentRank = rankedList.find(r => r.isCurrentStudent) || null;

        res.writeHead ? res.writeHead(200, { 'Content-Type': 'application/json' }) : res.status(200);
        res.end ? res.end(JSON.stringify({
            success: true,
            category,
            totalStudents: rankedList.length,
            currentStudentRank,
            methodology: {
                formula: 'ICC Score = (Solved Problems × 10) + (Weekly Solved × 25) + (Rating × 0.2)',
                timeframe: category === 'weekly' ? 'Last 7 Days Activity' : category === 'monthly' ? 'Last 30 Days Activity' : 'All-Time Cumulative',
                dataSource: 'Codeforces Official API + ICPC NUSC Database'
            },
            rankings: rankedList
        })) : res.send();

    } catch (err) {
        res.writeHead ? res.writeHead(500, { 'Content-Type': 'application/json' }) : res.status(500);
        res.end ? res.end(JSON.stringify({ error: err.message })) : res.send({ error: err.message });
    }
};
