/**
 * Modal Content Module
 * Contains HTML content for large modals to reduce initial HTML size
 * Content is loaded lazily when modals are first opened
 */

const LAST_UPDATED = 'February 2026';

export const MODAL_CONTENT = {
    disclaimer: `<div class="info-modal-header">
            <h1>Disclaimer</h1>
            <button class="info-modal-close" onclick="closeInfoModal('disclaimerModal')">Close</button>
        </div>
        <div class="info-modal-container">
            <div class="important-notice">
                <h3>⚠️ Important Notice</h3>
                <p><strong>This website is provided for informational and visualisation purposes only. It must not be relied upon for legal, insurance, regulatory, enforcement, property, safety, or emergency decision-making.</strong></p>
            </div>

            <div class="info-modal-section">
                <h2>Data Source</h2>
                <p>All crash data displayed on this website is sourced from publicly available datasets published by <strong>Data SA</strong> (Government of South Australia).</p>
                <p>The original datasets can be accessed at: <a href="https://data.sa.gov.au" target="_blank" rel="noopener noreferrer">data.sa.gov.au</a></p>
            </div>

            <div class="info-modal-section">
                <h2>Data Processing</h2>
                <p>The datasets have been cleaned and standardised across yearly releases (2012–2024) to ensure consistent formatting and comparability. No material alterations have been made to the original published records beyond necessary formatting and structural adjustments.</p>
            </div>

            <div class="info-modal-section">
                <h2>Accuracy & Limitations</h2>
                <p>While reasonable care has been taken to ensure accurate representation of the source data, <strong>no guarantee is provided</strong> regarding the completeness, accuracy, reliability, or timeliness of the information displayed.</p>
                <p>Users should verify information against official government sources where required. The data may contain errors, omissions, or outdated information.</p>
                <p>Geographic coordinates and location information may be approximate and should not be considered precise.</p>
            </div>

            <div class="info-modal-section">
                <h2>Informational Use Only</h2>
                <p>This website is provided for <strong>informational and visualisation purposes only</strong>. The information presented here must not be relied upon for:</p>
                <ul>
                    <li>Legal proceedings or decisions</li>
                    <li>Insurance claims or assessments</li>
                    <li>Regulatory compliance or reporting</li>
                    <li>Law enforcement activities</li>
                    <li>Property valuations or real estate decisions</li>
                    <li>Safety assessments or emergency planning</li>
                    <li>Any other critical or official purpose</li>
                </ul>
                <p>For official information, please consult the relevant South Australian Government agencies and authorities.</p>
            </div>

            <div class="info-modal-section">
                <h2>No Government Affiliation</h2>
                <p>This is an <strong>independent project</strong> and is not affiliated with, endorsed by, or representing the Government of South Australia, Data SA, or any other government agency.</p>
                <p>This website is not an official government resource. All official inquiries should be directed to the appropriate South Australian Government departments.</p>
            </div>

            <div class="info-modal-section">
                <h2>Privacy & Data Protection</h2>
                <p>This website only displays aggregated crash statistics from publicly available datasets. No personal information or identifiable data about individuals involved in crashes is displayed or stored.</p>
                <p>The website does not collect personal information from users beyond standard web server logs.</p>
            </div>

            <div class="info-modal-section">
                <h2>Limitation of Liability</h2>
                <p><strong>Use of this website is at your own risk.</strong> The site owner, contributors, and data providers accept no liability for any loss, damage, injury, or consequences arising directly or indirectly from:</p>
                <ul>
                    <li>The use of this website or its content</li>
                    <li>Reliance on information displayed on this website</li>
                    <li>Errors, omissions, or inaccuracies in the data</li>
                    <li>Unavailability or interruption of service</li>
                    <li>Any decisions made based on information from this website</li>
                </ul>
                <p>To the maximum extent permitted by law, all warranties, express or implied, are excluded.</p>
            </div>

            <div class="info-modal-section">
                <h2>Third-Party Services</h2>
                <p>This website uses third-party services and libraries including Leaflet (mapping), OpenStreetMap (map tiles), and various JavaScript libraries. The site owner is not responsible for the availability, accuracy, or content provided by these third-party services.</p>
            </div>

            <div class="info-modal-section">
                <h2>Changes to This Disclaimer</h2>
                <p>This disclaimer may be updated from time to time without notice. Continued use of this website constitutes acceptance of any changes to this disclaimer.</p>
                <p class="last-updated-text">Last Updated: ${LAST_UPDATED}</p>
            </div>
        </div>`,

    methodology: `<div class="info-modal-header">
            <h1>Data Processing Methodology</h1>
            <button class="info-modal-close" onclick="closeInfoModal('methodologyModal')">Close</button>
        </div>
        <div class="info-modal-container">
            <div class="info-modal-section">
                <h2>Overview</h2>
                <p>This page documents the data processing methodology used to prepare the South Australian crash data for visualization on this website. The goal is to provide transparency about how the raw data has been transformed and to help users understand any limitations or considerations when interpreting the visualizations.</p>
            </div>

            <div class="info-modal-section">
                <h2>Data Sources</h2>
                <p>All data is sourced from publicly available datasets published by <strong>Data SA</strong> (Government of South Australia):</p>
                <ul>
                    <li><strong>Primary Dataset:</strong> Road Crash Data (2012-2024)</li>
                    <li><strong>Source URL:</strong> <a href="https://data.sa.gov.au" target="_blank" rel="noopener noreferrer">data.sa.gov.au</a></li>
                    <li><strong>Data Format:</strong> CSV (Comma-Separated Values)</li>
                    <li><strong>Update Frequency:</strong> Periodically updated by Data SA</li>
                    <li><strong>Coverage Period:</strong> January 1, 2012 to December 31, 2024</li>
                </ul>
                <div class="info-box">
                    <strong>Note:</strong> The datasets are published by the South Australian Government under open data licensing terms. Please refer to Data SA for the most current and official data.
                </div>
            </div>

            <div class="info-modal-section">
                <h2>Data Processing Steps</h2>

                <h3>1. Data Collection & Consolidation</h3>
                <p>Yearly crash data files (2012-2024) were collected from Data SA and consolidated into a single unified dataset. This process involved:</p>
                <ul>
                    <li>Downloading individual yearly CSV files from Data SA</li>
                    <li>Merging multiple datasets while preserving all original records</li>
                    <li>Creating a combined dataset for efficient querying and visualization</li>
                </ul>

                <h3>2. Data Cleaning & Standardization</h3>
                <p>To ensure consistency across different yearly releases, the following standardization procedures were applied:</p>

                <h4>Column Name Standardization</h4>
                <ul>
                    <li>Inconsistent column names across years were normalized to a common schema</li>
                    <li>Whitespace and special characters in column headers were standardized</li>
                    <li>Column names were made case-consistent for reliable programmatic access</li>
                </ul>

                <h4>Data Type Validation</h4>
                <ul>
                    <li>Numeric fields (e.g., year, casualty counts) validated and converted to appropriate types</li>
                    <li>Date and time fields parsed and standardized to ISO 8601 format where applicable</li>
                    <li>Text fields trimmed of leading/trailing whitespace</li>
                </ul>

                <h4>Missing Data Handling</h4>
                <ul>
                    <li>Empty fields preserved as empty strings (not converted to null/undefined arbitrarily)</li>
                    <li>No imputation or artificial data generation performed</li>
                    <li>Missing geographic coordinates excluded from mapping visualizations</li>
                </ul>

                <h3>3. Geographic Coordinate Processing</h3>
                <p>The crash data includes geographic coordinates that enable map-based visualization:</p>
                <ul>
                    <li><strong>Coordinate System:</strong> Original data uses GDA2020 / MGA Zone 54 (EPSG:7854)</li>
                    <li><strong>Conversion:</strong> Coordinates converted to WGS84 (latitude/longitude) using Proj4js library for web mapping compatibility</li>
                    <li><strong>Validation:</strong> Records with missing or invalid coordinates excluded from map layers</li>
                    <li><strong>Precision:</strong> Coordinates displayed with standard precision; exact crash locations may be approximate</li>
                </ul>

                <div class="info-box">
                    <strong>Important:</strong> Geographic coordinates should be considered approximate. They are suitable for visualization and general analysis but not for precise location-based decisions.
                </div>

                <h3>4. Categorical Data Harmonization</h3>
                <p>Categorical fields (e.g., crash severity, weather conditions, crash type) were standardized:</p>
                <ul>
                    <li>Consistent encoding of categories across years</li>
                    <li>Removal of redundant or duplicate category labels</li>
                    <li>Preservation of original category meanings without reclassification</li>
                </ul>

                <h3>5. Temporal Data Processing</h3>
                <ul>
                    <li>Crash dates and times preserved in original form where available</li>
                    <li>Year extracted and validated for filtering purposes</li>
                    <li>Time-of-day filters support 24-hour format</li>
                </ul>
            </div>

            <div class="info-modal-section">
                <h2>Data Schema</h2>
                <p>The consolidated dataset includes the following key fields:</p>
                <table>
                    <thead>
                        <tr>
                            <th>Field Category</th>
                            <th>Example Fields</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Temporal</strong></td>
                            <td>Year, Date, Time, Day/Night</td>
                            <td>When the crash occurred</td>
                        </tr>
                        <tr>
                            <td><strong>Geographic</strong></td>
                            <td>Latitude, Longitude, Area/LGA, Suburb</td>
                            <td>Where the crash occurred</td>
                        </tr>
                        <tr>
                            <td><strong>Severity</strong></td>
                            <td>Crash Severity, Casualties, Fatalities</td>
                            <td>Impact and outcomes</td>
                        </tr>
                        <tr>
                            <td><strong>Crash Characteristics</strong></td>
                            <td>Crash Type, Weather, Road Surface</td>
                            <td>Conditions and type of crash</td>
                        </tr>
                        <tr>
                            <td><strong>Vehicles & Units</strong></td>
                            <td>Vehicle Type, Heavy Vehicle, Unit Count</td>
                            <td>Vehicles involved in crash</td>
                        </tr>
                        <tr>
                            <td><strong>Casualties</strong></td>
                            <td>Road User Type, Age, Sex, Injury Extent</td>
                            <td>People affected by crash</td>
                        </tr>
                        <tr>
                            <td><strong>Contributing Factors</strong></td>
                            <td>DUI, Drugs, Speed, Seat Belt</td>
                            <td>Factors related to crash occurrence</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="info-modal-section">
                <h2>Visualization Processing</h2>

                <h3>Marker Clustering</h3>
                <ul>
                    <li>Individual crash points clustered using Leaflet MarkerCluster library</li>
                    <li>Clustering performed client-side for responsive interaction</li>
                    <li>Cluster size indicates number of crashes in geographic proximity</li>
                </ul>

                <h3>Density Map Visualization</h3>
                <ul>
                    <li>Point density layer generated using Leaflet.heat library with tight radius settings</li>
                    <li>Individual crashes rendered with minimal blur for precise location visualization</li>
                    <li>Color intensity represents both crash density and severity weighting</li>
                    <li>Severity-weighted: Fatal (4x), Serious Injury (3x), Minor Injury (2x), PDO (1x)</li>
                    <li>Radius and blur scale with zoom level for optimal viewing at all scales</li>
                    <li>Follows road patterns naturally, creating linear density corridors</li>
                </ul>

                <h3>Choropleth Mapping</h3>
                <ul>
                    <li>LGA (Local Government Area) boundaries used for choropleth visualization</li>
                    <li>Crash counts aggregated by geographic region</li>
                    <li>Color intensity proportional to crash frequency</li>
                </ul>
            </div>

            <div class="info-modal-section">
                <h2>Filtering & Aggregation</h2>
                <p>The website provides extensive filtering capabilities. All filters are applied client-side:</p>
                <ul>
                    <li><strong>Temporal Filters:</strong> Year range, date range, time of day</li>
                    <li><strong>Severity Filters:</strong> Crash severity levels, injury extent</li>
                    <li><strong>Geographic Filters:</strong> LGA/area, location search with radius</li>
                    <li><strong>Condition Filters:</strong> Weather, road surface, day/night</li>
                    <li><strong>Vehicle Filters:</strong> Vehicle type, heavy vehicle involvement</li>
                    <li><strong>Casualty Filters:</strong> Age group, road user type, safety equipment usage</li>
                </ul>
                <p>Statistics are recalculated dynamically based on active filters to show relevant totals and counts.</p>
            </div>

            <div class="info-modal-section">
                <h2>Data Integrity & Quality Assurance</h2>

                <h3>Validation Checks</h3>
                <ul>
                    <li>Record count verification against source datasets</li>
                    <li>Coordinate validity checks (within South Australia bounds)</li>
                    <li>Date and time range validation</li>
                    <li>Categorical value consistency checks</li>
                </ul>

                <h3>Known Limitations</h3>
                <ul>
                    <li>Some records may have incomplete data fields</li>
                    <li>Geographic coordinates are approximate and may not reflect exact crash locations</li>
                    <li>Data is dependent on reporting accuracy and completeness in source datasets</li>
                    <li>Historical data may have different collection or reporting standards than recent data</li>
                    <li>Not all crashes may be represented in the dataset</li>
                </ul>
            </div>

            <div class="info-modal-section">
                <h2>Tools & Technologies</h2>
                <p>The following tools and libraries were used in data processing and visualization:</p>
                <ul>
                    <li><strong>Python:</strong> Data cleaning and consolidation (pandas, csv libraries)</li>
                    <li><strong>Leaflet.js:</strong> Interactive mapping library</li>
                    <li><strong>Proj4js:</strong> Coordinate system transformation</li>
                    <li><strong>Turf.js:</strong> Geospatial analysis and calculations</li>
                    <li><strong>noUiSlider:</strong> Range filter controls</li>
                </ul>
            </div>

            <div class="info-modal-section">
                <h2>Updates & Versioning</h2>
                <p>As new data becomes available from Data SA, the dataset may be updated. Major updates will be documented here with version information and change notes.</p>
                <p><strong>Current Version:</strong> 2012-2024 Dataset (${LAST_UPDATED})</p>
            </div>

            <div class="info-modal-section">
                <h2>Reproducibility & Transparency</h2>
                <p>This project aims to maintain transparency in data processing. Users who wish to verify the processing methodology or reproduce the dataset can:</p>
                <ul>
                    <li>Access the original source data from Data SA</li>
                    <li>Review the processing scripts (available in project repository if open-sourced)</li>
                    <li>Contact the project maintainer with questions or concerns</li>
                </ul>
                <p class="last-updated-text">Last Updated: ${LAST_UPDATED}</p>
            </div>
        </div>`,

    tutorial: `<div class="modal-content tutorial-modal-content">
            <div class="modal-header tutorial-header">
                <h2>CrashMap Usage Guide</h2>
                <div class="tutorial-search-container">
                    <input type="text" id="tutorialSearch" class="tutorial-search-input" placeholder="Search..." oninput="searchTutorial(this.value)">
                    <span class="search-icon">🔍</span>
                </div>
                <button class="modal-close" onclick="closeTutorial()">&times;</button>
            </div>

            <div class="modal-tabs">
                <button class="tab-btn active" onclick="switchTutorialTab('getting-started')">Getting Started</button>
                <button class="tab-btn" onclick="switchTutorialTab('filtering')">Filtering Data</button>
                <button class="tab-btn" onclick="switchTutorialTab('analytics')">Analytics</button>
                <button class="tab-btn" onclick="switchTutorialTab('tools')">Export & Tools</button>
                <button class="tab-btn" onclick="switchTutorialTab('tips')">Tips & Tricks</button>
                <button class="tab-btn" onclick="switchTutorialTab('quick-ref')">Quick Reference</button>
            </div>

            <div class="modal-body tutorial-body">
                <!-- Getting Started Tab -->
                <div id="gettingStartedTab" class="tab-content active">
                    <div class="tutorial-section">
                        <h3>Understanding the Map</h3>
                        <div class="tutorial-step">
                            <strong>Step 1: Navigate the Map</strong>
                            <ul>
                                <li><strong>Zoom:</strong> Use mouse wheel or +/- buttons to zoom in and out</li>
                                <li><strong>Pan:</strong> Click and drag to move around the map</li>
                                <li><strong>Markers:</strong> Click any marker cluster or individual crash point to see details</li>
                            </ul>
                        </div>

                        <div class="tutorial-step">
                            <strong>Step 2: Change Base Maps</strong>
                            <ul>
                                <li>Use the <strong>Base Map</strong> dropdown in the control panel</li>
                                <li>Choose from 6 styles: Dark, Light, Voyager, Street, Satellite, or Terrain</li>
                                <li>Different maps work better for different analysis tasks</li>
                            </ul>
                        </div>

                        <div class="tutorial-step">
                            <strong>Step 3: Toggle Visualization Layers</strong>
                            <ul>
                                <li><strong>Markers:</strong> Individual crash points with clustering (default ON)</li>
                                <li><strong>Density:</strong> Heat map showing crash concentration hotspots</li>
                                <li><strong>Choropleth:</strong> Color-coded regions by crash count (LGA or Suburb)</li>
                            </ul>
                            <div class="callout callout-tip"><strong>Tip:</strong> You can have multiple layers active at once!</div>
                        </div>

                        <div class="tutorial-step">
                            <strong>Step 4: Marker Coloring Options</strong>
                            <ul>
                                <li><strong>By Severity:</strong> Red (Fatal), Orange (Serious), Yellow (Minor), Gray (PDO)</li>
                                <li><strong>By Crash Type:</strong> Different colors for Hit Object, Rear-end, Right Turn, etc.</li>
                                <li><strong>By Day/Night:</strong> Yellow (Day) vs Blue (Night)</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <!-- Filtering Data Tab -->
                <div id="filteringTab" class="tab-content">
                    <div class="tutorial-section">
                        <h3>Filtering Your Data</h3>

                        <div class="tutorial-step">
                            <strong>Basic Filters (Always Visible)</strong>
                            <ul>
                                <li><strong>Year Range:</strong> Drag the slider to select years (2012-2024)</li>
                                <li><strong>Severity:</strong> Filter by Fatal, Serious Injury, Minor Injury, or Property Damage Only</li>
                                <li><strong>Crash Type:</strong> Select specific crash types (e.g., Hit Object, Rear-end)</li>
                                <li><strong>Area (LGA):</strong> Filter by local government area</li>
                                <li><strong>Suburb:</strong> Filter by suburb name</li>
                            </ul>
                        </div>

                        <div class="tutorial-step">
                            <strong>Spatial Filters</strong>
                            <ul>
                                <li><strong>🔍 Search:</strong> Enter a suburb, street, or landmark</li>
                                <li>Select a radius (0.5 km to 50 km) to filter crashes within that area</li>
                                <li><strong>✏️ Draw Area:</strong> Click "Draw Rectangle" or "Draw Polygon" to draw a custom area on the map</li>
                                <li>Only crashes within your drawn area will be shown</li>
                                <li>Click "Clear Drawn Area" to remove the spatial filter</li>
                            </ul>
                        </div>

                        <div class="tutorial-step">
                            <strong>Advanced Filters</strong>
                            <p>Click <strong>"Advanced Filters"</strong> to access 3 detailed filter tabs:</p>
                            <ul>
                                <li><strong>Crash Conditions:</strong> Weather, Day/Night, Time, Date, DUI, Road Surface, Speed Zone, Month</li>
                                <li><strong>Casualties:</strong> Road User Type, Age Group, Sex, Injury Extent, Seat Belt, Helmet</li>
                                <li><strong>Vehicles & Units:</strong> Vehicle Type, Heavy Vehicles, Towing, Rollover, Fire, License Type</li>
                            </ul>
                            <div class="callout callout-tip"><strong>Tip:</strong> Multiple filters work together using AND logic (all must match)</div>
                        </div>

                        <div class="tutorial-step">
                            <strong>Active Filters Badge</strong>
                            <ul>
                                <li>The floating badge shows how many filters are active</li>
                                <li>Hover over it to see a summary of active filters</li>
                                <li>Click individual chips to quickly remove specific filters</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <!-- Analytics Tab -->
                <div id="analyticsTab" class="tab-content">
                    <div class="tutorial-section">
                        <h3>Using Analytics</h3>

                        <div class="tutorial-step">
                            <strong>Opening the Analytics Panel</strong>
                            <ul>
                                <li>Click the <strong>"Analytics"</strong> button at the bottom-left of the map</li>
                                <li>The panel shows 13+ interactive charts based on your filtered data</li>
                                <li>Click the expand icon to view charts in fullscreen mode</li>
                            </ul>
                        </div>

                        <div class="tutorial-step">
                            <strong>Available Charts</strong>
                            <ul>
                                <li><strong>Crashes Over Time:</strong> Toggle between yearly and monthly views</li>
                                <li><strong>By Day of Week:</strong> See which days have the most crashes</li>
                                <li><strong>By Hour of Day:</strong> Identify peak crash times</li>
                                <li><strong>Severity Distribution:</strong> Pie chart showing crash severity breakdown</li>
                                <li><strong>Top Crash Types:</strong> Most common crash types in your filtered data</li>
                                <li><strong>Top Areas/LGAs:</strong> Regions with highest crash counts</li>
                                <li><strong>Weather Conditions:</strong> Crash distribution by weather</li>
                                <li><strong>Speed Zone Analysis:</strong> Crashes by speed limit</li>
                                <li><strong>Casualty Demographics:</strong> Age, sex, and road user type distributions</li>
                                <li><strong>Day × Hour Heatmap:</strong> When crashes happen most frequently</li>
                                <li><strong>And more...</strong></li>
                            </ul>
                        </div>

                        <div class="tutorial-step">
                            <strong>Interactive Charts</strong>
                            <ul>
                                <li>Click on chart elements (bars, pie slices) to filter the map</li>
                                <li>For example, click "2020" in the yearly chart to show only 2020 crashes</li>
                                <li>A banner will appear showing the active filter - click the × to clear it</li>
                            </ul>
                            <div class="callout callout-tip"><strong>Tip:</strong> Charts update in real-time as you apply filters!</div>
                        </div>
                    </div>
                </div>

                <!-- Export & Tools Tab -->
                <div id="toolsTab" class="tab-content">
                    <div class="tutorial-section">
                        <h3>Export & Data Tools</h3>

                        <div class="tutorial-step">
                            <strong>Viewing Statistics</strong>
                            <ul>
                                <li>The statistics panel (top-left) shows real-time counts:</li>
                                <li><strong>Total Crashes</strong> in your filtered dataset</li>
                                <li><strong>Fatalities, Serious Injuries, Minor Injuries</strong> - color-coded by severity</li>
                                <li>These update automatically as you apply filters</li>
                            </ul>
                        </div>

                        <div class="tutorial-step">
                            <strong>Data Table</strong>
                            <ul>
                                <li>Click <strong>"Show Table"</strong> to see a detailed table of filtered crashes</li>
                                <li>Click column headers to sort (e.g., by date, severity, area)</li>
                                <li>Use pagination controls to browse through large result sets</li>
                                <li>Each row shows crash details: date, time, location, severity, type, etc.</li>
                            </ul>
                        </div>

                        <div class="tutorial-step">
                            <strong>Export to CSV</strong>
                            <ul>
                                <li>Click the <strong>"Export CSV"</strong> button in the data table panel or Statistics panel</li>
                                <li>Downloads your current filtered dataset as a CSV file</li>
                                <li>Perfect for further analysis in Excel, R, Python, or other tools</li>
                                <li>Filename includes date range and filter count for easy reference</li>
                            </ul>
                        </div>

                        <div class="tutorial-step">
                            <strong>Export to PDF</strong>
                            <ul>
                                <li>Click the <strong>"Export to PDF"</strong> button in the Statistics panel</li>
                                <li><strong>Choose a preset:</strong>
                                    <ul style="margin-top: 8px;">
                                        <li><strong>Quick Summary:</strong> Stats + top 3 charts (fast, smaller file)</li>
                                        <li><strong>Full Analytics:</strong> All charts without data table (recommended)</li>
                                        <li><strong>Custom:</strong> Select exactly what you want to include</li>
                                    </ul>
                                </li>
                                <li><strong>Customize your report:</strong>
                                    <ul style="margin-top: 8px;">
                                        <li>Include/exclude: Cover page, statistics, filters, charts, data table</li>
                                        <li>Select specific charts or use Select All/None buttons</li>
                                        <li>Choose table row count (10-500 rows, or all data)</li>
                                        <li>Select orientation: Portrait or Landscape (landscape recommended for charts)</li>
                                        <li>Customize the filename</li>
                                    </ul>
                                </li>
                                <li>Watch the progress bar as your PDF generates</li>
                                <li>PDF automatically downloads with timestamp appended to filename</li>
                                <li><strong>Tips:</strong> Use "Full Analytics" for visual reports, landscape orientation works best, limit table to 100-200 rows for faster generation</li>
                            </ul>
                        </div>

                        <div class="tutorial-step">
                            <strong>Clearing Filters</strong>
                            <ul>
                                <li>Click <strong>"Clear All Filters"</strong> to reset everything to defaults</li>
                                <li>Or use the active filters badge to remove specific filters one-by-one</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <!-- Tips & Tricks Tab -->
                <div id="tipsTab" class="tab-content">
                    <div class="tutorial-section">
                        <h3>Tips & Tricks</h3>

                        <div class="tutorial-step">
                            <strong>Performance Tips</strong>
                            <ul>
                                <li>Filter data before turning on all layers for better performance</li>
                                <li>Density and Choropleth layers work best with filtered data</li>
                                <li>On slower devices, use the density layer instead of showing all 190,000+ markers</li>
                                <li>Zoom in closer to see individual crash markers more clearly</li>
                            </ul>
                        </div>

                        <div class="tutorial-step">
                            <strong>Analysis Workflows</strong>
                            <ul>
                                <li><strong>Temporal Analysis:</strong> Use year slider + monthly charts to identify trends</li>
                                <li><strong>Spatial Analysis:</strong> Use location search or draw area + choropleth layer</li>
                                <li><strong>Comparative Analysis:</strong> Apply filters, export CSV, repeat with different filters</li>
                                <li><strong>Hot Spot Identification:</strong> Enable density layer and look for red/orange areas</li>
                            </ul>
                        </div>

                        <div class="tutorial-step">
                            <strong>Understanding the Data</strong>
                            <ul>
                                <li>Click <strong>"Data Methodology"</strong> in the footer to understand data processing</li>
                                <li>Review the <strong>"Disclaimer"</strong> for important data quality notes</li>
                                <li>Geographic coordinates are approximate - suitable for visualization, not precise location</li>
                                <li>Some crashes may have incomplete data fields</li>
                            </ul>
                        </div>

                        <div class="tutorial-step">
                            <strong>Keyboard Shortcuts</strong>
                            <ul>
                                <li><strong>Escape:</strong> Close any open modal or fullscreen panel</li>
                                <li><strong>Ctrl/Cmd + Click:</strong> Select multiple items in multi-select dropdowns</li>
                            </ul>
                        </div>

                        <div class="tutorial-step">
                            <strong>Theme & Accessibility</strong>
                            <ul>
                                <li>Toggle between <strong>Light</strong> and <strong>Dark</strong> themes using the ☀️/🌙 button</li>
                                <li>Your preference is saved in your browser</li>
                                <li>Dark theme is easier on the eyes for extended analysis sessions</li>
                            </ul>
                        </div>

                        <div class="tutorial-step">
                            <strong>Offline Access</strong>
                            <ul>
                                <li>This is a Progressive Web App (PWA) - works offline after first load</li>
                                <li>Data files are cached for faster loading</li>
                                <li>Perfect for field work or areas with poor connectivity</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <!-- Quick Reference Tab -->
                <div id="quickRefTab" class="tab-content">
                    <div class="quick-ref-section">
                        <h4>Map Controls</h4>
                        <table class="quick-ref-table">
                            <thead>
                                <tr>
                                    <th>Feature</th>
                                    <th>Action</th>
                                    <th>Shortcut</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Zoom In/Out</td>
                                    <td>Mouse wheel or +/- buttons</td>
                                    <td>—</td>
                                </tr>
                                <tr>
                                    <td>Pan Map</td>
                                    <td>Click and drag</td>
                                    <td>—</td>
                                </tr>
                                <tr>
                                    <td>View Crash Details</td>
                                    <td>Click marker or cluster</td>
                                    <td>—</td>
                                </tr>
                                <tr>
                                    <td>Change Base Map</td>
                                    <td>Use Base Map dropdown (6 styles available)</td>
                                    <td>—</td>
                                </tr>
                                <tr>
                                    <td>Toggle Layers</td>
                                    <td>Click layer buttons (Markers, Density, Choropleth)</td>
                                    <td>—</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div class="quick-ref-section">
                        <h4>Filtering</h4>
                        <table class="quick-ref-table">
                            <thead>
                                <tr>
                                    <th>Feature</th>
                                    <th>Action</th>
                                    <th>Shortcut</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Filter by Year</td>
                                    <td>Drag year range slider</td>
                                    <td>—</td>
                                </tr>
                                <tr>
                                    <td>Filter by Severity</td>
                                    <td>Select from dropdown (Fatal, Serious, Minor, PDO)</td>
                                    <td>—</td>
                                </tr>
                                <tr>
                                    <td>Spatial Search</td>
                                    <td>Enter location + radius or draw area on map</td>
                                    <td>—</td>
                                </tr>
                                <tr>
                                    <td>Advanced Filters</td>
                                    <td>Click "Advanced Filters" button (Weather, DUI, Casualties, etc.)</td>
                                    <td>—</td>
                                </tr>
                                <tr>
                                    <td>View Active Filters</td>
                                    <td>Hover over floating badge</td>
                                    <td>—</td>
                                </tr>
                                <tr>
                                    <td>Remove Single Filter</td>
                                    <td>Click × on filter chip in badge</td>
                                    <td>—</td>
                                </tr>
                                <tr>
                                    <td>Clear All Filters</td>
                                    <td>Click "Clear All Filters" button</td>
                                    <td>—</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div class="quick-ref-section">
                        <h4>Analytics & Export</h4>
                        <table class="quick-ref-table">
                            <thead>
                                <tr>
                                    <th>Feature</th>
                                    <th>Action</th>
                                    <th>Shortcut</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Open Analytics</td>
                                    <td>Click "Analytics" button (bottom-left)</td>
                                    <td>—</td>
                                </tr>
                                <tr>
                                    <td>Toggle Chart View</td>
                                    <td>Click expand icon for fullscreen</td>
                                    <td>—</td>
                                </tr>
                                <tr>
                                    <td>Filter from Chart</td>
                                    <td>Click chart element (bar, pie slice, etc.)</td>
                                    <td>—</td>
                                </tr>
                                <tr>
                                    <td>View Data Table</td>
                                    <td>Click "Show Table" button</td>
                                    <td>—</td>
                                </tr>
                                <tr>
                                    <td>Sort Table</td>
                                    <td>Click column headers</td>
                                    <td>—</td>
                                </tr>
                                <tr>
                                    <td>Export to CSV</td>
                                    <td>Click "Export CSV" button in Statistics panel or table</td>
                                    <td>—</td>
                                </tr>
                                <tr>
                                    <td>Export to PDF</td>
                                    <td>Click "Export to PDF" button, select preset/customize</td>
                                    <td>—</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div class="quick-ref-section">
                        <h4>General</h4>
                        <table class="quick-ref-table">
                            <thead>
                                <tr>
                                    <th>Feature</th>
                                    <th>Action</th>
                                    <th>Shortcut</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Close Modals</td>
                                    <td>Click × or press Escape</td>
                                    <td><kbd>Esc</kbd></td>
                                </tr>
                                <tr>
                                    <td>Toggle Theme</td>
                                    <td>Click ☀️/🌙 button</td>
                                    <td>—</td>
                                </tr>
                                <tr>
                                    <td>Open Usage Guide</td>
                                    <td>Click ? button in control panel</td>
                                    <td>—</td>
                                </tr>
                                <tr>
                                    <td>Multi-Select</td>
                                    <td>Hold Ctrl/Cmd while clicking dropdown items</td>
                                    <td><kbd>Ctrl/Cmd</kbd> + Click</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div class="modal-footer tutorial-footer">
                <label class="dont-show-again">
                    <input type="checkbox" id="dontShowTutorial" onchange="updateTutorialPreference()">
                    Don't show this again
                </label>
                <div class="tutorial-nav-buttons">
                    <button class="btn-secondary" onclick="previousTutorialTab()">Previous</button>
                    <button class="btn-secondary" onclick="nextTutorialTab()">Next</button>
                    <button class="btn-primary" onclick="closeTutorial()">Close</button>
                </div>
            </div>
        </div>`
};

// Track which modals have been loaded
const loadedModals = {
    disclaimer: false,
    methodology: false,
    tutorial: false
};

/**
 * Load modal content lazily when first needed
 * @param {string} modalId - The modal ID (disclaimerModal, methodologyModal, tutorialModal)
 * @returns {Promise<void>}
 */
export async function loadModalContent(modalId) {
    const modalType = modalId.replace('Modal', '');

    // Skip if already loaded
    if (loadedModals[modalType]) {
        return;
    }

    const modalElement = document.getElementById(modalId);
    if (!modalElement) {
        console.warn(`Modal ${modalId} not found`);
        return;
    }

    // Inject the content
    modalElement.innerHTML = MODAL_CONTENT[modalType];
    loadedModals[modalType] = true;

}

/**
 * Preload all modal content (optional - for faster subsequent access)
 */
export async function preloadAllModals() {
    await Promise.all([
        loadModalContent('disclaimerModal'),
        loadModalContent('methodologyModal'),
        loadModalContent('tutorialModal')
    ]);
}
