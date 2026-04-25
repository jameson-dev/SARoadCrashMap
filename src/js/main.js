/**
 * Main Entry Point
 * Bootstraps the CrashMap application
 */

// Import all modules
import { loadData, loadSuburbBoundaries } from './data-loader.js';
import { LOADING_CONFIG } from './config.js';
import { initTheme, checkFirstVisit, initMultiSelectEnhancements, initUI, showNotification } from './ui.js';
import { initMap } from './map-renderer.js';
import {
    initYearRangeSlider,
    initFilterStateTracking,
    loadFiltersFromURL
} from './filters.js';
import { updateDataState, updateFilterState } from './state.js';
import { errorHandler, ERROR_TYPES } from './error-handler.js';
import { initInlineHandlers } from './inline-handlers.js';

/**
 * Initialize the application
 */
async function initializeApp() {
    try {
        // 1. Initialize theme (must be first for visual consistency)
        initTheme();

        // 2. Check first visit disclaimer
        checkFirstVisit();

        // 3. Initialize the map
        initMap();

        // 4. Load all data (crash, casualty, units)
        // This is async and will take a few seconds
        await loadData();

        // 5. Try to load suburb boundaries (optional - enables suburb choropleth)
        loadSuburbBoundaries().catch(err => {
            console.warn('Suburb boundaries not available:', err);
            errorHandler.handleError(err, ERROR_TYPES.DATA_LOAD, 'Suburb Boundaries', false);
        });

        // 6. Initialize dual-handle year range slider
        initYearRangeSlider();

        // 7. Initialize multi-select enhancements after a short delay
        setTimeout(() => {
            initMultiSelectEnhancements();
        }, LOADING_CONFIG.MULTI_SELECT_DELAY);

        // 8. Initialize Apply Filters button state (disabled by default)
        // Capture initial filter state as baseline after a short delay
        setTimeout(() => {
            initFilterStateTracking();
        }, LOADING_CONFIG.FILTER_STATE_DELAY);

        // 9. Load filters from URL if present (after data loads)
        setTimeout(() => {
            loadFiltersFromURL();
        }, LOADING_CONFIG.URL_LOAD_DELAY);

        // 10. Initialize UI components and event listeners
        initUI();

        // 11. Initialize inline handlers (extracted from HTML)
        initInlineHandlers();

    } catch (error) {
        console.error('❌ Fatal error during initialization:', error);
        errorHandler.handleError(error, ERROR_TYPES.UNKNOWN, 'Application Initialization', true);
        showNotification('Failed to initialize the application. Please refresh the page or check the console for details.', 'error', 10000);
    }
}

/**
 * Make certain functions available globally for HTML onclick handlers
 * This is necessary until all HTML is updated to use event listeners
 */
async function setupGlobalHandlers() {
    // Import functions that need to be called from HTML
    const ui = await import('./ui.js');
    window.acknowledgeDisclaimer = ui.acknowledgeDisclaimer;
    window.openTutorial = ui.openTutorial;
    window.closeTutorial = ui.closeTutorial;
    window.openInfoModal = ui.openInfoModal;
    window.closeInfoModal = ui.closeInfoModal;
    window.switchTutorialTab = ui.switchTutorialTab;
    window.nextTutorialTab = ui.nextTutorialTab;
    window.previousTutorialTab = ui.previousTutorialTab;
    window.toggleTutorialStep = ui.toggleTutorialStep;
    window.searchTutorial = ui.searchTutorial;
    window.toggleTheme = ui.toggleTheme;
    window.toggleActiveFiltersBar = ui.toggleActiveFiltersBar;
    window.togglePanel = ui.togglePanel;
    window.togglePanelCollapse = ui.togglePanelCollapse;
    window.toggleDataTable = ui.toggleDataTable;
    window.dtSort = ui.dtSort;
    window.dtChangePage = ui.dtChangePage;
    window.exportFilteredData = ui.exportFilteredData;
    window.selectAllOptions = ui.selectAllOptions;
    window.clearAllOptions = ui.clearAllOptions;
    window.removeChip = ui.removeChip;
    window.handleLocationKeydown = ui.handleLocationKeydown;
    // New data table functions
    window.changePageSize = ui.changePageSize;
    window.handlePageJump = ui.handlePageJump;
    window.searchDataTable = ui.searchDataTable;
    window.toggleColumnPicker = ui.toggleColumnPicker;
    window.toggleColumnVisibility = ui.toggleColumnVisibility;
    window.showCrashDetails = ui.showCrashDetails;
    window.highlightMarkerFromTable = ui.highlightMarkerFromTable;
    window.unhighlightMarkerFromTable = ui.unhighlightMarkerFromTable;
    window.toggleDataTableMaximize = ui.toggleDataTableMaximize;

    const filters = await import('./filters.js');
    window.applyFilters = filters.applyFilters;
    window.clearFilters = filters.clearFilters;
    window.applyPreset = filters.applyPreset;
    window.markFiltersChanged = filters.markFiltersChanged;
    window.clearSingleFilter = filters.clearSingleFilter;
    window.shareCurrentView = filters.shareCurrentView;
    window.openAdvancedFilters = filters.openAdvancedFilters;
    window.closeAdvancedFilters = filters.closeAdvancedFilters;
    window.switchTab = filters.switchTab;
    window.applyAdvancedFilters = filters.applyAdvancedFilters;

    const map = await import('./map-renderer.js');
    window.toggleLayer = map.toggleLayer;
    window.setMarkerColorMode = map.setMarkerColorMode;
    window.togglePopupExpand = map.togglePopupExpand;
    window.handleLocationInput = map.handleLocationInput;
    window.clearLocationSearch = map.clearLocationSearch;
    window.toggleLocationSearch = map.toggleLocationSearch;
    window.searchByLocation = map.searchByLocation;
    window.switchChoroplethMode = map.switchChoroplethMode;
    window.toggleDrawAreaSection = map.toggleDrawAreaSection;
    window.startDrawArea = map.startDrawArea;
    window.cancelDrawMode = map.cancelDrawMode;
    window.clearDrawArea = map.clearDrawArea;
    window.selectSuggestion = map.selectSuggestion;
    window.useMyLocation = map.useMyLocation;
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        await setupGlobalHandlers();
        initializeApp();
    });
} else {
    (async () => {
        await setupGlobalHandlers();
        initializeApp();
    })();
}

// Export for potential external use
export { initializeApp };
