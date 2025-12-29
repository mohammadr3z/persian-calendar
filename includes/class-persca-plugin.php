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

if (! defined('ABSPATH')) {
    exit;
}

class PERSCA_Plugin
{
    /** 
     * Date converter instance for Jalali calendar operations.
     * 
     * @var PERSCA_Date_Converter 
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
     * @param PERSCA_Date_Converter $date_converter Instance of date converter class.
     */
    public function __construct(PERSCA_Date_Converter $date_converter)
    {
        $this->date = $date_converter;
        $this->settings = get_option(PERSCA_Admin::OPTIONS_KEY, array());
    }

    /**
     * Initialize plugin functionality based on user settings.
     * 
     * Sets up WordPress hooks and filters for date conversion,
     * timezone management, and other Persian calendar features.
     */
    public function init(): void
    {
        // Refresh settings cache - merge saved options with defaults
        $saved_settings = get_option(PERSCA_Admin::OPTIONS_KEY, array());
        $this->settings = wp_parse_args($saved_settings, PERSCA_Admin::get_default_settings());

        // Use classic editor if enabled
        if ($this->is_setting_enabled('enable_classic_editor')) {
            $this->disable_gutenberg_editor();
        }

        // Regional settings (independent setting)
        if ($this->is_setting_enabled('regional_settings')) {
            $this->maybe_set_tehran_timezone();
            add_filter('pre_option_start_of_week', [$this, 'set_start_of_week_saturday']);
        }

        // Dashboard font (independent setting - works without Jalali)
        if ($this->is_setting_enabled('enable_dashboard_font')) {
            add_action('admin_enqueue_scripts', [$this, 'enqueue_dashboard_font']);
            add_action('login_enqueue_scripts', [$this, 'enqueue_dashboard_font']);
        }

        // Jalali calendar date conversion
        if ($this->is_setting_enabled('enable_jalali')) {
            add_filter('date_i18n', [$this, 'filter_date_i18n'], 10, 4);
            add_filter('wp_date', [$this, 'filter_wp_date'], 10, 4);

            // Human time diff (relative time: "x minutes ago")
            add_filter('human_time_diff', [$this, 'filter_human_time_diff'], 10, 4);

            // Comment dates
            add_filter('get_comment_date', [$this, 'filter_comment_date'], 10, 3);
            add_filter('get_comment_time', [$this, 'filter_comment_time'], 10, 5);

            // Post modified date/time
            add_filter('get_the_modified_date', [$this, 'filter_modified_date'], 10, 3);
            add_filter('get_the_modified_time', [$this, 'filter_modified_time'], 10, 3);
            add_filter('get_post_time', [$this, 'filter_get_post_time'], 10, 3);

            // Admin date filter dropdown (render Jalali dates server-side)
            add_action('restrict_manage_posts', [$this, 'render_jalali_months_dropdown'], 5);
            add_action('restrict_manage_media', [$this, 'render_jalali_months_dropdown'], 5);
            add_filter('months_dropdown_results', [$this, 'hide_original_months_dropdown'], 10, 2);

            // Media Grid View date filter
            add_filter('media_view_settings', [$this, 'filter_media_view_settings'], 10, 2);

            // Filter posts by Jalali month (mfa parameter)
            add_action('pre_get_posts', [$this, 'filter_posts_by_jalali_month']);

            // Media Grid View AJAX filter
            add_filter('ajax_query_attachments_args', [$this, 'filter_ajax_attachments_by_jalali_month']);

            // Gutenberg calendar (depends on Jalali being enabled)
            if ($this->is_setting_enabled('enable_gutenberg_calendar') && ! $this->is_setting_enabled('enable_classic_editor')) {
                add_action('enqueue_block_editor_assets', [$this, 'enqueue_gutenberg_calendar_assets']);
            }

            // Admin timewrap and inline edit scripts (depends on Jalali)
            if (is_admin()) {
                add_action('admin_enqueue_scripts', [$this, 'enqueue_admin_timewrap_assets']);
            }
        }
    }

    /**
     * Filter WordPress date_i18n function to convert dates to Jalali.
     * 
     * @param string $formatted The formatted date string.
     * @param string $format    PHP date format string.
     * @param int    $timestamp Unix timestamp.
     * @param bool   $gmt       Whether to use GMT timezone.
     * @return string Formatted Jalali date string.
     */
    public function filter_date_i18n($formatted, $format, $timestamp, $gmt)
    {
        if (!is_numeric($timestamp)) {
            return $this->date->format_date((string) $format, null, $this->is_setting_enabled('enable_persian_digits'));
        }

        $convert_digits = $this->is_setting_enabled('enable_persian_digits');

        // When $gmt is false, timestamp is already in local time (WP added offset)
        // We need to treat it as local time, not UTC
        if (!$gmt) {
            // Convert local timestamp to date string, then let format_date interpret it as Tehran time
            $date_string = gmdate('Y-m-d H:i:s', (int) $timestamp);
            return $this->date->format_date((string) $format, $date_string, $convert_digits);
        }

        // GMT timestamp - pass directly (format_date will convert from UTC to Tehran)
        return $this->date->format_date((string) $format, (int) $timestamp, $convert_digits);
    }

    /**
     * Filter WordPress wp_date function for Jalali conversion.
     * 
     * @param string             $formatted The formatted date string.
     * @param string             $format    PHP date format string.
     * @param int                $timestamp Unix timestamp (always UTC in wp_date).
     * @param DateTimeZone|null  $timezone  Timezone object.
     * @return string Formatted Jalali date string.
     */
    public function filter_wp_date($formatted, $format, $timestamp, $timezone)
    {
        if (!is_numeric($timestamp)) {
            return $this->date->format_date((string) $format, null, $this->is_setting_enabled('enable_persian_digits'));
        }

        $convert_digits = $this->is_setting_enabled('enable_persian_digits');
        // wp_date always passes UTC timestamp - format_date will convert to Tehran
        return $this->date->format_date((string) $format, (int) $timestamp, $convert_digits);
    }

    /**
     * Filter human_time_diff for Persian relative time strings.
     * 
     * Converts English time units to Persian equivalents for relative
     * time displays like "2 hours ago" -> "۲ ساعت پیش".
     * 
     * @param string $since The human-readable time difference.
     * @param int    $diff  The difference in seconds.
     * @param int    $from  Unix timestamp from which the difference begins.
     * @param int    $to    Unix timestamp to end the time difference.
     * @return string Persian formatted time difference.
     */
    public function filter_human_time_diff($since, $diff, $from, $to)
    {
        $convert_digits = $this->is_setting_enabled('enable_persian_digits');

        // Persian time unit translations
        $units = [
            'second' => 'ثانیه',
            'seconds' => 'ثانیه',
            'min' => 'دقیقه',
            'mins' => 'دقیقه',
            'minute' => 'دقیقه',
            'minutes' => 'دقیقه',
            'hour' => 'ساعت',
            'hours' => 'ساعت',
            'day' => 'روز',
            'days' => 'روز',
            'week' => 'هفته',
            'weeks' => 'هفته',
            'month' => 'ماه',
            'months' => 'ماه',
            'year' => 'سال',
            'years' => 'سال',
        ];

        foreach ($units as $en => $fa) {
            $since = str_ireplace($en, $fa, $since);
        }

        if ($convert_digits) {
            $since = $this->date->to_persian_digits($since);
        }

        return $since;
    }

    /**
     * Filter comment date for Jalali conversion.
     * 
     * @param string     $date    The formatted date string.
     * @param string     $format  PHP date format.
     * @param WP_Comment $comment The comment object.
     * @return string Jalali formatted date.
     */
    public function filter_comment_date($date, $format, $comment)
    {
        if (! $comment || empty($comment->comment_date)) {
            return $date;
        }
        $format = $format ?: get_option('date_format');
        $convert_digits = $this->is_setting_enabled('enable_persian_digits');
        return $this->date->format_date($format, $comment->comment_date, $convert_digits);
    }

    /**
     * Filter comment time for Jalali conversion.
     * 
     * @param string     $time      The formatted time string.
     * @param string     $format    PHP time format.
     * @param bool       $gmt       Whether to use GMT timezone.
     * @param bool       $translate Whether to translate.
     * @param WP_Comment $comment   The comment object.
     * @return string Jalali formatted time.
     */
    public function filter_comment_time($time, $format, $gmt, $translate, $comment)
    {
        if (! $comment) {
            return $time;
        }

        $convert_digits = $this->is_setting_enabled('enable_persian_digits');
        $format = $format ?: get_option('time_format');

        if ($gmt && !empty($comment->comment_date_gmt)) {
            // GMT date - convert using timestamp (format_date handles UTC to Tehran)
            $dt = new \DateTime($comment->comment_date_gmt, new \DateTimeZone('UTC'));
            return $this->date->format_date($format, $dt->getTimestamp(), $convert_digits);
        }

        // Local date - pass as string (format_date interprets as Tehran time)
        return $this->date->format_date($format, $comment->comment_date, $convert_digits);
    }

    /**
     * Filter modified date for Jalali conversion.
     * 
     * @param string  $date   The formatted date string.
     * @param string  $format PHP date format.
     * @param WP_Post $post   The post object.
     * @return string Jalali formatted date.
     */
    public function filter_modified_date($date, $format, $post)
    {
        if (! $post || empty($post->post_modified)) {
            return $date;
        }
        $format = $format ?: get_option('date_format');
        $convert_digits = $this->is_setting_enabled('enable_persian_digits');
        return $this->date->format_date($format, $post->post_modified, $convert_digits);
    }

    /**
     * Filter modified time for Jalali conversion.
     * 
     * @param string  $time   The formatted time string.
     * @param string  $format PHP time format.
     * @param WP_Post $post   The post object.
     * @return string Jalali formatted time.
     */
    public function filter_modified_time($time, $format, $post)
    {
        if (! $post || empty($post->post_modified)) {
            return $time;
        }
        $format = $format ?: get_option('time_format');
        $convert_digits = $this->is_setting_enabled('enable_persian_digits');
        return $this->date->format_date($format, $post->post_modified, $convert_digits);
    }

    /**
     * Filter post time for Jalali conversion.
     * 
     * @param string $time   The formatted time string.
     * @param string $format PHP time format.
     * @param bool   $gmt    Whether to use GMT timezone.
     * @return string Jalali formatted time.
     */
    public function filter_get_post_time($time, $format, $gmt)
    {
        // Don't convert timestamp formats - WordPress needs numeric values
        // 'U' = Unix timestamp, 'G' = 24-hour without leading zeros
        if (in_array($format, ['U', 'G', ''], true)) {
            return $time;
        }

        $post = get_post();
        if (! $post) {
            return $time;
        }

        $convert_digits = $this->is_setting_enabled('enable_persian_digits');

        if ($gmt && !empty($post->post_date_gmt)) {
            // GMT date - convert using timestamp (format_date handles UTC to Tehran)
            $dt = new \DateTime($post->post_date_gmt, new \DateTimeZone('UTC'));
            return $this->date->format_date($format, $dt->getTimestamp(), $convert_digits);
        }

        // Local date - pass as string (format_date interprets as Tehran time)
        return $this->date->format_date($format, $post->post_date, $convert_digits);
    }

    /**
     * Get unique Jalali months with posts for a post type.
     *
     * Queries all post dates and converts them to Jalali, then returns
     * unique Jalali months for proper Persian calendar filtering.
     *
     * @param string $post_type Post type.
     * @return array List of months with 'year', 'month', 'text', 'value'.
     */
    private function get_jalali_months($post_type)
    {
        global $wpdb;

        // Check cache first
        $cache_key = 'persca_jalali_months_' . $post_type;
        $cached = wp_cache_get($cache_key, 'persca');
        if ($cached !== false) {
            return $cached;
        }

        // Query all unique post dates
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery -- Custom query required for date aggregation.
        $posts = $wpdb->get_results($wpdb->prepare("
            SELECT DISTINCT DATE(post_date) AS post_date
            FROM $wpdb->posts
            WHERE post_type = %s
            AND post_status != 'auto-draft'
            ORDER BY post_date DESC
        ", $post_type));

        if (empty($posts)) {
            wp_cache_set($cache_key, array(), 'persca', HOUR_IN_SECONDS);
            return array();
        }

        $jalali_months = [];
        $convert_digits = $this->is_setting_enabled('enable_persian_digits');

        foreach ($posts as $post_data) {
            $date_parts = explode('-', $post_data->post_date);
            $jalali = $this->date->gregorian_to_jalali(
                (int) $date_parts[0],
                (int) $date_parts[1],
                (int) $date_parts[2]
            );
            $jy = $jalali['y'];
            $jm = $jalali['m'];
            $key = sprintf('%04d%02d', $jy, $jm);

            if (!isset($jalali_months[$key])) {
                $month_name = $this->date->get_persian_month_name($jm);
                $year_display = $convert_digits
                    ? $this->date->to_persian_digits((string) $jy)
                    : (string) $jy;

                $jalali_months[$key] = [
                    'year'  => $jy,
                    'month' => $jm,
                    'text'  => $month_name . ' ' . $year_display,
                    'value' => $key,
                ];
            }
        }

        // Sort by value descending (newest first)
        krsort($jalali_months);
        $result = array_values($jalali_months);

        // Cache the result for 1 hour
        wp_cache_set($cache_key, $result, 'persca', HOUR_IN_SECONDS);

        return $result;
    }

    /**
     * Render Jalali months dropdown (server-side).
     * 
     * Renders custom months dropdown with Jalali dates directly in PHP,
     * so dates appear correctly immediately without JavaScript conversion.
     * 
     * @since 1.2.3
     * 
     * @param string $post_type Current post type being filtered.
     */
    public function render_jalali_months_dropdown($post_type = '')
    {
        // Get current post type
        if (empty($post_type)) {
            if (current_action() === 'restrict_manage_media') {
                $post_type = 'attachment';
            } else {
                // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only filter, no state change.
                $post_type = isset($_GET['post_type']) ? sanitize_key($_GET['post_type']) : 'post';
            }
        }

        $months = $this->get_jalali_months($post_type);

        if (empty($months)) {
            return;
        }

        // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only filter, no state change.
        $selected_mfa = isset($_GET['mfa']) ? (int) $_GET['mfa'] : 0;

        // Hidden field to disable WordPress default month filter
        echo '<input type="hidden" name="m" value="0" />';
        echo '<select name="mfa" id="filter-by-date-jalali">';
        echo '<option value="0">' . esc_html__('All dates', 'persian-calendar') . '</option>';

        foreach ($months as $month) {
            echo '<option value="' . esc_attr($month['value']) . '"' . selected($selected_mfa, (int) $month['value'], false) . '>' . esc_html($month['text']) . '</option>';
        }

        echo '</select>';
    }

    /**
     * Filter Media View settings to inject Jalali months.
     *
     * The Media Grid uses JavaScript to filter by month. We pass Jalali
     * months with the Jalali year/month as the value which will be
     * converted to Gregorian date range in the AJAX handler.
     *
     * @param array $settings Media view settings.
     * @param mixed $post     Current post object or ID.
     * @return array Modified settings.
     */
    public function filter_media_view_settings($settings, $post)
    {
        // Only run if months are being generated or expected
        if (! isset($settings['months'])) {
            return $settings;
        }

        $jalali_months = $this->get_jalali_months('attachment');

        if (! empty($jalali_months)) {
            // Convert to Media View format with Jalali year/month
            // The JavaScript sends these as 'year' and 'month' which we
            // intercept in filter_ajax_attachments_by_jalali_month
            $media_months = [];
            foreach ($jalali_months as $month) {
                $media_months[] = [
                    'year'  => $month['year'],   // Jalali year
                    'month' => $month['month'],  // Jalali month
                    'text'  => $month['text'],
                ];
            }
            $settings['months'] = $media_months;
        }

        return $settings;
    }

    /**
     * Filter AJAX attachments query by Jalali month.
     *
     * Converts Jalali year/month from Media Grid to Gregorian date range.
     * WordPress Media Grid sends 'year' and 'monthnum' which we convert.
     *
     * @since 1.2.4
     *
     * @param array $query Query arguments for attachment query.
     * @return array Modified query arguments with date_query.
     */
    public function filter_ajax_attachments_by_jalali_month($query)
    {
        // Check if year or month is set
        if (empty($query['year']) && empty($query['monthnum'])) {
            return $query;
        }

        $jy = isset($query['year']) ? (int) $query['year'] : 0;
        $jm = isset($query['monthnum']) ? (int) $query['monthnum'] : 0;

        // If year is greater than 1900, it's likely Gregorian (no conversion needed)
        // This handles edge cases where default WordPress filters might be used
        if ($jy > 1900) {
            return $query;
        }

        // Validate Jalali date
        if ($jy < 1300 || $jy > 1500 || $jm < 1 || $jm > 12) {
            return $query;
        }

        // Get first and last day of Jalali month in Gregorian
        $first_day = $this->date->jalali_to_gregorian($jy, $jm, 1);
        $days_in_month = $this->get_jalali_month_days($jy, $jm);
        $last_day = $this->date->jalali_to_gregorian($jy, $jm, $days_in_month);

        // Remove year/monthnum to prevent WordPress from filtering by them
        unset($query['year'], $query['monthnum']);

        // Add date_query for the Jalali month range
        $query['date_query'] = [
            [
                'after'     => sprintf('%04d-%02d-%02d', $first_day['y'], $first_day['m'], $first_day['d']),
                'before'    => sprintf('%04d-%02d-%02d', $last_day['y'], $last_day['m'], $last_day['d']),
                'inclusive' => true,
            ],
        ];

        return $query;
    }

    /**
     * Filter posts query by Jalali month using mfa parameter.
     *
     * Converts Jalali month to Gregorian date range and applies
     * a date_query filter to show only posts from that Jalali month.
     *
     * @since 1.2.4
     *
     * @param WP_Query $query The main WordPress query.
     */
    public function filter_posts_by_jalali_month($query)
    {
        if (!is_admin() || !$query->is_main_query()) {
            return;
        }

        // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only filter, no state change.
        $mfa = isset($_GET['mfa']) ? (int) $_GET['mfa'] : 0;
        if ($mfa === 0) {
            return;
        }

        // Parse Jalali year and month from mfa (format: YYYYMM)
        $mfa_str = (string) $mfa;
        $jy = (int) substr($mfa_str, 0, 4);
        $jm = (int) substr($mfa_str, 4, 2);

        // Validate Jalali date range
        if ($jy < 1300 || $jy > 1500 || $jm < 1 || $jm > 12) {
            return;
        }

        // Get first and last day of Jalali month in Gregorian
        $first_day = $this->date->jalali_to_gregorian($jy, $jm, 1);

        // Get number of days in this Jalali month
        $days_in_month = $this->get_jalali_month_days($jy, $jm);
        $last_day = $this->date->jalali_to_gregorian($jy, $jm, $days_in_month);

        $start_date = sprintf('%04d-%02d-%02d 00:00:00', $first_day['y'], $first_day['m'], $first_day['d']);
        $end_date = sprintf('%04d-%02d-%02d 23:59:59', $last_day['y'], $last_day['m'], $last_day['d']);

        $query->set('date_query', [
            [
                'after'     => $start_date,
                'before'    => $end_date,
                'inclusive' => true,
            ],
        ]);

        // Remove default 'm' parameter to avoid conflicts
        $query->set('m', 0);
    }

    /**
     * Get number of days in a Jalali month.
     *
     * @since 1.2.4
     *
     * @param int $jy Jalali year.
     * @param int $jm Jalali month (1-12).
     * @return int Number of days in the month (29-31).
     */
    private function get_jalali_month_days($jy, $jm)
    {
        // Months 1-6 have 31 days
        if ($jm <= 6) {
            return 31;
        }

        // Months 7-11 have 30 days
        if ($jm <= 11) {
            return 30;
        }

        // Month 12 (Esfand) - 29 days normally, 30 in leap years
        // Jalali leap year: remainder of (year / 33) is in [1, 5, 9, 13, 17, 22, 26, 30]
        $leap_remainders = [1, 5, 9, 13, 17, 22, 26, 30];
        return in_array($jy % 33, $leap_remainders) ? 30 : 29;
    }

    /**
     * Hide original WordPress months dropdown.
     * 
     * Returns empty array to prevent WordPress from rendering
     * its own months dropdown (we render our own Jalali version).
     * 
     * @since 1.2.3
     * 
     * @param object[] $months    Array of month objects.
     * @param string   $post_type Current post type.
     * @return array Empty array to hide dropdown.
     */
    public function hide_original_months_dropdown($months, $post_type)
    {
        return array(); // Return empty to prevent WordPress from rendering dropdown
    }

    /**
     * Set WordPress timezone to Asia/Tehran if enabled in settings.
     * 
     * Updates the WordPress timezone_string option to Tehran timezone
     * when the user has enabled this feature.
     */
    private function maybe_set_tehran_timezone(): void
    {
        $tz = get_option('timezone_string');
        if ('Asia/Tehran' !== $tz) {
            update_option('timezone_string', 'Asia/Tehran');
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
    public function set_start_of_week_saturday($value)
    {
        return 6; // Saturday
    }

    /**
     * Enqueue Persian dashboard font CSS file.
     * 
     * Loads the dashboard font stylesheet for better Persian
     * text rendering in WordPress admin area.
     */
    public function enqueue_dashboard_font(): void
    {
        wp_enqueue_style(
            'persian-calendar-dashboard-font',
            PERSCA_PLUGIN_URL . 'assets/css/dashboard-font.css',
            array(),
            PERSCA_PLUGIN_VERSION
        );
    }

    /**
     * Enqueue Gutenberg calendar assets.
     * 
     * Loads JavaScript and CSS files required for Persian calendar
     * integration with Gutenberg block editor.
     */
    public function enqueue_gutenberg_calendar_assets(): void
    {
        // Enqueue main Persian calendar component (includes date converter)
        wp_enqueue_script(
            'persian-calendar-main',
            PERSCA_PLUGIN_URL . 'assets/js/persian-calendar.js',
            array(),
            PERSCA_PLUGIN_VERSION,
            true
        );

        // Enqueue unified Gutenberg integration script
        wp_enqueue_script(
            'persian-calendar-gutenberg',
            PERSCA_PLUGIN_URL . 'assets/js/gutenberg.js',
            array('wp-data', 'wp-element', 'persian-calendar-main'),
            PERSCA_PLUGIN_VERSION,
            true
        );

        // Enqueue Gutenberg calendar styles
        wp_enqueue_style(
            'persian-calendar-gutenberg-styles',
            PERSCA_PLUGIN_URL . 'assets/css/gutenberg-calendar.css',
            array(),
            PERSCA_PLUGIN_VERSION
        );
    }

    /**
     * Enqueue admin timewrap and inline edit assets.
     * 
     * Loads JavaScript files required for Persian calendar
     * integration with WordPress admin timewrap and inline edit functionality.
     */
    public function enqueue_admin_timewrap_assets(): void
    {
        // Only load on post list pages for inline-edit functionality
        $screen = get_current_screen();
        if (! $screen || ! in_array($screen->base, ['post', 'edit', 'comment'])) {
            return;
        }

        // Don't load on post edit screen if Gutenberg is enabled
        if ($screen->base === 'post' && $screen->is_block_editor()) {
            return;
        }

        // Enqueue admin timewrap script
        wp_enqueue_script(
            'persian-calendar-admin-timewrap',
            PERSCA_PLUGIN_URL . 'assets/js/admin-timewrap.js',
            array('jquery'),
            PERSCA_PLUGIN_VERSION,
            true
        );
    }

    /**
     * Activation: set default options if not set.
     */
    public static function activate(): void
    {
        $defaults = PERSCA_Admin::get_default_settings();

        $current = get_option(PERSCA_Admin::OPTIONS_KEY, array());
        update_option(PERSCA_Admin::OPTIONS_KEY, wp_parse_args($current, $defaults));
    }

    /**
     * Deactivation hook placeholder.
     */
    public static function deactivate(): void
    {
        // No action; we keep settings.
    }

    /**
     * Main plugin bootstrap function.
     * Initializes the plugin components based on settings.
     */
    public static function bootstrap(): void
    {
        // Always initialize main plugin functionality
        // Each setting is checked independently in init() method
        $plugin = new self(new PERSCA_Date_Converter());
        $plugin->init();

        // Initialize admin interface if in admin area
        if (is_admin()) {
            (new PERSCA_Admin($plugin))->init();
        }
    }

    /**
     * Register WordPress activation and deactivation hooks.
     * 
     * @param string $plugin_file Main plugin file path.
     */
    public static function register_hooks($plugin_file): void
    {
        register_activation_hook($plugin_file, [__CLASS__, 'activate']);
        register_deactivation_hook($plugin_file, [__CLASS__, 'deactivate']);
    }

    /**
     * Check if a setting is enabled.
     *
     * @param string $setting Setting key to check.
     * @return bool True if setting is enabled, false otherwise.
     */
    private function is_setting_enabled(string $setting): bool
    {
        return ! empty($this->settings[$setting]);
    }

    /**
     * Expose current settings for admin UI.
     */
    public function get_settings(): array
    {
        return $this->settings;
    }

    /**
     * Disable Gutenberg editor for posts.
     * 
     * This method disables the Gutenberg editor and enables
     * the classic editor for posts.
     */
    private function disable_gutenberg_editor(): void
    {
        // Disable Gutenberg for posts
        add_filter('use_block_editor_for_post', '__return_false');
    }
}
