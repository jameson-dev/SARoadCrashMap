/**
 * Data Loading Module
 * Handles loading and decompression of crash, casualty, and units data
 */

import { dataState, updateDataState } from './state.js';
import { convertCoordinates, normalizeLGAName, getLGAName, showLoading, updateLoadingMessage, hideLoading } from './utils.js';

/**
 * Link casualty and units data to crashes by REPORT_ID
 */
export function linkCrashData() {
    try {
        showLoading('Linking crash, casualty, and units data...');

        // Create lookup maps for faster access
        const casualtyMap = {};
        const unitsMap = {};

        // Group casualties by REPORT_ID
        dataState.casualtyData.forEach(casualty => {
            const reportId = casualty.REPORT_ID;
            if (!casualtyMap[reportId]) {
                casualtyMap[reportId] = [];
            }
            casualtyMap[reportId].push(casualty);
        });

        // Group units by REPORT_ID
        dataState.unitsData.forEach(unit => {
            const reportId = unit.REPORT_ID;
            if (!unitsMap[reportId]) {
                unitsMap[reportId] = [];
            }
            unitsMap[reportId].push(unit);
        });

        // Link to crash data and cache converted coordinates
        let linkedCount = 0;
        dataState.crashData.forEach(crash => {
            const reportId = crash.REPORT_ID;
            crash._casualties = casualtyMap[reportId] || [];
            crash._units = unitsMap[reportId] || [];

            // Pre-convert and cache coordinates to avoid repeated conversions
            crash._coords = convertCoordinates(crash.ACCLOC_X, crash.ACCLOC_Y);

            if (crash._casualties.length > 0 || crash._units.length > 0) {
                linkedCount++;
            }
        });

        // Store the maps in state for future use
        updateDataState({
            casualtyMap: casualtyMap,
            unitsMap: unitsMap
        });
    } catch (error) {
        console.error('Error linking crash data:', error);
        hideLoading();
        alert('Error linking crash data. Some details may be missing.');
    }
}

/**
 * Load units data
 */
export async function loadUnitsData() {
    showLoading('Loading units data...');

    try {
        const response = await fetch('data/2012-2024_DATA_SA_Units.json.gz');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const compressedData = await response.arrayBuffer();
        const decompressed = pako.inflate(new Uint8Array(compressedData), { to: 'string' });
        const unitsData = JSON.parse(decompressed);

        updateDataState({ unitsData });

        // Link data together
        linkCrashData();

        // After linking, populate filter options and load boundaries
        // Import these functions dynamically to avoid circular dependencies
        const { populateFilterOptions } = await import('./filters.js');
        const { updateMarkerColorLegend } = await import('./map-renderer.js');

        populateFilterOptions();
        updateMarkerColorLegend();

        // Load LGA boundaries (which will trigger initial filter application)
        await loadLGABoundaries();

        return unitsData;

    } catch (error) {
        console.error('Error loading units data:', error);
        hideLoading();
        alert('Error loading units data. Please check your connection and try again.');
        throw error;
    }
}

/**
 * Load casualty data
 */
export async function loadCasualtyData() {
    showLoading('Loading casualty data...');

    try {
        const response = await fetch('data/2012-2024_DATA_SA_Casualty.json.gz');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const compressedData = await response.arrayBuffer();
        const decompressed = pako.inflate(new Uint8Array(compressedData), { to: 'string' });
        const casualtyData = JSON.parse(decompressed);

        updateDataState({ casualtyData });

        // Load units data next
        await loadUnitsData();

        return casualtyData;

    } catch (error) {
        console.error('Error loading casualty data:', error);
        hideLoading();
        alert('Error loading casualty data. Please check your connection and try again.');
        throw error;
    }
}

/**
 * Load and decompress crash data
 */
export async function loadCrashData() {
    showLoading('Loading crash data...');

    try {
        // Fetch gzipped data
        const response = await fetch('data/2012-2024_DATA_SA_Crash.json.gz');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Get compressed bytes
        const compressedData = await response.arrayBuffer();

        // Decompress with pako.js
        const decompressed = pako.inflate(new Uint8Array(compressedData), { to: 'string' });

        // Parse JSON
        const allCrashData = JSON.parse(decompressed);

        // Filter crashes with valid coordinates
        const crashData = allCrashData.filter(row => {
            return row.ACCLOC_X && row.ACCLOC_Y &&
                   row.ACCLOC_X !== '' && row.ACCLOC_Y !== '';
        });

        updateDataState({ crashData });

        // Load casualty data next
        await loadCasualtyData();

        return crashData;

    } catch (error) {
        console.error('Error loading crash data:', error);
        hideLoading();
        alert('Error loading crash data. Please check your connection and try again.');
        throw error;
    }
}

/**
 * Load LGA boundaries GeoJSON
 */
export function loadLGABoundaries() {
    updateLoadingMessage('Loading LGA boundaries...');

    return fetch('data/sa_lga_boundaries.geojson')
        .then(response => response.json())
        .then(async data => {
            updateDataState({ lgaBoundaries: data });

            // Pre-compute LGA assignments for crashes with N/A LGA
            try {
                precomputeLGAAssignments();
            } catch (error) {
                console.error('Error in precomputeLGAAssignments:', error);
                // Continue anyway - not critical
            }

            // Apply initial filters to display data
            const { applyFilters } = await import('./filters.js');
            applyFilters();

            return data;
        })
        .catch(async error => {
            console.warn('Could not load LGA boundaries:', error);
            // Continue without LGA boundaries - still apply filters to show data
            const { applyFilters } = await import('./filters.js');
            applyFilters();
        });
}

/**
 * Load suburb boundaries GeoJSON
 */
export function loadSuburbBoundaries(filePath = 'data/sa_suburbs.geojson') {
    return fetch(filePath)
        .then(response => response.json())
        .then(data => {
            updateDataState({ suburbBoundaries: data });

            // Enable the suburb option in the choropleth mode pill toggle
            const suburbBtn = document.getElementById('choroplethModeSuburb');
            if (suburbBtn) {
                suburbBtn.disabled = false;
                suburbBtn.title = 'Switch to suburb view';
            }

            return data;
        })
        .catch(error => {
            console.warn('Could not load suburb boundaries:', error);
            // Keep the suburb button disabled and update its tooltip
            const suburbBtn = document.getElementById('choroplethModeSuburb');
            if (suburbBtn) {
                suburbBtn.title = 'Suburb view unavailable — boundary data failed to load';
            }
        });
}

/**
 * Pre-compute LGA assignments for crashes without LGA data
 */
export function precomputeLGAAssignments() {
    if (!dataState.lgaBoundaries) {
        console.warn('No LGA boundaries loaded');
        return;
    }

    updateLoadingMessage('Computing LGA assignments...');

    let assigned = 0;
    let alreadyAssigned = 0;
    let noMatch = 0;

    dataState.crashData.forEach(crash => {
        // Skip if already has valid LGA
        if (crash.LGA && crash.LGA !== 'N/A' && crash.LGA.trim() !== '') {
            alreadyAssigned++;
            return;
        }

        // Skip if no coordinates
        if (!crash._coords) {
            noMatch++;
            return;
        }

        const [lat, lng] = crash._coords;
        const point = turf.point([lng, lat]);

        // Check which LGA polygon contains this point
        for (const feature of dataState.lgaBoundaries.features) {
            // Skip features with null or invalid geometry
            if (!feature.geometry || feature.geometry.type === null) {
                continue;
            }

            try {
                if (turf.booleanPointInPolygon(point, feature)) {
                    const lgaName = getLGAName(feature.properties);
                    crash.LGA = lgaName;
                    assigned++;
                    break;
                }
            } catch (error) {
                // Skip features that cause turf errors
                console.warn('Turf error for feature:', feature.properties, error);
                continue;
            }
        }

        if (!crash.LGA || crash.LGA === 'N/A') {
            noMatch++;
        }
    });
}

/**
 * Main data loading function
 */
export async function loadData() {
    try {
        await loadCrashData();
        // Casualty and units data are loaded in sequence by loadCrashData
    } catch (error) {
        console.error('Failed to load data:', error);
    }
}
