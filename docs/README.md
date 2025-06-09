# GitHub Pages Configuration

# Autoshutdown Exclusion Dashboard

This directory contains the source files for the GitHub Pages site that displays the visual dashboard for autoshutdown exclusion requests.

## Files

- `index.html` - Main dashboard page
- `styles.css` - Styling for the dashboard
- `script.js` - JavaScript functionality for fetching and displaying data

## Features

- Calendar view showing exclusion requests
- Filtering by business area, team, environment, status, and date range
- Summary statistics
- Detailed request information
- Export functionality (CSV/JSON)
- Responsive design

## Setup

GitHub Pages should automatically build and deploy this site when files are committed to the `docs/` directory on the main branch.

The dashboard fetches data directly from the GitHub Issues API to display real-time information about autoshutdown exclusion requests.