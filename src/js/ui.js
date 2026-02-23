/**
 * UI Module
 * Handles all UI interactions and DOM manipulation for the CrashMap application
 */

import { TUTORIAL_TABS, TUTORIAL_TAB_CONTENT_MAP, DATA_TABLE } from './config.js';
import { uiState, updateUiState, dataState, cacheState, updateCacheState, searchState, updateSearchState } from './state.js';
import { escapeHtml, escapeCSV } from './utils.js';
import { markFiltersChanged, getFilterValues } from './filters.js';

// ============================================================================
// DISCLAIMER & FIRST VISIT
// ============================================================================

/**
 * Check if this is the user's first visit
 * Shows disclaimer overlay if not previously acknowledged
 */
export function checkFirstVisit() {
    const hasAcknowledged = localStorage.getItem('disclaimerAcknowledged');
    if (!hasAcknowledged) {
        const overlay = document.getElementById('firstVisitOverlay');
        if (overlay) {
            overlay.style.display = 'flex';
        }
    }
}

/**
 * Acknowledge the disclaimer and store in localStorage
 * Also checks if tutorial should be shown
 */
export function acknowledgeDisclaimer() {
    localStorage.setItem('disclaimerAcknowledged', 'true');
    const overlay = document.getElementById('firstVisitOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }

    // Check if tutorial should be shown
    checkTutorial();
}

// ============================================================================
// TUTORIAL FUNCTIONS
// ============================================================================

/**
 * Check if tutorial should be shown
 * Shows tutorial modal if not previously completed
 */
export function checkTutorial() {
    const tutorialCompleted = localStorage.getItem('tutorialCompleted');
    if (!tutorialCompleted) {
        openTutorial();
    }
}

/**
 * Open the tutorial modal
 */
export function openTutorial() {
    const modal = document.getElementById('tutorialModal');
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        // Reset to first tab
        updateUiState({ currentTutorialTab: 'getting-started' });
        switchTutorialTab('getting-started');
    }
}

/**
 * Close the tutorial modal
 */
export function closeTutorial() {
    const modal = document.getElementById('tutorialModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

/**
 * Switch to a specific tutorial tab
 * @param {string} tabName - Tab name to switch to
 */
export function switchTutorialTab(tabName) {
    updateUiState({ currentTutorialTab: tabName });

    // Update tab buttons
    const tabButtons = document.querySelectorAll('#tutorialModal .tab-btn');
    tabButtons.forEach(btn => {
        if (btn.getAttribute('onclick')?.includes(tabName)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Update tab content
    const tabContents = document.querySelectorAll('#tutorialModal .tab-content');
    tabContents.forEach(content => {
        content.classList.remove('active');
    });

    const contentId = TUTORIAL_TAB_CONTENT_MAP[tabName];
    const activeContent = document.getElementById(contentId);
    if (activeContent) {
        activeContent.classList.add('active');
    }

    // Update button states
    updateTutorialButtons();
}

/**
 * Navigate to the next tutorial tab
 */
export function nextTutorialTab() {
    const currentIndex = TUTORIAL_TABS.indexOf(uiState.currentTutorialTab);
    if (currentIndex < TUTORIAL_TABS.length - 1) {
        switchTutorialTab(TUTORIAL_TABS[currentIndex + 1]);
    }
}

/**
 * Navigate to the previous tutorial tab
 */
export function previousTutorialTab() {
    const currentIndex = TUTORIAL_TABS.indexOf(uiState.currentTutorialTab);
    if (currentIndex > 0) {
        switchTutorialTab(TUTORIAL_TABS[currentIndex - 1]);
    }
}

/**
 * Update tutorial navigation button states
 */
export function updateTutorialButtons() {
    const currentIndex = TUTORIAL_TABS.indexOf(uiState.currentTutorialTab);
    const prevBtn = document.querySelector('#tutorialModal .tutorial-nav-buttons .btn-secondary:first-child');
    const nextBtn = document.querySelector('#tutorialModal .tutorial-nav-buttons .btn-secondary:nth-child(2)');

    if (prevBtn) {
        prevBtn.disabled = currentIndex === 0;
    }

    if (nextBtn) {
        if (currentIndex === TUTORIAL_TABS.length - 1) {
            nextBtn.style.display = 'none';
        } else {
            nextBtn.style.display = 'block';
        }
    }
}

/**
 * Update tutorial preference based on checkbox
 */
export function updateTutorialPreference() {
    const checkbox = document.getElementById('dontShowTutorial');
    if (checkbox && checkbox.checked) {
        localStorage.setItem('tutorialCompleted', 'true');
    } else {
        localStorage.removeItem('tutorialCompleted');
    }
}

// ============================================================================
// THEME FUNCTIONS
// ============================================================================

/**
 * Toggle between dark and light theme
 */
export function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    // Update icon
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
        themeIcon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
    }
}

/**
 * Initialize theme from localStorage or default to light
 */
export function initTheme() {
    // Check for saved theme preference or default to light
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Update icon
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
        themeIcon.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
    }
}

// ============================================================================
// PANEL CONTROLS
// ============================================================================

/**
 * Toggle control panel visibility (for mobile)
 */
export function togglePanel() {
    const panel = document.getElementById('controlsPanel');
    if (panel) {
        panel.classList.toggle('visible');
    }
}

/**
 * Toggle panel collapse/expand state
 */
export function togglePanelCollapse() {
    const panel = document.getElementById('controlsPanel');
    const icon = document.getElementById('collapseIcon');

    if (panel) {
        panel.classList.toggle('collapsed');

        // Update icon based on collapsed state
        if (icon) {
            if (panel.classList.contains('collapsed')) {
                icon.textContent = '▼'; // Down arrow when collapsed
            } else {
                icon.textContent = '▲'; // Up arrow when expanded
            }
        }
    }
}

/**
 * Toggle active filters bar collapse/expand
 */
export function toggleActiveFilters() {
    const bar = document.getElementById('activeFiltersBar');
    if (bar) {
        bar.classList.toggle('collapsed');
    }
}

// ============================================================================
// DATA TABLE
// ============================================================================

/**
 * Toggle data table panel visibility
 */
export function toggleDataTable() {
    const panel = document.getElementById('dataTablePanel');
    if (!panel) return;

    if (panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'flex';
        renderDataTable();
    } else {
        panel.style.display = 'none';
    }
}

/**
 * Sort data table by column
 * @param {string} field - Field name to sort by
 */
export function dtSort(field) {
    if (uiState.dtSortField === field) {
        updateUiState({ dtSortAsc: !uiState.dtSortAsc });
    } else {
        updateUiState({ dtSortField: field, dtSortAsc: true });
    }
    updateUiState({ dtCurrentPage: 0 });
    renderDataTable();
}

/**
 * Change data table page
 * @param {number} delta - Page change delta (-1 for previous, +1 for next)
 */
export function dtChangePage(delta) {
    const sorted = getDtSorted();
    const maxPage = Math.max(0, Math.ceil(sorted.length / DATA_TABLE.PAGE_SIZE) - 1);
    const newPage = Math.max(0, Math.min(uiState.dtCurrentPage + delta, maxPage));
    updateUiState({ dtCurrentPage: newPage });
    renderDataTable();
}

/**
 * Get sorted data for data table
 * @returns {Array} Sorted crash data
 */
export function getDtSorted() {
    const data = dataState.filteredData.slice();
    data.sort(function(a, b) {
        let va = a[uiState.dtSortField] ?? '';
        let vb = b[uiState.dtSortField] ?? '';

        // Numeric sort for specific fields
        const numFields = ['Year', 'Total Fats', 'Total SI', 'Total MI', 'Area Speed'];
        if (numFields.includes(uiState.dtSortField)) {
            va = parseFloat(va) || 0;
            vb = parseFloat(vb) || 0;
        } else {
            va = String(va).toLowerCase();
            vb = String(vb).toLowerCase();
        }

        if (va < vb) return uiState.dtSortAsc ? -1 : 1;
        if (va > vb) return uiState.dtSortAsc ? 1 : -1;
        return 0;
    });
    return data;
}

/**
 * Render data table with current page and sort
 */
export function renderDataTable() {
    const tbody = document.getElementById('dataTableBody');
    const info = document.getElementById('dataTableInfo');
    const prevBtn = document.getElementById('dtPrevBtn');
    const nextBtn = document.getElementById('dtNextBtn');
    if (!tbody) return;

    const sorted = getDtSorted();
    const total = sorted.length;
    const maxPage = Math.max(0, Math.ceil(total / DATA_TABLE.PAGE_SIZE) - 1);
    const currentPage = Math.min(uiState.dtCurrentPage, maxPage);
    updateUiState({ dtCurrentPage: currentPage });

    const start = currentPage * DATA_TABLE.PAGE_SIZE;
    const pageRows = sorted.slice(start, start + DATA_TABLE.PAGE_SIZE);

    // Update info text and nav buttons
    if (info) {
        info.textContent = total.toLocaleString() + ' crashes  |  Page ' + (currentPage + 1) + ' of ' + (maxPage + 1);
    }
    if (prevBtn) prevBtn.disabled = currentPage === 0;
    if (nextBtn) nextBtn.disabled = currentPage >= maxPage;

    // Update sort icons in header
    DATA_TABLE.COLUMNS.forEach(function(col) {
        const th = document.getElementById('dt-th-' + col.key.replace(/\s+/g, '_'));
        if (!th) return;
        const icon = th.querySelector('.dt-sort-icon');
        if (!icon) return;

        if (uiState.dtSortField === col.key) {
            icon.textContent = uiState.dtSortAsc ? ' ↑' : ' ↓';
            th.classList.add('dt-active-sort');
        } else {
            icon.textContent = ' ↕';
            th.classList.remove('dt-active-sort');
        }
    });

    // Severity label map
    const sevMap = {
        '1: PDO': '<span class="dt-sev dt-sev-pdo">PDO</span>',
        '2: MI': '<span class="dt-sev dt-sev-mi">MI</span>',
        '3: SI': '<span class="dt-sev dt-sev-si">SI</span>',
        '4: Fatal': '<span class="dt-sev dt-sev-fatal">Fatal</span>'
    };

    tbody.innerHTML = pageRows.map(function(row) {
        const sev = row['CSEF Severity'] || '';
        const sevCell = sevMap[sev] || escapeHtml(sev);
        const speed = row['Area Speed'] ? row['Area Speed'] + ' km/h' : '';
        const fats = parseInt(row['Total Fats']) || 0;
        const si = parseInt(row['Total SI']) || 0;
        const mi = parseInt(row['Total MI']) || 0;

        return '<tr>' +
            '<td>' + escapeHtml(String(row['Year'] || '')) + '</td>' +
            '<td>' + escapeHtml(String(row['Crash Date Time'] || '')) + '</td>' +
            '<td>' + escapeHtml(String(row['Suburb'] || '')) + '</td>' +
            '<td>' + escapeHtml(String(row['LGA'] || '')) + '</td>' +
            '<td>' + sevCell + '</td>' +
            '<td>' + escapeHtml(String(row['Crash Type'] || '')) + '</td>' +
            '<td>' + escapeHtml(speed) + '</td>' +
            '<td class="dt-num">' + (fats > 0 ? '<strong>' + fats + '</strong>' : '–') + '</td>' +
            '<td class="dt-num">' + (si > 0 ? si : '–') + '</td>' +
            '<td class="dt-num">' + (mi > 0 ? mi : '–') + '</td>' +
            '</tr>';
    }).join('');
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

/**
 * Export filtered crash data to CSV with metadata
 */
export function exportFilteredData() {
    if (!dataState.filteredData || dataState.filteredData.length === 0) {
        alert('No data to export. Please apply filters first.');
        return;
    }

    // Create CSV content
    let csv = '';

    // Add export metadata
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const totalCrashes = dataState.filteredData.length;

    // Count casualties
    let totalFatalities = 0;
    let totalSerious = 0;
    let totalMinor = 0;
    let totalCasualties = 0;

    dataState.filteredData.forEach(crash => {
        const casualties = crash._casualties || [];
        totalCasualties += casualties.length;
        casualties.forEach(c => {
            const injury = c['Injury Extent'];
            if (injury === 'Fatal') totalFatalities++;
            else if (injury === 'Serious injury') totalSerious++;
            else if (injury === 'Minor injury') totalMinor++;
        });
    });

    // Add summary header
    csv += `SA Crash Data Export\n`;
    csv += `Generated: ${new Date().toLocaleString()}\n`;
    csv += `Total Crashes: ${totalCrashes}\n`;
    csv += `Total Casualties: ${totalCasualties}\n`;
    csv += `Fatalities: ${totalFatalities}\n`;
    csv += `Serious Injuries: ${totalSerious}\n`;
    csv += `Minor Injuries: ${totalMinor}\n`;
    csv += `\n`;

    // Add active filters summary
    const filters = getFilterValues();
    csv += `Active Filters:\n`;
    if (filters.yearFrom !== 2012 || filters.yearTo !== 2024) {
        csv += `Year Range: ${filters.yearFrom} - ${filters.yearTo}\n`;
    }
    if (!filters.selectedSeverities.includes('all')) {
        csv += `Severity: ${filters.selectedSeverities.join(', ')}\n`;
    }
    if (!filters.selectedCrashTypes.includes('all')) {
        csv += `Crash Type: ${filters.selectedCrashTypes.join(', ')}\n`;
    }
    if (filters.weather !== 'all') {
        csv += `Weather: ${filters.weather}\n`;
    }
    if (filters.dayNight !== 'all') {
        csv += `Day/Night: ${filters.dayNight}\n`;
    }
    if (filters.duiInvolved !== 'all') {
        csv += `DUI Involved: ${filters.duiInvolved}\n`;
    }
    if (filters.drugsInvolved !== 'all') {
        csv += `Drugs Involved: ${filters.drugsInvolved}\n`;
    }
    if (!filters.selectedAreas.includes('all')) {
        csv += `LGA: ${filters.selectedAreas.slice(0, 5).join(', ')}${filters.selectedAreas.length > 5 ? '...' : ''}\n`;
    }
    if (!filters.selectedSuburbs.includes('all')) {
        csv += `Suburbs: ${filters.selectedSuburbs.slice(0, 5).join(', ')}${filters.selectedSuburbs.length > 5 ? '...' : ''}\n`;
    }
    csv += `\n`;

    // Column headers
    const headers = [
        'Report ID',
        'Date',
        'Time',
        'Severity',
        'Crash Type',
        'LGA',
        'Suburb',
        'Postcode',
        'Speed Limit (km/h)',
        'Weather',
        'Day/Night',
        'Road Surface',
        'Moisture',
        'DUI Involved',
        'Drugs Involved',
        'Total Casualties',
        'Fatalities',
        'Serious Injuries',
        'Minor Injuries',
        'Total Units',
        'Latitude',
        'Longitude'
    ];

    csv += headers.join(',') + '\n';

    // Add data rows
    dataState.filteredData.forEach(crash => {
        const casualties = crash._casualties || [];
        const units = crash._units || [];

        // Count casualties by severity
        let fatal = 0, serious = 0, minor = 0;
        casualties.forEach(c => {
            const injury = c['Injury Extent'];
            if (injury === 'Fatal') fatal++;
            else if (injury === 'Serious injury') serious++;
            else if (injury === 'Minor injury') minor++;
        });

        const coords = crash._coords || [null, null];

        const row = [
            escapeCSV(crash['Report ID'] || ''),
            escapeCSV(crash['Crash Date'] || ''),
            escapeCSV(crash['Crash Time'] || ''),
            escapeCSV(crash['CSEF Severity'] || ''),
            escapeCSV(crash['Crash Type'] || ''),
            escapeCSV(crash['LGA'] || ''),
            escapeCSV(crash['Suburb'] || ''),
            escapeCSV(crash['Postcode'] || ''),
            escapeCSV(crash['Area Speed'] || ''),
            escapeCSV(crash['Weather Cond'] || ''),
            escapeCSV(crash['DayNight'] || ''),
            escapeCSV(crash['Road Surface'] || ''),
            escapeCSV(crash['Moisture Cond'] || ''),
            escapeCSV(crash['DUI Involved'] || 'No'),
            escapeCSV(crash['Drugs Involved'] || 'No'),
            casualties.length,
            fatal,
            serious,
            minor,
            units.length,
            coords[0] || '',
            coords[1] || ''
        ];

        csv += row.join(',') + '\n';
    });

    // Create download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `SA_Crash_Data_Export_${timestamp}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ============================================================================
// MULTI-SELECT ENHANCEMENTS
// ============================================================================

/**
 * Enhance a multi-select element with controls and chips
 * @param {string} selectId - ID of the select element
 * @param {boolean} showChips - Whether to show chips for selected items
 */
export function enhanceMultiSelect(selectId, showChips = true) {
    const selectElement = document.getElementById(selectId);
    if (!selectElement || !selectElement.multiple) return;

    const filterGroup = selectElement.closest('.filter-group');
    if (!filterGroup) return;

    // Create controls container
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'multi-select-controls';
    controlsDiv.innerHTML = `
        <span class="multi-select-count" id="${selectId}-count">0 selected</span>
        <div class="multi-select-buttons">
            <button class="select-all-btn" onclick="selectAllOptions('${selectId}')">All</button>
            <button class="clear-selection-btn" onclick="clearAllOptions('${selectId}')">Clear</button>
        </div>
    `;

    // Insert controls before the select element
    selectElement.parentNode.insertBefore(controlsDiv, selectElement);

    // Create chips container if requested
    if (showChips) {
        const chipsDiv = document.createElement('div');
        chipsDiv.className = 'selected-chips';
        chipsDiv.id = `${selectId}-chips`;
        selectElement.parentNode.insertBefore(chipsDiv, selectElement.nextSibling);
    }

    // Add change listener to update count and chips
    selectElement.addEventListener('change', () => {
        updateMultiSelectDisplay(selectId, showChips);
        markFiltersChanged();
    });

    // Initial update
    updateMultiSelectDisplay(selectId, showChips);
}

/**
 * Update the count and chips display for a multi-select
 * @param {string} selectId - ID of the select element
 * @param {boolean} showChips - Whether to show chips
 */
export function updateMultiSelectDisplay(selectId, showChips = true) {
    const selectElement = document.getElementById(selectId);
    if (!selectElement) return;

    const selectedOptions = Array.from(selectElement.selectedOptions);
    const countElement = document.getElementById(`${selectId}-count`);
    const chipsContainer = document.getElementById(`${selectId}-chips`);

    // Filter out "all" option from count
    const nonAllSelected = selectedOptions.filter(opt => opt.value !== 'all');
    const count = nonAllSelected.length;
    const total = Array.from(selectElement.options).filter(opt => opt.value !== 'all').length;

    // Update count
    if (countElement) {
        if (count === 0 || selectedOptions.some(opt => opt.value === 'all')) {
            countElement.textContent = 'All selected';
        } else {
            countElement.textContent = `${count} of ${total} selected`;
        }
    }

    // Update chips
    if (showChips && chipsContainer) {
        chipsContainer.innerHTML = '';

        if (count > 0 && count <= 5 && !selectedOptions.some(opt => opt.value === 'all')) {
            nonAllSelected.forEach(option => {
                const chip = document.createElement('span');
                chip.className = 'chip';
                chip.innerHTML = `
                    ${option.text}
                    <span class="chip-remove" onclick="removeChip('${selectId}', '${option.value.replace(/'/g, "\\'")}')">×</span>
                `;
                chipsContainer.appendChild(chip);
            });
        } else if (count > 5) {
            const chip = document.createElement('span');
            chip.className = 'chip';
            chip.textContent = `${count} items selected`;
            chipsContainer.appendChild(chip);
        }
    }
}

/**
 * Select all options in a multi-select
 * @param {string} selectId - ID of the select element
 */
export function selectAllOptions(selectId) {
    const selectElement = document.getElementById(selectId);
    if (!selectElement) return;

    Array.from(selectElement.options).forEach(option => {
        if (option.value === 'all') {
            option.selected = true;
        } else {
            option.selected = false;
        }
    });

    selectElement.dispatchEvent(new Event('change'));
}

/**
 * Clear all selections in a multi-select
 * @param {string} selectId - ID of the select element
 */
export function clearAllOptions(selectId) {
    const selectElement = document.getElementById(selectId);
    if (!selectElement) return;

    Array.from(selectElement.options).forEach(option => {
        option.selected = false;
    });

    // Select "all" by default
    const allOption = Array.from(selectElement.options).find(opt => opt.value === 'all');
    if (allOption) allOption.selected = true;

    selectElement.dispatchEvent(new Event('change'));
}

/**
 * Remove a chip (deselect an option)
 * @param {string} selectId - ID of the select element
 * @param {string} value - Value to deselect
 */
export function removeChip(selectId, value) {
    const selectElement = document.getElementById(selectId);
    if (!selectElement) return;

    Array.from(selectElement.options).forEach(option => {
        if (option.value === value) {
            option.selected = false;
        }
    });

    // If nothing selected, select "all"
    const hasSelection = Array.from(selectElement.selectedOptions).some(opt => opt.value !== 'all');
    if (!hasSelection) {
        const allOption = Array.from(selectElement.options).find(opt => opt.value === 'all');
        if (allOption) allOption.selected = true;
    }

    selectElement.dispatchEvent(new Event('change'));
}

/**
 * Add search functionality for the area select
 */
export function addAreaSearch() {
    const areaSelect = document.getElementById('area');
    if (!areaSelect) return;

    const filterGroup = areaSelect.closest('.filter-group');
    if (!filterGroup) return;

    // Create search box
    const searchBox = document.createElement('div');
    searchBox.className = 'area-search-box';
    searchBox.innerHTML = `
        <input type="text"
               class="area-search-input"
               id="area-search"
               placeholder="🔍 Search areas..."
               oninput="filterAreaOptions(this.value)">
    `;

    // Insert before the select element
    areaSelect.parentNode.insertBefore(searchBox, areaSelect);

    // Store original options
    const options = Array.from(areaSelect.options);
    const originalOptionVisibility = new Map();
    originalOptionVisibility.set('area', options.map(opt => ({
        element: opt,
        text: opt.text,
        value: opt.value
    })));
    updateCacheState({ originalOptionVisibility });
}

/**
 * Filter area options based on search
 * @param {string} searchText - Search text
 */
export function filterAreaOptions(searchText) {
    const areaSelect = document.getElementById('area');
    if (!areaSelect) return;

    const originalOptions = cacheState.originalOptionVisibility.get('area');
    if (!originalOptions) return;

    const search = searchText.toLowerCase().trim();

    originalOptions.forEach(optData => {
        const matches = search === '' ||
            optData.value === 'all' ||
            optData.text.toLowerCase().includes(search);
        optData.element.style.display = matches ? '' : 'none';
    });
}

/**
 * Initialize all multi-select enhancements
 */
export function initMultiSelectEnhancements() {
    // Enhance all multi-selects
    const multiSelects = [
        { id: 'severity', chips: true },
        { id: 'area', chips: false }, // Too many to show chips
        { id: 'suburb', chips: false }, // Too many to show chips
        { id: 'roadSurface', chips: true },
        { id: 'moistureCond', chips: true },
        { id: 'roadUserType', chips: true },
        { id: 'ageGroup', chips: true },
        { id: 'casualtySex', chips: true },
        { id: 'injuryExtent', chips: true },
        { id: 'seatBelt', chips: true },
        { id: 'helmet', chips: true },
        { id: 'vehicleType', chips: true },
        { id: 'vehicleYear', chips: true },
        { id: 'occupants', chips: true },
        { id: 'licenseType', chips: true },
        { id: 'vehRegState', chips: true },
        { id: 'directionTravel', chips: true },
        { id: 'unitMovement', chips: true }
    ];

    multiSelects.forEach(({ id, chips }) => {
        enhanceMultiSelect(id, chips);
    });

    // Add area search
    addAreaSearch();
}

// ============================================================================
// LOCATION SEARCH (UI PARTS)
// ============================================================================

/**
 * Handle keyboard navigation in location suggestions
 * @param {KeyboardEvent} event - Keyboard event
 */
export function handleLocationKeydown(event) {
    const suggestionsDiv = document.getElementById('locationSuggestions');

    if (!suggestionsDiv || !suggestionsDiv.classList.contains('show')) {
        return;
    }

    const items = suggestionsDiv.querySelectorAll('.suggestion-item');

    if (event.key === 'ArrowDown') {
        event.preventDefault();
        const newIndex = Math.min(searchState.selectedSuggestionIndex + 1, items.length - 1);
        updateSearchState({ selectedSuggestionIndex: newIndex });
        updateSelectedSuggestion(items);
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        const newIndex = Math.max(searchState.selectedSuggestionIndex - 1, -1);
        updateSearchState({ selectedSuggestionIndex: newIndex });
        updateSelectedSuggestion(items);
    } else if (event.key === 'Enter') {
        event.preventDefault();
        if (searchState.selectedSuggestionIndex >= 0 && items[searchState.selectedSuggestionIndex]) {
            const locationName = searchState.currentSuggestions[searchState.selectedSuggestionIndex].name;
            // Note: selectSuggestion is in map-renderer.js
            if (window.selectSuggestion) {
                window.selectSuggestion(locationName);
            }
        } else {
            // Just trigger search with current input
            if (window.searchByLocation) {
                window.searchByLocation();
            }
        }
    } else if (event.key === 'Escape') {
        suggestionsDiv.classList.remove('show');
        updateSearchState({ selectedSuggestionIndex: -1 });
    }
}

/**
 * Update visual selection in suggestions
 * @param {NodeList} items - Suggestion items
 */
export function updateSelectedSuggestion(items) {
    items.forEach((item, index) => {
        if (index === searchState.selectedSuggestionIndex) {
            item.classList.add('selected');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('selected');
        }
    });
}

// ============================================================================
// INITIALIZATION & EVENT LISTENERS
// ============================================================================

/**
 * Initialize UI components
 */
export function initUI() {
    // Initialize theme
    initTheme();

    // Check first visit on page load
    checkFirstVisit();

    // Close tutorial modal when clicking outside
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('tutorialModal');
        if (event.target === modal) {
            closeTutorial();
        }
    });

    // Close location suggestions when clicking outside
    document.addEventListener('click', function(event) {
        const suggestionsDiv = document.getElementById('locationSuggestions');
        const input = document.getElementById('locationSearch');

        if (suggestionsDiv && input &&
            !suggestionsDiv.contains(event.target) &&
            event.target !== input) {
            suggestionsDiv.classList.remove('show');
            updateSearchState({ selectedSuggestionIndex: -1 });
        }
    });
}

// Export constants for use in HTML onclick handlers
export const TUTORIAL_TABS_EXPORT = TUTORIAL_TABS;
export const DATA_TABLE_EXPORT = DATA_TABLE;
