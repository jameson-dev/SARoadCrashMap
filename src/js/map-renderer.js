/**
 * Map Renderer Module
 * Handles all map rendering, markers, density, choropleth, and location search functionality
 */

import {
    mapState,
    dataState,
    filterState,
    drawState,
    searchState,
    cacheState,
    updateMapState,
    updateDrawState,
    updateFilterState,
    updateSearchState,
    updateCacheState,
    clearSearchState,
    clearDrawState
} from './state.js';

import {
    SEVERITY_COLORS,
    CRASH_TYPE_PALETTE,
    MARKER_CONFIG
} from './config.js';

import {
    convertCoordinates,
    escapeHtml,
    normalizeLGAName,
    getLGAName,
    showLoading,
    hideLoading,
    updateLoadingMessage
} from './utils.js';

import { updateStatistics } from './analytics.js';
import { showNotification } from './ui.js';

// ============================================================================
// CANVAS RENDERER FOR PDF EXPORT
// ============================================================================
// Create a canvas renderer for GeoJSON layers to ensure they can be captured
// by leaflet-image (which cannot capture SVG layers, only canvas/raster)
const canvasRenderer = L.canvas();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Debounce utility function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================================================
// MAP INITIALIZATION
// ============================================================================

/**
 * Initialize the Leaflet map with base layers and controls
 */
export function initMap() {
    // Define bounds for Australia (with some padding)
    const southWest = L.latLng(-44.5, 112); // Southwest corner of Australia (includes Tasmania & WA)
    const northEast = L.latLng(-10, 154.5); // Northeast corner of Australia (includes QLD & NT)
    const australiaBounds = L.latLngBounds(southWest, northEast);

    mapState.map = L.map('map', {
        center: [-34.9285, 138.6007], // Adelaide, SA
        zoom: 7,
        minZoom: 5,  // Prevent zooming out too far
        maxZoom: 19, // Allow detailed street-level zoom
        maxBounds: australiaBounds, // Restrict panning to Australia
        maxBoundsViscosity: 0.8, // Make bounds "sticky" (0.0 = soft, 1.0 = hard boundaries)
        zoomAnimation: false, // Disable zoom animation so markers update instantly
        fadeAnimation: true   // Smooth tile fade prevents flicker
    });

    // Define multiple base map layers
    const baseMaps = {
        "Dark": L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19,
            crossOrigin: 'anonymous'
        }),
        "Light": L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19,
            crossOrigin: 'anonymous'
        }),
        "Voyager": L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19,
            crossOrigin: 'anonymous'
        }),
        "Street": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
            crossOrigin: 'anonymous'
        }),
        "Satellite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
            maxZoom: 19,
            crossOrigin: 'anonymous'
        }),
        "Terrain": L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
            subdomains: 'abc',
            maxZoom: 17,
            crossOrigin: 'anonymous'
        })
    };

    // Add default layer (Dark)
    baseMaps["Dark"].addTo(mapState.map);

    // Add layer control to switch between maps
    L.control.layers(baseMaps, null, {
        position: 'topleft',
        collapsed: true
    }).addTo(mapState.map);

    // Initialize marker cluster group
    mapState.markersLayer = L.markerClusterGroup({
        chunkedLoading: true,
        chunkDelay: 1,         // Near-instant chunk processing (1ms)
        chunkInterval: 200,    // Process 200 markers per chunk for faster completion
        chunkProgress: null,   // Disable progress updates for better performance
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        maxClusterRadius: function(zoom) {
            // More aggressive clustering at lower zoom levels for better performance
            return zoom < 10 ? 80 : (zoom < 13 ? 60 : 50);
        },
        disableClusteringAtZoom: 19, // Disable clustering when fully zoomed in
        animate: true,         // Enable smooth animations during zoom
        animateAddingMarkers: true, // Enable fade-in animations for markers
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

    // Initialize draw area layer
    drawState.drawnItems = new L.FeatureGroup().addTo(mapState.map);

    // When a shape is finished drawing
    mapState.map.on(L.Draw.Event.CREATED, function(e) {
        drawState.drawnItems.clearLayers();
        drawState.drawnLayer = e.layer;
        drawState.drawnLayer.setStyle({
            color: '#4a90e2',
            weight: 2,
            dashArray: '6 4',
            fillColor: '#4a90e2',
            fillOpacity: 0.06
        });
        drawState.drawnItems.addLayer(drawState.drawnLayer);
        drawState.activeDrawHandler = null;
        document.body.classList.remove('draw-mode-active');
        updateDrawAreaUI();

        // Mark filters as changed to trigger proper state tracking
        if (typeof window.markFiltersChanged === 'function') {
            window.markFiltersChanged();
        }
    });

    // Cancel draw (Escape key or Cancel button)
    mapState.map.on(L.Draw.Event.DRAWSTOP, function() {
        drawState.activeDrawHandler = null;
        document.body.classList.remove('draw-mode-active');
        updateDrawAreaUI();
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

// ============================================================================
// MARKER RENDERING
// ============================================================================

/**
 * Get crash type color from palette
 */
export function getCrashTypeColor(type) {
    if (!cacheState.crashTypeColorMap[type]) {
        cacheState.crashTypeColorMap[type] = CRASH_TYPE_PALETTE[cacheState.crashTypeColorIndex % CRASH_TYPE_PALETTE.length];
        cacheState.crashTypeColorIndex++;
    }
    return cacheState.crashTypeColorMap[type];
}

/**
 * Set marker color mode
 */
export function setMarkerColorMode(mode) {
    filterState.markerColorMode = mode;

    // Invalidate icon cache so new-colored icons are created
    cacheState.markerIconCache = {};

    // Rebuild legend
    updateMarkerColorLegend();

    // Redraw markers if the layer is active
    if (mapState.activeLayers.markers && dataState.filteredData.length > 0) {
        addMarkers();
    }
}

/**
 * Update marker color legend based on current mode
 */
export function updateMarkerColorLegend() {
    const legend = document.getElementById('markerColorLegend');
    if (!legend) return;

    if (filterState.markerColorMode === 'severity') {
        legend.innerHTML = Object.entries(SEVERITY_COLORS).map(([label, color]) =>
            `<span class="legend-item"><span class="legend-dot" style="background:${color}"></span>${label.replace(/^\d: /,'')}</span>`
        ).join('');
    } else if (filterState.markerColorMode === 'daynight') {
        legend.innerHTML = [
            ['Day','#4a90e2'],['Night','#1a237e'],['Unknown','#808080']
        ].map(([l,c]) => `<span class="legend-item"><span class="legend-dot" style="background:${c}"></span>${l}</span>`).join('');
    } else {
        // crash type — build from current assigned map
        const entries = Object.entries(cacheState.crashTypeColorMap);
        if (entries.length === 0) {
            legend.innerHTML = '<span style="font-size:11px;color:var(--text-secondary)">Apply filters to populate</span>';
        } else {
            legend.innerHTML = entries.map(([t,c]) =>
                `<span class="legend-item"><span class="legend-dot" style="background:${c}"></span>${t}</span>`
            ).join('');
        }
    }
}

/**
 * Get marker icon based on color mode
 */
export function getMarkerIcon(row) {
    let color;
    if (filterState.markerColorMode === 'crashtype') {
        color = getCrashTypeColor(row['Crash Type'] || 'Unknown');
    } else if (filterState.markerColorMode === 'daynight') {
        const dn = row['DayNight'] || '';
        color = dn === 'Daylight' ? '#4a90e2' : dn === 'Night' ? '#1a237e' : '#808080';
    } else {
        // default: severity
        color = SEVERITY_COLORS[row['CSEF Severity']] || '#808080';
    }

    if (cacheState.markerIconCache[color]) return cacheState.markerIconCache[color];

    const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="background-color:${color};width:12px;height:12px;border-radius:50%;border:2px solid white;"></div>`,
        iconSize: [12, 12]
    });

    cacheState.markerIconCache[color] = icon;
    return icon;
}

/**
 * Add markers to map with progressive loading using requestIdleCallback
 */
export function addMarkers(callback) {
    mapState.markersLayer.clearLayers();

    // Reduce chunk size for better responsiveness (was 20000, now 5000)
    const chunkSize = 5000;
    const totalMarkers = dataState.filteredData.length;
    let processedCount = 0;

    // Add layer to map immediately so chunks appear as they're processed
    if (!mapState.map.hasLayer(mapState.markersLayer)) {
        mapState.map.addLayer(mapState.markersLayer);
    }

    // Process markers in chunks during idle time to avoid blocking UI
    function processChunk(deadline) {
        // Process as many markers as we can during this idle period
        while (processedCount < totalMarkers && (deadline.timeRemaining() > 0 || deadline.didTimeout)) {
            const markers = [];
            const endIndex = Math.min(processedCount + chunkSize, totalMarkers);

            for (let i = processedCount; i < endIndex; i++) {
                const row = dataState.filteredData[i];

                // Skip if row is undefined or null
                if (!row) continue;

                // Use cached coordinates instead of converting each time
                const coords = row._coords;
                if (!coords) continue;

                const markerIcon = getMarkerIcon(row);

                const marker = L.marker(coords, { icon: markerIcon });

                // Lazy popup generation - generate once on first open, cache the result
                let cachedPopupContent = null;
                marker.bindPopup(function() {
                    if (!cachedPopupContent) {
                        cachedPopupContent = generatePopupContent(row);
                    }
                    return cachedPopupContent;
                }, { maxWidth: 450 });

                markers.push(marker);
            }

            // Add this chunk of markers
            if (markers.length > 0) {
                mapState.markersLayer.addLayers(markers);
            }

            processedCount = endIndex;

            // Update progress message
            const percentComplete = Math.round((processedCount / totalMarkers) * 100);
            updateLoadingMessage(`Adding markers to map... ${percentComplete}%`);

            // Break if we've run out of time
            if (deadline.timeRemaining() <= 0) {
                break;
            }
        }

        // Process next chunk or finish
        if (processedCount < totalMarkers) {
            // Schedule next chunk during idle time
            requestIdleCallback(processChunk, { timeout: 1000 });
        } else {
            // All markers added - call callback if provided
            if (callback) callback();
        }
    }

    // Start processing during next idle period
    requestIdleCallback(processChunk, { timeout: 1000 });
}

// ============================================================================
// POPUP GENERATION
// ============================================================================

/**
 * Helper function to parse numeric values and remove leading zeros
 */
function parseNumeric(value) {
    if (!value) return value;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? value : parsed.toString();
}

/**
 * Toggle expanded section in a popup ("Show X more" / "Show less")
 */
export function togglePopupExpand(sectionId, linkId) {
    const section = document.getElementById(sectionId);
    const link = document.getElementById(linkId);
    if (!section || !link) return;
    const isHidden = section.style.display === 'none';
    section.style.display = isHidden ? 'block' : 'none';
    link.textContent = isHidden ? 'Show less ▲' : link.dataset.expandLabel;
}

/**
 * Generate rich popup content with casualty and vehicle information
 */
export function generatePopupContent(crash) {
    try {
        const severity = crash['CSEF Severity'];
        const color = SEVERITY_COLORS[severity] || '#808080';
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
                    <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #ef5350;">
                        🚑 Casualties - Injured/Killed (${casualties.length})
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

            // Show all casualties in detail, with overflow collapsible
            if (casualties.length > 0) {
                const rid = crash.REPORT_ID || Math.random().toString(36).slice(2);
                const casExtraId = `cas-extra-${rid}`;
                const casLinkId = `cas-link-${rid}`;
                const extraCount = casualties.length - 3;
                html += `<div style="margin-top: 5px; font-size: 10px; color: #666;">`;
                casualties.slice(0, 3).forEach((c, idx) => {
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
                if (extraCount > 0) {
                    html += `<div id="${casExtraId}" style="display:none;">`;
                    casualties.slice(3).forEach((c, idx) => {
                        const age = parseNumeric(c.AGE) || '?';
                        const sex = c.Sex || '?';
                        const type = c['Casualty Type'] || 'Unknown';
                        const injury = c['Injury Extent'] || 'Unknown';
                        const seatbelt = c['Seat Belt'] === 'Yes' ? '🔒' : c['Seat Belt'] === 'No' ? '❌' : '';
                        const helmet = c.Helmet === 'Worn' ? '🪖' : c.Helmet === 'Not Worn' ? '❌' : '';
                        const hospital = c.Hospital ? ` (🏥 ${c.Hospital})` : '';
                        html += `<p style="margin: 3px 0 3px 10px;">
                            ${idx + 4}. ${type}, ${age}/${sex}, ${injury} ${seatbelt}${helmet}${hospital}
                        </p>`;
                    });
                    html += `</div>
                    <p style="margin: 4px 0 3px 10px;">
                        <a id="${casLinkId}" href="#" data-expand-label="Show ${extraCount} more ▼"
                           onclick="togglePopupExpand('${casExtraId}','${casLinkId}'); return false;"
                           style="color:#00d4ff; font-size:11px; text-decoration:none; font-weight:600;">
                            Show ${extraCount} more ▼
                        </a>
                    </p>`;
                }
                html += `</div>`;
            }
            html += `</div>`;
        }

        // Units/Vehicles Section
        if (units.length > 0) {
            html += `
                <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #ddd;">
                    <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #ffa726;">
                        🚗 Vehicles & Drivers (${units.length})
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

            // Show all units in detail, with overflow collapsible
            if (units.length > 0) {
                const rid = crash.REPORT_ID || Math.random().toString(36).slice(2);
                const unitExtraId = `unit-extra-${rid}`;
                const unitLinkId = `unit-link-${rid}`;
                const extraCount = units.length - 3;
                html += `<div style="margin-top: 5px; font-size: 10px; color: #666;">`;
                units.slice(0, 3).forEach((u, idx) => {
                    const type = u['Unit Type'] || 'Unknown';
                    const year = u['Veh Year'] ? ` (${parseNumeric(u['Veh Year'])})` : '';
                    const occupants = u['Number Occupants'] ? `, ${parseNumeric(u['Number Occupants'])} occupants` : '';
                    const regState = u['Veh Reg State'] ? `, Reg: ${u['Veh Reg State']}` : '';
                    const direction = u['Direction Of Travel'] ? `, ${u['Direction Of Travel']}` : '';
                    const movement = u['Unit Movement'] ? `, ${u['Unit Movement']}` : '';
                    // Driver demographics
                    const driverAge = u.Age ? parseNumeric(u.Age) : '?';
                    const driverSex = u.Sex || '?';
                    const driverInfo = (u.Age || u.Sex) ? ` | Driver: ${driverAge}/${driverSex}` : '';
                    html += `<p style="margin: 3px 0 3px 10px;">
                        ${idx + 1}. ${type}${year}${occupants}${regState}${driverInfo}${direction}${movement}
                    </p>`;
                });
                if (extraCount > 0) {
                    html += `<div id="${unitExtraId}" style="display:none;">`;
                    units.slice(3).forEach((u, idx) => {
                        const type = u['Unit Type'] || 'Unknown';
                        const year = u['Veh Year'] ? ` (${parseNumeric(u['Veh Year'])})` : '';
                        const occupants = u['Number Occupants'] ? `, ${parseNumeric(u['Number Occupants'])} occupants` : '';
                        const regState = u['Veh Reg State'] ? `, Reg: ${u['Veh Reg State']}` : '';
                        const direction = u['Direction Of Travel'] ? `, ${u['Direction Of Travel']}` : '';
                        const movement = u['Unit Movement'] ? `, ${u['Unit Movement']}` : '';
                        // Driver demographics
                        const driverAge = u.Age ? parseNumeric(u.Age) : '?';
                        const driverSex = u.Sex || '?';
                        const driverInfo = (u.Age || u.Sex) ? ` | Driver: ${driverAge}/${driverSex}` : '';
                        html += `<p style="margin: 3px 0 3px 10px;">
                            ${idx + 4}. ${type}${year}${occupants}${regState}${driverInfo}${direction}${movement}
                        </p>`;
                    });
                    html += `</div>
                    <p style="margin: 4px 0 3px 10px;">
                        <a id="${unitLinkId}" href="#" data-expand-label="Show ${extraCount} more ▼"
                           onclick="togglePopupExpand('${unitExtraId}','${unitLinkId}'); return false;"
                           style="color:#00d4ff; font-size:11px; text-decoration:none; font-weight:600;">
                            Show ${extraCount} more ▼
                        </a>
                    </p>`;
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

// ============================================================================
// DENSITY/HEATMAP LAYER
// ============================================================================

/**
 * Add density map layer using Leaflet.heat
 */
export function addDensityMap() {
    // Remove any existing zoom listener to prevent accumulation on repeated calls
    if (mapState.densityZoomListener) {
        mapState.map.off('zoomend', mapState.densityZoomListener);
        mapState.densityZoomListener = null;
    }

    const densityData = [];

    dataState.filteredData.forEach(row => {
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

    // Leaflet.heat creates its canvas internally so we briefly patch getContext to
    // pass willReadFrequently:true, suppressing the Canvas2D performance warning.
    // try/finally guarantees the patch is always removed even if heatLayer throws.
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const patchedCanvases = new WeakSet();
    HTMLCanvasElement.prototype.getContext = function(type, attributes) {
        if (type === '2d' && !patchedCanvases.has(this)) {
            patchedCanvases.add(this);
            return originalGetContext.call(this, type, { ...attributes, willReadFrequently: true });
        }
        return originalGetContext.call(this, type, attributes);
    };

    try {
        mapState.densityLayer = L.heatLayer(densityData, {
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
        }).addTo(mapState.map);
    } finally {
        HTMLCanvasElement.prototype.getContext = originalGetContext;
    }

    // Scale heatmap radius/blur with zoom level; stored so it can be removed later
    mapState.densityZoomListener = function() {
        if (mapState.densityLayer && mapState.map.hasLayer(mapState.densityLayer)) {
            const zoom = mapState.map.getZoom();
            let radius = 2, blur = 1;
            if (zoom >= 13) { radius = 3; blur = 2; }
            if (zoom >= 16) { radius = 4; blur = 4; }
            if (zoom >= 17) { radius = 6; blur = 4; }
            mapState.densityLayer.setOptions({ radius, blur });
        }
    };
    mapState.map.on('zoomend', mapState.densityZoomListener);
}

// ============================================================================
// CHOROPLETH LAYERS
// ============================================================================

/**
 * Get color for count using logarithmic scale
 */
export function getColorForCount(count, max) {
    if (!max || count === 0) return '#0a0a0a';

    const logCount = Math.log(count + 1);
    const logMax   = Math.log(max   + 1);
    const intensity = logCount / logMax;

    if (intensity > 0.96) return '#FF00FF';
    if (intensity > 0.92) return '#FF1AFF';
    if (intensity > 0.88) return '#FF33FF';
    if (intensity > 0.84) return '#FF4DCC';
    if (intensity > 0.80) return '#FF66B3';
    if (intensity > 0.76) return '#FF0066';
    if (intensity > 0.72) return '#FF0033';
    if (intensity > 0.70) return '#FF0000';
    if (intensity > 0.69) return '#FF0D00';
    if (intensity > 0.68) return '#FF1A00';
    if (intensity > 0.67) return '#FF2600';
    if (intensity > 0.66) return '#FF3300';
    if (intensity > 0.65) return '#FF4000';
    if (intensity > 0.64) return '#FF4D00';
    if (intensity > 0.63) return '#FF5900';
    if (intensity > 0.62) return '#FF6600';
    if (intensity > 0.61) return '#FF7000';
    if (intensity > 0.60) return '#FF7700';
    if (intensity > 0.59) return '#FF7F00';
    if (intensity > 0.58) return '#FF8800';
    if (intensity > 0.57) return '#FF9000';
    if (intensity > 0.56) return '#FF9900';
    if (intensity > 0.55) return '#FFA200';
    if (intensity > 0.54) return '#FFAA00';
    if (intensity > 0.52) return '#FFB300';
    if (intensity > 0.48) return '#FF8C00';
    if (intensity > 0.44) return '#FFA500';
    if (intensity > 0.40) return '#FFB700';
    if (intensity > 0.36) return '#FFCC00';
    if (intensity > 0.32) return '#FFE000';
    if (intensity > 0.28) return '#FFFF00';
    if (intensity > 0.24) return '#D4FF00';
    if (intensity > 0.20) return '#A8FF00';
    if (intensity > 0.18) return '#7CFC00';
    if (intensity > 0.16) return '#32CD32';
    if (intensity > 0.14) return '#00FF00';
    if (intensity > 0.12) return '#00E68A';
    if (intensity > 0.10) return '#00CED1';
    if (intensity > 0.08) return '#00BFFF';
    if (intensity > 0.06) return '#1E90FF';
    if (intensity > 0.04) return '#4169E1';
    if (intensity > 0.02) return '#6A5ACD';
    return '#4B0082';
}

/**
 * Add choropleth layer (by LGA)
 */
export function addChoropleth() {
    // Check mode and delegate to appropriate function
    if (filterState.choroplethMode === 'suburb') {
        addChoroplethBySuburb();
        return;
    }

    // LGA mode (default)
    // Count crashes by LGA with normalized names
    const lgaCounts = {};
    const lgaCountsNormalized = {};

    dataState.filteredData.forEach(row => {
        // Use pre-computed LGA
        const lga = row['LGA'];

        if (lga && lga.trim()) {
            lgaCounts[lga] = (lgaCounts[lga] || 0) + 1;

            // Also count with normalized name
            const normalized = normalizeLGAName(lga);
            lgaCountsNormalized[normalized] = (lgaCountsNormalized[normalized] || 0) + 1;
        }
    });

    // Find max count for color scaling; guard against empty data
    const lgaValues = Object.values(lgaCountsNormalized);
    const maxCount = lgaValues.length > 0 ? Math.max(...lgaValues) : 0;

    // Use real LGA boundaries if available
    if (dataState.lgaBoundaries && dataState.lgaBoundaries.features) {
        mapState.choroplethLayer = L.geoJSON(dataState.lgaBoundaries, {
            renderer: canvasRenderer, // Use canvas renderer for PDF export compatibility
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
                    mapState.choroplethLayer.resetStyle(this);
                });
            }
        });

        mapState.map.addLayer(mapState.choroplethLayer);
    } else {
        // Fallback to circle visualization
        const lgaLocations = {};

        dataState.filteredData.forEach(row => {
            const lga = row['LGA'];
            if (!lga || !lga.trim()) return;

            const coords = row._coords;
            if (!coords) return;

            if (!lgaLocations[lga]) {
                lgaLocations[lga] = [];
            }
            lgaLocations[lga].push(coords);
        });

        mapState.choroplethLayer = L.layerGroup();

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

            mapState.choroplethLayer.addLayer(circle);
        });

        mapState.map.addLayer(mapState.choroplethLayer);
    }
}

/**
 * Add choropleth layer (by Suburb)
 */
export function addChoroplethBySuburb() {
    // Check if suburb boundaries are available
    if (!dataState.suburbBoundaries || !dataState.suburbBoundaries.features) {
        console.warn('Suburb boundaries not loaded. Cannot display suburb choropleth.');
        showNotification('Suburb boundaries not available. Suburb view cannot be displayed.', 'warning');
        return;
    }

    // Count crashes by suburb
    const suburbCounts = {};

    dataState.filteredData.forEach(row => {
        const suburb = row.Suburb;
        if (suburb && suburb.trim() !== '') {
            suburbCounts[suburb] = (suburbCounts[suburb] || 0) + 1;
        }
    });

    // Find max count for color scaling; guard against empty data
    const suburbValues = Object.values(suburbCounts);
    const maxCount = suburbValues.length > 0 ? Math.max(...suburbValues) : 0;

    // Render suburb boundaries
    mapState.choroplethLayer = L.geoJSON(dataState.suburbBoundaries, {
        renderer: canvasRenderer, // Use canvas renderer for PDF export compatibility
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
                mapState.choroplethLayer.resetStyle(this);
            });
        }
    });

    mapState.map.addLayer(mapState.choroplethLayer);
}

/**
 * Switch choropleth mode between LGA and Suburb
 * @param {string} mode - 'lga' or 'suburb'
 */
export function switchChoroplethMode(mode) {
    // Update choropleth mode in filter state
    updateFilterState({ choroplethMode: mode });

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
    if (mapState.activeLayers.choropleth) {
        updateMapLayers('choropleth');
    }
}

// ============================================================================
// LAYER MANAGEMENT
// ============================================================================

/**
 * Update map layers based on active selections
 */
export function updateMapLayers(changedLayer = null) {
    try {
        // If a specific layer changed, only update that layer
        if (changedLayer) {
            if (changedLayer === 'markers') {
                if (mapState.activeLayers.markers) {
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
                        showNotification('Error displaying markers. Please try again.', 'error');
                    }
                } else {
                    if (mapState.markersLayer) {
                        mapState.markersLayer.clearLayers();
                        if (mapState.map.hasLayer(mapState.markersLayer)) {
                            mapState.map.removeLayer(mapState.markersLayer);
                        }
                    }
                }
            } else if (changedLayer === 'density') {
                if (mapState.activeLayers.density) {
                    showLoading('Generating density map...');
                    requestAnimationFrame(() => {
                        setTimeout(() => {
                            addDensityMap();
                            hideLoading();
                        }, 0);
                    });
                } else {
                    if (mapState.densityLayer && mapState.map.hasLayer(mapState.densityLayer)) {
                        mapState.map.removeLayer(mapState.densityLayer);
                        mapState.densityLayer = null;
                    }
                    if (mapState.densityZoomListener) {
                        mapState.map.off('zoomend', mapState.densityZoomListener);
                        mapState.densityZoomListener = null;
                    }
                }
            } else if (changedLayer === 'choropleth') {
                if (mapState.activeLayers.choropleth) {
                    // Clear existing choropleth layer first
                    if (mapState.choroplethLayer && mapState.map.hasLayer(mapState.choroplethLayer)) {
                        mapState.map.removeLayer(mapState.choroplethLayer);
                        mapState.choroplethLayer = null;
                    }

                    showLoading('Rendering choropleth layer...');
                    requestAnimationFrame(() => {
                        setTimeout(() => {
                            addChoropleth();
                            hideLoading();
                        }, 0);
                    });
                } else {
                    if (mapState.choroplethLayer && mapState.map.hasLayer(mapState.choroplethLayer)) {
                        mapState.map.removeLayer(mapState.choroplethLayer);
                        mapState.choroplethLayer = null;
                    }
                }
            }
            return;
        }

        // Full rebuild (for filters) - clear all layers first
        if (mapState.markersLayer) {
            mapState.markersLayer.clearLayers();
            if (mapState.map.hasLayer(mapState.markersLayer)) {
                mapState.map.removeLayer(mapState.markersLayer);
            }
        }
        if (mapState.densityLayer && mapState.map.hasLayer(mapState.densityLayer)) {
            mapState.map.removeLayer(mapState.densityLayer);
            mapState.densityLayer = null;
        }
        if (mapState.densityZoomListener) {
            mapState.map.off('zoomend', mapState.densityZoomListener);
            mapState.densityZoomListener = null;
        }
        if (mapState.choroplethLayer && mapState.map.hasLayer(mapState.choroplethLayer)) {
            mapState.map.removeLayer(mapState.choroplethLayer);
            mapState.choroplethLayer = null;
        }

        // Use requestAnimationFrame to ensure loading indicator renders
        requestAnimationFrame(() => {
            setTimeout(() => {
                // Add active layers asynchronously
                if (mapState.activeLayers.markers) {
                    showLoading('Adding markers to map...');
                    // Progressive loading with callback
                    addMarkers(() => {
                        // All markers added, continue with other layers or hide loading
                        setTimeout(() => {
                            if (mapState.activeLayers.density) {
                                showLoading('Generating density map...');
                                addDensityMap();
                            }
                            if (mapState.activeLayers.choropleth) {
                                showLoading('Rendering choropleth layer...');
                                addChoropleth();
                            }
                            hideLoading();
                        }, 100);
                    });
                } else {
                    // No markers, add other layers
                    if (mapState.activeLayers.density) {
                        showLoading('Generating density map...');
                        addDensityMap();
                    }
                    if (mapState.activeLayers.choropleth) {
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
        showNotification('Error updating map display. Please refresh the page.', 'error');
    }
}

/**
 * Toggle layer visibility
 */
export function toggleLayer(layerName) {
    mapState.activeLayers[layerName] = !mapState.activeLayers[layerName];

    const toggle = document.getElementById(`${layerName}Toggle`);
    const status = document.getElementById(`${layerName}Status`);

    if (mapState.activeLayers[layerName]) {
        toggle?.classList.add('active');
        if (status) status.textContent = 'ON';
    } else {
        toggle?.classList.remove('active');
        if (status) status.textContent = 'OFF';
    }

    // Pass the specific layer that changed to avoid re-rendering all layers
    updateMapLayers(layerName);
}

// ============================================================================
// LOCATION SEARCH
// ============================================================================

// South Australian locations for autocomplete
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

/**
 * Expand common abbreviations in search terms
 */
export function expandAbbreviations(searchTerm) {
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

/**
 * Highlight matching text
 */
export function highlightMatch(text, search) {
    const safeText = escapeHtml(text);
    if (!search) return safeText;
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedSearch})`, 'gi');
    return safeText.replace(regex, '<span class="match">$1</span>');
}

/**
 * Internal function to process location input and show suggestions
 * @param {string} value - Input value
 */
function processLocationInput(value) {
    const suggestionsDiv = document.getElementById('locationSuggestions');

    if (!value || value.trim() === '') {
        suggestionsDiv?.classList.remove('show');
        searchState.currentSuggestions = [];
        searchState.selectedSuggestionIndex = -1;
        return;
    }

    // Filter locations - shows suggestions from the first character typed
    const searchTerm = value.toLowerCase();

    // Handle common abbreviations
    const expandedTerms = expandAbbreviations(searchTerm);

    searchState.currentSuggestions = SA_LOCATIONS.filter(loc => {
        const locName = loc.name.toLowerCase();
        // Match if location contains the search term OR any expanded abbreviations
        return expandedTerms.some(term => locName.includes(term));
    });

    if (searchState.currentSuggestions.length === 0) {
        suggestionsDiv?.classList.remove('show');
        return;
    }

    // Group by category
    const grouped = {};
    searchState.currentSuggestions.forEach(loc => {
        if (!grouped[loc.category]) {
            grouped[loc.category] = [];
        }
        grouped[loc.category].push(loc);
    });

    // Build HTML with accessibility attributes
    let html = '';
    let itemIndex = 0;
    Object.keys(grouped).forEach(category => {
        if (grouped[category].length > 0) {
            html += `<div class="suggestion-category" role="presentation">${category}</div>`;
            grouped[category].forEach(loc => {
                const highlightedName = highlightMatch(loc.name, value);
                const escapedName = loc.name.replace(/'/g, "\\'");
                html += `<div class="suggestion-item"
                    data-index="${itemIndex}"
                    role="option"
                    tabindex="0"
                    aria-label="Select ${loc.name}"
                    onclick="selectSuggestion('${escapedName}')"
                    onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();selectSuggestion('${escapedName}');}">
                    ${highlightedName}
                </div>`;
                itemIndex++;
            });
        }
    });

    if (suggestionsDiv) {
        suggestionsDiv.innerHTML = html;
        suggestionsDiv.classList.add('show');
        suggestionsDiv.setAttribute('role', 'listbox');
        suggestionsDiv.setAttribute('aria-label', 'Location suggestions');
    }
    searchState.selectedSuggestionIndex = -1;
}

/**
 * Handle location input and show suggestions (debounced)
 * Debounced to improve performance and reduce DOM updates
 */
export const handleLocationInput = debounce(processLocationInput, 200);

/**
 * Select a suggestion
 */
export function selectSuggestion(locationName) {
    const input = document.getElementById('locationSearch');
    const suggestionsDiv = document.getElementById('locationSuggestions');

    if (input) input.value = locationName;
    suggestionsDiv?.classList.remove('show');
    searchState.currentSuggestions = [];
    searchState.selectedSuggestionIndex = -1;
}

/**
 * Clear location search and markers
 */
export function clearLocationSearch() {
    // Clear search marker and circle
    if (searchState.searchMarker) {
        mapState.map.removeLayer(searchState.searchMarker);
        searchState.searchMarker = null;
    }
    if (searchState.searchCircle) {
        mapState.map.removeLayer(searchState.searchCircle);
        searchState.searchCircle = null;
    }

    // Clear input and results
    const input = document.getElementById('locationSearch');
    const results = document.getElementById('searchResults');
    if (input) input.value = '';
    if (results) results.style.display = 'none';

    // Mark filters as changed to trigger proper state tracking
    if (typeof window.markFiltersChanged === 'function') {
        window.markFiltersChanged();
    }
}

/**
 * Search by location - Geocode address and find nearby crashes
 */
export async function searchByLocation() {
    const searchInput = document.getElementById('locationSearch');
    const query = searchInput?.value.trim();

    if (!query) {
        showNotification('Please enter a location to search', 'warning');
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
            showNotification('Location not found. Try searching for a suburb in South Australia.', 'warning');
            return;
        }

        const location = results[0];
        const lat = parseFloat(location.lat);
        const lng = parseFloat(location.lon);

        // Get search radius
        const radiusKm = parseFloat(document.getElementById('searchRadius')?.value || 5);
        const radiusMeters = radiusKm * 1000;

        // Clear previous search marker/circle
        if (searchState.searchMarker) {
            mapState.map.removeLayer(searchState.searchMarker);
        }
        if (searchState.searchCircle) {
            mapState.map.removeLayer(searchState.searchCircle);
        }

        // Add marker at search location
        searchState.searchMarker = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'search-marker',
                html: '<div style="background: #4a90e2; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            })
        }).addTo(mapState.map).bindPopup(`<strong>📍 ${location.display_name}</strong>`).openPopup();

        // Add circle showing search radius
        searchState.searchCircle = L.circle([lat, lng], {
            radius: radiusMeters,
            color: '#4a90e2',
            fillColor: '#4a90e2',
            fillOpacity: 0.1,
            weight: 2
        }).addTo(mapState.map);

        // Zoom to search area
        mapState.map.fitBounds(searchState.searchCircle.getBounds(), { padding: [50, 50] });

        // Filter crashes within radius
        const nearbyCrashes = dataState.crashData.filter(crash => {
            const coords = convertCoordinates(crash.ACCLOC_X, crash.ACCLOC_Y);
            if (!coords) return false;

            const [crashLat, crashLng] = coords;
            const distance = mapState.map.distance([lat, lng], [crashLat, crashLng]);
            return distance <= radiusMeters;
        });

        hideLoading();

        // Show results
        const resultMsg = `Found ${nearbyCrashes.length} crashes within ${radiusKm}km of "${location.display_name.split(',')[0]}"`;
        const resultsEl = document.getElementById('searchResults');
        if (resultsEl) {
            resultsEl.textContent = resultMsg;
            resultsEl.style.display = 'block';
        }

        // Apply filter to show only nearby crashes
        dataState.filteredData = nearbyCrashes;
        updateStatistics();
        updateMapLayers();

    } catch (error) {
        console.error('Location search error:', error);
        hideLoading();
        showNotification('Error searching location. Please try again.', 'error');
    }
}

/**
 * Toggle location search collapse/expand
 */
export function toggleLocationSearch() {
    const content = document.getElementById('locationSearchContent');
    const header  = content ? content.previousElementSibling : null;
    const row     = document.querySelector('.spatial-filters-row');
    const drawContent = document.getElementById('drawAreaContent');
    const drawHeader  = drawContent ? drawContent.previousElementSibling : null;
    const drawIcon    = document.getElementById('drawAreaToggleIcon');

    if (!content) return;
    const isOpen = content.classList.contains('expanded');

    if (!isOpen) {
        // Opening search — close draw and take full width
        if (drawContent) {
            drawContent.classList.remove('expanded');
            if (drawHeader) drawHeader.classList.remove('expanded');
            if (drawIcon) drawIcon.textContent = '▼';
        }
        content.classList.add('expanded');
        if (header) header.classList.add('expanded');
        if (row) {
            row.classList.remove('draw-active');
            row.classList.add('search-active');
        }
    } else {
        // Closing search — restore equal width
        content.classList.remove('expanded');
        if (header) header.classList.remove('expanded');
        if (row) row.classList.remove('search-active');
    }
}

// ============================================================================
// DRAW TOOLS
// ============================================================================

/**
 * Toggle draw area section
 */
export function toggleDrawAreaSection() {
    const content = document.getElementById('drawAreaContent');
    const header  = content ? content.previousElementSibling : null;
    const icon    = document.getElementById('drawAreaToggleIcon');
    const row     = document.querySelector('.spatial-filters-row');
    const searchContent = document.getElementById('locationSearchContent');
    const searchHeader  = searchContent ? searchContent.previousElementSibling : null;

    if (!content) return;
    const isOpen = content.classList.contains('expanded');

    if (!isOpen) {
        // Opening draw — close search and take full width
        if (searchContent) {
            searchContent.classList.remove('expanded');
            if (searchHeader) searchHeader.classList.remove('expanded');
        }
        content.classList.add('expanded');
        if (header) header.classList.add('expanded');
        if (icon) icon.textContent = '▲';
        if (row) {
            row.classList.remove('search-active');
            row.classList.add('draw-active');
        }
    } else {
        // Closing draw — restore equal width
        content.classList.remove('expanded');
        if (header) header.classList.remove('expanded');
        if (icon) icon.textContent = '▼';
        if (row) row.classList.remove('draw-active');
    }
}

/**
 * Start drawing area (rectangle or polygon)
 */
export function startDrawArea(type) {
    if (!mapState.map || typeof L.Draw === 'undefined') return;

    // Cancel any in-progress drawing first
    cancelDrawMode();

    const shapeOpts = { color: '#4a90e2', weight: 2, dashArray: '6 4', fillColor: '#4a90e2', fillOpacity: 0.06 };
    if (type === 'rectangle') {
        drawState.activeDrawHandler = new L.Draw.Rectangle(mapState.map, { shapeOptions: shapeOpts });
    } else {
        drawState.activeDrawHandler = new L.Draw.Polygon(mapState.map, {
            shapeOptions: shapeOpts,
            allowIntersection: false,
            showArea: true
        });
    }
    drawState.activeDrawHandler.enable();

    // Show hint on map
    const hint = document.getElementById('drawModeHint');
    const hintText = document.querySelector('.draw-mode-hint-text');
    if (hintText) {
        hintText.textContent = type === 'rectangle'
            ? 'Click and drag to draw a rectangle'
            : 'Click to place vertices — double-click to finish';
    }
    if (hint) hint.classList.add('visible');
    document.body.classList.add('draw-mode-active');
}

/**
 * Cancel draw mode
 */
export function cancelDrawMode() {
    if (drawState.activeDrawHandler) {
        drawState.activeDrawHandler.disable();
        drawState.activeDrawHandler = null;
    }
    document.body.classList.remove('draw-mode-active');
    const hint = document.getElementById('drawModeHint');
    if (hint) hint.classList.remove('visible');
    updateDrawAreaUI();
}

/**
 * Clear drawn area
 */
export function clearDrawArea() {
    cancelDrawMode();
    if (drawState.drawnItems) drawState.drawnItems.clearLayers();
    drawState.drawnLayer = null;
    updateDrawAreaUI();

    // Mark filters as changed to trigger proper state tracking
    if (typeof window.markFiltersChanged === 'function') {
        window.markFiltersChanged();
    }
}

/**
 * Update draw area UI
 */
export function updateDrawAreaUI() {
    const statusEl = document.getElementById('drawAreaStatus');
    const clearBtn = document.getElementById('drawAreaClearBtn');
    const rectBtn  = document.getElementById('drawRectBtn');
    const polyBtn  = document.getElementById('drawPolyBtn');
    const isDrawing = !!drawState.activeDrawHandler;

    if (statusEl) {
        if (drawState.drawnLayer) {
            statusEl.textContent = 'Area active — crashes filtered to drawn shape';
            statusEl.style.display = 'block';
        } else if (isDrawing) {
            statusEl.textContent = 'Drawing… double-click to finish polygon, or drag to finish rectangle';
            statusEl.style.display = 'block';
        } else {
            statusEl.style.display = 'none';
        }
    }
    if (clearBtn) clearBtn.style.display = drawState.drawnLayer ? 'block' : 'none';
    if (rectBtn)  rectBtn.classList.toggle('draw-btn-active', isDrawing);
    if (polyBtn)  polyBtn.classList.toggle('draw-btn-active', isDrawing);
}

// Make togglePopupExpand available globally for onclick handlers
window.togglePopupExpand = togglePopupExpand;
