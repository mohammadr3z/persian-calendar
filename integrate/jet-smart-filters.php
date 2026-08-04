<?php
/**
 * JetSmartFilters Integration for Persian Calendar
 */

if (!defined('ABSPATH')) {
    exit;
}

/* =============================================================================
 * ASSETS & DEPENDENCIES
 * ========================================================================== */

// Frontend only: JetSmartFilters renders its filters on the front end, so the
// integration assets must never load in wp-admin (avoids loading on unrelated
// admin pages such as EDD, WooCommerce, settings, etc.).
add_action('wp_enqueue_scripts', 'persca_jet_smart_filters_enqueue_assets', 20);

// Inject our script as a dependency of JetSmartFilters script so it loads automatically
add_action('wp_default_scripts', 'persca_jet_smart_filters_add_dependencies', 100);
add_action('wp_enqueue_scripts', 'persca_jet_smart_filters_add_dependencies', 100);

/**
 * Enqueue assets for JetSmartFilters integration.
 */
function persca_jet_smart_filters_enqueue_assets() {
    if (!persca_is_jalali_enabled() || !class_exists('Jet_Smart_Filters')) {
        return;
    }

    // Shared Jalali core script + popup styles.
    persca_enqueue_core_assets();

    // Enqueue JetSmartFilters integration overrides script
    wp_enqueue_script(
        'persca-integrate-jet-smart-filters',
        PERSCA_PLUGIN_URL . 'assets/js/integrate-jet-smart-filters.js',
        array('jquery', 'persian-calendar-main', 'jquery-ui-datepicker'),
        PERSCA_PLUGIN_VERSION,
        true
    );
}

/**
 * Add JetSmartFilters integration script as a dependency of the official JetSmartFilters script.
 */
function persca_jet_smart_filters_add_dependencies() {
    if (!persca_is_jalali_enabled()) {
        return;
    }

    persca_inject_dependency(array(
        'jet-smart-filters',
    ), 'persca-integrate-jet-smart-filters');
}

/* =============================================================================
 * REQUEST NORMALIZATION (Jalali -> Gregorian)
 * ========================================================================== */

// Convert Jalali date filters in the request to Gregorian before JetSmartFilters processes them
add_filter('jet-smart-filters/query/request', 'persca_jet_smart_filters_filter_request', 10, 2);

function persca_jet_smart_filters_filter_request($request, $query_manager) {
    if (!persca_is_jalali_enabled() || empty($request)) {
        return $request;
    }

    return persca_jet_smart_filters_convert_jalali_to_gregorian($request);
}

function persca_jet_smart_filters_convert_jalali_to_gregorian($val) {
    if (is_array($val)) {
        foreach ($val as $k => $v) {
            $val[$k] = persca_jet_smart_filters_convert_jalali_to_gregorian($v);
        }
        return $val;
    }

    if (!is_string($val)) {
        return $val;
    }

    // Handle range e.g., "1405.04.27-1405.05.03", "1405/04/27-1405/05/03", or "1405-04-27-1405-05-03"
    if (preg_match('/^(\d{4}[.\/\-]\d{1,2}[.\/\-]\d{1,2})-(\d{4}[.\/\-]\d{1,2}[.\/\-]\d{1,2})$/', trim($val), $matches)) {
        $from = persca_jet_smart_filters_convert_single_jalali_to_gregorian($matches[1]);
        $to = persca_jet_smart_filters_convert_single_jalali_to_gregorian($matches[2]);
        return $from . '-' . $to;
    }

    return persca_jet_smart_filters_convert_single_jalali_to_gregorian($val);
}

function persca_jet_smart_filters_convert_single_jalali_to_gregorian($date_str) {
    // Match formats like YYYY.MM.DD, YYYY/MM/DD, YYYY-MM-DD (supporting single/double digit month/day)
    if (preg_match('/^(\d{4})([.\/\-])(\d{1,2})\2(\d{1,2})$/', trim($date_str), $matches)) {
        $jy = intval($matches[1]);
        $separator = $matches[2];
        $jm = intval($matches[3]);
        $jd = intval($matches[4]);

        $converter = persca_get_converter();
        // If the year is a Jalali year (e.g. 1300 to 1700) and is a valid date
        if ($jy >= 1300 && $jy < 1700 && $converter->is_valid_jalali($jy, $jm, $jd)) {
            $g = $converter->jalali_to_gregorian($jy, $jm, $jd);
            return sprintf('%04d%s%02d%s%02d', $g['y'], $separator, $g['m'], $separator, $g['d']);
        }
    }
    return $date_str;
}

