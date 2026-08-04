<?php

/**
 * Easy Digital Downloads (EDD) Integration for Persian Calendar.
 *
 * @package PersianCalendar
 * @since 1.3.5
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Whether Easy Digital Downloads is active.
 *
 * @return bool
 */
function persca_edd_is_active(): bool
{
    return class_exists('Easy_Digital_Downloads') || function_exists('EDD') || defined('EDD_VERSION');
}

/**
 * Whether the current request belongs to an EDD admin context.
 *
 * @return bool
 */
function persca_edd_is_context(): bool
{
    if (!is_admin()) {
        return false;
    }

    if (wp_doing_ajax()) {
        $ajax_action = isset($_REQUEST['action'])
            ? sanitize_key(wp_unslash($_REQUEST['action']))
            : '';

        return 'edd_do_ajax_export' === $ajax_action;
    }

    // Native helper when EDD is loaded on a normal admin page.
    if (function_exists('edd_is_admin_page') && edd_is_admin_page()) {
        return true;
    }

    // Covers edd_action driven admin requests (non-AJAX; AJAX is handled above).
    if (isset($_REQUEST['edd_action']) || isset($_REQUEST['edd-action'])) {
        return true;
    }

    if (isset($_REQUEST['post_type']) && 'download' === sanitize_key(wp_unslash($_REQUEST['post_type']))) {
        return true;
    }

    foreach (array('page', 'action') as $key) {
        if (isset($_REQUEST[$key])) {
            $val = sanitize_text_field(wp_unslash($_REQUEST[$key]));
            if (false !== strpos($val, 'edd')) {
                return true;
            }
        }
    }

    return false;
}

/* =============================================================================
 * ASSETS
 * ========================================================================== */

add_action('admin_enqueue_scripts', 'persca_edd_enqueue_assets', 20);

/**
 * Enqueue assets on EDD admin screens.
 */
function persca_edd_enqueue_assets(): void
{
    if (!persca_is_jalali_enabled() || !persca_edd_is_active() || !persca_edd_is_context()) {
        return;
    }

    // Shared Jalali core script + popup styles.
    persca_enqueue_core_assets();

    $fouc_css = '.edd-date-range-selected-date,.edd-date-range-selected-relative-date{visibility:hidden;animation:perscaEddReveal 0s linear 2s forwards;}'
        . '@keyframes perscaEddReveal{to{visibility:visible;}}'
        . '.persca-dates-ready .edd-date-range-selected-date,.persca-dates-ready .edd-date-range-selected-relative-date{visibility:visible;animation:none;}';
    wp_add_inline_style('persca-integrate-jet-styles', $fouc_css);

    // EDD integration overrides.
    wp_enqueue_script(
        'persca-integrate-edd',
        PERSCA_PLUGIN_URL . 'assets/js/integrate-edd.js',
        array('jquery', 'persian-calendar-main', 'jquery-ui-datepicker'),
        PERSCA_PLUGIN_VERSION,
        true
    );

    $opts           = get_option(PERSCA_Admin::OPTIONS_KEY, array());
    $persian_digits = is_array($opts) && !empty($opts['enable_persian_digits']);

    $picker_format = 'mm/dd/yy';
    if (function_exists('edd_get_date_picker_format')) {
        $picker_format = edd_get_date_picker_format();
    }

    $forced_range = isset($GLOBALS['persca_edd_forced_range']) ? (string) $GLOBALS['persca_edd_forced_range'] : '';

    wp_localize_script('persca-integrate-edd', 'perscaEdd', array(
        'persianDigits' => $persian_digits ? '1' : '',
        'pickerFormat'  => $picker_format,
        'isEddPage'     => (function_exists('edd_is_admin_page') && edd_is_admin_page()) ? '1' : '',
        // Tells browser which preset to display when rewritten to Jalali.
        'forcedRange'   => $forced_range,
    ));
}

// Make sure our datepicker override is parsed before EDD initializes its pickers.
add_action('admin_enqueue_scripts', 'persca_edd_add_dependencies', 100);

/**
 * Inject integration script as dependency of EDD's admin scripts.
 */
function persca_edd_add_dependencies(): void
{
    if (!persca_is_jalali_enabled() || !persca_edd_is_active() || !persca_edd_is_context()) {
        return;
    }

    // EDD 3.x splits admin JS across several handles; cover the known ones.
    persca_inject_dependency(array(
        'edd-admin',
        'edd-admin-scripts',
        'edd-admin-datepicker',
        'edd-admin-datepickers',
        'edd-admin-orders',
        'edd-admin-discounts',
        'edd-admin-customers',
        'edd-admin-reports',
        'edd-admin-tools-export',
        'edd-admin-tools',
    ), 'persca-integrate-edd');
}

/* =============================================================================
 * REQUEST NORMALIZATION (Jalali -> Gregorian)
 * ========================================================================== */

add_action('init', 'persca_edd_normalize_request', 0);
add_action('admin_init', 'persca_edd_normalize_request', 0);

/**
 * Walk the request superglobals and convert Jalali dates to Gregorian.
 */
function persca_edd_normalize_request(): void
{
    if (
        ! persca_is_jalali_enabled()
        || ! persca_edd_is_active()
        || ! persca_edd_is_context()
    ) {
        return;
    }

    $date_paths = persca_edd_date_request_paths();

    foreach (array('_GET', '_POST', '_REQUEST') as $global_key) {
        if (
            empty($GLOBALS[$global_key])
            || ! is_array($GLOBALS[$global_key])
        ) {
            continue;
        }

        $GLOBALS[$global_key] = persca_edd_convert_request_array(
            $GLOBALS[$global_key],
            $date_paths
        );
    }
}

/**
 * Convert only known EDD date fields.
 *
 * @param array         $data       Request data.
 * @param string[]|null $date_paths Allowed paths in dot notation.
 * @param string        $parent     Current parent path.
 * @param int           $depth      Recursion depth.
 * @return array
 */
function persca_edd_convert_request_array(
    array $data,
    ?array $date_paths = null,
    string $parent = '',
    int $depth = 0
): array {
    if (null === $date_paths) {
        $date_paths = persca_edd_date_request_paths();
    }

    if ($depth > 5) {
        return $data;
    }

    foreach ($data as $key => $value) {
        $key  = (string) $key;
        $path = '' === $parent
            ? $key
            : $parent . '.' . $key;

        if (is_array($value)) {
            $data[$key] = persca_edd_convert_request_array(
                $value,
                $date_paths,
                $path,
                $depth + 1
            );

            continue;
        }

        if (
            ! is_string($value)
            || ! persca_edd_is_date_path($path, $date_paths)
        ) {
            continue;
        }

        $data[$key] = persca_edd_convert_jalali_string($value);
    }

    return $data;
}

/**
 * Check if a request path matches known EDD date paths.
 *
 * @param string   $path       Path in dot notation.
 * @param string[] $date_paths Allowed paths in dot notation.
 * @return bool
 */
function persca_edd_is_date_path(string $path, array $date_paths): bool
{
    if (in_array($path, $date_paths, true)) {
        return true;
    }

    foreach ($date_paths as $allowed) {
        if ('' === $allowed) {
            continue;
        }

        if (
            $path === $allowed
            || (strlen($path) > strlen($allowed) && substr($path, - (strlen($allowed) + 1)) === '.' . $allowed)
        ) {
            return true;
        }
    }

    return false;
}

/**
 * Exact EDD request paths containing editable dates.
 *
 * Verified against Easy Digital Downloads 3.6.9.1.
 *
 * @return string[]
 */
function persca_edd_date_request_paths(): array
{
    $paths = array(
        // Reports and export tools.
        'filter_from',
        'filter_to',
        'from',
        'to',
        'range.from',
        'range.to',
        'export.range.from',
        'export.range.to',
        'export.range.start_date',
        'export.range.end_date',
        'export.start_date',
        'export.end_date',
        'export.start-date',
        'export.end-date',

        // Orders and logs list filters.
        'start-date',
        'end-date',

        // Order create/edit screen.
        'edd-payment-date',
        'payment_date',

        // Customer edit screen.
        'customerinfo.date_created',
        'date_created',

        // Discount editor.
        'start_date',
        'end_date',
        'discount.start_date',
        'discount.end_date',
        'discount.start',
        'discount.end',
    );

    /**
     * Filters EDD request paths containing Jalali dates.
     *
     * Nested fields use dot notation:
     * customerinfo.date_created
     *
     * @param string[] $paths Date request paths.
     */
    $paths = (array) apply_filters(
        'persca_edd_date_request_paths',
        $paths
    );

    return array_values(
        array_unique(
            array_filter(
                array_map('strval', $paths)
            )
        )
    );
}

/**
 * Convert a single Jalali date string to Gregorian ISO (YYYY-MM-DD).
 *
 * @param string $value Raw request value.
 * @return string
 */
function persca_edd_convert_jalali_string(string $value): string
{
    return persca_get_converter()->convert_jalali_string($value);
}

/**
 * Convert Persian/Arabic-Indic digits to ASCII digits.
 *
 * @param string $str Input string.
 * @return string
 */
function persca_edd_to_ascii_digits(string $str): string
{
    return persca_get_converter()->to_ascii_digits($str);
}

/* =============================================================================
 * JALALI PRESET DATE RANGES
 * ========================================================================== */

add_filter('edd_get_dates_filter', 'persca_edd_jalali_dates_filter', 20);

/**
 * Replace start/end of a calendar-based preset range with its Jalali equivalent.
 *
 * @param array $dates {
 *     @type string|\EDD\Utils\Date $start UTC start (string or Date object).
 *     @type string|\EDD\Utils\Date $end   UTC end (string or Date object).
 *     @type string                 $range Range key (this_month, this_year, ...).
 * }
 * @return array
 */
function persca_edd_jalali_dates_filter($dates)
{
    if (!persca_is_jalali_enabled() || !is_array($dates) || empty($dates['range']) || !persca_edd_is_active()) {
        return $dates;
    }

    if (!function_exists('edd_get_utc_equivalent_date') || !function_exists('EDD')) {
        return $dates;
    }

    $bounds = persca_edd_jalali_range_bounds($dates['range']);
    if (null === $bounds) {
        return $dates;
    }

    $as_string = isset($dates['start']) && is_string($dates['start']);

    $start = EDD()->utils->date($bounds['start'] . ' 00:00:00', null, true)->startOfDay();
    $end   = EDD()->utils->date($bounds['end'] . ' 23:59:59', null, true)->endOfDay();

    $start_utc = edd_get_utc_equivalent_date($start);
    $end_utc   = edd_get_utc_equivalent_date($end);

    $dates['start'] = $as_string ? $start_utc->toDateTimeString() : $start_utc;
    $dates['end']   = $as_string ? $end_utc->toDateTimeString() : $end_utc;

    return $dates;
}

/**
 * Calendar-based report presets that must be recomputed on the Jalali calendar.
 *
 * @return string[]
 */
function persca_edd_calendar_presets(): array
{
    return array(
        'this_month',
        'last_month',
        'this_quarter',
        'last_quarter',
        'this_year',
        'last_year',
        'this_week',
        'last_week',
    );
}

/**
 * Compute Gregorian Y-m-d boundaries for a Jalali calendar preset range.
 *
 * @param string $range Range key.
 * @return array|null ['start' => 'Y-m-d', 'end' => 'Y-m-d'] or null.
 */
function persca_edd_jalali_range_bounds(string $range)
{
    if (!in_array($range, persca_edd_calendar_presets(), true)) {
        return null;
    }

    $conv = persca_get_converter();
    $tz   = PERSCA_Date_Converter::get_tehran_tz();
    $now  = new DateTime('now', $tz);

    $gy = (int) $now->format('Y');
    $gm = (int) $now->format('n');
    $gd = (int) $now->format('j');

    $j  = $conv->gregorian_to_jalali($gy, $gm, $gd);
    $jy = (int) $j['y'];
    $jm = (int) $j['m'];

    $to_greg = function ($y, $m, $d) use ($conv) {
        $g = $conv->jalali_to_gregorian((int) $y, (int) $m, (int) $d);
        return sprintf('%04d-%02d-%02d', $g['y'], $g['m'], $g['d']);
    };

    $today = sprintf('%04d-%02d-%02d', $gy, $gm, $gd);

    switch ($range) {
        case 'this_month':
            return array('start' => $to_greg($jy, $jm, 1), 'end' => $today);

        case 'last_month':
            $pm = $jm - 1;
            $py = $jy;
            if ($pm < 1) {
                $pm = 12;
                $py--;
            }
            return array('start' => $to_greg($py, $pm, 1), 'end' => $to_greg($py, $pm, $conv->days_in_jalali_month($py, $pm)));

        case 'this_quarter':
            $qs = ((int) floor(($jm - 1) / 3)) * 3 + 1;
            return array('start' => $to_greg($jy, $qs, 1), 'end' => $today);

        case 'last_quarter':
            $qs  = ((int) floor(($jm - 1) / 3)) * 3 + 1;
            $lqs = $qs - 3;
            $ly  = $jy;
            if ($lqs < 1) {
                $lqs += 12;
                $ly--;
            }
            $lqe = $lqs + 2;
            return array('start' => $to_greg($ly, $lqs, 1), 'end' => $to_greg($ly, $lqe, $conv->days_in_jalali_month($ly, $lqe)));

        case 'this_year':
            return array('start' => $to_greg($jy, 1, 1), 'end' => $today);

        case 'last_year':
            return array('start' => $to_greg($jy - 1, 1, 1), 'end' => $to_greg($jy - 1, 12, $conv->days_in_jalali_month($jy - 1, 12)));

        case 'this_week':
            $dow   = ((int) $now->format('w') + 1) % 7; // Saturday = 0
            $start = clone $now;
            $start->modify('-' . $dow . ' days');
            return array('start' => $start->format('Y-m-d'), 'end' => $today);

        case 'last_week':
            $dow   = ((int) $now->format('w') + 1) % 7;
            $start = clone $now;
            $start->modify('-' . ($dow + 7) . ' days');
            $end = clone $start;
            $end->modify('+6 days');
            return array('start' => $start->format('Y-m-d'), 'end' => $end->format('Y-m-d'));
    }

    return null;
}

/**
 * Rewrite report date-range request for Jalali calendar presets.
 */
add_action('admin_init', 'persca_edd_rewrite_reports_range', 1);

function persca_edd_rewrite_reports_range()
{
    if (!is_admin() || !persca_edd_is_active() || !class_exists('PERSCA_Date_Converter')) {
        return;
    }

    $calendar_presets = persca_edd_calendar_presets();

    $range = isset($_GET['range']) ? sanitize_text_field(wp_unslash($_GET['range'])) : '';

    // Case 1: an explicit calendar preset is selected.
    if ('' !== $range) {
        if (!in_array($range, $calendar_presets, true)) {
            return; // today / yesterday / last_30_days / other: leave untouched.
        }
        persca_edd_apply_range_override($range);
        return;
    }

    // Case 2: apply default "Month to Date" as a Jalali custom range.
    $page = isset($_GET['page']) ? sanitize_text_field(wp_unslash($_GET['page'])) : '';
    if ('edd-reports' === $page) {
        persca_edd_apply_range_override('this_month');
    }
}

/**
 * Overwrite the request range/from/to with a Jalali custom range.
 *
 * @param string $preset Calendar preset key.
 * @return void
 */
function persca_edd_apply_range_override(string $preset)
{
    $bounds = persca_edd_jalali_range_bounds($preset);
    if (null === $bounds) {
        return;
    }

    // Remember original preset for browser dropdown.
    $GLOBALS['persca_edd_forced_range'] = $preset;

    $_GET['range']           = 'other';
    $_GET['filter_from']     = $bounds['start'];
    $_GET['filter_to']       = $bounds['end'];
    $_REQUEST['range']       = 'other';
    $_REQUEST['filter_from'] = $bounds['start'];
    $_REQUEST['filter_to']   = $bounds['end'];
}

/* =============================================================================
 * CURRENCY DECIMALS
 * ========================================================================== */

add_filter('edd_format_amount_decimals', '__return_zero', 999);
add_filter('edd_sanitize_amount_decimals', '__return_zero', 999);

add_action('admin_enqueue_scripts', 'persca_edd_set_admin_currency_decimals', 100);

/**
 * Set EDD admin script currency decimals to zero.
 */
function persca_edd_set_admin_currency_decimals(): void
{
    if (function_exists('wp_add_inline_script')) {
        wp_add_inline_script(
            'edd-admin-scripts',
            'if ( typeof edd_vars !== "undefined" ) { edd_vars.currency_decimals = 0; }',
            'after'
        );
    }
}

/* =============================================================================
 * DASHBOARD "SALES SUMMARY" WIDGET (Jalali)
 * ========================================================================== */

/**
 * Build the Sales Summary widget data using Jalali month boundaries.
 *
 * @return array
 */
function persca_edd_dashboard_widget_data(array $ranges = array('this_month', 'last_month', 'today', 'total')): array
{
    $data = array();

    foreach ($ranges as $range) {
        $args = array(
            'output'       => 'formatted',
            'revenue_type' => 'net',
        );

        if ('total' !== $range) {
            $bounds = persca_edd_jalali_range_bounds($range);

            if (null !== $bounds && function_exists('edd_get_utc_equivalent_date') && function_exists('EDD')) {
                $start = EDD()->utils->date($bounds['start'] . ' 00:00:00', null, true)->startOfDay();
                $end   = EDD()->utils->date($bounds['end'] . ' 23:59:59', null, true)->endOfDay();

                $args['start'] = edd_get_utc_equivalent_date($start)->toDateTimeString();
                $args['end']   = edd_get_utc_equivalent_date($end)->toDateTimeString();
            } else {
                // "today" is calendar agnostic; fall back to the native range.
                $args['range'] = $range;
            }
        }

        $stats = new EDD\Stats($args);

        $data[$range] = array(
            'earnings' => $stats->get_order_earnings(),
            'count'    => $stats->get_order_count(),
        );
    }

    return $data;
}

/*
 * Take-over wiring with no ordering requirement.
 */

/*
 * Our renderer sits at priority 1 on EDD's own AJAX action.
 */
add_action('wp_ajax_edd_load_dashboard_widget', 'persca_edd_render_dashboard_widget', 1);

/*
 * Our heartbeat handler runs after EDD's, overwriting the four month based keys.
 */
add_filter('heartbeat_received', 'persca_edd_heartbeat_received', 99, 2);

/*
 * Drop EDD's heartbeat callback to avoid computing unused Gregorian stats.
 *
 * @param mixed $response Heartbeat response (unused, returned as is).
 * @param mixed $data     Heartbeat request data (unused).
 * @return mixed
 */
function persca_edd_unhook_native_heartbeat($response = null, $data = null)
{
    global $wp_filter;

    if (empty($wp_filter['heartbeat_received']) || !($wp_filter['heartbeat_received'] instanceof WP_Hook)) {
        return $response;
    }

    foreach ($wp_filter['heartbeat_received']->callbacks as $priority => $callbacks) {
        foreach ((array) $callbacks as $callback) {
            $fn = isset($callback['function']) ? $callback['function'] : null;

            if (!is_array($fn) || 2 !== count($fn)) {
                continue;
            }

            if ('heartbeat_received' !== (string) $fn[1]) {
                continue;
            }

            $class = is_object($fn[0]) ? get_class($fn[0]) : (string) $fn[0];

            // Matches EDD_Heartbeat and namespaced variants such as EDD\Admin\Heartbeat.
            if (0 !== stripos($class, 'EDD') || false === stripos($class, 'heartbeat')) {
                continue;
            }

            remove_filter('heartbeat_received', $fn, $priority);
        }
    }

    return $response;
}
add_action('admin_init', 'persca_edd_unhook_native_heartbeat', 999);
add_filter('heartbeat_received', 'persca_edd_unhook_native_heartbeat', 1, 2);

/**
 * Jalali-aware heartbeat payload for the dashboard summary widget.
 *
 * @param array $response Heartbeat response.
 * @param array $data     Heartbeat request data.
 * @return array
 */
function persca_edd_heartbeat_received($response, $data)
{
    if (!current_user_can(apply_filters('edd_dashboard_stats_cap', 'view_shop_reports'))) {
        return $response;
    }

    if (isset($data['edd_heartbeat']) && 'dashboard_summary' === $data['edd_heartbeat']) {
        $stats = persca_edd_dashboard_widget_data();

        $response['edd-total-payments'] = $stats['total']['count'];
        $response['edd-total-earnings'] = html_entity_decode($stats['total']['earnings'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $response['edd-payments-month'] = $stats['this_month']['count'];
        $response['edd-earnings-month'] = html_entity_decode($stats['this_month']['earnings'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $response['edd-payments-today'] = $stats['today']['count'];
        $response['edd-earnings-today'] = html_entity_decode($stats['today']['earnings'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    return $response;
}

/**
 * Render the Sales Summary widget.
 *
 * @return void
 */
function persca_edd_render_dashboard_widget(): void
{
    // Return early to let EDD's priority 10 handler render the widget.
    if (!function_exists('edd_load_dashboard_sales_widget') || !persca_edd_is_active() || !class_exists('PERSCA_Date_Converter')) {
        return;
    }

    if (!current_user_can(apply_filters('edd_dashboard_stats_cap', 'view_shop_reports'))) {
        return; // EDD's handler performs the same check and dies.
    }

    ob_start('persca_edd_filter_dashboard_widget_html');

    edd_load_dashboard_sales_widget(); // Ends with die(); the buffer is flushed through our callback.
}

/**
 * Rewrite "Current Month" and "Last Month" using Jalali boundaries.
 *
 * @param string $html Buffered widget HTML.
 * @return string
 */
function persca_edd_filter_dashboard_widget_html($html)
{
    if (
        ! is_string($html)
        || false === strpos($html, 'edd_dashboard_widget')
    ) {
        return $html;
    }

    if (
        ! class_exists('DOMDocument')
        || ! class_exists('DOMXPath')
    ) {
        return $html;
    }

    $data = persca_edd_dashboard_widget_data(array('this_month', 'last_month'));

    // Exact class matching.
    $class_match = static function ($class) {
        return sprintf('contains(concat(" ", normalize-space(@class), " "), " %s ")', $class);
    };

    $current_month = '//div[' . $class_match('table_current_month') . ']';

    $targets = array(
        $current_month . '//td[' . $class_match('b-earnings') . ']' => (string) $data['this_month']['earnings'],
        $current_month . '//td[' . $class_match('b-sales') . ']'    => (string) $data['this_month']['count'],
        '//td[' . $class_match('b-last-month-earnings') . ']'       => (string) $data['last_month']['earnings'],
        '//td[' . $class_match('b-last-month-sales') . ']'          => (string) $data['last_month']['count'],
    );

    $previous = libxml_use_internal_errors(true);

    $doc = new DOMDocument('1.0', 'UTF-8');
    $loaded = $doc->loadHTML(
        '<?xml encoding="utf-8" ?><div id="persca-widget-root">' . $html . '</div>',
        LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD
    );

    libxml_clear_errors();
    libxml_use_internal_errors($previous);

    if (!$loaded) {
        return $html;
    }

    $xpath = new DOMXPath($doc);

    // Patch every matching cell independently.
    foreach ($targets as $query => $value) {
        $nodes = $xpath->query('//*[@id="persca-widget-root"]' . $query);

        if (!$nodes || 0 === $nodes->length) {
            continue;
        }

        foreach ($nodes as $node) {
            $node->nodeValue = html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        }
    }

    $root = $xpath->query('//*[@id="persca-widget-root"]');

    if (!$root || 0 === $root->length) {
        return $html;
    }

    $output = '';

    foreach ($root->item(0)->childNodes as $child) {
        $output .= $doc->saveHTML($child);
    }

    return '' !== trim($output) ? $output : $html;
}
