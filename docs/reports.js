// Reports page functionality

// Initialize reports when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeReports();
});

async function initializeReports() {
    showLoading();
    try {
        await fetchIssues();
        hideLoading();
    } catch (error) {
        console.error('Error initializing reports:', error);
        showError();
    }
}

function generateExecutiveReport() {
    alert('Executive Summary report generation coming soon!\n\nThis will include:\n- Monthly cost analysis\n- Key performance indicators\n- Trend summaries\n- Management recommendations');
}

function generateDetailedReport() {
    alert('Detailed Analytics report generation coming soon!\n\nThis will include:\n- Environment usage patterns\n- Cost breakdowns\n- Workflow efficiency metrics\n- Resource utilization data');
}

function generateAuditReport() {
    alert('Audit Trail report generation coming soon!\n\nThis will include:\n- Complete request history\n- Decision tracking\n- Compliance verification\n- Change management logs');
}

function configureScheduledReports() {
    alert('Scheduled Reports configuration coming soon!\n\nThis will include:\n- Report scheduling interface\n- Email notification setup\n- Custom report templates\n- Alert configuration');
}

function exportAllData(format) {
    if (!allIssues || allIssues.length === 0) {
        alert('No data available for export. Please wait for data to load.');
        return;
    }
    
    switch(format) {
        case 'csv':
            exportCSVReport();
            break;
        case 'json':
            exportJSONReport();
            break;
        case 'pdf':
            alert('PDF export functionality coming soon!');
            break;
        default:
            alert('Unknown export format');
    }
}

function exportCSVReport() {
    const headers = [
        'ID', 'Title', 'Status', 'Created', 'Updated', 
        'Business Area', 'Team', 'Environment', 
        'Start Date', 'End Date', 'Cost', 'Justification',
        'Change/Jira ID', 'Stay on Late', 'User'
    ];
    
    const rows = allIssues.map(issue => [
        issue.id,
        issue.title,
        issue.status,
        formatDate(issue.created_at),
        formatDate(issue.updated_at),
        issue.business_area || '',
        issue.team_name || '',
        issue.environment || '',
        issue.start_date ? formatDate(issue.start_date) : '',
        issue.end_date ? formatDate(issue.end_date) : '',
        issue.cost || '',
        issue.justification || '',
        issue.change_jira_id || '',
        issue.stay_on_late || '',
        issue.user || ''
    ]);
    
    const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');
    
    downloadFile(csvContent, 'autoshutdown-complete-report.csv', 'text/csv');
}

function exportJSONReport() {
    const reportData = {
        generated_at: new Date().toISOString(),
        total_requests: allIssues.length,
        summary: generateSummaryStats(),
        data: allIssues
    };
    
    const jsonContent = JSON.stringify(reportData, null, 2);
    downloadFile(jsonContent, 'autoshutdown-complete-report.json', 'application/json');
}

function generateSummaryStats() {
    const stats = {
        by_status: {},
        by_environment: {},
        by_team: {},
        cost_analysis: {
            total: 0,
            average: 0,
            requests_with_cost: 0
        },
        time_analysis: {
            avg_duration_days: 0,
            requests_with_dates: 0
        }
    };
    
    let totalCost = 0;
    let costsCount = 0;
    let totalDuration = 0;
    let durationsCount = 0;
    
    allIssues.forEach(issue => {
        // Status stats
        stats.by_status[issue.status] = (stats.by_status[issue.status] || 0) + 1;
        
        // Environment stats
        const env = issue.environment || 'Unknown';
        stats.by_environment[env] = (stats.by_environment[env] || 0) + 1;
        
        // Team stats
        const team = issue.team_name || 'Unknown';
        stats.by_team[team] = (stats.by_team[team] || 0) + 1;
        
        // Cost analysis
        if (issue.cost) {
            const costMatch = issue.cost.match(/£?([\d,]+\.?\d*)/);
            if (costMatch) {
                const cost = parseFloat(costMatch[1].replace(',', ''));
                totalCost += cost;
                costsCount++;
            }
        }
        
        // Duration analysis
        if (issue.start_date && issue.end_date) {
            const duration = Math.ceil((issue.end_date - issue.start_date) / (1000 * 60 * 60 * 24));
            totalDuration += duration;
            durationsCount++;
        }
    });
    
    stats.cost_analysis.total = totalCost;
    stats.cost_analysis.average = costsCount > 0 ? totalCost / costsCount : 0;
    stats.cost_analysis.requests_with_cost = costsCount;
    
    stats.time_analysis.avg_duration_days = durationsCount > 0 ? totalDuration / durationsCount : 0;
    stats.time_analysis.requests_with_dates = durationsCount;
    
    return stats;
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