// Dashboard Configuration
const CONFIG = {
    // Configuration moved to backend data fetcher
    // Frontend now only loads cached data
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
        // Load data from cached dashboard data file
        const response = await fetch('./dashboard_data.json');
        
        if (!response.ok) {
            throw new Error(`Failed to load dashboard data: ${response.status}`);
        }

        const cachedData = await response.json();
        
        // Extract issues from cached data
        if (!cachedData.data || !Array.isArray(cachedData.data)) {
            throw new Error('Invalid dashboard data format');
        }

        // Parse dates that were serialized as strings
        allIssues = cachedData.data.map(issue => ({
            ...issue,
            created_at: new Date(issue.created_at),
            updated_at: new Date(issue.updated_at),
            start_date: issue.start_date ? new Date(issue.start_date) : null,
            end_date: issue.end_date ? new Date(issue.end_date) : null
        }));

        filteredIssues = [...allIssues];
        hideLoading();
        
        console.log(`Loaded ${allIssues.length} issues from cached data`);
        if (cachedData.last_updated) {
            console.log(`Data last updated: ${cachedData.last_updated}`);
        }
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showError();
        
        // Show user-friendly error message
        const errorContainer = document.getElementById('error');
        errorContainer.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <h3 style="color: #ef4444; margin-bottom: 16px;">⚠️ Unable to Load Dashboard Data</h3>
                <p style="color: #6b7280; margin-bottom: 16px;">
                    The dashboard data is currently unavailable. This could be due to:
                </p>
                <ul style="color: #6b7280; text-align: left; max-width: 400px; margin: 0 auto 16px auto;">
                    <li>Data not yet generated (first-time setup)</li>
                    <li>Network connectivity issues</li>
                    <li>GitHub Pages deployment in progress</li>
                </ul>
                <p style="color: #6b7280;">
                    The data is refreshed daily. Please try again later or contact the administrator.
                </p>
                <button onclick="location.reload()" style="margin-top: 16px; padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Refresh Page
                </button>
            </div>
        `;
    }
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
    populateTeamDropdown();
    renderSummary();
    renderAnalytics();
    renderCharts();
    renderCalendar();
    renderRequestsList();
}

function populateTeamDropdown() {
    const teamFilter = document.getElementById('team-filter');
    const currentValue = teamFilter.value; // Preserve current selection
    
    // Get unique team names from all issues
    const uniqueTeams = [...new Set(allIssues
        .map(issue => issue.team_name)
        .filter(team => team && team.trim() !== '')
    )].sort();
    
    // Clear existing options except "All"
    const allOption = teamFilter.querySelector('option[value=""]');
    teamFilter.innerHTML = '';
    teamFilter.appendChild(allOption);
    
    // Add team options
    uniqueTeams.forEach(team => {
        const option = document.createElement('option');
        option.value = team;
        option.textContent = team;
        teamFilter.appendChild(option);
    });
    
    // Restore previous selection if it still exists
    if (currentValue && uniqueTeams.includes(currentValue)) {
        teamFilter.value = currentValue;
    }
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

function renderAnalytics() {
    // Calculate total cost
    const costsWithData = filteredIssues
        .filter(issue => issue.cost && issue.cost !== null)
        .map(issue => {
            const costStr = issue.cost.replace(/[£,]/g, '');
            return parseFloat(costStr) || 0;
        });
    
    const totalCost = costsWithData.reduce((sum, cost) => sum + cost, 0);
    
    // Calculate average duration
    const durationsInDays = filteredIssues
        .filter(issue => issue.start_date && issue.end_date)
        .map(issue => {
            const start = new Date(issue.start_date);
            const end = new Date(issue.end_date);
            return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        });
    
    const avgDuration = durationsInDays.length > 0 
        ? (durationsInDays.reduce((sum, duration) => sum + duration, 0) / durationsInDays.length).toFixed(1)
        : 0;
    
    // Calculate approval rate
    const approvedCount = filteredIssues.filter(issue => 
        issue.status === 'approved' || issue.status === 'auto-approved'
    ).length;
    const approvalRate = filteredIssues.length > 0 
        ? Math.round((approvedCount / filteredIssues.length) * 100)
        : 0;
    
    // Find most active team
    const teamCounts = {};
    filteredIssues.forEach(issue => {
        if (issue.team_name && issue.team_name.trim() !== '') {
            teamCounts[issue.team_name] = (teamCounts[issue.team_name] || 0) + 1;
        }
    });
    
    const topTeam = Object.keys(teamCounts).length > 0 
        ? Object.keys(teamCounts).reduce((a, b) => teamCounts[a] > teamCounts[b] ? a : b)
        : 'None';
    
    // Update the UI
    document.getElementById('total-cost').textContent = totalCost > 0 ? `£${totalCost.toFixed(2)}` : 'No data';
    document.getElementById('avg-duration').textContent = avgDuration > 0 ? `${avgDuration}` : 'No data';
    document.getElementById('approval-rate').textContent = `${approvalRate}%`;
    document.getElementById('top-team').textContent = topTeam;
}

function renderCharts() {
    renderStatusChart();
    renderEnvironmentChart();
    renderCostChart();
    renderTrendChart();
}

function renderStatusChart() {
    const ctx = document.getElementById('statusChart').getContext('2d');
    
    // Clear any existing chart
    if (window.statusChartInstance) {
        window.statusChartInstance.destroy();
    }
    
    const statusCounts = {};
    filteredIssues.forEach(issue => {
        statusCounts[issue.status] = (statusCounts[issue.status] || 0) + 1;
    });
    
    const statusColors = {
        'approved': '#22c55e',
        'auto-approved': '#10b981',
        'pending': '#f59e0b',
        'denied': '#ef4444',
        'cancelled': '#9ca3af'
    };
    
    window.statusChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(statusCounts),
            datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: Object.keys(statusCounts).map(status => statusColors[status] || '#6b7280'),
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function renderEnvironmentChart() {
    const ctx = document.getElementById('environmentChart').getContext('2d');
    
    if (window.environmentChartInstance) {
        window.environmentChartInstance.destroy();
    }
    
    const envCounts = {};
    filteredIssues.forEach(issue => {
        if (issue.environment && issue.environment.trim() !== '') {
            envCounts[issue.environment] = (envCounts[issue.environment] || 0) + 1;
        }
    });
    
    window.environmentChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(envCounts),
            datasets: [{
                label: 'Requests',
                data: Object.values(envCounts),
                backgroundColor: '#3b82f6',
                borderColor: '#2563eb',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function renderCostChart() {
    const ctx = document.getElementById('costChart').getContext('2d');
    
    if (window.costChartInstance) {
        window.costChartInstance.destroy();
    }
    
    const issuesWithCost = filteredIssues
        .filter(issue => issue.cost && issue.cost !== null)
        .map(issue => ({
            team: issue.team_name || 'Unknown',
            cost: parseFloat(issue.cost.replace(/[£,]/g, '')) || 0
        }));
    
    if (issuesWithCost.length === 0) {
        ctx.font = '16px Arial';
        ctx.fillStyle = '#6b7280';
        ctx.textAlign = 'center';
        ctx.fillText('No cost data available', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }
    
    const teamCosts = {};
    issuesWithCost.forEach(item => {
        teamCosts[item.team] = (teamCosts[item.team] || 0) + item.cost;
    });
    
    window.costChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(teamCosts),
            datasets: [{
                label: 'Total Cost (£)',
                data: Object.values(teamCosts),
                backgroundColor: '#dc2626',
                borderColor: '#b91c1c',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '£' + value.toFixed(0);
                        }
                    }
                }
            }
        }
    });
}

function renderTrendChart() {
    const ctx = document.getElementById('trendChart').getContext('2d');
    
    if (window.trendChartInstance) {
        window.trendChartInstance.destroy();
    }
    
    // Group requests by creation date (last 30 days)
    const last30Days = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        last30Days.push({
            date: date.toISOString().split('T')[0],
            count: 0
        });
    }
    
    filteredIssues.forEach(issue => {
        const createdDate = new Date(issue.created_at).toISOString().split('T')[0];
        const dayIndex = last30Days.findIndex(day => day.date === createdDate);
        if (dayIndex !== -1) {
            last30Days[dayIndex].count++;
        }
    });
    
    window.trendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: last30Days.map(day => {
                const date = new Date(day.date);
                return date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
            }),
            datasets: [{
                label: 'Requests Created',
                data: last30Days.map(day => day.count),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
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
            
            // Include cost information if available
            let displayText = `${request.team_name || 'Unknown'} - ${request.environment || 'Unknown'}`;
            if (request.cost) {
                displayText += ` (${request.cost})`;
            }
            indicator.textContent = displayText;
            
            let tooltip = `${request.title}\nTeam: ${request.team_name}\nEnvironment: ${request.environment}\nStatus: ${request.status}`;
            if (request.cost) {
                tooltip += `\nCost: ${request.cost}`;
            }
            indicator.title = tooltip;
            
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
                ${request.cost ? `
                <div class="detail-item">
                    <div class="detail-label">Estimated Cost</div>
                    <div style="font-weight: 600; color: #059669;">${request.cost}</div>
                </div>
                ` : ''}
            </div>
        `;
        
        card.onclick = () => showRequestDetails(request);
        container.appendChild(card);
    });
}

function setupEventListeners() {
    // Filter event listeners
    document.getElementById('business-area-filter').addEventListener('change', applyFilters);
    document.getElementById('team-filter').addEventListener('change', applyFilters);
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
    const teamFilter = document.getElementById('team-filter').value; // Exact match, no toLowerCase needed
    const environment = document.getElementById('environment-filter').value;
    const status = document.getElementById('status-filter').value;
    const startDate = document.getElementById('start-date-filter').value;
    const endDate = document.getElementById('end-date-filter').value;
    
    filteredIssues = allIssues.filter(issue => {
        // Business area filter
        if (businessArea && (!issue.business_area || !issue.business_area.toLowerCase().includes(businessArea))) {
            return false;
        }
        
        // Team filter - exact match
        if (teamFilter && issue.team_name !== teamFilter) {
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
                ${request.cost ? `<div><strong>Estimated Cost:</strong> <span style="font-weight: 600; color: #059669;">${request.cost}</span></div>` : ''}
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