# SA Crash Data Interactive Map (2012-2024)

An interactive web-based map visualization tool for exploring South Australian crash data from 2012-2024.

## Features

### **Three Visualization Layers**
- **Clustered Markers**: Individual crash locations that group together when zoomed out
- **Heatmap**: Density visualization showing crash hotspots (weighted by severity)
- **Choropleth**: Area-based statistics grouped by Local Government Area (LGA)

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
- **Area (LGA)**: Focus on specific local government areas

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

### **Real-time Statistics**
- Total crashes in filtered dataset
- Total fatalities
- Serious injuries
- Minor injuries

## How to Use

### 1. **Explore the Map**
- **Zoom**: Use mouse wheel or +/- buttons
- **Pan**: Click and drag the map
- **Click markers**: View detailed crash information

### 2. **Toggle Layers**
In the control panel on the right, you can switch between:
- Clustered Markers (default)
- Heatmap
- Choropleth

You can activate multiple layers simultaneously!

### 3. **Apply Filters**
1. Select your desired filters from the dropdowns
2. For severity, hold Ctrl/Cmd to select multiple options
3. Click the **"Apply Filters"** button to update the map
4. Statistics will update automatically

### 4. **View Details**
Click on any marker to see comprehensive crash information:
- **Crash Details**: Severity, type, date/time, location, weather, speed limit
- **Casualties**: Complete breakdown by type (driver, passenger, pedestrian, cyclist, etc.) and injury extent
  - Individual casualty details including age, sex, and safety equipment usage
- **Units Involved**: All units in the crash including vehicles (with type, year, occupants), pedestrians, and fixed objects struck
- **DUI Involvement**: Clearly marked if alcohol was involved

## Technical Details

### Data Files
The application uses crash data from the `data/` folder:
- `data/2012-2024_DATA_SA_Crash.csv` - Main crash data with locations (190,910+ records)
  - Merged from individual yearly datasets (2012-2019) and combined dataset (2020-2024)
- `data/2012-2024_DATA_SA_Casualty.csv` - Detailed casualty information (77,147 records)
  - Includes casualty type, age, sex, injury extent, safety equipment usage
- `data/2012-2024_DATA_SA_Units.csv` - Crash unit information (407,571 records)
  - Includes all units involved in crashes: vehicles, pedestrians, fixed objects struck (trees, poles, barriers), animals, etc.
  - Also includes vehicle details like type, year, occupants, and driver information
- `data/sa_lga_boundaries.geojson` - LGA boundary polygons for choropleth visualization
- `data/sa_suburbs.geojson` - Suburb boundary polygons for choropleth visualization

### Libraries Used
- **Leaflet.js** - Interactive mapping
- **Leaflet.markercluster** - Marker clustering
- **Leaflet.heat** - Heatmap visualization
- **PapaParse** - CSV file parsing
- **Proj4js** - Coordinate system conversion (EPSG:3107 to WGS84)
- **Turf.js** - Geospatial operations (point-in-polygon for N/A LGA assignment)

### Coordinate System
The data uses EPSG:3107 (GDA94 / SA Lambert) coordinates which are automatically converted to WGS84 (EPSG:4326) for display on the map.

### Intelligent LGA Assignment
Crashes with missing or N/A LGA names are automatically assigned to the correct Local Government Area using point-in-polygon detection. This ensures unincorporated areas (Pastoral Unincorporated Area, APY Lands, etc.) are properly represented in the choropleth visualization.


Created with Leaflet, PapaParse, and modern web technologies.
