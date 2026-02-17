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
- **Point Density**: Density visualization showing crash hotspots
- **Choropleth**: Area-based statistics grouped by Local Government Area (LGA) or Suburb

### **Interactive Filters**

#### Crash-Level Filters
- **Year Range**: Filter crashes between 2012-2024
- **Severity Levels**:
  - PDO (Property Damage Only)
  - Minor Injury
  - Serious Injury
  - Fatal
- **Crash Type**: Filter by specific crash types
- **Weather Conditions**: See how weather impacts crashes
- **Day/Night**: Compare crashes during different times
- **DUI Involvement**: Filter for alcohol-related incidents
- **Drugs Involved**: Filter for drug-related incidents
- **Area (LGA)**: Focus on specific local government areas
- **Suburb**: Filter by specific suburbs

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
- **Vehicle Year**: Filter by vehicle age (Before 2000, 2000-2010, 2011-2020, 2021+)
- **Number of Occupants**: Filter by vehicle occupancy (1, 2, 3-4, 5+ occupants)
- **Towing**: Filter vehicles that were towing trailers/caravans
- **Heavy Vehicles**: Filter crashes involving heavy vehicles (trucks, semi-trailers, road trains)

### **Advanced Features**

#### Analytics Dashboard
- **Time-based Charts**: Analyze crash trends by year, month, day of week, and hour
- **Interactive Visualizations**: Click chart segments to filter the map
- **Pattern Discovery**: Identify high-risk time periods

#### Location Search
- **Search by Address/Suburb**: Find crashes near any SA location
- **Radius Filtering**: Set custom search radius (1-50km)
- **GPS Support**: Use your current location

#### Smart Filter Management
- **Active Filters Bar**: See all active filters at a glance
- **Quick Clear**: Remove individual filters or clear all
- **Filter Persistence**: Filters are saved in URL for easy sharing

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
- **Switch base maps**: Toggle between Dark, Light, and Satellite views

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

### 5. **Share & Bookmark**
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
- **Leaflet.js** - Interactive mapping
- **Leaflet.markercluster** - Marker clustering with chunked loading
- **Leaflet.heat** - Heatmap visualization
- **PapaParse** - CSV file parsing
- **Proj4js** - Coordinate system conversion (EPSG:3107 to WGS84)
- **Service Worker API** - Offline caching and PWA support
- **IndexedDB** (future) - Client-side data caching

### Coordinate System
The data uses EPSG:3107 (GDA94 / SA Lambert) coordinates which are automatically converted to WGS84 (EPSG:4326) for display on the map.

### Pre-computed LGA Assignment
LGA assignments are pre-computed using Python geospatial scripts (`scripts/add_lga_column.py`) that perform spatial joins between crash coordinates and LGA boundary polygons. This eliminates expensive client-side point-in-polygon calculations and provides instant filtering performance.

**Coverage:** 98% of crashes (187,017 out of 190,910) have pre-assigned LGAs.

### Performance Optimizations
- **Progressive Marker Loading**: 190K+ markers loaded in chunks of 2000 with progress indicator
- **Icon Caching**: Reuses marker icons instead of creating duplicates
- **Batch Processing**: Adds markers to cluster in batches for faster rendering
- **Dynamic Clustering**: More aggressive clustering at lower zoom levels
- **Lazy Popup Generation**: Crash details only generated when popup is opened
- **Service Worker Caching**: Caches 200MB+ of data files for offline access

## Development

### Running Locally
```bash
# Clone the repository
git clone https://github.com/jameson-dev/SARoadCrashMap.git
cd SARoadCrashMap

# Start a local server (Python 3)
python start_server.py

# Or use any other HTTP server
# python -m http.server 8000
# npx serve
```

Visit `http://localhost:8000` in your browser.

### Data Processing Scripts
Located in `scripts/` directory:

#### `add_lga_column.py`
Pre-computes LGA assignments for all crashes using spatial joins.

**Requirements:**
```bash
pip install -r scripts/requirements.txt
```

**Usage:**
```bash
cd scripts
python add_lga_column.py
```

This script:
- Loads crash data and LGA boundaries
- Converts coordinates from EPSG:3107 to EPSG:4326
- Performs spatial join to assign LGAs
- Updates the crash CSV with LGA column
- Provides statistics on assignment coverage

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

**Mobile:**
- iOS: Safari → Share → Add to Home Screen
- Android: Chrome → Menu → Install App

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
A: Currently not supported, but considered for future release.

**Q: How often is the data updated?**
A: Data is sourced from Data.SA and updated when new datasets are published. This involves cleansing & aggregating the data which can take time.

## Contributing

Suggestions and bug reports are welcome! Please open an issue on GitHub.

---

**Note:** This is an independent project and is not affiliated with the South Australian Government.

Created with Leaflet, PapaParse, and modern web technologies.
