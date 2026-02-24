/**
 * PDF Generator Module
 * Handles PDF export functionality with customizable charts, statistics, and data tables
 */

// ========================================
// PDF Configuration Constants
// ========================================
const PDF_CONFIG = {
    // Page layout
    MARGIN: 15,
    PAGE_FORMAT: 'a4',
    UNIT: 'mm',

    // Chart rendering quality
    CHART_SCALE_FACTOR: 3,  // Default scale factor
    CHART_SCALE_FACTORS: {
        'standard': 2,
        'high': 3,
        'ultra': 4
    },
    CHART_RENDER_DELAY_CLOSED: 300,
    CHART_RENDER_DELAY_OPEN: 200,
    CHART_MAX_RENDER_WAIT: 5000,  // Max time to wait for charts
    CHART_TITLE_HEIGHT: 8,
    CHART_BOTTOM_SPACING: 10,
    CHART_MAX_HEIGHT_SINGLE: 200,  // Near full-page height for single charts
    CHART_MAX_HEIGHT_PAIRED: 140,  // Larger paired charts

    // Image quality settings
    IMAGE_QUALITY: {
        'standard': 0.85,
        'high': 0.92,
        'maximum': 1.0
    },
    // Chart types that work better with JPEG (photo-like, gradients)
    JPEG_SUITABLE_CHARTS: ['severityTrendChart', 'crashesOverTimeChart'],

    // Colors (RGB)
    COLOR_PRIMARY: [74, 144, 226],
    COLOR_TEXT_DARK: [0, 0, 0],
    COLOR_TEXT_MEDIUM: [60, 60, 60],
    COLOR_TEXT_LIGHT: [100, 100, 100],
    COLOR_TABLE_ALT_ROW: [245, 245, 245],
    COLOR_WHITE: [255, 255, 255],

    // Typography
    FONT_SIZE_TITLE: 24,
    FONT_SIZE_HEADING: 16,
    FONT_SIZE_SUBHEADING: 14,
    FONT_SIZE_BODY: 11,
    FONT_SIZE_SMALL: 12,
    FONT_SIZE_TABLE: 8,
    FONT_FAMILY_PRIMARY: 'helvetica',
    FONT_FAMILY_HEADING: 'helvetica',

    // Spacing
    SPACING_SECTION: 15,
    SPACING_SUBSECTION: 10,
    SPACING_LINE: 7,

    // Metadata
    PDF_TITLE: 'SA Road Crash Data Report',
    PDF_SUBJECT: 'South Australia Crash Data Analysis',
    PDF_CREATOR: 'SA Crash Map',
    PDF_AUTHOR: 'SA Crash Map',
    PDF_KEYWORDS: 'crash data, road safety, south australia, analytics, statistics',

    // Page numbering
    PAGE_NUMBER_FONT_SIZE: 9,
    PAGE_NUMBER_MARGIN_BOTTOM: 10
};

// ========================================
// PDF Modal Functions
// ========================================

export function openPdfExportModal() {
    // Update crash count
    const filteredCount = window._lastCrashData ? window._lastCrashData.length : 0;
    document.getElementById('pdfModalCrashCount').textContent = filteredCount.toLocaleString();

    // Show/hide warning for large datasets
    updateTableWarning();

    // Show modal
    document.getElementById('pdfExportModal').style.display = 'flex';
}

export function closePdfExportModal() {
    document.getElementById('pdfExportModal').style.display = 'none';
}

export function applyPdfPreset(type) {
    // Update active button
    document.querySelectorAll('.pdf-preset-btn').forEach(function(btn) {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    if (type === 'quick') {
        // Quick Summary: Stats + top 3 charts
        document.getElementById('pdfIncludeCover').checked = true;
        document.getElementById('pdfIncludeStats').checked = true;
        document.getElementById('pdfIncludeCharts').checked = true;
        document.getElementById('pdfIncludeTable').checked = false;
        document.getElementById('pdfIncludeFilters').checked = true;

        // Select only first 3 charts
        selectNoCharts();
        document.getElementById('pdfChart1').checked = true;  // Over Time
        document.getElementById('pdfChart4').checked = true;  // Severity
        document.getElementById('pdfChart5').checked = true;  // Crash Types

        toggleChartOptions();
        toggleTableOptions();
    } else if (type === 'full') {
        // Full Analytics: Everything except table
        document.getElementById('pdfIncludeCover').checked = true;
        document.getElementById('pdfIncludeStats').checked = true;
        document.getElementById('pdfIncludeCharts').checked = true;
        document.getElementById('pdfIncludeTable').checked = false;
        document.getElementById('pdfIncludeFilters').checked = true;

        selectAllCharts();
        toggleChartOptions();
        toggleTableOptions();
    }
    // 'custom' doesn't change anything - user customizes
}

export function toggleChartOptions() {
    const checked = document.getElementById('pdfIncludeCharts').checked;
    const chartOptions = document.getElementById('pdfChartOptions');
    if (chartOptions) {
        chartOptions.style.display = checked ? 'block' : 'none';
    }
}

export function toggleTableOptions() {
    const checked = document.getElementById('pdfIncludeTable').checked;
    const tableOptions = document.getElementById('pdfTableOptions');
    const warning = document.getElementById('pdfTableWarning');

    if (tableOptions) {
        tableOptions.style.display = checked ? 'block' : 'none';
    }

    if (checked) {
        updateTableWarning();
    }
}

function updateTableWarning() {
    const filteredCount = window._lastCrashData ? window._lastCrashData.length : 0;
    const warning = document.getElementById('pdfTableWarning');
    if (warning && filteredCount > 200) {
        warning.style.display = 'inline';
    } else if (warning) {
        warning.style.display = 'none';
    }
}

export function selectAllCharts() {
    document.querySelectorAll('.pdf-chart-cb').forEach(function(cb) {
        cb.checked = true;
    });
}

export function selectNoCharts() {
    document.querySelectorAll('.pdf-chart-cb').forEach(function(cb) {
        cb.checked = false;
    });
}

// ========================================
// PDFGenerator Class - Modular PDF Generation
// ========================================
class PDFGenerator {
    constructor(doc, crashData, options) {
        this.doc = doc;
        this.crashData = crashData;
        this.options = options;
        this.pageWidth = doc.internal.pageSize.getWidth();
        this.pageHeight = doc.internal.pageSize.getHeight();
        this.yPos = PDF_CONFIG.MARGIN;
        this.currentPage = 1;
        this.totalPages = 0; // Will be calculated
        this.progressCallback = null;
    }

    setProgressCallback(callback) {
        this.progressCallback = callback;
    }

    setFont(fontSize, style = 'normal', color = PDF_CONFIG.COLOR_TEXT_DARK) {
        // Enhanced font setting with better styling
        this.doc.setFont(PDF_CONFIG.FONT_FAMILY_PRIMARY, style);
        this.doc.setFontSize(fontSize);
        this.doc.setTextColor(...color);
    }

    async updateProgress(message, step, totalSteps) {
        if (this.progressCallback) {
            this.progressCallback(message, step, totalSteps);
            // Force UI update by yielding to browser
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }

    checkPageSpace(requiredHeight) {
        if (this.yPos + requiredHeight > this.pageHeight - PDF_CONFIG.MARGIN) {
            this.addPage();
            return false;
        }
        return true;
    }

    addPage() {
        this.doc.addPage();
        this.yPos = PDF_CONFIG.MARGIN;
        this.currentPage++;
    }

    addPageNumbers() {
        const totalPages = this.doc.internal.getNumberOfPages();

        for (let i = 1; i <= totalPages; i++) {
            this.doc.setPage(i);
            this.doc.setFontSize(PDF_CONFIG.PAGE_NUMBER_FONT_SIZE);
            this.doc.setTextColor(...PDF_CONFIG.COLOR_TEXT_LIGHT);

            const pageText = 'Page ' + i + ' of ' + totalPages;
            const textWidth = this.doc.getTextWidth(pageText);
            const xPos = this.pageWidth - PDF_CONFIG.MARGIN - textWidth;
            const yPos = this.pageHeight - PDF_CONFIG.PAGE_NUMBER_MARGIN_BOTTOM;

            this.doc.text(pageText, xPos, yPos);
        }
    }

    async addCoverPage() {
        if (!this.options.includeCover) return;

        try {
            await this.updateProgress('Creating cover page...', 1, 6);

            // Title with bold font
            this.setFont(PDF_CONFIG.FONT_SIZE_TITLE, 'bold', PDF_CONFIG.COLOR_PRIMARY);
            this.doc.text(PDF_CONFIG.PDF_TITLE, this.pageWidth / 2, this.yPos, { align: 'center' });

            this.yPos += 15;

            // Subtitle information
            this.setFont(PDF_CONFIG.FONT_SIZE_SMALL, 'normal', PDF_CONFIG.COLOR_TEXT_LIGHT);
            this.doc.text('Generated: ' + new Date().toLocaleString(), this.pageWidth / 2, this.yPos, { align: 'center' });

            this.yPos += 10;
            this.doc.text('Total Crashes: ' + this.crashData.length.toLocaleString(), this.pageWidth / 2, this.yPos, { align: 'center' });

            this.yPos += 20;
        } catch (error) {
            console.error('Error adding cover page:', error);
            throw new Error('Failed to create cover page: ' + error.message);
        }
    }

    async addStatistics() {
        if (!this.options.includeStats) return;

        try {
            await this.updateProgress('Calculating statistics...', 2, 6);

            let totalFatalities = 0, totalSerious = 0, totalMinor = 0;
            this.crashData.forEach(crash => {
                totalFatalities += parseInt(crash['Total Fats'] || 0);
                totalSerious += parseInt(crash['Total SI'] || 0);
                totalMinor += parseInt(crash['Total MI'] || 0);
            });

            this.checkPageSpace(60);

            // Section heading with bold font
            this.setFont(PDF_CONFIG.FONT_SIZE_HEADING, 'bold', PDF_CONFIG.COLOR_TEXT_DARK);
            this.doc.text('Statistics Summary', PDF_CONFIG.MARGIN, this.yPos);
            this.yPos += PDF_CONFIG.SPACING_SUBSECTION;

            // Statistics content
            this.setFont(PDF_CONFIG.FONT_SIZE_BODY, 'normal', PDF_CONFIG.COLOR_TEXT_MEDIUM);
            this.doc.text('Total Crashes: ' + this.crashData.length.toLocaleString(), PDF_CONFIG.MARGIN, this.yPos);
            this.yPos += PDF_CONFIG.SPACING_LINE;
            this.doc.text('Fatalities: ' + totalFatalities.toLocaleString(), PDF_CONFIG.MARGIN, this.yPos);
            this.yPos += PDF_CONFIG.SPACING_LINE;
            this.doc.text('Serious Injuries: ' + totalSerious.toLocaleString(), PDF_CONFIG.MARGIN, this.yPos);
            this.yPos += PDF_CONFIG.SPACING_LINE;
            this.doc.text('Minor Injuries: ' + totalMinor.toLocaleString(), PDF_CONFIG.MARGIN, this.yPos);
            this.yPos += PDF_CONFIG.SPACING_SECTION;
        } catch (error) {
            console.error('Error adding statistics:', error);
            // Continue with PDF generation even if statistics fail
            this.doc.setFontSize(10);
            this.doc.setTextColor(255, 0, 0);
            this.doc.text('Error loading statistics section', PDF_CONFIG.MARGIN, this.yPos);
            this.yPos += PDF_CONFIG.SPACING_SECTION;
        }
    }

    async addFilters() {
        if (!this.options.includeFilters || typeof getFilterValues !== 'function') return;

        try {
            await this.updateProgress('Adding filter information...', 3, 6);

            const filters = getFilterValues();
            this.checkPageSpace(60);

            this.doc.setFontSize(PDF_CONFIG.FONT_SIZE_HEADING);
            this.doc.setTextColor(...PDF_CONFIG.COLOR_TEXT_DARK);
            this.doc.text('Active Filters', PDF_CONFIG.MARGIN, this.yPos);
            this.yPos += PDF_CONFIG.SPACING_SUBSECTION;

            this.doc.setFontSize(PDF_CONFIG.FONT_SIZE_BODY);
            this.doc.setTextColor(...PDF_CONFIG.COLOR_TEXT_MEDIUM);

            if (filters.yearFrom !== 2012 || filters.yearTo !== 2024) {
                this.doc.text('Year Range: ' + filters.yearFrom + ' - ' + filters.yearTo, PDF_CONFIG.MARGIN, this.yPos);
                this.yPos += PDF_CONFIG.SPACING_LINE;
            }
            if (!filters.selectedSeverities.includes('all')) {
                this.doc.text('Severity: ' + filters.selectedSeverities.slice(0, 3).join(', '), PDF_CONFIG.MARGIN, this.yPos);
                this.yPos += PDF_CONFIG.SPACING_LINE;
            }
            if (filters.weather !== 'all') {
                this.doc.text('Weather: ' + filters.weather, PDF_CONFIG.MARGIN, this.yPos);
                this.yPos += PDF_CONFIG.SPACING_LINE;
            }
            this.yPos += PDF_CONFIG.SPACING_SUBSECTION;
        } catch (error) {
            console.error('Error adding filters:', error);
            // Continue with PDF generation even if filters fail
        }
    }

    getHighResChartImage(canvas, chartId, quality = 'high') {
        // Get quality settings from options or use defaults
        const qualityLevel = this.options.imageQuality || quality;
        const scaleFactor = this.options.chartScale || PDF_CONFIG.CHART_SCALE_FACTOR;

        // Use canvas buffer dimensions (already high-res from Chart.js), not CSS display size
        // Chart.js automatically renders at devicePixelRatio, so canvas.width/height are already scaled
        const baseWidth = canvas.width || canvas.offsetWidth || canvas.clientWidth;
        const baseHeight = canvas.height || canvas.offsetHeight || canvas.clientHeight;

        // Create high-resolution canvas based on buffer dimensions (further scaled for PDF quality)
        const hiResCanvas = document.createElement('canvas');
        hiResCanvas.width = baseWidth * scaleFactor;
        hiResCanvas.height = baseHeight * scaleFactor;
        const ctx = hiResCanvas.getContext('2d', {
            alpha: false,  // No transparency for better compression
            willReadFrequently: false
        });

        // Fill with solid white background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, hiResCanvas.width, hiResCanvas.height);

        // Enable highest quality scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw the original chart at its full buffer resolution onto our scaled high-res canvas
        // This preserves all the detail from Chart.js's high-DPI rendering
        ctx.drawImage(canvas, 0, 0, baseWidth, baseHeight,
                     0, 0, hiResCanvas.width, hiResCanvas.height);

        // Smart format selection
        const useJPEG = this.options.smartCompression &&
                       PDF_CONFIG.JPEG_SUITABLE_CHARTS.includes(chartId);

        if (useJPEG) {
            // JPEG for charts with gradients/smooth colors (smaller file size)
            const jpegQuality = PDF_CONFIG.IMAGE_QUALITY[qualityLevel] || 0.92;
            return {
                data: hiResCanvas.toDataURL('image/jpeg', jpegQuality),
                format: 'JPEG'
            };
        } else {
            // PNG for charts with sharp edges/text (better quality)
            const pngQuality = PDF_CONFIG.IMAGE_QUALITY[qualityLevel] || 1.0;
            return {
                data: hiResCanvas.toDataURL('image/png', pngQuality),
                format: 'PNG'
            };
        }
    }

    waitForChartsReady() {
        // Promise-based chart readiness detection with animation handling
        return new Promise((resolve) => {
            // Find all chart canvases
            const allCanvases = document.querySelectorAll('canvas[id$="Chart"]');
            const chartInstances = [];

            // First pass: Stop any ongoing animations and disable future ones
            allCanvases.forEach(canvas => {
                const chart = Chart.getChart(canvas);
                if (chart) {
                    chartInstances.push(chart);
                    // Store original animation settings
                    if (!chart._pdfOriginalAnimation) {
                        chart._pdfOriginalAnimation = chart.options.animation;
                    }
                    // Disable ALL animation-related properties
                    chart.options.animation = false;
                    if (chart.options.animations) {
                        chart.options.animations = false;
                    }
                    // Stop any active animations
                    if (chart.ctx && chart.ctx.stop) {
                        chart.ctx.stop();
                    }
                }
            });

            // Wait for settings to apply
            setTimeout(() => {
                // Second pass: Force charts to render at high resolution for PDF
                chartInstances.forEach(chart => {
                    const canvas = chart.canvas;
                    const container = canvas.parentElement;

                    // Store original dimensions
                    if (!canvas._pdfOriginalWidth) {
                        canvas._pdfOriginalWidth = canvas.width;
                        canvas._pdfOriginalHeight = canvas.height;
                        canvas._pdfOriginalStyleWidth = canvas.style.width;
                        canvas._pdfOriginalStyleHeight = canvas.style.height;
                    }

                    // Force container to be large enough for high-res rendering
                    // Use very large dimensions for full-page PDF output with readable legends
                    const targetWidth = 2400;
                    const targetHeight = 1200;

                    // Set container size (if it has explicit dimensions)
                    if (container && container.style) {
                        container._pdfOriginalWidth = container.style.width;
                        container._pdfOriginalHeight = container.style.height;
                        container.style.width = targetWidth + 'px';
                        container.style.height = targetHeight + 'px';
                    }

                    // Resize chart to use the new container dimensions
                    chart.resize(targetWidth, targetHeight);

                    // Scale up fonts for better readability in PDF
                    // Store original font settings
                    if (!chart._pdfOriginalFonts) {
                        chart._pdfOriginalFonts = {
                            defaultFontSize: Chart.defaults.font?.size,
                            legendFontSize: chart.options.plugins?.legend?.labels?.font?.size,
                            titleFontSize: chart.options.plugins?.title?.font?.size,
                            tooltipFontSize: chart.options.plugins?.tooltip?.bodyFont?.size
                        };
                    }

                    // Increase font sizes proportionally (2x for large canvas)
                    const fontScale = 2.0;

                    // Set global default font size for this chart
                    if (!chart.options.font) chart.options.font = {};
                    chart.options.font.size = 14 * fontScale;

                    // Scale legend fonts
                    if (!chart.options.plugins) chart.options.plugins = {};
                    if (!chart.options.plugins.legend) chart.options.plugins.legend = {};
                    if (!chart.options.plugins.legend.labels) chart.options.plugins.legend.labels = {};
                    if (!chart.options.plugins.legend.labels.font) chart.options.plugins.legend.labels.font = {};
                    chart.options.plugins.legend.labels.font.size = 16 * fontScale;
                    chart.options.plugins.legend.labels.padding = 15;
                    chart.options.plugins.legend.labels.boxWidth = 40;
                    chart.options.plugins.legend.labels.boxHeight = 15;

                    // Scale title fonts if present
                    if (chart.options.plugins.title?.display) {
                        if (!chart.options.plugins.title.font) chart.options.plugins.title.font = {};
                        chart.options.plugins.title.font.size = 18 * fontScale;
                    }

                    // Scale axis labels
                    if (chart.options.scales) {
                        Object.keys(chart.options.scales).forEach(scaleKey => {
                            const scale = chart.options.scales[scaleKey];
                            if (!scale.ticks) scale.ticks = {};
                            if (!scale.ticks.font) scale.ticks.font = {};
                            scale.ticks.font.size = 14 * fontScale;

                            // Scale axis title if present
                            if (scale.title?.display) {
                                if (!scale.title.font) scale.title.font = {};
                                scale.title.font.size = 16 * fontScale;
                            }
                        });
                    }
                });

                // Wait for resize
                setTimeout(() => {
                    // Third pass: Force complete re-render with new fonts
                    chartInstances.forEach(chart => {
                        chart.update('none'); // Skip transitions
                        chart.render(); // Force immediate render at final state
                    });

                    // Wait for render to complete
                    setTimeout(() => {
                        resolve();
                    }, 600);
                }, 400);
            }, 200);
        });
    }

    restoreChartAnimations() {
        // Restore animations and dimensions after PDF capture
        const allCanvases = document.querySelectorAll('canvas[id$="Chart"]');

        allCanvases.forEach(canvas => {
            const chart = Chart.getChart(canvas);
            if (chart && chart._pdfOriginalAnimation !== undefined) {
                chart.options.animation = chart._pdfOriginalAnimation;
                delete chart._pdfOriginalAnimation;
            }

            // Restore container dimensions
            const container = canvas.parentElement;
            if (container && container._pdfOriginalWidth !== undefined) {
                container.style.width = container._pdfOriginalWidth;
                container.style.height = container._pdfOriginalHeight;
                delete container._pdfOriginalWidth;
                delete container._pdfOriginalHeight;
            }

            // Restore canvas dimensions
            if (canvas._pdfOriginalWidth !== undefined) {
                delete canvas._pdfOriginalWidth;
                delete canvas._pdfOriginalHeight;
                delete canvas._pdfOriginalStyleWidth;
                delete canvas._pdfOriginalStyleHeight;
            }

            // Restore font sizes
            if (chart && chart._pdfOriginalFonts) {
                // Note: We don't actually restore fonts, we just clean up the stored values
                // The charts will re-render at normal size with normal fonts automatically
                delete chart._pdfOriginalFonts;
            }

            // Resize chart back to container size (this will use default fonts again)
            if (chart) {
                chart.resize();
                chart.update('none');
            }
        });
    }

    async addCharts() {
        if (!this.options.includeCharts) return;

        try {
            await this.updateProgress('Rendering charts...', 4, 6);

            const chartMap = [
                { id: 'crashesOverTimeChart', include: this.options.charts.overTime, title: 'Crashes Over Time' },
                { id: 'crashesByDayChart', include: this.options.charts.byDay, title: 'Crashes by Day of Week' },
                { id: 'crashesByHourChart', include: this.options.charts.byHour, title: 'Crashes by Hour' },
                { id: 'severityDistributionChart', include: this.options.charts.severity, title: 'Severity Distribution' },
                { id: 'crashTypeChart', include: this.options.charts.crashType, title: 'Top Crash Types' },
                { id: 'topLGAChart', include: this.options.charts.lga, title: 'Top Areas (LGA)' },
                { id: 'weatherChart', include: this.options.charts.weather, title: 'Weather Conditions' },
                { id: 'severityTrendChart', include: this.options.charts.severityTrend, title: 'Severity Trend Over Time' }
            ];

            const chartsToInclude = [];
            for (const chartInfo of chartMap) {
                if (!chartInfo.include) continue;

                try {
                    const canvas = document.getElementById(chartInfo.id);
                    if (!canvas) {
                        console.warn('Chart canvas not found:', chartInfo.id);
                        continue;
                    }

                    // Use canvas buffer dimensions for accurate aspect ratio
                    const canvasWidth = canvas.width || canvas.offsetWidth || canvas.clientWidth;
                    const canvasHeight = canvas.height || canvas.offsetHeight || canvas.clientHeight;

                    const imageData = this.getHighResChartImage(canvas, chartInfo.id);

                    chartsToInclude.push({
                        ...chartInfo,
                        canvas,
                        imageData: imageData.data,
                        imageFormat: imageData.format,
                        aspectRatio: canvasHeight / canvasWidth
                    });
                } catch (chartError) {
                    console.error('Error processing chart ' + chartInfo.id + ':', chartError);
                    // Continue with other charts
                }
            }

            const maxWidth = this.pageWidth - (PDF_CONFIG.MARGIN * 2);

            for (let i = 0; i < chartsToInclude.length; i++) {
                const chart = chartsToInclude[i];
                const isLastChart = i === chartsToInclude.length - 1;

                // Update progress for each chart being added
                const chartProgress = 4 + (i / chartsToInclude.length);
                await this.updateProgress(`Adding chart: ${chart.title}...`, chartProgress, 6);

                let targetMaxHeight;
                if (isLastChart || (i % 2 === 0 && i + 1 === chartsToInclude.length - 1)) {
                    targetMaxHeight = PDF_CONFIG.CHART_MAX_HEIGHT_SINGLE;
                } else {
                    targetMaxHeight = PDF_CONFIG.CHART_MAX_HEIGHT_PAIRED;
                }

                let imgWidth = maxWidth;
                let imgHeight = imgWidth * chart.aspectRatio;

                if (imgHeight > targetMaxHeight) {
                    imgHeight = targetMaxHeight;
                    imgWidth = imgHeight / chart.aspectRatio;
                }

                const totalChartHeight = PDF_CONFIG.CHART_TITLE_HEIGHT + imgHeight + PDF_CONFIG.CHART_BOTTOM_SPACING;

                this.checkPageSpace(totalChartHeight);

                this.doc.setFontSize(PDF_CONFIG.FONT_SIZE_SUBHEADING);
                this.doc.setTextColor(...PDF_CONFIG.COLOR_TEXT_DARK);
                this.doc.text(chart.title, PDF_CONFIG.MARGIN, this.yPos);
                this.yPos += PDF_CONFIG.CHART_TITLE_HEIGHT;

                // Use the appropriate format for each chart
                this.doc.addImage(chart.imageData, chart.imageFormat, PDF_CONFIG.MARGIN, this.yPos, imgWidth, imgHeight, undefined, 'FAST');
                this.yPos += imgHeight + PDF_CONFIG.CHART_BOTTOM_SPACING;
            }
        } catch (error) {
            console.error('Error adding charts section:', error);
            this.doc.setFontSize(10);
            this.doc.setTextColor(255, 0, 0);
            this.doc.text('Error loading charts section', PDF_CONFIG.MARGIN, this.yPos);
            this.yPos += PDF_CONFIG.SPACING_SECTION;
        }
    }

    async addDataTable() {
        if (!this.options.includeTable) return;

        try {
            await this.updateProgress('Generating data table...', 5, 6);

            let tableData = this.crashData;
            const maxRows = this.options.tableRows === 'all' ? this.crashData.length : parseInt(this.options.tableRows);
            tableData = this.crashData.slice(0, maxRows);

            this.checkPageSpace(40);

            this.doc.setFontSize(PDF_CONFIG.FONT_SIZE_HEADING);
            this.doc.setTextColor(...PDF_CONFIG.COLOR_TEXT_DARK);
            this.doc.text('Crash Data (' + tableData.length + ' of ' + this.crashData.length + ' rows)', PDF_CONFIG.MARGIN, this.yPos);
            this.yPos += PDF_CONFIG.SPACING_SUBSECTION;

            const tableRows = tableData.map(crash => {
                return [
                    crash['Year'] || '',
                    crash['Crash Date Time'] || '',
                    crash['CSEF Severity'] || '',
                    crash['Crash Type'] || '',
                    crash['LGA'] || '',
                    crash['Weather Cond'] || ''
                ];
            });

            this.doc.autoTable({
                head: [['Year', 'Date/Time', 'Severity', 'Type', 'LGA', 'Weather']],
                body: tableRows,
                startY: this.yPos,
                margin: { left: PDF_CONFIG.MARGIN, right: PDF_CONFIG.MARGIN },
                styles: { fontSize: PDF_CONFIG.FONT_SIZE_TABLE, cellPadding: 2 },
                headStyles: { fillColor: PDF_CONFIG.COLOR_PRIMARY },
                alternateRowStyles: { fillColor: PDF_CONFIG.COLOR_TABLE_ALT_ROW }
            });
        } catch (error) {
            console.error('Error adding data table:', error);
            this.doc.setFontSize(10);
            this.doc.setTextColor(255, 0, 0);
            this.doc.text('Error loading data table section', PDF_CONFIG.MARGIN, this.yPos);
            this.yPos += PDF_CONFIG.SPACING_SECTION;
        }
    }

    async generate() {
        // Set PDF metadata
        this.doc.setProperties({
            title: PDF_CONFIG.PDF_TITLE,
            subject: PDF_CONFIG.PDF_SUBJECT,
            author: PDF_CONFIG.PDF_AUTHOR,
            keywords: PDF_CONFIG.PDF_KEYWORDS,
            creator: PDF_CONFIG.PDF_CREATOR
        });

        // Generate all sections
        await this.addCoverPage();
        await this.addStatistics();
        await this.addFilters();
        await this.addCharts();
        await this.addDataTable();

        // Add page numbers to all pages
        await this.updateProgress('Adding page numbers...', 6, 6);
        this.addPageNumbers();
    }
}

// ========================================
// Main PDF Generation Function
// ========================================

export async function generatePdfReport() {
    let analyticsPanel, wasClosed, originalVisibility, originalDisplay, loadingOverlay;
    let generator;

    try {
        // Show loading overlay
        loadingOverlay = document.getElementById('pdfLoadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
        }

        // Reset progress bar for new export
        const progressBar = document.getElementById('pdfProgressBar');
        const loadingMessage = document.getElementById('pdfLoadingMessage');
        const loadingPercent = document.getElementById('pdfLoadingPercent');
        if (progressBar) progressBar.style.width = '0%';
        if (loadingMessage) loadingMessage.textContent = 'Preparing...';
        if (loadingPercent) loadingPercent.textContent = '0%';

        // Close the PDF modal first
        closePdfExportModal();

        // Small delay to allow modal to close
        await new Promise(resolve => setTimeout(resolve, 100));

        // Get data first
        const crashData = window._lastCrashData || [];

        if (crashData.length === 0) {
            if (loadingOverlay) loadingOverlay.style.display = 'none';
            alert('No data to export. Please apply filters first.');
            return;
        }

        // Ensure analytics panel is expanded for chart rendering (but keep it invisible)
        analyticsPanel = document.getElementById('analyticsPanel');
        wasClosed = analyticsPanel && analyticsPanel.classList.contains('collapsed');

        // Store original styles
        originalVisibility = analyticsPanel ? analyticsPanel.style.visibility : '';
        originalDisplay = analyticsPanel ? analyticsPanel.style.display : '';

        if (analyticsPanel) {
            // Expand panel if collapsed - keep it on screen!
            // Loading overlay will hide it from user view
            if (wasClosed) {
                // CRITICAL: Disable CSS transitions for instant expansion
                const originalTransition = analyticsPanel.style.transition;
                analyticsPanel.style.transition = 'none';

                // Remove collapsed class (expands instantly with no animation)
                analyticsPanel.classList.remove('collapsed');

                // Force browser reflow to apply changes immediately
                void analyticsPanel.offsetHeight;

                // Restore original transition property
                analyticsPanel.style.transition = originalTransition;

                // Wait longer for charts to fully render at new dimensions
                await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
                // Panel already open - just wait for stability
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }

        // Create a temporary generator to use waitForChartsReady
        const tempDoc = { internal: { pageSize: { getWidth: () => 0, getHeight: () => 0 } } };
        const tempGenerator = new PDFGenerator(tempDoc, crashData, {});

        // Update loading message (reuse variable from above)
        if (loadingMessage) loadingMessage.textContent = 'Preparing charts...';

        // Wait for charts to be fully rendered using promise-based detection
        await tempGenerator.waitForChartsReady();

        // Get selected options including quality settings
        const options = {
            includeCover: document.getElementById('pdfIncludeCover').checked,
            includeStats: document.getElementById('pdfIncludeStats').checked,
            includeCharts: document.getElementById('pdfIncludeCharts').checked,
            includeTable: document.getElementById('pdfIncludeTable').checked,
            includeFilters: document.getElementById('pdfIncludeFilters').checked,
            charts: {
                overTime: document.getElementById('pdfChart1').checked,
                byDay: document.getElementById('pdfChart2').checked,
                byHour: document.getElementById('pdfChart3').checked,
                severity: document.getElementById('pdfChart4').checked,
                crashType: document.getElementById('pdfChart5').checked,
                lga: document.getElementById('pdfChart6').checked,
                weather: document.getElementById('pdfChart7').checked,
                severityTrend: document.getElementById('pdfChart8').checked
            },
            tableRows: document.querySelector('input[name="pdfTableRows"]:checked')?.value || '50',
            orientation: document.querySelector('input[name="pdfOrientation"]:checked')?.value || 'landscape',
            filename: document.getElementById('pdfFilename').value || 'SA_Crash_Report',

            // Quality settings - always high quality
            imageQuality: 'high',
            chartScale: PDF_CONFIG.CHART_SCALE_FACTORS['high'],
            smartCompression: true
        };

        // Create PDF document
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: options.orientation,
            unit: PDF_CONFIG.UNIT,
            format: PDF_CONFIG.PAGE_FORMAT
        });

        // Create PDF generator instance
        generator = new PDFGenerator(doc, crashData, options);

        // Set up progress callback for real-time updates
        generator.setProgressCallback((message, step, totalSteps) => {
            const progressPercent = Math.round((step / totalSteps) * 100);

            // Update loading overlay
            const progressBar = document.getElementById('pdfProgressBar');
            const loadingMessage = document.getElementById('pdfLoadingMessage');
            const loadingPercent = document.getElementById('pdfLoadingPercent');

            if (progressBar) progressBar.style.width = progressPercent + '%';
            if (loadingMessage) loadingMessage.textContent = message;
            if (loadingPercent) loadingPercent.textContent = progressPercent + '%';
        });

        // Generate PDF with all sections
        await generator.generate();

        // Save PDF
        const timestamp = new Date().toISOString().slice(0, 10);
        doc.save(options.filename + '_' + timestamp + '.pdf');

        // Show success notification
        if (typeof showNotification === 'function') {
            showNotification('PDF report generated successfully!', 'success');
        }

    } catch (error) {
        console.error('Error generating PDF:', error);

        // Show error notification
        if (typeof showNotification === 'function') {
            showNotification('Failed to generate PDF report. Please try again.', 'error');
        } else {
            alert('Failed to generate PDF report. Please try again.');
        }
    } finally {
        // Always restore chart state and cleanup, whether success or error
        try {
            // Restore chart animations
            if (generator) {
                generator.restoreChartAnimations();
            }

            // Restore panel state
            if (analyticsPanel && wasClosed) {
                analyticsPanel.classList.add('collapsed');
            }

            // Hide loading overlay
            if (loadingOverlay) {
                loadingOverlay.style.display = 'none';
            }
        } catch (cleanupError) {
            console.error('Error during cleanup:', cleanupError);
        }
    }
}
