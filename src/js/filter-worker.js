/**
 * Filter Worker
 * Runs crash record matching off the main thread to keep the UI responsive.
 *
 * Protocol:
 *   INIT   { type:'INIT', crashData, heavyVehicleTypes }  → READY
 *   FILTER { type:'FILTER', id, filters }                 → RESULT { type:'RESULT', id, indicesBuffer }
 *
 * indicesBuffer is a transferred Uint32Array.buffer (zero-copy) holding the
 * indices into the original crashData array that passed every filter.
 *
 * NOTE: The drawn-area polygon filter is NOT handled here because it requires
 * turf.js, which is loaded as a CDN global on the main thread.  The main thread
 * applies that filter as a post-step on the indices returned here.
 */

let crashData = null;
let HEAVY_VEHICLE_TYPES = [];

self.onmessage = function (e) {
    const { type } = e.data;

    if (type === 'INIT') {
        crashData = e.data.crashData;
        HEAVY_VEHICLE_TYPES = e.data.heavyVehicleTypes;
        self.postMessage({ type: 'READY' });
        return;
    }

    if (type === 'FILTER') {
        const { id, filters } = e.data;

        if (!crashData) {
            const empty = new Uint32Array(0);
            self.postMessage({ type: 'RESULT', id, indicesBuffer: empty.buffer }, [empty.buffer]);
            return;
        }

        const matching = [];
        for (let i = 0; i < crashData.length; i++) {
            const row = crashData[i];
            if (
                matchesBasicFilters(row, filters) &&
                matchesDateTimeFilters(row, filters) &&
                matchesCasualtyFilters(row, filters) &&
                matchesUnitsFilters(row, filters)
            ) {
                matching.push(i);
            }
        }

        const indicesBuffer = new Uint32Array(matching).buffer;
        self.postMessage({ type: 'RESULT', id, indicesBuffer }, [indicesBuffer]);
        return;
    }
};

// ─── Filter functions ────────────────────────────────────────────────────────
// These are intentionally self-contained copies of the functions in filters.js.
// The draw-area filter block is omitted; it is applied on the main thread.

function matchesBasicFilters(row, filters) {
    const year = parseInt(row.Year);
    const severity = row['CSEF Severity'];

    if (year < filters.yearFrom || year > filters.yearTo) return false;

    if (!filters.selectedSeverities.includes('all') && !filters.selectedSeverities.includes(severity)) {
        return false;
    }

    if (!filters.selectedCrashTypes.includes('all') && !filters.selectedCrashTypes.includes(row['Crash Type'])) {
        return false;
    }

    if (filters.weather !== 'all' && row['Weather Cond'] !== filters.weather) return false;
    if (filters.dayNight !== 'all' && row.DayNight !== filters.dayNight) return false;

    if (filters.duiInvolved !== 'all') {
        const duiValue = row['DUI Involved'] ? row['DUI Involved'].trim() : '';
        if (filters.duiInvolved === 'Yes' && duiValue !== 'Y') return false;
        if (filters.duiInvolved === 'No' && duiValue === 'Y') return false;
    }

    if (filters.drugsInvolved !== 'all') {
        const drugsValue = row['Drugs Involved'] ? row['Drugs Involved'].trim() : '';
        if (filters.drugsInvolved === 'Yes' && drugsValue !== 'Y') return false;
        if (filters.drugsInvolved === 'No' && drugsValue === 'Y') return false;
    }

    if (!filters.selectedAreas.includes('all') && !filters.selectedAreas.includes(row['LGA'])) {
        return false;
    }

    if (!filters.selectedSuburbs.includes('all') && !filters.selectedSuburbs.includes(row.Suburb)) {
        return false;
    }

    if (!filters.selectedRoadSurfaces.includes('all')) {
        if (!filters.selectedRoadSurfaces.includes(row['Road Surface'])) return false;
    }

    if (!filters.selectedMoistureConds.includes('all')) {
        if (!filters.selectedMoistureConds.includes(row['Moisture Cond'])) return false;
    }

    if (filters.selectedSpeedZones && !filters.selectedSpeedZones.includes('all')) {
        const speed = (row['Area Speed'] || '').trim();
        if (!filters.selectedSpeedZones.includes(speed)) return false;
    }

    if (filters.selectedMonths && !filters.selectedMonths.includes('all')) {
        const dt = row['Crash Date Time'];
        if (!dt) return false;
        const datePart = dt.split(' ')[0];
        const dp = datePart ? datePart.split('/') : [];
        if (dp.length < 2) return false;
        const month = String(parseInt(dp[1]));
        if (!filters.selectedMonths.includes(month)) return false;
    }

    return true;
}

function matchesDateTimeFilters(row, filters) {
    const crashDateTime = row['Crash Date Time'];
    if (!crashDateTime) return filters.dateFrom || filters.dateTo || filters.timeFrom || filters.timeTo ? false : true;

    const parts = crashDateTime.split(' ');

    if (filters.dateFrom || filters.dateTo) {
        if (parts.length >= 1) {
            const dateParts = parts[0].split('/');
            if (dateParts.length === 3) {
                const crashDate = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
                if (filters.dateFrom && crashDate < filters.dateFrom) return false;
                if (filters.dateTo && crashDate > filters.dateTo) return false;
            } else {
                return false;
            }
        } else {
            return false;
        }
    }

    if (filters.timeFrom || filters.timeTo) {
        if (parts.length >= 2) {
            const crashTime = parts[1];
            if (filters.timeFrom && filters.timeTo) {
                if (filters.timeFrom <= filters.timeTo) {
                    if (crashTime < filters.timeFrom || crashTime > filters.timeTo) return false;
                } else {
                    // Crosses midnight (e.g. 22:00 to 02:00)
                    if (crashTime < filters.timeFrom && crashTime > filters.timeTo) return false;
                }
            } else if (filters.timeFrom) {
                if (crashTime < filters.timeFrom) return false;
            } else if (filters.timeTo) {
                if (crashTime > filters.timeTo) return false;
            }
        } else {
            return false;
        }
    }

    return true;
}

function matchesCasualtyFilters(row, filters) {
    const casualties = row._casualties;
    if (!casualties || casualties.length === 0) {
        return filters.selectedRoadUsers.includes('all') &&
               filters.selectedAgeGroups.includes('all') &&
               filters.selectedSexes.includes('all') &&
               filters.selectedInjuries.includes('all') &&
               filters.selectedSeatBelts.includes('all') &&
               filters.selectedHelmets.includes('all');
    }

    const hasRoadUserFilter = !filters.selectedRoadUsers.includes('all');
    const hasAgeFilter      = !filters.selectedAgeGroups.includes('all');
    const hasSexFilter      = !filters.selectedSexes.includes('all');
    const hasInjuryFilter   = !filters.selectedInjuries.includes('all');
    const hasSeatBeltFilter = !filters.selectedSeatBelts.includes('all');
    const hasHelmetFilter   = !filters.selectedHelmets.includes('all');

    const hasAnyCasualtyFilter = hasRoadUserFilter || hasAgeFilter || hasSexFilter ||
                                 hasInjuryFilter || hasSeatBeltFilter || hasHelmetFilter;

    if (!hasAnyCasualtyFilter) return true;

    const roadUserSet  = hasRoadUserFilter  ? new Set(filters.selectedRoadUsers)  : null;
    const sexSet       = hasSexFilter       ? new Set(filters.selectedSexes)       : null;
    const injurySet    = hasInjuryFilter    ? new Set(filters.selectedInjuries)    : null;
    const seatBeltSet  = hasSeatBeltFilter  ? new Set(filters.selectedSeatBelts)  : null;
    const helmetSet    = hasHelmetFilter    ? new Set(filters.selectedHelmets)    : null;

    return casualties.some(casualty => {
        if (hasRoadUserFilter && !roadUserSet.has(casualty['Casualty Type'])) return false;

        if (hasAgeFilter) {
            const age = parseInt(casualty.AGE);
            if (isNaN(age)) return false;
            const matchesAnyAgeGroup = filters.selectedAgeGroups.some(group => {
                if (group === '0-17')  return age >= 0  && age <= 17;
                if (group === '18-25') return age >= 18 && age <= 25;
                if (group === '26-35') return age >= 26 && age <= 35;
                if (group === '36-50') return age >= 36 && age <= 50;
                if (group === '51-65') return age >= 51 && age <= 65;
                if (group === '66+')   return age >= 66;
                return false;
            });
            if (!matchesAnyAgeGroup) return false;
        }

        if (hasSexFilter     && !sexSet.has(casualty.Sex))                     return false;
        if (hasInjuryFilter  && !injurySet.has(casualty['Injury Extent']))     return false;
        if (hasSeatBeltFilter && !seatBeltSet.has(casualty['Seat Belt']))      return false;
        if (hasHelmetFilter  && !helmetSet.has(casualty.Helmet))               return false;

        return true;
    });
}

function matchesUnitsFilters(row, filters) {
    const units = row._units || [];

    const hasVehicleTypeFilter  = !filters.selectedVehicles.includes('all');
    const hasVehicleYearFilter  = !filters.selectedVehicleYears.includes('all');
    const hasOccupantsFilter    = !filters.selectedOccupants.includes('all');
    const hasLicenseTypeFilter  = !filters.selectedLicenseTypes.includes('all');
    const hasRegStateFilter     = !filters.selectedRegStates.includes('all');
    const hasDirectionFilter    = !filters.selectedDirections.includes('all');
    const hasMovementFilter     = !filters.selectedMovements.includes('all');
    const hasHeavyVehicleFilter = filters.heavyVehicle !== 'all';
    const hasTowingFilter       = filters.towing !== 'all';
    const hasRolloverFilter     = filters.rollover !== 'all';
    const hasFireFilter         = filters.fire !== 'all';

    const hasAnyUnitFilter = hasVehicleTypeFilter || hasVehicleYearFilter ||
                             hasOccupantsFilter || hasLicenseTypeFilter ||
                             hasRegStateFilter || hasDirectionFilter || hasMovementFilter ||
                             hasHeavyVehicleFilter || hasTowingFilter || hasRolloverFilter || hasFireFilter;

    if (!hasAnyUnitFilter) return true;
    if (units.length === 0) return false;

    const vehicleTypeSet = hasVehicleTypeFilter ? new Set(filters.selectedVehicles)      : null;
    const vehicleYearSet = hasVehicleYearFilter ? new Set(filters.selectedVehicleYears)  : null;
    const occupantsSet   = hasOccupantsFilter   ? new Set(filters.selectedOccupants)     : null;
    const licenseTypeSet = hasLicenseTypeFilter ? new Set(filters.selectedLicenseTypes)  : null;
    const regStateSet    = hasRegStateFilter    ? new Set(filters.selectedRegStates)     : null;
    const directionSet   = hasDirectionFilter   ? new Set(filters.selectedDirections)    : null;
    const movementSet    = hasMovementFilter    ? new Set(filters.selectedMovements)     : null;

    return units.some(unit => {
        if (hasHeavyVehicleFilter) {
            const isHeavy = HEAVY_VEHICLE_TYPES.includes(unit['Unit Type']);
            if (filters.heavyVehicle === 'Yes' && !isHeavy) return false;
            if (filters.heavyVehicle === 'No'  && isHeavy)  return false;
        }

        if (hasTowingFilter) {
            const val = (unit.Towing || '').trim();
            const hasTowing = val !== '' && val !== 'Not Towing' && val !== 'Unknown';
            if (filters.towing === 'Yes' && !hasTowing) return false;
            if (filters.towing === 'No'  && hasTowing)  return false;
        }

        if (hasRolloverFilter) {
            const hasRollover = unit.Rollover && unit.Rollover.trim() !== '';
            if (filters.rollover === 'Yes' && !hasRollover) return false;
            if (filters.rollover === 'No'  && hasRollover)  return false;
        }

        if (hasFireFilter) {
            const hasFire = unit.Fire && unit.Fire.trim() !== '';
            if (filters.fire === 'Yes' && !hasFire) return false;
            if (filters.fire === 'No'  && hasFire)  return false;
        }

        if (hasVehicleTypeFilter && !vehicleTypeSet.has(unit['Unit Type']))              return false;

        if (hasVehicleYearFilter) {
            const year = parseInt(unit['Veh Year']);
            if (isNaN(year)) return false;
            const matches = filters.selectedVehicleYears.some(range => {
                if (range === 'pre-2000')   return year < 2000;
                if (range === '2000-2010')  return year >= 2000 && year <= 2010;
                if (range === '2011-2020')  return year >= 2011 && year <= 2020;
                if (range === '2021+')      return year >= 2021;
                return false;
            });
            if (!matches) return false;
        }

        if (hasOccupantsFilter) {
            const occupantsStr = unit['Number Occupants'];
            if (occupantsStr !== undefined && occupantsStr !== null) {
                const occupants = parseInt(occupantsStr);
                if (!isNaN(occupants)) {
                    if (occupants === 0) return false;
                    const matches = filters.selectedOccupants.some(value => {
                        if (value === '1')  return occupants === 1;
                        if (value === '2')  return occupants === 2;
                        if (value === '3')  return occupants === 3;
                        if (value === '4')  return occupants === 4;
                        if (value === '5+') return occupants >= 5;
                        return false;
                    });
                    if (!matches) return false;
                } else {
                    return false;
                }
            } else {
                return false;
            }
        }

        if (hasLicenseTypeFilter && !licenseTypeSet.has(unit['Licence Type']))           return false;
        if (hasRegStateFilter    && !regStateSet.has(unit['Veh Reg State']))             return false;
        if (hasDirectionFilter   && !directionSet.has(unit['Direction Of Travel']))      return false;
        if (hasMovementFilter    && !movementSet.has(unit['Unit Movement']))             return false;

        return true;
    });
}
