/**
 * Application State Management
 * Centralized state for the CrashMap application
 */

import { YEAR_RANGE } from './config.js';

// Map state
export const mapState = {
    map: null,
    markersLayer: null,
    densityLayer: null,
    densityZoomListener: null,
    choroplethLayer: null,
    activeLayers: {
        markers: true,
        density: false,
        choropleth: false
    }
};

// Data state
export const dataState = {
    crashData: [],
    casualtyData: [],
    unitsData: [],
    filteredData: [],
    lgaBoundaries: null,
    suburbBoundaries: null,
    casualtyMap: new Map(),
    unitsMap: new Map()
};

// Filter state
export const filterState = {
    yearRange: [...YEAR_RANGE.DEFAULT],
    choroplethMode: 'lga', // 'lga' or 'suburb'
    markerColorMode: 'severity', // 'severity' | 'crashtype' | 'daynight'
    filtersChanged: false,
    lastAppliedFilterState: null
};

// Draw state
export const drawState = {
    drawnItems: null,
    drawnLayer: null,
    activeDrawHandler: null
};

// Search state
export const searchState = {
    searchMarker: null,
    searchCircle: null,
    selectedSuggestionIndex: -1,
    currentSuggestions: [],
    gpsLocation: null  // { lat, lng } when GPS mode is active
};

// UI state
export const uiState = {
    currentTutorialTab: 'getting-started',
    dtCurrentPage: 0,
    dtSortField: 'Year',
    dtSortAsc: false,
    dtPageSize: 25,
    dtSearchTerm: '',
    dtVisibleColumns: {
        'Year': true,
        'Crash Date Time': true,
        'Suburb': true,
        'LGA': true,
        'CSEF Severity': true,
        'Crash Type': true,
        'Area Speed': true,
        'Total Fats': true,
        'Total SI': true,
        'Total MI': true
    },
    dtHoveredRow: null,
    dtMaximized: false
};

// Cache state
export const cacheState = {
    markerIconCache: {},
    crashTypeColorMap: {},
    crashTypeColorIndex: 0,
    originalOptionVisibility: new Map()
};

// Utility functions to update state
export function updateMapState(updates) {
    Object.assign(mapState, updates);
}

export function updateDataState(updates) {
    Object.assign(dataState, updates);
}

export function updateFilterState(updates) {
    Object.assign(filterState, updates);
}

export function updateDrawState(updates) {
    Object.assign(drawState, updates);
}

export function updateSearchState(updates) {
    Object.assign(searchState, updates);
}

export function updateUiState(updates) {
    Object.assign(uiState, updates);
}

export function updateCacheState(updates) {
    Object.assign(cacheState, updates);
}

// Reset functions for specific state sections
export function resetFilterState() {
    filterState.yearRange = [...YEAR_RANGE.DEFAULT];
    filterState.filtersChanged = false;
    filterState.lastAppliedFilterState = null;
}

export function clearSearchState() {
    searchState.searchMarker = null;
    searchState.searchCircle = null;
    searchState.selectedSuggestionIndex = -1;
    searchState.currentSuggestions = [];
    searchState.gpsLocation = null;
}

export function clearDrawState() {
    drawState.drawnLayer = null;
    drawState.activeDrawHandler = null;
}
