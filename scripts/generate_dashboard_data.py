#!/usr/bin/env python3
"""
Generate enhanced dashboard data by fetching GitHub metadata and cost information.
This script reads the current issues_list.json and enriches it with latest GitHub data.
"""

import json
import os
import re
import requests
from datetime import datetime, date
from dateutil.parser import parse

# Configuration
GITHUB_TOKEN = os.environ.get('GH_TOKEN')
REPO_OWNER = 'hmcts'
REPO_NAME = 'auto-shutdown-dev'
ISSUES_PER_PAGE = 100
BASE_URL = 'https://api.github.com'

def get_github_headers():
    """Get headers for GitHub API requests"""
    return {
        'Authorization': f'token {GITHUB_TOKEN}',
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'AutoShutdown-Dashboard-Data-Generator'
    }

def fetch_github_issues():
    """Fetch recent issues from GitHub API"""
    print("Fetching recent issues from GitHub API...")
    
    url = f"{BASE_URL}/repos/{REPO_OWNER}/{REPO_NAME}/issues"
    params = {
        'state': 'all',
        'per_page': ISSUES_PER_PAGE,
        'sort': 'created',
        'direction': 'desc'
    }
    
    try:
        response = requests.get(url, headers=get_github_headers(), params=params)
        response.raise_for_status()
        
        issues = response.json()
        
        # Filter for autoshutdown exclusion requests
        filtered_issues = []
        for issue in issues:
            if (issue.get('title', '').lower().find('auto shutdown') != -1 or
                issue.get('title', '').lower().find('autoshutdown') != -1 or
                issue.get('title', '').lower().find('exclusion') != -1 or
                any(label.get('name', '') in ['auto-approved', 'approved', 'pending'] 
                    for label in issue.get('labels', []))):
                filtered_issues.append(issue)
        
        print(f"Found {len(filtered_issues)} autoshutdown-related issues")
        return filtered_issues
        
    except requests.RequestException as e:
        print(f"Error fetching GitHub issues: {e}")
        return []

def extract_cost_from_comments(issue_number):
    """Extract cost information from issue comments"""
    try:
        url = f"{BASE_URL}/repos/{REPO_OWNER}/{REPO_NAME}/issues/{issue_number}/comments"
        response = requests.get(url, headers=get_github_headers())
        response.raise_for_status()
        
        comments = response.json()
        
        # Look for cost information in comments
        for comment in comments:
            body = comment.get('body', '')
            cost_match = re.search(r'Total estimated cost.*?£([\d,]+\.?\d*)', body, re.IGNORECASE)
            if cost_match:
                return f"£{cost_match.group(1)}"
        
        return None
        
    except requests.RequestException as e:
        print(f"Error fetching comments for issue {issue_number}: {e}")
        return None

def transform_github_issue(issue):
    """Transform GitHub issue data to dashboard format"""
    labels = [label['name'] for label in issue.get('labels', [])]
    
    # Determine status from labels
    status = 'pending'
    if 'auto-approved' in labels:
        status = 'auto-approved'
    elif 'approved' in labels:
        status = 'approved'
    elif 'denied' in labels:
        status = 'denied'
    elif 'cancel' in labels or 'cancel' in issue.get('title', '').lower():
        status = 'cancelled'
    
    # Extract data from issue body (simplified parsing)
    body = issue.get('body', '')
    
    def extract_field(field_name):
        patterns = [
            rf'{field_name}[:\s]*(.*?)(?:\n|$)',
            rf'### {field_name}\s*\n\s*(.*?)(?:\n###|$)',
            rf'### {field_name}[:\s]*\n\s*(.*?)(?:\n###|$)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, body, re.IGNORECASE | re.MULTILINE)
            if match:
                return match.group(1).strip()
        return ''
    
    # Extract cost information
    cost = extract_cost_from_comments(issue['number'])
    
    return {
        'issue_number': issue['number'],
        'title': issue['title'],
        'status': status,
        'created_at': issue['created_at'],
        'updated_at': issue['updated_at'],
        'issue_link': issue['html_url'],
        'requester': issue['user']['login'],
        'labels': labels,
        'business_area': extract_field('Business area') or extract_field('business_area'),
        'team_name': extract_field('Team/Application Name') or extract_field('team_name'),
        'environment': extract_field('Environment') or extract_field('environment'),
        'start_date': extract_field('Skip shutdown start date') or extract_field('start_date'),
        'end_date': extract_field('Skip shutdown end date') or extract_field('end_date'),
        'justification': extract_field('Justification for exclusion') or extract_field('justification'),
        'change_jira_id': extract_field('Change or Jira reference') or extract_field('change_jira_id'),
        'stay_on_late': extract_field('Do you need this exclusion past 11pm') or extract_field('stay_on_late'),
        'cost': cost,
        'body': body,
        'request_type': 'stop'  # Assume shutdown exclusion requests
    }

def merge_with_existing_data(github_issues, existing_data):
    """Merge GitHub data with existing local data, preserving local entries not found in GitHub"""
    print("Merging GitHub data with existing local data...")
    
    # Create lookup for GitHub issues by issue number
    github_lookup = {}
    for issue in github_issues:
        transformed = transform_github_issue(issue)
        if transformed['issue_number']:
            github_lookup[str(transformed['issue_number'])] = transformed
    
    # Start with GitHub data as primary source
    merged_data = list(github_lookup.values())
    
    # Add any local entries that don't exist in GitHub (preserving manually added data)
    for local_entry in existing_data:
        local_issue_num = str(local_entry.get('issue_number', ''))
        
        # If this entry has an issue number and it's in GitHub data, skip it (GitHub data takes precedence)
        if local_issue_num and local_issue_num in github_lookup:
            continue
            
        # Preserve local entries that either have no issue number or weren't found in GitHub
        if (local_entry.get('team_name') and 
            local_entry.get('start_date') and 
            local_entry.get('business_area')):
            print(f"Preserving local entry: {local_entry.get('team_name', 'Unknown')}")
            merged_data.append(local_entry)
    
    # Filter out entries with missing essential data from GitHub
    valid_data = []
    for entry in merged_data:
        if (entry.get('team_name') and 
            entry.get('start_date') and 
            entry.get('business_area')):
            valid_data.append(entry)
        else:
            print(f"Skipping entry with missing data: {entry.get('title', 'Unknown')}")
    
    # Sort by created date (newest first) and limit to recent entries
    try:
        valid_data.sort(key=lambda x: parse(x.get('created_at', '1970-01-01')), reverse=True)
    except:
        print("Warning: Could not sort by created_at, using original order")
    
    # Take only the last 50 entries to keep the file manageable
    final_data = valid_data[:50]
    
    print(f"Final dataset contains {len(final_data)} entries")
    return final_data

def load_existing_data():
    """Load existing issues_list.json data"""
    filepath = "issues_list.json"
    try:
        with open(filepath, 'r') as f:
            data = json.load(f)
            print(f"Loaded {len(data)} existing entries from {filepath}")
            return data
    except FileNotFoundError:
        print(f"No existing {filepath} found, starting fresh")
        return []
    except json.JSONDecodeError as e:
        print(f"Error parsing {filepath}: {e}, starting fresh")
        return []

def save_data(data):
    """Save data to both root and docs directories"""
    # Save to root directory
    filepath = "issues_list.json"
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"Saved {len(data)} entries to {filepath}")
    
    # Save to docs directory for GitHub Pages
    docs_filepath = "docs/issues_list.json"
    try:
        with open(docs_filepath, 'w') as f:
            json.dump(data, f, indent=2)
        print(f"Saved {len(data)} entries to {docs_filepath}")
    except Exception as e:
        print(f"Warning: Could not save to docs directory: {e}")

def main():
    """Main function to generate enhanced dashboard data"""
    print("Starting dashboard data generation...")
    
    # Load existing data
    existing_data = load_existing_data()
    
    # Fetch latest GitHub issues
    github_issues = fetch_github_issues()
    
    if not github_issues and not existing_data:
        print("No data available from GitHub API or local file")
        return
    
    # Merge data sources
    merged_data = merge_with_existing_data(github_issues, existing_data)
    
    # Save the enhanced data
    save_data(merged_data)
    
    print("Dashboard data generation complete!")

if __name__ == "__main__":
    main()