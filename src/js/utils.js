/**
 * Utility Functions
 * General purpose utility functions for the CrashMap application
 */

import { COORDINATE_SYSTEMS, SA_BOUNDS } from './config.js';

// Define EPSG:3107 projection for proj4
// GDA94 / SA Lambert (Lambert Conformal Conic)
if (typeof proj4 !== 'undefined') {
    proj4.defs([
        ['EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs'],
        ['EPSG:3107', '+proj=lcc +lat_0=-32 +lon_0=135 +lat_1=-28 +lat_2=-36 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +units=m +no_defs']
    ]);
}

/**
 * Convert MGA coordinates to Lat/Lng
 * @param {number} x - X coordinate in EPSG:3107
 * @param {number} y - Y coordinate in EPSG:3107
 * @returns {Array|null} [lat, lng] or null if invalid
 */
export function convertCoordinates(x, y) {
    try {
        const xNum = parseFloat(x);
        const yNum = parseFloat(y);

        if (isNaN(xNum) || isNaN(yNum)) {
            console.warn('Invalid coordinates:', x, y);
            return null;
        }

        const [lng, lat] = proj4(COORDINATE_SYSTEMS.SOURCE, COORDINATE_SYSTEMS.TARGET, [xNum, yNum]);

        // Validate the converted coordinates using SA bounds from config
        if (isNaN(lat) || isNaN(lng) ||
            lat < SA_BOUNDS.LAT_MIN || lat > SA_BOUNDS.LAT_MAX ||
            lng < SA_BOUNDS.LNG_MIN || lng > SA_BOUNDS.LNG_MAX) {
            console.warn('Converted coordinates out of bounds:', { x, y, lat, lng });
            return null;
        }

        return [lat, lng];
    } catch (error) {
        console.error('Coordinate conversion error:', error, x, y);
        return null;
    }
}

/**
 * Parse numeric value safely
 * @param {*} value - Value to parse
 * @returns {number} Parsed number or 0
 */
export function parseNumeric(value) {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
}

// Default radius (km) when the #searchRadius select is missing or unreadable.
// Keep in sync with the `selected` option in index.html.
const DEFAULT_SEARCH_RADIUS_KM = 2;

/**
 * Read the active search radius (km) from the #searchRadius select.
 * Falls back to the HTML default if the element is missing or its value
 * cannot be parsed as a positive finite number.
 * @returns {number} Radius in kilometres
 */
export function getSearchRadiusKm() {
    const raw = document.getElementById('searchRadius')?.value;
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SEARCH_RADIUS_KM;
}

/**
 * Escape HTML special characters
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Escape CSV special characters
 * @param {*} value - Value to escape
 * @returns {string} Escaped CSV value
 */
export function escapeCSV(value) {
    if (value === null || value === undefined) {
        return '';
    }

    const str = String(value);

    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }

    return str;
}

/**
 * Get unique values from data array for a specific column
 * @param {Array} data - Data array
 * @param {string} column - Column name
 * @returns {Array} Sorted unique values
 */
export function uniqueValues(data, column) {
    const values = new Set();
    data.forEach(row => {
        const value = row[column];
        if (value && value !== '' && value !== 'N/A') {
            values.add(value);
        }
    });
    return Array.from(values).sort();
}

/**
 * Normalize LGA name for matching
 * @param {string} name - LGA name to normalize
 * @returns {string} Normalized name
 */
export function normalizeLGAName(name) {
    if (!name) return '';

    // First do basic preprocessing
    let preprocessed = name
        .toUpperCase()
        .trim();

    // Then check specific LGA name mappings
    const lgaMapping = {
        'THE DC OF FRANKLIN HARBOUR': 'DC FRANKLIN HARBOR.',
        'THE DC OF MOUNT REMARKABLE': 'DC MT.REMARKABLE.',
        'MOUNT BARKER DISTRICT COUNCIL': 'DC MT.BARKER.',
        'CC MITCHAM.': 'CITY OF MITCHAM',
        'CC MARION.': 'CITY OF MARION',
        'CC OF NORWOOD,PAYNEHAM & ST PETERS': 'THE CITY OF NORWOOD PAYNEHAM AND ST PETERS',
        'CC CAMPBELLTOWN.': 'CAMPBELLTOWN CITY COUNCIL',
        'CC MT.GAMBIER.': 'CITY OF MOUNT GAMBIER',
        'CC PT.AUGUSTA.': 'PORT AUGUSTA CITY COUNCIL',
        'CC WHYALLA.': 'THE CORPORATION OF THE CITY OF WHYALLA',
        'DC KIMBA.': 'THE DC OF KIMBA',
        'DC CLEVE.': 'THE DC OF CLEVE',
        'DC TUMBY BAY.': 'THE DC OF TUMBY BAY',
        'DC LOWER EYRE PENINSULA': 'LOWER EYRE COUNCIL',
        'DC ELLISTON.': 'DC OF ELLISTON',
        'DC STREAKY BAY.': 'THE DC OF STREAKY BAY',
        'DC WUDINNA. (DC LE HUNTE.)': 'WUDINNA DISTRICT COUNCIL',
        'DC CEDUNA.': 'THE DC OF CEDUNA',
        'LOXTON WAIKERIE DISTRICT COUNCIL': 'THE DC OF LOXTON WAIKERIE',
        'DISTRICT COUNCIL OF GRANT': 'THE DC OF GRANT',
        'DC ROBE.': 'DC OF ROBE',
        'DC KINGSTON.': 'KINGSTON DC',
        'DC TATIARA.': 'TATIARA DC',
        'DC NARACOORTE & LUCINDALE.': 'NARACOORTE LUCINDALE COUNCIL',
        'SOUTHERN MALLEE DISTRICT COUNCIL': 'SOUTHERN MALLEE DC',
        'DC KAROONDA EAST MURRAY.': 'THE DC OF KAROONDA EAST MURRAY',
        'RC MURRAY BRIDGE.': 'THE RURAL CITY OF MURRAY BRIDGE',
        'DC VICTOR HARBOR.': 'CITY OF VICTOR HARBOR',
        'DC YANKALILLA.': 'THE DC OF YANKALILLA',
        'THE ADELAIDE HILLS COUNCIL': 'ADELAIDE HILLS COUNCIL',
        'MID MURRAY DISTRICT COUNCIL': 'MID MURRAY COUNCIL',
        'THE BAROSSA COUNCIL.': 'THE BAROSSA COUNCIL',
        'CT GAWLER.': 'TOWN OF GAWLER',
        'CITY OF PLAYFORD.': 'CITY OF PLAYFORD',
        'DC MALLALA.': 'ADELAIDE PLAINS COUNCIL',
        'WALKERVILLE TOWN COUNCIL': 'THE CORPORATION OF THE TOWN OF WALKERVILLE',
        'COPPER COAST DISTRICT COUNCIL': 'COPPER COAST COUNCIL',
        'BARUNGA WEST DISTRICT COUNCIL': 'BARUNGA WEST COUNCIL',
        'NORTHERN AREAS DISTRICT COUNCIL': 'NORTHERN AREAS COUNCIL',
        'CLARE AND GILBERT VALLEYS DISTRICT COUNCIL': 'CLARE AND GILBERT VALLEYS COUNCIL',
        'DC OF ORROROO/CARRIETON': 'THE DC OF ORROROO CARRIETON',
        'DC OF PETERBOROUGH': 'THE DC OF PETERBOROUGH',
        'THE FLINDERS RANGES COUNCIL.': 'THE FLINDERS RANGES COUNCIL',
        'DC CEDUNA': 'THE DC OF CEDUNA',
        'REGIONAL COUNCIL OF GOYDER': 'THE REGIONAL COUNCIL OF GOYDER',
        'DC RENMARK PARINGA': 'RENMARK PARINGA COUNCIL',
        'UIA RIVERLAND': 'UNINCORP (EASTERN)',
        'PT.PIRIE CITY & DIST. COUNCIL': 'PORT PIRIE REGIONAL COUNCIL',
        'MC ROXBY DOWNS': 'MUNICIPAL COUNCIL OF ROXBY DOWNS',
        'DC COOBER PEDY': 'THE DC OF COOBER PEDY',
        'CC PT.LINCOLN.': 'CITY OF PORT LINCOLN',
    };

    if (lgaMapping[preprocessed]) {
        return lgaMapping[preprocessed];
    }

    return preprocessed;
}

/**
 * Get LGA name from GeoJSON properties
 * @param {Object} properties - GeoJSON feature properties
 * @returns {string} LGA name
 */
export function getLGAName(properties) {
    // Try common property name variations (prioritize full name over abbreviations)
    const possibleNames = [
        'lga', 'LGA', 'lga_name', 'LGA_NAME', 'LGAName',
        'NAME', 'name', 'council', 'COUNCIL',
        'abbname', 'ABB_NAME', 'abbName'
    ];

    for (const prop of possibleNames) {
        if (properties[prop] && typeof properties[prop] === 'string' && properties[prop].trim()) {
            return properties[prop];
        }
    }

    // If no match, return the first string property we find (excluding geometry properties)
    for (const key in properties) {
        if (key.toLowerCase().includes('shape') || key.toLowerCase().includes('area') || key.toLowerCase().includes('length')) {
            continue; // Skip geometry properties
        }
        if (typeof properties[key] === 'string' && properties[key].trim()) {
            console.warn(`Using property '${key}' as LGA name:`, properties[key]);
            return properties[key];
        }
    }

    return 'Unknown';
}

/**
 * Expand abbreviations in search term
 * @param {string} searchTerm - Search term
 * @returns {string} Expanded search term
 */
export function expandAbbreviations(searchTerm) {
    const normalized = searchTerm.toLowerCase().trim();

    const abbreviations = {
        'mt': 'mount',
        'st': 'saint',
        'pt': 'port',
        'nth': 'north',
        'sth': 'south',
        'ck': 'creek'
    };

    let expanded = normalized;
    for (const [abbr, full] of Object.entries(abbreviations)) {
        const regex = new RegExp('\\b' + abbr + '\\b', 'gi');
        expanded = expanded.replace(regex, full);
    }

    return expanded;
}

/**
 * Highlight matching text
 * @param {string} text - Text to highlight
 * @param {string} search - Search term
 * @returns {string} HTML with highlighted text
 */
export function highlightMatch(text, search) {
    if (!search) return escapeHtml(text);
    const regex = new RegExp(`(${search})`, 'gi');
    return escapeHtml(text).replace(regex, '<strong>$1</strong>');
}

/**
 * Show loading overlay
 * @param {string} message - Loading message
 */
export function showLoading(message = 'Loading...') {
    const loadingOverlay = document.getElementById('loading');

    if (!loadingOverlay) {
        console.error('Loading overlay element (#loading) not found in DOM');
        return;
    }

    // Update message
    const messageEl = loadingOverlay.querySelector('.loading-message') || document.getElementById('loadingMessage');
    if (messageEl) {
        messageEl.textContent = message;
    } else {
        console.warn('Loading message element not found');
    }

    loadingOverlay.style.display = 'flex';
}

/**
 * Update loading message
 * @param {string} message - New message
 */
export function updateLoadingMessage(message) {
    const loadingOverlay = document.getElementById('loading');
    if (!loadingOverlay) {
        console.warn('Loading overlay not found');
        return;
    }

    const messageEl = loadingOverlay.querySelector('.loading-message') || document.getElementById('loadingMessage');
    if (messageEl) {
        messageEl.textContent = message;
    }
}

/**
 * Hide loading overlay
 */
export function hideLoading() {
    const loadingOverlay = document.getElementById('loading');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

/**
 * Show notification message
 * @param {string} message - Notification message
 */
export function showFilterNotification(message) {
    let notif = document.getElementById('filterNotification');

    if (!notif) {
        notif = document.createElement('div');
        notif.id = 'filterNotification';
        notif.className = 'filter-notification';
        document.body.appendChild(notif);
    }

    notif.textContent = message;
    notif.classList.add('show');

    setTimeout(() => {
        notif.classList.remove('show');
    }, 3000);
}
