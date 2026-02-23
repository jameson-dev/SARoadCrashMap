/**
 * Utility Functions
 * General purpose utility functions for the CrashMap application
 */

import { COORDINATE_SYSTEMS } from './config.js';

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

        // Validate the converted coordinates (South Australia: lat -38 to -26, lng 129 to 141)
        if (isNaN(lat) || isNaN(lng) || lat < -39 || lat > -25 || lng < 128 || lng > 142) {
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
 * Get full LGA name from abbreviated name
 * @param {string} abbreviatedName - Abbreviated LGA name
 * @returns {string} Full LGA name
 */
export function getFullLGAName(abbreviatedName) {
    if (!abbreviatedName || abbreviatedName === 'N/A') return abbreviatedName;

    const mapping = {
        'CC ADELAIDE.': 'Adelaide City Council',
        'CC BURNSIDE.': 'City of Burnside',
        'CC CAMPBELLTOWN.': 'Campbelltown City Council',
        'CC CHARLES STURT.': 'City of Charles Sturt',
        'CC HOLDFAST BAY.': 'City of Holdfast Bay',
        'CC MARION.': 'City of Marion',
        'CC MITCHAM.': 'City of Mitcham',
        'CC MT.GAMBIER.': 'City of Mount Gambier',
        'CC NORWOOD,PAYNEHAM & ST PETERS': 'City of Norwood Payneham & St Peters',
        'CC OF NORWOOD,PAYNEHAM & ST PETERS': 'City of Norwood Payneham & St Peters',
        'CC ONKAPARINGA.': 'City of Onkaparinga',
        'CC PORT ADELAIDE ENFIELD': 'City of Port Adelaide Enfield',
        'CC PT.ADELAIDE ENFIELD.': 'City of Port Adelaide Enfield',
        'CC PT.AUGUSTA.': 'Port Augusta City Council',
        'CC PT.LINCOLN.': 'City of Port Lincoln',
        'CC PROSPECT.': 'City of Prospect',
        'CC SALISBURY.': 'City of Salisbury',
        'CC TEA TREE GULLY.': 'City of Tea Tree Gully',
        'CC UNLEY.': 'City of Unley',
        'CC W.TORRENS.': 'City of West Torrens',
        'CC WEST TORRENS.': 'City of West Torrens',
        'CC WHYALLA.': 'City of Whyalla',
        'CT GAWLER.': 'Town of Gawler',
        'CT WALKERVILLE.': 'Town of Walkerville',
        'DC ADELAIDE HILLS': 'Adelaide Hills Council',
        'DC ALEXANDRINA.': 'Alexandrina Council',
        'DC BARUNGA WEST.': 'Barunga West Council',
        'DC BERRI & BARMERA.': 'Berri Barmera Council',
        'DC CEDUNA.': 'District Council of Ceduna',
        'DC CLARE & GILBERT VALLEYS': 'Clare and Gilbert Valleys Council',
        'DC CLEVE.': 'District Council of Cleve',
        'DC COPPER COAST.': 'Copper Coast Council',
        'DC ELLISTON.': 'District Council of Elliston',
        'DC FRANKLIN HARBOR.': 'District Council of Franklin Harbour',
        'DC GOYDER.': 'Regional Council of Goyder',
        'DC GRANT.': 'District Council of Grant',
        'DC KANGAROO ISLAND': 'Kangaroo Island Council',
        'DC KAROONDA EAST MURRAY.': 'District Council of Karoonda East Murray',
        'DC KIMBA.': 'District Council of Kimba',
        'DC KINGSTON.': 'Kingston District Council',
        'DC LEHUNTE.': 'District Council of Le Hunte',
        'DC LIGHT.': 'Light Regional Council',
        'DC LOXTON WAIKERIE.': 'District Council of Loxton Waikerie',
        'DC LOWER EYRE PENINSULA': 'District Council of Lower Eyre Peninsula',
        'DC MALLALA.': 'Adelaide Plains Council',
        'DC MID MURRAY.': 'Mid Murray Council',
        'DC MT.BARKER.': 'Mount Barker District Council',
        'DC MT.REMARKABLE.': 'District Council of Mount Remarkable',
        'DC NARACOORTE & LUCINDALE.': 'Naracoorte Lucindale Council',
        'DC NORTHERN AREAS.': 'Northern Areas Council',
        'DC ORROROO/CARRIETON.': 'District Council of Orroroo Carrieton',
        'DC PETERBOROUGH.': 'District Council of Peterborough',
        'DC PLAYFORD.': 'City of Playford',
        'DC PORT PIRIE REGIONAL': 'Port Pirie Regional Council',
        'DC RENMARK PARINGA.': 'Renmark Paringa Council',
        'DC ROBE.': 'District Council of Robe',
        'DC ROXBY DOWNS.': 'Municipal Council of Roxby Downs',
        'DC SOUTHERN MALLEE.': 'Southern Mallee District Council',
        'DC STREAKY BAY.': 'District Council of Streaky Bay',
        'DC TATIARA.': 'Tatiara District Council',
        'DC THE BAROSSA.': 'The Barossa Council',
        'DC THE COORONG.': 'Coorong District Council',
        'DC THE FLINDERS RANGES.': 'The Flinders Ranges Council',
        'DC TUMBY BAY.': 'District Council of Tumby Bay',
        'DC VICTOR HARBOR.': 'City of Victor Harbor',
        'DC WAKEFIELD.': 'Wakefield Regional Council',
        'DC WATTLE RANGE.': 'Wattle Range Council',
        'DC YANKALILLA.': 'District Council of Yankalilla',
        'DC YORKE PENINSULA.': 'Yorke Peninsula Council',
        'RC MURRAY BRIDGE.': 'Rural City of Murray Bridge',
    };

    return mapping[abbreviatedName] || abbreviatedName;
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
    // Use the existing loading element from HTML
    let loadingOverlay = document.getElementById('loading');

    if (!loadingOverlay) {
        // Fallback: create if doesn't exist
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'loading';
        loadingOverlay.className = 'loading';
        loadingOverlay.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <div class="loading-message" id="loadingMessage">${message}</div>
            </div>
        `;
        document.body.appendChild(loadingOverlay);
    }

    // Update message if element exists
    const messageEl = loadingOverlay.querySelector('.loading-message') || document.getElementById('loadingMessage');
    if (messageEl) {
        messageEl.textContent = message;
    }

    loadingOverlay.style.display = 'flex';
}

/**
 * Update loading message
 * @param {string} message - New message
 */
export function updateLoadingMessage(message) {
    const loadingOverlay = document.getElementById('loading');
    if (loadingOverlay) {
        const messageEl = loadingOverlay.querySelector('.loading-message') || document.getElementById('loadingMessage');
        if (messageEl) {
            messageEl.textContent = message;
        }
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
