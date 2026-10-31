/**
 * ICPC NUSC — Codeforces Official API Integration Layer
 * Robust fetching, verification, caching, and problem-solving analytics.
 * Fully supports official Codeforces API Key and Secret SHA-512 authentication,
 * plus Codeforces Group management, private group contests, and standings.
 */

const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gpzwlxbmgpmydgywxtdo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_zbshKRcot5UDfjvtMJx4gQ_c9a9-of9';

// In-memory runtime config cache
let runtimeConfig = null;
let lastConfigLoad = 0;
const CONFIG_CACHE_TTL = 60 * 1000; // 1 minute

function getHeaders() {
    return {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
    };
}

/**
 * Loads Codeforces API configuration from database or environment variables
 */
async function loadConfig() {
    const now = Date.now();
    if (runtimeConfig && (now - lastConfigLoad) < CONFIG_CACHE_TTL) {
        return runtimeConfig;
    }

    let dbConfig = null;
    try {
        const url = `${SUPABASE_URL}/rest/v1/nusc_codeforces_cache?handle=eq.__cf_group_config__&select=*&limit=1`;
        const res = await fetch(url, { headers: getHeaders() });
        if (res.ok) {
            const list = await res.json();
            if (Array.isArray(list) && list.length > 0 && Array.isArray(list[0].recent_submissions)) {
                // Stored as key-value pairs in recent_submissions
                const map = {};
                list[0].recent_submissions.forEach(item => {
                    if (item && item.key) map[item.key] = item.value;
                });
                dbConfig = map;
            }
        }
    } catch (e) {}

    const apiKey = (dbConfig && dbConfig.api_key) || (process.env.CODEFORCES_API_KEY || '').trim();
    const apiSecret = (dbConfig && dbConfig.api_secret) || (process.env.CODEFORCES_API_SECRET || '').trim();
    const groupId = (dbConfig && dbConfig.group_id) || (process.env.CODEFORCES_GROUP_ID || '').trim();
    const managerHandle = (dbConfig && dbConfig.manager_handle) || (process.env.CODEFORCES_MANAGER_HANDLE || '').trim();
    const lastVerified = (dbConfig && dbConfig.last_verified) || null;

    runtimeConfig = {
        apiKey,
        apiSecret,
        groupId,
        managerHandle,
        lastVerified
    };
    lastConfigLoad = now;
    return runtimeConfig;
}

/**
 * Builds an authorized Codeforces API URL according to the official spec:
 * https://codeforces.com/apiHelp
 * If apiKey and apiSecret are present, signs with SHA-512 apiSig.
 */
function buildCodeforcesUrl(methodName, params = {}, customAuth = null) {
    const allParams = { ...params };
    const apiKey = (customAuth && customAuth.apiKey) || (runtimeConfig && runtimeConfig.apiKey) || (process.env.CODEFORCES_API_KEY || '').trim();
    const apiSecret = (customAuth && customAuth.apiSecret) || (runtimeConfig && runtimeConfig.apiSecret) || (process.env.CODEFORCES_API_SECRET || '').trim();

    if (apiKey && apiSecret) {
        allParams.apiKey = apiKey;
        allParams.time = Math.floor(Date.now() / 1000);

        // Sort keys lexicographically
        const sortedKeys = Object.keys(allParams).sort();
        const paramPairs = [];
        for (const k of sortedKeys) {
            paramPairs.push(`${k}=${allParams[k]}`);
        }
        const sortedParamStr = paramPairs.join('&');

        // 6-digit random alphanumeric prefix
        const rand = crypto.randomBytes(3).toString('hex').toLowerCase();
        const textToHash = `${rand}/${methodName}?${sortedParamStr}#${apiSecret}`;
        const hash = crypto.createHash('sha512').update(textToHash).digest('hex');
        allParams.apiSig = `${rand}${hash}`;
    }

    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(allParams)) {
        query.append(k, v);
    }
    return `https://codeforces.com/api/${methodName}?${query.toString()}`;
}

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes cache

const CodeforcesService = {
    buildCodeforcesUrl,
    loadConfig,

    /**
     * Check if Codeforces API credentials are configured
     */
    hasApiCredentials: async function () {
        const config = await loadConfig();
        return !!(config.apiKey && config.apiSecret);
    },

    /**
     * Safe client-facing view of Codeforces Configuration
     */
    getGroupConfig: async function () {
        const config = await loadConfig();
        const maskedKey = config.apiKey ? (config.apiKey.length > 8 ? `${config.apiKey.slice(0, 4)}••••••••${config.apiKey.slice(-4)}` : '••••••••') : '';
        return {
            configured: !!(config.apiKey && config.apiSecret),
            hasSecret: !!config.apiSecret,
            apiKeyMasked: maskedKey,
            groupId: config.groupId || '',
            groupUrl: config.groupId ? `https://codeforces.com/group/${config.groupId}` : '',
            managerHandle: config.managerHandle || '',
            lastVerified: config.lastVerified
        };
    },

    /**
     * Save Codeforces API & Group configuration into database
     */
    saveGroupConfig: async function ({ apiKey, apiSecret, groupId, managerHandle }) {
        const current = await loadConfig();
        const newApiKey = apiKey !== undefined ? (apiKey || '').trim() : current.apiKey;
        const newApiSecret = apiSecret !== undefined ? (apiSecret || '').trim() : current.apiSecret;
        const newGroupId = groupId !== undefined ? (groupId || '').trim() : current.groupId;
        const newManager = managerHandle !== undefined ? (managerHandle || '').trim() : current.managerHandle;

        const submissions = [
            { key: 'api_key', value: newApiKey },
            { key: 'api_secret', value: newApiSecret },
            { key: 'group_id', value: newGroupId },
            { key: 'manager_handle', value: newManager },
            { key: 'last_verified', value: new Date().toISOString() }
        ];

        const record = {
            handle: '__cf_group_config__',
            rating: 0,
            max_rating: 0,
            rank: 'Config',
            solved_count: 0,
            weekly_solved: 0,
            monthly_solved: 0,
            solved_problem_ids: [],
            recent_submissions: submissions,
            last_synced_at: new Date().toISOString()
        };

        const upsertUrl = `${SUPABASE_URL}/rest/v1/nusc_codeforces_cache`;
        const res = await fetch(upsertUrl, {
            method: 'POST',
            headers: Object.assign({}, getHeaders(), { 'Prefer': 'resolution=merge-duplicates' }),
            body: JSON.stringify(record)
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Failed to save Codeforces config: ${err}`);
        }

        // Invalidate in-memory cache
        runtimeConfig = {
            apiKey: newApiKey,
            apiSecret: newApiSecret,
            groupId: newGroupId,
            managerHandle: newManager,
            lastVerified: new Date().toISOString()
        };
        lastConfigLoad = Date.now();

        return this.getGroupConfig();
    },

    /**
     * Test and verify Codeforces API credentials live
     */
    testApiCredentials: async function (customAuth = null) {
        let auth = customAuth;
        if (!auth) {
            const config = await loadConfig();
            auth = {
                apiKey: config.apiKey,
                apiSecret: config.apiSecret,
                managerHandle: config.managerHandle
            };
        }

        if (!auth.apiKey || !auth.apiSecret) {
            return {
                configured: false,
                valid: false,
                message: 'Codeforces API Key and Secret are not configured.'
            };
        }

        try {
            // Test query on user.info for manager handle or tourist
            const targetHandle = auth.managerHandle || 'tourist';
            const testUrl = buildCodeforcesUrl('user.info', { handles: targetHandle }, auth);
            const res = await fetch(testUrl, { headers: { 'User-Agent': 'ICPC-NUSC-Platform/1.0' } });
            const data = await res.json();

            if (data.status === 'OK' && Array.isArray(data.result) && data.result.length > 0) {
                const user = data.result[0];
                return {
                    configured: true,
                    valid: true,
                    message: `Verified successfully! Codeforces authenticated via SHA-512 signature.`,
                    testedUser: {
                        handle: user.handle,
                        rating: user.rating || 0,
                        rank: user.rank || 'Unrated',
                        organization: user.organization || 'None'
                    }
                };
            } else {
                return {
                    configured: true,
                    valid: false,
                    message: data.comment || 'Codeforces API rejected the signature or credentials.'
                };
            }
        } catch (e) {
            return {
                configured: true,
                valid: false,
                message: e.message || 'Error connecting to Codeforces API.'
            };
        }
    },

    /**
     * Fetch standings for a group contest
     * Uses manager authentication (asManager=true) to retrieve full standings including group-only and unofficial rows
     */
    getGroupStandings: async function (contestId, options = {}) {
        await loadConfig();
        if (!contestId) throw new Error('contestId is required');

        const params = {
            contestId: String(contestId),
            from: options.from || 1,
            count: options.count || 100,
            showUnofficial: options.showUnofficial !== false ? 'true' : 'false'
        };

        if (options.asManager !== false && (runtimeConfig && runtimeConfig.apiKey)) {
            params.asManager = 'true';
        }

        const url = buildCodeforcesUrl('contest.standings', params);
        const res = await fetch(url, { headers: { 'User-Agent': 'ICPC-NUSC-Platform/1.0' } });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Codeforces contest.standings failed (${res.status}): ${text}`);
        }

        const data = await res.json();
        if (data.status !== 'OK') {
            throw new Error(data.comment || 'Failed to fetch contest standings.');
        }

        return data.result;
    },

    /**
     * Fetch user profile from Codeforces API with fallback to cache
     */
    getUserInfo: async function (rawHandle, forceRefresh = false) {
        if (!rawHandle) return null;
        const handle = rawHandle.trim();
        await loadConfig();

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
        if (!forceRefresh && cached && cached.last_synced_at && (now - new Date(cached.last_synced_at).getTime()) < CACHE_TTL_MS) {
            return cached;
        }

        // 2. Fetch fresh data from Codeforces API
        try {
            const cfUrl = buildCodeforcesUrl('user.info', { handles: handle });
            const res = await fetch(cfUrl, { headers: { 'User-Agent': 'ICPC-NUSC-Platform/1.0' } });
            
            if (!res.ok) {
                if (res.status === 400) {
                    throw new Error(`Codeforces handle "${handle}" not found.`);
                }
                if (cached) return cached;
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
                const subUrl = buildCodeforcesUrl('user.status', { handle: handle, from: 1, count: 200 });
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
     */
    verifyOwnership: async function (handle, token) {
        if (!handle || !token) {
            return { verified: false, reason: 'Handle and verification token are required.' };
        }
        await loadConfig();

        try {
            const cfUrl = buildCodeforcesUrl('user.info', { handles: handle.trim() });
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
