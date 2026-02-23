/**
 * Analytics Module
 * Handles crash statistics and data visualizations
 */

import { dataState } from './state.js';

/**
 * Update crash statistics display
 * Calculates totals from filtered data and updates the statistics dashboard
 */
export function updateStatistics() {
    const totalCrashes = dataState.filteredData.length;
    let totalFatalities = 0;
    let totalSerious = 0;
    let totalMinor = 0;

    dataState.filteredData.forEach(row => {
        totalFatalities += parseInt(row['Total Fats'] || 0);
        totalSerious += parseInt(row['Total SI'] || 0);
        totalMinor += parseInt(row['Total MI'] || 0);
    });

    // Update DOM elements
    const crashesEl = document.getElementById('totalCrashes');
    const fatalitiesEl = document.getElementById('totalFatalities');
    const seriousEl = document.getElementById('totalSerious');
    const minorEl = document.getElementById('totalMinor');

    if (crashesEl) crashesEl.textContent = totalCrashes.toLocaleString();
    if (fatalitiesEl) fatalitiesEl.textContent = totalFatalities.toLocaleString();
    if (seriousEl) seriousEl.textContent = totalSerious.toLocaleString();
    if (minorEl) minorEl.textContent = totalMinor.toLocaleString();

    return {
        totalCrashes,
        totalFatalities,
        totalSerious,
        totalMinor
    };
}

/**
 * Get crash counts by year
 * @param {Array} data - Crash data array
 * @returns {Object} Year-to-count mapping
 */
export function getCrashCountsByYear(data = dataState.filteredData) {
    const yearCounts = {};

    data.forEach(crash => {
        const year = parseInt(crash.Year);
        if (!isNaN(year)) {
            yearCounts[year] = (yearCounts[year] || 0) + 1;
        }
    });

    return yearCounts;
}

/**
 * Get crash counts by severity
 * @param {Array} data - Crash data array
 * @returns {Object} Severity-to-count mapping
 */
export function getCrashCountsBySeverity(data = dataState.filteredData) {
    const severityCounts = {};

    data.forEach(crash => {
        const severity = crash['CSEF Severity'];
        if (severity) {
            severityCounts[severity] = (severityCounts[severity] || 0) + 1;
        }
    });

    return severityCounts;
}

/**
 * Get crash counts by crash type
 * @param {Array} data - Crash data array
 * @returns {Object} CrashType-to-count mapping
 */
export function getCrashCountsByCrashType(data = dataState.filteredData) {
    const typeCounts = {};

    data.forEach(crash => {
        const type = crash['Crash Type'];
        if (type && type !== 'N/A') {
            typeCounts[type] = (typeCounts[type] || 0) + 1;
        }
    });

    return typeCounts;
}

/**
 * Get crash counts by month
 * @param {Array} data - Crash data array
 * @returns {Object} Month-to-count mapping (1-12)
 */
export function getCrashCountsByMonth(data = dataState.filteredData) {
    const monthCounts = {};
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Initialize all months to 0
    monthNames.forEach((name, idx) => {
        monthCounts[name] = 0;
    });

    data.forEach(crash => {
        const dt = crash['Crash Date Time'];
        if (dt) {
            const datePart = dt.split(' ')[0];
            const parts = datePart.split('/');
            if (parts.length >= 2) {
                const month = parseInt(parts[1]) - 1; // 0-indexed
                if (month >= 0 && month < 12) {
                    monthCounts[monthNames[month]]++;
                }
            }
        }
    });

    return monthCounts;
}

/**
 * Get crash counts by day of week
 * @param {Array} data - Crash data array
 * @returns {Object} DayOfWeek-to-count mapping
 */
export function getCrashCountsByDayOfWeek(data = dataState.filteredData) {
    const dayCounts = {
        'Sunday': 0,
        'Monday': 0,
        'Tuesday': 0,
        'Wednesday': 0,
        'Thursday': 0,
        'Friday': 0,
        'Saturday': 0
    };

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    data.forEach(crash => {
        const dt = crash['Crash Date Time'];
        if (dt) {
            const datePart = dt.split(' ')[0];
            const parts = datePart.split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]) - 1;
                const year = parseInt(parts[2]);

                const date = new Date(year, month, day);
                const dayOfWeek = date.getDay();
                dayCounts[dayNames[dayOfWeek]]++;
            }
        }
    });

    return dayCounts;
}

/**
 * Get crash counts by hour of day
 * @param {Array} data - Crash data array
 * @returns {Object} Hour-to-count mapping (0-23)
 */
export function getCrashCountsByHour(data = dataState.filteredData) {
    const hourCounts = {};

    // Initialize all hours to 0
    for (let i = 0; i < 24; i++) {
        hourCounts[i] = 0;
    }

    data.forEach(crash => {
        const dt = crash['Crash Date Time'];
        if (dt) {
            const parts = dt.split(' ');
            if (parts.length >= 2) {
                const timePart = parts[1];
                const timeParts = timePart.split(':');
                if (timeParts.length >= 1) {
                    const hour = parseInt(timeParts[0]);
                    if (hour >= 0 && hour < 24) {
                        hourCounts[hour]++;
                    }
                }
            }
        }
    });

    return hourCounts;
}

/**
 * Get crash counts by LGA
 * @param {Array} data - Crash data array
 * @returns {Object} LGA-to-count mapping
 */
export function getCrashCountsByLGA(data = dataState.filteredData) {
    const lgaCounts = {};

    data.forEach(crash => {
        const lga = crash.LGA;
        if (lga && lga !== 'N/A') {
            lgaCounts[lga] = (lgaCounts[lga] || 0) + 1;
        }
    });

    return lgaCounts;
}

/**
 * Get top N items from count object
 * @param {Object} counts - Count mapping
 * @param {number} n - Number of top items to return
 * @returns {Array} Array of [key, count] pairs sorted by count
 */
export function getTopN(counts, n = 10) {
    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n);
}

/**
 * Update charts with filtered data
 * Placeholder for Chart.js visualizations
 * @param {Array} data - Filtered crash data
 */
export function updateChartsWithData(data) {
    // Placeholder for future Chart.js implementation
    // This function can be expanded to create:
    // - Time series charts (crashes by year/month)
    // - Bar charts (crashes by type, severity)
    // - Pie charts (distribution)
    // - Line charts (trends)

    if (typeof Chart === 'undefined') {
        return;
    }

    // Example: Get data for charts
    const yearCounts = getCrashCountsByYear(data);
    const severityCounts = getCrashCountsBySeverity(data);
    const monthCounts = getCrashCountsByMonth(data);

    // TODO: Implement actual Chart.js visualizations
    // Example structure:
    /*
    const ctx = document.getElementById('myChart');
    if (ctx) {
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: Object.keys(yearCounts),
                datasets: [{
                    label: 'Crashes by Year',
                    data: Object.values(yearCounts),
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Crash Trends'
                    }
                }
            }
        });
    }
    */
}

/**
 * Generate summary statistics object
 * @returns {Object} Comprehensive statistics summary
 */
export function generateSummaryStats() {
    const data = dataState.filteredData;

    return {
        overview: updateStatistics(),
        byYear: getCrashCountsByYear(data),
        bySeverity: getCrashCountsBySeverity(data),
        byCrashType: getCrashCountsByCrashType(data),
        byMonth: getCrashCountsByMonth(data),
        byDayOfWeek: getCrashCountsByDayOfWeek(data),
        byHour: getCrashCountsByHour(data),
        byLGA: getCrashCountsByLGA(data),
        topCrashTypes: getTopN(getCrashCountsByCrashType(data), 10),
        topLGAs: getTopN(getCrashCountsByLGA(data), 10)
    };
}

/**
 * Export analytics data to console for debugging
 */
export function debugAnalytics() {
    return generateSummaryStats();
}
