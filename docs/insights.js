// Insights page functionality - includes filters, statistics, and charts

// Initialize insights when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeInsights();
});

async function initializeInsights() {
    showLoading();
    try {
        await fetchIssues();
        renderInsights();
        setupInsightsEventListeners();
    } catch (error) {
        console.error('Error initializing insights:', error);
        showError();
    }
}

function renderInsights() {
    populateTeamDropdown();
    renderSummary();
    renderAnalytics();
    renderCharts();
    hideLoading();
}

function populateTeamDropdown() {
    const teamFilter = document.getElementById('team-filter');
    if (!teamFilter) return;
    
    const teams = [...new Set(allIssues.map(issue => issue.team_name).filter(team => team && team.trim() !== ''))];
    teams.sort();
    
    // Clear existing options except "All"
    teamFilter.innerHTML = '<option value="">All</option>';
    
    teams.forEach(team => {
        const option = document.createElement('option');
        option.value = team;
        option.textContent = team;
        teamFilter.appendChild(option);
    });
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

    const activeCount = document.getElementById('active-count');
    const cancelledCount = document.getElementById('cancelled-count');
    const pendingCount = document.getElementById('pending-count');
    const totalCount = document.getElementById('total-count');
    
    if (activeCount) activeCount.textContent = stats.active;
    if (cancelledCount) cancelledCount.textContent = stats.cancelled;
    if (pendingCount) pendingCount.textContent = stats.pending;
    if (totalCount) totalCount.textContent = stats.total;
}

function renderAnalytics() {
    // Calculate total cost
    let totalCost = 0;
    filteredIssues.forEach(issue => {
        if (issue.cost) {
            const costMatch = issue.cost.match(/£?([\d,]+\.?\d*)/);
            if (costMatch) {
                totalCost += parseFloat(costMatch[1].replace(',', ''));
            }
        }
    });
    
    // Calculate average duration
    let totalDuration = 0;
    let durationCount = 0;
    filteredIssues.forEach(issue => {
        if (issue.start_date && issue.end_date) {
            const duration = Math.ceil((issue.end_date - issue.start_date) / (1000 * 60 * 60 * 24));
            totalDuration += duration;
            durationCount++;
        }
    });
    const avgDuration = durationCount > 0 ? Math.round(totalDuration / durationCount) : 0;
    
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
    const totalCostEl = document.getElementById('total-cost');
    const avgDurationEl = document.getElementById('avg-duration');
    const approvalRateEl = document.getElementById('approval-rate');
    const topTeamEl = document.getElementById('top-team');
    
    if (totalCostEl) totalCostEl.textContent = totalCost > 0 ? `£${totalCost.toFixed(2)}` : 'No data';
    if (avgDurationEl) avgDurationEl.textContent = avgDuration > 0 ? `${avgDuration}` : 'No data';
    if (approvalRateEl) approvalRateEl.textContent = `${approvalRate}%`;
    if (topTeamEl) topTeamEl.textContent = topTeam;
}

function renderCharts() {
    renderStatusChart();
    renderEnvironmentChart();
    renderCostChart();
    renderTrendChart();
}

function renderStatusChart() {
    const ctx = document.getElementById('statusChart');
    if (!ctx) return;
    
    const statusCounts = {
        'approved': 0,
        'auto-approved': 0,
        'pending': 0,
        'denied': 0,
        'cancelled': 0
    };
    
    filteredIssues.forEach(issue => {
        if (statusCounts.hasOwnProperty(issue.status)) {
            statusCounts[issue.status]++;
        }
    });
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Approved', 'Auto-Approved', 'Pending', 'Denied', 'Cancelled'],
            datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: [
                    '#10b981',
                    '#34d399',
                    '#f59e0b',
                    '#ef4444',
                    '#6b7280'
                ]
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
    const ctx = document.getElementById('environmentChart');
    if (!ctx) return;
    
    const envCounts = {};
    filteredIssues.forEach(issue => {
        const env = issue.environment || 'Unknown';
        envCounts[env] = (envCounts[env] || 0) + 1;
    });
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(envCounts),
            datasets: [{
                label: 'Requests',
                data: Object.values(envCounts),
                backgroundColor: '#667eea'
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
                    beginAtZero: true
                }
            }
        }
    });
}

function renderCostChart() {
    const ctx = document.getElementById('costChart');
    if (!ctx) return;
    
    const costData = filteredIssues
        .filter(issue => issue.cost)
        .map(issue => {
            const costMatch = issue.cost.match(/£?([\d,]+\.?\d*)/);
            return costMatch ? parseFloat(costMatch[1].replace(',', '')) : 0;
        })
        .filter(cost => cost > 0);
    
    if (costData.length === 0) {
        ctx.getContext('2d').fillText('No cost data available', 10, 50);
        return;
    }
    
    // Group costs into ranges
    const ranges = [
        { label: '£0-50', min: 0, max: 50 },
        { label: '£50-100', min: 50, max: 100 },
        { label: '£100-250', min: 100, max: 250 },
        { label: '£250+', min: 250, max: Infinity }
    ];
    
    const rangeCounts = ranges.map(range => 
        costData.filter(cost => cost > range.min && cost <= range.max).length
    );
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ranges.map(r => r.label),
            datasets: [{
                label: 'Number of Requests',
                data: rangeCounts,
                backgroundColor: '#f59e0b'
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
                    beginAtZero: true
                }
            }
        }
    });
}

function renderTrendChart() {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;
    
    const last30Days = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        last30Days.push(date);
    }
    
    const dailyCounts = last30Days.map(date => {
        return filteredIssues.filter(issue => 
            issue.created_at.toDateString() === date.toDateString()
        ).length;
    });
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: last30Days.map(date => date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })),
            datasets: [{
                label: 'New Requests',
                data: dailyCounts,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                fill: true
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
                    beginAtZero: true
                }
            }
        }
    });
}

function setupInsightsEventListeners() {
    // Filter event listeners
    const businessAreaFilter = document.getElementById('business-area-filter');
    const teamFilter = document.getElementById('team-filter');
    const environmentFilter = document.getElementById('environment-filter');
    const statusFilter = document.getElementById('status-filter');
    const startDateFilter = document.getElementById('start-date-filter');
    const endDateFilter = document.getElementById('end-date-filter');
    
    if (businessAreaFilter) businessAreaFilter.addEventListener('change', applyFilters);
    if (teamFilter) teamFilter.addEventListener('change', applyFilters);
    if (environmentFilter) environmentFilter.addEventListener('change', applyFilters);
    if (statusFilter) statusFilter.addEventListener('change', applyFilters);
    if (startDateFilter) startDateFilter.addEventListener('change', applyFilters);
    if (endDateFilter) endDateFilter.addEventListener('change', applyFilters);
    
    // Action button listeners
    const clearFilters = document.getElementById('clear-filters');
    const exportCsv = document.getElementById('export-csv');
    const exportJson = document.getElementById('export-json');
    
    if (clearFilters) clearFilters.addEventListener('click', clearFilters);
    if (exportCsv) exportCsv.addEventListener('click', exportCSV);
    if (exportJson) exportJson.addEventListener('click', exportJSON);
}

function applyFilters() {
    const businessArea = document.getElementById('business-area-filter')?.value || '';
    const team = document.getElementById('team-filter')?.value || '';
    const environment = document.getElementById('environment-filter')?.value || '';
    const status = document.getElementById('status-filter')?.value || '';
    const startDate = document.getElementById('start-date-filter')?.value || '';
    const endDate = document.getElementById('end-date-filter')?.value || '';
    
    filteredIssues = allIssues.filter(issue => {
        if (businessArea && issue.business_area !== businessArea) return false;
        if (team && issue.team_name !== team) return false;
        if (environment && issue.environment !== environment) return false;
        if (status && issue.status !== status) return false;
        if (startDate && issue.created_at < new Date(startDate)) return false;
        if (endDate && issue.created_at > new Date(endDate)) return false;
        return true;
    });
    
    // Re-render with filtered data
    renderSummary();
    renderAnalytics();
    renderCharts();
}

function clearFilters() {
    const filters = [
        'business-area-filter',
        'team-filter', 
        'environment-filter',
        'status-filter',
        'start-date-filter',
        'end-date-filter'
    ];
    
    filters.forEach(filterId => {
        const filter = document.getElementById(filterId);
        if (filter) filter.value = '';
    });
    
    filteredIssues = [...allIssues];
    renderSummary();
    renderAnalytics();
    renderCharts();
}

function exportCSV() {
    const headers = ['ID', 'Title', 'Status', 'Business Area', 'Team', 'Environment', 'Start Date', 'End Date', 'Cost'];
    const rows = filteredIssues.map(issue => [
        issue.id,
        issue.title,
        issue.status,
        issue.business_area || '',
        issue.team_name || '',
        issue.environment || '',
        issue.start_date ? formatDate(issue.start_date) : '',
        issue.end_date ? formatDate(issue.end_date) : '',
        issue.cost || ''
    ]);
    
    const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');
    
    downloadFile(csvContent, 'autoshutdown-insights.csv', 'text/csv');
}

function exportJSON() {
    const jsonContent = JSON.stringify(filteredIssues, null, 2);
    downloadFile(jsonContent, 'autoshutdown-insights.json', 'application/json');
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