/**
 * Configuration and Constants
 * Centralized configuration for the CrashMap application
 */

// Year range configuration
export const YEAR_RANGE = {
    MIN: 2012,
    MAX: 2024,
    DEFAULT: [2012, 2024]
};

// Data table configuration
export const DATA_TABLE = {
    PAGE_SIZE: 25,
    PAGE_SIZE_OPTIONS: [10, 25, 50, 100, 250, 500],
    DEFAULT_PAGE_SIZE: 25,
    COLUMNS: [
        { key: 'Year', label: 'Year', sortable: true },
        { key: 'Crash Date Time', label: 'Date/Time', sortable: true },
        { key: 'Suburb', label: 'Suburb', sortable: true },
        { key: 'LGA', label: 'LGA', sortable: true },
        { key: 'CSEF Severity', label: 'Severity', sortable: true },
        { key: 'Crash Type', label: 'Crash Type', sortable: true },
        { key: 'Area Speed', label: 'Speed', sortable: true },
        { key: 'Total Fats', label: 'Fatalities', sortable: true },
        { key: 'Total SI', label: 'Serious Inj.', sortable: true },
        { key: 'Total MI', label: 'Minor Inj.', sortable: true }
    ]
};

// Marker rendering configuration
export const MARKER_CONFIG = {
    CHUNK_SIZE: 20000,
    ANIMATION_DELAY: 100,
    CACHE_SIZE: 2000
};

// Severity colors
export const SEVERITY_COLORS = {
    '1: PDO': '#4a90e2',
    '2: MI': '#f39c12',
    '3: SI': '#e67e22',
    '4: Fatal': '#e74c3c'
};

// Crash type color palette
export const CRASH_TYPE_PALETTE = [
    '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
    '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b'
];

// Heavy vehicle types
export const HEAVY_VEHICLE_TYPES = [
    'RIGID TRUCK LGE GE 4.5T',
    'SEMI TRAILER',
    'BDOUBLE - ROAD TRAIN',
    'OMNIBUS',
    'Light Truck LT 4.5T'
];

// Tutorial tabs
export const TUTORIAL_TABS = ['getting-started', 'filtering', 'analytics', 'tools', 'tips'];

// Tutorial tab content mapping
export const TUTORIAL_TAB_CONTENT_MAP = {
    'getting-started': 'gettingStartedTab',
    'filtering': 'filteringTab',
    'analytics': 'analyticsTab',
    'tools': 'toolsTab',
    'tips': 'tipsTab'
};

// Filter presets
export const FILTER_PRESETS = {
    'fatal-recent': {
        name: 'Fatal Crashes (2023-2024)',
        description: 'Shows all fatal crashes from 2023-2024 to analyze recent fatality trends',
        filters: {
            yearFrom: 2023,
            yearTo: 2024,
            severities: ['4: Fatal'],
            crashTypes: [],
            areas: [],
            suburbs: []
        }
    },
    'motorcycle-night': {
        name: 'Motorcycle/Rider Crashes at Night',
        description: 'Rider crashes occurring during night time hours',
        filters: {
            yearFrom: 2012,
            yearTo: 2024,
            severities: [],
            crashTypes: [],
            areas: [],
            suburbs: [],
            dayNight: 'Night',
            roadUsers: ['Rider']
        }
    },
    'dui-crashes': {
        name: 'DUI-Related Crashes',
        description: 'Crashes where driver under influence was a factor',
        filters: {
            yearFrom: 2012,
            yearTo: 2024,
            severities: [],
            crashTypes: [],
            areas: [],
            suburbs: [],
            duiInvolved: 'Yes'
        }
    },
    'heavy-vehicle': {
        name: 'Heavy Vehicle Crashes',
        description: 'Crashes involving semi-trailers, trucks, or buses',
        filters: {
            yearFrom: 2012,
            yearTo: 2024,
            severities: [],
            crashTypes: [],
            areas: [],
            suburbs: [],
            heavyVehicle: 'yes'
        }
    },
    'pedestrian': {
        name: 'Pedestrian Casualties',
        description: 'Crashes involving pedestrian casualties',
        filters: {
            yearFrom: 2012,
            yearTo: 2024,
            severities: [],
            crashTypes: [],
            areas: [],
            suburbs: [],
            roadUsers: ['Pedestrian']
        }
    },
    'wet-weather': {
        name: 'Wet Weather Crashes',
        description: 'Crashes occurring in rainy conditions on wet roads',
        filters: {
            yearFrom: 2012,
            yearTo: 2024,
            severities: [],
            crashTypes: [],
            areas: [],
            suburbs: [],
            weather: 'Raining',
            moistureConds: ['Wet']
        }
    },
    'weekend': {
        name: 'Weekend Crashes',
        description: 'Crashes occurring on Saturdays and Sundays (Year 2023-2024 for performance)',
        filters: {
            yearFrom: 2023,
            yearTo: 2024,
            severities: [],
            crashTypes: [],
            areas: [],
            suburbs: []
            // Note: Day of week filter not available in preset system
        }
    },
    'hit-object': {
        name: 'Hit Fixed Object Crashes',
        description: 'Single vehicle crashes where vehicle hit a fixed object',
        filters: {
            yearFrom: 2012,
            yearTo: 2024,
            severities: [],
            crashTypes: ['Hit Fixed Object'],
            areas: [],
            suburbs: []
        }
    },
    'young-drivers': {
        name: 'Young Driver Crashes (Under 26)',
        description: 'Crashes involving casualties aged 0-25',
        filters: {
            yearFrom: 2012,
            yearTo: 2024,
            severities: [],
            crashTypes: [],
            areas: [],
            suburbs: [],
            ageGroups: ['0-17', '18-25']
        }
    }
};

// South Australian locations for search
export const SA_LOCATIONS = [
    { name: 'Adelaide', lat: -34.9285, lng: 138.6007 },
    { name: 'Adelaide CBD', lat: -34.9285, lng: 138.6007 },
    { name: 'North Adelaide', lat: -34.9069, lng: 138.5929 },
    { name: 'Glenelg', lat: -34.9804, lng: 138.5142 },
    { name: 'Port Adelaide', lat: -34.8467, lng: 138.5061 },
    { name: 'Brighton', lat: -35.0174, lng: 138.5234 },
    { name: 'Henley Beach', lat: -34.9197, lng: 138.4905 },
    { name: 'Semaphore', lat: -34.8394, lng: 138.4836 },
    { name: 'Modbury', lat: -34.8325, lng: 138.6825 },
    { name: 'Elizabeth', lat: -34.7184, lng: 138.6713 },
    { name: 'Salisbury', lat: -34.7651, lng: 138.6423 },
    { name: 'Mawson Lakes', lat: -34.8103, lng: 138.6143 },
    { name: 'Golden Grove', lat: -34.7865, lng: 138.7251 },
    { name: 'Prospect', lat: -34.8847, lng: 138.5943 },
    { name: 'Norwood', lat: -34.9209, lng: 138.6310 },
    { name: 'Burnside', lat: -34.9409, lng: 138.6437 },
    { name: 'Unley', lat: -34.9513, lng: 138.6066 },
    { name: 'Marion', lat: -35.0120, lng: 138.5498 },
    { name: 'Morphett Vale', lat: -35.1264, lng: 138.5198 },
    { name: 'Noarlunga', lat: -35.1437, lng: 138.4988 },
    { name: 'Seaford', lat: -35.1890, lng: 138.4732 },
    { name: 'Victor Harbor', lat: -35.5521, lng: 138.6184 },
    { name: 'Mount Barker', lat: -35.0690, lng: 138.8606 },
    { name: 'Murray Bridge', lat: -35.1196, lng: 139.2744 },
    { name: 'Gawler', lat: -34.5984, lng: 138.7445 },
    { name: 'Nuriootpa', lat: -34.4703, lng: 138.9934 },
    { name: 'Tanunda', lat: -34.5230, lng: 138.9594 },
    { name: 'Angaston', lat: -34.5033, lng: 139.0454 },
    { name: 'Clare', lat: -33.8321, lng: 138.6085 },
    { name: 'Port Pirie', lat: -33.1856, lng: 138.0166 },
    { name: 'Port Augusta', lat: -32.4938, lng: 137.7654 },
    { name: 'Whyalla', lat: -33.0333, lng: 137.5667 },
    { name: 'Port Lincoln', lat: -34.7260, lng: 135.8569 },
    { name: 'Mount Gambier', lat: -37.8287, lng: 140.7831 },
    { name: 'Millicent', lat: -37.5928, lng: 140.3514 },
    { name: 'Naracoorte', lat: -36.9577, lng: 140.7372 },
    { name: 'Bordertown', lat: -36.3120, lng: 140.7656 },
    { name: 'Renmark', lat: -34.1756, lng: 140.7464 },
    { name: 'Berri', lat: -34.4790, lng: 140.5963 },
    { name: 'Loxton', lat: -34.4512, lng: 140.5714 },
    { name: 'Waikerie', lat: -34.1818, lng: 139.9867 },
    { name: 'Kadina', lat: -33.9631, lng: 137.7152 },
    { name: 'Wallaroo', lat: -33.9369, lng: 137.6385 },
    { name: 'Moonta', lat: -34.0654, lng: 137.5873 },
    { name: 'Kingscote', lat: -35.6556, lng: 137.6380 },
    { name: 'Penola', lat: -37.3773, lng: 140.8344 },
    { name: 'Kingston SE', lat: -36.8298, lng: 139.8509 },
    { name: 'Ceduna', lat: -32.1273, lng: 133.6762 },
    { name: 'Coober Pedy', lat: -29.0135, lng: 134.7551 },
    { name: 'Roxby Downs', lat: -30.5598, lng: 136.8894 },
    { name: 'Peterborough', lat: -32.9723, lng: 138.8374 }
];

// Map defaults
export const MAP_CONFIG = {
    DEFAULT_CENTER: [-34.9285, 138.6007], // Adelaide
    DEFAULT_ZOOM: 10,
    MIN_ZOOM: 7,
    MAX_ZOOM: 18
};

// Cache configuration
export const CACHE_CONFIG = {
    MARKER_ICON_CACHE_SIZE: 1000,
    POPUP_CACHE_SIZE: 2000
};

// Loading configuration
export const LOADING_CONFIG = {
    MULTI_SELECT_DELAY: 100,
    FILTER_STATE_DELAY: 200,
    URL_LOAD_DELAY: 2000
};

// Coordinate system configuration
export const COORDINATE_SYSTEMS = {
    SOURCE: 'EPSG:3107', // GDA2020 / SA Lambert
    TARGET: 'EPSG:4326'  // WGS84
};
