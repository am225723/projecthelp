/**
 * Stitch Agent Activity Feed - Main Application
 * AI-Powered Productivity Dashboard
 */

// ===================================
// STATE MANAGEMENT
// ===================================

const AppState = {
    currentPage: 'control',
    agents: [
        { id: 1, name: 'Email Triager', icon: 'mail', status: 'active', color: 'primary', stats: '15 drafts today' },
        { id: 2, name: 'Summarizer', icon: 'event', status: 'active', color: 'purple', stats: '3 events logged' },
        { id: 3, name: 'Extractor', icon: 'fact_check', status: 'paused', color: 'amber', stats: 'Paused' },
        { id: 4, name: 'Filter Bot', icon: 'filter_alt', status: 'active', color: 'emerald', stats: '23 filtered' },
        { id: 5, name: 'Task Creator', icon: 'check_circle', status: 'inactive', color: 'blue', stats: 'Not running' }
    ],
    activities: [
        {
            id: 1,
            type: 'urgent',
            title: 'Project Alpha Budget Review',
            sender: 'Sarah Jenkins',
            time: '10:42 AM',
            summary: ['Sarah requires final signatures for Q4 by this Friday.', 'Proposal approved with a $5k reallocation request.'],
            actions: ['quick-reply', 'archive']
        },
        {
            id: 2,
            type: 'scheduling',
            title: 'Interview with Marcus Reed',
            sender: 'Marcus Reed',
            time: '9:15 AM',
            summary: ['Marcus is available Wednesday or Thursday afternoon for the Senior Designer review.'],
            actions: ['quick-book', 'delete']
        },
        {
            id: 3,
            type: 'draft',
            title: 'Draft ready for Alex',
            subject: 'Project Update Q3',
            time: '8:30 AM',
            summary: ['AI-generated draft ready for review'],
            actions: ['approve']
        },
        {
            id: 4,
            type: 'meeting',
            title: 'Meeting Summary: Team sync',
            details: '3 action items extracted',
            time: 'Yesterday',
            summary: ['Weekly team sync completed', 'New tasks assigned to development team'],
            actions: ['edit']
        },
        {
            id: 5,
            type: 'update',
            title: 'New Feature: Smart Triage',
            sender: 'Product Team',
            time: 'Yesterday',
            summary: ['A detailed overview of the new AI features being released this week. No action required.'],
            actions: ['dismiss']
        }
    ],
    rules: [
        { id: 1, name: 'VIP Client Filter', status: 'active', conditions: 2, actions: 2 },
        { id: 2, name: 'Newsletter Skip', status: 'active', conditions: 1, actions: 1 },
        { id: 3, name: 'Urgent Response', status: 'active', conditions: 3, actions: 2 }
    ],
    connectedServices: [
        { id: 1, name: 'Gmail', icon: 'mail', status: 'connected', email: 'alex.design@gmail.com' }
    ]
};

// ===================================
// ROUTING SYSTEM
// ===================================

const Router = {
    navigate: function(page) {
        // Update state
        AppState.currentPage = page;
        
        // Update navigation UI
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === page) {
                item.classList.add('active');
            }
        });
        
        // Show/hide pages
        document.querySelectorAll('.page').forEach(p => {
            p.style.display = 'none';
        });
        
        const targetPage = document.getElementById(`page-${page}`);
        if (targetPage) {
            targetPage.style.display = 'block';
            targetPage.classList.add('animate-fade-in');
        }
        
        // Update page title
        const titles = {
            'control': 'Control Center',
            'activity': 'Activity Feed',
            'fleet': 'Agent Fleet',
            'settings': 'Settings'
        };
        document.title = `Stitch Agent - ${titles[page] || 'Dashboard'}`;
        
        // Scroll to top
        window.scrollTo(0, 0);
    }
};

// ===================================
// AGENT MANAGEMENT
// ===================================

const AgentManager = {
    toggleAgent: function(agentId) {
        const agent = AppState.agents.find(a => a.id === agentId);
        if (agent) {
            agent.status = agent.status === 'active' ? 'paused' : 'active';
            this.renderAgents();
            this.showNotification(`${agent.name} ${agent.status === 'active' ? 'activated' : 'paused'}`);
        }
    },
    
    renderAgents: function() {
        const container = document.getElementById('agents-grid');
        if (!container) return;
        
        container.innerHTML = AppState.agents.map(agent => `
            <div class="glass-card agent-card" data-agent-id="${agent.id}" style="padding: 0.75rem; position: relative; overflow: hidden; cursor: pointer;">
                <div style="position: absolute; top: 0; right: 0; width: 4rem; height: 4rem; background: radial-gradient(circle, var(--${agent.color}-light) 0%, transparent 70%); border-radius: 50%; transform: translate(30%, -30%); opacity: 0.5;"></div>
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                    <div class="icon-wrapper sm ${agent.color}">
                        <span class="material-symbols-outlined" style="color: var(--accent-${agent.color}); font-size: 1.125rem;">${agent.icon}</span>
                    </div>
                    <span class="status-dot ${agent.status === 'active' ? 'active' : 'inactive'}"></span>
                </div>
                <h3 style="font-size: 0.75rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.25rem;">${agent.name}</h3>
                <p style="font-size: 0.625rem; color: var(--text-muted); font-weight: 500;">${agent.stats}</p>
            </div>
        `).join('');
        
        // Add click handlers
        container.querySelectorAll('.agent-card').forEach(card => {
            card.addEventListener('click', () => {
                const agentId = parseInt(card.dataset.agentId);
                AgentManager.toggleAgent(agentId);
            });
        });
    },
    
    showNotification: function(message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--bg-card);
            border: 1px solid var(--border-muted);
            border-radius: var(--radius-lg);
            padding: 0.75rem 1.5rem;
            color: var(--text-primary);
            font-size: 0.875rem;
            font-weight: 500;
            z-index: 1000;
            animation: slideUp 0.3s ease-out;
            box-shadow: var(--shadow-lg);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideDown 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }
};

// ===================================
// ACTIVITY FEED
// ===================================

const ActivityFeed = {
    currentFilter: 'all',
    
    render: function(filter = 'all') {
        this.currentFilter = filter;
        const container = document.getElementById('activity-feed');
        if (!container) return;
        
        let filteredActivities = AppState.activities;
        
        if (filter !== 'all') {
            filteredActivities = AppState.activities.filter(activity => {
                if (filter === 'focused') return ['urgent', 'scheduling'].includes(activity.type);
                if (filter === 'waiting') return ['draft', 'meeting'].includes(activity.type);
                return true;
            });
        }
        
        container.innerHTML = filteredActivities.map(activity => this.renderActivityItem(activity)).join('');
        
        // Add animation
        container.querySelectorAll('.activity-item').forEach((item, index) => {
            item.style.opacity = '0';
            item.style.transform = 'translateY(20px)';
            item.style.transition = 'all 0.5s ease-out';
            item.style.transitionDelay = `${index * 100}ms`;
            
            setTimeout(() => {
                item.style.opacity = '1';
                item.style.transform = 'translateY(0)';
            }, 100);
        });
    },
    
    renderActivityItem: function(activity) {
        const typeColors = {
            urgent: 'primary',
            scheduling: 'warning',
            draft: 'primary',
            meeting: 'purple',
            update: 'gray'
        };
        
        const color = typeColors[activity.type];
        
        return `
            <div class="activity-item" style="flex-direction: ${activity.summary ? 'column' : 'row'}; gap: ${activity.summary ? '1rem' : '1rem'};">
                ${activity.sender ? `
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="display: flex; flex-direction: column; gap: 0.375rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span class="status-dot" style="background-color: var(--${color === 'primary' ? 'primary' : color === 'warning' ? 'status-warning' : 'accent-purple'}); box-shadow: 0 0 8px rgba(59, 130, 246, 0.6);"></span>
                            <span class="badge badge-${color === 'warning' ? 'warning' : 'primary'}">${activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}</span>
                        </div>
                        <h3 class="activity-title" style="font-size: 1.0625rem; margin-bottom: 0.25rem;">${activity.title}</h3>
                        <p style="font-size: 0.875rem; color: var(--text-secondary);">${activity.sender ? 'From: <span style="color: var(--text-primary);">' + activity.sender + '</span>' : ''}</p>
                    </div>
                    <p style="font-size: 0.6875rem; color: var(--text-muted); font-weight: 700; font-family: var(--font-mono);">${activity.time}</p>
                </div>
                ` : ''}
                
                ${activity.summary && activity.summary.length > 0 ? `
                <div style="background-color: rgba(5, 8, 15, 0.5); border-radius: 1rem; padding: 1rem; border: 1px solid var(--border-muted); position: relative; overflow: hidden;">
                    <div style="position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background-color: var(--${color === 'primary' ? 'primary' : color === 'warning' ? 'status-warning' : 'accent-purple'});"></div>
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                        <span class="material-symbols-outlined" style="color: var(--${color === 'primary' ? 'primary' : color === 'warning' ? 'status-warning' : 'accent-purple'}); font-size: 0.875rem;">auto_awesome</span>
                        <span style="font-size: 0.625rem; color: var(--${color === 'primary' ? 'primary' : color === 'warning' ? 'status-warning' : 'accent-purple'}); font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em;">AI Summary</span>
                    </div>
                    <ul style="list-style: none; padding-left: 0.25rem; display: flex; flex-direction: column; gap: 0.75rem;">
                        ${activity.summary.map(point => `
                        <li style="display: flex; align-items: start; gap: 0.75rem;">
                            <span style="width: 0.25rem; height: 0.25rem; border-radius: 50%; background-color: var(--${color === 'primary' ? 'primary' : color === 'warning' ? 'status-warning' : 'accent-purple'}); margin-top: 0.5rem; flex-shrink: 0;"></span>
                            <p style="font-size: 0.875rem; color: var(--text-secondary); line-height: 1.5;">${point}</p>
                        </li>
                        `).join('')}
                    </ul>
                </div>
                ` : ''}
                
                ${activity.actions && activity.actions.length > 0 ? `
                <div class="activity-actions">
                    ${activity.actions.map(action => {
                        if (action === 'quick-reply') return `<button class="btn btn-primary" style="flex: 1;"><span class="material-symbols-outlined" style="font-size: 1.125rem;">bolt</span>Quick Reply</button>`;
                        if (action === 'quick-book') return `<button class="btn btn-primary" style="flex: 1;"><span class="material-symbols-outlined" style="font-size: 1.125rem;">calendar_today</span>Quick Book</button>`;
                        if (action === 'archive') return `<button class="btn btn-icon btn-secondary"><span class="material-symbols-outlined">archive</span></button>`;
                        if (action === 'delete') return `<button class="btn btn-icon btn-secondary"><span class="material-symbols-outlined">delete</span></button>`;
                        if (action === 'approve') return `<button class="btn btn-primary btn-sm">APPROVE</button>`;
                        if (action === 'edit') return `<button class="btn btn-secondary btn-sm">EDIT</button>`;
                        if (action === 'dismiss') return `<button class="btn btn-ghost btn-sm">DISMISS</button>`;
                        return '';
                    }).join('')}
                </div>
                ` : ''}
            </div>
        `;
    }
};

// ===================================
// RULE BUILDER
// ===================================

const RuleBuilder = {
    conditions: [],
    actions: [],
    
    addCondition: function() {
        const types = ['Sender', 'Subject', 'Content', 'Date', 'Priority'];
        const type = types[Math.floor(Math.random() * types.length)];
        this.conditions.push({ type, value: 'New condition' });
        this.renderConditions();
    },
    
    addAction: function() {
        const types = ['Summarize', 'Draft Reply', 'Label', 'Archive', 'Forward'];
        const type = types[Math.floor(Math.random() * types.length)];
        this.actions.push({ type, value: 'New action' });
        this.renderActions();
    },
    
    renderConditions: function() {
        const container = document.getElementById('conditions-list');
        if (!container) return;
        
        container.innerHTML = this.conditions.map((cond, index) => `
            <div class="group/item relative bg-[#1A202C] hover:bg-[#202634] border border-white/5 hover:border-blue-500/30 rounded-xl p-3.5 transition-all duration-300 cursor-pointer">
                <div class="flex items-center gap-3.5">
                    <div class="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 group-hover/item:text-blue-400 transition-colors">
                        <span class="material-symbols-outlined text-[18px]">${this.getIconForCondition(cond.type)}</span>
                    </div>
                    <div class="flex-1">
                        <p class="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">${cond.type}</p>
                        <p class="text-sm text-slate-300">Is <span class="text-white font-medium">"${cond.value}"</span></p>
                    </div>
                    <span class="material-symbols-outlined text-slate-600 text-[18px]">chevron_right</span>
                </div>
            </div>
        `).join('');
    },
    
    renderActions: function() {
        const container = document.getElementById('actions-list');
        if (!container) return;
        
        container.innerHTML = this.actions.map((action, index) => `
            <div class="bg-navy-800 border border-white/10 rounded-3xl p-1 shadow-2xl overflow-hidden relative mb-4">
                <div class="p-5">
                    <div class="flex items-start gap-4 mb-4">
                        <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600/20 to-emerald-900/20 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-900/20">
                            <span class="material-symbols-outlined text-[24px]">${this.getIconForAction(action.type)}</span>
                        </div>
                        <div class="flex-1 pt-1">
                            <p class="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-0.5">Agent Action</p>
                            <h3 class="text-base font-medium text-white">${action.type}</h3>
                        </div>
                        <button class="text-slate-500 hover:text-white transition-colors p-1">
                            <span class="material-symbols-outlined">more_horiz</span>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    },
    
    getIconForCondition: function(type) {
        const icons = {
            'Sender': 'person',
            'Subject': 'subject',
            'Content': 'description',
            'Date': 'calendar_today',
            'Priority': 'priority_high'
        };
        return icons[type] || 'rule';
    },
    
    getIconForAction: function(type) {
        const icons = {
            'Summarize': 'summarize',
            'Draft Reply': 'edit_note',
            'Label': 'label',
            'Archive': 'archive',
            'Forward': 'forward'
        };
        return icons[type] || 'bolt';
    }
};

// ===================================
// INITIALIZATION
// ===================================

document.addEventListener('DOMContentLoaded', function() {
    // Initialize navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.dataset.page || this.textContent.trim().toLowerCase();
            Router.navigate(page);
        });
    });
    
    // Initialize agent cards
    AgentManager.renderAgents();
    
    // Initialize activity feed
    ActivityFeed.render();
    
    // Initialize tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const parent = this.parentElement;
            parent.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            if (parent.classList.contains('tabs')) {
                ActivityFeed.render(this.textContent.toLowerCase());
            }
        });
    });
    
    // Initialize toggle switches
    document.querySelectorAll('input[type="checkbox"]').forEach(toggle => {
        toggle.addEventListener('change', function() {
            const slider = this.nextElementSibling.querySelector('div');
            if (slider) {
                slider.style.transform = this.checked ? 'translateX(1.25rem)' : 'translateX(0)';
                this.nextElementSibling.style.backgroundColor = this.checked ? 'var(--primary)' : '#475569';
            }
        });
    });
    
    // Add ripple effect to buttons
    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            
            ripple.style.cssText = `
                position: absolute;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.3);
                width: ${size}px;
                height: ${size}px;
                left: ${e.clientX - rect.left - size / 2}px;
                top: ${e.clientY - rect.top - size / 2}px;
                animation: ripple 0.6s ease-out;
                pointer-events: none;
            `;
            
            this.style.position = 'relative';
            this.style.overflow = 'hidden';
            this.appendChild(ripple);
            
            setTimeout(() => ripple.remove(), 600);
        });
    });
    
    // Add slide animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ripple {
            from { transform: scale(0); opacity: 1; }
            to { transform: scale(2); opacity: 0; }
        }
        @keyframes slideUp {
            from { transform: translate(-50%, 20px); opacity: 0; }
            to { transform: translate(-50%, 0); opacity: 1; }
        }
        @keyframes slideDown {
            from { transform: translate(-50%, 0); opacity: 1; }
            to { transform: translate(-50%, 20px); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    // Show initial page
    Router.navigate('control');
});

// Export for global access
window.Router = Router;
window.AgentManager = AgentManager;
window.ActivityFeed = ActivityFeed;
window.RuleBuilder = RuleBuilder;