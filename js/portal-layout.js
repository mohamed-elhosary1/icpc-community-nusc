/**
 * ICPC NUSC — Unified Portal Layout & Navigation Engine
 * Injects responsive sidebar, mobile drawer, and header across all /portal/* views.
 */

(function (window) {
    'use strict';

    function initPortalLayout(activeKey = 'overview') {
        const user = PortalAuth.getUser() || {
            fullName: 'Student',
            wave: 'Wave 1',
            role: 'student',
            codeforcesHandle: null,
            cfVerified: false
        };

        const navLinks = [
            { key: 'overview', href: '/portal', label: 'Overview', icon: 'dashboard' },
            { key: 'progress', href: '/portal/progress', label: 'My Progress', icon: 'analytics' },
            { key: 'leaderboard', href: '/portal/leaderboard', label: 'Leaderboard', icon: 'leaderboard' },
            { key: 'sessions', href: '/portal/sessions', label: 'Sessions & Timeline', icon: 'calendar_month' },
            { key: 'mentors', href: '/portal/mentors', label: 'Mentors & Feedback', icon: 'support_agent' },
            { key: 'community', href: '/portal/community', label: 'Community Chat', icon: 'forum' },
            { key: 'profile', href: '/portal/profile', label: 'My Profile', icon: 'person' }
        ];

        // 1. Render Desktop Sidebar
        const sidebarEl = document.getElementById('portal-sidebar');
        if (sidebarEl) {
            sidebarEl.innerHTML = `
                <div class="h-16 border-b-2 border-navy-light/40 flex items-center px-5 justify-between bg-navy-dark">
                    <a href="/portal" class="flex items-center gap-2">
                        <img src="/assets/Objects/Bedroom/Trophy.png" class="pixel-art w-6 h-6" alt="NUSC Logo" />
                        <div>
                            <span class="font-minecraft text-xs text-white tracking-wider block">ICPC <span class="text-gold">NUSC</span></span>
                            <span class="font-label text-[9px] text-gold-light uppercase tracking-widest block -mt-0.5">${user.wave || 'Wave 1'}</span>
                        </div>
                    </a>
                </div>

                <!-- Nav list -->
                <nav class="py-4 space-y-1 flex-grow">
                    ${navLinks.map(link => {
                        const isActive = link.key === activeKey;
                        return `
                            <a href="${link.href}" class="portal-nav-item flex items-center gap-3 px-5 py-2.5 text-xs font-display uppercase tracking-wider transition-all border-l-4 ${
                                isActive 
                                ? 'bg-gold text-ink font-black border-white shadow-sm' 
                                : 'text-cream-dark/70 hover:text-gold hover:bg-white/5 border-transparent font-bold'
                            }">
                                <span class="material-symbols-outlined text-base ${isActive ? 'text-ink' : 'text-gold'}">${link.icon}</span>
                                <span>${link.label}</span>
                            </a>
                        `;
                    }).join('')}

                    ${user.role === 'admin' ? `
                        <div class="pt-4 mt-4 border-t border-white/10 px-4">
                            <a href="/admin" class="flex items-center gap-2 text-xs font-minecraft text-red-400 hover:text-white bg-red-950/40 p-2 border border-red-500/40">
                                <span class="material-symbols-outlined text-sm">admin_panel_settings</span>
                                <span>ADMIN PORTAL</span>
                            </a>
                        </div>
                    ` : ''}
                </nav>

                <!-- Footer User Badge -->
                <div class="p-4 border-t-2 border-navy-light/40 bg-navy-darkest space-y-3">
                    <div class="flex items-center justify-between">
                        <div class="truncate mr-2">
                            <span class="font-display font-bold text-xs text-white block truncate">${user.fullName || 'Student'}</span>
                            <div class="flex items-center gap-1.5 mt-0.5">
                                <span class="text-[10px] text-gold font-mono">${user.codeforcesHandle ? ('@' + user.codeforcesHandle) : 'No Handle'}</span>
                                ${user.cfVerified ? `<span class="material-symbols-outlined text-green-400 text-xs" title="Verified Handle">verified</span>` : ''}
                            </div>
                        </div>
                        <button type="button" id="portal-logout-btn" class="text-cream-dark/60 hover:text-red-400 p-1.5 transition-colors cursor-pointer" title="Sign Out">
                            <span class="material-symbols-outlined text-base">logout</span>
                        </button>
                    </div>
                </div>
            `;
        }

        // 2. Render Top Header
        const headerEl = document.getElementById('portal-header');
        if (headerEl) {
            headerEl.innerHTML = `
                <div class="flex items-center gap-3">
                    <button id="mobile-drawer-btn" class="lg:hidden p-2 text-gold hover:text-white cursor-pointer" title="Open Menu">
                        <span class="material-symbols-outlined text-2xl">menu</span>
                    </button>
                    <h2 class="font-display font-black text-base sm:text-lg text-white uppercase tracking-wide">
                        ${navLinks.find(n => n.key === activeKey)?.label || 'COMMUNITY PORTAL'}
                    </h2>
                </div>

                <div class="flex items-center gap-3">
                    <span class="hidden sm:inline-block px-2.5 py-1 bg-navy-darkest border border-gold/40 text-gold text-xs font-minecraft uppercase">
                        ${user.wave || 'Wave 1'}
                    </span>
                    <a href="/portal/profile" class="w-8 h-8 rounded-full bg-navy border border-gold/60 flex items-center justify-center text-gold hover:border-gold cursor-pointer" title="My Profile">
                        <span class="material-symbols-outlined text-lg">person</span>
                    </a>
                </div>
            `;
        }

        // 3. Render Mobile Drawer
        const drawerEl = document.getElementById('portal-drawer');
        if (drawerEl) {
            drawerEl.innerHTML = `
                <div class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 transition-opacity hidden" id="drawer-backdrop"></div>
                <div class="fixed top-0 bottom-0 left-0 w-72 bg-navy-dark z-50 transform -translate-x-full transition-transform duration-300 flex flex-col justify-between" id="drawer-panel">
                    <div>
                        <div class="h-16 border-b-2 border-navy-light/40 flex items-center justify-between px-5">
                            <span class="font-minecraft text-xs text-white">ICPC <span class="text-gold">NUSC</span></span>
                            <button id="drawer-close-btn" class="text-cream-dark/60 hover:text-white p-1">
                                <span class="material-symbols-outlined text-xl">close</span>
                            </button>
                        </div>
                        <nav class="py-4 space-y-1">
                            ${navLinks.map(link => `
                                <a href="${link.href}" class="flex items-center gap-3 px-5 py-3 text-xs font-display uppercase tracking-wider ${
                                    link.key === activeKey ? 'bg-gold text-ink font-black' : 'text-cream-dark/70 hover:text-gold'
                                }">
                                    <span class="material-symbols-outlined text-base">${link.icon}</span>
                                    <span>${link.label}</span>
                                </a>
                            `).join('')}
                        </nav>
                    </div>

                    <div class="p-4 border-t border-white/10">
                        <button type="button" class="w-full py-2.5 border border-red-500/40 text-red-300 font-display text-xs uppercase flex items-center justify-center gap-2 logout-btn-trigger">
                            <span class="material-symbols-outlined text-sm">logout</span>
                            <span>SIGN OUT</span>
                        </button>
                    </div>
                </div>
            `;

            // Mobile toggle events
            const drawerBtn = document.getElementById('mobile-drawer-btn');
            const backdrop = document.getElementById('drawer-backdrop');
            const panel = document.getElementById('drawer-panel');
            const closeBtn = document.getElementById('drawer-close-btn');

            function openDrawer() {
                backdrop.classList.remove('hidden');
                panel.classList.remove('-translate-x-full');
            }
            function closeDrawer() {
                backdrop.classList.add('hidden');
                panel.classList.add('-translate-x-full');
            }

            if (drawerBtn) drawerBtn.addEventListener('click', openDrawer);
            if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
            if (backdrop) backdrop.addEventListener('click', closeDrawer);
        }

        // Attach logout listeners
        document.querySelectorAll('#portal-logout-btn, .logout-btn-trigger').forEach(btn => {
            btn.addEventListener('click', () => {
                if (confirm('Are you sure you want to sign out?')) {
                    PortalAuth.logout();
                }
            });
        });
    }

    window.initPortalLayout = initPortalLayout;
})(window);
