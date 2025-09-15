<?php
/**
 * Persian Calendar Plugin Main Class
 * 
 * Handles the core functionality of the Persian Calendar plugin including
 * date conversion, timezone management, and WordPress integration.
 * 
 * @package PersianCalendar
 * @since 1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }

class PC_Plugin {
    /** 
     * Date converter instance for Jalali calendar operations.
     * 
     * @var PC_Date_Converter 
     */
    private $date;

    /** 
     * Plugin settings array cached from WordPress options.
     * 
     * @var array 
     */
    private $settings;

    /**
     * Constructor - Initialize the plugin with date converter.
     * 
     * @param PC_Date_Converter $date_converter Instance of date converter class.
     */
    public function __construct( PC_Date_Converter $date_converter ) {
        $this->date = $date_converter;
        $this->settings = get_option( PC_Admin::OPTIONS_KEY, array() );
    }

    /**
     * Initialize plugin functionality based on user settings.
     * 
     * Sets up WordPress hooks and filters for date conversion,
     * timezone management, and other Persian calendar features.
     */
    public function init() : void {
        // Refresh settings cache with defaults fallback
        $this->settings = get_option( PC_Admin::OPTIONS_KEY, PC_Admin::get_default_settings() );
        
        // Add security headers for XSS protection
        add_action( 'send_headers', [ $this, 'add_security_headers' ] );

        if ( $this->is_setting_enabled( 'regional_settings' ) ) {
            $this->maybe_set_tehran_timezone();
            add_filter( 'pre_option_start_of_week', [ $this, 'set_start_of_week_saturday' ] );
        }

        if ( $this->is_setting_enabled( 'enable_jalali' ) ) {
            add_filter( 'date_i18n', [ $this, 'filter_date_i18n' ], 10, 4 );
            add_filter( 'wp_date', [ $this, 'filter_wp_date' ], 10, 4 );
        }

        if ( $this->is_setting_enabled( 'enable_dashboard_font' ) ) {
            add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_dashboard_font' ] );
            add_action( 'login_enqueue_scripts', [ $this, 'enqueue_dashboard_font' ] );
        }

        // Enqueue Gutenberg calendar scripts and styles
        if ( $this->is_setting_enabled( 'enable_jalali' ) && $this->is_setting_enabled( 'enable_gutenberg_calendar' ) ) {
            add_action( 'enqueue_block_editor_assets', [ $this, 'enqueue_gutenberg_calendar_assets' ] );
            add_action( 'wp_enqueue_scripts', [ $this, 'enqueue_gutenberg_calendar_assets' ] );
        }

        // Initialize permalink handler for Jalali dates
        if ( $this->is_setting_enabled( 'permalink_jalali_date' ) ) {
            new PC_Permalink();
        }

        // Enqueue admin timewrap and inline edit scripts
        if ( $this->is_setting_enabled( 'enable_jalali' ) && is_admin() ) {
            add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_admin_timewrap_assets' ] );
        }
    }

    /**
     * Filter WordPress date_i18n function to convert dates to Jalali.
     * 
     * This filter is applied to the widely-used date_i18n function
     * throughout WordPress core and themes.
     * 
     * @param string $formatted The formatted date string.
     * @param string $format    PHP date format string.
     * @param int    $timestamp Unix timestamp.
     * @param bool   $gmt       Whether to use GMT timezone.
     * @return string Formatted Jalali date string.
     */
    public function filter_date_i18n( $formatted, $format, $timestamp, $gmt ) {
        $format = (string) $format;
        $convert_digits = $this->is_setting_enabled( 'enable_persian_digits' );

        // Per WP behavior: when $gmt is false, the provided $timestamp is "local" (offset-applied).
        // Convert to a true UTC epoch before building DateTime from '@'.
        $tz = $gmt ? new \DateTimeZone( 'UTC' ) : wp_timezone();

        if ( ! is_numeric( $timestamp ) ) {
            $ts_local = time();
        } else {
            $ts_local = (int) $timestamp;
        }

        if ( $gmt ) {
            $ts_utc = $ts_local; // already UTC
        } else {
            $probe = new \DateTime( '@' . $ts_local );
            $probe->setTimezone( $tz );
            $offset = $tz->getOffset( $probe );
            $ts_utc = max( 0, $ts_local - $offset );
        }

        return $this->date->format_jalali( $format, $ts_utc, $tz, $convert_digits );
    }

    /**
     * Filter WordPress wp_date function for Jalali conversion.
     * 
     * This filter handles the newer wp_date function introduced
     * in recent WordPress versions.
     * 
     * @param string             $formatted The formatted date string.
     * @param string             $format    PHP date format string.
     * @param int                $timestamp Unix timestamp.
     * @param DateTimeZone|null  $timezone  Timezone object.
     * @return string Formatted Jalali date string.
     */
    public function filter_wp_date( $formatted, $format, $timestamp, $timezone ) {
        $tz = $timezone instanceof DateTimeZone ? $timezone : wp_timezone();
        $ts = is_numeric( $timestamp ) ? (int) $timestamp : time();
        $convert_digits = $this->is_setting_enabled( 'enable_persian_digits' );
        return $this->date->format_jalali( (string) $format, $ts, $tz, $convert_digits );
    }

    /**
     * Set WordPress timezone to Asia/Tehran if enabled in settings.
     * 
     * Updates the WordPress timezone_string option to Tehran timezone
     * when the user has enabled this feature.
     */
    private function maybe_set_tehran_timezone() : void {
        $tz = get_option( 'timezone_string' );
        if ( 'Asia/Tehran' !== $tz ) {
            update_option( 'timezone_string', 'Asia/Tehran' );
        }
    }

    /**
     * Set WordPress start of week to Saturday.
     * 
     * Filters the start_of_week option to return Saturday (6)
     * which is the traditional start of week in Persian calendar.
     * 
     * @param mixed $value Original start of week value.
     * @return int Saturday (6) as start of week.
     */
    public function set_start_of_week_saturday( $value ) {
        return 6; // Saturday
    }

    /**
     * Enqueue Persian dashboard font CSS file.
     * 
     * Loads the dashboard font stylesheet for better Persian
     * text rendering in WordPress admin area.
     */
    public function enqueue_dashboard_font() : void {
        wp_enqueue_style(
            'persian-calendar-dashboard-font',
            PC_PLUGIN_URL . 'assets/css/dashboard-font.css',
            array(),
            PC_PLUGIN_VERSION
        );
    }

    /**
     * Enqueue Gutenberg calendar assets.
     * 
     * Loads JavaScript and CSS files required for Persian calendar
     * integration with Gutenberg block editor.
     */
    public function enqueue_gutenberg_calendar_assets() : void {
        // Enqueue main Persian calendar component (includes date converter)
        wp_enqueue_script(
            'persian-calendar-main',
            PC_PLUGIN_URL . 'assets/js/persian-calendar.js',
            array(),
            PC_PLUGIN_VERSION,
            true
        );

        // Enqueue unified Gutenberg integration script
        wp_enqueue_script(
            'persian-calendar-gutenberg',
            PC_PLUGIN_URL . 'assets/js/gutenberg.js',
            array( 'wp-data', 'wp-element', 'persian-calendar-main' ),
            PC_PLUGIN_VERSION,
            true
        );



        // Enqueue Gutenberg calendar styles
        wp_enqueue_style(
            'persian-calendar-gutenberg-styles',
            PC_PLUGIN_URL . 'assets/css/gutenberg-calendar.css',
            array(),
            PC_PLUGIN_VERSION
        );

        // Pass settings to JavaScript
        wp_localize_script(
            'persian-calendar-gutenberg',
            'PersianCalendarSettings',
            array(
                'enablePersianDigits' => $this->is_setting_enabled( 'enable_persian_digits' ),
                'ajaxUrl' => admin_url( 'admin-ajax.php' ),
                'nonce' => wp_create_nonce( 'persian_calendar_nonce' )
            )
        );
    }

    /**
     * Enqueue admin timewrap and inline edit assets.
     * 
     * Loads JavaScript files required for Persian calendar
     * integration with WordPress admin timewrap and inline edit functionality.
     */
    public function enqueue_admin_timewrap_assets() : void {
        // Only load on post edit pages and post list pages
        $screen = get_current_screen();
        if ( ! $screen || ! in_array( $screen->base, [ 'post', 'edit' ] ) ) {
            return;
        }

        // Enqueue admin timewrap script
        wp_enqueue_script(
            'persian-calendar-admin-timewrap',
            PC_PLUGIN_URL . 'assets/js/admin-timewrap.js',
            array( 'jquery' ),
            PC_PLUGIN_VERSION,
            true
        );
    }

    /**
     * Activation: set default options if not set.
     */
    public static function activate() : void {
        $defaults = PC_Admin::get_default_settings();

        $current = get_option( PC_Admin::OPTIONS_KEY, array() );
        update_option( PC_Admin::OPTIONS_KEY, wp_parse_args( $current, $defaults ) );
    }

    /**
     * Deactivation hook placeholder.
     */
    public static function deactivate() : void {
        // No action; we keep settings.
    }

    /**
     * Main plugin bootstrap function.
     * Initializes the plugin components based on settings.
     */
    public static function bootstrap() : void {
        // Get plugin options with fallback defaults
        $options = get_option( PC_Admin::OPTIONS_KEY, array() );
        
        // Check if Persian calendar functionality is enabled
        $enable_jalali = isset( $options['enable_jalali'] ) ? $options['enable_jalali'] : true;
        
        // Initialize main plugin functionality if enabled
        if ( $enable_jalali ) {
            $plugin = new self( new PC_Date_Converter() );
            $plugin->init();
            
            // Initialize EDD compatibility if enabled
            if ( ! empty( $options['enable_edd_compatibility'] ) ) {
                $edd_compatibility = new PC_EDD_Compatibility( new PC_Date_Converter(), $options );
                $edd_compatibility->init();
            }
        }

        // Initialize admin interface if in admin area
        if ( is_admin() ) {
            ( new PC_Admin( isset( $plugin ) ? $plugin : null ) )->init();
        }
    }

    /**
     * Register WordPress activation and deactivation hooks.
     * 
     * @param string $plugin_file Main plugin file path.
     */
    public static function register_hooks( $plugin_file ) : void {
        register_activation_hook( $plugin_file, [ __CLASS__, 'activate' ] );
        register_deactivation_hook( $plugin_file, [ __CLASS__, 'deactivate' ] );
    }

    /**
     * Check if a setting is enabled.
     *
     * @param string $setting Setting key to check.
     * @return bool True if setting is enabled, false otherwise.
     */
    private function is_setting_enabled( string $setting ) : bool {
        return ! empty( $this->settings[$setting] );
    }

    /**
     * Add security headers to prevent XSS attacks.
     * 
     * @since 1.0.0
     */
    public function add_security_headers() : void {
        // Only add headers if not already sent and not in admin area
        if ( headers_sent() || is_admin() ) {
            return;
        }
        
        // Content Security Policy to prevent XSS
        $csp_directives = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Allow inline scripts for WordPress compatibility
            "style-src 'self' 'unsafe-inline'", // Allow inline styles for WordPress themes
            "img-src 'self' data: https:", // Allow images from same origin, data URLs, and HTTPS
            "font-src 'self' data:", // Allow fonts from same origin and data URLs
            "connect-src 'self'", // Allow AJAX requests to same origin
            "frame-ancestors 'self'", // Prevent clickjacking
            "base-uri 'self'", // Restrict base tag URLs
            "form-action 'self'" // Restrict form submissions
        ];
        
        header( 'Content-Security-Policy: ' . implode( '; ', $csp_directives ) );
        
        // Additional security headers
        header( 'X-Content-Type-Options: nosniff' ); // Prevent MIME type sniffing
        header( 'X-Frame-Options: SAMEORIGIN' ); // Prevent clickjacking
        header( 'X-XSS-Protection: 1; mode=block' ); // Enable XSS filtering
        header( 'Referrer-Policy: strict-origin-when-cross-origin' ); // Control referrer information
    }

    /**
     * Expose current settings for admin UI.
     */
    public function get_settings() : array {
        return $this->settings;
    }
}
