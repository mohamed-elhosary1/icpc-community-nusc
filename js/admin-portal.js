/**
 * ICPC NUSC — Admin Student Portal Extension
 * Handles: Students, Access Codes & CSV Import/Export, Sessions, Attendance, and Mentor Feedback.
 */

window.AdminPortal = (function() {
    'use strict';

    let allStudents = [];
    let allCodes = [];
    let allSessions = [];
    let currentAttendanceSessionId = null;

    function getAdminAuthHeaders() {
        let token = '';
        if (window.NUSC_AUTH && typeof window.NUSC_AUTH.getToken === 'function') {
            token = window.NUSC_AUTH.getToken();
        }
        if (!token) {
            token = localStorage.getItem('NUSC_REAL_AUTH_TOKEN') || '';
            if (typeof token === 'string' && token.startsWith('"') && token.endsWith('"')) {
                try { token = JSON.parse(token); } catch(e) {}
            }
        }
        const h = { 'Content-Type': 'application/json' };
        if (token) h['Authorization'] = 'Bearer ' + token;
        return h;
    }

    function showToast(msg, isError = false) {
        if (typeof window.showToast === 'function') {
            window.showToast(msg);
            return;
        }
        let t = document.getElementById('admin-portal-toast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'admin-portal-toast';
            t.className = 'fixed bottom-5 right-5 z-50 px-4 py-2 pixel-border font-label text-xs shadow-lg transition-all';
            document.body.appendChild(t);
        }
        t.style.backgroundColor = isError ? '#920907' : '#002e69';
        t.style.borderColor = isError ? '#f87171' : '#fea520';
        t.style.color = '#ffffff';
        t.textContent = msg;
        t.style.display = 'block';
        setTimeout(() => { if (t) t.style.display = 'none'; }, 3500);
    }

    function escapeHTML(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // =========================================================================
    // 1. STUDENTS MANAGEMENT
    // =========================================================================
    async function loadStudents() {
        const tbody = document.getElementById('students-table-body');
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-xs text-cream-dark/60 font-mono"><span class="animate-pulse">Loading students from database...</span></td></tr>`;

        try {
            const wave = document.getElementById('students-wave-filter')?.value || 'All';
            const status = document.getElementById('students-status-filter')?.value || 'All';
            const search = document.getElementById('students-search')?.value || '';

            let url = `/api/admin/students?wave=${encodeURIComponent(wave)}&status=${encodeURIComponent(status)}`;
            if (search) url += `&search=${encodeURIComponent(search)}`;

            const res = await fetch(url, { headers: getAdminAuthHeaders() });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            allStudents = data.students || [];

            renderStudentsList(allStudents);
            updateStudentStats(allStudents);
        } catch (e) {
            console.error('Failed to load students:', e);
            if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-xs text-red-400">Failed to load students: ${escapeHTML(e.message)}</td></tr>`;
        }
    }

    function updateStudentStats(students) {
        const totalEl = document.getElementById('stat-portal-students-total');
        const cfVerifiedEl = document.getElementById('stat-portal-cf-verified');
        const activeEl = document.getElementById('stat-portal-active');

        if (totalEl) totalEl.textContent = students.length;
        if (cfVerifiedEl) cfVerifiedEl.textContent = students.filter(s => s.cfVerified).length;
        if (activeEl) activeEl.textContent = students.filter(s => s.status === 'active').length;
    }

    function renderStudentsList(students) {
        const tbody = document.getElementById('students-table-body');
        if (!tbody) return;

        if (students.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-xs text-cream-dark/60 font-mono">No registered students found.</td></tr>`;
            return;
        }

        tbody.innerHTML = students.map(s => {
            const waveBadgeClass = s.wave === 'Wave 3' ? 'border-purple-400 text-purple-300 bg-purple-900/30' :
                                   s.wave === 'Wave 2' ? 'border-blue-400 text-blue-300 bg-blue-900/30' :
                                   'border-green-400 text-green-300 bg-green-900/30';
            
            const cfStatusHtml = s.codeforcesHandle ? `
                <div class="flex items-center gap-1.5">
                    <a href="https://codeforces.com/profile/${encodeURIComponent(s.codeforcesHandle)}" target="_blank" class="text-gold hover:underline font-mono text-xs font-bold">
                        ${escapeHTML(s.codeforcesHandle)}
                    </a>
                    ${s.cfVerified 
                        ? `<span class="px-1.5 py-0.5 text-[9px] bg-green-900/40 text-green-300 border border-green-500/50 rounded" title="Verified">VERIFIED</span>`
                        : `<span class="px-1.5 py-0.5 text-[9px] bg-amber-900/40 text-amber-300 border border-amber-500/50 rounded" title="Pending Challenge Token: ${escapeHTML(s.cfVerificationToken || '')}">PENDING</span>`
                    }
                </div>
            ` : `<span class="text-cream-dark/40 text-xs italic">Not linked</span>`;

            const isActive = s.status === 'active';

            return `
                <tr class="border-b border-navy-light/20 hover:bg-navy-dark/40 transition-colors text-xs">
                    <td class="p-3">
                        <div class="font-bold text-white">${escapeHTML(s.fullName)}</div>
                        <div class="text-[11px] text-cream-dark/60">${escapeHTML(s.email)}</div>
                        ${s.phone ? `<div class="text-[10px] text-cream-dark/40">${escapeHTML(s.phone)}</div>` : ''}
                    </td>
                    <td class="p-3">
                        <span class="inline-block px-2 py-0.5 text-[10px] font-mono border ${waveBadgeClass}">
                            ${escapeHTML(s.wave || 'Wave 1')}
                        </span>
                    </td>
                    <td class="p-3">
                        <span class="font-mono text-[11px] text-gold/90">${escapeHTML(s.registrationCode || '—')}</span>
                    </td>
                    <td class="p-3">
                        ${cfStatusHtml}
                    </td>
                    <td class="p-3">
                        <span class="px-2 py-0.5 text-[10px] font-mono border ${isActive ? 'border-green-500 text-green-300 bg-green-900/20' : 'border-red-500 text-red-300 bg-red-900/20'}">
                            ${isActive ? 'ACTIVE' : 'SUSPENDED'}
                        </span>
                    </td>
                    <td class="p-3 text-right space-x-1 whitespace-nowrap">
                        ${s.codeforcesHandle ? `
                            <button onclick="window.AdminPortal.toggleCfVerification('${s.id}', ${!s.cfVerified})" class="pixel-btn-navy text-[10px] px-2 py-1" title="${s.cfVerified ? 'Mark unverified' : 'Approve handle'}">
                                ${s.cfVerified ? 'Unverify CF' : 'Verify CF'}
                            </button>
                            <button onclick="window.AdminPortal.unlinkCf('${s.id}')" class="text-red-400 hover:text-red-300 text-[10px] px-1.5 py-1" title="Unlink Codeforces handle">
                                Unlink
                            </button>
                        ` : ''}
                        <button onclick="window.AdminPortal.toggleStudentStatus('${s.id}', '${isActive ? 'suspended' : 'active'}')" class="pixel-btn-navy text-[10px] px-2 py-1 ${isActive ? 'hover:border-red-400 hover:text-red-300' : 'hover:border-green-400 hover:text-green-300'}">
                            ${isActive ? 'Suspend' : 'Activate'}
                        </button>
                        <button onclick="window.AdminPortal.promptChangeWave('${s.id}', '${escapeHTML(s.wave || 'Wave 1')}')" class="pixel-btn-gold text-[10px] px-2 py-1">
                            Wave
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async function toggleCfVerification(studentId, verified) {
        try {
            const res = await fetch('/api/admin/students', {
                method: 'PATCH',
                headers: getAdminAuthHeaders(),
                body: JSON.stringify({ studentId, cfVerified: verified })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            showToast(`Codeforces verification status updated.`);
            loadStudents();
        } catch (e) {
            showToast(e.message, true);
        }
    }

    async function unlinkCf(studentId) {
        if (!confirm('Unlink this Codeforces handle from the student? They will need to re-link during onboarding.')) return;
        try {
            const res = await fetch('/api/admin/students', {
                method: 'PATCH',
                headers: getAdminAuthHeaders(),
                body: JSON.stringify({ studentId, unlinkCf: true })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            showToast('Codeforces handle unlinked.');
            loadStudents();
        } catch (e) {
            showToast(e.message, true);
        }
    }

    async function toggleStudentStatus(studentId, newStatus) {
        try {
            const res = await fetch('/api/admin/students', {
                method: 'PATCH',
                headers: getAdminAuthHeaders(),
                body: JSON.stringify({ studentId, status: newStatus })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            showToast(`Student status set to ${newStatus}.`);
            loadStudents();
        } catch (e) {
            showToast(e.message, true);
        }
    }

    async function promptChangeWave(studentId, currentWave) {
        const target = prompt(`Enter new Wave for this student (Wave 1, Wave 2, Wave 3):`, currentWave);
        if (!target || target === currentWave) return;
        try {
            const res = await fetch('/api/admin/students', {
                method: 'PATCH',
                headers: getAdminAuthHeaders(),
                body: JSON.stringify({ studentId, wave: target })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            showToast(`Student wave updated to ${target}.`);
            loadStudents();
        } catch (e) {
            showToast(e.message, true);
        }
    }

    // =========================================================================
    // 2. ACCESS CODES & CSV IMPORT
    // =========================================================================
    async function loadCodes() {
        const tbody = document.getElementById('codes-table-body');
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-xs text-cream-dark/60 font-mono"><span class="animate-pulse">Loading access codes...</span></td></tr>`;

        try {
            const status = document.getElementById('codes-status-filter')?.value || 'all';
            const search = document.getElementById('codes-search')?.value || '';

            const res = await fetch(`/api/admin/codes?status=${encodeURIComponent(status)}&eventId=All`, {
                headers: getAdminAuthHeaders()
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            allCodes = data.codes || [];

            let filtered = allCodes;
            if (search) {
                const s = search.toLowerCase();
                filtered = filtered.filter(c => 
                    (c.registration_id && c.registration_id.toLowerCase().includes(s)) ||
                    (c.full_name && c.full_name.toLowerCase().includes(s)) ||
                    (c.email && c.email.toLowerCase().includes(s))
                );
            }

            renderCodesList(filtered);
            updateCodesStats(data);
        } catch (e) {
            console.error('Failed to load codes:', e);
            if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-xs text-red-400">Failed to load codes: ${escapeHTML(e.message)}</td></tr>`;
        }
    }

    function updateCodesStats(data) {
        const totalEl = document.getElementById('stat-codes-total');
        const availableEl = document.getElementById('stat-codes-available');
        const redeemedEl = document.getElementById('stat-codes-redeemed');

        if (totalEl) totalEl.textContent = data.total ?? allCodes.length;
        if (availableEl) availableEl.textContent = data.availableCount ?? allCodes.filter(c => !c.is_redeemed && c.status !== 'revoked').length;
        if (redeemedEl) redeemedEl.textContent = data.redeemedCount ?? allCodes.filter(c => c.is_redeemed).length;
    }

    function renderCodesList(codes) {
        const tbody = document.getElementById('codes-table-body');
        if (!tbody) return;

        if (codes.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-xs text-cream-dark/60 font-mono">No registration access codes match query.</td></tr>`;
            return;
        }

        tbody.innerHTML = codes.map(c => {
            const isRedeemed = Boolean(c.is_redeemed);
            const isRevoked = c.status === 'revoked';

            const statusBadge = isRevoked ? `<span class="px-2 py-0.5 text-[10px] font-mono border border-red-500 text-red-300 bg-red-900/30">REVOKED</span>` :
                                isRedeemed ? `<span class="px-2 py-0.5 text-[10px] font-mono border border-gold text-gold bg-gold/10">REDEEMED</span>` :
                                             `<span class="px-2 py-0.5 text-[10px] font-mono border border-green-500 text-green-300 bg-green-900/20">AVAILABLE</span>`;

            return `
                <tr class="border-b border-navy-light/20 hover:bg-navy-dark/40 transition-colors text-xs font-mono">
                    <td class="p-3 font-bold text-white">${escapeHTML(c.registration_id)}</td>
                    <td class="p-3 font-body">
                        <div class="font-bold text-white text-xs">${escapeHTML(c.full_name)}</div>
                        <div class="text-[11px] text-cream-dark/60">${escapeHTML(c.email)}</div>
                    </td>
                    <td class="p-3">
                        <span class="px-2 py-0.5 text-[10px] border border-blue-400 text-blue-300 bg-blue-900/20">${escapeHTML(c.wave || 'Wave 1')}</span>
                    </td>
                    <td class="p-3">
                        <span class="text-[11px] text-cream-dark/70">${escapeHTML(c.event_id || 'orientation')}</span>
                    </td>
                    <td class="p-3">
                        ${statusBadge}
                        ${isRedeemed && c.redeemed_at ? `<div class="text-[10px] text-cream-dark/40 font-body">${new Date(c.redeemed_at).toLocaleDateString()}</div>` : ''}
                    </td>
                    <td class="p-3 text-right">
                        ${!isRevoked ? `
                            <button onclick="window.AdminPortal.revokeCode('${c.registration_id}')" class="text-red-400 hover:text-red-300 text-[10px] px-2 py-1 font-body">
                                Revoke
                            </button>
                        ` : `
                            <button onclick="window.AdminPortal.reactivateCode('${c.registration_id}')" class="text-green-400 hover:text-green-300 text-[10px] px-2 py-1 font-body">
                                Reactivate
                            </button>
                        `}
                    </td>
                </tr>
            `;
        }).join('');
    }

    async function revokeCode(regId) {
        if (!confirm(`Revoke registration code ${regId}?`)) return;
        try {
            const res = await fetch('/api/admin/codes', {
                method: 'PATCH',
                headers: getAdminAuthHeaders(),
                body: JSON.stringify({ registrationId: regId, status: 'revoked' })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            showToast(`Code ${regId} revoked.`);
            loadCodes();
        } catch (e) {
            showToast(e.message, true);
        }
    }

    async function reactivateCode(regId) {
        try {
            const res = await fetch('/api/admin/codes', {
                method: 'PATCH',
                headers: getAdminAuthHeaders(),
                body: JSON.stringify({ registrationId: regId, status: 'confirmed' })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            showToast(`Code ${regId} reactivated.`);
            loadCodes();
        } catch (e) {
            showToast(e.message, true);
        }
    }

    function exportCodesCsv() {
        if (allCodes.length === 0) {
            alert('No codes available to export.');
            return;
        }

        const headers = ['Registration Code', 'Full Name', 'Email', 'Phone', 'Wave', 'Event ID', 'Redeemed', 'Status', 'Created At'];
        const rows = allCodes.map(c => [
            c.registration_id || '',
            `"${(c.full_name || '').replace(/"/g, '""')}"`,
            c.email || '',
            c.phone || '',
            c.wave || '',
            c.event_id || '',
            c.is_redeemed ? 'YES' : 'NO',
            c.status || '',
            c.created_at || ''
        ]);

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nusc_access_codes_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    // --- CSV Import Workflow ---
    let parsedCsvRows = [];

    function openCsvModal() {
        parsedCsvRows = [];
        const previewDiv = document.getElementById('csv-preview-container');
        if (previewDiv) previewDiv.classList.add('hidden');
        const commitBtn = document.getElementById('csv-commit-btn');
        if (commitBtn) commitBtn.disabled = true;
        const textInput = document.getElementById('csv-text-input');
        if (textInput) textInput.value = '';
        
        const modal = document.getElementById('csv-import-modal');
        if (modal) modal.classList.remove('hidden');
    }

    function closeCsvModal() {
        const modal = document.getElementById('csv-import-modal');
        if (modal) modal.classList.add('hidden');
    }

    function parseCsvText(rawText) {
        const lines = rawText.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length < 2) return [];

        const headerLine = lines[0].toLowerCase();
        const headers = headerLine.split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));

        // Identify column indices
        const emailIdx = headers.findIndex(h => h.includes('email'));
        const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('student'));
        const codeIdx = headers.findIndex(h => h.includes('code') || h.includes('registration') || h.includes('id'));
        const waveIdx = headers.findIndex(h => h.includes('wave') || h.includes('level') || h.includes('track'));
        const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('mobile'));

        const parsed = [];
        for (let i = 1; i < lines.length; i++) {
            const rawRow = lines[i];
            // Simple split with comma regex
            const cols = rawRow.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
            const email = emailIdx >= 0 ? cols[emailIdx] : cols[1];
            const name = nameIdx >= 0 ? cols[nameIdx] : cols[0];
            const code = codeIdx >= 0 ? cols[codeIdx] : null;
            const wave = waveIdx >= 0 ? cols[waveIdx] : null;
            const phone = phoneIdx >= 0 ? cols[phoneIdx] : null;

            if (email && name) {
                parsed.push({
                    email: email.trim().toLowerCase(),
                    fullName: name.trim(),
                    code: code ? code.trim() : null,
                    wave: wave ? wave.trim() : null,
                    phone: phone ? phone.trim() : null
                });
            }
        }
        return parsed;
    }

    function previewCsv() {
        const text = document.getElementById('csv-text-input')?.value || '';
        if (!text.trim()) {
            alert('Please paste CSV content or upload a file.');
            return;
        }

        parsedCsvRows = parseCsvText(text);
        if (parsedCsvRows.length === 0) {
            alert('Could not parse any rows. Ensure your CSV has header: name, email, wave, code');
            return;
        }

        // Validate duplicates
        const existingEmails = new Set(allCodes.map(c => (c.email || '').toLowerCase()));
        const seenInFile = new Set();
        let conflicts = 0;

        const previewTbody = document.getElementById('csv-preview-tbody');
        if (previewTbody) {
            previewTbody.innerHTML = parsedCsvRows.map(r => {
                const isConflict = existingEmails.has(r.email) || seenInFile.has(r.email);
                if (isConflict) conflicts++;
                seenInFile.add(r.email);

                return `
                    <tr class="border-b border-navy-light/20 text-xs ${isConflict ? 'bg-red-950/40 text-red-300' : 'text-cream'}">
                        <td class="p-2 font-bold">${escapeHTML(r.fullName)}</td>
                        <td class="p-2">${escapeHTML(r.email)}</td>
                        <td class="p-2">${escapeHTML(r.wave || 'Wave 1 (Default)')}</td>
                        <td class="p-2 font-mono">${escapeHTML(r.code || 'Auto-generate')}</td>
                        <td class="p-2">
                            ${isConflict ? '<span class="text-red-400 font-bold">Duplicate</span>' : '<span class="text-green-400 font-bold">Valid</span>'}
                        </td>
                    </tr>
                `;
            }).join('');
        }

        const summaryEl = document.getElementById('csv-preview-summary');
        if (summaryEl) {
            summaryEl.textContent = `Found ${parsedCsvRows.length} rows (${conflicts} potential conflicts/duplicates will be skipped).`;
        }

        const previewContainer = document.getElementById('csv-preview-container');
        if (previewContainer) previewContainer.classList.remove('hidden');

        const commitBtn = document.getElementById('csv-commit-btn');
        if (commitBtn) commitBtn.disabled = false;
    }

    async function commitCsvImport() {
        if (!parsedCsvRows || parsedCsvRows.length === 0) return;

        const defaultWave = document.getElementById('csv-default-wave')?.value || 'Wave 1';
        const eventId = document.getElementById('csv-event-id')?.value || 'orientation-session-2026';
        const commitBtn = document.getElementById('csv-commit-btn');
        if (commitBtn) {
            commitBtn.disabled = true;
            commitBtn.textContent = 'Importing...';
        }

        try {
            const res = await fetch('/api/admin/codes', {
                method: 'POST',
                headers: getAdminAuthHeaders(),
                body: JSON.stringify({
                    records: parsedCsvRows,
                    defaultWave,
                    eventId
                })
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const result = await res.json();

            showToast(`Import completed: ${result.importedCount} added, ${result.skippedCount} skipped.`);
            closeCsvModal();
            loadCodes();
        } catch (e) {
            showToast(`Import failed: ${e.message}`, true);
        } finally {
            if (commitBtn) {
                commitBtn.disabled = false;
                commitBtn.textContent = 'Confirm & Import';
            }
        }
    }

    // =========================================================================
    // 3. SESSIONS MANAGEMENT
    // =========================================================================
    async function loadSessions() {
        const listContainer = document.getElementById('admin-sessions-list');
        if (listContainer) listContainer.innerHTML = `<div class="p-8 text-center text-xs text-cream-dark/60 font-mono animate-pulse">Loading training sessions...</div>`;

        try {
            const res = await fetch('/api/admin/sessions', { headers: getAdminAuthHeaders() });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            allSessions = data.sessions || [];

            renderSessionsList(allSessions);
        } catch (e) {
            console.error('Failed to load sessions:', e);
            if (listContainer) listContainer.innerHTML = `<div class="p-8 text-center text-xs text-red-400">Failed to load sessions: ${escapeHTML(e.message)}</div>`;
        }
    }

    function renderSessionsList(sessions) {
        const listContainer = document.getElementById('admin-sessions-list');
        if (!listContainer) return;

        if (sessions.length === 0) {
            listContainer.innerHTML = `<div class="p-8 text-center text-xs text-cream-dark/60 font-mono">No sessions scheduled yet. Click "Schedule New Session" to create one.</div>`;
            return;
        }

        listContainer.innerHTML = sessions.map(s => {
            const dateStr = s.session_date ? new Date(s.session_date).toLocaleString() : 'Date TBA';
            const waveClass = s.wave === 'Wave 3' ? 'border-purple-400 text-purple-300' :
                              s.wave === 'Wave 2' ? 'border-blue-400 text-blue-300' :
                              s.wave === 'Wave 1' ? 'border-green-400 text-green-300' : 'border-gold text-gold';

            return `
                <div class="bg-navy p-5 pixel-border border-navy-light/40 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div class="space-y-1.5 flex-grow">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="px-2 py-0.5 text-[10px] font-mono border ${waveClass} uppercase">${escapeHTML(s.wave || 'All Waves')}</span>
                            <span class="text-xs font-mono text-cream-dark/60">${dateStr}</span>
                            <span class="text-[10px] text-cream-dark/40">(${s.duration_minutes || 60} mins)</span>
                        </div>
                        <h3 class="font-display font-bold text-base text-white">${escapeHTML(s.title)}</h3>
                        ${s.description ? `<p class="font-body text-xs text-cream-dark/70">${escapeHTML(s.description)}</p>` : ''}
                        ${s.meeting_link ? `
                            <a href="${escapeHTML(s.meeting_link)}" target="_blank" class="inline-flex items-center gap-1 text-[11px] text-gold hover:underline">
                                <span class="material-symbols-outlined text-xs">video_call</span> Join Link
                            </a>
                        ` : ''}
                    </div>

                    <div class="flex items-center gap-2 flex-shrink-0">
                        <button onclick="window.AdminPortal.openAttendanceForSession('${s.id}')" class="pixel-btn-gold text-xs px-3 py-1.5 flex items-center gap-1">
                            <span class="material-symbols-outlined text-xs">fact_check</span> Attendance
                        </button>
                        <button onclick="window.AdminPortal.openEditSessionModal('${s.id}')" class="pixel-btn-navy text-xs px-3 py-1.5">
                            Edit
                        </button>
                        <button onclick="window.AdminPortal.deleteSession('${s.id}')" class="text-red-400 hover:text-red-300 p-1 text-xs">
                            <span class="material-symbols-outlined text-sm">delete</span>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    function openNewSessionModal() {
        document.getElementById('session-form-id').value = '';
        document.getElementById('session-form-title').value = '';
        document.getElementById('session-form-desc').value = '';
        document.getElementById('session-form-date').value = '';
        document.getElementById('session-form-duration').value = '90';
        document.getElementById('session-form-speaker').value = '';
        document.getElementById('session-form-wave').value = 'All';
        document.getElementById('session-form-meet').value = '';
        document.getElementById('session-form-prep').value = '';
        document.getElementById('session-modal-title').textContent = 'SCHEDULE NEW SESSION';

        document.getElementById('session-editor-modal').classList.remove('hidden');
    }

    function openEditSessionModal(sessionId) {
        const s = allSessions.find(x => x.id === sessionId);
        if (!s) return;

        document.getElementById('session-form-id').value = s.id;
        document.getElementById('session-form-title').value = s.title || '';
        document.getElementById('session-form-desc').value = s.description || '';
        if (s.session_date) {
            const dt = new Date(s.session_date);
            const localIso = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            document.getElementById('session-form-date').value = localIso;
        }
        document.getElementById('session-form-duration').value = s.duration_minutes || 90;
        document.getElementById('session-form-speaker').value = s.speaker_name || '';
        document.getElementById('session-form-wave').value = s.wave || 'All';
        document.getElementById('session-form-meet').value = s.meeting_link || '';
        document.getElementById('session-form-prep').value = s.prep_materials || '';
        document.getElementById('session-modal-title').textContent = 'EDIT SESSION';

        document.getElementById('session-editor-modal').classList.remove('hidden');
    }

    function closeSessionModal() {
        document.getElementById('session-editor-modal').classList.add('hidden');
    }

    async function saveSession(e) {
        if (e && e.preventDefault) e.preventDefault();

        const id = document.getElementById('session-form-id').value;
        const title = document.getElementById('session-form-title').value.trim();
        const description = document.getElementById('session-form-desc').value.trim();
        const sessionDate = document.getElementById('session-form-date').value;
        const durationMinutes = parseInt(document.getElementById('session-form-duration').value, 10);
        const speakerName = document.getElementById('session-form-speaker').value.trim();
        const wave = document.getElementById('session-form-wave').value;
        const meetingLink = document.getElementById('session-form-meet').value.trim();
        const prepMaterials = document.getElementById('session-form-prep').value.trim();

        if (!title || !sessionDate) {
            alert('Title and Session Date are required.');
            return;
        }

        const payload = {
            title,
            description,
            sessionDate,
            durationMinutes,
            speakerName,
            wave,
            meetingLink,
            prepMaterials
        };

        try {
            let res;
            if (id) {
                payload.id = id;
                res = await fetch('/api/admin/sessions', {
                    method: 'PATCH',
                    headers: getAdminAuthHeaders(),
                    body: JSON.stringify(payload)
                });
            } else {
                res = await fetch('/api/admin/sessions', {
                    method: 'POST',
                    headers: getAdminAuthHeaders(),
                    body: JSON.stringify(payload)
                });
            }

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            showToast(id ? 'Session updated.' : 'Session created.');
            closeSessionModal();
            loadSessions();
        } catch (err) {
            showToast(`Error: ${err.message}`, true);
        }
    }

    async function deleteSession(id) {
        if (!confirm('Are you sure you want to delete this session?')) return;
        try {
            const res = await fetch(`/api/admin/sessions?id=${encodeURIComponent(id)}`, {
                method: 'DELETE',
                headers: getAdminAuthHeaders()
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            showToast('Session deleted.');
            loadSessions();
        } catch (e) {
            showToast(e.message, true);
        }
    }

    // =========================================================================
    // 4. ATTENDANCE MANAGEMENT
    // =========================================================================
    function openAttendanceForSession(sessionId) {
        currentAttendanceSessionId = sessionId;
        window.location.hash = `#attendance-admin?sessionId=${sessionId}`;
    }

    async function loadAttendanceView(sessionIdFromUrl) {
        // Populate sessions dropdown
        const select = document.getElementById('attendance-session-select');
        if (select && allSessions.length === 0) {
            try {
                const res = await fetch('/api/admin/sessions', { headers: getAdminAuthHeaders() });
                if (res.ok) {
                    const data = await res.json();
                    allSessions = data.sessions || [];
                }
            } catch(e) {}
        }

        if (select) {
            select.innerHTML = allSessions.map(s => `
                <option value="${s.id}" ${s.id === (sessionIdFromUrl || currentAttendanceSessionId) ? 'selected' : ''}>
                    ${escapeHTML(s.title)} (${s.wave || 'All'} - ${s.session_date ? new Date(s.session_date).toLocaleDateString() : ''})
                </option>
            `).join('');

            if (!sessionIdFromUrl && !currentAttendanceSessionId && allSessions.length > 0) {
                currentAttendanceSessionId = allSessions[0].id;
            } else if (sessionIdFromUrl) {
                currentAttendanceSessionId = sessionIdFromUrl;
            }
        }

        if (!currentAttendanceSessionId && allSessions.length > 0) {
            currentAttendanceSessionId = allSessions[0].id;
        }

        if (currentAttendanceSessionId) {
            fetchSessionAttendance(currentAttendanceSessionId);
        }
    }

    async function fetchSessionAttendance(sessionId) {
        const tbody = document.getElementById('attendance-table-body');
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-xs text-cream-dark/60 font-mono"><span class="animate-pulse">Loading attendance records...</span></td></tr>`;

        try {
            const res = await fetch(`/api/admin/attendance?sessionId=${encodeURIComponent(sessionId)}`, {
                headers: getAdminAuthHeaders()
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const records = data.records || [];

            renderAttendanceTable(records);
            
            const presentEl = document.getElementById('stat-attendance-present');
            const absentEl = document.getElementById('stat-attendance-absent');
            const rateEl = document.getElementById('stat-attendance-rate');

            const pCount = data.presentCount || records.filter(r => r.status === 'present').length;
            const total = records.length;
            const rate = total > 0 ? Math.round((pCount / total) * 100) : 0;

            if (presentEl) presentEl.textContent = pCount;
            if (absentEl) absentEl.textContent = total - pCount;
            if (rateEl) rateEl.textContent = `${rate}%`;

        } catch (e) {
            if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-xs text-red-400">Failed to load attendance: ${escapeHTML(e.message)}</td></tr>`;
        }
    }

    function renderAttendanceTable(records) {
        const tbody = document.getElementById('attendance-table-body');
        if (!tbody) return;

        if (records.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-xs text-cream-dark/60 font-mono">No students registered yet in the system.</td></tr>`;
            return;
        }

        tbody.innerHTML = records.map(r => {
            const isPresent = r.status === 'present';
            const isAbsent = r.status === 'absent';

            return `
                <tr class="border-b border-navy-light/20 hover:bg-navy-dark/40 transition-colors text-xs" data-student-id="${r.studentId}">
                    <td class="p-3">
                        <div class="font-bold text-white">${escapeHTML(r.fullName)}</div>
                        <div class="text-[11px] text-cream-dark/60">${escapeHTML(r.email)}</div>
                    </td>
                    <td class="p-3">
                        <span class="px-2 py-0.5 text-[10px] font-mono border border-blue-400 text-blue-300">${escapeHTML(r.wave || 'Wave 1')}</span>
                    </td>
                    <td class="p-3 font-mono text-gold text-xs">
                        ${escapeHTML(r.codeforcesHandle || '—')}
                    </td>
                    <td class="p-3">
                        <div class="flex items-center gap-2">
                            <label class="flex items-center gap-1 cursor-pointer">
                                <input type="radio" name="att_${r.studentId}" value="present" ${isPresent ? 'checked' : ''} class="w-3.5 h-3.5 text-green-500 bg-navy-darkest border-navy-light focus:ring-0" />
                                <span class="text-green-300 text-[11px]">Present</span>
                            </label>
                            <label class="flex items-center gap-1 cursor-pointer ml-2">
                                <input type="radio" name="att_${r.studentId}" value="absent" ${isAbsent ? 'checked' : (!isPresent ? 'checked' : '')} class="w-3.5 h-3.5 text-red-500 bg-navy-darkest border-navy-light focus:ring-0" />
                                <span class="text-red-300 text-[11px]">Absent</span>
                            </label>
                        </div>
                    </td>
                    <td class="p-3">
                        <input type="text" class="pixel-input text-xs py-1 px-2 att-note-input" value="${escapeHTML(r.notes || '')}" placeholder="Optional note..." />
                    </td>
                </tr>
            `;
        }).join('');
    }

    async function saveAllAttendance() {
        if (!currentAttendanceSessionId) return;

        const rows = document.querySelectorAll('#attendance-table-body tr[data-student-id]');
        const updates = [];

        rows.forEach(tr => {
            const studentId = tr.getAttribute('data-student-id');
            const checkedRadio = tr.querySelector(`input[name="att_${studentId}"]:checked`);
            const status = checkedRadio ? checkedRadio.value : 'absent';
            const noteInput = tr.querySelector('.att-note-input');
            const notes = noteInput ? noteInput.value.trim() : '';

            updates.push({
                studentId,
                status,
                notes
            });
        });

        try {
            const res = await fetch('/api/admin/attendance', {
                method: 'POST',
                headers: getAdminAuthHeaders(),
                body: JSON.stringify({
                    sessionId: currentAttendanceSessionId,
                    records: updates
                })
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            showToast(`Attendance saved for ${updates.length} students.`);
            fetchSessionAttendance(currentAttendanceSessionId);
        } catch (e) {
            showToast(`Failed to save attendance: ${e.message}`, true);
        }
    }

    // =========================================================================
    // 5. MENTOR ANNOUNCEMENTS & DIRECT FEEDBACK
    // =========================================================================
    async function loadMentorsView() {
        const feedContainer = document.getElementById('admin-mentors-feed');
        if (feedContainer) feedContainer.innerHTML = `<div class="p-8 text-center text-xs text-cream-dark/60 font-mono animate-pulse">Loading mentor activity...</div>`;

        // Populate student selector in feedback form
        const stuSelect = document.getElementById('mentor-student-select');
        if (stuSelect) {
            if (allStudents.length === 0) {
                try {
                    const res = await fetch('/api/admin/students', { headers: getAdminAuthHeaders() });
                    if (res.ok) {
                        const d = await res.json();
                        allStudents = d.students || [];
                    }
                } catch(e) {}
            }
            stuSelect.innerHTML = `<option value="">Select a student...</option>` + allStudents.map(s => `
                <option value="${s.id}">${escapeHTML(s.fullName)} (${escapeHTML(s.email)} - ${s.wave || 'Wave 1'})</option>
            `).join('');
        }

        try {
            const res = await fetch('/api/admin/mentors', { headers: getAdminAuthHeaders() });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const items = data.items || [];

            renderMentorsFeed(items);
        } catch (e) {
            console.error('Failed to load mentors feed:', e);
            if (feedContainer) feedContainer.innerHTML = `<div class="p-8 text-center text-xs text-red-400">Failed to load feed: ${escapeHTML(e.message)}</div>`;
        }
    }

    function renderMentorsFeed(items) {
        const container = document.getElementById('admin-mentors-feed');
        if (!container) return;

        if (items.length === 0) {
            container.innerHTML = `<div class="p-8 text-center text-xs text-cream-dark/60 font-mono">No mentor announcements or private notes yet.</div>`;
            return;
        }

        container.innerHTML = items.map(item => {
            const isAnnouncement = item.type === 'announcement';
            const dateStr = item.created_at ? new Date(item.created_at).toLocaleString() : '';

            return `
                <div class="bg-navy p-5 pixel-border border-navy-light/40 space-y-2">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <span class="px-2 py-0.5 text-[10px] font-mono border ${isAnnouncement ? 'border-gold text-gold bg-gold/10' : 'border-purple-400 text-purple-300 bg-purple-900/20'} uppercase">
                                ${isAnnouncement ? 'ANNOUNCEMENT' : 'DIRECT FEEDBACK'}
                            </span>
                            <span class="text-xs font-mono text-cream-dark/50">${dateStr}</span>
                        </div>
                        <button onclick="window.AdminPortal.deleteMentorItem('${item.id}')" class="text-red-400 hover:text-red-300 p-1 text-xs">
                            <span class="material-symbols-outlined text-sm">delete</span>
                        </button>
                    </div>

                    ${item.title ? `<h4 class="font-display font-bold text-sm text-white">${escapeHTML(item.title)}</h4>` : ''}
                    <p class="font-body text-xs text-cream-dark/80 whitespace-pre-wrap">${escapeHTML(item.content)}</p>

                    ${Array.isArray(item.recommended_problems) && item.recommended_problems.length > 0 ? `
                        <div class="pt-2 border-t border-white/10 flex flex-wrap gap-1.5 items-center">
                            <span class="text-[10px] text-gold uppercase font-mono">Recommended:</span>
                            ${item.recommended_problems.map(p => `
                                <span class="px-1.5 py-0.5 text-[10px] bg-navy-darkest border border-gold/40 text-gold-light font-mono">${escapeHTML(p)}</span>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    async function postMentorAnnouncement(e) {
        if (e && e.preventDefault) e.preventDefault();

        const title = document.getElementById('mentor-broadcast-title').value.trim();
        const content = document.getElementById('mentor-broadcast-content').value.trim();

        if (!content) {
            alert('Content is required for announcement.');
            return;
        }

        try {
            const res = await fetch('/api/admin/mentors', {
                method: 'POST',
                headers: getAdminAuthHeaders(),
                body: JSON.stringify({
                    type: 'announcement',
                    title: title || 'Community Announcement',
                    content
                })
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            showToast('Announcement broadcasted.');
            document.getElementById('mentor-broadcast-title').value = '';
            document.getElementById('mentor-broadcast-content').value = '';
            loadMentorsView();
        } catch (e) {
            showToast(e.message, true);
        }
    }

    async function sendDirectFeedback(e) {
        if (e && e.preventDefault) e.preventDefault();

        const studentId = document.getElementById('mentor-student-select').value;
        const content = document.getElementById('mentor-feedback-content').value.trim();
        const problemsRaw = document.getElementById('mentor-feedback-problems').value.trim();

        if (!studentId || !content) {
            alert('Please select a student and enter feedback text.');
            return;
        }

        const problems = problemsRaw ? problemsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

        try {
            const res = await fetch('/api/admin/mentors', {
                method: 'POST',
                headers: getAdminAuthHeaders(),
                body: JSON.stringify({
                    type: 'personal_feedback',
                    studentId,
                    content,
                    recommendedProblems: problems
                })
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            showToast('Private feedback sent to student.');
            document.getElementById('mentor-feedback-content').value = '';
            document.getElementById('mentor-feedback-problems').value = '';
            loadMentorsView();
        } catch (e) {
            showToast(e.message, true);
        }
    }

    async function deleteMentorItem(id) {
        if (!confirm('Delete this message?')) return;
        try {
            const res = await fetch(`/api/admin/mentors?id=${encodeURIComponent(id)}`, {
                method: 'DELETE',
                headers: getAdminAuthHeaders()
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            showToast('Item deleted.');
            loadMentorsView();
        } catch (e) {
            showToast(e.message, true);
        }
    }

    // Public API
    return {
        loadStudents,
        toggleCfVerification,
        unlinkCf,
        toggleStudentStatus,
        promptChangeWave,

        loadCodes,
        revokeCode,
        reactivateCode,
        exportCodesCsv,
        openCsvModal,
        closeCsvModal,
        previewCsv,
        commitCsvImport,

        loadSessions,
        openNewSessionModal,
        openEditSessionModal,
        closeSessionModal,
        saveSession,
        deleteSession,

        loadAttendanceView,
        fetchSessionAttendance,
        openAttendanceForSession,
        saveAllAttendance,

        loadMentorsView,
        postMentorAnnouncement,
        sendDirectFeedback,
        deleteMentorItem
    };
})();
