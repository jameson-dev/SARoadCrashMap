/**
 * Data Loading Module
 * Handles loading and decompression of crash, casualty, and units data
 */

import { dataState, updateDataState } from './state.js';
import { convertCoordinates, normalizeLGAName, getLGAName, showLoading, updateLoadingMessage, hideLoading } from './utils.js';
import { dbCache, perfMonitor, fetchWithProgress } from './performance.js';
import { showNotification } from './ui.js';

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
        showNotification('Error linking crash data. Some details may be missing.', 'error');
    }
}

/**
 * Load units data with caching (standalone version for parallel loading)
 */
async function loadUnitsDataOnly() {
    try {
        // Try cache first
        const cached = await dbCache.getFresh('crashData', 'units-2012-2024', 7 * 24 * 60 * 60 * 1000);

        if (cached) {
            updateDataState({ unitsData: cached });
            return cached;
        }

        // Fetch with progress
        const compressedData = await fetchWithProgress('data/2012-2024_DATA_SA_Units.json.gz', (percent) => {
            updateLoadingMessage(`Loading units data... ${percent}%`);
        });

        const decompressed = pako.inflate(compressedData, { to: 'string' });
        const unitsData = JSON.parse(decompressed);

        updateDataState({ unitsData });

        // Cache the data
        try {
            await dbCache.put('crashData', 'units-2012-2024', unitsData);
            await dbCache.put('metadata', 'units-2012-2024', { timestamp: Date.now() });
        } catch (cacheError) {
            console.warn('Failed to cache units data:', cacheError);
        }

        return unitsData;

    } catch (error) {
        console.error('Error loading units data:', error);
        throw error;
    }
}

/**
 * Load units data with caching (legacy - kept for compatibility)
 * @deprecated Use loadData() instead for parallel loading
 */
export async function loadUnitsData() {
    showLoading('Loading units data...');

    try {
        const unitsData = await loadUnitsDataOnly();

        // Link data together
        linkCrashData();

        // After linking, populate filter options and load boundaries
        const { populateFilterOptions } = await import('./filters.js');
        const { updateMarkerColorLegend } = await import('./map-renderer.js');

        populateFilterOptions();
        updateMarkerColorLegend();

        // Load LGA boundaries (which will trigger initial filter application)
        await loadLGABoundaries();

        return unitsData;

    } catch (error) {
        hideLoading();
        showNotification('Error loading units data. Please check your connection and try again.', 'error');
        throw error;
    }
}

/**
 * Load casualty data with caching (standalone version for parallel loading)
 */
async function loadCasualtyDataOnly() {
    try {
        // Try cache first
        const cached = await dbCache.getFresh('crashData', 'casualty-2012-2024', 7 * 24 * 60 * 60 * 1000);

        if (cached) {
            updateDataState({ casualtyData: cached });
            return cached;
        }

        // Fetch with progress
        const compressedData = await fetchWithProgress('data/2012-2024_DATA_SA_Casualty.json.gz', (percent) => {
            updateLoadingMessage(`Loading casualty data... ${percent}%`);
        });

        const decompressed = pako.inflate(compressedData, { to: 'string' });
        const casualtyData = JSON.parse(decompressed);

        updateDataState({ casualtyData });

        // Cache the data
        try {
            await dbCache.put('crashData', 'casualty-2012-2024', casualtyData);
            await dbCache.put('metadata', 'casualty-2012-2024', { timestamp: Date.now() });
        } catch (cacheError) {
            console.warn('Failed to cache casualty data:', cacheError);
        }

        return casualtyData;

    } catch (error) {
        console.error('Error loading casualty data:', error);
        throw error;
    }
}

/**
 * Load casualty data with caching (legacy - kept for compatibility)
 * @deprecated Use loadData() instead for parallel loading
 */
export async function loadCasualtyData() {
    showLoading('Loading casualty data...');

    try {
        await loadCasualtyDataOnly();
        // Load units data next
        await loadUnitsData();
    } catch (error) {
        hideLoading();
        showNotification('Error loading casualty data. Please check your connection and try again.', 'error');
        throw error;
    }
}

/**
 * Load and decompress crash data with caching (standalone version for parallel loading)
 */
async function loadCrashDataOnly() {
    try {
        // Try to load from IndexedDB cache first
        const cached = await dbCache.getFresh('crashData', 'crash-2012-2024', 7 * 24 * 60 * 60 * 1000); // 7 days

        if (cached) {
            updateDataState({ crashData: cached });
            return cached;
        }

        // Fetch with progress tracking
        const compressedData = await perfMonitor.measureAsync('Fetch crash data', async () => {
            return await fetchWithProgress('data/2012-2024_DATA_SA_Crash.json.gz', (percent) => {
                updateLoadingMessage(`Loading crash data... ${percent}%`);
            });
        });

        // Decompress with pako.js
        const decompressed = perfMonitor.measure('Decompress crash data', () => {
            return pako.inflate(compressedData, { to: 'string' });
        });

        // Parse JSON
        const allCrashData = perfMonitor.measure('Parse crash JSON', () => {
            return JSON.parse(decompressed);
        });

        // Filter crashes with valid coordinates
        const crashData = allCrashData.filter(row => {
            return row.ACCLOC_X && row.ACCLOC_Y &&
                   row.ACCLOC_X !== '' && row.ACCLOC_Y !== '';
        });

        updateDataState({ crashData });

        // Cache the data for future visits
        try {
            await dbCache.put('crashData', 'crash-2012-2024', crashData);
            await dbCache.put('metadata', 'crash-2012-2024', { timestamp: Date.now() });
        } catch (cacheError) {
            console.warn('Failed to cache crash data:', cacheError);
            // Non-fatal, continue anyway
        }

        return crashData;

    } catch (error) {
        console.error('Error loading crash data:', error);
        throw error;
    }
}

/**
 * Load and decompress crash data with caching (legacy - kept for compatibility)
 * @deprecated Use loadData() instead for parallel loading
 */
export async function loadCrashData() {
    showLoading('Loading crash data...');

    try {
        await loadCrashDataOnly();
        // Load casualty data next
        await loadCasualtyData();
    } catch (error) {
        hideLoading();
        showNotification('Error loading crash data. Please check your connection and try again.', 'error');
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
 * Main data loading function - parallelized for faster loading
 */
export async function loadData() {
    try {
        // Load all three datasets in parallel for faster performance
        showLoading('Loading crash data (1/3)...');

        const [crashDataResult, casualtyDataResult, unitsDataResult] = await Promise.all([
            loadCrashDataOnly(),
            loadCasualtyDataOnly(),
            loadUnitsDataOnly()
        ]);


        // Link data together after all loaded
        linkCrashData();

        // After linking, populate filter options and load boundaries
        const { populateFilterOptions } = await import('./filters.js');
        const { updateMarkerColorLegend } = await import('./map-renderer.js');

        populateFilterOptions();
        updateMarkerColorLegend();

        // Load LGA boundaries (which will trigger initial filter application)
        await loadLGABoundaries();

    } catch (error) {
        console.error('Failed to load data:', error);
    }
}
