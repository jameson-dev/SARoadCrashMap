/**
 * Filter Management Module
 * Handles all filter-related functionality including:
 * - Filter state tracking and comparison
 * - Filter population and UI updates
 * - Filter application and matching logic
 * - URL state management
 * - Active filters display
 * - Advanced filters modal
 * - Year range slider
 * - Filter presets
 */

import { YEAR_RANGE, SEVERITY_COLORS, HEAVY_VEHICLE_TYPES, FILTER_PRESETS } from './config.js';
import {
    dataState,
    filterState,
    drawState,
    updateFilterState
} from './state.js';
import { updateStatistics } from './analytics.js';
import { showLoading, hideLoading, updateLoadingMessage, uniqueValues, showFilterNotification } from './utils.js';
import { showNotification } from './ui.js';
import { debounce } from './performance.js';
import { updateMapLayers } from './map-renderer.js';

// Module-level variables
let yearRangeSlider = null;
let currentYearRange = [...YEAR_RANGE.DEFAULT];
let _filterRunning = false;
let _filterPending = false;

// Web Worker for off-thread filtering
let _filterWorker = null;
let _workerReady = false;
let _workerRequestId = 0;

// ============================================================================
// FILTER STATE & TRACKING
// ============================================================================

/**
 * Capture the current state of all filters
 * @returns {Object} Snapshot of all filter values
 */
export function captureCurrentFilterState() {
    const state = {
        yearRange: currentYearRange ? [...currentYearRange] : [...YEAR_RANGE.DEFAULT],
        severities: getCheckboxValues('severityMenu'),
        crashTypes: getCheckboxValues('crashTypeMenu'),
        areas: getCheckboxValues('areaMenu'),
        suburbs: getCheckboxValues('suburbMenu'),
        weather: document.getElementById('weather')?.value || 'all',
        dayNight: document.getElementById('dayNight')?.value || 'all',
        timeFrom: document.getElementById('timeFrom')?.value || '',
        timeTo: document.getElementById('timeTo')?.value || '',
        dateFrom: document.getElementById('dateFrom')?.value || '',
        dateTo: document.getElementById('dateTo')?.value || '',
        duiInvolved: document.getElementById('duiInvolved')?.value || 'all',
        drugsInvolved: document.getElementById('drugsInvolved')?.value || 'all',
        roadSurface: getSelectValues('roadSurface'),
        moistureCond: getSelectValues('moistureCond'),
        speedZone: getSelectValues('speedZoneFilter'),
        month: getSelectValues('monthFilter'),
        roadUserType: getSelectValues('roadUserType'),
        ageGroup: getSelectValues('ageGroup'),
        casualtySex: getSelectValues('casualtySex'),
        injuryExtent: getSelectValues('injuryExtent'),
        seatBelt: getSelectValues('seatBelt'),
        helmet: getSelectValues('helmet'),
        heavyVehicle: document.getElementById('heavyVehicle')?.value || 'all',
        vehicleType: getSelectValues('vehicleType'),
        vehicleYear: getSelectValues('vehicleYear'),
        occupants: getSelectValues('occupants'),
        towing: document.getElementById('towing')?.value || 'all',
        rollover: document.getElementById('rollover')?.value || 'all',
        fire: document.getElementById('fire')?.value || 'all',
        licenseType: getSelectValues('licenseType'),
        vehRegState: getSelectValues('vehRegState'),
        directionTravel: getSelectValues('directionTravel'),
        unitMovement: getSelectValues('unitMovement'),
        // Capture draw area state for proper change detection
        drawnArea: drawState.drawnLayer ? JSON.stringify(drawState.drawnLayer.toGeoJSON()) : null
    };
    return state;
}

/**
 * Apply filters with caching
 * Returns cached results if the same filters were used before
 * @param {Array} crashData - Full crash dataset
 * @param {Object} filters - Filter values
 * @returns {Array} Filtered crash data
 */
/**
 * Get checked values from a checkbox menu
 * @param {string} menuId - ID of the checkbox menu element
 * @returns {Array<string>} Array of checked values, sorted
 */
export function getCheckboxValues(menuId) {
    const menu = document.getElementById(menuId);
    if (!menu) return [];
    const checkboxes = menu.querySelectorAll('input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value).sort();
}

/**
 * Get selected values from a multi-select element
 * @param {string} selectId - ID of the select element
 * @returns {Array<string>} Array of selected values, sorted, or ['all'] if empty
 */
export function getSelectValues(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return ['all'];
    const selected = Array.from(select.selectedOptions).map(opt => opt.value);
    return selected.length > 0 ? selected.sort() : ['all'];
}

/**
 * Deep equality comparison for filter states
 * More efficient than JSON.stringify for large objects
 * @param {Object} state1 - First filter state
 * @param {Object} state2 - Second filter state
 * @returns {boolean} True if states differ, false otherwise
 */
export function compareFilterStates(state1, state2) {
    if (!state1 || !state2) return false;

    // Check if they're the same reference
    if (state1 === state2) return false;

    // Get keys from both objects
    const keys1 = Object.keys(state1);
    const keys2 = Object.keys(state2);

    // Different number of keys means they're different
    if (keys1.length !== keys2.length) return true;

    // Compare each key-value pair
    for (const key of keys1) {
        const val1 = state1[key];
        const val2 = state2[key];

        // Handle arrays (like year range, multi-selects)
        if (Array.isArray(val1) && Array.isArray(val2)) {
            if (val1.length !== val2.length) return true;
            for (let i = 0; i < val1.length; i++) {
                if (val1[i] !== val2[i]) return true;
            }
            continue;
        }

        // Handle primitives
        if (val1 !== val2) return true;
    }

    return false; // No differences found
}

/**
 * Mark filters as changed and update Apply button state
 */
export function markFiltersChanged() {
    const currentState = captureCurrentFilterState();
    const hasChanged = compareFilterStates(currentState, filterState.lastAppliedFilterState);

    updateFilterState({ filtersChanged: hasChanged });
    updateApplyButtonState();
}

/**
 * Update the Apply Filters button state based on whether filters have changed
 */
export function updateApplyButtonState() {
    const applyBtn = document.getElementById('applyFilters');
    if (!applyBtn) return;

    if (filterState.filtersChanged) {
        applyBtn.disabled = false;
        applyBtn.style.opacity = '1';
        applyBtn.style.cursor = 'pointer';
        applyBtn.title = 'Apply the current filter selections';
    } else {
        applyBtn.disabled = true;
        applyBtn.style.opacity = '0.5';
        applyBtn.style.cursor = 'not-allowed';
        applyBtn.title = 'No filter changes to apply';
    }
}

// ============================================================================
// FILTER POPULATION
// ============================================================================


/**
 * Append option elements to a select element
 * @param {string} elementId - ID of select element
 * @param {Array} items - Array of items to add as options
 */
export function populateSelect(elementId, items) {
    const el = document.getElementById(elementId);
    if (!el) return;
    items.forEach(item => {
        const opt = document.createElement('option');
        opt.value = opt.textContent = item;
        el.appendChild(opt);
    });
}

/**
 * Build a searchable checkbox dropdown with search bar, scrollable list, and Select/Clear All buttons
 * @param {string} id - Base ID for the dropdown
 * @param {Array} items - Array of items to populate
 */
export function buildCheckboxDropdown(id, items) {
    const menu = document.getElementById(`${id}Menu`);
    if (!menu) return;

    const searchWrap = document.createElement('div');
    searchWrap.className = 'dropdown-search-wrap';
    searchWrap.innerHTML = `<input type="text" class="dropdown-search" placeholder="Search..." oninput="filterDropdownItems('${id}', this.value)">`;
    menu.appendChild(searchWrap);

    const list = document.createElement('div');
    list.className = 'dropdown-items-list';
    list.id = `${id}ItemsList`;
    items.forEach((item, i) => {
        const row = document.createElement('div');
        row.className = 'checkbox-dropdown-item';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = `${id}-${i}`;
        cb.value = item;
        cb.checked = true;
        cb.onchange = () => updateCheckboxDropdownDisplay(id);
        const lbl = document.createElement('label');
        lbl.htmlFor = cb.id;
        lbl.textContent = item;
        row.appendChild(cb);
        row.appendChild(lbl);
        list.appendChild(row);
    });
    menu.appendChild(list);

    const controls = document.createElement('div');
    controls.className = 'checkbox-dropdown-controls';
    controls.innerHTML = `
        <button class="checkbox-select-all" onclick="selectAllDropdownItems('${id}')" aria-label="Select all items">Select All</button>
        <button class="checkbox-clear-all" onclick="clearAllDropdownItems('${id}')" aria-label="Clear all items">Clear All</button>
    `;
    menu.appendChild(controls);
}

/**
 * Update the display text for a checkbox dropdown based on selections
 * @param {string} dropdownId - Base ID of the dropdown
 */
export function updateCheckboxDropdownDisplay(dropdownId, skipMarkChanged = false) {
    const menu = document.getElementById(`${dropdownId}Menu`);
    const display = document.getElementById(`${dropdownId}Display`);

    if (!menu || !display) return;

    const checkboxes = menu.querySelectorAll('input[type="checkbox"]:checked');
    const totalCheckboxes = menu.querySelectorAll('input[type="checkbox"]');

    if (checkboxes.length === 0 || checkboxes.length === totalCheckboxes.length) {
        if (dropdownId === 'crashType') {
            display.textContent = 'All Types';
        } else if (dropdownId === 'area') {
            display.textContent = 'All Areas';
        } else if (dropdownId === 'severity') {
            display.textContent = 'All Severities';
        } else if (dropdownId === 'suburb') {
            display.textContent = 'All Suburbs';
        }
    } else if (checkboxes.length === 1) {
        display.textContent = checkboxes[0].nextElementSibling.textContent;
    } else {
        display.textContent = `${checkboxes.length} selected`;
    }

    if (!skipMarkChanged) {
        markFiltersChanged();
    }
}

/**
 * Populate all filter dropdowns from loaded data
 */
export function populateFilterOptions() {
    // Searchable checkbox dropdowns
    buildCheckboxDropdown('crashType', uniqueValues(dataState.crashData, 'Crash Type'));
    buildCheckboxDropdown('area', uniqueValues(dataState.crashData, 'LGA'));
    buildCheckboxDropdown('suburb', uniqueValues(dataState.crashData, 'Suburb'));

    // Simple select dropdowns
    populateSelect('weather', uniqueValues(dataState.crashData, 'Weather Cond'));
    populateSelect('roadUserType', uniqueValues(dataState.casualtyData, 'Casualty Type'));
    populateSelect('vehicleType', uniqueValues(dataState.unitsData, 'Unit Type'));
    populateSelect('roadSurface', uniqueValues(dataState.crashData, 'Road Surface'));
    populateSelect('moistureCond', uniqueValues(dataState.crashData, 'Moisture Cond'));
    populateSelect('licenseType', uniqueValues(dataState.unitsData, 'Licence Type'));
    populateSelect('vehRegState', uniqueValues(dataState.unitsData, 'Veh Reg State'));
    populateSelect('directionTravel', uniqueValues(dataState.unitsData, 'Direction Of Travel'));
    populateSelect('unitMovement', uniqueValues(dataState.unitsData, 'Unit Movement'));

    // Speed zone filter - sort numerically
    const speedValues = uniqueValues(dataState.crashData, 'Area Speed').sort((a, b) => parseInt(a) - parseInt(b));
    populateSelect('speedZoneFilter', speedValues);
}

// ============================================================================
// FILTER GETTERS
// ============================================================================

/**
 * Get selected values from a multi-select or checkbox dropdown
 * @param {string} elementId - ID of the element
 * @returns {Array<string>} Array of selected values, or ['all'] if none/all selected
 */
export function getSelectedValues(elementId) {
    // Check if it's a checkbox dropdown
    const menu = document.getElementById(`${elementId}Menu`);
    if (menu) {
        const checkboxes = menu.querySelectorAll('input[type="checkbox"]:checked');
        const totalCheckboxes = menu.querySelectorAll('input[type="checkbox"]');
        if (checkboxes.length === 0 || checkboxes.length === totalCheckboxes.length) {
            return ['all'];
        }
        return Array.from(checkboxes).map(cb => cb.value);
    }

    // Fall back to regular multi-select element
    const element = document.getElementById(elementId);
    if (!element) return ['all'];
    const selected = Array.from(element.selectedOptions).map(opt => opt.value);

    if (selected.length === 0) return ['all'];
    if (selected.includes('all') && selected.length > 1) {
        return selected.filter(v => v !== 'all');
    }

    return selected;
}

/**
 * Get value from a single-select element or checkbox dropdown
 * @param {string} elementId - ID of the element
 * @param {string} defaultValue - Default value if element not found
 * @returns {string} Selected value
 */
export function getValue(elementId, defaultValue = 'all') {
    // Check if it's a checkbox dropdown
    const menu = document.getElementById(`${elementId}Menu`);
    if (menu) {
        const checkboxes = menu.querySelectorAll('input[type="checkbox"]:checked');
        const allCheckboxes = menu.querySelectorAll('input[type="checkbox"]');

        if (checkboxes.length === 0 || checkboxes.length === allCheckboxes.length) {
            return 'all';
        }
        if (checkboxes.length === 1) {
            return checkboxes[0].value;
        }
        return 'multiple';
    }

    // Fall back to regular select element
    const element = document.getElementById(elementId);
    return element ? element.value : defaultValue;
}

/**
 * Get all filter values from the DOM
 * @returns {Object} Object containing all current filter values
 */
export function getFilterValues() {
    return {
        // Year range
        yearFrom: currentYearRange[0],
        yearTo: currentYearRange[1],

        // Basic filters
        selectedSeverities: getSelectedValues('severity'),
        crashType: getValue('crashType'),
        selectedCrashTypes: getSelectedValues('crashType'),
        weather: getValue('weather'),
        dayNight: getValue('dayNight'),
        duiInvolved: getValue('duiInvolved'),
        selectedAreas: getSelectedValues('area'),
        selectedSuburbs: getSelectedValues('suburb'),

        // Date and time
        dateFrom: getValue('dateFrom', ''),
        dateTo: getValue('dateTo', ''),
        timeFrom: getValue('timeFrom', ''),
        timeTo: getValue('timeTo', ''),

        // Casualty filters
        selectedRoadUsers: getSelectedValues('roadUserType'),
        selectedAgeGroups: getSelectedValues('ageGroup'),
        selectedSexes: getSelectedValues('casualtySex'),
        selectedInjuries: getSelectedValues('injuryExtent'),
        selectedSeatBelts: getSelectedValues('seatBelt'),
        selectedHelmets: getSelectedValues('helmet'),

        // Vehicle/Units filters
        heavyVehicle: getValue('heavyVehicle'),
        selectedVehicles: getSelectedValues('vehicleType'),
        selectedVehicleYears: getSelectedValues('vehicleYear'),
        selectedOccupants: getSelectedValues('occupants'),
        towing: getValue('towing'),
        rollover: getValue('rollover'),
        fire: getValue('fire'),
        selectedLicenseTypes: getSelectedValues('licenseType'),
        selectedRegStates: getSelectedValues('vehRegState'),
        selectedDirections: getSelectedValues('directionTravel'),
        selectedMovements: getSelectedValues('unitMovement'),

        // Crash conditions
        selectedRoadSurfaces: getSelectedValues('roadSurface'),
        selectedMoistureConds: getSelectedValues('moistureCond'),
        drugsInvolved: getValue('drugsInvolved'),

        // New filters
        selectedSpeedZones: getSelectedValues('speedZoneFilter'),
        selectedMonths: getSelectedValues('monthFilter')
    };
}

// ============================================================================
// FILTER MATCHING
// ============================================================================

/**
 * Check if a crash matches basic filters
 * @param {Object} row - Crash data row
 * @param {Object} filters - Filter values object
 * @returns {boolean} True if crash matches all basic filters
 */
export function matchesBasicFilters(row, filters) {
    const year = parseInt(row.Year);
    const severity = row['CSEF Severity'];

    // Year filter
    if (year < filters.yearFrom || year > filters.yearTo) return false;

    // Severity filter
    if (!filters.selectedSeverities.includes('all') && !filters.selectedSeverities.includes(severity)) {
        return false;
    }

    // Crash type filter - handle both single and multiple selections
    if (!filters.selectedCrashTypes.includes('all') && !filters.selectedCrashTypes.includes(row['Crash Type'])) {
        return false;
    }

    // Weather filter
    if (filters.weather !== 'all' && row['Weather Cond'] !== filters.weather) return false;

    // Day/Night filter
    if (filters.dayNight !== 'all' && row.DayNight !== filters.dayNight) return false;

    // DUI filter
    if (filters.duiInvolved !== 'all') {
        const duiValue = row['DUI Involved'] ? row['DUI Involved'].trim() : '';
        if (filters.duiInvolved === 'Yes' && duiValue !== 'Y') return false;
        if (filters.duiInvolved === 'No' && duiValue === 'Y') return false;
    }

    // Drugs filter
    if (filters.drugsInvolved !== 'all') {
        const drugsValue = row['Drugs Involved'] ? row['Drugs Involved'].trim() : '';
        if (filters.drugsInvolved === 'Yes' && drugsValue !== 'Y') return false;
        if (filters.drugsInvolved === 'No' && drugsValue === 'Y') return false;
    }

    // Area filter (using pre-computed LGA)
    if (!filters.selectedAreas.includes('all') && !filters.selectedAreas.includes(row['LGA'])) {
        return false;
    }

    // Suburb filter
    if (!filters.selectedSuburbs.includes('all') && !filters.selectedSuburbs.includes(row.Suburb)) {
        return false;
    }

    // Road Surface filter
    if (!filters.selectedRoadSurfaces.includes('all')) {
        if (!filters.selectedRoadSurfaces.includes(row['Road Surface'])) return false;
    }

    // Moisture Condition filter
    if (!filters.selectedMoistureConds.includes('all')) {
        if (!filters.selectedMoistureConds.includes(row['Moisture Cond'])) return false;
    }

    // Speed zone filter
    if (filters.selectedSpeedZones && !filters.selectedSpeedZones.includes('all')) {
        const speed = (row['Area Speed'] || '').trim();
        if (!filters.selectedSpeedZones.includes(speed)) return false;
    }

    // Month-of-year filter
    if (filters.selectedMonths && !filters.selectedMonths.includes('all')) {
        const dt = row['Crash Date Time'];
        if (!dt) return false;
        const datePart = dt.split(' ')[0];
        const dp = datePart ? datePart.split('/') : [];
        if (dp.length < 2) return false;
        const month = String(parseInt(dp[1]));
        if (!filters.selectedMonths.includes(month)) return false;
    }

    // Draw area filter - point-in-polygon using pre-cached coords + Turf.js
    if (drawState.drawnLayer) {
        const coords = row._coords;
        if (!coords) return false;
        const pt = turf.point([coords[1], coords[0]]); // Turf: [lng, lat]
        const poly = drawState.drawnLayer.toGeoJSON();
        if (!turf.booleanPointInPolygon(pt, poly)) return false;
    }

    return true;
}

/**
 * Check if a crash matches date/time filters
 * @param {Object} row - Crash data row
 * @param {Object} filters - Filter values object
 * @returns {boolean} True if crash matches date/time filters
 */
export function matchesDateTimeFilters(row, filters) {
    const crashDateTime = row['Crash Date Time'];
    if (!crashDateTime) return filters.dateFrom || filters.dateTo || filters.timeFrom || filters.timeTo ? false : true;

    const parts = crashDateTime.split(' ');

    // Date filter
    if (filters.dateFrom || filters.dateTo) {
        if (parts.length >= 1) {
            const dateParts = parts[0].split('/');
            if (dateParts.length === 3) {
                const crashDate = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
                if (filters.dateFrom && crashDate < filters.dateFrom) return false;
                if (filters.dateTo && crashDate > filters.dateTo) return false;
            } else {
                return false;
            }
        } else {
            return false;
        }
    }

    // Time filter
    if (filters.timeFrom || filters.timeTo) {
        if (parts.length >= 2) {
            const crashTime = parts[1];
            if (filters.timeFrom && filters.timeTo) {
                if (filters.timeFrom <= filters.timeTo) {
                    // Normal range (e.g., 08:00 to 17:00)
                    if (crashTime < filters.timeFrom || crashTime > filters.timeTo) return false;
                } else {
                    // Crosses midnight (e.g., 22:00 to 02:00)
                    if (crashTime < filters.timeFrom && crashTime > filters.timeTo) return false;
                }
            } else if (filters.timeFrom) {
                if (crashTime < filters.timeFrom) return false;
            } else if (filters.timeTo) {
                if (crashTime > filters.timeTo) return false;
            }
        } else {
            return false;
        }
    }

    return true;
}

/**
 * Check if crash matches casualty-related filters
 * At least ONE casualty must match ALL active filters simultaneously
 * @param {Object} row - Crash data row
 * @param {Object} filters - Filter values object
 * @returns {boolean} True if crash has matching casualty
 */
export function matchesCasualtyFilters(row, filters) {
    const casualties = row._casualties;
    if (!casualties || casualties.length === 0) {
        // Quick path: if no casualties, only pass if no casualty filters active
        return filters.selectedRoadUsers.includes('all') &&
               filters.selectedAgeGroups.includes('all') &&
               filters.selectedSexes.includes('all') &&
               filters.selectedInjuries.includes('all') &&
               filters.selectedSeatBelts.includes('all') &&
               filters.selectedHelmets.includes('all');
    }

    // Determine which casualty filters are active
    const hasRoadUserFilter = !filters.selectedRoadUsers.includes('all');
    const hasAgeFilter = !filters.selectedAgeGroups.includes('all');
    const hasSexFilter = !filters.selectedSexes.includes('all');
    const hasInjuryFilter = !filters.selectedInjuries.includes('all');
    const hasSeatBeltFilter = !filters.selectedSeatBelts.includes('all');
    const hasHelmetFilter = !filters.selectedHelmets.includes('all');

    const hasAnyCasualtyFilter = hasRoadUserFilter || hasAgeFilter || hasSexFilter ||
                                 hasInjuryFilter || hasSeatBeltFilter || hasHelmetFilter;

    if (!hasAnyCasualtyFilter) return true;

    // Create Sets for O(1) lookups
    const roadUserSet = hasRoadUserFilter ? new Set(filters.selectedRoadUsers) : null;
    const sexSet = hasSexFilter ? new Set(filters.selectedSexes) : null;
    const injurySet = hasInjuryFilter ? new Set(filters.selectedInjuries) : null;
    const seatBeltSet = hasSeatBeltFilter ? new Set(filters.selectedSeatBelts) : null;
    const helmetSet = hasHelmetFilter ? new Set(filters.selectedHelmets) : null;

    // Check if ANY casualty matches ALL active filters
    return casualties.some(casualty => {
        // Road User Type filter
        if (hasRoadUserFilter && !roadUserSet.has(casualty['Casualty Type'])) {
            return false;
        }

        // Age Group filter
        if (hasAgeFilter) {
            const age = parseInt(casualty.AGE);
            if (isNaN(age)) return false;
            const matchesAnyAgeGroup = filters.selectedAgeGroups.some(group => {
                if (group === '0-17') return age >= 0 && age <= 17;
                if (group === '18-25') return age >= 18 && age <= 25;
                if (group === '26-35') return age >= 26 && age <= 35;
                if (group === '36-50') return age >= 36 && age <= 50;
                if (group === '51-65') return age >= 51 && age <= 65;
                if (group === '66+') return age >= 66;
                return false;
            });
            if (!matchesAnyAgeGroup) return false;
        }

        // Casualty Sex filter
        if (hasSexFilter && !sexSet.has(casualty.Sex)) {
            return false;
        }

        // Injury Extent filter
        if (hasInjuryFilter && !injurySet.has(casualty['Injury Extent'])) {
            return false;
        }

        // Seat Belt filter
        if (hasSeatBeltFilter && !seatBeltSet.has(casualty['Seat Belt'])) {
            return false;
        }

        // Helmet filter
        if (hasHelmetFilter && !helmetSet.has(casualty.Helmet)) {
            return false;
        }

        return true;
    });
}

/**
 * Check if crash matches units/vehicle-related filters
 * At least ONE unit must match ALL active filters simultaneously
 * @param {Object} row - Crash data row
 * @param {Object} filters - Filter values object
 * @returns {boolean} True if crash has matching unit
 */
export function matchesUnitsFilters(row, filters) {
    const units = row._units || [];

    // Determine which unit filters are active
    const hasVehicleTypeFilter = !filters.selectedVehicles.includes('all');
    const hasVehicleYearFilter = !filters.selectedVehicleYears.includes('all');
    const hasOccupantsFilter = !filters.selectedOccupants.includes('all');
    const hasLicenseTypeFilter = !filters.selectedLicenseTypes.includes('all');
    const hasRegStateFilter = !filters.selectedRegStates.includes('all');
    const hasDirectionFilter = !filters.selectedDirections.includes('all');
    const hasMovementFilter = !filters.selectedMovements.includes('all');
    const hasHeavyVehicleFilter = filters.heavyVehicle !== 'all';
    const hasTowingFilter = filters.towing !== 'all';
    const hasRolloverFilter = filters.rollover !== 'all';
    const hasFireFilter = filters.fire !== 'all';

    const hasAnyUnitFilter = hasVehicleTypeFilter || hasVehicleYearFilter ||
                            hasOccupantsFilter || hasLicenseTypeFilter ||
                            hasRegStateFilter || hasDirectionFilter || hasMovementFilter ||
                            hasHeavyVehicleFilter || hasTowingFilter || hasRolloverFilter || hasFireFilter;

    // If no unit filters are active, pass all crashes
    if (!hasAnyUnitFilter) return true;

    // If filters are active but crash has no units, reject
    if (units.length === 0) return false;

    // Create Sets for O(1) lookups
    const vehicleTypeSet = hasVehicleTypeFilter ? new Set(filters.selectedVehicles) : null;
    const vehicleYearSet = hasVehicleYearFilter ? new Set(filters.selectedVehicleYears) : null;
    const occupantsSet = hasOccupantsFilter ? new Set(filters.selectedOccupants) : null;
    const licenseTypeSet = hasLicenseTypeFilter ? new Set(filters.selectedLicenseTypes) : null;
    const regStateSet = hasRegStateFilter ? new Set(filters.selectedRegStates) : null;
    const directionSet = hasDirectionFilter ? new Set(filters.selectedDirections) : null;
    const movementSet = hasMovementFilter ? new Set(filters.selectedMovements) : null;

    // Check if ANY unit matches ALL active filters (including yes/no filters)
    return units.some(unit => {
        // Heavy Vehicle filter - must be checked per unit
        if (hasHeavyVehicleFilter) {
            const isHeavyVehicle = HEAVY_VEHICLE_TYPES.includes(unit['Unit Type']);
            if (filters.heavyVehicle === 'Yes' && !isHeavyVehicle) return false;
            if (filters.heavyVehicle === 'No' && isHeavyVehicle) return false;
        }

        // Towing filter - must be checked per unit
        if (hasTowingFilter) {
            const val = (unit.Towing || '').trim();
            const hasTowing = val !== '' && val !== 'Not Towing' && val !== 'Unknown';
            if (filters.towing === 'Yes' && !hasTowing) return false;
            if (filters.towing === 'No' && hasTowing) return false;
        }

        // Rollover filter - must be checked per unit
        if (hasRolloverFilter) {
            const hasRollover = unit.Rollover && unit.Rollover.trim() !== '';
            if (filters.rollover === 'Yes' && !hasRollover) return false;
            if (filters.rollover === 'No' && hasRollover) return false;
        }

        // Fire filter - must be checked per unit
        if (hasFireFilter) {
            const hasFire = unit.Fire && unit.Fire.trim() !== '';
            if (filters.fire === 'Yes' && !hasFire) return false;
            if (filters.fire === 'No' && hasFire) return false;
        }

        // Vehicle Type filter
        if (hasVehicleTypeFilter && !vehicleTypeSet.has(unit['Unit Type'])) {
            return false;
        }

        // Vehicle Year filter
        if (hasVehicleYearFilter) {
            const year = parseInt(unit['Veh Year']);
            if (isNaN(year)) return false;
            const matchesAnyYear = filters.selectedVehicleYears.some(range => {
                if (range === 'pre-2000') return year < 2000;
                if (range === '2000-2010') return year >= 2000 && year <= 2010;
                if (range === '2011-2020') return year >= 2011 && year <= 2020;
                if (range === '2021+') return year >= 2021;
                return false;
            });
            if (!matchesAnyYear) return false;
        }

        // Occupants filter
        if (hasOccupantsFilter) {
            const occupantsStr = unit['Number Occupants'];
            if (occupantsStr !== undefined && occupantsStr !== null) {
                const occupants = parseInt(occupantsStr);
                if (!isNaN(occupants)) {
                    if (occupants === 0) return false;
                    const matchesAnyValue = filters.selectedOccupants.some(value => {
                        if (value === '1') return occupants === 1;
                        if (value === '2') return occupants === 2;
                        if (value === '3') return occupants === 3;
                        if (value === '4') return occupants === 4;
                        if (value === '5+') return occupants >= 5;
                        return false;
                    });
                    if (!matchesAnyValue) return false;
                } else {
                    return false;
                }
            } else {
                return false;
            }
        }

        // License Type filter
        if (hasLicenseTypeFilter && !licenseTypeSet.has(unit['Licence Type'])) {
            return false;
        }

        // Registration State filter
        if (hasRegStateFilter && !regStateSet.has(unit['Veh Reg State'])) {
            return false;
        }

        // Direction of Travel filter
        if (hasDirectionFilter && !directionSet.has(unit['Direction Of Travel'])) {
            return false;
        }

        // Unit Movement filter
        if (hasMovementFilter && !movementSet.has(unit['Unit Movement'])) {
            return false;
        }

        return true;
    });
}

// ============================================================================
// FILTER WORKER
// ============================================================================

/**
 * Initialise the filter Web Worker and transfer a copy of the crash data to it.
 * Called once from data-loader after linkCrashData() completes.
 * Subsequent applyFilters() calls will use the worker automatically.
 */
export function initFilterWorker() {
    if (!window.Worker) return;
    try {
        _filterWorker = new Worker('./src/js/filter-worker.js');

        _filterWorker.onmessage = (e) => {
            if (e.data.type === 'READY') {
                _workerReady = true;
            }
        };

        _filterWorker.onerror = (err) => {
            console.warn('Filter worker error, will use inline filtering:', err);
            _filterWorker = null;
            _workerReady = false;
        };

        // Project crash records to only the fields the worker needs for matching.
        // Avoids cloning _coords, popup display fields, and full sub-record objects.
        const CASUALTY_FIELDS = ['Casualty Type', 'AGE', 'Sex', 'Injury Extent', 'Seat Belt', 'Helmet'];
        const UNIT_FIELDS = ['Unit Type', 'Towing', 'Rollover', 'Fire', 'Veh Year',
                             'Number Occupants', 'Licence Type', 'Veh Reg State',
                             'Direction Of Travel', 'Unit Movement'];
        const workerData = dataState.crashData.map(row => ({
            Year:              row.Year,
            'CSEF Severity':   row['CSEF Severity'],
            'Crash Type':      row['Crash Type'],
            'Weather Cond':    row['Weather Cond'],
            DayNight:          row.DayNight,
            'DUI Involved':    row['DUI Involved'],
            'Drugs Involved':  row['Drugs Involved'],
            LGA:               row.LGA,
            Suburb:            row.Suburb,
            'Road Surface':    row['Road Surface'],
            'Moisture Cond':   row['Moisture Cond'],
            'Area Speed':      row['Area Speed'],
            'Crash Date Time': row['Crash Date Time'],
            _casualties: row._casualties
                ? row._casualties.map(c => Object.fromEntries(CASUALTY_FIELDS.map(f => [f, c[f]])))
                : [],
            _units: row._units
                ? row._units.map(u => Object.fromEntries(UNIT_FIELDS.map(f => [f, u[f]])))
                : [],
        }));

        _filterWorker.postMessage({
            type: 'INIT',
            crashData: workerData,
            heavyVehicleTypes: HEAVY_VEHICLE_TYPES
        });
    } catch (err) {
        console.warn('Could not create filter worker, will use inline filtering:', err);
    }
}

/**
 * Send a FILTER request to the worker and resolve with the matching indices.
 * Returns a Uint32Array of indices into dataState.crashData.
 */
function runFilterInWorker(filters) {
    return new Promise((resolve, reject) => {
        const id = ++_workerRequestId;

        function onMessage(e) {
            if (e.data.type !== 'RESULT' || e.data.id !== id) return;
            _filterWorker.removeEventListener('message', onMessage);
            _filterWorker.removeEventListener('error', onError);
            resolve(new Uint32Array(e.data.indicesBuffer));
        }

        function onError(err) {
            _filterWorker.removeEventListener('message', onMessage);
            _filterWorker.removeEventListener('error', onError);
            reject(err);
        }

        _filterWorker.addEventListener('message', onMessage);
        _filterWorker.addEventListener('error', onError);
        _filterWorker.postMessage({ type: 'FILTER', id, filters });
    });
}

// ============================================================================
// FILTER APPLICATION
// ============================================================================

/**
 * Apply all active filters to the crash data and update the UI
 * This is the main filter function used throughout the application
 * @returns {Promise<void>}
 */
export async function applyFilters() {
    // If a filter run is already in progress, mark a pending run and return.
    // The in-progress run will re-execute once it finishes, picking up the latest state.
    if (_filterRunning) {
        _filterPending = true;
        return;
    }
    _filterRunning = true;
    showLoading('Filtering crash data...');

    // Yield to the browser so the loading indicator renders before heavy processing
    await new Promise(resolve => setTimeout(resolve, 0));

    try {
        const filters = getFilterValues();

        // Filter crash records — use the worker when available, otherwise inline.
        let filteredData;

        if (_workerReady) {
            try {
                const indices = await runFilterInWorker(filters);
                filteredData = [];
                for (let i = 0; i < indices.length; i++) {
                    filteredData.push(dataState.crashData[indices[i]]);
                }

                // The drawn-area filter needs turf (main-thread global) so it runs here.
                // toGeoJSON() is called once before the loop, not per record.
                if (drawState.drawnLayer) {
                    const poly = drawState.drawnLayer.toGeoJSON();
                    filteredData = filteredData.filter(row => {
                        if (!row._coords) return false;
                        return turf.booleanPointInPolygon(
                            turf.point([row._coords[1], row._coords[0]]), poly
                        );
                    });
                }
            } catch (workerErr) {
                console.warn('Filter worker request failed, falling back to inline filtering:', workerErr);
                filteredData = dataState.crashData.filter(row =>
                    matchesBasicFilters(row, filters) &&
                    matchesDateTimeFilters(row, filters) &&
                    matchesCasualtyFilters(row, filters) &&
                    matchesUnitsFilters(row, filters)
                );
            }
        } else {
            filteredData = dataState.crashData.filter(row =>
                matchesBasicFilters(row, filters) &&
                matchesDateTimeFilters(row, filters) &&
                matchesCasualtyFilters(row, filters) &&
                matchesUnitsFilters(row, filters)
            );
        }

        // Update filtered data in state
        dataState.filteredData = filteredData;

        // Update statistics
        updateStatistics();

        // Show/hide the "no crashes found" overlay
        const noResultsEl = document.getElementById('noResultsOverlay');
        if (noResultsEl) {
            noResultsEl.style.display = filteredData.length === 0 ? 'block' : 'none';
        }

        // Update active filters display
        updateActiveFiltersDisplay();

        // Update analytics charts only when the panel is open to avoid wasted renders
        const analyticsPanel = document.getElementById('analyticsPanel');
        if (typeof window.updateChartsWithData === 'function' &&
            analyticsPanel && !analyticsPanel.classList.contains('collapsed')) {
            window.updateChartsWithData(filteredData);
        }

        // Update map layers
        await updateMapLayers();

        // Update URL with current filters (debounced)
        encodeFiltersToURLDebounced();

        // Reset filter change tracking
        updateFilterState({
            lastAppliedFilterState: captureCurrentFilterState(),
            filtersChanged: false
        });
        updateApplyButtonState();

        hideLoading();
    } catch (error) {
        console.error('❌ applyFilters() error:', error);
        showNotification('An error occurred while filtering. Please try again.', 'error');
        hideLoading();
    } finally {
        _filterRunning = false;
        if (_filterPending) {
            _filterPending = false;
            applyFilters();
        }
    }
}

/**
 * Apply a filter preset
 * @param {string} presetKey - Key of the preset to apply
 */
export function applyPreset(presetKey) {
    if (!presetKey) {
        document.getElementById('presetDescription').textContent = '';
        return;
    }

    const preset = FILTER_PRESETS[presetKey];
    if (!preset) {
        console.error('❌ Preset not found for key:', presetKey);
        return;
    }

    // Show description
    const descEl = document.getElementById('presetDescription');
    if (descEl) {
        descEl.textContent = preset.description;
    }

    // Clear all filters first (skip applying, we'll apply after setting preset values).
    // clearFilters is synchronous DOM manipulation so no delay is needed before continuing.
    clearFilters(true);

    const filters = preset.filters;

    // Year range
    if (filters.yearFrom !== undefined) {
        if (yearRangeSlider) {
            yearRangeSlider.set([filters.yearFrom, filters.yearTo]);
        }
    }

    // Severities
    if (filters.severities && filters.severities.length > 0) {
        const severityMenu = document.getElementById('severityMenu');
        if (severityMenu) {
            const checkboxes = severityMenu.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => {
                cb.checked = filters.severities.includes(cb.value);
            });
            updateCheckboxDropdownDisplay('severity', true);
        }
    }

    // Crash types
    if (filters.crashTypes && filters.crashTypes.length > 0) {
        const crashTypeMenu = document.getElementById('crashTypeMenu');
        if (crashTypeMenu) {
            const checkboxes = crashTypeMenu.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => {
                cb.checked = filters.crashTypes.includes(cb.value);
            });
            updateCheckboxDropdownDisplay('crashType', true);
        }
    }

    // Other simple filters
    if (filters.dayNight) {
        const el = document.getElementById('dayNight');
        if (el) el.value = filters.dayNight;
    }

    if (filters.duiInvolved) {
        const el = document.getElementById('duiInvolved');
        if (el) el.value = filters.duiInvolved;
    }

    if (filters.weather) {
        const el = document.getElementById('weather');
        if (el) el.value = filters.weather;
    }

    if (filters.heavyVehicle) {
        const el = document.getElementById('heavyVehicle');
        if (el) el.value = filters.heavyVehicle;
    }

    // Multi-select filters
    if (filters.roadUsers && filters.roadUsers.length > 0) {
        const select = document.getElementById('roadUserType');
        if (select) {
            Array.from(select.options).forEach(option => {
                option.selected = filters.roadUsers.includes(option.value);
            });
        }
    }

    if (filters.ageGroups && filters.ageGroups.length > 0) {
        const select = document.getElementById('ageGroup');
        if (select) {
            Array.from(select.options).forEach(option => {
                option.selected = filters.ageGroups.includes(option.value);
            });
        }
    }

    if (filters.speedZones && filters.speedZones.length > 0) {
        const select = document.getElementById('speedZoneFilter');
        if (select) {
            Array.from(select.options).forEach(option => {
                option.selected = filters.speedZones.includes(option.value);
            });
        }
    }

    if (filters.moistureConds && filters.moistureConds.length > 0) {
        const select = document.getElementById('moistureCond');
        if (select) {
            Array.from(select.options).forEach(option => {
                option.selected = filters.moistureConds.includes(option.value);
            });
        }
    }

    // Apply filters (updateActiveFiltersDisplay is called inside applyFilters)
    applyFilters();

    // Show notification
    showFilterNotification(`Applied preset: ${preset.name}`);
}


/**
 * Clear all filters and reset to defaults
 */
export function clearFilters(skipApply = false) {
    // Reset year range slider
    if (yearRangeSlider) {
        yearRangeSlider.set([...YEAR_RANGE.DEFAULT]);
    }

    // Reset date range
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';

    // Reset time range
    document.getElementById('timeFrom').value = '';
    document.getElementById('timeTo').value = '';

    // Reset checkbox dropdowns
    const checkboxMenus = ['severityMenu', 'crashTypeMenu', 'areaMenu', 'suburbMenu'];
    checkboxMenus.forEach(menuId => {
        const menu = document.getElementById(menuId);
        if (menu) {
            menu.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
            const dropdownId = menuId.replace('Menu', '');
            updateCheckboxDropdownDisplay(dropdownId, skipApply);
        }
    });

    // Reset single-select dropdowns
    const singleSelects = ['weather', 'dayNight', 'duiInvolved', 'drugsInvolved',
                           'heavyVehicle', 'towing', 'rollover', 'fire'];
    singleSelects.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = 'all';
    });

    // Reset multi-select dropdowns
    const multiSelects = ['roadUserType', 'vehicleType', 'ageGroup', 'casualtySex',
                          'injuryExtent', 'seatBelt', 'helmet', 'vehicleYear', 'occupants',
                          'roadSurface', 'moistureCond', 'licenseType', 'vehRegState',
                          'directionTravel', 'unitMovement', 'speedZoneFilter', 'monthFilter'];
    multiSelects.forEach(id => {
        const select = document.getElementById(id);
        if (select) {
            for (let option of select.options) {
                option.selected = (option.value === 'all');
            }
        }
    });

    // Reset preset filter dropdown to "-- Select an Example --"
    // Only do this when manually clearing (not when called from applyPreset)
    if (!skipApply) {
        const presetSelect = document.getElementById('filterPresets');
        if (presetSelect) {
            presetSelect.selectedIndex = 0;
        }

        // Clear preset description
        const presetDescription = document.getElementById('presetDescription');
        if (presetDescription) {
            presetDescription.textContent = '';
        }
    }

    // Update advanced filter badge
    if (typeof updateAdvancedFilterBadge === 'function') {
        updateAdvancedFilterBadge();
    }

    // Apply the cleared filters (unless skipApply is true, e.g., when called from applyPreset)
    if (!skipApply) {
        applyFilters();
    }
}

/**
 * Clear a single filter by name
 * @param {string} filterName - Display name of the filter to clear
 */
export function clearSingleFilter(filterName) {
    const checkAll = function(menuId, dropdownId) {
        const menu = document.getElementById(menuId);
        if (menu) {
            menu.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
            updateCheckboxDropdownDisplay(dropdownId);
        }
    };
    const resetSelect = function(id) {
        const el = document.getElementById(id);
        if (el) {
            for (let opt of el.options) opt.selected = (opt.value === 'all');
        }
    };

    switch (filterName) {
        case 'Year':
            if (yearRangeSlider) yearRangeSlider.set([...YEAR_RANGE.DEFAULT]);
            break;
        case 'Date':
            document.getElementById('dateFrom').value = '';
            document.getElementById('dateTo').value = '';
            break;
        case 'Time':
            document.getElementById('timeFrom').value = '';
            document.getElementById('timeTo').value = '';
            break;
        case 'Severity': checkAll('severityMenu', 'severity'); break;
        case 'Crash Type': checkAll('crashTypeMenu', 'crashType'); break;
        case 'Weather': document.getElementById('weather').value = 'all'; break;
        case 'Day/Night': document.getElementById('dayNight').value = 'all'; break;
        case 'DUI': document.getElementById('duiInvolved').value = 'all'; break;
        case 'Day': checkAll('dayOfWeekMenu', 'dayOfWeek'); break;
        case 'LGA': checkAll('areaMenu', 'area'); break;
        case 'Suburb': checkAll('suburbMenu', 'suburb'); break;
        case 'Road User': resetSelect('roadUserType'); break;
        case 'Age': resetSelect('ageGroup'); break;
        case 'Casualty Sex': resetSelect('casualtySex'); break;
        case 'Injury': resetSelect('injuryExtent'); break;
        case 'Seat Belt': resetSelect('seatBelt'); break;
        case 'Helmet': resetSelect('helmet'); break;
        case 'Heavy Vehicle': document.getElementById('heavyVehicle').value = 'all'; break;
        case 'Vehicle Type': resetSelect('vehicleType'); break;
        case 'Vehicle Year': resetSelect('vehicleYear'); break;
        case 'Occupants': resetSelect('occupants'); break;
        case 'Towing': document.getElementById('towing').value = 'all'; break;
        case 'Rollover': document.getElementById('rollover').value = 'all'; break;
        case 'Fire': document.getElementById('fire').value = 'all'; break;
        case 'License': resetSelect('licenseType'); break;
        case 'Reg State': resetSelect('vehRegState'); break;
        case 'Direction': resetSelect('directionTravel'); break;
        case 'Movement': resetSelect('unitMovement'); break;
        case 'Road Surface': resetSelect('roadSurface'); break;
        case 'Moisture': resetSelect('moistureCond'); break;
        case 'Drugs': document.getElementById('drugsInvolved').value = 'all'; break;
        case 'Speed Zone': resetSelect('speedZoneFilter'); break;
        case 'Month': resetSelect('monthFilter'); break;
        case 'Draw Area':
            if (typeof window.clearDrawArea === 'function') {
                window.clearDrawArea();
                return;
            }
            break;
    }

    if (typeof updateAdvancedFilterBadge === 'function') {
        updateAdvancedFilterBadge();
    }
    applyFilters();
}

// ============================================================================
// YEAR SLIDER
// ============================================================================

/**
 * Initialize the dual-handle year range slider
 */
export function initYearRangeSlider() {
    const sliderElement = document.getElementById('yearRangeSlider');
    if (!sliderElement) return;

    yearRangeSlider = noUiSlider.create(sliderElement, {
        start: [...YEAR_RANGE.DEFAULT],
        connect: true,
        step: 1,
        tooltips: [
            {
                to: function(value) { return Math.round(value); },
                from: function(value) { return Math.round(value); }
            },
            {
                to: function(value) { return Math.round(value); },
                from: function(value) { return Math.round(value); }
            }
        ],
        range: {
            'min': YEAR_RANGE.MIN,
            'max': YEAR_RANGE.MAX
        },
        format: {
            to: function(value) { return Math.round(value); },
            from: function(value) { return Math.round(value); }
        }
    });

    // Update display when slider changes
    yearRangeSlider.on('update', function(values) {
        currentYearRange = [parseInt(values[0]), parseInt(values[1])];
        const displayEl = document.getElementById('yearRangeDisplay');
        if (displayEl) {
            displayEl.textContent = `${currentYearRange[0]} - ${currentYearRange[1]}`;
        }
        markFiltersChanged();
    });
}

/**
 * Get the current year range
 * @returns {Array<number>} Current year range [min, max]
 */
export function getCurrentYearRange() {
    return [...currentYearRange];
}

/**
 * Set the year range
 * @param {Array<number>} range - Year range [min, max]
 */
export function setYearRange(range) {
    currentYearRange = [...range];
    if (yearRangeSlider) {
        yearRangeSlider.set(range);
    }
}

// ============================================================================
// URL STATE MANAGEMENT
// ============================================================================

/**
 * Encode current filters to URL parameters (internal function)
 */
/**
 * Helper: Get optimized filter value (inverts if most items selected)
 * @param {string} elementId - ID of the filter element
 * @param {Array} selectedValues - Currently selected values
 * @returns {Object|null} {values: Array, inverted: boolean} or null if all selected
 */
function getOptimizedFilterValue(elementId, selectedValues) {
    if (selectedValues.includes('all')) return null;

    // Get all possible values
    const menu = document.getElementById(`${elementId}Menu`);
    const element = document.getElementById(elementId);
    let allOptions = [];

    if (menu) {
        allOptions = Array.from(menu.querySelectorAll('input[type="checkbox"]')).map(cb => cb.value);
    } else if (element) {
        allOptions = Array.from(element.options).map(opt => opt.value).filter(v => v !== 'all');
    }

    const totalCount = allOptions.length;
    const selectedCount = selectedValues.length;

    // If >70% selected, store what's NOT selected (inverted)
    if (selectedCount > totalCount * 0.7) {
        const unselected = allOptions.filter(v => !selectedValues.includes(v));
        return { values: unselected, inverted: true };
    }

    // Otherwise store what IS selected
    return { values: selectedValues, inverted: false };
}

function encodeFiltersToURLInternal() {
    try {
        const filters = getFilterValues();
        const state = {};

        // Only include non-default values to minimize compressed size
        if (filters.yearFrom !== YEAR_RANGE.MIN) state.yf = filters.yearFrom;
        if (filters.yearTo !== YEAR_RANGE.MAX) state.yt = filters.yearTo;

        // Use optimized encoding for multi-select filters (inverts if most selected)
        const sev = getOptimizedFilterValue('severity', filters.selectedSeverities);
        if (sev) {
            state.sev = sev.inverted ? `!${sev.values.join(',')}` : sev.values;
        }

        const ct = getOptimizedFilterValue('crashType', filters.selectedCrashTypes);
        if (ct) {
            state.ct = ct.inverted ? `!${ct.values.join(',')}` : ct.values;
        }

        const ar = getOptimizedFilterValue('area', filters.selectedAreas);
        if (ar) {
            state.ar = ar.inverted ? `!${ar.values.join(',')}` : ar.values;
        }

        const sub = getOptimizedFilterValue('suburb', filters.selectedSuburbs);
        if (sub) {
            state.sub = sub.inverted ? `!${sub.values.join(',')}` : sub.values;
        }

        if (filters.weather !== 'all') state.w = filters.weather;
        if (filters.dayNight !== 'all') state.dn = filters.dayNight;
        if (filters.duiInvolved !== 'all') state.dui = filters.duiInvolved;
        if (filters.drugsInvolved !== 'all') state.drg = filters.drugsInvolved;

        if (filters.dateFrom) state.df = filters.dateFrom;
        if (filters.dateTo) state.dt = filters.dateTo;
        if (filters.timeFrom) state.tf = filters.timeFrom;
        if (filters.timeTo) state.tt = filters.timeTo;

        // Include other multi-select filters (optimized with invert logic)
        const rs = getOptimizedFilterValue('roadSurface', filters.selectedRoadSurfaces);
        if (rs) state.rs = rs.inverted ? `!${rs.values.join(',')}` : rs.values;

        const mc = getOptimizedFilterValue('moistureCond', filters.selectedMoistureConds);
        if (mc) state.mc = mc.inverted ? `!${mc.values.join(',')}` : mc.values;

        const sz = getOptimizedFilterValue('speedZoneFilter', filters.selectedSpeedZones);
        if (sz) state.sz = sz.inverted ? `!${sz.values.join(',')}` : sz.values;

        const mo = getOptimizedFilterValue('monthFilter', filters.selectedMonths);
        if (mo) state.mo = mo.inverted ? `!${mo.values.join(',')}` : mo.values;

        // Casualty filters (optimized)
        const ru = getOptimizedFilterValue('roadUserType', filters.selectedRoadUsers);
        if (ru) state.ru = ru.inverted ? `!${ru.values.join(',')}` : ru.values;

        const ag = getOptimizedFilterValue('ageGroup', filters.selectedAgeGroups);
        if (ag) state.ag = ag.inverted ? `!${ag.values.join(',')}` : ag.values;

        const sx = getOptimizedFilterValue('casualtySex', filters.selectedSexes);
        if (sx) state.sx = sx.inverted ? `!${sx.values.join(',')}` : sx.values;

        const inj = getOptimizedFilterValue('injuryExtent', filters.selectedInjuries);
        if (inj) state.inj = inj.inverted ? `!${inj.values.join(',')}` : inj.values;

        const sb = getOptimizedFilterValue('seatBelt', filters.selectedSeatBelts);
        if (sb) state.sb = sb.inverted ? `!${sb.values.join(',')}` : sb.values;

        const hm = getOptimizedFilterValue('helmet', filters.selectedHelmets);
        if (hm) state.hm = hm.inverted ? `!${hm.values.join(',')}` : hm.values;

        // Vehicle filters
        if (filters.heavyVehicle !== 'all') state.hv = filters.heavyVehicle;

        const vt = getOptimizedFilterValue('vehicleType', filters.selectedVehicles);
        if (vt) state.vt = vt.inverted ? `!${vt.values.join(',')}` : vt.values;

        const vy = getOptimizedFilterValue('vehicleYear', filters.selectedVehicleYears);
        if (vy) state.vy = vy.inverted ? `!${vy.values.join(',')}` : vy.values;

        const oc = getOptimizedFilterValue('occupants', filters.selectedOccupants);
        if (oc) state.oc = oc.inverted ? `!${oc.values.join(',')}` : oc.values;

        if (filters.towing !== 'all') state.tw = filters.towing;
        if (filters.rollover !== 'all') state.ro = filters.rollover;
        if (filters.fire !== 'all') state.fi = filters.fire;

        const lt = getOptimizedFilterValue('licenseType', filters.selectedLicenseTypes);
        if (lt) state.lt = lt.inverted ? `!${lt.values.join(',')}` : lt.values;

        const rst = getOptimizedFilterValue('vehRegState', filters.selectedRegStates);
        if (rst) state.rst = rst.inverted ? `!${rst.values.join(',')}` : rst.values;

        const dir = getOptimizedFilterValue('directionTravel', filters.selectedDirections);
        if (dir) state.dir = dir.inverted ? `!${dir.values.join(',')}` : dir.values;

        const mv = getOptimizedFilterValue('unitMovement', filters.selectedMovements);
        if (mv) state.mv = mv.inverted ? `!${mv.values.join(',')}` : mv.values;

        // If no filters are active, clear URL
        if (Object.keys(state).length === 0) {
            window.history.replaceState({}, '', window.location.pathname);
            return;
        }

        // Compress and encode the state
        const json = JSON.stringify(state);
        const compressed = LZString.compressToEncodedURIComponent(json);
        const newURL = `${window.location.pathname}?f=${compressed}`;

        window.history.replaceState({}, '', newURL);
    } catch (error) {
        console.error('Error encoding filters to URL:', error);
    }
}

/**
 * Encode current filters to URL parameters (debounced version)
 * Debounced to reduce history API calls
 */
const encodeFiltersToURLDebounced = debounce(encodeFiltersToURLInternal, 300);

/**
 * Encode current filters to URL parameters (public function)
 * For immediate encoding (e.g., when sharing URL)
 */
export function encodeFiltersToURL() {
    encodeFiltersToURLInternal();
}

/**
 * Load filters from URL parameters (supports both compressed and legacy formats)
 */
export function loadFiltersFromURL() {
    const params = new URLSearchParams(window.location.search);
    if (!params.toString()) return;

    try {
        // Check for new compressed format
        if (params.has('f')) {
            loadCompressedFilters(params.get('f'));
        } else {
            // Legacy format for backwards compatibility
            loadLegacyFilters(params);
        }

        // Apply filters after loading from URL
        setTimeout(() => {
            applyFilters();
        }, 500);
    } catch (error) {
        console.error('Error loading filters from URL:', error);
    }
}

/**
 * Helper: Decode filter value (handles inverted format)
 * @param {string} elementId - ID of the filter element
 * @param {string|Array} value - Encoded value (string starting with '!' for inverted, or array)
 * @returns {Array} Decoded values to select
 */
function decodeFilterValue(elementId, value) {
    // If it's already an array, return as-is
    if (Array.isArray(value)) return value;

    // Check if it's inverted (string starting with '!')
    if (typeof value === 'string' && value.startsWith('!')) {
        // Get all possible values
        const menu = document.getElementById(`${elementId}Menu`);
        const element = document.getElementById(elementId);
        let allOptions = [];

        if (menu) {
            allOptions = Array.from(menu.querySelectorAll('input[type="checkbox"]')).map(cb => cb.value);
        } else if (element) {
            allOptions = Array.from(element.options).map(opt => opt.value).filter(v => v !== 'all');
        }

        // Invert: select everything EXCEPT what's in the list
        const unselected = value.substring(1).split(',').filter(v => v);
        return allOptions.filter(v => !unselected.includes(v));
    }

    // Regular string value
    return typeof value === 'string' ? value.split(',') : [value];
}

/**
 * Load filters from compressed URL parameter
 */
function loadCompressedFilters(compressed) {
    try {
        const json = LZString.decompressFromEncodedURIComponent(compressed);
        if (!json) {
            console.error('Failed to decompress URL parameter');
            showNotification('The shared link could not be loaded — it may be corrupted or incomplete.', 'warning');
            return;
        }

        const state = JSON.parse(json);

        // Year range
        if (state.yf !== undefined || state.yt !== undefined) {
            const yearFrom = state.yf || YEAR_RANGE.MIN;
            const yearTo = state.yt || YEAR_RANGE.MAX;
            currentYearRange = [yearFrom, yearTo];
            if (yearRangeSlider) {
                yearRangeSlider.set([yearFrom, yearTo]);
            }
        }

        // Apply multi-select filters (with invert support)
        if (state.sev) applyCheckboxFilter('severity', decodeFilterValue('severity', state.sev));
        if (state.ct) applyCheckboxFilter('crashType', decodeFilterValue('crashType', state.ct));
        if (state.ar) applyCheckboxFilter('area', decodeFilterValue('area', state.ar));
        if (state.sub) applyCheckboxFilter('suburb', decodeFilterValue('suburb', state.sub));

        // Apply simple select filters
        if (state.w) setSelectValue('weather', state.w);
        if (state.dn) setSelectValue('dayNight', state.dn);
        if (state.dui) setSelectValue('duiInvolved', state.dui);
        if (state.drg) setSelectValue('drugsInvolved', state.drg);

        // Date/time filters
        if (state.df) document.getElementById('dateFrom').value = state.df;
        if (state.dt) document.getElementById('dateTo').value = state.dt;
        if (state.tf) document.getElementById('timeFrom').value = state.tf;
        if (state.tt) document.getElementById('timeTo').value = state.tt;

        // Advanced filters - crash conditions (with invert support)
        if (state.rs) applyMultiSelectFilter('roadSurface', decodeFilterValue('roadSurface', state.rs));
        if (state.mc) applyMultiSelectFilter('moistureCond', decodeFilterValue('moistureCond', state.mc));
        if (state.sz) applyMultiSelectFilter('speedZoneFilter', decodeFilterValue('speedZoneFilter', state.sz));
        if (state.mo) applyMultiSelectFilter('monthFilter', decodeFilterValue('monthFilter', state.mo));

        // Casualty filters (with invert support)
        if (state.ru) applyMultiSelectFilter('roadUserType', decodeFilterValue('roadUserType', state.ru));
        if (state.ag) applyMultiSelectFilter('ageGroup', decodeFilterValue('ageGroup', state.ag));
        if (state.sx) applyMultiSelectFilter('casualtySex', decodeFilterValue('casualtySex', state.sx));
        if (state.inj) applyMultiSelectFilter('injuryExtent', decodeFilterValue('injuryExtent', state.inj));
        if (state.sb) applyMultiSelectFilter('seatBelt', decodeFilterValue('seatBelt', state.sb));
        if (state.hm) applyMultiSelectFilter('helmet', decodeFilterValue('helmet', state.hm));

        // Vehicle filters (with invert support)
        if (state.hv) setSelectValue('heavyVehicle', state.hv);
        if (state.vt) applyMultiSelectFilter('vehicleType', decodeFilterValue('vehicleType', state.vt));
        if (state.vy) applyMultiSelectFilter('vehicleYear', decodeFilterValue('vehicleYear', state.vy));
        if (state.oc) applyMultiSelectFilter('occupants', decodeFilterValue('occupants', state.oc));
        if (state.tw) setSelectValue('towing', state.tw);
        if (state.ro) setSelectValue('rollover', state.ro);
        if (state.fi) setSelectValue('fire', state.fi);
        if (state.lt) applyMultiSelectFilter('licenseType', decodeFilterValue('licenseType', state.lt));
        if (state.rst) applyMultiSelectFilter('vehRegState', decodeFilterValue('vehRegState', state.rst));
        if (state.dir) applyMultiSelectFilter('directionTravel', decodeFilterValue('directionTravel', state.dir));
        if (state.mv) applyMultiSelectFilter('unitMovement', decodeFilterValue('unitMovement', state.mv));

    } catch (error) {
        console.error('Error loading compressed filters:', error);
        showNotification('The shared link could not be loaded — it may be corrupted or incomplete.', 'warning');
    }
}

/**
 * Load filters from legacy URL parameters (backwards compatibility)
 */
function loadLegacyFilters(params) {
    // Year range
    if (params.has('yearFrom') || params.has('yearTo')) {
        const yearFrom = parseInt(params.get('yearFrom')) || YEAR_RANGE.MIN;
        const yearTo = parseInt(params.get('yearTo')) || YEAR_RANGE.MAX;
        currentYearRange = [yearFrom, yearTo];
        if (yearRangeSlider) {
            yearRangeSlider.set([yearFrom, yearTo]);
        }
    }

    // Multi-select filters
    if (params.has('severity')) {
        const values = params.get('severity').split(',').map(s => s.trim());
        applyCheckboxFilter('severity', values);
    }
    if (params.has('crashType')) {
        const values = params.get('crashType').split(',').map(s => s.trim());
        applyCheckboxFilter('crashType', values);
    }
    if (params.has('areas')) {
        const values = params.get('areas').split(',').map(a => a.trim());
        applyCheckboxFilter('area', values);
    }

    // Simple selects
    if (params.has('weather')) setSelectValue('weather', params.get('weather'));
    if (params.has('dayNight')) setSelectValue('dayNight', params.get('dayNight'));
    if (params.has('dui')) setSelectValue('duiInvolved', params.get('dui'));
    if (params.has('drugs')) setSelectValue('drugsInvolved', params.get('drugs'));

    // Date/time
    if (params.has('dateFrom')) document.getElementById('dateFrom').value = params.get('dateFrom');
    if (params.has('dateTo')) document.getElementById('dateTo').value = params.get('dateTo');
    if (params.has('timeFrom')) document.getElementById('timeFrom').value = params.get('timeFrom');
    if (params.has('timeTo')) document.getElementById('timeTo').value = params.get('timeTo');
}

/**
 * Helper: Apply values to checkbox dropdown filter
 */
function applyCheckboxFilter(dropdownId, values) {
    const menu = document.getElementById(`${dropdownId}Menu`);
    if (!menu) return;

    menu.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = values.includes(cb.value.trim());
    });
    updateCheckboxDropdownDisplay(dropdownId, true);
}

/**
 * Helper: Apply values to multi-select filter
 */
function applyMultiSelectFilter(elementId, values) {
    const element = document.getElementById(elementId);
    if (!element) return;

    Array.from(element.options).forEach(opt => {
        opt.selected = values.includes(opt.value);
    });
}

/**
 * Helper: Set value of a select element
 */
function setSelectValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (!element) return;

    Array.from(element.options).forEach(opt => {
        if (opt.value.trim() === value.trim()) {
            element.value = opt.value;
        }
    });
}

/**
 * Copy current view URL to clipboard
 */
export function shareCurrentView() {
    encodeFiltersToURL();
    const url = window.location.href;

    if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
            showNotification('Link copied to clipboard! Share this URL to show others your current view.', 'success');
        }).catch(err => {
            prompt('Copy this link to share your current view:', url);
        });
    } else {
        prompt('Copy this link to share your current view:', url);
    }
}

// ============================================================================
// ACTIVE FILTERS DISPLAY
// ============================================================================

/**
 * Get smart display text for a filter based on how many items are selected
 * @param {string} elementId - ID of the filter element
 * @param {Array<string>} selectedValues - Array of selected values
 * @returns {string|null} Display text or null if shouldn't be shown
 */
export function getSmartFilterDisplay(elementId, selectedValues) {
    const menu = document.getElementById(`${elementId}Menu`);
    const element = document.getElementById(elementId);

    let allOptions = [];

    if (menu) {
        const checkboxes = menu.querySelectorAll('input[type="checkbox"]');
        allOptions = Array.from(checkboxes).map(cb => cb.value);
    } else if (element) {
        allOptions = Array.from(element.options).map(opt => opt.value);
    }

    allOptions = allOptions.filter(v => v !== 'all');

    const totalCount = allOptions.length;
    const selectedCount = selectedValues.length;

    if (selectedCount === 0 || selectedCount === totalCount) {
        return null;
    }

    // If most items are selected (>70%), show what's excluded instead
    if (selectedCount > totalCount * 0.7) {
        const excluded = allOptions.filter(opt => !selectedValues.includes(opt));
        if (excluded.length <= 2) {
            return `All except: ${excluded.join(', ')}`;
        } else {
            return `All except ${excluded.length} items`;
        }
    }

    // If few items selected (<=3), show them
    if (selectedCount <= 3) {
        return selectedValues.join(', ');
    }

    // Otherwise show count
    return `${selectedCount} selected`;
}

/**
 * Update the active filters display bar
 */
export function updateActiveFiltersDisplay() {
    const content = document.getElementById('activeFiltersContent');
    if (!content) return;

    // Attach remove-filter handler once via event delegation
    if (!content._removeHandlerAttached) {
        content.addEventListener('click', function(e) {
            const btn = e.target.closest('.filter-tag-remove');
            if (btn) clearSingleFilter(btn.dataset.filter);
        });
        content._removeHandlerAttached = true;
    }

    const filters = getFilterValues();
    const activeFilters = [];

    // Year range
    if (filters.yearFrom !== YEAR_RANGE.MIN || filters.yearTo !== YEAR_RANGE.MAX) {
        activeFilters.push({ name: 'Year', value: `${filters.yearFrom}-${filters.yearTo}` });
    }

    // Date range
    if (filters.dateFrom || filters.dateTo) {
        const from = filters.dateFrom || 'Start';
        const to = filters.dateTo || 'End';
        activeFilters.push({ name: 'Date', value: `${from} to ${to}` });
    }

    // Time range
    if (filters.timeFrom || filters.timeTo) {
        activeFilters.push({ name: 'Time', value: `${filters.timeFrom || '00:00'}-${filters.timeTo || '23:59'}` });
    }

    // Severity
    if (filters.selectedSeverities && !filters.selectedSeverities.includes('all')) {
        const display = getSmartFilterDisplay('severity', filters.selectedSeverities);
        if (display) activeFilters.push({ name: 'Severity', value: display });
    }

    // Crash Type
    if (filters.crashType && filters.crashType !== 'all' && filters.crashType !== 'multiple') {
        activeFilters.push({ name: 'Crash Type', value: filters.crashType });
    } else if (filters.crashType === 'multiple' && filters.selectedCrashTypes && !filters.selectedCrashTypes.includes('all')) {
        const display = getSmartFilterDisplay('crashType', filters.selectedCrashTypes);
        if (display) activeFilters.push({ name: 'Crash Type', value: display });
    }

    // Weather
    if (filters.weather && filters.weather !== 'all') {
        activeFilters.push({ name: 'Weather', value: filters.weather });
    }

    // LGA
    if (filters.selectedAreas && !filters.selectedAreas.includes('all')) {
        const display = getSmartFilterDisplay('area', filters.selectedAreas);
        if (display) activeFilters.push({ name: 'LGA', value: display });
    }

    // Suburb
    if (filters.selectedSuburbs && !filters.selectedSuburbs.includes('all')) {
        const display = getSmartFilterDisplay('suburb', filters.selectedSuburbs);
        if (display) activeFilters.push({ name: 'Suburb', value: display });
    }

    // Road User Type
    if (filters.selectedRoadUsers && !filters.selectedRoadUsers.includes('all')) {
        const display = getSmartFilterDisplay('roadUserType', filters.selectedRoadUsers);
        if (display) activeFilters.push({ name: 'Road User', value: display });
    }

    // Age Group
    if (filters.selectedAgeGroups && !filters.selectedAgeGroups.includes('all')) {
        const display = getSmartFilterDisplay('ageGroup', filters.selectedAgeGroups);
        if (display) activeFilters.push({ name: 'Age', value: display });
    }

    // Day/Night
    if (filters.dayNight && filters.dayNight !== 'all') {
        activeFilters.push({ name: 'Day/Night', value: filters.dayNight });
    }

    // DUI Involved
    if (filters.duiInvolved && filters.duiInvolved !== 'all') {
        activeFilters.push({ name: 'DUI', value: filters.duiInvolved });
    }

    // Drugs Involved
    if (filters.drugsInvolved && filters.drugsInvolved !== 'all') {
        activeFilters.push({ name: 'Drugs', value: filters.drugsInvolved });
    }

    // Road Surface
    if (filters.selectedRoadSurfaces && !filters.selectedRoadSurfaces.includes('all')) {
        const display = getSmartFilterDisplay('roadSurface', filters.selectedRoadSurfaces);
        if (display) activeFilters.push({ name: 'Road Surface', value: display });
    }

    // Moisture Condition
    if (filters.selectedMoistureConds && !filters.selectedMoistureConds.includes('all')) {
        const display = getSmartFilterDisplay('moistureCond', filters.selectedMoistureConds);
        if (display) activeFilters.push({ name: 'Moisture', value: display });
    }

    // Speed Zone
    if (filters.selectedSpeedZones && !filters.selectedSpeedZones.includes('all')) {
        const display = getSmartFilterDisplay('speedZoneFilter', filters.selectedSpeedZones);
        if (display) activeFilters.push({ name: 'Speed Zone', value: display });
    }

    // Month
    if (filters.selectedMonths && !filters.selectedMonths.includes('all')) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthDisplay = filters.selectedMonths.map(m => monthNames[parseInt(m) - 1]).join(', ');
        activeFilters.push({ name: 'Month', value: monthDisplay });
    }

    // Casualty Sex
    if (filters.selectedSexes && !filters.selectedSexes.includes('all')) {
        const display = getSmartFilterDisplay('casualtySex', filters.selectedSexes);
        if (display) activeFilters.push({ name: 'Casualty Sex', value: display });
    }

    // Injury Extent
    if (filters.selectedInjuries && !filters.selectedInjuries.includes('all')) {
        const display = getSmartFilterDisplay('injuryExtent', filters.selectedInjuries);
        if (display) activeFilters.push({ name: 'Injury', value: display });
    }

    // Seat Belt
    if (filters.selectedSeatBelts && !filters.selectedSeatBelts.includes('all')) {
        const display = getSmartFilterDisplay('seatBelt', filters.selectedSeatBelts);
        if (display) activeFilters.push({ name: 'Seat Belt', value: display });
    }

    // Helmet
    if (filters.selectedHelmets && !filters.selectedHelmets.includes('all')) {
        const display = getSmartFilterDisplay('helmet', filters.selectedHelmets);
        if (display) activeFilters.push({ name: 'Helmet', value: display });
    }

    // Heavy Vehicle
    if (filters.heavyVehicle && filters.heavyVehicle !== 'all') {
        activeFilters.push({ name: 'Heavy Vehicle', value: filters.heavyVehicle === 'yes' ? 'Yes' : 'No' });
    }

    // Vehicle Type
    if (filters.selectedVehicles && !filters.selectedVehicles.includes('all')) {
        const display = getSmartFilterDisplay('vehicleType', filters.selectedVehicles);
        if (display) activeFilters.push({ name: 'Vehicle Type', value: display });
    }

    // Vehicle Year
    if (filters.selectedVehicleYears && !filters.selectedVehicleYears.includes('all')) {
        const display = getSmartFilterDisplay('vehicleYear', filters.selectedVehicleYears);
        if (display) activeFilters.push({ name: 'Vehicle Year', value: display });
    }

    // Occupants
    if (filters.selectedOccupants && !filters.selectedOccupants.includes('all')) {
        const display = getSmartFilterDisplay('occupants', filters.selectedOccupants);
        if (display) activeFilters.push({ name: 'Occupants', value: display });
    }

    // Towing
    if (filters.towing && filters.towing !== 'all') {
        activeFilters.push({ name: 'Towing', value: filters.towing });
    }

    // Rollover
    if (filters.rollover && filters.rollover !== 'all') {
        activeFilters.push({ name: 'Rollover', value: filters.rollover });
    }

    // Fire
    if (filters.fire && filters.fire !== 'all') {
        activeFilters.push({ name: 'Fire', value: filters.fire });
    }

    // License Type
    if (filters.selectedLicenseTypes && !filters.selectedLicenseTypes.includes('all')) {
        const display = getSmartFilterDisplay('licenseType', filters.selectedLicenseTypes);
        if (display) activeFilters.push({ name: 'License', value: display });
    }

    // Vehicle Reg State
    if (filters.selectedRegStates && !filters.selectedRegStates.includes('all')) {
        const display = getSmartFilterDisplay('vehRegState', filters.selectedRegStates);
        if (display) activeFilters.push({ name: 'Reg State', value: display });
    }

    // Direction of Travel
    if (filters.selectedDirections && !filters.selectedDirections.includes('all')) {
        const display = getSmartFilterDisplay('directionTravel', filters.selectedDirections);
        if (display) activeFilters.push({ name: 'Direction', value: display });
    }

    // Unit Movement
    if (filters.selectedMovements && !filters.selectedMovements.includes('all')) {
        const display = getSmartFilterDisplay('unitMovement', filters.selectedMovements);
        if (display) activeFilters.push({ name: 'Movement', value: display });
    }

    // Draw Area
    if (drawState.drawnLayer) {
        activeFilters.push({ name: 'Draw Area', value: 'Custom polygon' });
    }

    // Update display
    const titleElement = document.querySelector('.active-filters-bar-title');

    if (activeFilters.length === 0) {
        content.innerHTML = '<div class="no-active-filters">No filters applied</div>';
        if (titleElement) {
            titleElement.textContent = 'No filters';
        }
    } else {
        content.innerHTML = activeFilters.map(f =>
            `<span class="active-filter-tag">
                <span class="filter-name">${f.name}:</span>
                <span class="filter-value">${f.value}</span>
                <button class="filter-tag-remove" data-filter="${f.name}" title="Remove" aria-label="Remove ${f.name} filter">×</button>
            </span>`
        ).join('');

        if (titleElement) {
            const count = activeFilters.length;
            titleElement.textContent = `${count} filter${count !== 1 ? 's' : ''} active`;
        }
    }
}

// ============================================================================
// ADVANCED FILTERS MODAL
// ============================================================================

/**
 * Open the advanced filters modal
 */
export function openAdvancedFilters() {
    const modal = document.getElementById('advancedFiltersModal');
    if (modal) modal.style.display = 'block';
}

/**
 * Close the advanced filters modal
 */
export function closeAdvancedFilters() {
    const modal = document.getElementById('advancedFiltersModal');
    if (modal) modal.style.display = 'none';
}

/**
 * Switch tabs in the advanced filters modal
 * @param {string} tabName - Name of the tab to switch to
 */
export function switchTab(tabName) {
    // Hide all tabs
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));

    // Deactivate all tab buttons
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => btn.classList.remove('active'));

    // Show selected tab
    const selectedTab = document.getElementById(tabName + 'Tab');
    if (selectedTab) selectedTab.classList.add('active');

    // Activate selected tab button
    if (event && event.target) {
        event.target.classList.add('active');
    }
}

/**
 * Apply advanced filters and close modal
 */
export function applyAdvancedFilters() {
    closeAdvancedFilters();
    updateAdvancedFilterBadge();
    applyFilters();
}

/**
 * Update the badge showing count of active advanced filters
 */
export function updateAdvancedFilterBadge() {
    let count = 0;

    // Count active advanced filters
    if (document.getElementById('weather')?.value !== 'all') count++;
    if (document.getElementById('dayNight')?.value !== 'all') count++;

    const roadUserSelect = document.getElementById('roadUserType');
    if (roadUserSelect) {
        const selectedRoadUsers = Array.from(roadUserSelect.selectedOptions).map(opt => opt.value);
        if (!selectedRoadUsers.includes('all')) count++;
    }

    const ageGroupSelect = document.getElementById('ageGroup');
    if (ageGroupSelect) {
        const selectedAges = Array.from(ageGroupSelect.selectedOptions).map(opt => opt.value);
        if (!selectedAges.includes('all')) count++;
    }

    // Update badge
    const badge = document.getElementById('advancedFilterBadge');
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }
}

/**
 * Initialize filter state tracking
 * Called during app initialization to set baseline filter state
 */
export function initFilterStateTracking() {
    const initialState = captureCurrentFilterState();
    updateFilterState({
        lastAppliedFilterState: initialState,
        filtersChanged: false
    });
    updateApplyButtonState();
}

// Export year slider reference for external access
export { yearRangeSlider, currentYearRange };
