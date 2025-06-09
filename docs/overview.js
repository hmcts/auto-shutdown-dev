// Overview page functionality - includes calendar and recent requests

// Initialize overview when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeOverview();
});

async function initializeOverview() {
    showLoading();
    try {
        await fetchIssues();
        renderOverview();
        setupOverviewEventListeners();
    } catch (error) {
        console.error('Error initializing overview:', error);
        showError();
    }
}

function renderOverview() {
    renderCalendar();
    renderRequestsList();
    hideLoading();
}

function renderCalendar() {
    const calendarGrid = document.getElementById('calendar-grid');
    const currentMonthEl = document.getElementById('current-month');
    
    if (!calendarGrid || !currentMonthEl) return;
    
    // Clear calendar
    calendarGrid.innerHTML = '';
    
    // Set month header
    currentMonthEl.textContent = currentDate.toLocaleDateString('en-GB', { 
        month: 'long', 
        year: 'numeric' 
    });
    
    // Create calendar grid
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Create day headers
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayHeaders.forEach(day => {
        const headerEl = document.createElement('div');
        headerEl.className = 'calendar-header-day';
        headerEl.textContent = day;
        calendarGrid.appendChild(headerEl);
    });
    
    // Create calendar days (6 weeks = 42 days)
    for (let i = 0; i < 42; i++) {
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
            if (!issue.start_date) return false;
            const endDate = issue.end_date || issue.start_date; // Use start_date if end_date is null
            
            // Normalize dates to just compare day/month/year to avoid timezone issues
            const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const issueStart = new Date(issue.start_date.getFullYear(), issue.start_date.getMonth(), issue.start_date.getDate());
            const issueEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
            
            return dayStart >= issueStart && dayStart <= issueEnd;
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
    if (!container) return;
    
    container.innerHTML = '';
    
    // Sort by most recent first and limit to last 10
    const recentRequests = [...filteredIssues]
        .sort((a, b) => b.created_at - a.created_at)
        .slice(0, 10);
    
    if (recentRequests.length === 0) {
        container.innerHTML = '<p class="no-requests">No recent requests found.</p>';
        return;
    }
    
    recentRequests.forEach(request => {
        const card = document.createElement('div');
        card.className = 'request-card';
        
        card.innerHTML = `
            <div class="request-header">
                <h4>${request.title}</h4>
                <span class="request-status ${request.status}">${request.status}</span>
            </div>
            <div class="request-details">
                <div class="detail-item">
                    <span class="detail-label">Team</span>
                    <span>${request.team_name || 'Not specified'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Environment</span>
                    <span>${request.environment || 'Not specified'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Created</span>
                    <span>${formatDate(request.created_at)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Duration</span>
                    <span>${request.start_date && request.end_date ? 
                        `${formatDate(request.start_date)} - ${formatDate(request.end_date)}` : 
                        'Not specified'}</span>
                </div>
                ${request.cost ? `
                <div class="detail-item">
                    <span class="detail-label">Cost</span>
                    <span style="font-weight: 600; color: #dc2626;">${request.cost}</span>
                </div>
                ` : ''}
            </div>
        `;
        
        card.onclick = () => showRequestDetails(request);
        container.appendChild(card);
    });
}

function setupOverviewEventListeners() {
    // Calendar navigation
    const prevMonth = document.getElementById('prev-month');
    const nextMonth = document.getElementById('next-month');
    
    if (prevMonth) {
        prevMonth.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() - 1);
            renderCalendar();
        });
    }
    
    if (nextMonth) {
        nextMonth.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() + 1);
            renderCalendar();
        });
    }
}