/**
 * PDF Generator Module
 * Handles PDF export functionality with customizable charts, statistics, and data tables
 */

import { mapState, filterState } from './state.js';
import { showNotification } from './ui.js';
import { getFilterValues } from './filters.js';
import { YEAR_RANGE } from './config.js';

// ========================================
// PDF Configuration Constants
// ========================================
const PDF_CONFIG = {
    // Page layout
    MARGIN: 15,
    PAGE_FORMAT: 'a4',
    UNIT: 'mm',

    // Chart rendering quality
    CHART_SCALE_FACTOR: 3,  // Default scale factor
    CHART_SCALE_FACTORS: {
        'standard': 2,
        'high': 3,
        'ultra': 4
    },
    CHART_RENDER_TARGET_WIDTH: 1800,  // Optimal width for Chart.js high-DPI rendering
    CHART_RENDER_TARGET_HEIGHT: 900,  // Optimal height for Chart.js high-DPI rendering
    CHART_FONT_SCALE: 1.5,  // Font scale factor for PDF readability
    CHART_RENDER_DELAY_CLOSED: 300,
    CHART_RENDER_DELAY_OPEN: 200,
    CHART_MAX_RENDER_WAIT: 5000,  // Max time to wait for charts
    CHART_RENDER_TIMEOUT: 3000,  // Timeout for individual chart rendering (ms)
    CHART_TITLE_HEIGHT: 8,
    CHART_BOTTOM_SPACING: 10,
    CHART_MAX_HEIGHT_SINGLE: 200,  // Near full-page height for single charts
    CHART_MAX_HEIGHT_PAIRED: 140,  // Larger paired charts

    // Map rendering
    MAP_TILE_LOAD_TIMEOUT: 8000,  // Maximum wait time for map tiles to load (ms)
    MAP_TILE_MIN_LOADED: 6,  // Minimum tiles to consider map ready
    MAP_TILE_STABLE_DELAY: 1000,  // Delay after last tile load to ensure stability (ms)
    MAP_CAPTURE_SETTLE_TIME: 500,  // Wait time for map layers to settle before capture (ms)
    MAP_CHOROPLETH_REDRAW_DELAY: 200,  // Delay between choropleth layer redraws (ms)
    MAP_CHOROPLETH_REDRAW_CYCLES: 3,  // Number of invalidation cycles for choropleth
    MAP_FINAL_SETTLE_DELAY: 800,  // Final wait before capturing choropleth (ms)

    // Image quality settings
    IMAGE_QUALITY: {
        'standard': 0.85,
        'high': 0.92,
        'maximum': 1.0
    },
    // Chart types that work better with JPEG (photo-like, gradients)
    JPEG_SUITABLE_CHARTS: ['severityTrendChart', 'crashesOverTimeChart'],

    // Colors (RGB)
    COLOR_PRIMARY: [74, 144, 226],
    COLOR_TEXT_DARK: [0, 0, 0],
    COLOR_TEXT_MEDIUM: [60, 60, 60],
    COLOR_TEXT_LIGHT: [100, 100, 100],
    COLOR_TABLE_ALT_ROW: [245, 245, 245],
    COLOR_WHITE: [255, 255, 255],

    // Typography
    FONT_SIZE_TITLE: 24,
    FONT_SIZE_HEADING: 16,
    FONT_SIZE_SUBHEADING: 14,
    FONT_SIZE_BODY: 11,
    FONT_SIZE_SMALL: 12,
    FONT_SIZE_TABLE: 8,
    FONT_FAMILY_PRIMARY: 'helvetica',
    FONT_FAMILY_HEADING: 'helvetica',

    // Spacing
    SPACING_SECTION: 15,
    SPACING_SUBSECTION: 10,
    SPACING_LINE: 7,

    // Metadata
    PDF_TITLE: 'SA Road Crash Data Report',
    PDF_SUBJECT: 'South Australia Crash Data Analysis',
    PDF_CREATOR: 'SA Crash Map',
    PDF_AUTHOR: 'SA Crash Map',
    PDF_KEYWORDS: 'crash data, road safety, south australia, analytics, statistics',

    // Page numbering
    PAGE_NUMBER_FONT_SIZE: 9,
    PAGE_NUMBER_MARGIN_BOTTOM: 10
};

// ========================================
// Helper Functions
// ========================================

/**
 * Check if any filters are currently active
 * @param {Object} filters - Filter values object
 * @returns {boolean} - True if any filters are active
 */
function hasActiveFilters(filters) {
    // Helper to check if an array has active selections (not 'all')
    const isFiltered = (arr) => Array.isArray(arr) && !arr.includes('all');

    return (
        // Year range changed from default
        filters.yearFrom !== YEAR_RANGE.MIN ||
        filters.yearTo !== YEAR_RANGE.MAX ||
        // Checkbox dropdowns
        isFiltered(filters.selectedSeverities) ||
        isFiltered(filters.selectedCrashTypes) ||
        isFiltered(filters.selectedAreas) ||
        isFiltered(filters.selectedSuburbs) ||
        // Single-select dropdowns
        (filters.weather && filters.weather !== 'all') ||
        (filters.dayNight && filters.dayNight !== 'all') ||
        (filters.duiInvolved && filters.duiInvolved !== 'all') ||
        (filters.drugsInvolved && filters.drugsInvolved !== 'all') ||
        (filters.heavyVehicle && filters.heavyVehicle !== 'all') ||
        (filters.towing && filters.towing !== 'all') ||
        (filters.rollover && filters.rollover !== 'all') ||
        (filters.fire && filters.fire !== 'all') ||
        // Multi-select dropdowns
        isFiltered(filters.selectedRoadSurfaces) ||
        isFiltered(filters.selectedMoistureConds) ||
        isFiltered(filters.selectedSpeedZones) ||
        isFiltered(filters.selectedMonths) ||
        isFiltered(filters.selectedRoadUsers) ||
        isFiltered(filters.selectedAgeGroups) ||
        isFiltered(filters.selectedSexes) ||
        isFiltered(filters.selectedInjuries) ||
        isFiltered(filters.selectedSeatBelts) ||
        isFiltered(filters.selectedHelmets) ||
        isFiltered(filters.selectedVehicles) ||
        isFiltered(filters.selectedVehicleYears) ||
        isFiltered(filters.selectedOccupants) ||
        isFiltered(filters.selectedLicenseTypes) ||
        isFiltered(filters.selectedRegStates) ||
        isFiltered(filters.selectedDirections) ||
        isFiltered(filters.selectedMovements) ||
        // Date/time filters
        (filters.dateFrom && filters.dateFrom !== '') ||
        (filters.dateTo && filters.dateTo !== '') ||
        (filters.timeFrom && filters.timeFrom !== '') ||
        (filters.timeTo && filters.timeTo !== '')
    );
}

/**
 * Collect all active filter descriptions
 * @param {Object} filters - Filter values object
 * @returns {string[]} - Array of active filter descriptions
 */
function collectActiveFilters(filters) {
    const activeFilters = [];
    const isFiltered = (arr) => Array.isArray(arr) && !arr.includes('all');

    if (filters.yearFrom !== YEAR_RANGE.MIN || filters.yearTo !== YEAR_RANGE.MAX) {
        activeFilters.push('Year Range: ' + filters.yearFrom + ' - ' + filters.yearTo);
    }
    if (filters.dateFrom || filters.dateTo) {
        const from = filters.dateFrom || 'Start';
        const to = filters.dateTo || 'End';
        activeFilters.push('Date Range: ' + from + ' to ' + to);
    }
    if (filters.timeFrom || filters.timeTo) {
        activeFilters.push('Time Range: ' + (filters.timeFrom || '00:00') + ' - ' + (filters.timeTo || '23:59'));
    }
    if (isFiltered(filters.selectedSeverities)) {
        activeFilters.push('Severity: ' + filters.selectedSeverities.join(', '));
    }
    if (isFiltered(filters.selectedCrashTypes)) {
        const types = filters.selectedCrashTypes.length <= 3
            ? filters.selectedCrashTypes.join(', ')
            : filters.selectedCrashTypes.slice(0, 3).join(', ') + ' +' + (filters.selectedCrashTypes.length - 3) + ' more';
        activeFilters.push('Crash Types: ' + types);
    }
    if (filters.weather !== 'all') {
        activeFilters.push('Weather: ' + filters.weather);
    }
    if (filters.dayNight !== 'all') {
        activeFilters.push('Day/Night: ' + filters.dayNight);
    }
    if (filters.duiInvolved !== 'all') {
        activeFilters.push('DUI Involved: ' + filters.duiInvolved);
    }
    if (filters.drugsInvolved !== 'all') {
        activeFilters.push('Drugs Involved: ' + filters.drugsInvolved);
    }
    if (isFiltered(filters.selectedAreas)) {
        const areas = filters.selectedAreas.length <= 3
            ? filters.selectedAreas.join(', ')
            : filters.selectedAreas.slice(0, 3).join(', ') + ' +' + (filters.selectedAreas.length - 3) + ' more';
        activeFilters.push('LGA: ' + areas);
    }
    if (isFiltered(filters.selectedSuburbs)) {
        const suburbs = filters.selectedSuburbs.length <= 3
            ? filters.selectedSuburbs.join(', ')
            : filters.selectedSuburbs.slice(0, 3).join(', ') + ' +' + (filters.selectedSuburbs.length - 3) + ' more';
        activeFilters.push('Suburbs: ' + suburbs);
    }
    if (isFiltered(filters.selectedRoadUsers)) {
        activeFilters.push('Road Users: ' + filters.selectedRoadUsers.join(', '));
    }
    if (isFiltered(filters.selectedAgeGroups)) {
        activeFilters.push('Age Groups: ' + filters.selectedAgeGroups.join(', '));
    }
    if (isFiltered(filters.selectedSexes)) {
        activeFilters.push('Sex: ' + filters.selectedSexes.join(', '));
    }
    if (isFiltered(filters.selectedInjuries)) {
        activeFilters.push('Injury Extent: ' + filters.selectedInjuries.join(', '));
    }
    if (filters.heavyVehicle !== 'all') {
        activeFilters.push('Heavy Vehicle: ' + (filters.heavyVehicle === 'yes' ? 'Yes' : 'No'));
    }
    if (isFiltered(filters.selectedVehicles)) {
        const vehicles = filters.selectedVehicles.length <= 3
            ? filters.selectedVehicles.join(', ')
            : filters.selectedVehicles.slice(0, 3).join(', ') + ' +' + (filters.selectedVehicles.length - 3) + ' more';
        activeFilters.push('Vehicle Types: ' + vehicles);
    }
    if (filters.selectedSpeedZones && isFiltered(filters.selectedSpeedZones)) {
        activeFilters.push('Speed Zones: ' + filters.selectedSpeedZones.join(', ') + ' km/h');
    }
    if (isFiltered(filters.selectedRoadSurfaces)) {
        activeFilters.push('Road Surface: ' + filters.selectedRoadSurfaces.join(', '));
    }
    if (isFiltered(filters.selectedMoistureConds)) {
        activeFilters.push('Moisture: ' + filters.selectedMoistureConds.join(', '));
    }
    if (filters.towing !== 'all') {
        activeFilters.push('Towing: ' + filters.towing);
    }
    if (filters.rollover !== 'all') {
        activeFilters.push('Rollover: ' + filters.rollover);
    }
    if (filters.fire !== 'all') {
        activeFilters.push('Fire: ' + filters.fire);
    }

    return activeFilters;
}

// ========================================
// PDF Modal Functions
// ========================================

/**
 * Process filename template variables
 * @param {string} template - Filename template with variables
 * @returns {string} - Processed filename
 */
function processFilenameTemplate(template) {
    const crashData = window._lastCrashData || [];
    const filters = getFilterValues();

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const timeStr = now.toTimeString().slice(0, 5).replace(':', ''); // HHMM

    const yearFrom = filters.yearFrom || YEAR_RANGE.MIN;
    const yearTo = filters.yearTo || YEAR_RANGE.MAX;
    const yearRange = yearFrom === yearTo ? `${yearFrom}` : `${yearFrom}-${yearTo}`;

    return template
        .replace(/{date}/g, dateStr)
        .replace(/{time}/g, timeStr)
        .replace(/{year_range}/g, yearRange)
        .replace(/{count}/g, crashData.length.toString())
        // Clean up any invalid filename characters
        .replace(/[<>:"/\\|?*]/g, '_');
}

/**
 * Update filename preview in the PDF export modal
 * @returns {void}
 */
function updateFilenamePreview() {
    const filenameInput = document.getElementById('pdfFilename');
    const previewSpan = document.getElementById('pdfFilenamePreview');

    if (filenameInput && previewSpan) {
        const template = filenameInput.value || 'SA_Crash_Report';
        const processed = processFilenameTemplate(template);
        previewSpan.textContent = processed + '.pdf';
    }
}

/**
 * Open the PDF export modal dialog with current data
 * @returns {void}
 */
export function openPdfExportModal() {
    // Update crash count
    const filteredCount = window._lastCrashData ? window._lastCrashData.length : 0;
    document.getElementById('pdfModalCrashCount').textContent = filteredCount.toLocaleString();

    // Show/hide warning for large datasets
    updateTableWarning();

    // Update filename preview
    updateFilenamePreview();

    // Add listener for filename input changes
    const filenameInput = document.getElementById('pdfFilename');
    if (filenameInput) {
        filenameInput.removeEventListener('input', updateFilenamePreview);
        filenameInput.addEventListener('input', updateFilenamePreview);
    }

    // Check if any filters are active and update the Active Filters checkbox
    const filtersCheckbox = document.getElementById('pdfIncludeFilters');
    if (filtersCheckbox) {
        const filters = getFilterValues();
        const anyFiltersActive = hasActiveFilters(filters);

        if (!anyFiltersActive) {
            // No filters active - disable and uncheck
            filtersCheckbox.checked = false;
            filtersCheckbox.disabled = true;
            filtersCheckbox.parentElement.style.opacity = '0.5';
            filtersCheckbox.parentElement.title = 'No filters are currently active';
        } else {
            // Filters are active - enable and check by default
            filtersCheckbox.disabled = false;
            filtersCheckbox.checked = true;
            filtersCheckbox.parentElement.style.opacity = '1';
            filtersCheckbox.parentElement.title = '';
        }
    }

    // Initialize drag-and-drop for chart reordering
    initChartDragAndDrop();

    // Show modal
    document.getElementById('pdfExportModal').style.display = 'flex';
}

/**
 * Close the PDF export modal dialog
 * @returns {void}
 */
export function closePdfExportModal() {
    document.getElementById('pdfExportModal').style.display = 'none';
}

/**
 * Apply a preset configuration to the PDF export options
 * @param {Event} event - The click event from the preset button
 * @param {string} type - Preset type ('quick' | 'full' | 'custom')
 * @returns {void}
 */
export function applyPdfPreset(event, type) {
    // Update active button
    document.querySelectorAll('.pdf-preset-btn').forEach(function(btn) {
        btn.classList.remove('active');
    });
    if (event && event.target) {
        event.target.classList.add('active');
    }

    if (type === 'quick') {
        // Quick Summary: Stats + top 3 charts
        document.getElementById('pdfIncludeCover').checked = true;
        document.getElementById('pdfIncludeStats').checked = true;
        document.getElementById('pdfIncludeCharts').checked = true;
        document.getElementById('pdfIncludeTable').checked = false;

        // Only check filters if enabled
        const filtersCheckbox = document.getElementById('pdfIncludeFilters');
        if (filtersCheckbox && !filtersCheckbox.disabled) {
            filtersCheckbox.checked = true;
        }

        // Select only first 3 charts
        selectNoCharts();
        document.getElementById('pdfChart1').checked = true;  // Over Time
        document.getElementById('pdfChart4').checked = true;  // Severity
        document.getElementById('pdfChart5').checked = true;  // Crash Types

        toggleChartOptions();
        toggleTableOptions();
    } else if (type === 'full') {
        // Full Analytics: Everything except table
        document.getElementById('pdfIncludeCover').checked = true;
        document.getElementById('pdfIncludeStats').checked = true;
        document.getElementById('pdfIncludeCharts').checked = true;
        document.getElementById('pdfIncludeTable').checked = false;

        // Only check filters if enabled
        const filtersCheckbox = document.getElementById('pdfIncludeFilters');
        if (filtersCheckbox && !filtersCheckbox.disabled) {
            filtersCheckbox.checked = true;
        }

        selectAllCharts();
        toggleChartOptions();
        toggleTableOptions();
    }
    // 'custom' doesn't change anything - user customizes
}

/**
 * Toggle visibility of chart selection options based on checkbox state
 * @returns {void}
 */
export function toggleChartOptions() {
    const checked = document.getElementById('pdfIncludeCharts').checked;
    const chartOptions = document.getElementById('pdfChartOptions');
    if (chartOptions) {
        chartOptions.style.display = checked ? 'block' : 'none';
    }
}

/**
 * Toggle visibility of table options based on checkbox state
 * @returns {void}
 */
export function toggleTableOptions() {
    const checked = document.getElementById('pdfIncludeTable').checked;
    const tableOptions = document.getElementById('pdfTableOptions');
    const warning = document.getElementById('pdfTableWarning');

    if (tableOptions) {
        tableOptions.style.display = checked ? 'block' : 'none';
    }

    if (checked) {
        updateTableWarning();
    }
}

function updateTableWarning() {
    const filteredCount = window._lastCrashData ? window._lastCrashData.length : 0;
    const warning = document.getElementById('pdfTableWarning');
    if (warning && filteredCount > 200) {
        warning.style.display = 'inline';
    } else if (warning) {
        warning.style.display = 'none';
    }
}

export function selectAllCharts() {
    document.querySelectorAll('.pdf-chart-cb').forEach(function(cb) {
        cb.checked = true;
    });
}

export function selectNoCharts() {
    document.querySelectorAll('.pdf-chart-cb').forEach(function(cb) {
        cb.checked = false;
    });
}

/**
 * Toggle visibility of notes options based on checkbox state
 * @returns {void}
 */
export function toggleNotesOptions() {
    const checked = document.getElementById('pdfIncludeNotes').checked;
    const notesOptions = document.getElementById('pdfNotesOptions');
    if (notesOptions) {
        notesOptions.style.display = checked ? 'block' : 'none';
    }
}

/**
 * Add a new note section to the PDF notes container
 * @returns {void}
 */
export function addPdfNote() {
    const container = document.getElementById('pdfNotesContainer');
    if (!container) return;

    const noteId = 'pdfNote_' + Date.now();
    const noteHTML = `
        <div class="pdf-note-item" id="${noteId}">
            <div class="pdf-note-header">
                <input type="text" class="pdf-note-title-input" placeholder="Section Title (e.g., Executive Summary, Recommendations)" value="Notes">
                <select class="pdf-note-position-select">
                    <option value="after-cover">After Cover</option>
                    <option value="after-stats">After Statistics</option>
                    <option value="after-charts">After Charts</option>
                    <option value="before-table">Before Table</option>
                    <option value="end">At End</option>
                </select>
                <button type="button" class="pdf-note-remove-btn" onclick="removePdfNote('${noteId}')">Remove</button>
            </div>
            <textarea class="pdf-note-textarea" placeholder="Enter your notes, comments, or analysis here..."></textarea>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', noteHTML);
}

/**
 * Remove a note section from the PDF notes container
 * @param {string} noteId - ID of the note element to remove
 * @returns {void}
 */
export function removePdfNote(noteId) {
    const noteElement = document.getElementById(noteId);
    if (noteElement) {
        noteElement.remove();
    }
}

/**
 * Select all table columns
 * @returns {void}
 */
export function selectAllTableColumns() {
    document.querySelectorAll('.pdf-table-col-cb').forEach(function(cb) {
        cb.checked = true;
    });
}

/**
 * Select default table columns
 * @returns {void}
 */
export function selectDefaultTableColumns() {
    const defaultColumns = ['Date', 'CSEF Severity', 'Crash Type', 'LGA'];
    document.querySelectorAll('.pdf-table-col-cb').forEach(function(cb) {
        cb.checked = defaultColumns.includes(cb.value);
    });
}

/**
 * Initialize drag-and-drop functionality for chart reordering
 * @returns {void}
 */
export function initChartDragAndDrop() {
    const container = document.getElementById('pdfChartCheckboxes');
    if (!container) return;

    let draggedElement = null;

    // Add event listeners to all draggable items
    const items = container.querySelectorAll('.pdf-draggable-item');
    items.forEach(item => {
        item.addEventListener('dragstart', function(e) {
            draggedElement = this;
            this.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', this.innerHTML);
        });

        item.addEventListener('dragend', function(e) {
            this.classList.remove('dragging');
            // Remove drag-over class from all items
            items.forEach(i => i.classList.remove('drag-over'));
        });

        item.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            if (draggedElement !== this) {
                // Remove drag-over from all items
                items.forEach(i => i.classList.remove('drag-over'));
                this.classList.add('drag-over');
            }
        });

        item.addEventListener('dragleave', function(e) {
            this.classList.remove('drag-over');
        });

        item.addEventListener('drop', function(e) {
            e.preventDefault();
            e.stopPropagation();

            if (draggedElement !== this) {
                // Get all items and find positions
                const allItems = Array.from(container.querySelectorAll('.pdf-draggable-item'));
                const draggedIndex = allItems.indexOf(draggedElement);
                const targetIndex = allItems.indexOf(this);

                // Reorder in DOM
                if (draggedIndex < targetIndex) {
                    this.parentNode.insertBefore(draggedElement, this.nextSibling);
                } else {
                    this.parentNode.insertBefore(draggedElement, this);
                }
            }

            this.classList.remove('drag-over');
        });
    });
}

/**
 * Get ordered chart IDs based on their current DOM order
 * @returns {Array} Array of chart IDs in display order
 */
function getOrderedChartIds() {
    const container = document.getElementById('pdfChartCheckboxes');
    if (!container) return [];

    const items = container.querySelectorAll('.pdf-draggable-item');
    return Array.from(items).map(item => item.dataset.chartId);
}

export function showPdfPreview() {
    const crashData = window._lastCrashData || [];

    // Get current configuration from UI
    const config = {
        includeCover: document.getElementById('pdfIncludeCover').checked,
        includeStats: document.getElementById('pdfIncludeStats').checked,
        includeCharts: document.getElementById('pdfIncludeCharts').checked,
        includeTable: document.getElementById('pdfIncludeTable').checked,
        includeFilters: document.getElementById('pdfIncludeFilters').checked,
        includeMap: document.getElementById('pdfIncludeMap')?.checked || false,
        charts: {
            chart1: document.getElementById('pdfChart1').checked,
            chart2: document.getElementById('pdfChart2').checked,
            chart3: document.getElementById('pdfChart3').checked,
            chart4: document.getElementById('pdfChart4').checked,
            chart5: document.getElementById('pdfChart5').checked,
            chart6: document.getElementById('pdfChart6').checked,
            chart7: document.getElementById('pdfChart7').checked,
            chart8: document.getElementById('pdfChart8').checked
        },
        tableRows: document.querySelector('input[name="pdfTableRows"]:checked')?.value || '50',
        orientation: document.querySelector('input[name="pdfOrientation"]:checked')?.value || 'landscape',
        filename: document.getElementById('pdfFilename').value || 'SA_Crash_Report_{date}'
    };

    let previewHTML = '<ul>';
    let pageEstimate = 1; // Start with 1 for cover/padding

    // Cover page
    previewHTML += config.includeCover
        ? '<li><strong>Cover Page</strong> - Report title and summary</li>'
        : '<li class="disabled"><strong>Cover Page</strong> - Not included</li>';

    // Statistics
    if (config.includeStats) {
        previewHTML += '<li><strong>Statistics Summary</strong> - Crash totals, casualties, severity breakdown</li>';
        pageEstimate += 1;
    } else {
        previewHTML += '<li class="disabled"><strong>Statistics Summary</strong> - Not included</li>';
    }

    // Active filters
    if (config.includeFilters) {
        previewHTML += '<li><strong>Active Filters</strong> - Currently applied filters</li>';
        pageEstimate += 0.5;
    } else {
        previewHTML += '<li class="disabled"><strong>Active Filters</strong> - Not included</li>';
    }

    // Map
    if (config.includeMap) {
        previewHTML += '<li><strong>Crash Map</strong> - Map view with legend</li>';
        pageEstimate += 1;
    } else {
        previewHTML += '<li class="disabled"><strong>Crash Map</strong> - Not included</li>';
    }

    // Charts
    if (config.includeCharts) {
        const chartCount = Object.values(config.charts).filter(v => v).length;
        if (chartCount > 0) {
            previewHTML += `<li><strong>Charts & Visualizations</strong> - ${chartCount} chart${chartCount > 1 ? 's' : ''} selected`;

            const chartNames = [];
            if (config.charts.chart1) chartNames.push('Crashes Over Time');
            if (config.charts.chart2) chartNames.push('By Day of Week');
            if (config.charts.chart3) chartNames.push('By Hour');
            if (config.charts.chart4) chartNames.push('Severity Distribution');
            if (config.charts.chart5) chartNames.push('Crash Types');
            if (config.charts.chart6) chartNames.push('Top LGAs');
            if (config.charts.chart7) chartNames.push('Weather');
            if (config.charts.chart8) chartNames.push('Severity Trend');

            previewHTML += '<ul style="margin-top: 5px; font-size: 13px; color: var(--text-secondary);">';
            chartNames.forEach(name => {
                previewHTML += `<li style="padding: 3px 0;">${name}</li>`;
            });
            previewHTML += '</ul></li>';

            // Estimate 2 charts per page
            pageEstimate += Math.ceil(chartCount / 2);
        } else {
            previewHTML += '<li class="disabled"><strong>Charts & Visualizations</strong> - No charts selected</li>';
        }
    } else {
        previewHTML += '<li class="disabled"><strong>Charts & Visualizations</strong> - Not included</li>';
    }

    // Data table
    if (config.includeTable) {
        const rows = config.tableRows === 'all' ? crashData.length : parseInt(config.tableRows);
        previewHTML += `<li><strong>Data Table</strong> - ${rows.toLocaleString()} row${rows > 1 ? 's' : ''} of crash data</li>`;
        // Estimate ~50 rows per page
        pageEstimate += Math.ceil(rows / 50);
    } else {
        previewHTML += '<li class="disabled"><strong>Data Table</strong> - Not included</li>';
    }

    previewHTML += '</ul>';

    // Additional info
    previewHTML += `<div style="margin-top: 20px; padding: 12px; background: var(--bg-secondary); border-radius: 4px;">`;
    previewHTML += `<strong>Report Details:</strong><br>`;
    previewHTML += `• Orientation: ${config.orientation.charAt(0).toUpperCase() + config.orientation.slice(1)}<br>`;
    previewHTML += `• Data: ${crashData.length.toLocaleString()} crashes<br>`;

    const processedFilename = processFilenameTemplate(config.filename);
    previewHTML += `• Filename: ${processedFilename}.pdf`;
    previewHTML += `</div>`;

    // Update preview content
    document.getElementById('pdfPreviewContent').innerHTML = previewHTML;
    document.getElementById('pdfPreviewPages').textContent = `~${Math.max(1, Math.round(pageEstimate))} page${pageEstimate > 1 ? 's' : ''}`;

    // Show preview modal
    document.getElementById('pdfPreviewModal').style.display = 'flex';
}

export function closePdfPreview() {
    document.getElementById('pdfPreviewModal').style.display = 'none';
}

// ========================================
// Map Positioning Functions
// ========================================

// Store which layers are active for PDF export
let pdfExportLayers = {
    density: true,
    markers: false,
    choropleth: false,
    choroplethMode: 'lga' // 'lga' or 'suburb'
};

export async function enterMapPositioningMode() {
    // Hide PDF export modal and save scroll position
    const pdfModal = document.getElementById('pdfExportModal');
    if (pdfModal) {
        // Save current scroll position to restore later
        pdfModal.dataset.savedScrollTop = pdfModal.scrollTop.toString();
        pdfModal.style.display = 'none';
    }

    // Show positioning overlay
    const overlay = document.getElementById('mapPositioningOverlay');
    if (overlay) {
        overlay.style.display = 'block';
    }

    // Add highlight and positioning class to map
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
        mapContainer.classList.add('map-highlight', 'map-positioning-active');
    }

    // Collapse side panels for better map view
    const filterPanel = document.getElementById('filterPanel');
    const analyticsPanel = document.getElementById('analyticsPanel');
    if (filterPanel && !filterPanel.classList.contains('collapsed')) {
        filterPanel.classList.add('collapsed');
        filterPanel.dataset.wasOpenBeforePositioning = 'true';
    }
    if (analyticsPanel && !analyticsPanel.classList.contains('collapsed')) {
        analyticsPanel.classList.add('collapsed');
        analyticsPanel.dataset.wasOpenBeforePositioning = 'true';
    }

    // Clear all existing layers first
    if (mapState.markersLayer) {
        mapState.markersLayer.clearLayers();
        if (mapState.map.hasLayer(mapState.markersLayer)) {
            mapState.map.removeLayer(mapState.markersLayer);
        }
    }
    if (mapState.choroplethLayer && mapState.map.hasLayer(mapState.choroplethLayer)) {
        mapState.map.removeLayer(mapState.choroplethLayer);
        mapState.choroplethLayer = null;
    }
    if (mapState.densityLayer && mapState.map.hasLayer(mapState.densityLayer)) {
        mapState.map.removeLayer(mapState.densityLayer);
        mapState.densityLayer = null;
        if (mapState.densityZoomListener) {
            mapState.map.off('zoomend', mapState.densityZoomListener);
            mapState.densityZoomListener = null;
        }
    }

    // Set default to density layer only
    pdfExportLayers = {
        density: true,
        markers: false,
        choropleth: false,
        choroplethMode: 'lga'
    };

    // Update checkboxes to match default state
    const densityCheckbox = document.getElementById('positionDensityToggle');
    const markersCheckbox = document.getElementById('positionMarkersToggle');
    const choroplethCheckbox = document.getElementById('positionChoroplethToggle');
    const modeSelect = document.getElementById('choroplethModeSelect');

    if (densityCheckbox) densityCheckbox.checked = true;
    if (markersCheckbox) markersCheckbox.checked = false;
    if (choroplethCheckbox) choroplethCheckbox.checked = false;
    if (modeSelect) {
        modeSelect.value = 'lga';
        modeSelect.style.display = 'none';
    }

    // Enable density layer
    await togglePositioningLayer('density', true);
}

export async function togglePositioningLayer(layerType, enabled) {
    // Update the export layers state
    pdfExportLayers[layerType] = enabled;

    // Import map renderer functions
    const mapRenderer = await import('./map-renderer.js');

    if (layerType === 'density') {
        if (enabled) {
            mapRenderer.addDensityMap();
        } else {
            // Remove density layer if it exists
            if (mapState.densityLayer && mapState.map.hasLayer(mapState.densityLayer)) {
                mapState.map.removeLayer(mapState.densityLayer);
            }
            mapState.densityLayer = null;
            if (mapState.densityZoomListener) {
                mapState.map.off('zoomend', mapState.densityZoomListener);
                mapState.densityZoomListener = null;
            }
        }
    } else if (layerType === 'markers') {
        if (enabled) {
            // addMarkers takes a callback parameter, but we can pass null
            mapRenderer.addMarkers(null);
        } else {
            // Remove markers layer if it exists
            if (mapState.markersLayer) {
                mapState.markersLayer.clearLayers();
                if (mapState.map.hasLayer(mapState.markersLayer)) {
                    mapState.map.removeLayer(mapState.markersLayer);
                }
            }
        }
    } else if (layerType === 'choropleth') {
        const modeSelect = document.getElementById('choroplethModeSelect');

        if (enabled) {
            // Show mode selector
            if (modeSelect) {
                modeSelect.style.display = 'block';
            }
            // Set the mode in filterState before adding choropleth
            filterState.choroplethMode = pdfExportLayers.choroplethMode;
            mapRenderer.addChoropleth();
        } else {
            // Hide mode selector
            if (modeSelect) {
                modeSelect.style.display = 'none';
            }
            // Remove choropleth layer if it exists
            if (mapState.choroplethLayer && mapState.map.hasLayer(mapState.choroplethLayer)) {
                mapState.map.removeLayer(mapState.choroplethLayer);
            }
            mapState.choroplethLayer = null;
        }
    }

    // Update activeLayers state
    if (!mapState.activeLayers) mapState.activeLayers = {};
    mapState.activeLayers[layerType] = enabled;
}

export async function changeChoroplethMode(mode) {
    // Update the stored mode
    pdfExportLayers.choroplethMode = mode;

    // If choropleth is currently enabled, re-render it with the new mode
    const choroplethCheckbox = document.getElementById('positionChoroplethToggle');
    if (choroplethCheckbox && choroplethCheckbox.checked) {
        // Remove current choropleth layer
        if (mapState.choroplethLayer && mapState.map.hasLayer(mapState.choroplethLayer)) {
            mapState.map.removeLayer(mapState.choroplethLayer);
        }
        mapState.choroplethLayer = null;

        // Update filterState and re-add with new mode
        filterState.choroplethMode = mode;
        const mapRenderer = await import('./map-renderer.js');
        mapRenderer.addChoropleth();
    }
}

export function exitMapPositioningMode() {
    // Hide positioning overlay
    const overlay = document.getElementById('mapPositioningOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }

    // Remove highlight and positioning class from map
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
        mapContainer.classList.remove('map-highlight', 'map-positioning-active');
    }

    // Restore panels if they were open before
    const filterPanel = document.getElementById('filterPanel');
    const analyticsPanel = document.getElementById('analyticsPanel');
    if (filterPanel && filterPanel.dataset.wasOpenBeforePositioning === 'true') {
        filterPanel.classList.remove('collapsed');
        delete filterPanel.dataset.wasOpenBeforePositioning;
    }
    if (analyticsPanel && analyticsPanel.dataset.wasOpenBeforePositioning === 'true') {
        analyticsPanel.classList.remove('collapsed');
        delete analyticsPanel.dataset.wasOpenBeforePositioning;
    }

    // Show PDF export modal again
    const pdfModal = document.getElementById('pdfExportModal');
    if (pdfModal) {
        pdfModal.style.display = 'flex';

        // Restore scroll position if it was saved
        if (pdfModal.dataset.savedScrollTop) {
            pdfModal.scrollTop = parseInt(pdfModal.dataset.savedScrollTop);
            delete pdfModal.dataset.savedScrollTop;
        }
    }

    // Show success notification
    if (typeof showNotification === 'function') {
        showNotification('Map position saved for PDF export', 'success');
    }
}

// ========================================
// PDFGenerator Class - Modular PDF Generation
// ========================================
class PDFGenerator {
    constructor(doc, crashData, options) {
        this.doc = doc;
        this.crashData = crashData;
        this.options = options;
        this.pageWidth = doc.internal.pageSize.getWidth();
        this.pageHeight = doc.internal.pageSize.getHeight();
        this.yPos = PDF_CONFIG.MARGIN;
        this.currentPage = 1;
        this.totalPages = 0; // Will be calculated
        this.progressCallback = null;
        this.errors = []; // Track non-fatal errors during generation
    }

    setProgressCallback(callback) {
        this.progressCallback = callback;
    }

    /**
     * Log a non-fatal error and optionally add a placeholder in the PDF
     * @param {string} section - Section name where error occurred
     * @param {Error} error - The error object
     * @param {boolean} addPlaceholder - Whether to add an error message in the PDF
     */
    logError(section, error, addPlaceholder = true) {
        this.errors.push({ section, error: error.message, timestamp: new Date() });
        console.error(`PDF Generation Error in ${section}:`, error);

        if (addPlaceholder) {
            this.checkPageSpace(20);
            this.doc.setFontSize(10);
            this.doc.setTextColor(200, 50, 50);
            this.doc.text(`Note: ${section} could not be generated due to an error`, PDF_CONFIG.MARGIN, this.yPos);
            this.yPos += 7;
            this.doc.setFontSize(9);
            this.doc.setTextColor(150, 150, 150);
            this.doc.text(`Error: ${error.message.substring(0, 80)}`, PDF_CONFIG.MARGIN, this.yPos);
            this.yPos += PDF_CONFIG.SPACING_SECTION;
        }
    }

    setFont(fontSize, style = 'normal', color = PDF_CONFIG.COLOR_TEXT_DARK) {
        // Enhanced font setting with better styling
        this.doc.setFont(PDF_CONFIG.FONT_FAMILY_PRIMARY, style);
        this.doc.setFontSize(fontSize);
        this.doc.setTextColor(...color);
    }

    async updateProgress(message, step, totalSteps) {
        if (this.progressCallback) {
            this.progressCallback(message, step, totalSteps);
            // Force UI update by yielding to browser
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }

    checkPageSpace(requiredHeight) {
        if (this.yPos + requiredHeight > this.pageHeight - PDF_CONFIG.MARGIN) {
            this.addPage();
            return false;
        }
        return true;
    }

    addPage() {
        this.doc.addPage();
        this.yPos = PDF_CONFIG.MARGIN;
        this.currentPage++;
    }

    addPageNumbers() {
        const totalPages = this.doc.internal.getNumberOfPages();

        for (let i = 1; i <= totalPages; i++) {
            this.doc.setPage(i);
            this.doc.setFontSize(PDF_CONFIG.PAGE_NUMBER_FONT_SIZE);
            this.doc.setTextColor(...PDF_CONFIG.COLOR_TEXT_LIGHT);

            const pageText = 'Page ' + i + ' of ' + totalPages;
            const textWidth = this.doc.getTextWidth(pageText);
            const xPos = this.pageWidth - PDF_CONFIG.MARGIN - textWidth;
            const yPos = this.pageHeight - PDF_CONFIG.PAGE_NUMBER_MARGIN_BOTTOM;

            this.doc.text(pageText, xPos, yPos);
        }
    }

    async addCoverPage() {
        if (!this.options.includeCover) return;

        try {
            await this.updateProgress('Creating cover page...', 1, 6);

            // Title with bold font
            this.setFont(PDF_CONFIG.FONT_SIZE_TITLE, 'bold', PDF_CONFIG.COLOR_PRIMARY);
            this.doc.text(PDF_CONFIG.PDF_TITLE, this.pageWidth / 2, this.yPos, { align: 'center' });

            this.yPos += 15;

            // Subtitle information
            this.setFont(PDF_CONFIG.FONT_SIZE_SMALL, 'normal', PDF_CONFIG.COLOR_TEXT_LIGHT);
            this.doc.text('Generated: ' + new Date().toLocaleString(), this.pageWidth / 2, this.yPos, { align: 'center' });

            this.yPos += 10;
            this.doc.text('Total Crashes: ' + this.crashData.length.toLocaleString(), this.pageWidth / 2, this.yPos, { align: 'center' });

            this.yPos += 20;
        } catch (error) {
            this.logError('Cover Page', error);
            // Cover page errors are non-fatal, continue with generation
        }
    }

    async addStatistics() {
        if (!this.options.includeStats) return;

        try {
            await this.updateProgress('Calculating statistics...', 2, 6);

            // Check if we have data
            if (!this.crashData || this.crashData.length === 0) {
                this.checkPageSpace(40);
                this.setFont(PDF_CONFIG.FONT_SIZE_HEADING, 'bold', PDF_CONFIG.COLOR_TEXT_DARK);
                this.doc.text('Statistics Summary', PDF_CONFIG.MARGIN, this.yPos);
                this.yPos += PDF_CONFIG.SPACING_SUBSECTION;
                this.setFont(PDF_CONFIG.FONT_SIZE_BODY, 'normal', PDF_CONFIG.COLOR_TEXT_MEDIUM);
                this.doc.text('No crash data available', PDF_CONFIG.MARGIN, this.yPos);
                this.yPos += PDF_CONFIG.SPACING_SECTION;
                return;
            }

            // Calculate casualties
            let totalFatalities = 0, totalSerious = 0, totalMinor = 0;
            this.crashData.forEach(crash => {
                totalFatalities += parseInt(crash['Total Fats'] || 0);
                totalSerious += parseInt(crash['Total SI'] || 0);
                totalMinor += parseInt(crash['Total MI'] || 0);
            });
            const totalCasualties = totalFatalities + totalSerious + totalMinor;

            // Calculate severity breakdown
            const severityCounts = { '1: PDO': 0, '2: MI': 0, '3: SI': 0, '4: Fatal': 0 };
            this.crashData.forEach(crash => {
                const severity = crash['CSEF Severity'];
                if (severityCounts[severity] !== undefined) {
                    severityCounts[severity]++;
                }
            });

            // Calculate year range and average
            const years = this.crashData.map(c => parseInt(c['Year'])).filter(y => !isNaN(y));
            const minYear = years.length > 0 ? years.reduce((min, y) => y < min ? y : min, years[0]) : 2012;
            const maxYear = years.length > 0 ? years.reduce((max, y) => y > max ? y : max, years[0]) : 2024;
            const yearSpan = maxYear - minYear + 1;
            const avgCrashesPerYear = yearSpan > 0 ? (this.crashData.length / yearSpan).toFixed(1) : '0';

            // Find top LGA
            const lgaCounts = {};
            this.crashData.forEach(crash => {
                const lga = crash['LGA'];
                if (lga && lga !== 'N/A') {
                    lgaCounts[lga] = (lgaCounts[lga] || 0) + 1;
                }
            });
            const topLGA = Object.entries(lgaCounts).length > 0
                ? Object.entries(lgaCounts).sort((a, b) => b[1] - a[1])[0]
                : null;

            // Find most common crash type
            const crashTypeCounts = {};
            this.crashData.forEach(crash => {
                const type = crash['Crash Type'];
                if (type) {
                    crashTypeCounts[type] = (crashTypeCounts[type] || 0) + 1;
                }
            });
            const topCrashType = Object.entries(crashTypeCounts).length > 0
                ? Object.entries(crashTypeCounts).sort((a, b) => b[1] - a[1])[0]
                : null;

            this.checkPageSpace(120);

            // Section heading
            this.setFont(PDF_CONFIG.FONT_SIZE_HEADING, 'bold', PDF_CONFIG.COLOR_TEXT_DARK);
            this.doc.text('Statistics Summary', PDF_CONFIG.MARGIN, this.yPos);
            this.yPos += PDF_CONFIG.SPACING_SUBSECTION;

            // Overall statistics
            this.setFont(PDF_CONFIG.FONT_SIZE_SUBHEADING, 'bold', PDF_CONFIG.COLOR_TEXT_DARK);
            this.doc.text('Overall', PDF_CONFIG.MARGIN, this.yPos);
            this.yPos += PDF_CONFIG.SPACING_LINE;

            this.setFont(PDF_CONFIG.FONT_SIZE_BODY, 'normal', PDF_CONFIG.COLOR_TEXT_MEDIUM);
            this.doc.text('Total Crashes: ' + this.crashData.length.toLocaleString(), PDF_CONFIG.MARGIN + 5, this.yPos);
            this.yPos += PDF_CONFIG.SPACING_LINE;
            this.doc.text('Period: ' + minYear + ' - ' + maxYear + ' (' + yearSpan + ' years)', PDF_CONFIG.MARGIN + 5, this.yPos);
            this.yPos += PDF_CONFIG.SPACING_LINE;
            this.doc.text('Average: ' + avgCrashesPerYear + ' crashes/year', PDF_CONFIG.MARGIN + 5, this.yPos);
            this.yPos += PDF_CONFIG.SPACING_SUBSECTION;

            // Severity breakdown
            this.setFont(PDF_CONFIG.FONT_SIZE_SUBHEADING, 'bold', PDF_CONFIG.COLOR_TEXT_DARK);
            this.doc.text('Severity Breakdown', PDF_CONFIG.MARGIN, this.yPos);
            this.yPos += PDF_CONFIG.SPACING_LINE;

            this.setFont(PDF_CONFIG.FONT_SIZE_BODY, 'normal', PDF_CONFIG.COLOR_TEXT_MEDIUM);
            Object.entries(severityCounts).forEach(([severity, count]) => {
                const pct = ((count / this.crashData.length) * 100).toFixed(1);
                this.doc.text(`${severity}: ${count.toLocaleString()} (${pct}%)`, PDF_CONFIG.MARGIN + 5, this.yPos);
                this.yPos += PDF_CONFIG.SPACING_LINE;
            });
            this.yPos += PDF_CONFIG.SPACING_SUBSECTION;

            // Casualties
            this.setFont(PDF_CONFIG.FONT_SIZE_SUBHEADING, 'bold', PDF_CONFIG.COLOR_TEXT_DARK);
            this.doc.text('Casualties', PDF_CONFIG.MARGIN, this.yPos);
            this.yPos += PDF_CONFIG.SPACING_LINE;

            this.setFont(PDF_CONFIG.FONT_SIZE_BODY, 'normal', PDF_CONFIG.COLOR_TEXT_MEDIUM);
            this.doc.text('Total Casualties: ' + totalCasualties.toLocaleString(), PDF_CONFIG.MARGIN + 5, this.yPos);
            this.yPos += PDF_CONFIG.SPACING_LINE;
            this.doc.text('  Fatalities: ' + totalFatalities.toLocaleString(), PDF_CONFIG.MARGIN + 5, this.yPos);
            this.yPos += PDF_CONFIG.SPACING_LINE;
            this.doc.text('  Serious Injuries: ' + totalSerious.toLocaleString(), PDF_CONFIG.MARGIN + 5, this.yPos);
            this.yPos += PDF_CONFIG.SPACING_LINE;
            this.doc.text('  Minor Injuries: ' + totalMinor.toLocaleString(), PDF_CONFIG.MARGIN + 5, this.yPos);
            this.yPos += PDF_CONFIG.SPACING_SUBSECTION;

            // Key insights
            this.setFont(PDF_CONFIG.FONT_SIZE_SUBHEADING, 'bold', PDF_CONFIG.COLOR_TEXT_DARK);
            this.doc.text('Key Insights', PDF_CONFIG.MARGIN, this.yPos);
            this.yPos += PDF_CONFIG.SPACING_LINE;

            this.setFont(PDF_CONFIG.FONT_SIZE_BODY, 'normal', PDF_CONFIG.COLOR_TEXT_MEDIUM);
            if (topLGA) {
                this.doc.text(`Most crashes in: ${topLGA[0]} (${topLGA[1].toLocaleString()} crashes)`, PDF_CONFIG.MARGIN + 5, this.yPos);
                this.yPos += PDF_CONFIG.SPACING_LINE;
            }
            if (topCrashType) {
                this.doc.text(`Most common type: ${topCrashType[0]} (${topCrashType[1].toLocaleString()} crashes)`, PDF_CONFIG.MARGIN + 5, this.yPos);
                this.yPos += PDF_CONFIG.SPACING_LINE;
            }

            this.yPos += PDF_CONFIG.SPACING_SECTION;
        } catch (error) {
            this.logError('Statistics Summary', error);
        }
    }

    async addExecutiveSummary() {
        if (!this.options.includeExecutiveSummary) return;

        try {
            await this.updateProgress('Generating executive summary...', 2.5, 6);

            this.checkPageSpace(120);

            // Section heading
            this.setFont(PDF_CONFIG.FONT_SIZE_HEADING, 'bold', PDF_CONFIG.COLOR_TEXT_DARK);
            this.doc.text('Executive Summary', PDF_CONFIG.MARGIN, this.yPos);
            this.yPos += PDF_CONFIG.SPACING_SUBSECTION;

            // Generate automated insights
            const insights = this.generateInsights();

            this.setFont(PDF_CONFIG.FONT_SIZE_BODY, 'normal', PDF_CONFIG.COLOR_TEXT_MEDIUM);

            insights.forEach(insight => {
                this.checkPageSpace(15);
                const lines = this.doc.splitTextToSize('• ' + insight, this.pageWidth - PDF_CONFIG.MARGIN * 2);
                lines.forEach(line => {
                    this.doc.text(line, PDF_CONFIG.MARGIN, this.yPos);
                    this.yPos += PDF_CONFIG.SPACING_LINE;
                });
            });

            this.yPos += PDF_CONFIG.SPACING_SECTION;
        } catch (error) {
            this.logError('Executive Summary', error);
        }
    }

    generateInsights() {
        const insights = [];

        if (!this.crashData || this.crashData.length === 0) {
            insights.push('No crash data available for analysis.');
            return insights;
        }

        // Total crashes insight
        insights.push(`This report analyzes ${this.crashData.length.toLocaleString()} crash incidents from the dataset.`);

        // Severity analysis
        const severityCounts = { '1: PDO': 0, '2: MI': 0, '3: SI': 0, '4: Fatal': 0 };
        this.crashData.forEach(crash => {
            const severity = crash['CSEF Severity'];
            if (severityCounts[severity] !== undefined) severityCounts[severity]++;
        });

        const fatalCount = severityCounts['4: Fatal'];
        const fatalPct = ((fatalCount / this.crashData.length) * 100).toFixed(1);
        insights.push(`Fatal crashes represent ${fatalPct}% of all incidents (${fatalCount.toLocaleString()} crashes), highlighting the severity of road safety challenges.`);

        // Top location
        const lgaCounts = {};
        this.crashData.forEach(crash => {
            const lga = crash['LGA'];
            if (lga && lga !== 'N/A') lgaCounts[lga] = (lgaCounts[lga] || 0) + 1;
        });
        if (Object.keys(lgaCounts).length > 0) {
            const topLGA = Object.entries(lgaCounts).sort((a, b) => b[1] - a[1])[0];
            const lgaPct = ((topLGA[1] / this.crashData.length) * 100).toFixed(1);
            insights.push(`The ${topLGA[0]} area accounts for ${lgaPct}% of crashes (${topLGA[1].toLocaleString()} incidents), indicating a high-priority zone for safety interventions.`);
        }

        // Temporal analysis
        const monthCounts = {};
        this.crashData.forEach(crash => {
            if (crash['Crash Date Time']) {
                const month = new Date(crash['Crash Date Time']).getMonth();
                monthCounts[month] = (monthCounts[month] || 0) + 1;
            }
        });
        if (Object.keys(monthCounts).length > 0) {
            const peakMonth = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0];
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            insights.push(`Peak crash period occurs in ${monthNames[peakMonth[0]]} with ${peakMonth[1].toLocaleString()} incidents, suggesting seasonal safety factors.`);
        }

        // Crash type analysis
        const crashTypeCounts = {};
        this.crashData.forEach(crash => {
            const type = crash['Crash Type'];
            if (type) crashTypeCounts[type] = (crashTypeCounts[type] || 0) + 1;
        });
        if (Object.keys(crashTypeCounts).length > 0) {
            const topType = Object.entries(crashTypeCounts).sort((a, b) => b[1] - a[1])[0];
            const typePct = ((topType[1] / this.crashData.length) * 100).toFixed(1);
            insights.push(`${topType[0]} crashes are the most common type (${typePct}%), representing a key focus area for prevention strategies.`);
        }

        // Casualties insight
        let totalFatalities = 0, totalSI = 0, totalMI = 0;
        this.crashData.forEach(crash => {
            totalFatalities += parseInt(crash['Total Fats'] || 0);
            totalSI += parseInt(crash['Total SI'] || 0);
            totalMI += parseInt(crash['Total MI'] || 0);
        });
        const totalCasualties = totalFatalities + totalSI + totalMI;
        insights.push(`These incidents resulted in ${totalCasualties.toLocaleString()} total casualties: ${totalFatalities.toLocaleString()} fatalities, ${totalSI.toLocaleString()} serious injuries, and ${totalMI.toLocaleString()} minor injuries.`);

        return insights;
    }

    async addFilters() {
        if (!this.options.includeFilters) return;

        try {
            await this.updateProgress('Adding filter information...', 3, 6);

            const filters = getFilterValues();
            const activeFilters = collectActiveFilters(filters);

            // Calculate space needed
            const lineHeight = PDF_CONFIG.SPACING_LINE;
            const headerHeight = PDF_CONFIG.FONT_SIZE_HEADING + PDF_CONFIG.SPACING_SUBSECTION;
            const totalHeight = headerHeight + (activeFilters.length * lineHeight) + PDF_CONFIG.SPACING_SUBSECTION;

            this.checkPageSpace(totalHeight);

            // Section heading
            this.doc.setFontSize(PDF_CONFIG.FONT_SIZE_HEADING);
            this.doc.setTextColor(...PDF_CONFIG.COLOR_TEXT_DARK);
            this.doc.text('Active Filters', PDF_CONFIG.MARGIN, this.yPos);
            this.yPos += PDF_CONFIG.SPACING_SUBSECTION;

            // Filter list
            this.doc.setFontSize(PDF_CONFIG.FONT_SIZE_BODY);
            this.doc.setTextColor(...PDF_CONFIG.COLOR_TEXT_MEDIUM);

            if (activeFilters.length === 0) {
                this.doc.text('No filters applied (showing all data)', PDF_CONFIG.MARGIN, this.yPos);
                this.yPos += PDF_CONFIG.SPACING_LINE;
            } else {
                activeFilters.forEach(filter => {
                    // Check if we need a new page for each filter line
                    this.checkPageSpace(lineHeight);
                    this.doc.text('• ' + filter, PDF_CONFIG.MARGIN, this.yPos);
                    this.yPos += lineHeight;
                });
            }
            this.yPos += PDF_CONFIG.SPACING_SUBSECTION;
        } catch (error) {
            this.logError('Active Filters', error);
        }
    }

    async addCustomNote(note) {
        try {
            this.checkPageSpace(60);

            // Section heading
            this.setFont(PDF_CONFIG.FONT_SIZE_HEADING, 'bold', PDF_CONFIG.COLOR_TEXT_DARK);
            this.doc.text(note.title, PDF_CONFIG.MARGIN, this.yPos);
            this.yPos += PDF_CONFIG.SPACING_SUBSECTION;

            // Note content
            this.setFont(PDF_CONFIG.FONT_SIZE_BODY, 'normal', PDF_CONFIG.COLOR_TEXT_MEDIUM);
            const lines = this.doc.splitTextToSize(note.content, this.pageWidth - PDF_CONFIG.MARGIN * 2);
            lines.forEach(line => {
                this.checkPageSpace(PDF_CONFIG.SPACING_LINE);
                this.doc.text(line, PDF_CONFIG.MARGIN, this.yPos);
                this.yPos += PDF_CONFIG.SPACING_LINE;
            });

            this.yPos += PDF_CONFIG.SPACING_SECTION;
        } catch (error) {
            this.logError(`Custom Note: ${note.title}`, error);
        }
    }

    getHighResChartImage(canvas, chartId, quality = 'high') {
        // Get quality settings from options or use defaults
        const qualityLevel = this.options.imageQuality || quality;
        const scaleFactor = this.options.chartScale || PDF_CONFIG.CHART_SCALE_FACTOR;

        // Use canvas buffer dimensions (already high-res from Chart.js), not CSS display size
        // Chart.js automatically renders at devicePixelRatio, so canvas.width/height are already scaled
        const baseWidth = canvas.width || canvas.offsetWidth || canvas.clientWidth;
        const baseHeight = canvas.height || canvas.offsetHeight || canvas.clientHeight;

        // Create high-resolution canvas based on buffer dimensions (further scaled for PDF quality)
        const hiResCanvas = document.createElement('canvas');
        hiResCanvas.width = baseWidth * scaleFactor;
        hiResCanvas.height = baseHeight * scaleFactor;
        const ctx = hiResCanvas.getContext('2d', {
            alpha: false,  // No transparency for better compression
            willReadFrequently: false
        });

        // Fill with solid white background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, hiResCanvas.width, hiResCanvas.height);

        // Enable highest quality scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw the original chart at its full buffer resolution onto our scaled high-res canvas
        // This preserves all the detail from Chart.js's high-DPI rendering
        ctx.drawImage(canvas, 0, 0, baseWidth, baseHeight,
                     0, 0, hiResCanvas.width, hiResCanvas.height);

        // Smart format selection
        const useJPEG = this.options.smartCompression &&
                       PDF_CONFIG.JPEG_SUITABLE_CHARTS.includes(chartId);

        let imageData;
        if (useJPEG) {
            // JPEG for charts with gradients/smooth colors (smaller file size)
            const jpegQuality = PDF_CONFIG.IMAGE_QUALITY[qualityLevel] || 0.92;
            imageData = {
                data: hiResCanvas.toDataURL('image/jpeg', jpegQuality),
                format: 'JPEG'
            };
        } else {
            // PNG for charts with sharp edges/text (better quality)
            const pngQuality = PDF_CONFIG.IMAGE_QUALITY[qualityLevel] || 1.0;
            imageData = {
                data: hiResCanvas.toDataURL('image/png', pngQuality),
                format: 'PNG'
            };
        }

        // Clean up temporary canvas to prevent memory leaks
        hiResCanvas.width = 0;
        hiResCanvas.height = 0;

        return imageData;
    }

    waitForChartsReady() {
        // Promise-based chart readiness detection with proper rendering state checks
        return new Promise((resolve) => {
            // Find all chart canvases
            const allCanvases = document.querySelectorAll('canvas[id$="Chart"]');
            const chartInstances = [];

            // First pass: Stop any ongoing animations and disable future ones
            allCanvases.forEach(canvas => {
                const chart = window.Chart?.getChart(canvas);
                if (chart) {
                    chartInstances.push(chart);
                    // Store original animation settings
                    if (!chart._pdfOriginalAnimation) {
                        chart._pdfOriginalAnimation = chart.options.animation;
                    }
                    // Disable ALL animation-related properties
                    chart.options.animation = false;
                    if (chart.options.animations) {
                        chart.options.animations = false;
                    }
                    // Stop any active animations
                    if (chart.ctx && chart.ctx.stop) {
                        chart.ctx.stop();
                    }
                }
            });

            if (chartInstances.length === 0) {
                resolve();
                return;
            }

            // Wait for browser to apply animation changes
            requestAnimationFrame(() => {
                // Second pass: Force charts to render at high resolution for PDF
                chartInstances.forEach(chart => {
                    const canvas = chart.canvas;
                    const container = canvas.parentElement;

                    // Store original dimensions
                    if (!canvas._pdfOriginalWidth) {
                        canvas._pdfOriginalWidth = canvas.width;
                        canvas._pdfOriginalHeight = canvas.height;
                        canvas._pdfOriginalStyleWidth = canvas.style.width;
                        canvas._pdfOriginalStyleHeight = canvas.style.height;
                    }

                    // Use configured dimensions for optimal high-res rendering
                    const targetWidth = PDF_CONFIG.CHART_RENDER_TARGET_WIDTH;
                    const targetHeight = PDF_CONFIG.CHART_RENDER_TARGET_HEIGHT;

                    // Set container size (if it has explicit dimensions)
                    if (container && container.style) {
                        container._pdfOriginalWidth = container.style.width;
                        container._pdfOriginalHeight = container.style.height;
                        container.style.width = targetWidth + 'px';
                        container.style.height = targetHeight + 'px';
                    }

                    // Resize chart to use the new container dimensions
                    chart.resize(targetWidth, targetHeight);

                    // Scale up fonts for better readability in PDF
                    // Store original font settings
                    if (!chart._pdfOriginalFonts) {
                        chart._pdfOriginalFonts = {
                            defaultFontSize: window.Chart?.defaults?.font?.size,
                            legendFontSize: chart.options.plugins?.legend?.labels?.font?.size,
                            titleFontSize: chart.options.plugins?.title?.font?.size,
                            tooltipFontSize: chart.options.plugins?.tooltip?.bodyFont?.size
                        };
                    }

                    // Increase font sizes proportionally for PDF readability
                    const fontScale = PDF_CONFIG.CHART_FONT_SCALE;

                    // Set global default font size for this chart
                    if (!chart.options.font) chart.options.font = {};
                    chart.options.font.size = 14 * fontScale;

                    // Scale legend fonts
                    if (!chart.options.plugins) chart.options.plugins = {};
                    if (!chart.options.plugins.legend) chart.options.plugins.legend = {};
                    if (!chart.options.plugins.legend.labels) chart.options.plugins.legend.labels = {};
                    if (!chart.options.plugins.legend.labels.font) chart.options.plugins.legend.labels.font = {};
                    chart.options.plugins.legend.labels.font.size = 16 * fontScale;
                    chart.options.plugins.legend.labels.padding = 15;
                    chart.options.plugins.legend.labels.boxWidth = 40;
                    chart.options.plugins.legend.labels.boxHeight = 15;

                    // Scale title fonts if present
                    if (chart.options.plugins.title?.display) {
                        if (!chart.options.plugins.title.font) chart.options.plugins.title.font = {};
                        chart.options.plugins.title.font.size = 18 * fontScale;
                    }

                    // Scale axis labels
                    if (chart.options.scales) {
                        Object.keys(chart.options.scales).forEach(scaleKey => {
                            const scale = chart.options.scales[scaleKey];
                            if (!scale.ticks) scale.ticks = {};
                            if (!scale.ticks.font) scale.ticks.font = {};
                            scale.ticks.font.size = 14 * fontScale;

                            // Scale axis title if present
                            if (scale.title?.display) {
                                if (!scale.title.font) scale.title.font = {};
                                scale.title.font.size = 16 * fontScale;
                            }
                        });
                    }
                });

                // Wait for resize to complete using RAF
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        // Update all charts with new settings (no animation)
                        const updatePromises = chartInstances.map(chart => {
                            return new Promise(chartResolve => {
                                // Update chart synchronously
                                chart.update('none');

                                // Force immediate render at final state
                                chart.render();

                                // Wait two frames for render to complete
                                requestAnimationFrame(() => {
                                    requestAnimationFrame(() => {
                                        chartResolve();
                                    });
                                });
                            });
                        });

                        // Wait for all charts to finish rendering
                        Promise.all(updatePromises).then(() => {
                            // Add one final frame to ensure everything is settled
                            requestAnimationFrame(() => {
                                resolve();
                            });
                        });
                    });
                });
            });
        });
    }

    restoreChartAnimations() {
        // Restore animations and dimensions after PDF capture
        const allCanvases = document.querySelectorAll('canvas[id$="Chart"]');

        allCanvases.forEach(canvas => {
            const chart = window.Chart?.getChart(canvas);
            if (chart && chart._pdfOriginalAnimation !== undefined) {
                chart.options.animation = chart._pdfOriginalAnimation;
                delete chart._pdfOriginalAnimation;
            }

            // Restore container dimensions
            const container = canvas.parentElement;
            if (container && container._pdfOriginalWidth !== undefined) {
                container.style.width = container._pdfOriginalWidth;
                container.style.height = container._pdfOriginalHeight;
                delete container._pdfOriginalWidth;
                delete container._pdfOriginalHeight;
            }

            // Restore canvas dimensions
            if (canvas._pdfOriginalWidth !== undefined) {
                delete canvas._pdfOriginalWidth;
                delete canvas._pdfOriginalHeight;
                delete canvas._pdfOriginalStyleWidth;
                delete canvas._pdfOriginalStyleHeight;
            }

            // Restore font sizes
            if (chart && chart._pdfOriginalFonts) {
                // Note: We don't actually restore fonts, we just clean up the stored values
                // The charts will re-render at normal size with normal fonts automatically
                delete chart._pdfOriginalFonts;
            }

            // Resize chart back to container size (this will use default fonts again)
            if (chart) {
                chart.resize();
                chart.update('none');
            }
        });
    }

    async addCharts() {
        if (!this.options.includeCharts) return;

        try {
            await this.updateProgress('Rendering charts...', 4, 6);

            // Map checkbox IDs to chart info
            const chartInfoMap = {
                'pdfChart1': { id: 'crashesOverTimeChart', include: this.options.charts.overTime, title: 'Crashes Over Time' },
                'pdfChart2': { id: 'crashesByDayChart', include: this.options.charts.byDay, title: 'Crashes by Day of Week' },
                'pdfChart3': { id: 'crashesByHourChart', include: this.options.charts.byHour, title: 'Crashes by Hour' },
                'pdfChart4': { id: 'severityDistributionChart', include: this.options.charts.severity, title: 'Severity Distribution' },
                'pdfChart5': { id: 'crashTypeChart', include: this.options.charts.crashType, title: 'Top Crash Types' },
                'pdfChart6': { id: 'topLGAChart', include: this.options.charts.lga, title: 'Top Areas (LGA)' },
                'pdfChart7': { id: 'weatherChart', include: this.options.charts.weather, title: 'Weather Conditions' },
                'pdfChart8': { id: 'severityTrendChart', include: this.options.charts.severityTrend, title: 'Severity Trend Over Time' }
            };

            // Build chart list respecting user-defined order
            const chartOrder = this.options.chartOrder || Object.keys(chartInfoMap);
            const chartMap = chartOrder.map(checkboxId => chartInfoMap[checkboxId]).filter(c => c);

            const chartsToInclude = [];
            for (const chartInfo of chartMap) {
                if (!chartInfo.include) continue;

                try {
                    const canvas = document.getElementById(chartInfo.id);
                    if (!canvas) {
                        console.warn('Chart canvas not found:', chartInfo.id);
                        continue;
                    }

                    // Use canvas buffer dimensions for accurate aspect ratio
                    const canvasWidth = canvas.width || canvas.offsetWidth || canvas.clientWidth;
                    const canvasHeight = canvas.height || canvas.offsetHeight || canvas.clientHeight;

                    const imageData = this.getHighResChartImage(canvas, chartInfo.id);

                    chartsToInclude.push({
                        ...chartInfo,
                        canvas,
                        imageData: imageData.data,
                        imageFormat: imageData.format,
                        aspectRatio: canvasHeight / canvasWidth
                    });
                } catch (chartError) {
                    console.error('Error processing chart ' + chartInfo.id + ':', chartError);
                    // Continue with other charts
                }
            }

            const maxWidth = this.pageWidth - (PDF_CONFIG.MARGIN * 2);

            for (let i = 0; i < chartsToInclude.length; i++) {
                const chart = chartsToInclude[i];
                const isLastChart = i === chartsToInclude.length - 1;

                // Update progress for each chart being added
                const chartProgress = 4 + (i / chartsToInclude.length);
                await this.updateProgress(`Adding chart: ${chart.title}...`, chartProgress, 6);

                let targetMaxHeight;
                if (isLastChart || (i % 2 === 0 && i + 1 === chartsToInclude.length - 1)) {
                    targetMaxHeight = PDF_CONFIG.CHART_MAX_HEIGHT_SINGLE;
                } else {
                    targetMaxHeight = PDF_CONFIG.CHART_MAX_HEIGHT_PAIRED;
                }

                let imgWidth = maxWidth;
                let imgHeight = imgWidth * chart.aspectRatio;

                if (imgHeight > targetMaxHeight) {
                    imgHeight = targetMaxHeight;
                    imgWidth = imgHeight / chart.aspectRatio;
                }

                const totalChartHeight = PDF_CONFIG.CHART_TITLE_HEIGHT + imgHeight + PDF_CONFIG.CHART_BOTTOM_SPACING;

                this.checkPageSpace(totalChartHeight);

                this.doc.setFontSize(PDF_CONFIG.FONT_SIZE_SUBHEADING);
                this.doc.setTextColor(...PDF_CONFIG.COLOR_TEXT_DARK);
                this.doc.text(chart.title, PDF_CONFIG.MARGIN, this.yPos);
                this.yPos += PDF_CONFIG.CHART_TITLE_HEIGHT;

                // Use the appropriate format for each chart
                this.doc.addImage(chart.imageData, chart.imageFormat, PDF_CONFIG.MARGIN, this.yPos, imgWidth, imgHeight, undefined, 'FAST');
                this.yPos += imgHeight + PDF_CONFIG.CHART_BOTTOM_SPACING;
            }
        } catch (error) {
            this.logError('Charts & Visualizations', error);
        }
    }

    /**
     * Wait for map tiles to load
     * @private
     */
    async _waitForTileLoad(tileLayer) {
        return new Promise((resolve) => {
            if (!tileLayer) {
                resolve();
                return;
            }

            let tilesLoaded = false;
            let timeout;
            let tileLoadCount = 0;
            let tileErrorCount = 0;
            let checkTimer = null;

            const checkComplete = () => {
                if (checkTimer) clearTimeout(checkTimer);
                checkTimer = setTimeout(() => {
                    if (!tilesLoaded) {
                        tilesLoaded = true;
                        if (tileLayer) {
                            tileLayer.off('tileload', onTileLoad);
                            tileLayer.off('tileerror', onTileError);
                            tileLayer.off('load', onLayerLoad);
                        }
                        clearTimeout(timeout);
                        console.log(`Individual tiles loaded: ${tileLoadCount}, errors: ${tileErrorCount}`);
                        resolve();
                    }
                }, PDF_CONFIG.MAP_TILE_STABLE_DELAY);
            };

            const onTileLoad = () => {
                tileLoadCount++;
                console.log(`Tile ${tileLoadCount} loaded`);
                if (tileLoadCount >= PDF_CONFIG.MAP_TILE_MIN_LOADED) {
                    checkComplete();
                }
            };

            const onTileError = (e) => {
                tileErrorCount++;
                console.warn('Tile load error:', e);
            };

            const onLayerLoad = () => {
                console.log('Tile layer load event fired');
                checkComplete();
            };

            tileLayer.on('tileload', onTileLoad);
            tileLayer.on('tileerror', onTileError);
            tileLayer.on('load', onLayerLoad);
            tileLayer.redraw();
            mapState.map.invalidateSize();

            // Fallback timeout if tiles don't load in time
            timeout = setTimeout(() => {
                if (!tilesLoaded) {
                    tilesLoaded = true;
                    if (tileLayer) {
                        tileLayer.off('tileload', onTileLoad);
                        tileLayer.off('tileerror', onTileError);
                        tileLayer.off('load', onLayerLoad);
                    }
                    if (checkTimer) clearTimeout(checkTimer);
                    console.warn(`Tile loading timeout. Loaded: ${tileLoadCount}, errors: ${tileErrorCount}`);
                    resolve();
                }
            }, PDF_CONFIG.MAP_TILE_LOAD_TIMEOUT);
        });
    }

    /**
     * Prepare choropleth layer for PDF capture
     * @private
     */
    async _prepareChoroplethForCapture() {
        if (!pdfExportLayers.choropleth || !mapState.choroplethLayer) return;

        console.log('Preparing choropleth layer for PDF capture...');
        mapState.choroplethLayer.bringToFront();

        // Force canvas renderer to redraw the layer
        mapState.choroplethLayer.eachLayer(function(layer) {
            if (layer._renderer && layer._renderer._container) {
                console.log('Canvas renderer found, forcing redraw');
            }
        });

        // Multiple invalidate calls with waits to ensure proper canvas positioning
        for (let i = 0; i < PDF_CONFIG.MAP_CHOROPLETH_REDRAW_CYCLES; i++) {
            mapState.map.invalidateSize();
            await new Promise(resolve => setTimeout(resolve, PDF_CONFIG.MAP_CHOROPLETH_REDRAW_DELAY));
        }

        if (mapState.choroplethLayer.redraw) {
            mapState.choroplethLayer.redraw();
        }

        // Force browser repaint cycles
        await new Promise(resolve => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(resolve);
                });
            });
        });

        // Final wait for canvas to settle
        await new Promise(resolve => setTimeout(resolve, PDF_CONFIG.MAP_FINAL_SETTLE_DELAY));
        console.log('Choropleth layer should be ready for capture');
    }

    /**
     * Create canvas overlay for markers
     * @private
     */
    _createMarkerOverlay(mapContainer) {
        if (!pdfExportLayers.markers || !mapState.markersLayer) return null;

        console.log('Preparing markers layer for PDF capture...');

        const markerCanvas = document.createElement('canvas');
        markerCanvas.id = 'pdf-marker-overlay';
        markerCanvas.style.position = 'absolute';
        markerCanvas.style.top = '0';
        markerCanvas.style.left = '0';
        markerCanvas.style.zIndex = '1000';
        markerCanvas.style.pointerEvents = 'none';
        markerCanvas.width = mapContainer.offsetWidth;
        markerCanvas.height = mapContainer.offsetHeight;

        const ctx = markerCanvas.getContext('2d');
        let drawnCount = 0;

        // Get map container's position for accurate calculations
        const mapRect = mapContainer.getBoundingClientRect();

        // Draw cluster elements
        const clusterElements = document.querySelectorAll('.marker-cluster');
        clusterElements.forEach(clusterEl => {
            // Get the absolute position of the cluster element relative to the map container
            const rect = clusterEl.getBoundingClientRect();
            const x = rect.left - mapRect.left + (rect.width / 2);
            const y = rect.top - mapRect.top + (rect.height / 2);
            const countText = clusterEl.querySelector('div span')?.textContent ||
                             clusterEl.querySelector('div')?.textContent || '1';

            // Determine color and size based on cluster class
            let color, radius;
            if (clusterEl.classList.contains('marker-cluster-small')) {
                color = 'rgba(0, 212, 255, 0.8)';
                radius = 20;
            } else if (clusterEl.classList.contains('marker-cluster-medium')) {
                color = 'rgba(255, 165, 0, 0.8)';
                radius = 20;
            } else if (clusterEl.classList.contains('marker-cluster-large')) {
                color = 'rgba(255, 69, 0, 0.8)';
                radius = 25;
            } else {
                color = 'rgba(0, 212, 255, 0.8)';
                radius = 20;
            }

            // Draw cluster circles
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI);
            ctx.fillStyle = color.replace('0.8', '0.6');
            ctx.fill();

            ctx.beginPath();
            ctx.arc(x, y, radius - 5, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();

            ctx.fillStyle = 'white';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(countText, x, y);

            drawnCount++;
        });

        // Draw individual markers
        const individualMarkers = document.querySelectorAll('.leaflet-marker-icon:not(.marker-cluster)');
        individualMarkers.forEach(markerEl => {
            // Get the absolute position of the marker element relative to the map container
            const rect = markerEl.getBoundingClientRect();
            const x = rect.left - mapRect.left + (rect.width / 2);
            const y = rect.top - mapRect.top + (rect.height / 2);

            let color = '#808080';
            const colorDiv = markerEl.querySelector('div');
            if (colorDiv && colorDiv.style.backgroundColor) {
                color = colorDiv.style.backgroundColor;
            }

            ctx.beginPath();
            ctx.arc(x, y, 6, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();

            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();

            drawnCount++;
        });

        console.log(`Drew ${drawnCount} markers/clusters on canvas overlay`);
        mapContainer.appendChild(markerCanvas);
        return markerCanvas;
    }

    /**
     * Hide map UI elements for capture
     * @private
     */
    _hideMapUI() {
        const uiElements = [
            ...document.querySelectorAll('.leaflet-control-container'),
            ...document.querySelectorAll('.leaflet-control'),
            ...document.querySelectorAll('.toggle-panel-btn'),
            ...document.querySelectorAll('.active-filters-bar'),
            ...document.querySelectorAll('.controls-panel'),
            ...document.querySelectorAll('.analytics-panel')
        ];

        const originalDisplayValues = uiElements.map(el => el.style.display);
        uiElements.forEach(el => el.style.display = 'none');

        return { uiElements, originalDisplayValues };
    }

    /**
     * Create a legend overlay for the map based on active layers
     * @private
     */
    _createMapLegend() {
        if (!pdfExportLayers.density && !pdfExportLayers.choropleth && !pdfExportLayers.markers) {
            return null;
        }

        const legendDiv = document.createElement('div');
        legendDiv.id = 'pdf-map-legend';
        legendDiv.style.cssText = `
            position: absolute;
            bottom: 20px;
            right: 20px;
            background: white;
            padding: 12px 16px;
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            font-family: Arial, sans-serif;
            font-size: 13px;
            z-index: 1000;
            min-width: 180px;
        `;

        let legendHTML = '<div style="font-weight: bold; margin-bottom: 8px; font-size: 14px;">Legend</div>';

        // Density heatmap legend
        if (pdfExportLayers.density) {
            legendHTML += `
                <div style="margin-bottom: 8px;">
                    <div style="font-weight: 600; font-size: 12px; margin-bottom: 4px;">Crash Density</div>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <div style="width: 100%; height: 16px; background: linear-gradient(to right,
                            rgba(0,0,255,0.3), rgba(0,200,200,0.6), rgba(0,255,100,0.8),
                            rgba(255,255,0,1), rgba(255,150,0,1), rgb(255,100,75));
                            border-radius: 3px; border: 1px solid #ccc;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 10px; color: #666; margin-top: 2px;">
                        <span>Low</span>
                        <span>High</span>
                    </div>
                </div>
            `;
        }

        // Choropleth legend
        if (pdfExportLayers.choropleth) {
            const mode = pdfExportLayers.choroplethMode === 'suburb' ? 'Suburb' : 'LGA';
            legendHTML += `
                <div style="margin-bottom: 8px;">
                    <div style="font-weight: 600; font-size: 12px; margin-bottom: 4px;">Crashes by ${mode}</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 3px; font-size: 11px;">
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <div style="width: 14px; height: 14px; background: #FF00FF; border: 1px solid #ccc;"></div>
                            <span>Highest</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <div style="width: 14px; height: 14px; background: #FF0000; border: 1px solid #ccc;"></div>
                            <span>High</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <div style="width: 14px; height: 14px; background: #FFAA00; border: 1px solid #ccc;"></div>
                            <span>Medium</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <div style="width: 14px; height: 14px; background: #FFFF00; border: 1px solid #ccc;"></div>
                            <span>Low</span>
                        </div>
                    </div>
                </div>
            `;
        }

        // Marker legend (if markers are shown, get from the existing legend)
        if (pdfExportLayers.markers) {
            const markerLegendEl = document.getElementById('markerColorLegend');
            if (markerLegendEl && markerLegendEl.innerHTML.trim()) {
                legendHTML += `
                    <div style="margin-bottom: 8px;">
                        <div style="font-weight: 600; font-size: 12px; margin-bottom: 4px;">Crash Markers</div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            ${markerLegendEl.innerHTML}
                        </div>
                    </div>
                `;
            }
        }

        legendDiv.innerHTML = legendHTML;
        return legendDiv;
    }

    /**
     * Restore map UI elements after capture
     * @private
     */
    _restoreMapUI(uiElements, originalDisplayValues) {
        uiElements.forEach((el, i) => {
            el.style.display = originalDisplayValues[i];
        });
    }

    /**
     * Capture map image using available libraries
     * @private
     */
    async _captureMapImage(mapContainer) {
        const useHtml2Canvas = (pdfExportLayers.choropleth || pdfExportLayers.markers || pdfExportLayers.density) &&
                              typeof html2canvas !== 'undefined';

        if (useHtml2Canvas) {
            console.log('Using html2canvas for map capture (choropleth/markers/density active)');

            const canvas = await html2canvas(mapContainer, {
                useCORS: true,
                allowTaint: false,
                backgroundColor: '#a0c5e8',
                scale: 2,
                logging: true,
                removeContainer: false,
                foreignObjectRendering: false,
                imageTimeout: 15000,
                ignoreElements: () => false,
                onclone: function(clonedDoc) {
                    const clonedMap = clonedDoc.getElementById('map');
                    if (clonedMap) {
                        clonedMap.style.width = mapContainer.offsetWidth + 'px';
                        clonedMap.style.height = mapContainer.offsetHeight + 'px';
                    }

                    const markerPane = clonedDoc.querySelector('.leaflet-marker-pane');
                    if (markerPane) {
                        markerPane.style.visibility = 'visible';
                        markerPane.style.opacity = '1';
                        markerPane.style.pointerEvents = 'none';
                    }

                    const markerElements = clonedDoc.querySelectorAll(
                        '.leaflet-marker-icon, .custom-marker, .marker-cluster, ' +
                        '.marker-cluster-small, .marker-cluster-medium, .marker-cluster-large'
                    );
                    markerElements.forEach(el => {
                        el.style.visibility = 'visible';
                        el.style.opacity = '1';
                        el.style.display = '';
                    });

                    const clusterDivs = clonedDoc.querySelectorAll('.marker-cluster div');
                    clusterDivs.forEach(el => {
                        el.style.visibility = 'visible';
                        el.style.opacity = '1';
                    });
                }
            });
            return canvas.toDataURL('image/png', 0.95);
        } else if (typeof leafletImage !== 'undefined') {
            console.log('Using leaflet-image for map capture');
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('leaflet-image timeout')), 10000);
                leafletImage(mapState.map, function(err, canvas) {
                    clearTimeout(timeout);
                    if (err) {
                        reject(err);
                    } else {
                        resolve(canvas.toDataURL('image/png', 0.95));
                    }
                });
            });
        } else if (typeof html2canvas !== 'undefined') {
            console.log('Using html2canvas for map capture (fallback)');
            const canvas = await html2canvas(mapContainer, {
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#a0c5e8',
                scale: 2,
                logging: false,
                removeContainer: true,
                foreignObjectRendering: true
            });
            return canvas.toDataURL('image/png', 0.95);
        } else {
            throw new Error('No map capture library available');
        }
    }

    async addDataTable() {
        if (!this.options.includeTable) return;

        try {
            await this.updateProgress('Generating data table...', 5, 6);

            let tableData = this.crashData;
            const maxRows = this.options.tableRows === 'all' ? this.crashData.length : parseInt(this.options.tableRows);
            tableData = this.crashData.slice(0, maxRows);

            this.checkPageSpace(40);

            this.doc.setFontSize(PDF_CONFIG.FONT_SIZE_HEADING);
            this.doc.setTextColor(...PDF_CONFIG.COLOR_TEXT_DARK);
            this.doc.text('Crash Data (' + tableData.length + ' of ' + this.crashData.length + ' rows)', PDF_CONFIG.MARGIN, this.yPos);
            this.yPos += PDF_CONFIG.SPACING_SUBSECTION;

            // Column mapping for custom selection
            const columnMapping = {
                'Date': { key: 'Crash Date Time', header: 'Date', width: 22, format: (val) => val ? val.split(' ')[0] : '' },
                'Time': { key: 'Crash Date Time', header: 'Time', width: 15, format: (val) => val ? val.split(' ')[1] || '' : '' },
                'CSEF Severity': { key: 'CSEF Severity', header: 'Severity', width: 18 },
                'Crash Type': { key: 'Crash Type', header: 'Type', width: 30 },
                'LGA': { key: 'LGA', header: 'LGA', width: 22 },
                'Suburb': { key: 'Suburb', header: 'Suburb', width: 22 },
                'Total Fats': { key: 'Total Fats', header: 'Fatalities', width: 15 },
                'Total SI': { key: 'Total SI', header: 'SI', width: 12 },
                'Total MI': { key: 'Total MI', header: 'MI', width: 12 },
                'Speed Limit': { key: 'Area Speed', header: 'Speed', width: 15, format: (val) => val ? val + 'km/h' : '' },
                'Road Surface': { key: 'Road Surface', header: 'Surface', width: 18 },
                'Moisture Condition': { key: 'Moisture Cond', header: 'Moisture', width: 18 },
                'Weather Condition': { key: 'Weather Cond', header: 'Weather', width: 18 },
                'DayNight': { key: 'DayNight', header: 'Day/Night', width: 15 },
                'Unit Count': { key: 'Unit Count', header: 'Units', width: 12 },
                'Latitude': { key: 'Latitude', header: 'Lat', width: 16 },
                'Longitude': { key: 'Longitude', header: 'Lng', width: 16 }
            };

            // Determine which columns to include
            const selectedColumns = this.options.tableColumns || ['Date', 'CSEF Severity', 'Crash Type', 'LGA'];
            const columns = selectedColumns.map(col => columnMapping[col]).filter(c => c);

            // Build table headers
            const headers = columns.map(col => col.header);

            // Build table rows
            const tableRows = tableData.map(crash => {
                return columns.map(col => {
                    const value = crash[col.key] || '';
                    return col.format ? col.format(value) : value;
                });
            });

            // Build column styles dynamically
            const columnStyles = {};
            columns.forEach((col, index) => {
                columnStyles[index] = { cellWidth: col.width };
            });

            this.doc.autoTable({
                head: [headers],
                body: tableRows,
                startY: this.yPos,
                margin: { left: PDF_CONFIG.MARGIN, right: PDF_CONFIG.MARGIN },
                styles: {
                    fontSize: PDF_CONFIG.FONT_SIZE_TABLE,
                    cellPadding: 1.5,
                    overflow: 'linebreak'
                },
                headStyles: {
                    fillColor: PDF_CONFIG.COLOR_PRIMARY,
                    fontStyle: 'bold'
                },
                alternateRowStyles: { fillColor: PDF_CONFIG.COLOR_TABLE_ALT_ROW },
                columnStyles: columnStyles
            });
        } catch (error) {
            this.logError('Data Table', error);
        }
    }

    async addMapView() {
        if (!this.options.includeMap) return;

        try {
            await this.updateProgress('Capturing map view...', 4.5, 6);

            // Get the map element
            const mapContainer = document.getElementById('map');

            if (!mapContainer || !mapState || !mapState.map) {
                console.warn('Map not available for export');
                return;
            }

            // Ensure map size is properly calculated
            mapState.map.invalidateSize();

            // Use RAF to ensure DOM updates are complete
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

            // Find and wait for tile layer to load
            let tileLayer = null;
            mapState.map.eachLayer((layer) => {
                if (layer instanceof L.TileLayer) {
                    tileLayer = layer;
                }
            });
            await this._waitForTileLoad(tileLayer);

            // Prepare choropleth layer if active
            await this._prepareChoroplethForCapture();

            // Create marker overlay if needed
            const markerCanvas = this._createMarkerOverlay(mapContainer);

            // Create and add legend overlay
            const legendOverlay = this._createMapLegend();
            if (legendOverlay) {
                mapContainer.appendChild(legendOverlay);
            }

            // Wait for all layers and overlays to settle before capture
            await new Promise(resolve => setTimeout(resolve, PDF_CONFIG.MAP_CAPTURE_SETTLE_TIME));

            // Hide UI elements and capture map
            const { uiElements, originalDisplayValues } = this._hideMapUI();
            await new Promise(resolve => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(resolve);
                });
            });

            let mapImageData;
            try {
                mapImageData = await this._captureMapImage(mapContainer);
            } finally {
                // Always restore UI elements
                this._restoreMapUI(uiElements, originalDisplayValues);

                // Remove marker canvas overlay if it exists
                if (markerCanvas && markerCanvas.parentNode) {
                    console.log('Removing marker canvas overlay');
                    markerCanvas.parentNode.removeChild(markerCanvas);
                }

                // Remove legend overlay if it exists
                if (legendOverlay && legendOverlay.parentNode) {
                    console.log('Removing legend overlay');
                    legendOverlay.parentNode.removeChild(legendOverlay);
                }
            }

            // Calculate dimensions for PDF
            const maxWidth = this.pageWidth - (PDF_CONFIG.MARGIN * 2);
            const maxHeight = this.pageHeight - (PDF_CONFIG.MARGIN * 2) - PDF_CONFIG.FONT_SIZE_HEADING - PDF_CONFIG.SPACING_SUBSECTION - PDF_CONFIG.SPACING_SECTION;
            const aspectRatio = mapContainer.offsetHeight / mapContainer.offsetWidth;
            let imgWidth = maxWidth;
            let imgHeight = imgWidth * aspectRatio;

            if (imgHeight > maxHeight) {
                imgHeight = maxHeight;
                imgWidth = imgHeight / aspectRatio;
            }

            const totalHeight = PDF_CONFIG.FONT_SIZE_HEADING + PDF_CONFIG.SPACING_SUBSECTION + imgHeight + PDF_CONFIG.SPACING_SECTION;
            this.checkPageSpace(totalHeight);

            // Add heading (determine title based on active layers)
            let mapTitle = 'Crash Map';
            if (pdfExportLayers.density && !pdfExportLayers.markers && !pdfExportLayers.choropleth) {
                mapTitle = 'Crash Density Map';
            } else if (pdfExportLayers.markers && !pdfExportLayers.density && !pdfExportLayers.choropleth) {
                mapTitle = 'Crash Markers Map';
            } else if (pdfExportLayers.choropleth && !pdfExportLayers.density && !pdfExportLayers.markers) {
                mapTitle = 'Crash Choropleth Map';
            }

            this.setFont(PDF_CONFIG.FONT_SIZE_HEADING, 'bold', PDF_CONFIG.COLOR_TEXT_DARK);
            this.doc.text(mapTitle, PDF_CONFIG.MARGIN, this.yPos);
            this.yPos += PDF_CONFIG.SPACING_SUBSECTION;

            // Add map image to PDF
            this.doc.addImage(mapImageData, 'PNG', PDF_CONFIG.MARGIN, this.yPos, imgWidth, imgHeight, undefined, 'FAST');
            this.yPos += imgHeight + PDF_CONFIG.SPACING_SECTION;

        } catch (error) {
            this.logError('Map View', error);
        }
    }

    async generate() {
        // Set PDF metadata
        this.doc.setProperties({
            title: PDF_CONFIG.PDF_TITLE,
            subject: PDF_CONFIG.PDF_SUBJECT,
            author: PDF_CONFIG.PDF_AUTHOR,
            keywords: PDF_CONFIG.PDF_KEYWORDS,
            creator: PDF_CONFIG.PDF_CREATOR
        });

        // Helper function to add notes at specific positions
        const addNotesAtPosition = async (position) => {
            if (this.options.includeNotes && this.options.notes) {
                const notesAtPosition = this.options.notes.filter(note => note.position === position);
                for (const note of notesAtPosition) {
                    await this.addCustomNote(note);
                }
            }
        };

        // Generate all sections in order
        await this.addCoverPage();
        await addNotesAtPosition('after-cover');

        await this.addExecutiveSummary();
        await this.addStatistics();
        await addNotesAtPosition('after-stats');

        await this.addFilters();
        await this.addMapView();
        await this.addCharts();
        await addNotesAtPosition('after-charts');

        await addNotesAtPosition('before-table');
        await this.addDataTable();
        await addNotesAtPosition('end');

        // Add page numbers to all pages
        await this.updateProgress('Adding page numbers...', 6, 6);
        this.addPageNumbers();
    }
}

// ========================================
// Main PDF Generation Function
// ========================================

/**
 * Generate and download a PDF report based on current crash data and user-selected options
 * This is the main entry point for PDF generation
 * @returns {Promise<void>}
 * @throws {Error} If PDF generation fails critically
 */
export async function generatePdfReport() {
    let analyticsPanel, wasClosed, originalVisibility, originalDisplay, loadingOverlay;
    let generator;

    try {
        // Show loading overlay
        loadingOverlay = document.getElementById('pdfLoadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
        }

        // Reset progress bar for new export
        const progressBar = document.getElementById('pdfProgressBar');
        const loadingMessage = document.getElementById('pdfLoadingMessage');
        const loadingPercent = document.getElementById('pdfLoadingPercent');
        if (progressBar) progressBar.style.width = '0%';
        if (loadingMessage) loadingMessage.textContent = 'Preparing...';
        if (loadingPercent) loadingPercent.textContent = '0%';

        // Close the PDF modal first
        closePdfExportModal();

        // Use RAF to ensure modal DOM updates are complete
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        // Get data first
        const crashData = window._lastCrashData || [];

        if (crashData.length === 0) {
            if (loadingOverlay) loadingOverlay.style.display = 'none';
            showNotification('No data to export. Please apply filters first.', 'warning');
            return;
        }

        // Ensure analytics panel is expanded for chart rendering (but keep it invisible)
        analyticsPanel = document.getElementById('analyticsPanel');
        wasClosed = analyticsPanel && analyticsPanel.classList.contains('collapsed');

        // Store original styles
        originalVisibility = analyticsPanel ? analyticsPanel.style.visibility : '';
        originalDisplay = analyticsPanel ? analyticsPanel.style.display : '';

        if (analyticsPanel) {
            // Expand panel if collapsed - keep it on screen!
            // Loading overlay will hide it from user view
            if (wasClosed) {
                // CRITICAL: Disable CSS transitions for instant expansion
                const originalTransition = analyticsPanel.style.transition;
                analyticsPanel.style.transition = 'none';

                // Remove collapsed class (expands instantly with no animation)
                analyticsPanel.classList.remove('collapsed');

                // Force browser reflow to apply changes immediately
                void analyticsPanel.offsetHeight;

                // Restore original transition property
                analyticsPanel.style.transition = originalTransition;

                // Wait for charts to fully render at new dimensions
                await new Promise(resolve => setTimeout(resolve, PDF_CONFIG.CHART_RENDER_DELAY_CLOSED));
            } else {
                // Panel already open - use shorter wait for stability
                await new Promise(resolve => setTimeout(resolve, PDF_CONFIG.CHART_RENDER_DELAY_OPEN));
            }
        }

        // Create a temporary generator to use waitForChartsReady
        const tempDoc = { internal: { pageSize: { getWidth: () => 0, getHeight: () => 0 } } };
        const tempGenerator = new PDFGenerator(tempDoc, crashData, {});

        // Update loading message (reuse variable from above)
        if (loadingMessage) loadingMessage.textContent = 'Preparing charts...';

        // Wait for charts to be fully rendered using promise-based detection
        await tempGenerator.waitForChartsReady();

        // Collect custom notes
        const notes = [];
        const noteItems = document.querySelectorAll('.pdf-note-item');
        noteItems.forEach(noteItem => {
            const title = noteItem.querySelector('.pdf-note-title-input')?.value || 'Notes';
            const content = noteItem.querySelector('.pdf-note-textarea')?.value || '';
            const position = noteItem.querySelector('.pdf-note-position-select')?.value || 'end';
            if (content.trim()) {
                notes.push({ title, content, position });
            }
        });

        // Collect selected table columns
        const selectedColumns = [];
        document.querySelectorAll('.pdf-table-col-cb:checked').forEach(cb => {
            selectedColumns.push(cb.value);
        });

        // Get chart order from DOM
        const chartOrder = getOrderedChartIds();

        // Get selected options including quality settings
        const options = {
            includeCover: document.getElementById('pdfIncludeCover').checked,
            includeStats: document.getElementById('pdfIncludeStats').checked,
            includeExecutiveSummary: document.getElementById('pdfIncludeExecutiveSummary')?.checked || false,
            includeCharts: document.getElementById('pdfIncludeCharts').checked,
            includeTable: document.getElementById('pdfIncludeTable').checked,
            includeFilters: document.getElementById('pdfIncludeFilters').checked,
            includeMap: document.getElementById('pdfIncludeMap')?.checked || false,
            includeNotes: document.getElementById('pdfIncludeNotes')?.checked || false,
            charts: {
                overTime: document.getElementById('pdfChart1').checked,
                byDay: document.getElementById('pdfChart2').checked,
                byHour: document.getElementById('pdfChart3').checked,
                severity: document.getElementById('pdfChart4').checked,
                crashType: document.getElementById('pdfChart5').checked,
                lga: document.getElementById('pdfChart6').checked,
                weather: document.getElementById('pdfChart7').checked,
                severityTrend: document.getElementById('pdfChart8').checked
            },
            chartOrder: chartOrder,
            tableRows: document.querySelector('input[name="pdfTableRows"]:checked')?.value || '50',
            tableColumns: selectedColumns.length > 0 ? selectedColumns : null,
            orientation: document.querySelector('input[name="pdfOrientation"]:checked')?.value || 'landscape',
            filename: document.getElementById('pdfFilename').value || 'SA_Crash_Report',
            notes: notes,

            // Quality settings - always high quality
            imageQuality: 'high',
            chartScale: PDF_CONFIG.CHART_SCALE_FACTORS['high'],
            smartCompression: true
        };

        // Create PDF document
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: options.orientation,
            unit: PDF_CONFIG.UNIT,
            format: PDF_CONFIG.PAGE_FORMAT
        });

        // Create PDF generator instance
        generator = new PDFGenerator(doc, crashData, options);

        // Set up progress callback for real-time updates
        generator.setProgressCallback((message, step, totalSteps) => {
            const progressPercent = Math.round((step / totalSteps) * 100);

            // Update loading overlay
            const progressBar = document.getElementById('pdfProgressBar');
            const loadingMessage = document.getElementById('pdfLoadingMessage');
            const loadingPercent = document.getElementById('pdfLoadingPercent');

            if (progressBar) progressBar.style.width = progressPercent + '%';
            if (loadingMessage) loadingMessage.textContent = message;
            if (loadingPercent) loadingPercent.textContent = progressPercent + '%';
        });

        // Generate PDF with all sections
        await generator.generate();

        // Save PDF with processed filename (template variables already expanded)
        const processedFilename = processFilenameTemplate(options.filename);
        doc.save(processedFilename + '.pdf');

        // Show success notification
        if (typeof showNotification === 'function') {
            showNotification('PDF report generated successfully!', 'success');
        }

    } catch (error) {
        console.error('Error generating PDF:', error);

        // Show error notification
        showNotification('Failed to generate PDF report. Please try again.', 'error');
    } finally {
        // Always restore chart state and cleanup, whether success or error
        try {
            // Restore chart animations
            if (generator) {
                generator.restoreChartAnimations();
            }

            // Restore panel state
            if (analyticsPanel && wasClosed) {
                analyticsPanel.classList.add('collapsed');
            }

            // Hide loading overlay
            if (loadingOverlay) {
                loadingOverlay.style.display = 'none';
            }
        } catch (cleanupError) {
            console.error('Error during cleanup:', cleanupError);
        }
    }
}
