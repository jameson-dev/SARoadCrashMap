<p align="center">
  <img src="saroadcrashmap-logo.svg" alt="SA Road Crash Map" width="400">
</p>

# SA Crash Data Interactive Map (2012-2024)

An interactive web-based map visualization tool for exploring South Australian crash data from 2012-2024.

**View Map:** [South Australian Road Crash Map](https://jameson-dev.github.io/SARoadCrashMap)

[![PWA Ready](https://img.shields.io/badge/PWA-Ready-brightgreen.svg)](https://jameson-dev.github.io/SARoadCrashMap)
[![Offline Capable](https://img.shields.io/badge/Offline-Capable-blue.svg)](https://jameson-dev.github.io/SARoadCrashMap)

## Features

### **Three Visualization Layers**
- **Clustered Markers**: Individual crash locations that group together when zoomed out (190K+ markers)
  - Three color modes: Severity, Crash Type, or Day/Night
  - Smart clustering with formatted labels (K/M suffixes)
  - Progressive loading in chunks for smooth performance
- **Point Density**: Severity-weighted heatmap showing crash hotspots
  - Dynamic radius/blur adjustment based on zoom level
- **Choropleth**: Area-based statistics with two modes:
  - **LGA Mode**: Statistics grouped by Local Government Area
  - **Suburb Mode**: Statistics grouped by suburb boundaries

### **Interactive Filters**

#### Crash-Level Filters
- **Year Range**: Filter crashes between 2012-2024 (dual-handle slider)
- **Severity Levels**:
  - PDO (Property Damage Only)
  - Minor Injury
  - Serious Injury
  - Fatal
- **Crash Type**: Filter by specific crash types (multi-select)
- **Weather Conditions**: See how weather impacts crashes
- **Day/Night**: Compare crashes during different times
- **DUI Involvement**: Filter for alcohol-related incidents
- **Drugs Involved**: Filter for drug-related incidents
- **Area (LGA)**: Focus on specific local government areas (multi-select)
- **Suburb**: Filter by specific suburbs (multi-select)
- **Road Surface**: Filter by road surface conditions (multi-select)
- **Moisture Condition**: Filter by road moisture conditions (multi-select)
- **Speed Zone**: Filter by speed limit zones (multi-select)
- **Month of Year**: Filter by specific months (multi-select)
- **Date Range**: Optional from/to date filtering
- **Time Range**: Optional from/to time filtering (handles midnight crossing)

#### Casualty-Level Filters
- **Road User Type**: Filter by casualty type (Driver, Passenger, Pedestrian, Rider, Cyclist)
- **Age Group**: Filter by age ranges (0-17, 18-25, 26-35, 36-50, 51-65, 66+)
- **Casualty Sex**: Filter by gender (Male/Female)
- **Injury Extent**: Filter by injury severity (Fatal, Serious injury, Minor injury, Not injured)
- **Seat Belt Usage**: Filter by seat belt compliance (Worn/Not Worn)
- **Helmet Usage**: Filter by helmet usage for motorcyclists/cyclists (Worn/Not Worn)

#### Vehicle/Unit-Level Filters
- **Involved Entities**: Filter by crash units involved (vehicles, pedestrians, fixed objects struck)
- **Rollover Involved**: Filter crashes where rollover occurred
- **Fire Involved**: Filter crashes where fire occurred
- **Vehicle Type**: Filter by specific vehicle types (multi-select)
- **Vehicle Year**: Filter by vehicle age (Before 2000, 2000-2010, 2011-2020, 2021+)
- **Number of Occupants**: Filter by vehicle occupancy (1, 2, 3, 4, 5+ occupants)
- **Towing**: Filter vehicles that were towing trailers/caravans
- **Heavy Vehicles**: Filter crashes involving heavy vehicles (trucks, semi-trailers, road trains, buses)
- **License Type**: Filter by driver license type
- **Vehicle Registration State**: Filter by vehicle registration state
- **Direction of Travel**: Filter by travel direction
- **Unit Movement**: Filter by unit movement at time of crash

**Note:** Casualty and Vehicle/Unit-level filters are accessible through the "Advanced Filters"

#### Filter Presets
Nine pre-configured filter examples for quick analysis:
1. **Fatal Crashes (2023-2024)**: Recent fatal crashes
2. **Motorcycle/Rider Crashes at Night**: Night-time motorcycle incidents
3. **DUI-Related Crashes**: Alcohol-involved crashes
4. **Heavy Vehicle Crashes**: Incidents involving trucks and buses
5. **Pedestrian Casualties**: Crashes with pedestrian involvement
6. **Wet Weather Crashes**: Crashes in wet conditions
7. **Weekend Crashes**: Saturday and Sunday crashes
8. **Hit Fixed Object Crashes**: Single-vehicle object strikes
9. **Young Driver Crashes (Under 26)**: Crashes involving young drivers

### **Advanced Features**

#### Analytics Dashboard
- **11 Interactive Charts**: Comprehensive crash analysis with Chart.js
  - Crashes Over Time (line chart with yearly/monthly toggle)
  - Crashes by Day of Week
  - Crashes by Hour
  - Severity Distribution (doughnut chart)
  - Top Crash Types (top 10)
  - Top Areas/LGA (top 10)
  - Weather Conditions
  - Severity Trend Over Time (stacked area chart)
  - Speed Zone Distribution
  - Road User Types (doughnut chart)
  - Casualty Age Distribution
- **Click-to-Filter**: Click any chart segment to apply that filter to the map
- **Chart Maximization**: Expand charts to focus mode for detailed analysis
- **Chart Search**: Quickly find specific charts
- **Pattern Discovery**: Identify high-risk time periods and crash patterns
- **Fullscreen Analytics**: Expand the entire analytics panel for comprehensive overview

#### Location Search & Spatial Filtering
- **Intelligent Geocoding**: Find crashes near any SA location using OpenStreetMap/Nominatim
- **Autocomplete Suggestions**: 60+ pre-configured SA locations with grouped categories
  - Major Cities, Northern/Southern/Eastern/Western Suburbs, Regional Cities, etc.
- **Smart Abbreviation Expansion**: Automatically expands Mt → Mount, St → Saint, etc.
- **Keyboard Navigation**: Arrow keys and Enter support for quick selection
- **Radius Filtering**: Set custom search radius (0.5km to 50km)
- **Visual Feedback**: Search marker and radius circle displayed on map
- **Draw Tools**: Custom area filtering
  - **Rectangle Tool**: Draw rectangular selection areas
  - **Polygon Tool**: Draw custom polygon shapes
  - Point-in-polygon filtering using Turf.js
  - Visual feedback during drawing with cancel option

#### Interactive Data Table
- **Sortable Columns**: Click any column header to sort data (Year, Date/Time, Suburb, LGA, Severity, Type, Speed, Casualties)
  - Multi-column sort support for complex sorting
- **Flexible Pagination**: Choose to display 10, 25, 50, 100, 250, or 500 rows per page
- **Quick Navigation**: Jump directly to any page number or use Previous/Next buttons
- **Real-time Search**: Filter table data instantly by typing in the search box - searches across all columns
- **Column Management**: Show or hide specific columns using the column picker
- **Resizable Columns**: Drag column borders to adjust widths to your preference
- **Click to Explore**: Click any row to zoom to that crash location on the map and view full details
- **Map Sync**: Hover over rows to highlight corresponding markers on the map
- **Maximize View**: Expand table to full screen for detailed analysis
- **Data Export**: Export current page or all filtered data to CSV format
- **Persistent Settings**: Your table preferences (page size, column visibility, sort order) are saved automatically

#### Data Export
- **CSV Export**: Export filtered crash data to CSV format from Statistics panel or directly from the data table
  - Export Options: Choose to export all filtered data or just the current page view
  - Summary Statistics: Includes totals for crashes, casualties, and injuries
  - Filter Documentation: Active filters are documented in the export
  - Comprehensive Data: Includes crash details, location, casualties, and units involved

- **PDF Export**: Generate professional PDF reports with fully customizable content
  - **Cover Page**: Report title with generation timestamp and crash count
  - **Map Capture**: Include map screenshots in your report
    - Choose layer: Density heatmap, Marker clusters, or Choropleth
    - Automatic tile loading detection for crisp captures
  - **Executive Summary**: Automated insights and key findings from the data
  - **Statistics Summary**: Total crashes, fatalities, serious injuries, and minor injuries
  - **Active Filters**: Documentation of all applied filters
  - **Interactive Charts**: Full-page, high-resolution charts (select any combination):
    - Crashes Over Time (yearly/monthly trends)
    - Crashes by Day of Week
    - Crashes by Hour
    - Severity Distribution
    - Top Crash Types
    - Top Areas (LGA)
    - Weather Conditions
    - Severity Trend Over Time
    - Speed Zone Distribution
    - Road User Types
    - Casualty Age Distribution
  - **Chart Ordering**: Drag and drop to reorder charts in your report
  - **Data Table**: Detailed crash records with customizable row count (50/100/200/500 rows, or all data)
    - Column selection: Choose which columns to include
  - **Custom Notes**: Add your own comments and observations
  - **Flexible Layout**: Portrait or landscape orientation
  - **Filename Templates**: Customize filenames with variables ({date}, {year_range}, {count}, {time})
  - **Preview Mode**: Preview your report configuration before generating
  - **Smart Compression**: Automatic JPEG/PNG selection for optimal quality and file size
  - **High Quality**: Charts rendered at 2400×1200 resolution with 3x scaling for crisp output
  - **Large, Readable Fonts**: All chart legends and labels scaled for easy reading
  - **Progress Tracking**: Real-time progress bar with percentage indicator
  - **Page Numbering**: Professional page numbering throughout

#### Filter Management
- **Active Filters Bar**: See all active filters at a glance with smart descriptions
  - Shows exclusions when >70% of options are selected (e.g., "All except PDO")
- **Quick Clear**: Remove individual filters or clear all
- **Filter Persistence**: Filters are saved in URL for easy sharing
  - URL compression using LZ-String for compact URLs
  - Smart encoding: inverts filters when >70% selected to reduce URL size
- **Filter Caching**: Previously used filter combinations cached for instant re-application
  - LRU cache with 50 entries and 7-day TTL

#### Theme System
- **Light & Dark Themes**: Toggle between light and dark color schemes
- **Persistent Preferences**: Theme choice saved automatically to localStorage
- **Smooth Transitions**: Animated theme switching for visual comfort

#### Tutorial System
- **6-Tab Interactive Tutorial**: Comprehensive guide for new users
  - Getting Started, Map Navigation, Filtering Data, Analytics, Exporting, Tips & Tricks
- **Collapsible Steps**: Expandable sections for easy navigation
- **Search Functionality**: Quickly find specific tutorial topics
- **Progress Tracking**: Track which sections you've explored
- **"Don't Show Again" Option**: Skip tutorial on future visits
- **First-Visit Disclaimer**: Important information for new users

#### Notification System
- **Smart Queue Management**: Maximum 3 visible notifications at once
- **Four Notification Types**: Info, Warning, Error, Success
- **Auto-Dismiss**: Notifications automatically fade after display
- **Smooth Animations**: Stacking with automatic repositioning
- **Non-Intrusive**: Positioned for minimal disruption

### **Real-time Statistics**
- Total crashes in filtered dataset
- Total fatalities
- Serious injuries
- Minor injuries
- Updates automatically as you filter

### **Performance Features**
- **Progressive Loading**: Markers load in chunks for smooth performance
- **Service Worker**: Offline support (partial) and instant cache loading
- **PWA Support**: Install as a native app on mobile/desktop
- **Pre-computed Data**: LGA assignments pre-calculated for instant filtering

## How to Use

### 1. **Explore the Map**
- **Zoom**: Use mouse wheel or +/- buttons
- **Pan**: Click and drag the map
- **Click markers**: View detailed crash information
- **Switch base maps**: Toggle between 6 basemap styles:
  - Dark, Light, Voyager, Street, Satellite, and Terrain
- **Change marker colors**: Toggle between Severity, Crash Type, or Day/Night color coding

### 2. **Toggle Layers**
In the control panel on the right, you can switch between:
- Clustered Markers (default)
- Point Density (density visualization)
- Choropleth (area statistics)

You can activate multiple layers simultaneously!

### 3. **Apply Filters**
1. Select your desired filters from the dropdowns and inputs
2. For multi-select filters, check/uncheck individual options
3. Filters apply automatically
4. Statistics update in real-time

### 4. **View Details**
Click on any marker to see comprehensive crash information:
- **Crash Details**: Severity, type, date/time, location, weather, speed limit
- **Casualties**: Complete breakdown by type (driver, passenger, pedestrian, cyclist, etc.) and injury extent
  - Individual casualty details including age, sex, and safety equipment usage
- **Units Involved**: All units in the crash including vehicles (with type, year, occupants), pedestrians, and fixed objects struck
- **DUI Involvement**: Clearly marked if alcohol was involved

### 5. **Use the Data Table**
1. Click "View Data Table" button in the Statistics panel
2. Use the search box to filter results across all columns
3. Click column headers to sort data
4. Adjust page size (10-500 rows) based on your preference
5. Click any row to jump to that crash on the map
6. Hover over rows to see markers highlighted on the map
7. Use the column picker (⚙️) to show/hide specific columns
8. Export current page or all data to CSV

**Keyboard Shortcuts (when table is open):**
- `Ctrl/Cmd + ←` - Previous page
- `Ctrl/Cmd + →` - Next page
- `Ctrl/Cmd + Home` - First page
- `Ctrl/Cmd + End` - Last page
- `/` - Focus search box
- `Escape` - Close table or column picker

### 6. **Export Data**

#### Export to CSV
1. Click "Export to CSV" button in the Statistics panel
2. Choose export scope (all filtered data or current table page)
3. File downloads with crash details, casualties, and filter documentation

#### Export to PDF
1. Click "Export to PDF" button in the Statistics panel
2. Choose a preset or start from scratch:
   - **Quick Summary**: Stats + top 3 charts (fast, small file)
   - **Full Analytics**: All charts without data table (recommended)
   - **Custom**: Build your report from scratch
3. Customize your report sections:
   - **Cover Page**: Include title and summary
   - **Map Capture**: Include current map view (choose: Density/Markers/Choropleth)
   - **Executive Summary**: Automated insights and key findings
   - **Statistics**: Crash counts and casualty statistics
   - **Active Filters**: Documentation of applied filters
   - **Charts**: Select any combination of 11 available charts
     - Drag and drop to reorder charts in your report
   - **Data Table**: Include crash records (50/100/200/500 rows, or all)
     - Choose which columns to include
   - **Custom Notes**: Add your own comments and observations
4. Configure format options:
   - **Orientation**: Portrait or Landscape (landscape recommended for charts)
   - **Quality**: Standard, High, or Ultra
   - **Filename**: Use templates with variables ({date}, {year_range}, {count}, {time})
5. Optional: Click "Preview" to see your configuration
6. Click "Generate PDF" and wait for the progress bar to complete
7. PDF downloads automatically

**Tips for Best PDFs:**
- Use "Full Analytics" preset for comprehensive visual reports
- Include map capture for spatial context
- Landscape orientation works best for charts and maps
- For large datasets, limit table rows to 200-500 for faster generation
- Ultra quality produces the best charts but larger file sizes

### 7. **Share & Bookmark**
- Filters are encoded in URL - copy the URL to share your exact view
- Bookmark specific filter combinations
- Send filtered views to colleagues/friends

## Technical Details

### Data Files
The application uses crash data from the `data/` folder:
- `data/2012-2024_DATA_SA_Crash.csv` - Main crash data with locations (190,910+ records)
  - Merged from individual yearly datasets (2012-2019) and combined dataset (2020-2024)
  - Includes pre-computed LGA assignments for instant filtering
- `data/2012-2024_DATA_SA_Casualty.csv` - Detailed casualty information (77,147 records)
  - Includes casualty type, age, sex, injury extent, safety equipment usage
- `data/2012-2024_DATA_SA_Units.csv` - Crash unit information (407,571 records)
  - Includes all units involved in crashes: vehicles, pedestrians, fixed objects struck (trees, poles, barriers), animals, etc.
  - Also includes vehicle details like type, year, occupants, and driver information
- `data/sa_lga_boundaries.geojson` - LGA boundary polygons for choropleth visualization
- `data/sa_suburbs.geojson` - Suburb boundary polygons for choropleth visualization

### Libraries & Technologies
- **Leaflet.js** - Interactive mapping with custom renderers
- **Leaflet.markercluster** - Marker clustering with progressive loading
- **Leaflet.heat** - Heatmap/density visualization
- **Leaflet.draw** - Drawing tools for custom area selection
- **Chart.js** - Interactive analytics charts (11 chart types)
- **PapaParse** - High-performance CSV file parsing
- **jsPDF** - Client-side PDF generation with jsPDF-AutoTable for tables
- **html2canvas** - Map and chart capture for PDF export
- **Turf.js** - Geospatial analysis (point-in-polygon filtering)
- **Proj4js** - Coordinate system conversion (EPSG:3107 to WGS84)
- **LZ-String** - URL compression for filter state sharing
- **Service Worker API** - Offline caching and PWA support
- **LocalStorage API** - Client-side preference persistence

### Coordinate System
The data uses EPSG:3107 (GDA94 / SA Lambert) coordinates which are automatically converted to WGS84 (EPSG:4326) for display on the map.

**Coverage:** 98% of crashes (187,017 out of 190,910) have pre-assigned LGAs.

### Performance Optimizations
- **Progressive Marker Loading**: 190K+ markers loaded in chunks of 5,000 using requestIdleCallback
  - Non-blocking rendering for smooth UI interaction
  - Progress indicator during initial load
- **Icon Caching**: Reuses marker icons instead of creating duplicates
- **Batch Processing**: Adds markers to cluster in batches for faster rendering
- **Dynamic Clustering**: More aggressive clustering at lower zoom levels with formatted labels
- **Lazy Popup Generation**: Crash details only generated when popup is opened
- **Coordinate Pre-computation**: Crash coordinates transformed and cached on load
- **Analytics Caching**: Chart calculations cached to avoid recomputation
- **DOM Element Caching**: Frequently accessed DOM elements cached in memory
- **Filter Result Caching**: LRU cache (50 entries, 7-day TTL) for instant filter re-application
- **Debounced Inputs**: Search inputs debounced to reduce unnecessary processing
- **Throttled Map Updates**: Map-related updates throttled for smoother performance
- **Chunked Data Processing**: Large datasets processed in manageable chunks
- **Service Worker Caching**: Caches 200MB+ of data files for offline access and instant loading
- **Efficient Table Rendering**: Data table uses virtual pagination and only renders visible rows
- **Client-side Persistence**: User preferences (table settings, theme, tutorial) stored locally
- **Canvas Optimization**: Heatmap canvas configured with willReadFrequently attribute
- **Smart Chart Rendering**: Charts rendered at high DPI only when needed (PDF export)

## Development

### Browser Compatibility
- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)
- ⚠️ IE11 not supported (uses modern JavaScript features)

### PWA Installation
The app can be installed as a Progressive Web App:

**Desktop:**
- Chrome/Edge: Click install icon in address bar
- Safari: Not yet supported

## Data Source

Data provided by the South Australian Government's Data.SA portal:
- [SA Crash Data (2012-2024)](https://data.sa.gov.au/)

**Last Updated:** January 2025

## Disclaimer

This application is for informational and educational purposes only. While efforts have been made to ensure data accuracy, crash data may contain errors or omissions.

**Important:**
- This tool should not be used as the sole basis for safety decisions
- Crash data is subject to change and updates
- Always verify critical information with official sources
- See full disclaimer in the app for complete terms

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **Data Provider:** South Australian Government - Data.SA
- **Mapping:** Leaflet.js, OpenStreetMap contributors
- **Development:** Built with modern web technologies and open-source libraries

## Frequently Asked Questions

**Q: Why do some crashes not have LGA assignments?**
A: 2% of crashes have invalid or missing coordinates in the dataset.

**Q: Can I export filtered data?**
A: Yes, in two formats:
- **CSV Export**: Click "Export to CSV" in the Statistics panel. Includes all filtered crash data with summary statistics, active filters, and comprehensive crash details including casualties and units involved.
- **PDF Export**: Click "Export to PDF" in the Statistics panel. Generate fully customizable professional reports with:
  - Map captures (with layer selection)
  - Executive summary with automated insights
  - Statistics and active filters documentation
  - 11 selectable high-resolution charts (drag to reorder)
  - Data tables with column selection
  - Custom notes sections
  - Multiple quality levels and filename templates
  - Choose from Quick Summary, Full Analytics, or Custom presets
  - Preview mode available before generation

**Q: How often is the data updated?**
A: Data is sourced from Data.SA and updated when new datasets are published. This involves cleansing & aggregating the data which can take time.

**Q: How do I use the drawing tools to select custom areas?**
A: Click the Rectangle or Polygon tool buttons in the Spatial Filters section. For rectangles, click and drag on the map. For polygons, click to add each vertex, then double-click or click the first point to close the shape. The map will automatically filter to show only crashes within your drawn area.

**Q: Can I share my filtered view with others?**
A: Yes! All active filters are encoded in the URL using compressed parameters. Simply copy the URL from your browser and share it. When others open the link, they'll see exactly the same filtered view with all your selected options applied.

**Q: How do I change between light and dark themes?**
A: Click the theme toggle button (sun/moon icon) in the top navigation bar. Your preference is automatically saved and will be remembered on future visits.

## Contributing

Suggestions and bug reports are welcome! Please open an issue on GitHub.

---

**Note:** This is an independent project and is not affiliated with the South Australian Government.

Created with Leaflet, PapaParse, and modern web technologies.
