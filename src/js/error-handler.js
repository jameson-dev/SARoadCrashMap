/**
 * Error Handler Module
 * Provides centralised error handling and recovery mechanisms
 */

import { showNotification } from './ui.js';

/**
 * Error types
 */
export const ERROR_TYPES = {
    NETWORK: 'NETWORK_ERROR',
    DATA_LOAD: 'DATA_LOAD_ERROR',
    DATA_PARSE: 'DATA_PARSE_ERROR',
    RENDER: 'RENDER_ERROR',
    FILTER: 'FILTER_ERROR',
    EXPORT: 'EXPORT_ERROR',
    UNKNOWN: 'UNKNOWN_ERROR'
};

/**
 * Global error handler
 */
class ErrorHandler {
    constructor() {
        this.errors = [];
        this.maxErrors = 50; // Keep last 50 errors
        this.setupGlobalHandlers();
    }

    /**
     * Setup global error handlers
     */
    setupGlobalHandlers() {
        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.handleError(event.reason, ERROR_TYPES.UNKNOWN, 'Unhandled Promise');
            event.preventDefault();
        });

        // Handle global errors
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error || event.message);
            this.handleError(
                event.error || new Error(event.message),
                ERROR_TYPES.UNKNOWN,
                'Global Error'
            );
        });
    }

    /**
     * Handle and log error
     * @param {Error} error - The error object
     * @param {string} type - Error type from ERROR_TYPES
     * @param {string} context - Context where error occurred
     * @param {boolean} showUser - Whether to show notification to user
     */
    handleError(error, type = ERROR_TYPES.UNKNOWN, context = '', showUser = true) {
        const errorInfo = {
            timestamp: new Date().toISOString(),
            type,
            context,
            message: error?.message || String(error),
            stack: error?.stack || null
        };

        // Store error
        this.errors.push(errorInfo);
        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }

        // Log error
        console.error(`[${type}] ${context}:`, error);

        // Show user notification if needed
        if (showUser) {
            this.showUserError(type, errorInfo.message);
        }

        return errorInfo;
    }

    /**
     * Show user-friendly error message
     */
    showUserError(type, message) {
        const userMessages = {
            [ERROR_TYPES.NETWORK]: 'Network error. Please check your connection.',
            [ERROR_TYPES.DATA_LOAD]: 'Failed to load data. Please refresh the page.',
            [ERROR_TYPES.DATA_PARSE]: 'Error processing data. Some features may not work.',
            [ERROR_TYPES.RENDER]: 'Display error. Please try again.',
            [ERROR_TYPES.FILTER]: 'Filter error. Please adjust your filters.',
            [ERROR_TYPES.EXPORT]: 'Export failed. Please try again.',
            [ERROR_TYPES.UNKNOWN]: 'An error occurred. Please try again.'
        };

        const userMessage = userMessages[type] || userMessages[ERROR_TYPES.UNKNOWN];

        if (typeof showNotification === 'function') {
            showNotification(userMessage, 'error');
        } else {
            // Fallback to alert if notification not available
            console.error(userMessage);
        }
    }

    /**
     * Wrap async function with error handling
     * @param {Function} fn - Async function to wrap
     * @param {string} type - Error type
     * @param {string} context - Context description
     * @returns {Function} Wrapped function
     */
    wrapAsync(fn, type, context) {
        return async (...args) => {
            try {
                return await fn(...args);
            } catch (error) {
                this.handleError(error, type, context);
                throw error; // Re-throw after handling
            }
        };
    }

    /**
     * Wrap synchronous function with error handling
     * @param {Function} fn - Function to wrap
     * @param {string} type - Error type
     * @param {string} context - Context description
     * @param {*} fallback - Fallback value to return on error
     * @returns {Function} Wrapped function
     */
    wrap(fn, type, context, fallback = null) {
        return (...args) => {
            try {
                return fn(...args);
            } catch (error) {
                this.handleError(error, type, context);
                return fallback;
            }
        };
    }

    /**
     * Get error history
     */
    getErrors() {
        return [...this.errors];
    }

    /**
     * Clear error history
     */
    clearErrors() {
        this.errors = [];
    }

    /**
     * Get error statistics
     */
    getStats() {
        const stats = {};
        this.errors.forEach(error => {
            stats[error.type] = (stats[error.type] || 0) + 1;
        });
        return {
            total: this.errors.length,
            byType: stats,
            recent: this.errors.slice(-10)
        };
    }
}

// Create singleton instance
export const errorHandler = new ErrorHandler();

// Export convenience functions
export const handleError = (error, type, context, showUser) =>
    errorHandler.handleError(error, type, context, showUser);

export const wrapAsync = (fn, type, context) =>
    errorHandler.wrapAsync(fn, type, context);

export const wrap = (fn, type, context, fallback) =>
    errorHandler.wrap(fn, type, context, fallback);

// Expose globally for debugging
if (typeof window !== 'undefined') {
    window.errorHandler = errorHandler;
}

export default errorHandler;
