/**
 * ICPC NUSC — Codeforces Official API Integration Layer
 * Robust fetching, verification, caching, and problem-solving analytics.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gpzwlxbmgpmydgywxtdo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_zbshKRcot5UDfjvtMJx4gQ_c9a9-of9';

function getHeaders() {
    return {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
    };
}

// In-memory rate-limiter & request lock
const activeFetches = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes cache

const CodeforcesService = {
    /**
     * Fetch user profile from Codeforces API with fallback to cache
     */
    getUserInfo: async function (rawHandle) {
        if (!rawHandle) return null;
        const handle = rawHandle.trim();

        // 1. Check database cache
        const cacheUrl = `${SUPABASE_URL}/rest/v1/nusc_codeforces_cache?handle=ilike.${encodeURIComponent(handle)}&select=*&limit=1`;
        let cached = null;
        try {
            const cacheRes = await fetch(cacheUrl, { headers: getHeaders() });
            if (cacheRes.ok) {
                const list = await cacheRes.json();
                if (Array.isArray(list) && list.length > 0) {
                    cached = list[0];
                }
            }
        } catch (e) {}

        const now = Date.now();
        if (cached && cached.last_synced_at && (now - new Date(cached.last_synced_at).getTime()) < CACHE_TTL_MS) {
            return cached;
        }

        // 2. Fetch fresh data from Codeforces API
        try {
            const cfUrl = `https://codeforces.com/api/user.info?handles=${encodeURIComponent(handle)}`;
            const res = await fetch(cfUrl, { headers: { 'User-Agent': 'ICPC-NUSC-Platform/1.0' } });
            
            if (!res.ok) {
                if (res.status === 400) {
                    throw new Error(`Codeforces handle "${handle}" not found.`);
                }
                if (cached) return cached; // Fallback to stale cache if CF is down or rate limited
                throw new Error(`Codeforces API returned error status ${res.status}.`);
            }

            const data = await res.json();
            if (data.status !== 'OK' || !Array.isArray(data.result) || data.result.length === 0) {
                if (cached) return cached;
                throw new Error(data.comment || 'Codeforces user not found.');
            }

            const cfUser = data.result[0];

            // 3. Fetch submissions for solved problems count and weekly activity
            let solvedIds = [];
            let weeklyCount = 0;
            let monthlyCount = 0;
            let recentSubmissions = [];

            try {
                const subUrl = `https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=1&count=200`;
                const subRes = await fetch(subUrl, { headers: { 'User-Agent': 'ICPC-NUSC-Platform/1.0' } });
                if (subRes.ok) {
                    const subData = await subRes.json();
                    if (subData.status === 'OK' && Array.isArray(subData.result)) {
                        const oneWeekAgo = (now / 1000) - (7 * 24 * 3600);
                        const oneMonthAgo = (now / 1000) - (30 * 24 * 3600);
                        const uniqueSolvedSet = new Set();

                        subData.result.forEach(sub => {
                            if (sub.verdict === 'OK' && sub.problem) {
                                const probKey = `${sub.problem.contestId}-${sub.problem.index}`;
                                if (!uniqueSolvedSet.has(probKey)) {
                                    uniqueSolvedSet.add(probKey);
                                    if (sub.creationTimeSeconds >= oneWeekAgo) {
                                        weeklyCount++;
                                    }
                                    if (sub.creationTimeSeconds >= oneMonthAgo) {
                                        monthlyCount++;
                                    }
                                }
                            }
                        });

                        solvedIds = Array.from(uniqueSolvedSet);
                        recentSubmissions = subData.result.slice(0, 10).map(s => ({
                            id: s.id,
                            contestId: s.contestId,
                            index: s.problem ? s.problem.index : '',
                            name: s.problem ? s.problem.name : 'Problem',
                            rating: s.problem ? s.problem.rating : null,
                            verdict: s.verdict,
                            time: s.creationTimeSeconds
                        }));
                    }
                }
            } catch (e) {
                console.warn('[CodeforcesService] Warning fetching submissions:', e.message);
            }

            const record = {
                handle: cfUser.handle,
                rating: cfUser.rating || 0,
                max_rating: cfUser.maxRating || 0,
                rank: cfUser.rank || 'Unrated',
                solved_count: solvedIds.length || (cached ? cached.solved_count : 0),
                weekly_solved: weeklyCount,
                monthly_solved: monthlyCount,
                solved_problem_ids: solvedIds,
                recent_submissions: recentSubmissions,
                last_synced_at: new Date().toISOString()
            };

            // Save or update cache in PostgreSQL
            try {
                const upsertUrl = `${SUPABASE_URL}/rest/v1/nusc_codeforces_cache`;
                await fetch(upsertUrl, {
                    method: 'POST',
                    headers: Object.assign({}, getHeaders(), { 'Prefer': 'resolution=merge-duplicates' }),
                    body: JSON.stringify(record)
                });
            } catch (e) {}

            return record;

        } catch (err) {
            if (cached) return cached;
            throw err;
        }
    },

    /**
     * Verify handle ownership via Challenge Token
     * Checks if verification token appears in user's firstName, organization, or city on Codeforces
     */
    verifyOwnership: async function (handle, token) {
        if (!handle || !token) {
            return { verified: false, reason: 'Handle and verification token are required.' };
        }

        try {
            const cfUrl = `https://codeforces.com/api/user.info?handles=${encodeURIComponent(handle.trim())}`;
            const res = await fetch(cfUrl, { headers: { 'User-Agent': 'ICPC-NUSC-Platform/1.0' } });
            if (!res.ok) {
                return { verified: false, reason: 'Could not contact Codeforces API to verify handle.' };
            }

            const data = await res.json();
            if (data.status !== 'OK' || !Array.isArray(data.result) || data.result.length === 0) {
                return { verified: false, reason: 'Codeforces handle does not exist.' };
            }

            const u = data.result[0];
            const cleanToken = token.trim().toUpperCase();

            // Search in profile fields where users can place their verification token
            const fieldsToInspect = [
                u.firstName || '',
                u.lastName || '',
                u.organization || '',
                u.city || ''
            ];

            const found = fieldsToInspect.some(field => field.toUpperCase().includes(cleanToken));

            if (found) {
                return { verified: true, cfUser: u };
            } else {
                return {
                    verified: false,
                    reason: `Verification token "${token}" was not found in your Codeforces profile (First Name, Organization, or City). Please update your Codeforces profile settings and try again.`
                };
            }

        } catch (e) {
            return { verified: false, reason: e.message || 'Verification failed.' };
        }
    }
};

module.exports = CodeforcesService;
