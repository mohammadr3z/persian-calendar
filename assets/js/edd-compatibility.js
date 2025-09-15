/**
 * EDD Compatibility JavaScript for Persian Calendar Plugin
 * 
 * Handles client-side integration with Easy Digital Downloads
 * to provide Persian calendar functionality in EDD admin pages.
 * 
 * @package PersianCalendar
 * @since 1.1.0
 */

(function($) {
    'use strict';
    
    // EDD Persian Calendar Integration
    var EDDPersianCalendar = {
        
        /**
         * Initialize EDD Persian calendar functionality
         */
        init: function() {
            this.initDateRangePickers();
            this.convertExistingDates();
            this.handleChartDates();
            this.bindEvents();
        },
        
        /**
         * Initialize Persian date pickers for EDD date range inputs
         */
        initDateRangePickers: function() {
            // Target EDD date range inputs
            var dateInputs = $('.edd-date-range-dates input[type="text"], .edd-from-date, .edd-to-date');
            
            if (dateInputs.length && typeof PersianCalendar !== 'undefined') {
                dateInputs.each(function() {
                    var $input = $(this);
                    
                    // Skip if already initialized
                    if ($input.hasClass('persian-datepicker-initialized')) {
                        return;
                    }
                    
                    // Initialize Persian date picker
                    PersianCalendar.initDatePicker(this, {
                        format: PersianCalendarEDD.dateFormat || 'YYYY/MM/DD',
                        persianDigits: PersianCalendarEDD.enablePersianDigits || false,
                        rtl: true,
                        calendar: {
                            persian: {
                                locale: 'fa'
                            }
                        }
                    });
                    
                    $input.addClass('persian-datepicker-initialized');
                });
            }
        },
        
        /**
         * Convert existing dates in EDD pages to Persian
         */
        convertExistingDates: function() {
            var self = this;
            
            // Convert dates in tables
            $('.edd_payment_date, .edd-payment-date, .download-date').each(function() {
                var $element = $(this);
                var dateText = $element.text().trim();
                
                if (dateText && self.isValidDate(dateText)) {
                    var persianDate = self.convertToPersianDate(dateText);
                    if (persianDate) {
                        $element.text(persianDate);
                    }
                }
            });
            
            // Convert dates in reports
            $('.edd-reports-date, .edd-graph-date').each(function() {
                var $element = $(this);
                var dateText = $element.text().trim();
                
                if (dateText && self.isValidDate(dateText)) {
                    var persianDate = self.convertToPersianDate(dateText);
                    if (persianDate) {
                        $element.text(persianDate);
                    }
                }
            });
            
            // Convert EDD date range spans
            this.convertDateRangeSpans();
        },
        
        /**
         * Handle chart dates conversion
         */
        handleChartDates: function() {
            var self = this;
            
            // Hook into Chart.js if available
            if (typeof Chart !== 'undefined') {
                // Override chart date formatting
                Chart.defaults.global.tooltips.callbacks = Chart.defaults.global.tooltips.callbacks || {};
                
                var originalTitle = Chart.defaults.global.tooltips.callbacks.title;
                Chart.defaults.global.tooltips.callbacks.title = function(tooltipItems, data) {
                    var title = originalTitle ? originalTitle.call(this, tooltipItems, data) : '';
                    
                    if (title && self.isValidDate(title)) {
                        return self.convertToPersianDate(title) || title;
                    }
                    
                    return title;
                };
            }
            
            // Convert chart labels after chart initialization
            setTimeout(function() {
                $('.edd-chart canvas').each(function() {
                    var canvas = this;
                    var chart = Chart.getChart && Chart.getChart(canvas);
                    
                    if (chart && chart.data && chart.data.labels) {
                        chart.data.labels = chart.data.labels.map(function(label) {
                            if (typeof label === 'string' && self.isValidDate(label)) {
                                return self.convertToPersianDate(label) || label;
                            }
                            return label;
                        });
                        
                        chart.update();
                    }
                });
            }, 1000);
        },
        
        /**
         * Bind events for dynamic content
         */
        bindEvents: function() {
            var self = this;
            
            // Re-initialize when new content is loaded via AJAX
            $(document).ajaxComplete(function(event, xhr, settings) {
                // Check if this is an EDD AJAX request
                if (settings.url && settings.url.indexOf('edd') !== -1) {
                    setTimeout(function() {
                        self.initDateRangePickers();
                        self.convertExistingDates();
                        self.convertDateRangeSpans();
                    }, 500);
                }
            });
            
            // Handle date range form submissions
            $('.edd-date-range-form').on('submit', function() {
                var $form = $(this);
                
                // Convert Persian dates back to Gregorian for server processing
                $form.find('input[type="text"]').each(function() {
                    var $input = $(this);
                    var persianDate = $input.val();
                    
                    if (persianDate && typeof PersianCalendar !== 'undefined') {
                        var gregorianDate = PersianCalendar.toGregorian(persianDate);
                        if (gregorianDate) {
                            $input.val(gregorianDate);
                        }
                    }
                });
            });
        },
        
        /**
         * Check if a string is a valid date
         * @param {string} dateString - The date string to check
         * @returns {boolean} - True if valid date, false otherwise
         */
        isValidDate: function(dateString) {
            // Check for common date patterns
            var datePatterns = [
                /^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/,  // YYYY-MM-DD or YYYY/MM/DD
                /^\d{1,2}[-\/]\d{1,2}[-\/]\d{4}$/,  // MM-DD-YYYY or MM/DD/YYYY
                /^\d{1,2}\s+\w+\s+\d{4}$/,          // DD Month YYYY
                /^\w+\s+\d{1,2},?\s+\d{4}$/        // Month DD, YYYY
            ];
            
            return datePatterns.some(function(pattern) {
                return pattern.test(dateString.trim());
            });
        },
        
        /**
         * Convert EDD date range spans to Persian dates
         */
        convertDateRangeSpans: function() {
            var self = this;
            
            // Target EDD date range spans
            $('.edd-date-range-dates .edd-date-range-selected-date span').each(function() {
                var $span = $(this);
                var dateText = $span.text().trim();
                
                if (dateText && dateText.length > 0 && !$span.hasClass('persian-converted')) {
                    var convertedText = self.convertDateRangeText(dateText);
                    if (convertedText) {
                        $span.text(convertedText);
                        $span.addClass('persian-converted');
                    }
                }
            });
        },
        
        /**
         * Convert date range text to Persian
         * @param {string} dateText - The date text to convert
         * @returns {string|null} - Converted Persian date text or null
         */
        convertDateRangeText: function(dateText) {
            var self = this;
            
            try {
                // Handle date ranges (e.g., "31 August 2025 - 15 September 2025")
                if (dateText.includes(' - ')) {
                    var parts = dateText.split(' - ');
                    if (parts.length === 2) {
                        var startDate = self.convertSingleDateToPersian(parts[0].trim());
                        var endDate = self.convertSingleDateToPersian(parts[1].trim());
                        
                        if (startDate && endDate) {
                            return startDate + ' - ' + endDate;
                        }
                    }
                } else {
                    // Handle single dates
                    return self.convertSingleDateToPersian(dateText);
                }
            } catch (error) {
                console.warn('Persian Calendar EDD: Error converting date range:', error);
            }
            
            return null;
        },
        
        /**
         * Convert a single date string to Persian using AJAX
         * @param {string} dateStr - The date string to convert
         * @returns {string|null} - Converted Persian date or null
         */
        convertSingleDateToPersian: function(dateStr) {
            try {
                var date = new Date(dateStr);
                if (isNaN(date.getTime())) {
                    return null;
                }
                
                // Use AJAX to convert date on server side
                var result = null;
                
                $.ajax({
                    url: PersianCalendarEDD.ajaxUrl,
                    type: 'POST',
                    async: false,
                    data: {
                        action: 'convert_to_persian_date',
                        timestamp: Math.floor(date.getTime() / 1000),
                        nonce: PersianCalendarEDD.nonce
                    },
                    success: function(response) {
                        if (response.success && response.data) {
                            result = response.data;
                        }
                    },
                    error: function() {
                        console.warn('Persian Calendar EDD: AJAX error converting date');
                    }
                });
                
                return result;
            } catch (error) {
                console.warn('Persian Calendar EDD: Error converting single date:', error);
                return null;
            }
        },
        
        /**
         * Convert Gregorian date to Persian date
         * @param {string} gregorianDate - The Gregorian date string
         * @returns {string|null} - Persian date string or null if conversion fails
         */
        convertToPersianDate: function(gregorianDate) {
            if (typeof PersianCalendar === 'undefined') {
                return null;
            }
            
            try {
                var date = new Date(gregorianDate);
                if (isNaN(date.getTime())) {
                    return null;
                }
                
                return PersianCalendar.toPersian(date, {
                    format: PersianCalendarEDD.dateFormat || 'YYYY/MM/DD',
                    persianDigits: PersianCalendarEDD.enablePersianDigits || false
                });
            } catch (error) {
                console.warn('Persian Calendar EDD: Error converting date:', error);
                return null;
            }
        }
    };
    
    // Initialize when document is ready
    $(document).ready(function() {
        // Check if we're on an EDD admin page
        if ($('body').hasClass('download_page_edd-reports') || 
            $('body').hasClass('download_page_edd-payment-history') ||
            $('.edd-date-range-dates').length > 0) {
            
            EDDPersianCalendar.init();
        }
    });
    
    // Make EDDPersianCalendar globally available
    window.EDDPersianCalendar = EDDPersianCalendar;
    
})(jQuery);