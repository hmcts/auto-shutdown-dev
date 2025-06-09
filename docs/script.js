// Dashboard Configuration
const CONFIG = {
    GITHUB_API_BASE: 'https://api.github.com',
    REPO_OWNER: 'hmcts',
    REPO_NAME: 'auto-shutdown-dev',
    ISSUES_PER_PAGE: 100,
    DAYS_TO_SHOW: 30
};

// Global state
let allIssues = [];
let filteredIssues = [];
let currentDate = new Date();

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
});

async function initializeDashboard() {
    showLoading();
    try {
        await fetchIssues();
        renderDashboard();
        setupEventListeners();
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showError();
    }
}

function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('error').classList.add('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

function showError() {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('error').classList.remove('hidden');
}

async function fetchIssues() {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - CONFIG.DAYS_TO_SHOW);
        
        const since = thirtyDaysAgo.toISOString();
        const url = `${CONFIG.GITHUB_API_BASE}/repos/${CONFIG.REPO_OWNER}/${CONFIG.REPO_NAME}/issues`;
        const params = new URLSearchParams({
            state: 'all',
            since: since,
            per_page: CONFIG.ISSUES_PER_PAGE,
            sort: 'created',
            direction: 'desc'
        });

        const response = await fetch(`${url}?${params}`, {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'AutoShutdown-Dashboard'
            }
        });
        
        if (!response.ok) {
            let errorMessage = `GitHub API error: ${response.status}`;
            if (response.status === 403) {
                errorMessage += ' - Rate limit exceeded. Please try again later.';
            } else if (response.status === 404) {
                errorMessage += ' - Repository not found or not accessible.';
            }
            throw new Error(errorMessage);
        }

        const issues = await response.json();
        
        // Filter for autoshutdown exclusion requests
        allIssues = issues.filter(issue => 
            issue.title && 
            (issue.title.toLowerCase().includes('auto shutdown') || 
             issue.title.toLowerCase().includes('autoshutdown') ||
             issue.title.toLowerCase().includes('exclusion') ||
             issue.labels.some(label => 
                label.name.includes('auto-approved') || 
                label.name.includes('approved') ||
                label.name.includes('pending')
             ))
        ).map(transformIssueData);

        filteredIssues = [...allIssues];
        hideLoading();
        
    } catch (error) {
        console.error('Error fetching from GitHub API:', error);
        // Fallback to local issues_list.json if available
        try {
            await fetchFromLocalJSON();
        } catch (fallbackError) {
            console.error('Error fetching from fallback source:', fallbackError);
            throw error; // Throw original error
        }
    }
}

async function fetchFromLocalJSON() {
    try {
        const response = await fetch('../issues_list.json');
        if (!response.ok) {
            throw new Error('Local JSON file not accessible');
        }
        
        const localIssues = await response.json();
        
        // Transform local JSON data to match our format
        allIssues = localIssues.map((issue, index) => ({
            id: index + 1,
            title: `Exclusion Request - ${issue.team_name || 'Unknown Team'}`,
            status: 'approved', // Assume approved since it's in the local file
            created_at: new Date(issue.start_date || Date.now()),
            updated_at: new Date(issue.start_date || Date.now()),
            html_url: issue.issue_link || '#',
            user: 'unknown',
            labels: ['approved'],
            business_area: issue.business_area,
            team_name: issue.team_name,
            environment: Array.isArray(issue.environment) ? issue.environment.join(', ') : issue.environment,
            start_date: parseDate(issue.start_date),
            end_date: parseDate(issue.end_date),
            justification: issue.justification,
            change_jira_id: issue.change_jira_id,
            stay_on_late: issue.stay_on_late,
            body: `Backup data from local JSON file`
        })).filter(issue => {
            // Only show issues from the last 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - CONFIG.DAYS_TO_SHOW);
            return issue.start_date && issue.start_date >= thirtyDaysAgo;
        });

        filteredIssues = [...allIssues];
        hideLoading();
        
        // Show a notice that we're using fallback data
        const notice = document.createElement('div');
        notice.style.cssText = 'background: #fef3c7; border: 1px solid #f59e0b; padding: 10px; margin: 10px 0; border-radius: 6px; color: #92400e;';
        notice.innerHTML = '⚠️ Using local data as GitHub API is not accessible. Some features may be limited.';
        document.querySelector('.container').insertBefore(notice, document.querySelector('.summary-section'));
        
    } catch (error) {
        console.error('Error fetching from local JSON:', error);
        throw error;
    }
}

function transformIssueData(issue) {
    const labels = issue.labels.map(l => l.name);
    
    // Determine status from labels
    let status = 'pending';
    if (labels.includes('auto-approved')) status = 'auto-approved';
    else if (labels.includes('approved')) status = 'approved';
    else if (labels.includes('denied')) status = 'denied';
    else if (labels.includes('cancel') || issue.title.toLowerCase().includes('cancel')) status = 'cancelled';
    
    // Extract data from issue body (simplified parsing)
    const body = issue.body || '';
    const extractField = (field) => {
        const regex = new RegExp(`${field}[:\\s]*(.*?)(?:\\n|$)`, 'i');
        const match = body.match(regex);
        return match ? match[1].trim() : '';
    };

    return {
        id: issue.number,
        title: issue.title,
        status: status,
        created_at: new Date(issue.created_at),
        updated_at: new Date(issue.updated_at),
        html_url: issue.html_url,
        user: issue.user.login,
        labels: labels,
        business_area: extractField('Business area') || extractField('business_area'),
        team_name: extractField('Team/Application Name') || extractField('team_name'),
        environment: extractField('Environment') || extractField('environment'),
        start_date: parseDate(extractField('Skip shutdown start date') || extractField('start_date')),
        end_date: parseDate(extractField('Skip shutdown end date') || extractField('end_date')),
        justification: extractField('Justification for exclusion') || extractField('justification'),
        change_jira_id: extractField('Change or Jira reference') || extractField('change_jira_id'),
        stay_on_late: extractField('Do you need this exclusion past 11pm') || extractField('stay_on_late'),
        body: body
    };
}

function parseDate(dateString) {
    if (!dateString) return null;
    
    // Try multiple date formats
    const formats = [
        /(\d{1,2})-(\d{1,2})-(\d{4})/,  // DD-MM-YYYY
        /(\d{4})-(\d{1,2})-(\d{1,2})/,  // YYYY-MM-DD
        /(\d{1,2})\/(\d{1,2})\/(\d{4})/  // DD/MM/YYYY
    ];
    
    for (let format of formats) {
        const match = dateString.match(format);
        if (match) {
            if (format === formats[0] || format === formats[2]) {
                // DD-MM-YYYY or DD/MM/YYYY
                return new Date(match[3], match[2] - 1, match[1]);
            } else {
                // YYYY-MM-DD
                return new Date(match[1], match[2] - 1, match[3]);
            }
        }
    }
    
    // Fallback to standard parsing
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
}

function renderDashboard() {
    renderSummary();
    renderCalendar();
    renderRequestsList();
}

function renderSummary() {
    const now = new Date();
    const stats = {
        active: 0,
        cancelled: 0,
        pending: 0,
        total: filteredIssues.length
    };

    filteredIssues.forEach(issue => {
        if (issue.status === 'cancelled') {
            stats.cancelled++;
        } else if (issue.status === 'pending') {
            stats.pending++;
        } else if (issue.status === 'approved' || issue.status === 'auto-approved') {
            // Check if the request is still active (end date hasn't passed)
            if (issue.end_date && issue.end_date >= now) {
                stats.active++;
            }
        }
    });

    document.getElementById('active-count').textContent = stats.active;
    document.getElementById('cancelled-count').textContent = stats.cancelled;
    document.getElementById('pending-count').textContent = stats.pending;
    document.getElementById('total-count').textContent = stats.total;
}

function renderCalendar() {
    const calendarGrid = document.getElementById('calendar-grid');
    const currentMonthElement = document.getElementById('current-month');
    
    // Clear existing calendar
    calendarGrid.innerHTML = '';
    
    // Set month header
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    currentMonthElement.textContent = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    
    // Create calendar days
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // Start from Sunday
    
    const today = new Date();
    
    for (let i = 0; i < 42; i++) { // 6 weeks * 7 days
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        
        if (date.getMonth() !== currentDate.getMonth()) {
            dayElement.classList.add('other-month');
        }
        
        if (date.toDateString() === today.toDateString()) {
            dayElement.classList.add('today');
        }
        
        // Day number
        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = date.getDate();
        dayElement.appendChild(dayNumber);
        
        // Requests for this day
        const dayRequests = document.createElement('div');
        dayRequests.className = 'day-requests';
        
        const requestsForDay = filteredIssues.filter(issue => {
            if (!issue.start_date || !issue.end_date) return false;
            return date >= issue.start_date && date <= issue.end_date;
        });
        
        requestsForDay.forEach(request => {
            const indicator = document.createElement('div');
            indicator.className = `request-indicator ${request.status}`;
            indicator.textContent = `${request.team_name || 'Unknown'} - ${request.environment || 'Unknown'}`;
            indicator.title = `${request.title}\nTeam: ${request.team_name}\nEnvironment: ${request.environment}\nStatus: ${request.status}`;
            indicator.onclick = () => showRequestDetails(request);
            dayRequests.appendChild(indicator);
        });
        
        dayElement.appendChild(dayRequests);
        calendarGrid.appendChild(dayElement);
    }
}

function renderRequestsList() {
    const container = document.getElementById('requests-container');
    container.innerHTML = '';
    
    if (filteredIssues.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #6b7280; padding: 40px;">No requests found matching your filters.</p>';
        return;
    }
    
    filteredIssues.forEach(request => {
        const card = document.createElement('div');
        card.className = `request-card ${request.status === 'cancelled' ? 'cancelled' : ''}`;
        
        card.innerHTML = `
            <div class="request-header">
                <div class="request-title">${request.title}</div>
                <div class="request-status ${request.status}">${request.status}</div>
            </div>
            <div class="request-details">
                <div class="detail-item">
                    <div class="detail-label">Team/Application</div>
                    <div>${request.team_name || 'Not specified'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Business Area</div>
                    <div>${request.business_area || 'Not specified'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Environment</div>
                    <div>${request.environment || 'Not specified'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Start Date</div>
                    <div>${request.start_date ? formatDate(request.start_date) : 'Not specified'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">End Date</div>
                    <div>${request.end_date ? formatDate(request.end_date) : 'Not specified'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Created</div>
                    <div>${formatDate(request.created_at)}</div>
                </div>
            </div>
        `;
        
        card.onclick = () => showRequestDetails(request);
        container.appendChild(card);
    });
}

function setupEventListeners() {
    // Filter event listeners
    document.getElementById('business-area-filter').addEventListener('change', applyFilters);
    document.getElementById('team-filter').addEventListener('input', applyFilters);
    document.getElementById('environment-filter').addEventListener('change', applyFilters);
    document.getElementById('status-filter').addEventListener('change', applyFilters);
    document.getElementById('start-date-filter').addEventListener('change', applyFilters);
    document.getElementById('end-date-filter').addEventListener('change', applyFilters);
    
    // Action button listeners
    document.getElementById('clear-filters').addEventListener('click', clearFilters);
    document.getElementById('export-csv').addEventListener('click', exportCSV);
    document.getElementById('export-json').addEventListener('click', exportJSON);
    
    // Calendar navigation
    document.getElementById('prev-month').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });
    
    document.getElementById('next-month').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });
    
    // Modal close
    document.querySelector('.close').addEventListener('click', closeModal);
    document.getElementById('request-modal').addEventListener('click', (e) => {
        if (e.target.id === 'request-modal') closeModal();
    });
}

function applyFilters() {
    const businessArea = document.getElementById('business-area-filter').value.toLowerCase();
    const teamFilter = document.getElementById('team-filter').value.toLowerCase();
    const environment = document.getElementById('environment-filter').value;
    const status = document.getElementById('status-filter').value;
    const startDate = document.getElementById('start-date-filter').value;
    const endDate = document.getElementById('end-date-filter').value;
    
    filteredIssues = allIssues.filter(issue => {
        // Business area filter
        if (businessArea && (!issue.business_area || !issue.business_area.toLowerCase().includes(businessArea))) {
            return false;
        }
        
        // Team filter
        if (teamFilter && (!issue.team_name || !issue.team_name.toLowerCase().includes(teamFilter))) {
            return false;
        }
        
        // Environment filter
        if (environment && (!issue.environment || !issue.environment.includes(environment))) {
            return false;
        }
        
        // Status filter
        if (status && issue.status !== status) {
            return false;
        }
        
        // Date range filter
        if (startDate) {
            const filterStartDate = new Date(startDate);
            if (!issue.start_date || issue.start_date < filterStartDate) {
                return false;
            }
        }
        
        if (endDate) {
            const filterEndDate = new Date(endDate);
            if (!issue.end_date || issue.end_date > filterEndDate) {
                return false;
            }
        }
        
        return true;
    });
    
    renderDashboard();
}

function clearFilters() {
    document.getElementById('business-area-filter').value = '';
    document.getElementById('team-filter').value = '';
    document.getElementById('environment-filter').value = '';
    document.getElementById('status-filter').value = '';
    document.getElementById('start-date-filter').value = '';
    document.getElementById('end-date-filter').value = '';
    
    filteredIssues = [...allIssues];
    renderDashboard();
}

function showRequestDetails(request) {
    const modal = document.getElementById('request-modal');
    const content = document.getElementById('modal-content');
    
    content.innerHTML = `
        <h3>${request.title}</h3>
        <div style="margin-top: 20px;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                <div><strong>Status:</strong> <span class="request-status ${request.status}">${request.status}</span></div>
                <div><strong>Issue Number:</strong> #${request.id}</div>
                <div><strong>Requester:</strong> ${request.user}</div>
                <div><strong>Created:</strong> ${formatDate(request.created_at)}</div>
                <div><strong>Business Area:</strong> ${request.business_area || 'Not specified'}</div>
                <div><strong>Team/Application:</strong> ${request.team_name || 'Not specified'}</div>
                <div><strong>Environment:</strong> ${request.environment || 'Not specified'}</div>
                <div><strong>Start Date:</strong> ${request.start_date ? formatDate(request.start_date) : 'Not specified'}</div>
                <div><strong>End Date:</strong> ${request.end_date ? formatDate(request.end_date) : 'Not specified'}</div>
                <div><strong>Stay on Late:</strong> ${request.stay_on_late || 'Not specified'}</div>
                <div><strong>Change/Jira ID:</strong> ${request.change_jira_id || 'Not specified'}</div>
            </div>
            <div style="margin-top: 20px;">
                <strong>Justification:</strong>
                <p style="margin-top: 5px; padding: 10px; background: #f9fafb; border-radius: 4px;">
                    ${request.justification || 'Not specified'}
                </p>
            </div>
            <div style="margin-top: 20px;">
                <a href="${request.html_url}" target="_blank" class="btn-primary" style="text-decoration: none; display: inline-block;">
                    View on GitHub
                </a>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('request-modal').classList.add('hidden');
}

function formatDate(date) {
    if (!date) return 'Not specified';
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function exportCSV() {
    const headers = [
        'Issue Number', 'Title', 'Status', 'Requester', 'Business Area', 
        'Team/Application', 'Environment', 'Start Date', 'End Date', 
        'Justification', 'Created Date', 'GitHub URL'
    ];
    
    const csvContent = [
        headers.join(','),
        ...filteredIssues.map(request => [
            request.id,
            `"${request.title}"`,
            request.status,
            request.user,
            `"${request.business_area || ''}"`,
            `"${request.team_name || ''}"`,
            `"${request.environment || ''}"`,
            request.start_date ? formatDate(request.start_date) : '',
            request.end_date ? formatDate(request.end_date) : '',
            `"${request.justification || ''}"`,
            formatDate(request.created_at),
            request.html_url
        ].join(','))
    ].join('\n');
    
    downloadFile(csvContent, 'autoshutdown-requests.csv', 'text/csv');
}

function exportJSON() {
    const jsonContent = JSON.stringify(filteredIssues, null, 2);
    downloadFile(jsonContent, 'autoshutdown-requests.json', 'application/json');
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}