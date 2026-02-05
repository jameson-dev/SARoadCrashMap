// Global variables
let map;
let crashData = [];
let casualtyData = [];
let unitsData = [];
let filteredData = [];
let lgaBoundaries = null;
let markersLayer;
let heatmapLayer;
let choroplethLayer;
let activeLayers = {
    markers: true,
    heatmap: false,
    choropleth: false
};

// Loading indicator helpers
function showLoading(message = 'Loading...') {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
        const textEl = loadingEl.querySelector('div:last-child');
        if (textEl) textEl.textContent = message;
        loadingEl.classList.remove('hidden');
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

    // Add tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    // Initialize layers
    markersLayer = L.markerClusterGroup({
        chunkedLoading: true,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        maxClusterRadius: 50,
        iconCreateFunction: function(cluster) {
            const childCount = cluster.getChildCount();
            let c = ' marker-cluster-';
            if (childCount < 10) {
                c += 'small';
            } else if (childCount < 100) {
                c += 'medium';
            } else {
                c += 'large';
            }
            return new L.DivIcon({
                html: '<div><span>' + childCount + '</span></div>',
                className: 'marker-cluster' + c,
                iconSize: new L.Point(40, 40)
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
    Papa.parse('2012-2024_DATA_SA_Crash.csv', {
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

            // Now load casualty data
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

    Papa.parse('2012-2024_DATA_SA_Casualty.csv', {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            casualtyData = results.data;
            console.log('Casualty data loaded:', casualtyData.length, 'records');

            // Now load units data
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

    Papa.parse('2012-2024_DATA_SA_Units.csv', {
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

            // Initial data load (this will show its own loading indicator)
            applyFilters();

            // Load LGA boundaries for choropleth
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

    // Link to crash data
    let linkedCount = 0;
    crashData.forEach(crash => {
        const reportId = crash.REPORT_ID;  // Use REPORT_ID (all caps, underscore) not 'Report ID'
        crash._casualties = casualtyMap[reportId] || [];
        crash._units = unitsMap[reportId] || [];
        if (crash._casualties.length > 0 || crash._units.length > 0) {
            linkedCount++;
        }
    });

    console.log('Data linking complete');
    console.log('Crashes with linked data:', linkedCount, 'out of', crashData.length);
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
    fetch('sa_lga_boundaries.geojson')
        .then(response => response.json())
        .then(data => {
            lgaBoundaries = data;
            console.log('LGA boundaries loaded:', lgaBoundaries.features.length, 'areas');

            // Pre-compute LGA assignments for crashes with N/A LGA
            precomputeLGAAssignments();
        })
        .catch(error => {
            console.warn('Could not load LGA boundaries:', error);
        });
}

// Pre-compute LGA assignments for crashes with missing/N/A LGA names
// This runs once at startup to avoid expensive point-in-polygon during rendering
function precomputeLGAAssignments() {
    if (!lgaBoundaries || !lgaBoundaries.features || typeof turf === 'undefined') {
        console.warn('Cannot pre-compute LGA assignments: boundaries or Turf.js not available');
        return;
    }

    showLoading('Pre-computing LGA assignments...');

    let naCount = 0;
    let assignedCount = 0;

    // Use requestAnimationFrame to ensure loading indicator shows
    requestAnimationFrame(() => {
        setTimeout(() => {
            crashData.forEach(row => {
                const lga = row['LGA Name'];

                // Only process crashes with N/A or missing LGA
                if (!lga || lga.trim() === '' || lga.toUpperCase() === 'N/A') {
                    naCount++;
                    const coords = convertCoordinates(row.ACCLOC_X, row.ACCLOC_Y);

                    if (coords) {
                        const [lat, lng] = coords;
                        const point = turf.point([lng, lat]);

                        for (const feature of lgaBoundaries.features) {
                            try {
                                const isInside = turf.booleanPointInPolygon(point, feature);

                                if (isInside) {
                                    row._computedLGA = getLGAName(feature.properties);
                                    assignedCount++;
                                    break;
                                }
                            } catch (e) {
                                continue;
                            }
                        }

                        // If still not found, mark as unassigned
                        if (!row._computedLGA) {
                            row._computedLGA = 'Unassigned (No LGA boundary found)';
                        }
                    }
                }
            });

            console.log(`Pre-computed LGA assignments: ${assignedCount}/${naCount} N/A crashes assigned to LGAs`);
            hideLoading();
        }, 0);
    });
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
    // Crash types
    const crashTypes = [...new Set(crashData.map(row => row['Crash Type']).filter(v => v))];
    const crashTypeSelect = document.getElementById('crashType');
    crashTypes.sort().forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        crashTypeSelect.appendChild(option);
    });

    // Weather conditions
    const weatherConditions = [...new Set(crashData.map(row => row['Weather Cond']).filter(v => v))];
    const weatherSelect = document.getElementById('weather');
    weatherConditions.sort().forEach(weather => {
        const option = document.createElement('option');
        option.value = weather;
        option.textContent = weather;
        weatherSelect.appendChild(option);
    });

    // Areas (LGA) - display full names but use abbreviated names as values
    const areas = [...new Set(crashData.map(row => row['LGA Name']).filter(v => v))];
    const areaSelect = document.getElementById('area');

    // Sort by display name instead of abbreviated name
    areas.sort((a, b) => {
        const nameA = getFullLGAName(a);
        const nameB = getFullLGAName(b);
        return nameA.localeCompare(nameB);
    }).forEach(area => {
        const option = document.createElement('option');
        option.value = area; // Keep abbreviated name as value for filtering
        option.textContent = getFullLGAName(area); // Display full name
        areaSelect.appendChild(option);
    });

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
}

// Apply filters and update map
function applyFilters() {
    // Show loading indicator
    showLoading('Filtering crash data...');

    // Use requestAnimationFrame to ensure loading indicator renders before heavy processing
    requestAnimationFrame(() => {
        setTimeout(() => {
            const yearFrom = currentYearRange[0];
            const yearTo = currentYearRange[1];
            const severitySelect = document.getElementById('severity');
            const selectedSeverities = Array.from(severitySelect.selectedOptions).map(opt => opt.value);
            const crashType = document.getElementById('crashType').value;
            const weather = document.getElementById('weather').value;
            const dayNight = document.getElementById('dayNight').value;
            const duiInvolved = document.getElementById('duiInvolved').value;
            const areaSelect = document.getElementById('area');
            const selectedAreas = Array.from(areaSelect.selectedOptions).map(opt => opt.value);
            const roadUserSelect = document.getElementById('roadUserType');
            const selectedRoadUsers = Array.from(roadUserSelect.selectedOptions).map(opt => opt.value);
            const vehicleSelect = document.getElementById('vehicleType');
            const selectedVehicles = Array.from(vehicleSelect.selectedOptions).map(opt => opt.value);

            // New filters
            const ageGroupSelect = document.getElementById('ageGroup');
            const selectedAgeGroups = Array.from(ageGroupSelect.selectedOptions).map(opt => opt.value);
            const casualtySexSelect = document.getElementById('casualtySex');
            const selectedSexes = Array.from(casualtySexSelect.selectedOptions).map(opt => opt.value);
            const injuryExtentSelect = document.getElementById('injuryExtent');
            const selectedInjuries = Array.from(injuryExtentSelect.selectedOptions).map(opt => opt.value);
            const seatBeltSelect = document.getElementById('seatBelt');
            const selectedSeatBelts = Array.from(seatBeltSelect.selectedOptions).map(opt => opt.value);
            const helmetSelect = document.getElementById('helmet');
            const selectedHelmets = Array.from(helmetSelect.selectedOptions).map(opt => opt.value);
            const rollover = document.getElementById('rollover').value;
            const fire = document.getElementById('fire').value;
            const vehicleYearSelect = document.getElementById('vehicleYear');
            const selectedVehicleYears = Array.from(vehicleYearSelect.selectedOptions).map(opt => opt.value);
            const occupantsSelect = document.getElementById('occupants');
            const selectedOccupants = Array.from(occupantsSelect.selectedOptions).map(opt => opt.value);
            const towing = document.getElementById('towing').value;

            // Filter data
            filteredData = crashData.filter(row => {
                const year = parseInt(row.Year);
                const severity = row['CSEF Severity'];

                // Year filter
                if (year < yearFrom || year > yearTo) return false;

                // Severity filter
                if (!selectedSeverities.includes('all') && !selectedSeverities.includes(severity)) {
                    return false;
                }

                // Crash type filter
                if (crashType !== 'all' && row['Crash Type'] !== crashType) return false;

                // Weather filter
                if (weather !== 'all' && row['Weather Cond'] !== weather) return false;

                // Day/Night filter
                if (dayNight !== 'all' && row.DayNight !== dayNight) return false;

                // DUI filter
                if (duiInvolved !== 'all') {
                    const hasDUI = row['DUI Involved'] && row['DUI Involved'].trim() !== '';
                    if (duiInvolved === 'Yes' && !hasDUI) return false;
                    if (duiInvolved === 'No' && hasDUI) return false;
                }

                // Area filter
                if (!selectedAreas.includes('all') && !selectedAreas.includes(row['LGA Name'])) {
                    return false;
                }

                // Road User Type filter (check casualties)
                if (!selectedRoadUsers.includes('all')) {
                    const casualties = row._casualties || [];
                    if (casualties.length === 0) return false;
                    const hasMatchingRoadUser = casualties.some(c =>
                        selectedRoadUsers.includes(c['Casualty Type'])
                    );
                    if (!hasMatchingRoadUser) return false;
                }

                // Vehicle Type filter (check units)
                if (!selectedVehicles.includes('all')) {
                    const units = row._units || [];
                    if (units.length === 0) return false;
                    const hasMatchingVehicle = units.some(u =>
                        selectedVehicles.includes(u['Unit Type'])
                    );
                    if (!hasMatchingVehicle) return false;
                }

                // Age Group filter (check casualties)
                if (!selectedAgeGroups.includes('all')) {
                    const casualties = row._casualties || [];
                    if (casualties.length === 0) return false;
                    const hasMatchingAge = casualties.some(c => {
                        const age = parseInt(c.AGE);
                        if (isNaN(age)) return false;

                        return selectedAgeGroups.some(group => {
                            if (group === '0-17') return age >= 0 && age <= 17;
                            if (group === '18-25') return age >= 18 && age <= 25;
                            if (group === '26-35') return age >= 26 && age <= 35;
                            if (group === '36-50') return age >= 36 && age <= 50;
                            if (group === '51-65') return age >= 51 && age <= 65;
                            if (group === '66+') return age >= 66;
                            return false;
                        });
                    });
                    if (!hasMatchingAge) return false;
                }

                // Casualty Sex filter (check casualties)
                if (!selectedSexes.includes('all')) {
                    const casualties = row._casualties || [];
                    if (casualties.length === 0) return false;
                    const hasMatchingSex = casualties.some(c =>
                        selectedSexes.includes(c.Sex)
                    );
                    if (!hasMatchingSex) return false;
                }

                // Injury Extent filter (check casualties)
                if (!selectedInjuries.includes('all')) {
                    const casualties = row._casualties || [];
                    if (casualties.length === 0) return false;
                    const hasMatchingInjury = casualties.some(c =>
                        selectedInjuries.includes(c['Injury Extent'])
                    );
                    if (!hasMatchingInjury) return false;
                }

                // Seat Belt filter (check casualties)
                if (!selectedSeatBelts.includes('all')) {
                    const casualties = row._casualties || [];
                    if (casualties.length === 0) return false;
                    const hasMatchingSeatBelt = casualties.some(c =>
                        selectedSeatBelts.includes(c['Seat Belt'])
                    );
                    if (!hasMatchingSeatBelt) return false;
                }

                // Helmet filter (check casualties)
                if (!selectedHelmets.includes('all')) {
                    const casualties = row._casualties || [];
                    if (casualties.length === 0) return false;
                    const hasMatchingHelmet = casualties.some(c =>
                        selectedHelmets.includes(c.Helmet)
                    );
                    if (!hasMatchingHelmet) return false;
                }

                // Rollover filter (check units)
                if (rollover !== 'all') {
                    const units = row._units || [];
                    if (units.length === 0) return false;
                    const hasRollover = units.some(u => u.Rollover === rollover);
                    if (!hasRollover) return false;
                }

                // Fire filter (check units)
                if (fire !== 'all') {
                    const units = row._units || [];
                    if (units.length === 0) return false;
                    const hasFire = units.some(u => u.Fire === fire);
                    if (!hasFire) return false;
                }

                // Vehicle Year filter (check units)
                if (!selectedVehicleYears.includes('all')) {
                    const units = row._units || [];
                    if (units.length === 0) return false;
                    const hasMatchingYear = units.some(u => {
                        const year = parseInt(u['Veh Year']);
                        if (isNaN(year)) return false;

                        return selectedVehicleYears.some(yearRange => {
                            if (yearRange === 'pre-2000') return year < 2000;
                            if (yearRange === '2000-2010') return year >= 2000 && year <= 2010;
                            if (yearRange === '2011-2020') return year >= 2011 && year <= 2020;
                            if (yearRange === '2021+') return year >= 2021;
                            return false;
                        });
                    });
                    if (!hasMatchingYear) return false;
                }

                // Number of Occupants filter (check units)
                if (!selectedOccupants.includes('all')) {
                    const units = row._units || [];
                    if (units.length === 0) return false;
                    const hasMatchingOccupants = units.some(u => {
                        const occupants = parseInt(u['Number Occupants']);
                        if (isNaN(occupants)) return false;

                        return selectedOccupants.some(range => {
                            if (range === '1') return occupants === 1;
                            if (range === '2') return occupants === 2;
                            if (range === '3-4') return occupants >= 3 && occupants <= 4;
                            if (range === '5+') return occupants >= 5;
                            return false;
                        });
                    });
                    if (!hasMatchingOccupants) return false;
                }

                // Towing filter (check units)
                if (towing !== 'all') {
                    const units = row._units || [];
                    if (units.length === 0) return false;
                    const hasTowing = units.some(u => u.Towing === towing);
                    if (!hasTowing) return false;
                }

                return true;
            });

            // Update statistics
            updateStatistics();

            // Update map layers
            updateMapLayers();

            // Update advanced filter badge
            if (typeof updateAdvancedFilterBadge === 'function') {
                updateAdvancedFilterBadge();
            }
        }, 0);
    });
}

// Update statistics panel
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
function updateMapLayers(changedLayer = null) {
    // If a specific layer changed, only update that layer
    if (changedLayer) {
        if (changedLayer === 'markers') {
            if (activeLayers.markers) {
                showLoading('Adding markers to map...');
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        addMarkers();
                        hideLoading();
                    }, 0);
                });
            } else {
                if (markersLayer) {
                    markersLayer.clearLayers();
                    if (map.hasLayer(markersLayer)) {
                        map.removeLayer(markersLayer);
                    }
                }
            }
        } else if (changedLayer === 'heatmap') {
            if (activeLayers.heatmap) {
                showLoading('Generating heatmap...');
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        addHeatmap();
                        hideLoading();
                    }, 0);
                });
            } else {
                if (heatmapLayer && map.hasLayer(heatmapLayer)) {
                    map.removeLayer(heatmapLayer);
                    heatmapLayer = null;
                }
            }
        } else if (changedLayer === 'choropleth') {
            if (activeLayers.choropleth) {
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
    if (heatmapLayer && map.hasLayer(heatmapLayer)) {
        map.removeLayer(heatmapLayer);
        heatmapLayer = null;
    }
    if (choroplethLayer && map.hasLayer(choroplethLayer)) {
        map.removeLayer(choroplethLayer);
        choroplethLayer = null;
    }

    // Use requestAnimationFrame to ensure loading indicator renders
    requestAnimationFrame(() => {
        setTimeout(() => {
            // Add active layers
            if (activeLayers.markers) {
                showLoading('Adding markers to map...');
                addMarkers();
            }
            if (activeLayers.heatmap) {
                showLoading('Generating heatmap...');
                addHeatmap();
            }
            if (activeLayers.choropleth) {
                showLoading('Rendering choropleth layer...');
                addChoropleth();
            }

            // Hide loading indicator after rendering completes
            requestAnimationFrame(() => {
                setTimeout(() => {
                    hideLoading();
                }, 100);
            });
        }, 0);
    });
}

// Generate rich popup content with casualty and vehicle information
function generatePopupContent(crash) {
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
                <p style="margin: 3px 0; font-size: 12px;"><strong>Speed Limit:</strong> ${crash['Area Speed'] || 'N/A'} km/h</p>
                ${crash['DUI Involved'] && crash['DUI Involved'].trim() ? '<p style="margin: 3px 0; font-size: 12px; color: red; font-weight: bold;">⚠ DUI Involved</p>' : ''}
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
                const age = c.AGE || '?';
                const sex = c.Sex || '?';
                const type = c['Casualty Type'] || 'Unknown';
                const injury = c['Injury Extent'] || 'Unknown';
                const seatbelt = c['Seat Belt'] === 'Yes' ? '🔒' : c['Seat Belt'] === 'No' ? '❌' : '';
                const helmet = c.Helmet === 'Worn' ? '🪖' : c.Helmet === 'Not Worn' ? '❌' : '';

                html += `<p style="margin: 3px 0 3px 10px;">
                    ${idx + 1}. ${type}, ${age}/${sex}, ${injury} ${seatbelt}${helmet}
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
                const year = u['Veh Year'] ? ` (${u['Veh Year']})` : '';
                const occupants = u['Number Occupants'] ? `, ${u['Number Occupants']} occupants` : '';

                html += `<p style="margin: 3px 0 3px 10px;">
                    ${idx + 1}. ${type}${year}${occupants}
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
}

// Add markers to map
function addMarkers() {
    markersLayer.clearLayers();

    filteredData.forEach((row, index) => {
        const coords = convertCoordinates(row.ACCLOC_X, row.ACCLOC_Y);
        if (!coords) return;

        const severity = row['CSEF Severity'];
        const color = severityColors[severity] || '#808080';

        // Create custom marker icon
        const markerIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
            iconSize: [12, 12]
        });

        const marker = L.marker(coords, { icon: markerIcon });

        // Create rich popup content
        const popupContent = generatePopupContent(row);
        marker.bindPopup(popupContent, { maxWidth: 450 });

        markersLayer.addLayer(marker);
    });

    map.addLayer(markersLayer);
}

// Add heatmap layer
function addHeatmap() {
    const heatmapData = [];

    filteredData.forEach(row => {
        const coords = convertCoordinates(row.ACCLOC_X, row.ACCLOC_Y);
        if (!coords) return;

        // Weight by severity
        let weight = 1;
        const severity = row['CSEF Severity'];
        if (severity === '4: Fatal') weight = 4;
        else if (severity === '3: SI') weight = 3;
        else if (severity === '2: MI') weight = 2;

        heatmapData.push([coords[0], coords[1], weight]);
    });

    heatmapLayer = L.heatLayer(heatmapData, {
        radius: 10,
        blur: 5,
        maxZoom: 17,
        max: 3,
        minOpacity: 0.5,      // Minimum opacity for visibility
        gradient: {
            0.0: '#0000ff',
            0.3: '#00ffff',
            0.5: '#00ff00',
            0.7: '#ffff00',
            0.9: '#ff0000',
            1.0: '#8B0000'
        }
    }).addTo(map);

    // Update heatmap radius based on zoom level for better visibility at all scales
    map.on('zoomend', function() {
        if (heatmapLayer && map.hasLayer(heatmapLayer)) {
            const zoom = map.getZoom();
            // Scale radius: larger when zoomed out, smaller when zoomed in
            const radius = Math.max(15, 35 - (zoom * 1.5));
            const blur = Math.max(10, 25 - (zoom * 1.0));

            heatmapLayer.setOptions({
                radius: radius,
                blur: blur
            });
        }
    });
}

// Add choropleth layer (by LGA)
function addChoropleth() {
    // Count crashes by LGA with normalized names
    const lgaCounts = {};
    const lgaCountsNormalized = {};

    filteredData.forEach(row => {
        let lga = row['LGA Name'];

        // Use pre-computed LGA if available (for N/A crashes)
        if ((!lga || lga.trim() === '' || lga.toUpperCase() === 'N/A') && row._computedLGA) {
            lga = row._computedLGA;
        }

        if (lga) {
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
            const lga = row['LGA Name'];
            if (!lga) return;

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

    // Reset all dropdowns
    document.getElementById('severity').value = 'all';
    // Reset multi-select by selecting all options
    const severitySelect = document.getElementById('severity');
    for (let option of severitySelect.options) {
        option.selected = (option.value === 'all');
    }

    document.getElementById('crashType').value = 'all';
    document.getElementById('weather').value = 'all';
    document.getElementById('dayNight').value = 'all';
    document.getElementById('duiInvolved').value = 'all';

    // Reset area multi-select by selecting "All Areas" option
    const areaSelect = document.getElementById('area');
    for (let option of areaSelect.options) {
        option.selected = (option.value === 'all');
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

    // Update badge
    const badge = document.getElementById('advancedFilterBadge');
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
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
    initMap();
    loadData();

    // Initialize dual-handle year range slider
    initYearRangeSlider();
});
