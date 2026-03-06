/**
 * Analytics Module
 * Handles crash statistics and data visualizations
 */

import { dataState } from './state.js';
import { domCache, perfMonitor } from './performance.js';

/**
 * Update crash statistics display
 * @param {Array} data - Crash data array
 * @returns {Object} All analytics data
 */
export function computeAllAnalytics(data = dataState.filteredData) {
    const stats = {
        totalCrashes: data.length,
        totalFatalities: 0,
        totalSerious: 0,
        totalMinor: 0,
        byYear: {},
        bySeverity: {},
        byType: {},
        byMonth: {},
        byDayOfWeek: {
            'Sunday': 0, 'Monday': 0, 'Tuesday': 0, 'Wednesday': 0,
            'Thursday': 0, 'Friday': 0, 'Saturday': 0
        },
        byHour: {},
        byArea: {},
        byWeather: {}
    };

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Initialize months
    monthNames.forEach(name => {
        stats.byMonth[name] = 0;
    });

    // Initialize hours
    for (let i = 0; i < 24; i++) {
        stats.byHour[i] = 0;
    }

    // Single pass through all data
    data.forEach(crash => {
        // Casualties
        stats.totalFatalities += parseInt(crash['Total Fats'] || 0);
        stats.totalSerious += parseInt(crash['Total SI'] || 0);
        stats.totalMinor += parseInt(crash['Total MI'] || 0);

        // Year
        const year = parseInt(crash.Year);
        if (!isNaN(year)) {
            stats.byYear[year] = (stats.byYear[year] || 0) + 1;
        }

        // Severity
        const severity = crash['CSEF Severity'];
        if (severity) {
            stats.bySeverity[severity] = (stats.bySeverity[severity] || 0) + 1;
        }

        // Crash Type
        const type = crash['Crash Type'];
        if (type && type !== 'N/A') {
            stats.byType[type] = (stats.byType[type] || 0) + 1;
        }

        // Area
        const area = crash.LGA;
        if (area && area !== 'N/A') {
            stats.byArea[area] = (stats.byArea[area] || 0) + 1;
        }

        // Weather
        const weather = crash['Weather Cond'];
        if (weather) {
            stats.byWeather[weather] = (stats.byWeather[weather] || 0) + 1;
        }

        // Date/Time parsing (month, day, hour)
        const dt = crash['Crash Date Time'];
        if (dt) {
            const parts = dt.split(' ');
            if (parts.length >= 2) {
                const datePart = parts[0];
                const timePart = parts[1];

                // Parse date
                const dateParts = datePart.split('/');
                if (dateParts.length === 3) {
                    const day = parseInt(dateParts[0]);
                    const month = parseInt(dateParts[1]) - 1; // 0-indexed
                    const year = parseInt(dateParts[2]);

                    // Month
                    if (month >= 0 && month < 12) {
                        stats.byMonth[monthNames[month]]++;
                    }

                    // Day of week
                    const date = new Date(year, month, day);
                    const dayOfWeek = date.getDay();
                    if (dayOfWeek >= 0 && dayOfWeek < 7) {
                        stats.byDayOfWeek[dayNames[dayOfWeek]]++;
                    }
                }

                // Parse time (hour)
                const timeParts = timePart.split(':');
                if (timeParts.length >= 1) {
                    const hour = parseInt(timeParts[0]);
                    if (hour >= 0 && hour < 24) {
                        stats.byHour[hour]++;
                    }
                }
            }
        }
    });

    return stats;
}

/**
 * Update crash statistics display (optimized)
 * Calculates totals from filtered data and updates the statistics dashboard
 */
export function updateStatistics() {
    const stats = perfMonitor.measure('Compute statistics', () => {
        return computeAllAnalytics(dataState.filteredData);
    });

    // Cache DOM elements for faster access
    const crashesEl = domCache.get('totalCrashes');
    const fatalitiesEl = domCache.get('totalFatalities');
    const seriousEl = domCache.get('totalSerious');
    const minorEl = domCache.get('totalMinor');

    // Update DOM elements
    if (crashesEl) crashesEl.textContent = stats.totalCrashes.toLocaleString();
    if (fatalitiesEl) fatalitiesEl.textContent = stats.totalFatalities.toLocaleString();
    if (seriousEl) seriousEl.textContent = stats.totalSerious.toLocaleString();
    if (minorEl) minorEl.textContent = stats.totalMinor.toLocaleString();

    // Store in global state for charts to use
    dataState.analyticsCache = stats;

    return {
        totalCrashes: stats.totalCrashes,
        totalFatalities: stats.totalFatalities,
        totalSerious: stats.totalSerious,
        totalMinor: stats.totalMinor
    };
}

/**
 * Get crash counts by year (optimized - uses cache if available)
 * @param {Array} data - Crash data array
 * @returns {Object} Year-to-count mapping
 */
export function getCrashCountsByYear(data = dataState.filteredData) {
    // Use cached analytics if available and data matches
    if (dataState.analyticsCache && data === dataState.filteredData) {
        return dataState.analyticsCache.byYear;
    }

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
 * Get crash counts by severity (optimized - uses cache if available)
 * @param {Array} data - Crash data array
 * @returns {Object} Severity-to-count mapping
 */
export function getCrashCountsBySeverity(data = dataState.filteredData) {
    if (dataState.analyticsCache && data === dataState.filteredData) {
        return dataState.analyticsCache.bySeverity;
    }

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
 * Get crash counts by crash type (optimized - uses cache if available)
 * @param {Array} data - Crash data array
 * @returns {Object} CrashType-to-count mapping
 */
export function getCrashCountsByCrashType(data = dataState.filteredData) {
    if (dataState.analyticsCache && data === dataState.filteredData) {
        return dataState.analyticsCache.byType;
    }

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
