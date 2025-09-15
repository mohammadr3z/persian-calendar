<?php
/**
 * EDD Compatibility Class for Persian Calendar Plugin
 * 
 * Handles integration with Easy Digital Downloads plugin to convert
 * dates in reports, charts, and date ranges to Persian calendar.
 * 
 * @package PersianCalendar
 * @since 1.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly.
}

/**
 * Persian Calendar EDD Compatibility Class
 * 
 * Provides seamless integration with Easy Digital Downloads by converting
 * dates in reports, earnings charts, and date range selectors to Persian calendar.
 */
class PC_EDD_Compatibility {
    
    /**
     * Date converter instance for Jalali calendar operations.
     * 
     * @var PC_Date_Converter
     */
    private $date_converter;
    
    /**
     * Plugin settings array.
     * 
     * @var array
     */
    private $settings;
    
    /**
     * Constructor - Initialize EDD compatibility.
     * 
     * @param PC_Date_Converter $date_converter Instance of date converter class.
     * @param array $settings Plugin settings array.
     */
    public function __construct( PC_Date_Converter $date_converter, array $settings = [] ) {
        $this->date_converter = $date_converter;
        $this->settings = $settings;
    }
    
    /**
     * Initialize EDD compatibility hooks and filters.
     * 
     * Sets up all necessary WordPress hooks to integrate Persian calendar
     * with EDD reports, charts, and date functionality.
     */
    public function init() : void {
        // Check if EDD is active before adding hooks
        if ( ! $this->is_edd_active() ) {
            return;
        }
        
        // Check if EDD compatibility is enabled in settings
        if ( ! $this->is_edd_compatibility_enabled() ) {
            return;
        }
        
        // Hook into EDD reports and charts
        add_filter( 'edd_reports_graph_overview_earnings_chart', [ $this, 'filter_earnings_chart_dates' ], 10, 1 );
        
        // Hook into EDD date range functionality
        add_action( 'wp_enqueue_scripts', [ $this, 'enqueue_edd_date_scripts' ] );
        add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_edd_date_scripts' ] );
        
        // Filter EDD date displays
        add_filter( 'edd_date_i18n', [ $this, 'filter_edd_dates' ], 10, 4 );
        
        // Hook into EDD reports page
        add_action( 'edd_reports_page_top', [ $this, 'modify_date_range_picker' ] );
        
        // Filter EDD admin date displays
        add_filter( 'edd_admin_date_format', [ $this, 'get_persian_date_format' ] );
        
        // Hook into EDD payment history dates
        add_filter( 'edd_payment_date', [ $this, 'filter_payment_dates' ], 10, 2 );
        
        // Hook into EDD download log dates
        add_filter( 'edd_log_date', [ $this, 'filter_log_dates' ], 10, 2 );
        
        // Hook into EDD date range display
        add_action( 'wp_footer', [ $this, 'convert_date_range_spans' ] );
        add_action( 'admin_footer', [ $this, 'convert_date_range_spans' ] );
        
        // AJAX handlers
        add_action( 'wp_ajax_convert_to_persian_date', [ $this, 'ajax_convert_to_persian_date' ] );
        add_action( 'wp_ajax_nopriv_convert_to_persian_date', [ $this, 'ajax_convert_to_persian_date' ] );
    }
    
    /**
     * Check if Easy Digital Downloads plugin is active.
     * 
     * @return bool True if EDD is active, false otherwise.
     */
    private function is_edd_active() : bool {
        return class_exists( 'Easy_Digital_Downloads' ) || function_exists( 'EDD' );
    }
    
    /**
     * Check if EDD compatibility is enabled in plugin settings.
     * 
     * @return bool True if EDD compatibility is enabled, false otherwise.
     */
    private function is_edd_compatibility_enabled() : bool {
        return ! empty( $this->settings['enable_edd_compatibility'] );
    }
    
    /**
     * Filter earnings chart data to use Persian dates.
     * 
     * @param array $chart_data The earnings chart data.
     * @return array Modified chart data with Persian dates.
     */
    public function filter_earnings_chart_dates( $chart_data ) {
        if ( ! is_array( $chart_data ) || ! isset( $chart_data['data'] ) ) {
            return $chart_data;
        }
        
        $convert_digits = ! empty( $this->settings['enable_persian_digits'] );
        
        // Convert date labels in chart data
        if ( isset( $chart_data['data']['labels'] ) && is_array( $chart_data['data']['labels'] ) ) {
            foreach ( $chart_data['data']['labels'] as $index => $label ) {
                // Try to parse the date and convert to Persian
                $timestamp = strtotime( $label );
                if ( $timestamp !== false ) {
                    $chart_data['data']['labels'][$index] = $this->date_converter->format_jalali(
                        'j F Y',
                        $timestamp,
                        wp_timezone(),
                        $convert_digits
                    );
                }
            }
        }
        
        return $chart_data;
    }
    
    /**
     * Enqueue scripts for EDD date range functionality.
     */
    public function enqueue_edd_date_scripts() : void {
        // Only enqueue on EDD admin pages
        if ( ! is_admin() || ! $this->is_edd_admin_page() ) {
            return;
        }
        
        wp_enqueue_script(
            'persian-calendar-edd',
            PC_PLUGIN_URL . 'assets/js/edd-compatibility.js',
            [ 'jquery', 'persian-calendar-main' ],
            PC_PLUGIN_VERSION,
            true
        );
        
        // Pass settings to JavaScript
        wp_localize_script(
            'persian-calendar-edd',
            'PersianCalendarEDD',
            [
                'enablePersianDigits' => ! empty( $this->settings['enable_persian_digits'] ),
                'dateFormat' => $this->get_persian_date_format(),
                'ajaxUrl' => admin_url( 'admin-ajax.php' ),
                'nonce' => wp_create_nonce( 'persian_calendar_edd_nonce' )
            ]
        );
    }
    
    /**
     * Check if current admin page is an EDD page.
     * 
     * @return bool True if on EDD admin page, false otherwise.
     */
    private function is_edd_admin_page() : bool {
        $screen = get_current_screen();
        if ( ! $screen ) {
            return false;
        }
        
        // Check for EDD admin pages
        $edd_pages = [
            'download_page_edd-reports',
            'download_page_edd-payment-history',
            'download_page_edd-customers',
            'download_page_edd-discounts',
            'download_page_edd-tools'
        ];
        
        return in_array( $screen->id, $edd_pages, true ) || 
               strpos( $screen->id, 'edd-' ) !== false ||
               strpos( $screen->post_type, 'download' ) !== false;
    }
    
    /**
     * Filter EDD date displays.
     * 
     * @param string $formatted The formatted date string.
     * @param string $format PHP date format string.
     * @param int $timestamp Unix timestamp.
     * @param bool $gmt Whether to use GMT timezone.
     * @return string Formatted Persian date string.
     */
    public function filter_edd_dates( $formatted, $format, $timestamp, $gmt = false ) {
        $tz = $gmt ? new \DateTimeZone( 'UTC' ) : wp_timezone();
        $convert_digits = ! empty( $this->settings['enable_persian_digits'] );
        
        return $this->date_converter->format_jalali( $format, $timestamp, $tz, $convert_digits );
    }
    
    /**
     * Modify EDD date range picker to support Persian calendar.
     */
    public function modify_date_range_picker() : void {
        // Add custom CSS and JS for Persian date picker
        echo '<style>
            .edd-date-range-dates .persian-datepicker {
                direction: rtl;
                font-family: "IRANSans", "Tahoma", sans-serif;
            }
            .edd-date-range-dates input[type="text"] {
                text-align: right;
            }
        </style>';
        
        echo '<script>
            jQuery(document).ready(function($) {
                // Initialize Persian date picker for EDD date range inputs
                if (typeof PersianCalendar !== "undefined") {
                    $(".edd-date-range-dates input[type=text]").each(function() {
                        PersianCalendar.initDatePicker(this);
                    });
                }
            });
        </script>';
    }
    
    /**
     * Get Persian date format for EDD.
     * 
     * @return string Persian date format string.
     */
    public function get_persian_date_format() : string {
        return 'Y/m/d'; // Persian date format
    }
    
    /**
     * Filter EDD payment dates.
     * 
     * @param string $date The payment date.
     * @param int $payment_id The payment ID.
     * @return string Formatted Persian payment date.
     */
    public function filter_payment_dates( $date, $payment_id ) {
        $timestamp = strtotime( $date );
        if ( $timestamp === false ) {
            return $date;
        }
        
        $convert_digits = ! empty( $this->settings['enable_persian_digits'] );
        return $this->date_converter->format_jalali( 'Y/m/d H:i', $timestamp, wp_timezone(), $convert_digits );
    }
    
    /**
     * Filter EDD log dates.
     * 
     * @param string $date The log date.
     * @param int $log_id The log ID.
     * @return string Formatted Persian log date.
     */
    public function filter_log_dates( $date, $log_id ) {
        $timestamp = strtotime( $date );
        if ( $timestamp === false ) {
            return $date;
        }
        
        $convert_digits = ! empty( $this->settings['enable_persian_digits'] );
        return $this->date_converter->format_jalali( 'Y/m/d H:i', $timestamp, wp_timezone(), $convert_digits );
    }
    
    /**
     * Convert EDD date range spans to Persian dates.
     * 
     * Outputs JavaScript to convert date range spans in EDD reports.
     */
    public function convert_date_range_spans() : void {
        // Only run on EDD admin pages
        if ( ! is_admin() || ! $this->is_edd_admin_page() ) {
            return;
        }
        
        $convert_digits = ! empty( $this->settings['enable_persian_digits'] );
        
        ?>
        <script type="text/javascript">
        jQuery(document).ready(function($) {
            // Convert EDD date range spans
            $('.edd-date-range-dates .edd-date-range-selected-date span').each(function() {
                var $span = $(this);
                var dateText = $span.text().trim();
                
                if (dateText && dateText.length > 0) {
                    // Parse and convert date ranges
                    var convertedText = convertDateRangeText(dateText);
                    if (convertedText) {
                        $span.text(convertedText);
                    }
                }
            });
            
            /**
             * Convert date range text to Persian
             * @param {string} dateText - The date text to convert
             * @returns {string|null} - Converted Persian date text or null
             */
            function convertDateRangeText(dateText) {
                try {
                    // Handle date ranges (e.g., "31 August 2025 - 15 September 2025")
                    if (dateText.includes(' - ')) {
                        var parts = dateText.split(' - ');
                        if (parts.length === 2) {
                            var startDate = convertSingleDate(parts[0].trim());
                            var endDate = convertSingleDate(parts[1].trim());
                            
                            if (startDate && endDate) {
                                return startDate + ' - ' + endDate;
                            }
                        }
                    } else {
                        // Handle single dates
                        return convertSingleDate(dateText);
                    }
                } catch (error) {
                    console.warn('Error converting date range:', error);
                }
                
                return null;
            }
            
            /**
             * Convert a single date to Persian
             * @param {string} dateStr - The date string to convert
             * @returns {string|null} - Converted Persian date or null
             */
            function convertSingleDate(dateStr) {
                try {
                    var date = new Date(dateStr);
                    if (isNaN(date.getTime())) {
                        return null;
                    }
                    
                    // Convert to Persian date using PHP-generated data
                    var persianDate = convertToPersianDate(date);
                    return persianDate;
                } catch (error) {
                    return null;
                }
            }
            
            /**
             * Convert JavaScript Date to Persian date string
             * @param {Date} date - The JavaScript Date object
             * @returns {string} - Persian date string
             */
            function convertToPersianDate(date) {
                // Send AJAX request to convert date
                var result = null;
                
                $.ajax({
                    url: '<?php echo admin_url( 'admin-ajax.php' ); ?>',
                    type: 'POST',
                    async: false,
                    data: {
                        action: 'convert_to_persian_date',
                        timestamp: Math.floor(date.getTime() / 1000),
                        nonce: '<?php echo wp_create_nonce( 'persian_calendar_convert_date' ); ?>'
                    },
                    success: function(response) {
                        if (response.success && response.data) {
                            result = response.data;
                        }
                    }
                });
                
                return result || date.toLocaleDateString();
            }
        });
        </script>
        <?php
    }
    
    /**
     * AJAX handler for converting dates to Persian.
     */
    public function ajax_convert_to_persian_date() : void {
        // Verify nonce
        if ( ! wp_verify_nonce( $_POST['nonce'] ?? '', 'persian_calendar_convert_date' ) ) {
            wp_die( 'Security check failed' );
        }
        
        $timestamp = intval( $_POST['timestamp'] ?? 0 );
        if ( $timestamp <= 0 ) {
            wp_send_json_error( 'Invalid timestamp' );
        }
        
        $convert_digits = ! empty( $this->settings['enable_persian_digits'] );
        $persian_date = $this->date_converter->format_jalali( 'j F Y', $timestamp, wp_timezone(), $convert_digits );
        
        wp_send_json_success( $persian_date );
    }
}