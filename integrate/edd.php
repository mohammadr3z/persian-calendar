<?php
/**
 * Easy Digital Downloads (EDD) Integration for Persian Calendar
 *
 * Adds Jalali (Shamsi) calendar support to Easy Digital Downloads:
 *  - Replaces every jQuery UI "edd_datepicker" field with the plugin's Jalali date picker
 *    (Discount start/expiration dates, Order date, Customer "Date Created", Reports custom
 *     range, list-table date filters and every CSV exporter From/To range).
 *  - Normalizes any Jalali date submitted in the request back to Gregorian so EDD keeps
 *    storing and querying real Gregorian dates. Nothing in the database is changed.
 *  - Localizes the dates printed inside EDD admin screens to the Jalali calendar.
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
 * Whether the current request belongs to an EDD admin context
 * (settings pages, list tables, order/discount/customer editors, or the
 * batch-export AJAX endpoint).
 *
 * @return bool
 */
function persca_edd_is_context(): bool
{
    if (!is_admin()) {
        return false;
    }

    // On admin-ajax.php `is_admin()` returns true even for genuine FRONT-END
    // requests such as EDD checkout / add-to-cart. Those purchase requests can
    // carry EDD-named actions (e.g. edd_action=edd_process_checkout or
    // action=edd_add_to_cart) that would otherwise satisfy the "edd_action" /
    // "contains edd" checks below and make the request normalizer walk the whole
    // payload. The only EDD context we legitimately serve over AJAX is the
    // batch/CSV exporter, so during an AJAX request treat ONLY that endpoint as
    // an admin context and bail on everything else. This guarantees a
    // Jalali-looking value in a custom checkout field can never be silently
    // rewritten to Gregorian during a purchase.
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
 * Enqueue the Persian calendar core, the shared date-picker styles and the
 * EDD integration overrides on EDD admin screens only.
 */
function persca_edd_enqueue_assets(): void
{
    if (!persca_edd_is_active() || !persca_edd_is_context()) {
        return;
    }

    // Shared Jalali core script + popup styles.
    persca_enqueue_core_assets();

    // Prevent the Gregorian "flash" (FOUC) on the report date-range label:
    // hide the label until our JS has localized it to Jalali, then reveal it by
    // adding the .persca-dates-ready class to <body>. A CSS animation reveals
    // the label after 2s as a fail-safe in case the JS never runs, so the
    // content can never stay hidden permanently. Loaded in <head> so it applies
    // before the body is painted.
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
        // When a report preset was rewritten to a Jalali custom range, this tells
        // the browser which preset to display in the dropdown (cosmetic only).
        'forcedRange'   => $forced_range,
    ));
}

// Make sure our datepicker override is parsed before EDD initializes its pickers.
add_action('admin_enqueue_scripts', 'persca_edd_add_dependencies', 100);

/**
 * Inject the integration script as a dependency of EDD's admin scripts so it
 * always loads first, regardless of enqueue order.
 */
function persca_edd_add_dependencies(): void
{
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
 *
 * The Jalali date picker submits a Gregorian value already, so EDD stores and
 * queries native Gregorian dates. This layer is a safety net: it converts any
 * value that clearly looks like a Jalali date (year 1300-1599) coming from the
 * reports range, list-table filters or the CSV exporters back to Gregorian ISO,
 * which every EDD date parser (Carbon / strtotime) understands.
 * ========================================================================== */

add_action('init', 'persca_edd_normalize_request', 0);
add_action('admin_init', 'persca_edd_normalize_request', 0);

/**
 * Walk the request superglobals and convert Jalali dates to Gregorian.
 */
function persca_edd_normalize_request(): void
{
    if (!persca_edd_is_active() || !persca_edd_is_context()) {
        return;
    }

    foreach (array('_GET', '_POST', '_REQUEST') as $global_key) {
        if (!empty($GLOBALS[$global_key]) && is_array($GLOBALS[$global_key])) {
            $GLOBALS[$global_key] = persca_edd_convert_request_array($GLOBALS[$global_key]);
        }
    }
}

/**
 * Recursively convert Jalali date strings in an array to Gregorian.
 *
 * @param array $arr Request array.
 * @return array
 */
function persca_edd_convert_request_array(array $arr): array
{
    foreach ($arr as $key => $value) {
        if (is_array($value)) {
            $arr[$key] = persca_edd_convert_request_array($value);
        } elseif (is_string($value)) {
            $arr[$key] = persca_edd_convert_jalali_string($value);
        }
    }

    return $arr;
}

/**
 * Convert a single Jalali date string to Gregorian ISO (YYYY-MM-DD), keeping any
 * trailing time portion. Non-Jalali / non-date strings are returned unchanged.
 *
 * @param string $value Raw request value.
 * @return string
 */
function persca_edd_convert_jalali_string(string $value): string
{
    $raw = trim($value);
    if ('' === $raw) {
        return $value;
    }

    // Dates (even with Persian/Arabic digits plus a time part) are short. Skip
    // long values (post content, JSON blobs, serialized settings, etc.) so the
    // digit normalization and regex below never run on large unrelated request
    // fields. Keeps the request normalizer cheap on every EDD admin request.
    if (strlen($raw) > 40) {
        return $value;
    }

    $ascii = persca_edd_to_ascii_digits($raw);

    // Leading YYYY[sep]M[sep]D with sep of / . or -, plus optional trailing time.
    if (!preg_match('/^(\d{4})([\/\.\-])(\d{1,2})\2(\d{1,2})(.*)$/', $ascii, $m)) {
        return $value;
    }

    $jy   = (int) $m[1];
    $jm   = (int) $m[3];
    $jd   = (int) $m[4];
    $rest = $m[5];

    // Only touch values that are unambiguously Jalali; leave Gregorian/ISO alone.
    if ($jy < 1300 || $jy > 1599) {
        return $value;
    }

    $converter = persca_get_converter();
    if (!$converter->is_valid_jalali($jy, $jm, $jd)) {
        return $value;
    }

    $g = $converter->jalali_to_gregorian($jy, $jm, $jd);

    return sprintf('%04d-%02d-%02d', $g['y'], $g['m'], $g['d']) . $rest;
}

/**
 * Convert Persian/Arabic-Indic digits to ASCII digits.
 *
 * @param string $str Input string.
 * @return string
 */
function persca_edd_to_ascii_digits(string $str): string
{
    $fa = array('۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹');
    $ar = array('٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩');
    $en = array('0', '1', '2', '3', '4', '5', '6', '7', '8', '9');

    $str = str_replace($fa, $en, $str);
    $str = str_replace($ar, $en, $str);

    return $str;
}

/* =============================================================================
 * JALALI PRESET DATE RANGES
 *
 * EDD's report presets (Month/Quarter/Year to Date, last month, etc.) are
 * computed on the Gregorian calendar, so "Month to Date" starts on 1 July
 * (= 10 Tir) instead of 1 Tir. We recompute the calendar-based presets on the
 * Jalali calendar for the actual data query (report charts + endpoints that read
 * their range through EDD\Reports\get_dates_filter()). The matching labels are
 * recomputed on the client in assets/js/integrate-edd.js.
 * ========================================================================== */

add_filter('edd_get_dates_filter', 'persca_edd_jalali_dates_filter', 20);

/**
 * Replace the start/end of a calendar-based preset range with its Jalali
 * equivalent so the queried data matches the Jalali calendar month/quarter/year.
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
    if (!is_array($dates) || empty($dates['range']) || !persca_edd_is_active()) {
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
        'this_month', 'last_month',
        'this_quarter', 'last_quarter',
        'this_year', 'last_year',
        'this_week', 'last_week',
    );
}

/**
 * Compute Gregorian Y-m-d boundaries for a Jalali calendar preset range.
 *
 * Only calendar-based presets are handled. Day-based presets (today, yesterday,
 * last 30 days) and custom ranges return null (no recalculation needed).
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
 * Rewrite the report date-range request so calendar presets are computed on the
 * Jalali calendar.
 *
 * EDD's core parse_dates_for_range() computes "this month / quarter / year" on
 * the Gregorian calendar and is called directly by the chart data endpoints
 * (e.g. Graph.php), bypassing every available filter. The only reliable
 * interception point is the request itself: get_filter_value('dates') reads the
 * range and custom from/to straight from $_GET. So when a Jalali calendar preset
 * is requested, we convert it into a custom ("other") range whose boundaries are
 * the Jalali month/quarter/year/week edges. Every downstream consumer (chart
 * data, chart axis, list tables, relative comparison base) then uses the correct
 * Jalali boundaries, exactly as if the user had picked a custom range.
 *
 * Note: because the range becomes a fixed custom range, it no longer advances
 * automatically day-to-day; re-selecting the preset refreshes it to today.
 *
 * Hooked on `admin_init` (NOT `init`): this file is included while the `init`
 * hook is already running (persian-calendar.php bootstraps PERSCA on init:10),
 * so an `init` callback registered here would be added after init:1 has already
 * fired and would never run. `admin_init` fires after `init` completes and
 * before the Reports page renders its charts, which is exactly what we need.
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

    // Case 2: no range in the request (first load of the Reports page) -> apply
    // the default "Month to Date" as a Jalali custom range.
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

    // Remember the original preset so the browser can keep showing its name in
    // the dropdown instead of "Custom" (purely cosmetic; the data uses the
    // Jalali custom bounds below).
    $GLOBALS['persca_edd_forced_range'] = $preset;

    $_GET['range']           = 'other';
    $_GET['filter_from']     = $bounds['start'];
    $_GET['filter_to']       = $bounds['end'];
    $_REQUEST['range']       = 'other';
    $_REQUEST['filter_from'] = $bounds['start'];
    $_REQUEST['filter_to']   = $bounds['end'];
}
