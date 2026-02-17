// Global variables
let map;
let crashData = [];
let casualtyData = [];
let unitsData = [];
let filteredData = [];
let lgaBoundaries = null;
let suburbBoundaries = null;  // GeoJSON with suburb boundary polygons
let choroplethMode = 'lga';  // 'lga' or 'suburb'
let markersLayer;
let densityLayer;
let choroplethLayer;
let activeLayers = {
    markers: true,
    density: false,
    choropleth: false
};

// First-visit disclaimer acknowledgment
function checkFirstVisit() {
    const hasAcknowledged = localStorage.getItem('disclaimerAcknowledged');
    if (!hasAcknowledged) {
        document.getElementById('firstVisitOverlay').style.display = 'flex';
    }
}

function acknowledgeDisclaimer() {
    localStorage.setItem('disclaimerAcknowledged', 'true');
    document.getElementById('firstVisitOverlay').style.display = 'none';
}

// Check first visit on page load
window.addEventListener('DOMContentLoaded', checkFirstVisit);

// Heavy vehicle types definition
const HEAVY_VEHICLE_TYPES = [
    'BDOUBLE - ROAD TRAIN',
    'SEMI TRAILER',
    'RIGID TRUCK LGE GE 4.5T',
    'OMNIBUS',
    'Light Truck LT 4.5T'
];

// Loading indicator helpers
function showLoading(message = 'Loading...') {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
        const textEl = loadingEl.querySelector('.loading-content div:last-child');
        if (textEl) textEl.textContent = message;
        loadingEl.classList.remove('hidden');
    }
}

function updateLoadingMessage(message) {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
        const textEl = loadingEl.querySelector('.loading-content div:last-child');
        if (textEl) textEl.textContent = message;
    }
}

function hideLoading() {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
        loadingEl.classList.add('hidden');
    }
}

// Define coordinate systems for South Australia
// Using EPSG:3107 - GDA94 / SA Lambert (Lambert Conformal Conic)
// This is the coordinate system used in SA crash data (ACCLOC_X, ACCLOC_Y)
proj4.defs([
    ['EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs'],
    ['EPSG:3107', '+proj=lcc +lat_0=-32 +lon_0=135 +lat_1=-28 +lat_2=-36 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +units=m +no_defs']
]);

// Severity color mapping
const severityColors = {
    '1: PDO': '#808080',
    '2: MI': '#FFA500',
    '3: SI': '#FF4500',
    '4: Fatal': '#8B0000'
};

// Initialize map
function initMap() {
    // Define bounds for Australia (with some padding)
    const southWest = L.latLng(-44.5, 112); // Southwest corner of Australia (includes Tasmania & WA)
    const northEast = L.latLng(-10, 154.5); // Northeast corner of Australia (includes QLD & NT)
    const australiaBounds = L.latLngBounds(southWest, northEast);

    map = L.map('map', {
        center: [-34.9285, 138.6007], // Adelaide, SA
        zoom: 7,
        minZoom: 5,  // Prevent zooming out too far
        maxZoom: 19, // Allow detailed street-level zoom
        maxBounds: australiaBounds, // Restrict panning to Australia
        maxBoundsViscosity: 0.8 // Make bounds "sticky" (0.0 = soft, 1.0 = hard boundaries)
    });

    // Define multiple base map layers
    const baseMaps = {
        "Dark": L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }),
        "Light": L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }),
        "Voyager": L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }),
        "Street": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }),
        "Satellite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
            maxZoom: 19
        }),
        "Terrain": L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
            subdomains: 'abc',
            maxZoom: 17
        })
    };

    // Add default layer (Dark)
    baseMaps["Dark"].addTo(map);

    // Add layer control to switch between maps
    L.control.layers(baseMaps, null, {
        position: 'topleft',
        collapsed: true
    }).addTo(map);

    // Initialize layers
    markersLayer = L.markerClusterGroup({
        chunkedLoading: true,
        chunkDelay: 50,        // Reduced from default 200ms for faster loading
        chunkProgress: null,   // Disable progress updates for better performance
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        maxClusterRadius: function(zoom) {
            // More aggressive clustering at lower zoom levels for better performance
            return zoom < 10 ? 80 : (zoom < 13 ? 60 : 50);
        },
        disableClusteringAtZoom: 19, // Disable clustering when fully zoomed in
        animate: false,        // Disable animations for faster rendering
        removeOutsideVisibleBounds: true, // Remove markers outside viewport
        iconCreateFunction: function(cluster) {
            const childCount = cluster.getChildCount();

            // Format large numbers with K/M suffixes (no decimals)
            let displayCount;
            if (childCount >= 1000000) {
                displayCount = Math.round(childCount / 1000000) + 'M';
            } else if (childCount >= 1000) {
                displayCount = Math.round(childCount / 1000) + 'K';
            } else {
                displayCount = childCount;
            }

            // Determine font size based on display length
            const displayLength = displayCount.toString().length;
            let fontSize;
            if (displayLength <= 2) {
                fontSize = '12px';
            } else if (displayLength === 3) {
                fontSize = '11px';
            } else if (displayLength === 4) {
                fontSize = '10px';
            } else {
                fontSize = '9px';  // Minimum readable size
            }

            // Increase icon size for very large numbers (5+ characters)
            let iconSize = 40;
            if (displayLength >= 5) {
                iconSize = 50;
            }

            let c = ' marker-cluster-';
            if (childCount < 10) {
                c += 'small';
            } else if (childCount < 100) {
                c += 'medium';
            } else {
                c += 'large';
            }

            return new L.DivIcon({
                html: '<div><span style="font-size: ' + fontSize + ';">' + displayCount + '</span></div>',
                className: 'marker-cluster' + c,
                iconSize: new L.Point(iconSize, iconSize)
            });
        }
    });

    // Add custom cluster styling
    const style = document.createElement('style');
    style.textContent = `
        .marker-cluster-small {
            background-color: rgba(0, 212, 255, 0.6);
        }
        .marker-cluster-small div {
            background-color: rgba(0, 212, 255, 0.8);
        }
        .marker-cluster-medium {
            background-color: rgba(255, 165, 0, 0.6);
        }
        .marker-cluster-medium div {
            background-color: rgba(255, 165, 0, 0.8);
        }
        .marker-cluster-large {
            background-color: rgba(255, 69, 0, 0.6);
        }
        .marker-cluster-large div {
            background-color: rgba(255, 69, 0, 0.8);
        }
        .marker-cluster {
            color: white;
            font-weight: bold;
            text-align: center;
        }
    `;
    document.head.appendChild(style);
}

// Convert MGA coordinates to Lat/Lng
function convertCoordinates(x, y) {
    try {
        const xNum = parseFloat(x);
        const yNum = parseFloat(y);

        if (isNaN(xNum) || isNaN(yNum)) {
            console.warn('Invalid coordinates:', x, y);
            return null;
        }

        const [lng, lat] = proj4('EPSG:3107', 'EPSG:4326', [xNum, yNum]);

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

// Load and parse CSV data
function loadData() {
    showLoading('Loading crash data (190,000+ records)...');

    // Load crash data first
    Papa.parse('data/2012-2024_DATA_SA_Crash.csv', {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            console.log('Crash CSV loaded. Total rows:', results.data.length);

            crashData = results.data.filter(row => {
                return row.ACCLOC_X && row.ACCLOC_Y &&
                       row.ACCLOC_X.trim() !== '' &&
                       row.ACCLOC_Y.trim() !== '';
            });

            console.log('Filtered crash data:', crashData.length, 'records with coordinates');

            // Load casualty data
            loadCasualtyData();
        },
        error: function(error) {
            console.error('Error loading crash data:', error);
            hideLoading();
            alert('Error loading crash data. Please ensure the CSV file is in the correct location.');
        }
    });
}

// Load casualty data
function loadCasualtyData() {
    showLoading('Loading casualty data (77,000+ records)...');

    Papa.parse('data/2012-2024_DATA_SA_Casualty.csv', {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            casualtyData = results.data;
            console.log('Casualty data loaded:', casualtyData.length, 'records');

            // Load units data
            loadUnitsData();
        },
        error: function(error) {
            console.error('Error loading casualty data:', error);
            hideLoading();
            alert('Error loading casualty data. Please ensure the CSV file is in the correct location.');
        }
    });
}

// Load units data
function loadUnitsData() {
    showLoading('Loading units data (407,000+ records)...');

    Papa.parse('data/2012-2024_DATA_SA_Units.csv', {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            unitsData = results.data;
            console.log('Units data loaded:', unitsData.length, 'records');

            // Link data together
            linkCrashData();

            // Populate filter dropdowns
            populateFilterOptions();

            // Load LGA boundaries first, then apply filters
            // This ensures LGA assignments are complete before map is displayed
            loadLGABoundaries();
        },
        error: function(error) {
            console.error('Error loading units data:', error);
            hideLoading();
            alert('Error loading units data. Please ensure the CSV file is in the correct location.');
        }
    });
}

// Link casualty and units data to crashes by REPORT_ID
function linkCrashData() {
    try {
        showLoading('Linking crash, casualty, and units data...');

        // Create lookup maps for faster access
        const casualtyMap = {};
        const unitsMap = {};

    // Group casualties by REPORT_ID
    casualtyData.forEach(casualty => {
        const reportId = casualty.REPORT_ID;
        if (!casualtyMap[reportId]) {
            casualtyMap[reportId] = [];
        }
        casualtyMap[reportId].push(casualty);
    });

    // Group units by REPORT_ID
    unitsData.forEach(unit => {
        const reportId = unit.REPORT_ID;
        if (!unitsMap[reportId]) {
            unitsMap[reportId] = [];
        }
        unitsMap[reportId].push(unit);
    });

    // Link to crash data and cache converted coordinates
    let linkedCount = 0;
    crashData.forEach(crash => {
        const reportId = crash.REPORT_ID;  // Use REPORT_ID (all caps, underscore) not 'Report ID'
        crash._casualties = casualtyMap[reportId] || [];
        crash._units = unitsMap[reportId] || [];

        // Pre-convert and cache coordinates to avoid repeated conversions
        crash._coords = convertCoordinates(crash.ACCLOC_X, crash.ACCLOC_Y);

        if (crash._casualties.length > 0 || crash._units.length > 0) {
            linkedCount++;
        }
    });

        console.log('Data linking complete');
        console.log('Crashes with linked data:', linkedCount, 'out of', crashData.length);
    } catch (error) {
        console.error('Error linking crash data:', error);
        hideLoading();
        alert('Error linking crash data. Some details may be missing.');
    }
}

// Normalize LGA name for matching
function normalizeLGAName(name) {
    if (!name) return '';

    // First do basic preprocessing
    let preprocessed = name
        .toUpperCase()
        .trim()

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
        'DC WUDINNA. (DC LE HUNTE.)': "WUDINNA DISTRICT COUNCIL",
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

    let normalized = preprocessed

    return normalized;
}

// Helper function to get LGA name from GeoJSON properties
function getLGAName(properties) {
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

// Load LGA boundaries GeoJSON
function loadLGABoundaries() {
    // Update message (loading overlay already visible from initial load)
    updateLoadingMessage('Loading LGA boundaries...');
    fetch('data/sa_lga_boundaries.geojson')
        .then(response => response.json())
        .then(data => {
            lgaBoundaries = data;
            console.log('LGA boundaries loaded:', lgaBoundaries.features.length, 'areas');

            // Pre-compute LGA assignments for crashes with N/A LGA
            precomputeLGAAssignments();
        })
        .catch(error => {
            console.warn('Could not load LGA boundaries:', error);
            // Even if LGA loading fails, still apply filters and show the map
            applyFilters(false);
        });
}

// Load suburb boundaries (GeoJSON)
function loadSuburbBoundaries(filePath = 'data/sa_suburbs.geojson') {
    fetch(filePath)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            suburbBoundaries = data;
            console.log('Suburb boundaries loaded:', data.features.length, 'suburbs');

            // Enable the suburb option in the choropleth mode pill toggle
            const suburbBtn = document.getElementById('choroplethModeSuburb');
            if (suburbBtn) {
                suburbBtn.disabled = false;
                suburbBtn.title = 'Switch to suburb view';
            }
        })
        .catch(error => {
            console.warn('Could not load suburb boundaries:', error);
        });
}

// Pre-compute LGA assignments for crashes with missing/N/A LGA names
// Note: LGA assignments are now pre-computed in the CSV file (see scripts/add_lga_column.py)
// This function now just applies filters immediately without client-side computation
function precomputeLGAAssignments() {
    console.log('Using pre-computed LGA assignments from CSV');

    // Count how many crashes have LGA assignments
    const withLGA = crashData.filter(row => row['LGA'] && row['LGA'].trim()).length;
    const total = crashData.length;
    console.log(`LGA coverage: ${withLGA}/${total} crashes (${(withLGA/total*100).toFixed(1)}%)`);

    // Apply filters and show the map immediately
    applyFilters(false);
}

// Convert abbreviated LGA name to full display name
function getFullLGAName(abbreviatedName) {
    if (!abbreviatedName) return '';

    // Normalize input: uppercase and trim
    const normalized = abbreviatedName.toUpperCase().trim();

    // Reverse mapping from abbreviated names to full display names
    const displayNameMapping = {
        // City Councils (CC)
        'CC ADELAIDE.': 'Adelaide',
        'CC BURNSIDE.': 'Burnside',
        'CC CAMPBELLTOWN.': 'Campbelltown',
        'CC CHARLES STURT.': 'Charles Sturt',
        'CC HOLDFAST BAY.': 'Holdfast Bay',
        'CC MARION.': 'Marion',
        'CC MITCHAM.': 'Mitcham',
        'CC MT.GAMBIER.': 'Mount Gambier',
        'CC OF NORWOOD,PAYNEHAM & ST PETERS': 'Norwood, Payneham and St Peters',
        'CC ONKAPARINGA.': 'Onkaparinga',
        'CC OF PLAYFORD.': 'Playford',
        'CC PT.ADELAIDE ENFIELD.': 'Port Adelaide Enfield',
        'CC PT.AUGUSTA.': 'Port Augusta',
        'CC PT.LINCOLN.': 'Port Lincoln',
        'CC PROSPECT.': 'Prospect',
        'CC SALISBURY.': 'Salisbury',
        'CC TEA TREE GULLY.': 'Tea Tree Gully',
        'CC UNLEY.': 'Unley',
        'CC WEST TORRENS.': 'West Torrens',
        'CC WHYALLA.': 'Whyalla',

        // Towns (CT)
        'CT GAWLER.': 'Gawler',
        'CT WALKERVILLE.': 'Walkerville',

        //District Councils (DC)
        'DC ADELAIDE HILLS.': 'Adelaide Hills',
        'DC ALEXANDRINA.': 'Alexandrina',
        'BARUNGA WEST DISTRICT COUNCIL': 'Barunga West',
        'THE BERRI BARMERA COUNCIL': 'Berri & Barmera',
        'DC CEDUNA': 'Ceduna',
        'CLARE AND GILBERT VALLEYS DISTRICT COUNCIL': 'Clare and Gilbert Valleys',
        'DC CLEVE.': 'Cleve',
        'COPPER COAST DISTRICT COUNCIL': 'Copper Coast',
        'DC ELLISTON.': 'Elliston',
        'DC FRANKLIN HARBOR.': 'Franklin Harbour',
        'DC GOYDER.': 'Goyder',
        'DC GRANT.': 'Grant',
        'DC VICTOR HARBOR.': 'Victor Harbor',
        'DC KAROONDA EAST MURRAY.': 'Karoonda East Murray',
        'DC KIMBA.': 'Kimba',
        'DC KINGSTON.': 'Kingston SE',
        'DC LE HUNTE.': 'Le Hunte',
        'DC LIGHT.': 'Light',
        'DC LOWER EYRE PENINSULA': 'Lower Eyre Peninsula',
        'LOXTON WAIKERIE DISTRICT COUNCIL': 'Loxton & Waikerie',
        'DC MALLALA.': 'Adelaide Plains',
        'MID MURRAY DISTRICT COUNCIL': 'Mid Murray',
        'DC MT.BARKER.': 'Mount Barker',
        'DC MT.REMARKABLE.': 'Mount Remarkable',
        'DC NARACOORTE & LUCINDALE.': 'Naracoorte & Lucindale',
        'NORTHERN AREAS DISTRICT COUNCIL': 'Northern Areas',
        'DC OF ORROROO/CARRIETON': 'Orroroo Carrieton',
        'DC OF PETERBOROUGH': 'Peterborough',
        'DC RENMARK PARINGA': 'Renmark Paringa',
        'DC ROBE.': 'Robe',
        'SOUTHERN MALLEE DISTRICT COUNCIL': 'Southern Mallee',
        'DC STREAKY BAY.': 'Streaky Bay',
        'DC TATIARA.': 'Tatiara',
        'DC THE BAROSSA.': 'The Barossa',
        'DC THE COORONG.': 'Coorong',
        'THE FLINDERS RANGES COUNCIL.': 'The Flinders Ranges',
        'DC TUMBY BAY.': 'Tumby Bay',
        'DC WAKEFIELD.': 'Wakefield',
        'DC WATTLE RANGE.': 'Wattle Range',
        'DC WUDINNA. (DC LE HUNTE.)': 'Le Hunte',
        'DC YANKALILLA.': 'Yankalilla',
        'DC YORKE PENINSULA.': 'Yorke Peninsula',

        // Municipal Councils (MC)
        'DC COOBER PEDY': 'Coober Pedy',
        'MC ROXBY DOWNS': 'Roxby Downs',

        // Regional Councils (RC)
        'RC MURRAY BRIDGE.': 'Murray Bridge',
        'PT.PIRIE CITY & DIST. COUNCIL': 'Port Pirie',

        // Full name variations (for backwards compatibility and normalizeLGAName mapping)
        'THE ADELAIDE HILLS COUNCIL': 'Adelaide Hills',
        'ADELAIDE PLAINS COUNCIL': 'Adelaide Plains',
        'ALEXANDRINA COUNCIL': 'Alexandrina',
        'BARUNGA WEST COUNCIL': 'Barunga West',
        'BERRI BARMERA COUNCIL': 'Berri Barmera',
        'CAMPBELLTOWN CITY COUNCIL': 'Campbelltown',
        'CITY OF ADELAIDE': 'Adelaide',
        'CITY OF BURNSIDE': 'Burnside',
        'CITY OF CAMPBELLTOWN': 'Campbelltown',
        'CITY OF CHARLES STURT': 'Charles Sturt',
        'CITY OF HOLDFAST BAY': 'Holdfast Bay',
        'CITY OF MARION': 'Marion',
        'CITY OF MITCHAM': 'Mitcham',
        'CITY OF MOUNT GAMBIER': 'Mount Gambier',
        'CITY OF NORWOOD PAYNEHAM AND ST PETERS': 'Norwood Payneham and St Peters',
        'CITY OF ONKAPARINGA': 'Onkaparinga',
        'CITY OF PLAYFORD.': 'Playford',
        'CITY OF PORT ADELAIDE ENFIELD': 'Port Adelaide Enfield',
        'CITY OF PORT AUGUSTA': 'Port Augusta',
        'CITY OF PORT LINCOLN': 'Port Lincoln',
        'CITY OF PROSPECT': 'Prospect',
        'CITY OF SALISBURY': 'Salisbury',
        'CITY OF TEA TREE GULLY': 'Tea Tree Gully',
        'CITY OF UNLEY': 'Unley',
        'CITY OF VICTOR HARBOR': 'Victor Harbor',
        'CITY OF WEST TORRENS': 'West Torrens',
        'CITY OF WHYALLA': 'Whyalla',
        'CLARE AND GILBERT VALLEYS COUNCIL': 'Clare and Gilbert Valleys ',
        'COORONG DISTRICT COUNCIL': 'Coorong',
        'COPPER COAST COUNCIL': 'Copper Coast ',
        'KINGSTON DC': 'Kingston',
        'LIGHT REGIONAL COUNCIL': 'Light Regional ',
        'LOWER EYRE COUNCIL': 'Lower Eyre Peninsula',
        'MID MURRAY COUNCIL': 'Mid Murray ',
        'MOUNT BARKER DISTRICT COUNCIL': 'Mount Barker',
        'MUNICIPAL COUNCIL OF ROXBY DOWNS': 'Roxby Downs',
        'NARACOORTE LUCINDALE COUNCIL': 'Naracoorte & Lucindale',
        'NORTHERN AREAS COUNCIL': 'Northern Areas',
        'PORT AUGUSTA CITY COUNCIL': 'Port Augusta',
        'PORT PIRIE REGIONAL COUNCIL': 'Port Pirie',
        'RENMARK PARINGA COUNCIL': 'Renmark Paringa',
        'SOUTHERN MALLEE DC': 'Southern Mallee',
        'TATIARA DC': 'Tatiara',
        'THE BAROSSA COUNCIL.': 'The Barossa',
        'THE CORPORATION OF THE CITY OF WHYALLA': 'Whyalla',
        'WALKERVILLE TOWN COUNCIL': 'Walkerville',
        'THE DC OF CEDUNA': 'Ceduna',
        'THE DC OF CLEVE': 'Cleve',
        'THE DC OF COOBER PEDY': 'Coober Pedy',
        'THE DC OF FRANKLIN HARBOUR': 'Franklin Harbour',
        'DISTRICT COUNCIL OF GRANT': 'Grant',
        'THE DC OF KAROONDA EAST MURRAY': 'Karoonda East Murray',
        'THE DC OF KIMBA': 'Kimba',
        'THE DC OF LOXTON WAIKERIE': 'Loxton Waikerie',
        'THE DC OF MOUNT REMARKABLE': 'Mount Remarkable',
        'THE DC OF ORROROO CARRIETON': 'Orroroo Carrieton',
        'THE DC OF PETERBOROUGH': 'Peterborough',
        'THE DC OF STREAKY BAY': 'Streaky Bay',
        'THE DC OF TUMBY BAY': 'Tumby Bay',
        'THE DC OF YANKALILLA': 'Yankalilla',
        'THE FLINDERS RANGES COUNCIL': 'The Flinders Ranges',
        'REGIONAL COUNCIL OF GOYDER': 'Goyder',
        'THE RURAL CITY OF MURRAY BRIDGE': 'Murray Bridge',
        'TOWN OF GAWLER': 'Town of Gawler',
        'TOWN OF WALKERVILLE': 'Town of Walkerville',
        'WAKEFIELD REGIONAL COUNCIL': 'Wakefield',
        'WATTLE RANGE COUNCIL': 'Wattle Range',
        'WUDINNA DISTRICT COUNCIL': 'Le Hunte',
        'YORKE PENINSULA COUNCIL': 'Yorke Peninsula',
        'KANGAROO ISLAND COUNCIL': 'Kangaroo Island',

        // Additional variations and edge cases
        'DC OF ELLISTON': 'Elliston',
        'DC OF ROBE': 'Robe',
        'THE CITY OF NORWOOD PAYNEHAM AND ST PETERS': 'Norwood Payneham and St Peters',
    };

    // Check if we have a specific display name mapping (using normalized name)
    if (displayNameMapping[normalized]) {
        return displayNameMapping[normalized];
    }

    // If no specific mapping, return the original name
    return abbreviatedName;
}

// Populate filter dropdown options
function populateFilterOptions() {
    // Crash types - populate checkbox dropdown
    const crashTypes = [...new Set(crashData.map(row => row['Crash Type']).filter(v => v))];
    const crashTypeMenu = document.getElementById('crashTypeMenu');

    // Search bar
    const crashTypeSearchWrap = document.createElement('div');
    crashTypeSearchWrap.className = 'dropdown-search-wrap';
    crashTypeSearchWrap.innerHTML = '<input type="text" class="dropdown-search" placeholder="Search..." oninput="filterDropdownItems(\'crashType\', this.value)">';
    crashTypeMenu.appendChild(crashTypeSearchWrap);

    // Scrollable items list
    const crashTypeList = document.createElement('div');
    crashTypeList.className = 'dropdown-items-list';
    crashTypeList.id = 'crashTypeItemsList';
    crashTypes.sort().forEach((type, index) => {
        const item = document.createElement('div');
        item.className = 'checkbox-dropdown-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `crashType-${index}`;
        checkbox.value = type;
        checkbox.checked = true; // All selected by default
        checkbox.onchange = () => updateCheckboxDropdownDisplay('crashType');

        const label = document.createElement('label');
        label.htmlFor = `crashType-${index}`;
        label.textContent = type;

        item.appendChild(checkbox);
        item.appendChild(label);
        crashTypeList.appendChild(item);
    });
    crashTypeMenu.appendChild(crashTypeList);

    // Add select/clear controls
    const controls = document.createElement('div');
    controls.className = 'checkbox-dropdown-controls';
    controls.innerHTML = `
        <button class="checkbox-select-all" onclick="selectAllDropdownItems('crashType')">Select All</button>
        <button class="checkbox-clear-all" onclick="clearAllDropdownItems('crashType')">Clear All</button>
    `;
    crashTypeMenu.appendChild(controls);

    // Weather conditions
    const weatherConditions = [...new Set(crashData.map(row => row['Weather Cond']).filter(v => v))];
    const weatherSelect = document.getElementById('weather');
    weatherConditions.sort().forEach(weather => {
        const option = document.createElement('option');
        option.value = weather;
        option.textContent = weather;
        weatherSelect.appendChild(option);
    });

    // Areas (LGA) - populate checkbox dropdown with pre-computed LGA values
    const areas = [...new Set(crashData.map(row => row['LGA']).filter(v => v))];
    const areaMenu = document.getElementById('areaMenu');

    // Search bar
    const areaSearchWrap = document.createElement('div');
    areaSearchWrap.className = 'dropdown-search-wrap';
    areaSearchWrap.innerHTML = '<input type="text" class="dropdown-search" placeholder="Search..." oninput="filterDropdownItems(\'area\', this.value)">';
    areaMenu.appendChild(areaSearchWrap);

    // Scrollable items list
    const areaList = document.createElement('div');
    areaList.className = 'dropdown-items-list';
    areaList.id = 'areaItemsList';

    // Sort LGA names alphabetically (already full names from pre-computed column)
    areas.sort((a, b) => a.localeCompare(b)).forEach((area, index) => {
        const item = document.createElement('div');
        item.className = 'checkbox-dropdown-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `area-${index}`;
        checkbox.value = area; // Full LGA name for filtering
        checkbox.checked = true; // All selected by default
        checkbox.onchange = () => updateCheckboxDropdownDisplay('area');

        const label = document.createElement('label');
        label.htmlFor = `area-${index}`;
        label.textContent = area; // Display full name from CSV

        item.appendChild(checkbox);
        item.appendChild(label);
        areaList.appendChild(item);
    });
    areaMenu.appendChild(areaList);

    // Add select/clear controls
    const areaControls = document.createElement('div');
    areaControls.className = 'checkbox-dropdown-controls';
    areaControls.innerHTML = `
        <button class="checkbox-select-all" onclick="selectAllDropdownItems('area')">Select All</button>
        <button class="checkbox-clear-all" onclick="clearAllDropdownItems('area')">Clear All</button>
    `;
    areaMenu.appendChild(areaControls);

    // Suburbs - populate checkbox dropdown
    const suburbs = [...new Set(crashData.map(row => row.Suburb).filter(v => v))];
    const suburbMenu = document.getElementById('suburbMenu');

    if (suburbMenu) {
        // Search bar
        const suburbSearchWrap = document.createElement('div');
        suburbSearchWrap.className = 'dropdown-search-wrap';
        suburbSearchWrap.innerHTML = '<input type="text" class="dropdown-search" placeholder="Search..." oninput="filterDropdownItems(\'suburb\', this.value)">';
        suburbMenu.appendChild(suburbSearchWrap);

        // Scrollable items list
        const suburbList = document.createElement('div');
        suburbList.className = 'dropdown-items-list';
        suburbList.id = 'suburbItemsList';
        suburbs.sort().forEach((suburb, index) => {
            const item = document.createElement('div');
            item.className = 'checkbox-dropdown-item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `suburb-${index}`;
            checkbox.value = suburb;
            checkbox.checked = true; // All selected by default
            checkbox.onchange = () => updateCheckboxDropdownDisplay('suburb');

            const label = document.createElement('label');
            label.htmlFor = `suburb-${index}`;
            label.textContent = suburb;

            item.appendChild(checkbox);
            item.appendChild(label);
            suburbList.appendChild(item);
        });
        suburbMenu.appendChild(suburbList);

        // Add select/clear controls
        const suburbControls = document.createElement('div');
        suburbControls.className = 'checkbox-dropdown-controls';
        suburbControls.innerHTML = `
            <button class="checkbox-select-all" onclick="selectAllDropdownItems('suburb')">Select All</button>
            <button class="checkbox-clear-all" onclick="clearAllDropdownItems('suburb')">Clear All</button>
        `;
        suburbMenu.appendChild(suburbControls);
    }

    // Road User Types (from casualty data)
    const roadUserTypes = [...new Set(casualtyData.map(row => row['Casualty Type']).filter(v => v))];
    const roadUserSelect = document.getElementById('roadUserType');
    roadUserTypes.sort().forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        roadUserSelect.appendChild(option);
    });

    // Unit Types (from units data - includes vehicles, pedestrians, fixed objects, etc.)
    const vehicleTypes = [...new Set(unitsData.map(row => row['Unit Type']).filter(v => v))];
    const vehicleSelect = document.getElementById('vehicleType');
    vehicleTypes.sort().forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        vehicleSelect.appendChild(option);
    });

    // Road Surface (from crash data)
    const roadSurfaces = [...new Set(crashData.map(row => row['Road Surface']).filter(v => v))];
    const roadSurfaceSelect = document.getElementById('roadSurface');
    roadSurfaces.sort().forEach(surface => {
        const option = document.createElement('option');
        option.value = surface;
        option.textContent = surface;
        roadSurfaceSelect.appendChild(option);
    });

    // Moisture Conditions (from crash data)
    const moistureConditions = [...new Set(crashData.map(row => row['Moisture Cond']).filter(v => v))];
    const moistureSelect = document.getElementById('moistureCond');
    moistureConditions.sort().forEach(condition => {
        const option = document.createElement('option');
        option.value = condition;
        option.textContent = condition;
        moistureSelect.appendChild(option);
    });

    // License Types (from units data)
    const licenseTypes = [...new Set(unitsData.map(row => row['Licence Type']).filter(v => v))];
    const licenseTypeSelect = document.getElementById('licenseType');
    licenseTypes.sort().forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        licenseTypeSelect.appendChild(option);
    });

    // Vehicle Registration States (from units data)
    const regStates = [...new Set(unitsData.map(row => row['Veh Reg State']).filter(v => v))];
    const regStateSelect = document.getElementById('vehRegState');
    regStates.sort().forEach(state => {
        const option = document.createElement('option');
        option.value = state;
        option.textContent = state;
        regStateSelect.appendChild(option);
    });

    // Direction of Travel (from units data)
    const directions = [...new Set(unitsData.map(row => row['Direction Of Travel']).filter(v => v))];
    const directionSelect = document.getElementById('directionTravel');
    directions.sort().forEach(direction => {
        const option = document.createElement('option');
        option.value = direction;
        option.textContent = direction;
        directionSelect.appendChild(option);
    });

    // Unit Movement (from units data)
    const movements = [...new Set(unitsData.map(row => row['Unit Movement']).filter(v => v))];
    const movementSelect = document.getElementById('unitMovement');
    movements.sort().forEach(movement => {
        const option = document.createElement('option');
        option.value = movement;
        option.textContent = movement;
        movementSelect.appendChild(option);
    });
}

// Helper: Get selected values from a multi-select element or checkbox dropdown
function getSelectedValues(elementId) {
    // Check if it's a checkbox dropdown (area)
    const menu = document.getElementById(`${elementId}Menu`);
    if (menu) {
        const checkboxes = menu.querySelectorAll('input[type="checkbox"]:checked');
        if (checkboxes.length === 0 || checkboxes.length === menu.querySelectorAll('input[type="checkbox"]').length) {
            return ['all'];
        }
        return Array.from(checkboxes).map(cb => cb.value);
    }

    // Fall back to regular multi-select element
    const element = document.getElementById(elementId);
    if (!element) return ['all'];
    const selected = Array.from(element.selectedOptions).map(opt => opt.value);

    // If nothing selected, treat as 'all' (prevents 0 results when user deselects everything)
    if (selected.length === 0) return ['all'];

    // If 'all' is selected along with other values, ignore 'all' (user wants specific values)
    if (selected.includes('all') && selected.length > 1) {
        return selected.filter(v => v !== 'all');
    }

    return selected;
}

// Helper: Get value from a single-select element or checkbox dropdown
function getValue(elementId, defaultValue = 'all') {
    // Check if it's a checkbox dropdown (crashType)
    const menu = document.getElementById(`${elementId}Menu`);
    if (menu) {
        const checkboxes = menu.querySelectorAll('input[type="checkbox"]:checked');
        const allCheckboxes = menu.querySelectorAll('input[type="checkbox"]');

        // If all are selected or none are selected, return 'all'
        if (checkboxes.length === 0 || checkboxes.length === allCheckboxes.length) {
            return 'all';
        }
        // If only one is selected, return that value
        if (checkboxes.length === 1) {
            return checkboxes[0].value;
        }
        // If multiple are selected, return 'multiple' for special handling
        return 'multiple';
    }

    // Fall back to regular select element
    const element = document.getElementById(elementId);
    return element ? element.value : defaultValue;
}

// Get all filter values from the DOM
function getFilterValues() {
    return {
        // Year range
        yearFrom: currentYearRange[0],
        yearTo: currentYearRange[1],

        // Basic filters
        selectedSeverities: getSelectedValues('severity'),
        crashType: getValue('crashType'),
        selectedCrashTypes: getSelectedValues('crashType'), // For multiple crash type selections
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
        drugsInvolved: getValue('drugsInvolved')
    };
}

// Helper: Check if a crash matches basic filters
function matchesBasicFilters(row, filters) {
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
        const hasDUI = row['DUI Involved'] && row['DUI Involved'].trim() !== '';
        if (filters.duiInvolved === 'Yes' && !hasDUI) return false;
        if (filters.duiInvolved === 'No' && hasDUI) return false;
    }

    // Drugs filter
    if (filters.drugsInvolved !== 'all') {
        const hasDrugs = row['Drugs Involved'] && row['Drugs Involved'].trim() !== '';
        if (filters.drugsInvolved === 'Yes' && !hasDrugs) return false;
        if (filters.drugsInvolved === 'No' && hasDrugs) return false;
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

    // Rollover filter
    if (filters.rollover !== 'all') {
        const hasRollover = row.ROLLOVER && row.ROLLOVER.trim() !== '';
        if (filters.rollover === 'Yes' && !hasRollover) return false;
        if (filters.rollover === 'No' && hasRollover) return false;
    }

    // Fire filter
    if (filters.fire !== 'all') {
        const hasFire = row.FIRE && row.FIRE.trim() !== '';
        if (filters.fire === 'Yes' && !hasFire) return false;
        if (filters.fire === 'No' && hasFire) return false;
    }

    return true;
}

// Helper: Check if a crash matches date/time filters
function matchesDateTimeFilters(row, filters) {
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
                // Malformed date when date filter is active - exclude crash
                return false;
            }
        } else {
            // Missing date when date filter is active - exclude crash
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
                    // Crosses midnight (e.g., 22:00 to 02:00) - must be >= timeFrom OR <= timeTo
                    if (crashTime < filters.timeFrom && crashTime > filters.timeTo) return false;
                }
            } else if (filters.timeFrom) {
                if (crashTime < filters.timeFrom) return false;
            } else if (filters.timeTo) {
                if (crashTime > filters.timeTo) return false;
            }
        } else {
            // Missing time when time filter is active - exclude crash
            return false;
        }
    }

    return true;
}

// Helper: Check if crash matches casualty-related filters
// COMBINED MATCHING: At least ONE casualty must match ALL active filters simultaneously
function matchesCasualtyFilters(row, filters) {
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

    // Determine which casualty filters are active & PERFORMANCE: convert to Sets for O(1) lookup
    const hasRoadUserFilter = !filters.selectedRoadUsers.includes('all');
    const hasAgeFilter = !filters.selectedAgeGroups.includes('all');
    const hasSexFilter = !filters.selectedSexes.includes('all');
    const hasInjuryFilter = !filters.selectedInjuries.includes('all');
    const hasSeatBeltFilter = !filters.selectedSeatBelts.includes('all');
    const hasHelmetFilter = !filters.selectedHelmets.includes('all');

    const hasAnyCasualtyFilter = hasRoadUserFilter || hasAgeFilter || hasSexFilter ||
                                 hasInjuryFilter || hasSeatBeltFilter || hasHelmetFilter;

    // If no casualty filters are active, pass
    if (!hasAnyCasualtyFilter) return true;

    // Create Sets for O(1) lookups (only if filters are active)
    const roadUserSet = hasRoadUserFilter ? new Set(filters.selectedRoadUsers) : null;
    const sexSet = hasSexFilter ? new Set(filters.selectedSexes) : null;
    const injurySet = hasInjuryFilter ? new Set(filters.selectedInjuries) : null;
    const seatBeltSet = hasSeatBeltFilter ? new Set(filters.selectedSeatBelts) : null;
    const helmetSet = hasHelmetFilter ? new Set(filters.selectedHelmets) : null;

    // Check if ANY casualty matches ALL active filters
    return casualties.some(casualty => {
        // Road User Type filter
        if (hasRoadUserFilter) {
            if (!roadUserSet.has(casualty['Casualty Type'])) {
                return false;
            }
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
        if (hasSexFilter) {
            if (!sexSet.has(casualty.Sex)) {
                return false;
            }
        }

        // Injury Extent filter
        if (hasInjuryFilter) {
            if (!injurySet.has(casualty['Injury Extent'])) {
                return false;
            }
        }

        // Seat Belt filter
        if (hasSeatBeltFilter) {
            if (!seatBeltSet.has(casualty['Seat Belt'])) {
                return false;
            }
        }

        // Helmet filter
        if (hasHelmetFilter) {
            if (!helmetSet.has(casualty.HELMET)) {
                return false;
            }
        }

        // This casualty matches all active filters
        return true;
    });
}

// Helper: Check if crash matches units/vehicle-related filters
// COMBINED MATCHING: At least ONE unit must match ALL active filters simultaneously
function matchesUnitsFilters(row, filters) {
    const units = row._units || [];

    // Determine which unit filters are active
    const hasVehicleTypeFilter = !filters.selectedVehicles.includes('all');
    const hasVehicleYearFilter = !filters.selectedVehicleYears.includes('all');
    const hasOccupantsFilter = !filters.selectedOccupants.includes('all');
    const hasLicenseTypeFilter = !filters.selectedLicenseTypes.includes('all');
    const hasRegStateFilter = !filters.selectedRegStates.includes('all');
    const hasDirectionFilter = !filters.selectedDirections.includes('all');
    const hasMovementFilter = !filters.selectedMovements.includes('all');

    const hasAnyMultiSelectUnitFilter = hasVehicleTypeFilter || hasVehicleYearFilter ||
                                        hasOccupantsFilter || hasLicenseTypeFilter ||
                                        hasRegStateFilter || hasDirectionFilter || hasMovementFilter;

    // Handle Heavy Vehicle filter (yes/no filter - not combined with others)
    if (filters.heavyVehicle !== 'all') {
        if (units.length === 0) return filters.heavyVehicle !== 'yes';
        const hasHeavyVehicle = units.some(u => HEAVY_VEHICLE_TYPES.includes(u['Unit Type']));
        if (filters.heavyVehicle === 'yes' && !hasHeavyVehicle) return false;
        if (filters.heavyVehicle === 'no' && hasHeavyVehicle) return false;
    }

    // Handle Towing filter (yes/no filter - not combined with others)
    if (filters.towing !== 'all') {
        if (units.length === 0) return filters.towing !== 'Yes';
        const hasTowing = units.some(u => u.TOWING && u.TOWING.trim() !== '');
        if (filters.towing === 'Yes' && !hasTowing) return false;
        if (filters.towing === 'No' && hasTowing) return false;
    }

    // If no multi-select unit filters are active, pass
    if (!hasAnyMultiSelectUnitFilter) return true;

    // If filters are active but no units exist, fail
    if (units.length === 0) return false;

    // Create Sets for O(1) lookups (only if filters are active)
    const vehicleTypeSet = hasVehicleTypeFilter ? new Set(filters.selectedVehicles) : null;
    const vehicleYearSet = hasVehicleYearFilter ? new Set(filters.selectedVehicleYears) : null;
    const occupantsSet = hasOccupantsFilter ? new Set(filters.selectedOccupants) : null;
    const licenseTypeSet = hasLicenseTypeFilter ? new Set(filters.selectedLicenseTypes) : null;
    const regStateSet = hasRegStateFilter ? new Set(filters.selectedRegStates) : null;
    const directionSet = hasDirectionFilter ? new Set(filters.selectedDirections) : null;
    const movementSet = hasMovementFilter ? new Set(filters.selectedMovements) : null;

    // Check if ANY unit matches ALL active multi-select filters
    return units.some(unit => {
        // Vehicle Type filter
        if (hasVehicleTypeFilter) {
            if (!vehicleTypeSet.has(unit['Unit Type'])) {
                return false;
            }
        }

        // Vehicle Year filter (uses ranges: pre-2000, 2000-2010, 2011-2020, 2021+)
        if (hasVehicleYearFilter) {
            const year = parseInt(unit['Veh Year']);
            if (!isNaN(year)) {
                const matchesAnyYear = filters.selectedVehicleYears.some(range => {
                    if (range === 'pre-2000') return year < 2000;
                    if (range === '2000-2010') return year >= 2000 && year <= 2010;
                    if (range === '2011-2020') return year >= 2011 && year <= 2020;
                    if (range === '2021+') return year >= 2021;
                    return false;
                });
                if (!matchesAnyYear) return false;
            } else {
                // No valid year data - exclude if year filter is active
                return false;
            }
        }

        // Occupants filter (uses values: 1, 2, 3, 4, 5+)
        if (hasOccupantsFilter) {
            const occupantsStr = unit['Number Occupants'];
            if (occupantsStr !== undefined && occupantsStr !== null) {
                const occupants = parseInt(occupantsStr);
                if (!isNaN(occupants)) {
                    // Skip units with 0 occupants when occupants filter is active
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
                    // Invalid/unparseable occupants value - exclude
                    return false;
                }
            } else {
                // Missing occupants data - exclude
                return false;
            }
        }

        // License Type filter (NOTE: Field is 'Licence Type' with British spelling)
        if (hasLicenseTypeFilter) {
            if (!licenseTypeSet.has(unit['Licence Type'])) {
                return false;
            }
        }

        // Vehicle Reg State filter
        if (hasRegStateFilter) {
            if (!regStateSet.has(unit['Veh Reg State'])) {
                return false;
            }
        }

        // Direction of Travel filter
        if (hasDirectionFilter) {
            if (!directionSet.has(unit['Direction Of Travel'])) {
                return false;
            }
        }

        // Unit Movement filter
        if (hasMovementFilter) {
            if (!movementSet.has(unit['Unit Movement'])) {
                return false;
            }
        }

        // This unit matches all active multi-select filters
        return true;
    });
}

// Apply filters and update map
function applyFilters(isInitialLoad = false) {
    // Show loading indicator
    showLoading('Filtering crash data...');

    // Use setTimeout to ensure loading indicator renders before heavy processing
    setTimeout(() => {
        try {
            const filters = getFilterValues();

            // Filter data using helper functions
            filteredData = crashData.filter(row => {
                return matchesBasicFilters(row, filters) &&
                       matchesDateTimeFilters(row, filters) &&
                       matchesCasualtyFilters(row, filters) &&
                       matchesUnitsFilters(row, filters);
            });

            // Update statistics
            updateStatistics();

            // Update active filters display
            updateActiveFiltersDisplay();

            // Update analytics charts
            if (typeof updateChartsWithData === 'function') {
                updateChartsWithData(filteredData);
            }

            // Update map layers (pass isInitialLoad flag)
            updateMapLayers(null, isInitialLoad);

            // Update advanced filter badge
            if (typeof updateAdvancedFilterBadge === 'function') {
                updateAdvancedFilterBadge();
            }

            // Update URL with current filters
            encodeFiltersToURL();
        } catch (error) {
            console.error('Filter error:', error);
            alert('An error occurred while filtering. Please try again.');
            hideLoading();
        }
    }, 0);
}

function updateStatistics() {
    const totalCrashes = filteredData.length;
    let totalFatalities = 0;
    let totalSerious = 0;
    let totalMinor = 0;

    filteredData.forEach(row => {
        totalFatalities += parseInt(row['Total Fats'] || 0);
        totalSerious += parseInt(row['Total SI'] || 0);
        totalMinor += parseInt(row['Total MI'] || 0);
    });

    document.getElementById('totalCrashes').textContent = totalCrashes.toLocaleString();
    document.getElementById('totalFatalities').textContent = totalFatalities.toLocaleString();
    document.getElementById('totalSerious').textContent = totalSerious.toLocaleString();
    document.getElementById('totalMinor').textContent = totalMinor.toLocaleString();
}

// Update map layers based on active selections
function updateMapLayers(changedLayer = null, isInitialLoad = false) {
    try {
        // If a specific layer changed, only update that layer
        if (changedLayer) {
            if (changedLayer === 'markers') {
                if (activeLayers.markers) {
                    showLoading('Adding markers to map...');
                    try {
                        addMarkers(() => {
                            // All markers added, hide loading after brief delay
                            setTimeout(() => {
                                hideLoading();
                            }, 100);
                        });
                    } catch (error) {
                        console.error('Error adding markers:', error);
                        hideLoading();
                        alert('Error displaying markers. Please try again.');
                    }
                } else {
                    if (markersLayer) {
                        markersLayer.clearLayers();
                        if (map.hasLayer(markersLayer)) {
                        map.removeLayer(markersLayer);
                    }
                }
            }
        } else if (changedLayer === 'density') {
            if (activeLayers.density) {
                showLoading('Generating density map...');
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        addDensityMap();
                        hideLoading();
                    }, 0);
                });
            } else {
                if (densityLayer && map.hasLayer(densityLayer)) {
                    map.removeLayer(densityLayer);
                    densityLayer = null;
                }
            }
        } else if (changedLayer === 'choropleth') {
            if (activeLayers.choropleth) {
                // Clear existing choropleth layer first
                if (choroplethLayer && map.hasLayer(choroplethLayer)) {
                    map.removeLayer(choroplethLayer);
                    choroplethLayer = null;
                }

                showLoading('Rendering choropleth layer...');
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        addChoropleth();
                        hideLoading();
                    }, 0);
                });
            } else {
                if (choroplethLayer && map.hasLayer(choroplethLayer)) {
                    map.removeLayer(choroplethLayer);
                    choroplethLayer = null;
                }
            }
        }
        return;
    }

    // Full rebuild (for filters) - clear all layers first
    if (markersLayer) {
        markersLayer.clearLayers();
        if (map.hasLayer(markersLayer)) {
            map.removeLayer(markersLayer);
        }
    }
    if (densityLayer && map.hasLayer(densityLayer)) {
        map.removeLayer(densityLayer);
        densityLayer = null;
    }
    if (choroplethLayer && map.hasLayer(choroplethLayer)) {
        map.removeLayer(choroplethLayer);
        choroplethLayer = null;
    }

    // Use requestAnimationFrame to ensure loading indicator renders
    requestAnimationFrame(() => {
        setTimeout(() => {
            // Add active layers asynchronously
            if (activeLayers.markers) {
                showLoading('Adding markers to map...');
                // Progressive loading with callback
                addMarkers(() => {
                    // All markers added, continue with other layers or hide loading
                    setTimeout(() => {
                        if (activeLayers.density) {
                            showLoading('Generating density map...');
                            addDensityMap();
                        }
                        if (activeLayers.choropleth) {
                            showLoading('Rendering choropleth layer...');
                            addChoropleth();
                        }
                        hideLoading();
                    }, 100);
                });
            } else {
                // No markers, add other layers
                if (activeLayers.density) {
                    showLoading('Generating density map...');
                    addDensityMap();
                }
                if (activeLayers.choropleth) {
                    showLoading('Rendering choropleth layer...');
                    addChoropleth();
                }
                hideLoading();
            }
        }, 0);
    });
    } catch (error) {
        console.error('Error updating map layers:', error);
        hideLoading();
        alert('Error updating map display. Please refresh the page.');
    }
}

// Helper function to parse numeric values and remove leading zeros
function parseNumeric(value) {
    if (!value) return value;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? value : parsed.toString();
}

// Generate rich popup content with casualty and vehicle information
function generatePopupContent(crash) {
    try {
    const severity = crash['CSEF Severity'];
    const color = severityColors[severity] || '#808080';
    const casualties = crash._casualties || [];
    const units = crash._units || [];

    let html = `
        <div style="color: #333; font-family: 'Segoe UI', sans-serif; max-width: 400px;">
            <h3 style="margin: 0 0 10px 0; color: ${color}; font-size: 16px; border-bottom: 2px solid ${color}; padding-bottom: 5px;">
                ${severity || 'Unknown Severity'}
            </h3>

            <!-- Crash Details -->
            <div style="margin-bottom: 10px;">
                <p style="margin: 3px 0; font-size: 12px;"><strong>Date:</strong> ${crash['Crash Date Time'] || crash['Crash Date'] || 'N/A'}</p>
                <p style="margin: 3px 0; font-size: 12px;"><strong>Location:</strong> ${crash.Suburb || 'N/A'}, ${crash.Postcode || 'N/A'}</p>
                <p style="margin: 3px 0; font-size: 12px;"><strong>Type:</strong> ${crash['Crash Type'] || 'N/A'}</p>
                <p style="margin: 3px 0; font-size: 12px;"><strong>Weather:</strong> ${crash['Weather Cond'] || 'N/A'} | ${crash.DayNight || 'N/A'}</p>
                <p style="margin: 3px 0; font-size: 12px;"><strong>Road:</strong> ${crash['Road Surface'] || 'N/A'} | ${crash['Moisture Cond'] || 'N/A'}</p>
                <p style="margin: 3px 0; font-size: 12px;"><strong>Speed Limit:</strong> ${parseNumeric(crash['Area Speed']) || 'N/A'} km/h</p>
                ${crash['DUI Involved'] && crash['DUI Involved'].trim() ? '<p style="margin: 3px 0; font-size: 12px; color: red; font-weight: bold;">⚠ DUI Involved</p>' : ''}
                ${crash['Drugs Involved'] && crash['Drugs Involved'].trim() ? '<p style="margin: 3px 0; font-size: 12px; color: red; font-weight: bold;">⚠ Drugs Involved</p>' : ''}
            </div>`;

    // Casualties Section
    if (casualties.length > 0) {
        html += `
            <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #ddd;">
                <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #00d4ff;">
                    👥 Casualties (${casualties.length})
                </h4>`;

        // Group casualties by type and injury
        const casualtySummary = {};
        casualties.forEach(c => {
            const type = c['Casualty Type'] || 'Unknown';
            const injury = c['Injury Extent'] || 'Unknown';
            const key = `${type} - ${injury}`;
            casualtySummary[key] = (casualtySummary[key] || 0) + 1;
        });

        // Display summary
        Object.keys(casualtySummary).sort().forEach(key => {
            const count = casualtySummary[key];
            html += `<p style="margin: 2px 0 2px 10px; font-size: 11px;">• ${key}: ${count}</p>`;
        });

        // Show first 3 casualties in detail
        const detailedCasualties = casualties.slice(0, 3);
        if (detailedCasualties.length > 0) {
            html += `<div style="margin-top: 5px; font-size: 10px; color: #666;">`;
            detailedCasualties.forEach((c, idx) => {
                const age = parseNumeric(c.AGE) || '?';
                const sex = c.Sex || '?';
                const type = c['Casualty Type'] || 'Unknown';
                const injury = c['Injury Extent'] || 'Unknown';
                const seatbelt = c['Seat Belt'] === 'Yes' ? '🔒' : c['Seat Belt'] === 'No' ? '❌' : '';
                const helmet = c.Helmet === 'Worn' ? '🪖' : c.Helmet === 'Not Worn' ? '❌' : '';
                const hospital = c.Hospital ? ` (🏥 ${c.Hospital})` : '';

                html += `<p style="margin: 3px 0 3px 10px;">
                    ${idx + 1}. ${type}, ${age}/${sex}, ${injury} ${seatbelt}${helmet}${hospital}
                </p>`;
            });
            if (casualties.length > 3) {
                html += `<p style="margin: 3px 0 3px 10px; font-style: italic;">... and ${casualties.length - 3} more</p>`;
            }
            html += `</div>`;
        }
        html += `</div>`;
    }

    // Units/Vehicles Section
    if (units.length > 0) {
        html += `
            <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #ddd;">
                <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #00d4ff;">
                    🚗 Units Involved (${units.length})
                </h4>`;

        // Group units by type
        const unitSummary = {};
        units.forEach(u => {
            const type = u['Unit Type'] || 'Unknown';
            unitSummary[type] = (unitSummary[type] || 0) + 1;
        });

        // Display summary
        Object.keys(unitSummary).sort().forEach(type => {
            const count = unitSummary[type];
            html += `<p style="margin: 2px 0 2px 10px; font-size: 11px;">• ${type}: ${count}</p>`;
        });

        // Show first 3 units in detail
        const detailedUnits = units.slice(0, 3);
        if (detailedUnits.length > 0) {
            html += `<div style="margin-top: 5px; font-size: 10px; color: #666;">`;
            detailedUnits.forEach((u, idx) => {
                const type = u['Unit Type'] || 'Unknown';
                const year = u['Veh Year'] ? ` (${parseNumeric(u['Veh Year'])})` : '';
                const occupants = u['Number Occupants'] ? `, ${parseNumeric(u['Number Occupants'])} occupants` : '';
                const regState = u['Veh Reg State'] ? `, Reg: ${u['Veh Reg State']}` : '';
                const direction = u['Direction Of Travel'] ? `, ${u['Direction Of Travel']}` : '';
                const movement = u['Unit Movement'] ? `, ${u['Unit Movement']}` : '';

                html += `<p style="margin: 3px 0 3px 10px;">
                    ${idx + 1}. ${type}${year}${occupants}${regState}${direction}${movement}
                </p>`;
            });
            if (units.length > 3) {
                html += `<p style="margin: 3px 0 3px 10px; font-style: italic;">... and ${units.length - 3} more</p>`;
            }
            html += `</div>`;
        }
        html += `</div>`;
    }

    html += `</div>`;
    return html;
    } catch (error) {
        console.error('Error generating popup content:', error);
        return '<div style="padding: 10px; color: #ff4444;">Error loading crash details</div>';
    }
}

// Cache for marker icons to avoid recreating the same icons
const markerIconCache = {};

function getMarkerIcon(severity) {
    const color = severityColors[severity] || '#808080';

    // Return cached icon if available
    if (markerIconCache[color]) {
        return markerIconCache[color];
    }

    // Create and cache new icon
    const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
        iconSize: [12, 12]
    });

    markerIconCache[color] = icon;
    return icon;
}

// Add markers to map with progressive loading
function addMarkers(callback) {
    markersLayer.clearLayers();

    const chunkSize = 2000; // Process 2000 markers per chunk
    const totalMarkers = filteredData.length;
    let processedCount = 0;

    // Add layer to map immediately so chunks appear as they're processed
    if (!map.hasLayer(markersLayer)) {
        map.addLayer(markersLayer);
    }

    // Process markers in chunks to avoid blocking UI
    function processChunk() {
        const markers = [];
        const endIndex = Math.min(processedCount + chunkSize, totalMarkers);

        for (let i = processedCount; i < endIndex; i++) {
            const row = filteredData[i];

            // Use cached coordinates instead of converting each time
            const coords = row._coords;
            if (!coords) continue;

            const severity = row['CSEF Severity'];
            const markerIcon = getMarkerIcon(severity);

            const marker = L.marker(coords, { icon: markerIcon });

            // Lazy popup generation - create content only when popup is first opened
            let popupGenerated = false;
            marker.bindPopup(function() {
                if (!popupGenerated) {
                    popupGenerated = true;
                    return generatePopupContent(row);
                }
                return this.getPopup().getContent();
            }, { maxWidth: 450 });

            markers.push(marker);
        }

        // Add this chunk of markers
        if (markers.length > 0) {
            markersLayer.addLayers(markers);
        }

        processedCount = endIndex;

        // Update progress message
        const percentComplete = Math.round((processedCount / totalMarkers) * 100);
        updateLoadingMessage(`Adding markers to map... ${percentComplete}%`);

        // Process next chunk or finish
        if (processedCount < totalMarkers) {
            // Schedule next chunk (yield to UI thread)
            setTimeout(processChunk, 0);
        } else {
            // All markers added - call callback if provided
            if (callback) callback();
        }
    }

    // Start processing
    processChunk();
}

// Add density map layer
function addDensityMap() {
    const densityData = [];

    filteredData.forEach(row => {
        // Use cached coordinates instead of converting each time
        const coords = row._coords;
        if (!coords) return;

        // Weight by severity
        let weight = 1;
        const severity = row['CSEF Severity'];
        if (severity === '4: Fatal') weight = 4;
        else if (severity === '3: SI') weight = 3;
        else if (severity === '2: MI') weight = 2;

        densityData.push([coords[0], coords[1], weight]);
    });

    densityLayer = L.heatLayer(densityData, {
        radius: 2,
        blur: 1,
        maxZoom: 17,
        max: 1.75,  // Higher max = individual crashes show different colors by severity
        minOpacity: 0.5, 
        gradient: {
            0.0: 'rgba(0, 0, 255, 0)',
            0.2: 'rgba(0, 100, 255, 0.7)',
            0.4: 'rgba(0, 200, 200, 0.85)',
            0.6: 'rgba(0, 255, 100, 1)',
            0.75: 'rgba(255, 255, 0, 1)',
            0.85: 'rgba(255, 150, 0, 1)',
            0.9: 'rgb(255, 100, 75)',
            1.0: 'rgb(255, 170, 175)'
        }
    }).addTo(map);

    // Update line density - scale radius gradually with zoom
    map.on('zoomend', function() {
        if (densityLayer && map.hasLayer(densityLayer)) {
            const zoom = map.getZoom();

            // Step-wise radius and blur increase based on zoom level
            // Higher blur at zoomed-in levels to blend white spots smoothly
            // Default (zoom 7-12): radius 2, blur 1
            // +6 zooms (zoom 13-15): radius 3, blur 3
            // +9 zooms (zoom 16): radius 4, blur 5
            // +10 zooms (zoom 17+): radius 6, blur 6
            let radius = 2;
            let blur = 1;

            if (zoom >= 13) {
                radius = 3;
                blur = 2;
            }
            if (zoom >= 16) {
                radius = 4;
                blur = 4;
            }
            if (zoom >= 17) {
                radius = 6;
                blur = 4;
            }

            densityLayer.setOptions({
                radius: radius,
                blur: blur
            });
        }
    });
}

// Add choropleth layer (by LGA)
function addChoropleth() {
    // Check mode and delegate to appropriate function
    if (choroplethMode === 'suburb') {
        addChoroplethBySuburb();
        return;
    }

    // LGA mode (default)
    // Count crashes by LGA with normalized names
    const lgaCounts = {};
    const lgaCountsNormalized = {};

    filteredData.forEach(row => {
        // Use pre-computed LGA from CSV
        const lga = row['LGA'];

        if (lga && lga.trim()) {
            lgaCounts[lga] = (lgaCounts[lga] || 0) + 1;

            // Also count with normalized name
            const normalized = normalizeLGAName(lga);
            lgaCountsNormalized[normalized] = (lgaCountsNormalized[normalized] || 0) + 1;
        }
    });

    // Find max count for color scaling (use normalized counts)
    const maxCount = Math.max(...Object.values(lgaCountsNormalized));

    // Helper function to get color based on crash count using logarithmic scale
    function getColorForCount(count, max) {
        if (count === 0) return '#0a0a0a'; // Very dark for no crashes

        // Use logarithmic scale to compress range and show more variance
        const logCount = Math.log(count + 1);
        const logMax = Math.log(max + 1);
        const intensity = logCount / logMax;

        // Expanded granular color steps with bright colors throughout (40+ color steps)
        // Magenta/Pink range (highest values - bright and vibrant)
        if (intensity > 0.96) return '#FF00FF';   // Bright magenta (extreme)
        if (intensity > 0.92) return '#FF1AFF';   // Bright pink-magenta
        if (intensity > 0.88) return '#FF33FF';   // Hot pink-magenta
        if (intensity > 0.84) return '#FF4DCC';   // Bright pink
        if (intensity > 0.80) return '#FF66B3';   // Light bright pink
        if (intensity > 0.76) return '#FF0066';   // Deep hot pink
        if (intensity > 0.72) return '#FF0033';   // Pink-red

        // Red to Orange range (500-1000+ crashes - added many more steps for variance)
        if (intensity > 0.70) return '#FF0000';   // Pure bright red
        if (intensity > 0.69) return '#FF0D00';   // Red (slightly orange-tinted)
        if (intensity > 0.68) return '#FF1A00';   // Red-orange 1
        if (intensity > 0.67) return '#FF2600';   // Red-orange 2
        if (intensity > 0.66) return '#FF3300';   // Red-orange 3
        if (intensity > 0.65) return '#FF4000';   // Orange-red 1
        if (intensity > 0.64) return '#FF4D00';   // Orange-red 2
        if (intensity > 0.63) return '#FF5900';   // Orange-red 3
        if (intensity > 0.62) return '#FF6600';   // Orange 1
        if (intensity > 0.61) return '#FF7000';   // Orange 2
        if (intensity > 0.60) return '#FF7700';   // Orange 3
        if (intensity > 0.59) return '#FF7F00';   // Orange 4
        if (intensity > 0.58) return '#FF8800';   // Orange 5
        if (intensity > 0.57) return '#FF9000';   // Orange-yellow 1
        if (intensity > 0.56) return '#FF9900';   // Orange-yellow 2
        if (intensity > 0.55) return '#FFA200';   // Orange-yellow 3
        if (intensity > 0.54) return '#FFAA00';   // Orange-yellow 4
        if (intensity > 0.52) return '#FFB300';   // Amber 1

        // Yellow-orange range
        if (intensity > 0.48) return '#FF8C00';   // Dark orange
        if (intensity > 0.44) return '#FFA500';   // Light orange
        if (intensity > 0.40) return '#FFB700';   // Amber
        if (intensity > 0.36) return '#FFCC00';   // Gold
        if (intensity > 0.32) return '#FFE000';   // Yellow-gold
        if (intensity > 0.28) return '#FFFF00';   // Pure yellow

        // Green-yellow range
        if (intensity > 0.24) return '#D4FF00';   // Yellow-green
        if (intensity > 0.20) return '#A8FF00';   // Lime-yellow
        if (intensity > 0.18) return '#7CFC00';   // Lawn green
        if (intensity > 0.16) return '#32CD32';   // Lime green
        if (intensity > 0.14) return '#00FF00';   // Pure green

        // Cyan-green range
        if (intensity > 0.12) return '#00E68A';   // Spring green
        if (intensity > 0.10) return '#00CED1';   // Dark turquoise
        if (intensity > 0.08) return '#00BFFF';   // Deep sky blue

        // Blue range (lower values - kept bright)
        if (intensity > 0.06) return '#1E90FF';   // Dodger blue
        if (intensity > 0.04) return '#4169E1';   // Royal blue
        if (intensity > 0.02) return '#6A5ACD';   // Slate blue (brighter)
        return '#4B0082';                         // Indigo (still visible)
    }

    // Use real LGA boundaries if available
    if (lgaBoundaries && lgaBoundaries.features) {
        choroplethLayer = L.geoJSON(lgaBoundaries, {
            style: function(feature) {
                const lgaName = getLGAName(feature.properties);
                const normalizedName = normalizeLGAName(lgaName);
                const count = lgaCountsNormalized[normalizedName] || 0;
                const fillColor = getColorForCount(count, maxCount);

                return {
                    fillColor: fillColor,
                    fillOpacity: 0.65,
                    color: '#ffffff',
                    weight: 2,
                    opacity: 0.8
                };
            },
            onEachFeature: function(feature, layer) {
                const lgaName = getLGAName(feature.properties);
                const normalizedName = normalizeLGAName(lgaName);
                const count = lgaCountsNormalized[normalizedName] || 0;

                layer.bindPopup(`
                    <div style="color: #333; font-family: 'Segoe UI', sans-serif;">
                        <h3 style="margin: 0 0 10px 0; color: #00d4ff;">${lgaName}</h3>
                        <p style="margin: 5px 0;"><strong>Total Crashes:</strong> ${count.toLocaleString()}</p>
                        <p style="margin: 5px 0; font-size: 11px; color: #666;">Click to see details</p>
                    </div>
                `);

                // Hover effects
                layer.on('mouseover', function(e) {
                    this.setStyle({
                        weight: 3,
                        opacity: 1,
                        fillOpacity: 0.8
                    });
                });

                layer.on('mouseout', function(e) {
                    choroplethLayer.resetStyle(this);
                });
            }
        });

        map.addLayer(choroplethLayer);
    } else {
        // Fallback to circle visualization
        const lgaLocations = {};

        filteredData.forEach(row => {
            const lga = row['LGA'];
            if (!lga || !lga.trim()) return;

            const coords = convertCoordinates(row.ACCLOC_X, row.ACCLOC_Y);
            if (!coords) return;

            if (!lgaLocations[lga]) {
                lgaLocations[lga] = [];
            }
            lgaLocations[lga].push(coords);
        });

        choroplethLayer = L.layerGroup();

        Object.keys(lgaLocations).forEach(lga => {
            const locations = lgaLocations[lga];
            if (locations.length === 0) return;

            // Calculate centroid
            const avgLat = locations.reduce((sum, coord) => sum + coord[0], 0) / locations.length;
            const avgLng = locations.reduce((sum, coord) => sum + coord[1], 0) / locations.length;

            const count = lgaCounts[lga];
            const color = getColorForCount(count, maxCount);

            const circle = L.circle([avgLat, avgLng], {
                radius: Math.sqrt(count) * 500,
                fillColor: color,
                fillOpacity: 0.4,
                color: color,
                weight: 2,
                opacity: 0.6
            });

            circle.bindPopup(`
                <div style="color: #333;">
                    <h3 style="margin: 0 0 10px 0;">${lga}</h3>
                    <p><strong>Total Crashes:</strong> ${count}</p>
                </div>
            `);

            choroplethLayer.addLayer(circle);
        });

        map.addLayer(choroplethLayer);
    }
}

// Add choropleth layer (by Suburb)
function addChoroplethBySuburb() {
    // Check if suburb boundaries are available
    if (!suburbBoundaries || !suburbBoundaries.features) {
        console.warn('Suburb boundaries not loaded. Cannot display suburb choropleth.');
        alert('Suburb boundaries (GeoJSON) not loaded. Please upload suburb GeoJSON file to use suburb view.');
        return;
    }

    // Count crashes by suburb
    const suburbCounts = {};

    filteredData.forEach(row => {
        const suburb = row.Suburb;
        if (suburb && suburb.trim() !== '') {
            suburbCounts[suburb] = (suburbCounts[suburb] || 0) + 1;
        }
    });

    // Find max count for color scaling
    const maxCount = Math.max(...Object.values(suburbCounts));

    // Helper function to get color based on crash count (reuse same scale as LGA)
    function getColorForCount(count, max) {
        if (count === 0) return '#0a0a0a';

        const logCount = Math.log(count + 1);
        const logMax = Math.log(max + 1);
        const intensity = logCount / logMax;

        // Same color scale as LGA choropleth
        if (intensity > 0.96) return '#FF00FF';
        if (intensity > 0.92) return '#FF1AFF';
        if (intensity > 0.88) return '#FF33FF';
        if (intensity > 0.84) return '#FF4DCC';
        if (intensity > 0.80) return '#FF66B3';
        if (intensity > 0.76) return '#FF0066';
        if (intensity > 0.72) return '#FF0033';
        if (intensity > 0.70) return '#FF0000';
        if (intensity > 0.60) return '#FF6600';
        if (intensity > 0.52) return '#FFB300';
        if (intensity > 0.40) return '#FFB700';
        if (intensity > 0.28) return '#FFFF00';
        if (intensity > 0.16) return '#32CD32';
        if (intensity > 0.08) return '#00BFFF';
        if (intensity > 0.04) return '#4169E1';
        return '#4B0082';
    }

    // Render suburb boundaries
    choroplethLayer = L.geoJSON(suburbBoundaries, {
        style: function(feature) {
            // Get suburb name from GeoJSON properties (adjust property name as needed)
            const suburbName = feature.properties.suburb || feature.properties.SUBURB || feature.properties.name;
            const count = suburbCounts[suburbName] || 0;
            const fillColor = getColorForCount(count, maxCount);

            return {
                fillColor: fillColor,
                fillOpacity: 0.65,
                color: '#ffffff',
                weight: 1,
                opacity: 0.8
            };
        },
        onEachFeature: function(feature, layer) {
            const suburbName = feature.properties.suburb || feature.properties.SUBURB || feature.properties.name;
            const count = suburbCounts[suburbName] || 0;

            layer.bindPopup(`
                <div style="color: #333; font-family: 'Segoe UI', sans-serif;">
                    <h3 style="margin: 0 0 10px 0; color: #00d4ff;">${suburbName}</h3>
                    <p style="margin: 5px 0;"><strong>Total Crashes:</strong> ${count.toLocaleString()}</p>
                </div>
            `);

            // Hover effects
            layer.on('mouseover', function(e) {
                this.setStyle({
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.8
                });
            });

            layer.on('mouseout', function(e) {
                choroplethLayer.resetStyle(this);
            });
        }
    });

    map.addLayer(choroplethLayer);
}

// Toggle layer visibility
function toggleLayer(layerName) {
    activeLayers[layerName] = !activeLayers[layerName];

    const toggle = document.getElementById(`${layerName}Toggle`);
    const status = document.getElementById(`${layerName}Status`);

    if (activeLayers[layerName]) {
        toggle.classList.add('active');
        status.textContent = 'ON';
    } else {
        toggle.classList.remove('active');
        status.textContent = 'OFF';
    }

    // Pass the specific layer that changed to avoid re-rendering all layers
    updateMapLayers(layerName);
}

// Switch choropleth mode between LGA and Suburb
window.switchChoroplethMode = function(mode) {
    choroplethMode = mode;

    // Update pill toggle active state
    const lgaBtn = document.getElementById('choroplethModeLGA');
    const suburbBtn = document.getElementById('choroplethModeSuburb');

    if (mode === 'lga') {
        lgaBtn?.classList.add('active');
        suburbBtn?.classList.remove('active');
    } else {
        lgaBtn?.classList.remove('active');
        suburbBtn?.classList.add('active');
    }

    // If choropleth is currently active, refresh it
    if (activeLayers.choropleth) {
        updateMapLayers('choropleth');
    }
};

// Toggle control panel (for mobile)
function togglePanel() {
    const panel = document.getElementById('controlsPanel');
    panel.classList.toggle('visible');
}

// Toggle panel collapse/expand
function togglePanelCollapse() {
    const panel = document.getElementById('controlsPanel');
    const icon = document.getElementById('collapseIcon');

    panel.classList.toggle('collapsed');

    // Update icon based on collapsed state
    if (panel.classList.contains('collapsed')) {
        icon.textContent = '▼'; // Down arrow when collapsed
    } else {
        icon.textContent = '▲'; // Up arrow when expanded
    }
}

// Toggle active filters bar collapse/expand
function toggleActiveFilters() {
    const bar = document.getElementById('activeFiltersBar');
    bar.classList.toggle('collapsed');
}

// Helper: Create smart display value for multi-select filters
function getSmartFilterDisplay(elementId, selectedValues) {
    // Get all available options
    const menu = document.getElementById(`${elementId}Menu`);
    const element = document.getElementById(elementId);

    let allOptions = [];

    if (menu) {
        // Checkbox dropdown
        const checkboxes = menu.querySelectorAll('input[type="checkbox"]');
        allOptions = Array.from(checkboxes).map(cb => cb.value);
    } else if (element) {
        // Regular multi-select
        allOptions = Array.from(element.options).map(opt => opt.value);
    }

    // Filter out 'all' from options
    allOptions = allOptions.filter(v => v !== 'all');

    const totalCount = allOptions.length;
    const selectedCount = selectedValues.length;

    // If nothing or everything selected, shouldn't show in active filters anyway
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

// Update active filters display
function updateActiveFiltersDisplay() {
    const content = document.getElementById('activeFiltersContent');
    if (!content) return;

    const filters = getFilterValues();
    const activeFilters = [];

    // Year range (only if not full range)
    if (filters.yearFrom !== 2012 || filters.yearTo !== 2024) {
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

    // Day of Week
    if (filters.selectedDays && !filters.selectedDays.includes('all')) {
        const display = getSmartFilterDisplay('dayOfWeek', filters.selectedDays);
        if (display) activeFilters.push({ name: 'Day', value: display });
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

    // Sex
    if (filters.selectedSexes && !filters.selectedSexes.includes('all')) {
        const display = getSmartFilterDisplay('casualtySex', filters.selectedSexes);
        if (display) activeFilters.push({ name: 'Sex', value: display });
    }

    // Injury
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
        activeFilters.push({ name: 'Heavy Vehicle', value: filters.heavyVehicle });
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

    // Reg State
    if (filters.selectedRegStates && !filters.selectedRegStates.includes('all')) {
        const display = getSmartFilterDisplay('vehRegState', filters.selectedRegStates);
        if (display) activeFilters.push({ name: 'Reg State', value: display });
    }

    // Direction
    if (filters.selectedDirections && !filters.selectedDirections.includes('all')) {
        const display = getSmartFilterDisplay('directionTravel', filters.selectedDirections);
        if (display) activeFilters.push({ name: 'Direction', value: display });
    }

    // Movement
    if (filters.selectedMovements && !filters.selectedMovements.includes('all')) {
        const display = getSmartFilterDisplay('unitMovement', filters.selectedMovements);
        if (display) activeFilters.push({ name: 'Movement', value: display });
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

    // Drugs Involved
    if (filters.drugsInvolved && filters.drugsInvolved !== 'all') {
        activeFilters.push({ name: 'Drugs', value: filters.drugsInvolved });
    }

    // Update display
    const titleElement = document.querySelector('.active-filters-bar-title');

    if (activeFilters.length === 0) {
        content.innerHTML = '<div class="no-active-filters">No filters applied</div>';
        if (titleElement) {
            titleElement.textContent = '🔍 No filters';
        }
    } else {
        content.innerHTML = activeFilters.map(f =>
            `<span class="active-filter-tag">
                <span class="filter-name">${f.name}:</span>
                <span class="filter-value">${f.value}</span>
            </span>`
        ).join('');

        // Update title with count
        if (titleElement) {
            const count = activeFilters.length;
            titleElement.textContent = `🔍 ${count} filter${count !== 1 ? 's' : ''} active`;
        }
    }
}

// Update year range display and validate
// Global variables for year range
let yearRangeSlider;
let currentYearRange = [2012, 2024];

// Initialize dual-handle year range slider
function initYearRangeSlider() {
    const sliderElement = document.getElementById('yearRangeSlider');

    if (!sliderElement) return;

    yearRangeSlider = noUiSlider.create(sliderElement, {
        start: [2012, 2024],
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
            'min': 2012,
            'max': 2024
        },
        format: {
            to: function(value) { return Math.round(value); },
            from: function(value) { return Math.round(value); }
        }
    });

    // Update display when slider changes
    yearRangeSlider.on('update', function(values) {
        currentYearRange = [parseInt(values[0]), parseInt(values[1])];
        document.getElementById('yearRangeDisplay').textContent =
            `${currentYearRange[0]} - ${currentYearRange[1]}`;
    });
}

// Clear all filters
function clearFilters() {
    // Reset year range slider
    if (yearRangeSlider) {
        yearRangeSlider.set([2012, 2024]);
    }

    // Reset date range
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';

    // Reset time range
    document.getElementById('timeFrom').value = '';
    document.getElementById('timeTo').value = '';

    // Reset severity checkbox dropdown
    const severityMenu = document.getElementById('severityMenu');
    if (severityMenu) {
        severityMenu.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
        updateCheckboxDropdownDisplay('severity');
    }

    // Reset crash type checkbox dropdown
    const crashTypeMenu = document.getElementById('crashTypeMenu');
    if (crashTypeMenu) {
        crashTypeMenu.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
        updateCheckboxDropdownDisplay('crashType');
    }

    document.getElementById('weather').value = 'all';
    document.getElementById('dayNight').value = 'all';
    document.getElementById('duiInvolved').value = 'all';

    // Reset area checkbox dropdown
    const areaMenu = document.getElementById('areaMenu');
    if (areaMenu) {
        areaMenu.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
        updateCheckboxDropdownDisplay('area');
    }

    // Reset suburb checkbox dropdown
    const suburbMenu = document.getElementById('suburbMenu');
    if (suburbMenu) {
        suburbMenu.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
        updateCheckboxDropdownDisplay('suburb');
    }

    // Reset road user type multi-select
    const roadUserSelect = document.getElementById('roadUserType');
    for (let option of roadUserSelect.options) {
        option.selected = (option.value === 'all');
    }

    // Reset vehicle type multi-select
    const vehicleSelect = document.getElementById('vehicleType');
    for (let option of vehicleSelect.options) {
        option.selected = (option.value === 'all');
    }

    // Reset age group multi-select
    const ageGroupSelect = document.getElementById('ageGroup');
    for (let option of ageGroupSelect.options) {
        option.selected = (option.value === 'all');
    }

    // Reset casualty sex multi-select
    const casualtySexSelect = document.getElementById('casualtySex');
    for (let option of casualtySexSelect.options) {
        option.selected = (option.value === 'all');
    }

    // Reset injury extent multi-select
    const injuryExtentSelect = document.getElementById('injuryExtent');
    for (let option of injuryExtentSelect.options) {
        option.selected = (option.value === 'all');
    }

    // Reset seat belt multi-select
    const seatBeltSelect = document.getElementById('seatBelt');
    for (let option of seatBeltSelect.options) {
        option.selected = (option.value === 'all');
    }

    // Reset helmet multi-select
    const helmetSelect = document.getElementById('helmet');
    for (let option of helmetSelect.options) {
        option.selected = (option.value === 'all');
    }

    // Reset rollover
    document.getElementById('rollover').value = 'all';

    // Reset fire
    document.getElementById('fire').value = 'all';

    // Reset heavy vehicle
    document.getElementById('heavyVehicle').value = 'all';

    // Reset vehicle year multi-select
    const vehicleYearSelect = document.getElementById('vehicleYear');
    for (let option of vehicleYearSelect.options) {
        option.selected = (option.value === 'all');
    }

    // Reset occupants multi-select
    const occupantsSelect = document.getElementById('occupants');
    for (let option of occupantsSelect.options) {
        option.selected = (option.value === 'all');
    }

    // Reset towing
    document.getElementById('towing').value = 'all';

    // Reset road surface multi-select
    const roadSurfaceSelect = document.getElementById('roadSurface');
    for (let option of roadSurfaceSelect.options) {
        option.selected = (option.value === 'all');
    }

    // Reset moisture condition multi-select
    const moistureCondSelect = document.getElementById('moistureCond');
    for (let option of moistureCondSelect.options) {
        option.selected = (option.value === 'all');
    }

    // Reset drugs involved
    document.getElementById('drugsInvolved').value = 'all';

    // Reset license type multi-select
    const licenseTypeSelect = document.getElementById('licenseType');
    for (let option of licenseTypeSelect.options) {
        option.selected = (option.value === 'all');
    }

    // Reset vehicle reg state multi-select
    const vehRegStateSelect = document.getElementById('vehRegState');
    for (let option of vehRegStateSelect.options) {
        option.selected = (option.value === 'all');
    }

    // Reset direction of travel multi-select
    const directionTravelSelect = document.getElementById('directionTravel');
    for (let option of directionTravelSelect.options) {
        option.selected = (option.value === 'all');
    }

    // Reset unit movement multi-select
    const unitMovementSelect = document.getElementById('unitMovement');
    for (let option of unitMovementSelect.options) {
        option.selected = (option.value === 'all');
    }

    // Update advanced filter badge
    updateAdvancedFilterBadge();

    // Apply the cleared filters
    applyFilters();
}

// Advanced Filters Modal Functions
function openAdvancedFilters() {
    document.getElementById('advancedFiltersModal').style.display = 'block';
}

function closeAdvancedFilters() {
    document.getElementById('advancedFiltersModal').style.display = 'none';
}

function switchTab(tabName) {
    // Hide all tabs
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));

    // Deactivate all tab buttons
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => btn.classList.remove('active'));

    // Show selected tab
    document.getElementById(tabName + 'Tab').classList.add('active');

    // Activate selected tab button
    event.target.classList.add('active');
}

function applyAdvancedFilters() {
    closeAdvancedFilters();
    updateAdvancedFilterBadge();
    applyFilters();
}

function updateAdvancedFilterBadge() {
    let count = 0;

    // Count active advanced filters (filters that are NOT set to "all")

    // Weather
    if (document.getElementById('weather').value !== 'all') count++;

    // Day/Night
    if (document.getElementById('dayNight').value !== 'all') count++;

    // Road User Type
    const roadUserSelect = document.getElementById('roadUserType');
    const selectedRoadUsers = Array.from(roadUserSelect.selectedOptions).map(opt => opt.value);
    if (!selectedRoadUsers.includes('all')) count++;

    // Age Group
    const ageGroupSelect = document.getElementById('ageGroup');
    const selectedAges = Array.from(ageGroupSelect.selectedOptions).map(opt => opt.value);
    if (!selectedAges.includes('all')) count++;

    // Casualty Sex
    const sexSelect = document.getElementById('casualtySex');
    const selectedSexes = Array.from(sexSelect.selectedOptions).map(opt => opt.value);
    if (!selectedSexes.includes('all')) count++;

    // Injury Extent
    const injurySelect = document.getElementById('injuryExtent');
    const selectedInjuries = Array.from(injurySelect.selectedOptions).map(opt => opt.value);
    if (!selectedInjuries.includes('all')) count++;

    // Seat Belt
    const seatBeltSelect = document.getElementById('seatBelt');
    const selectedSeatBelts = Array.from(seatBeltSelect.selectedOptions).map(opt => opt.value);
    if (!selectedSeatBelts.includes('all')) count++;

    // Helmet
    const helmetSelect = document.getElementById('helmet');
    const selectedHelmets = Array.from(helmetSelect.selectedOptions).map(opt => opt.value);
    if (!selectedHelmets.includes('all')) count++;

    // Involved Entities
    const vehicleSelect = document.getElementById('vehicleType');
    const selectedVehicles = Array.from(vehicleSelect.selectedOptions).map(opt => opt.value);
    if (!selectedVehicles.includes('all')) count++;

    // Vehicle Year
    const vehicleYearSelect = document.getElementById('vehicleYear');
    const selectedYears = Array.from(vehicleYearSelect.selectedOptions).map(opt => opt.value);
    if (!selectedYears.includes('all')) count++;

    // Occupants
    const occupantsSelect = document.getElementById('occupants');
    const selectedOccupants = Array.from(occupantsSelect.selectedOptions).map(opt => opt.value);
    if (!selectedOccupants.includes('all')) count++;

    // Towing
    if (document.getElementById('towing').value !== 'all') count++;

    // Rollover
    if (document.getElementById('rollover').value !== 'all') count++;

    // Fire
    if (document.getElementById('fire').value !== 'all') count++;

    // Road Surface
    const roadSurfaceSelect = document.getElementById('roadSurface');
    const selectedRoadSurfaces = Array.from(roadSurfaceSelect.selectedOptions).map(opt => opt.value);
    if (!selectedRoadSurfaces.includes('all')) count++;

    // Moisture Condition
    const moistureCondSelect = document.getElementById('moistureCond');
    const selectedMoistureConds = Array.from(moistureCondSelect.selectedOptions).map(opt => opt.value);
    if (!selectedMoistureConds.includes('all')) count++;

    // Drugs Involved
    if (document.getElementById('drugsInvolved').value !== 'all') count++;

    // License Type
    const licenseTypeSelect = document.getElementById('licenseType');
    const selectedLicenseTypes = Array.from(licenseTypeSelect.selectedOptions).map(opt => opt.value);
    if (!selectedLicenseTypes.includes('all')) count++;

    // Vehicle Reg State
    const vehRegStateSelect = document.getElementById('vehRegState');
    const selectedRegStates = Array.from(vehRegStateSelect.selectedOptions).map(opt => opt.value);
    if (!selectedRegStates.includes('all')) count++;

    // Direction of Travel
    const directionTravelSelect = document.getElementById('directionTravel');
    const selectedDirections = Array.from(directionTravelSelect.selectedOptions).map(opt => opt.value);
    if (!selectedDirections.includes('all')) count++;

    // Unit Movement
    const unitMovementSelect = document.getElementById('unitMovement');
    const selectedMovements = Array.from(unitMovementSelect.selectedOptions).map(opt => opt.value);
    if (!selectedMovements.includes('all')) count++;

    // Time of Day
    if (document.getElementById('timeFrom').value || document.getElementById('timeTo').value) count++;

    // Update badge
    const badge = document.getElementById('advancedFilterBadge');
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

// Theme Toggle Functions
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    // Update icon
    const themeIcon = document.getElementById('themeIcon');
    themeIcon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
}

function initTheme() {
    // Check for saved theme preference or default to light
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Update icon
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
        themeIcon.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
    }
}

// URL Parameter Sharing - Encode current filters to URL
function encodeFiltersToURL() {
    const filters = getFilterValues();
    const params = new URLSearchParams();

    // Only add non-default values to keep URL clean
    if (filters.yearFrom !== 2012) params.set('yearFrom', filters.yearFrom);
    if (filters.yearTo !== 2024) params.set('yearTo', filters.yearTo);

    if (!filters.selectedSeverities.includes('all')) {
        // Trim all values to remove padding spaces
        params.set('severity', filters.selectedSeverities.map(s => s.trim()).join(','));
    }
    if (!filters.selectedCrashTypes.includes('all')) {
        params.set('crashType', filters.selectedCrashTypes.map(s => s.trim()).join(','));
    }
    if (filters.weather !== 'all') params.set('weather', filters.weather.trim());
    if (filters.dayNight !== 'all') params.set('dayNight', filters.dayNight.trim());
    if (filters.duiInvolved !== 'all') params.set('dui', filters.duiInvolved.trim());
    if (filters.drugsInvolved !== 'all') params.set('drugs', filters.drugsInvolved.trim());

    if (!filters.selectedAreas.includes('all')) {
        // Trim all area names to remove padding spaces
        params.set('areas', filters.selectedAreas.map(a => a.trim()).join(','));
    }

    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    if (filters.timeFrom) params.set('timeFrom', filters.timeFrom);
    if (filters.timeTo) params.set('timeTo', filters.timeTo);

    // Update URL without reloading page
    const newURL = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
    window.history.replaceState({}, '', newURL);
}

// URL Parameter Sharing - Load filters from URL
function loadFiltersFromURL() {
    const params = new URLSearchParams(window.location.search);

    if (!params.toString()) return; // No parameters, skip

    try {
        // Year range
        if (params.has('yearFrom') || params.has('yearTo')) {
            const yearFrom = parseInt(params.get('yearFrom')) || 2012;
            const yearTo = parseInt(params.get('yearTo')) || 2024;
            currentYearRange = [yearFrom, yearTo];
            if (yearRangeSlider) {
                yearRangeSlider.set([yearFrom, yearTo]);
            }
        }

        // Severity - handle checkbox dropdown
        if (params.has('severity')) {
            const severities = params.get('severity').split(',').map(s => s.trim());
            const menu = document.getElementById('severityMenu');
            if (menu) {
                menu.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    cb.checked = severities.includes(cb.value.trim());
                });
                updateCheckboxDropdownDisplay('severity');
            }
        }

        // Crash type filter - handle checkbox dropdown
        if (params.has('crashType')) {
            const crashTypes = params.get('crashType').split(',').map(s => s.trim());
            const menu = document.getElementById('crashTypeMenu');
            if (menu) {
                menu.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    cb.checked = crashTypes.includes(cb.value.trim());
                });
                updateCheckboxDropdownDisplay('crashType');
            }
        }
        if (params.has('weather')) {
            const weather = params.get('weather');
            const select = document.getElementById('weather');
            Array.from(select.options).forEach(opt => {
                if (opt.value.trim() === weather) select.value = opt.value;
            });
        }
        if (params.has('dayNight')) {
            const dayNight = params.get('dayNight');
            const select = document.getElementById('dayNight');
            Array.from(select.options).forEach(opt => {
                if (opt.value.trim() === dayNight) select.value = opt.value;
            });
        }
        if (params.has('dui')) {
            const dui = params.get('dui');
            const select = document.getElementById('duiInvolved');
            Array.from(select.options).forEach(opt => {
                if (opt.value.trim() === dui) select.value = opt.value;
            });
        }
        if (params.has('drugs')) {
            const drugs = params.get('drugs');
            const select = document.getElementById('drugsInvolved');
            Array.from(select.options).forEach(opt => {
                if (opt.value.trim() === drugs) select.value = opt.value;
            });
        }

        // Areas - handle checkbox dropdown
        if (params.has('areas')) {
            const areas = params.get('areas').split(',').map(a => a.trim());
            const menu = document.getElementById('areaMenu');
            if (menu) {
                menu.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    cb.checked = areas.includes(cb.value.trim());
                });
                updateCheckboxDropdownDisplay('area');
            }
        }

        // Date/time
        if (params.has('dateFrom')) document.getElementById('dateFrom').value = params.get('dateFrom');
        if (params.has('dateTo')) document.getElementById('dateTo').value = params.get('dateTo');
        if (params.has('timeFrom')) document.getElementById('timeFrom').value = params.get('timeFrom');
        if (params.has('timeTo')) document.getElementById('timeTo').value = params.get('timeTo');

        // Apply filters after loading from URL
        setTimeout(() => {
            applyFilters();
        }, 500);
    } catch (error) {
        console.error('Error loading filters from URL:', error);
    }
}

// Share current view - Copy URL to clipboard
function shareCurrentView() {
    encodeFiltersToURL();
    const url = window.location.href;

    if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
            alert('Link copied to clipboard! Share this URL to show others your current view.');
        }).catch(err => {
            // Fallback for older browsers
            prompt('Copy this link to share your current view:', url);
        });
    } else {
        prompt('Copy this link to share your current view:', url);
    }
}

// Search by Location - Geocode address and find nearby crashes
let searchMarker = null;
let searchCircle = null;

async function searchByLocation() {
    const searchInput = document.getElementById('locationSearch');
    const query = searchInput.value.trim();

    if (!query) {
        alert('Please enter a location to search');
        return;
    }

    showLoading('Searching for location...');

    try {
        // Use Nominatim geocoding (free, no API key required)
        // Bias search to South Australia
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?` +
            `q=${encodeURIComponent(query)},South Australia,Australia&` +
            `format=json&limit=1&` +
            `countrycodes=au`
        );

        if (!response.ok) throw new Error('Geocoding failed');

        const results = await response.json();

        if (results.length === 0) {
            hideLoading();
            alert('Location not found. Try searching for a suburb in South Australia.');
            return;
        }

        const location = results[0];
        const lat = parseFloat(location.lat);
        const lng = parseFloat(location.lon);

        // Get search radius
        const radiusKm = parseFloat(document.getElementById('searchRadius').value);
        const radiusMeters = radiusKm * 1000;

        // Clear previous search marker/circle
        if (searchMarker) map.removeLayer(searchMarker);
        if (searchCircle) map.removeLayer(searchCircle);

        // Add marker at search location
        searchMarker = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'search-marker',
                html: '<div style="background: #4a90e2; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            })
        }).addTo(map).bindPopup(`<strong>📍 ${location.display_name}</strong>`).openPopup();

        // Add circle showing search radius
        searchCircle = L.circle([lat, lng], {
            radius: radiusMeters,
            color: '#4a90e2',
            fillColor: '#4a90e2',
            fillOpacity: 0.1,
            weight: 2
        }).addTo(map);

        // Zoom to search area
        map.fitBounds(searchCircle.getBounds(), { padding: [50, 50] });

        // Filter crashes within radius
        const nearbyCrashes = crashData.filter(crash => {
            const coords = convertCoordinates(crash.ACCLOC_X, crash.ACCLOC_Y);
            if (!coords) return false;

            const [crashLat, crashLng] = coords;
            const distance = map.distance([lat, lng], [crashLat, crashLng]);
            return distance <= radiusMeters;
        });

        hideLoading();

        // Show results
        const resultMsg = `Found ${nearbyCrashes.length} crashes within ${radiusKm}km of "${location.display_name.split(',')[0]}"`;
        document.getElementById('searchResults').textContent = resultMsg;
        document.getElementById('searchResults').style.display = 'block';

        // Apply filter to show only nearby crashes
        filteredData = nearbyCrashes;
        updateStatistics();
        updateMapLayers();

    } catch (error) {
        console.error('Location search error:', error);
        hideLoading();
        alert('Error searching location. Please try again.');
    }
}

function clearLocationSearch() {
    // Clear search marker and circle
    if (searchMarker) map.removeLayer(searchMarker);
    if (searchCircle) map.removeLayer(searchCircle);
    searchMarker = null;
    searchCircle = null;

    // Clear input and results
    document.getElementById('locationSearch').value = '';
    document.getElementById('searchResults').style.display = 'none';

    // Reapply normal filters
    applyFilters();
}

// Toggle location search collapse/expand
function toggleLocationSearch() {
    const content = document.getElementById('locationSearchContent');
    const header = document.querySelector('.location-search-header');

    if (content.classList.contains('expanded')) {
        content.classList.remove('expanded');
        header.classList.remove('expanded');
    } else {
        content.classList.add('expanded');
        header.classList.add('expanded');
    }
}

// ============================================================================
// LOCATION SEARCH AUTOCOMPLETE
// ============================================================================

// Pre-computed list of South Australian locations
const SA_LOCATIONS = [
    // Major Cities & Regions
    { name: 'Adelaide', category: 'Major Cities' },
    { name: 'Adelaide CBD', category: 'Major Cities' },
    { name: 'Port Adelaide', category: 'Major Cities' },
    { name: 'Mount Gambier', category: 'Major Cities' },
    { name: 'Whyalla', category: 'Major Cities' },
    { name: 'Murray Bridge', category: 'Major Cities' },
    { name: 'Port Lincoln', category: 'Major Cities' },
    { name: 'Port Augusta', category: 'Major Cities' },
    { name: 'Port Pirie', category: 'Major Cities' },

    // Popular Suburbs - North
    { name: 'Gawler', category: 'Northern Suburbs' },
    { name: 'Elizabeth', category: 'Northern Suburbs' },
    { name: 'Salisbury', category: 'Northern Suburbs' },
    { name: 'Munno Para', category: 'Northern Suburbs' },
    { name: 'Parafield', category: 'Northern Suburbs' },
    { name: 'Modbury', category: 'Northern Suburbs' },
    { name: 'Tea Tree Gully', category: 'Northern Suburbs' },

    // Popular Suburbs - South
    { name: 'Morphett Vale', category: 'Southern Suburbs' },
    { name: 'Noarlunga', category: 'Southern Suburbs' },
    { name: 'Hallett Cove', category: 'Southern Suburbs' },
    { name: 'Aberfoyle Park', category: 'Southern Suburbs' },
    { name: 'Seaford', category: 'Southern Suburbs' },
    { name: 'Christies Beach', category: 'Southern Suburbs' },
    { name: 'McLaren Vale', category: 'Southern Suburbs' },
    { name: 'Victor Harbor', category: 'Southern Suburbs' },

    // Popular Suburbs - East
    { name: 'Mount Barker', category: 'Hills & East' },
    { name: 'Blackwood', category: 'Hills & East' },
    { name: 'Stirling', category: 'Hills & East' },
    { name: 'Crafers', category: 'Hills & East' },
    { name: 'Hahndorf', category: 'Hills & East' },
    { name: 'Burnside', category: 'Eastern Suburbs' },
    { name: 'Norwood', category: 'Eastern Suburbs' },
    { name: 'Magill', category: 'Eastern Suburbs' },

    // Popular Suburbs - West
    { name: 'Glenelg', category: 'Western Suburbs' },
    { name: 'Henley Beach', category: 'Western Suburbs' },
    { name: 'West Beach', category: 'Western Suburbs' },
    { name: 'Grange', category: 'Western Suburbs' },
    { name: 'Semaphore', category: 'Western Suburbs' },

    // Inner Suburbs
    { name: 'Unley', category: 'Inner Suburbs' },
    { name: 'Prospect', category: 'Inner Suburbs' },
    { name: 'Parkside', category: 'Inner Suburbs' },
    { name: 'Wayville', category: 'Inner Suburbs' },
    { name: 'Goodwood', category: 'Inner Suburbs' },
    { name: 'Hindmarsh', category: 'Inner Suburbs' },
    { name: 'Thebarton', category: 'Inner Suburbs' },

    // Major Roads/Landmarks
    { name: 'North Terrace', category: 'Major Roads' },
    { name: 'King William Street', category: 'Major Roads' },
    { name: 'South Road', category: 'Major Roads' },
    { name: 'Port Road', category: 'Major Roads' },
    { name: 'Main North Road', category: 'Major Roads' },
    { name: 'Anzac Highway', category: 'Major Roads' },
    { name: 'Brighton Road', category: 'Major Roads' },

    // Regional
    { name: 'Barossa Valley', category: 'Regional' },
    { name: 'Clare Valley', category: 'Regional' },
    { name: 'Fleurieu Peninsula', category: 'Regional' },
    { name: 'Kangaroo Island', category: 'Regional' },
    { name: 'Riverland', category: 'Regional' },
    { name: 'Eyre Peninsula', category: 'Regional' }
];

let selectedSuggestionIndex = -1;
let currentSuggestions = [];

// Expand common abbreviations in search terms
function expandAbbreviations(searchTerm) {
    const terms = [searchTerm]; // Always include original term

    // Common abbreviations map
    const abbreviations = {
        'mt': 'mount',
        'mt.': 'mount',
        'st': 'saint',
        'st.': 'saint',
        'pt': 'port',
        'pt.': 'port'
    };

    // Check if search term starts with an abbreviation
    for (const [abbr, full] of Object.entries(abbreviations)) {
        if (searchTerm.startsWith(abbr + ' ') || searchTerm.startsWith(abbr + '.')) {
            // Replace abbreviation with full word
            const expanded = searchTerm.replace(new RegExp(`^${abbr}\\.?\\s*`, 'i'), full + ' ');
            terms.push(expanded);
        }
        // Also check if searching for the full word to match abbreviations
        if (searchTerm.startsWith(full)) {
            const abbreviated = searchTerm.replace(new RegExp(`^${full}\\s*`, 'i'), abbr + ' ');
            terms.push(abbreviated);
        }
    }

    // Handle standalone abbreviations (e.g., just "mt" or "st")
    if (abbreviations[searchTerm]) {
        terms.push(abbreviations[searchTerm]);
    }

    // Reverse: if someone types "mount", also search for "mt"
    for (const [abbr, full] of Object.entries(abbreviations)) {
        if (searchTerm === full) {
            terms.push(abbr);
        }
    }

    return terms;
}

// Handle location input and show suggestions
function handleLocationInput(value) {
    const suggestionsDiv = document.getElementById('locationSuggestions');

    if (!value || value.trim() === '') {
        suggestionsDiv.classList.remove('show');
        currentSuggestions = [];
        selectedSuggestionIndex = -1;
        return;
    }

    // Filter locations - shows suggestions from the first character typed
    const searchTerm = value.toLowerCase();

    // Handle common abbreviations
    const expandedTerms = expandAbbreviations(searchTerm);

    currentSuggestions = SA_LOCATIONS.filter(loc => {
        const locName = loc.name.toLowerCase();
        // Match if location contains the search term OR any expanded abbreviations
        return expandedTerms.some(term => locName.includes(term));
    });

    if (currentSuggestions.length === 0) {
        suggestionsDiv.classList.remove('show');
        return;
    }

    // Group by category
    const grouped = {};
    currentSuggestions.forEach(loc => {
        if (!grouped[loc.category]) {
            grouped[loc.category] = [];
        }
        grouped[loc.category].push(loc);
    });

    // Build HTML
    let html = '';
    let itemIndex = 0;
    Object.keys(grouped).forEach(category => {
        if (grouped[category].length > 0) {
            html += `<div class="suggestion-category">${category}</div>`;
            grouped[category].forEach(loc => {
                const highlightedName = highlightMatch(loc.name, value);
                html += `<div class="suggestion-item" data-index="${itemIndex}" onclick="selectSuggestion('${loc.name.replace(/'/g, "\\'")}')">
                    ${highlightedName}
                </div>`;
                itemIndex++;
            });
        }
    });

    suggestionsDiv.innerHTML = html;
    suggestionsDiv.classList.add('show');
    selectedSuggestionIndex = -1;
}

// Highlight matching text
function highlightMatch(text, search) {
    const regex = new RegExp(`(${search})`, 'gi');
    return text.replace(regex, '<span class="match">$1</span>');
}

// Handle keyboard navigation
function handleLocationKeydown(event) {
    const suggestionsDiv = document.getElementById('locationSuggestions');

    if (!suggestionsDiv.classList.contains('show')) {
        return;
    }

    const items = suggestionsDiv.querySelectorAll('.suggestion-item');

    if (event.key === 'ArrowDown') {
        event.preventDefault();
        selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, items.length - 1);
        updateSelectedSuggestion(items);
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
        updateSelectedSuggestion(items);
    } else if (event.key === 'Enter') {
        event.preventDefault();
        if (selectedSuggestionIndex >= 0 && items[selectedSuggestionIndex]) {
            const locationName = currentSuggestions[selectedSuggestionIndex].name;
            selectSuggestion(locationName);
        } else {
            // Just trigger search with current input
            searchByLocation();
        }
    } else if (event.key === 'Escape') {
        suggestionsDiv.classList.remove('show');
        selectedSuggestionIndex = -1;
    }
}

// Update visual selection
function updateSelectedSuggestion(items) {
    items.forEach((item, index) => {
        if (index === selectedSuggestionIndex) {
            item.classList.add('selected');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('selected');
        }
    });
}

// Select a suggestion
function selectSuggestion(locationName) {
    const input = document.getElementById('locationSearch');
    const suggestionsDiv = document.getElementById('locationSuggestions');

    input.value = locationName;
    suggestionsDiv.classList.remove('show');
    currentSuggestions = [];
    selectedSuggestionIndex = -1;

    // Optionally auto-search
    // searchByLocation();
}

// Close suggestions when clicking outside
document.addEventListener('click', function(event) {
    const suggestionsDiv = document.getElementById('locationSuggestions');
    const input = document.getElementById('locationSearch');

    if (suggestionsDiv && input &&
        !suggestionsDiv.contains(event.target) &&
        event.target !== input) {
        suggestionsDiv.classList.remove('show');
        selectedSuggestionIndex = -1;
    }
});

// ============================================================================
// MULTI-SELECT ENHANCEMENTS
// ============================================================================

// Track original option visibility for search filtering
const originalOptionVisibility = new Map();

// Enhance a multi-select element with controls and chips
function enhanceMultiSelect(selectId, showChips = true) {
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
        markFilterAsChanged();
    });

    // Initial update
    updateMultiSelectDisplay(selectId, showChips);
}

// Update the count and chips display for a multi-select
function updateMultiSelectDisplay(selectId, showChips = true) {
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

// Select all options in a multi-select
function selectAllOptions(selectId) {
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

// Clear all selections in a multi-select
function clearAllOptions(selectId) {
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

// Remove a chip (deselect an option)
function removeChip(selectId, value) {
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

// Add search functionality for the area select
function addAreaSearch() {
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
    originalOptionVisibility.set('area', options.map(opt => ({
        element: opt,
        text: opt.text,
        value: opt.value
    })));
}

// Filter area options based on search
function filterAreaOptions(searchText) {
    const areaSelect = document.getElementById('area');
    if (!areaSelect) return;

    const originalOptions = originalOptionVisibility.get('area');
    if (!originalOptions) return;

    const search = searchText.toLowerCase().trim();

    originalOptions.forEach(optData => {
        const matches = search === '' ||
                       optData.value === 'all' ||
                       optData.text.toLowerCase().includes(search);
        optData.element.style.display = matches ? '' : 'none';
    });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function initMultiSelectEnhancements() {
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

// Export filtered crash data to CSV
function exportFilteredData() {
    if (!filteredData || filteredData.length === 0) {
        alert('No data to export. Please apply filters first.');
        return;
    }

    // Create CSV content
    let csv = '';

    // Add export metadata
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const totalCrashes = filteredData.length;

    // Count casualties
    let totalFatalities = 0;
    let totalSerious = 0;
    let totalMinor = 0;
    let totalCasualties = 0;

    filteredData.forEach(crash => {
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
    if (filters.yearStart !== 2012 || filters.yearEnd !== 2024) {
        csv += `Year Range: ${filters.yearStart} - ${filters.yearEnd}\n`;
    }
    if (!filters.selectedSeverities.includes('all')) {
        csv += `Severity: ${filters.selectedSeverities.join(', ')}\n`;
    }
    if (filters.crashType !== 'all') {
        csv += `Crash Type: ${filters.crashType}\n`;
    }
    if (filters.weather !== 'all') {
        csv += `Weather: ${filters.weather}\n`;
    }
    if (filters.dayNight !== 'all') {
        csv += `Day/Night: ${filters.dayNight}\n`;
    }
    if (filters.dui !== 'all') {
        csv += `DUI Involved: ${filters.dui}\n`;
    }
    if (filters.drugs !== 'all') {
        csv += `Drugs Involved: ${filters.drugs}\n`;
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
    filteredData.forEach(crash => {
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

    console.log(`Exported ${totalCrashes} crashes to CSV`);
}

// Helper function to escape CSV values
function escapeCSV(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

// Close modal when clicking outside of it
window.onclick = function(event) {
    const modal = document.getElementById('advancedFiltersModal');
    if (event.target === modal) {
        closeAdvancedFilters();
    }
}

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    initTheme();
    initMap();
    loadData();

    // Try to load suburb boundaries (optional - enables suburb choropleth if available)
    loadSuburbBoundaries();

    // Initialize dual-handle year range slider
    initYearRangeSlider();

    // Initialize multi-select enhancements after a short delay
    setTimeout(() => {
        initMultiSelectEnhancements();
    }, 100);

    // Load filters from URL if present (after data loads)
    setTimeout(() => {
        loadFiltersFromURL();
    }, 2000); // Wait for data to load
});
