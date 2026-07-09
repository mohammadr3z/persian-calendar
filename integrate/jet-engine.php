<?php
/**
 * JetEngine Integration for Persian Calendar
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('admin_enqueue_scripts', 'persca_jet_engine_enqueue_assets', 20);
add_action('wp_enqueue_scripts', 'persca_jet_engine_enqueue_assets', 20);

// Modify dependencies to ensure integrate-jet-engine.js loads BEFORE JetEngine meta-boxes.js
add_action('wp_default_scripts', 'persca_jet_engine_add_dependencies', 100);
add_action('admin_enqueue_scripts', 'persca_jet_engine_add_dependencies', 100);
add_action('wp_enqueue_scripts', 'persca_jet_engine_add_dependencies', 100);

function persca_jet_engine_enqueue_assets() {
    if (!class_exists('Jet_Engine')) {
        return;
    }

    // Enqueue base Persian calendar script and converter
    wp_enqueue_script(
        'persian-calendar-main',
        PERSCA_PLUGIN_URL . 'assets/js/persian-calendar.js',
        array('jquery'),
        PERSCA_PLUGIN_VERSION,
        true
    );

    // Enqueue main Gutenberg calendar styles for the custom datepicker
    wp_enqueue_style(
        'persian-calendar-gutenberg-styles',
        PERSCA_PLUGIN_URL . 'assets/css/gutenberg-calendar.css',
        array(),
        PERSCA_PLUGIN_VERSION
    );

    // Enqueue JetEngine integration overrides styles
    wp_enqueue_style(
        'persca-integrate-jet-engine-styles',
        PERSCA_PLUGIN_URL . 'assets/css/integrate-jet-engine.css',
        array('persian-calendar-gutenberg-styles'),
        PERSCA_PLUGIN_VERSION
    );

    // Enqueue JetEngine integration overrides
    wp_enqueue_script(
        'persca-integrate-jet-engine',
        PERSCA_PLUGIN_URL . 'assets/js/integrate-jet-engine.js',
        array('jquery', 'persian-calendar-main'),
        PERSCA_PLUGIN_VERSION,
        true
    );
}

function persca_jet_engine_add_dependencies() {
    global $wp_scripts;
    if (!$wp_scripts) {
        return;
    }
    
    $target_scripts = array(
        'jet-engine-meta-boxes',
        'jet-engine-advanced-date-field',
    );
    
    foreach ($target_scripts as $handle) {
        if (isset($wp_scripts->registered[$handle])) {
            $deps = $wp_scripts->registered[$handle]->deps;
            if (!in_array('persca-integrate-jet-engine', $deps, true)) {
                $wp_scripts->registered[$handle]->deps[] = 'persca-integrate-jet-engine';
            }
        }
    }
}

// Hook into get_post_metadata to format date custom fields on the frontend
add_filter('get_post_metadata', 'persca_jet_engine_filter_post_metadata', 10, 4);

function persca_jet_engine_filter_post_metadata($value, $object_id, $meta_key, $single) {
    if ($value !== null) {
        return $value;
    }

    // Do not convert during REST API, WP-CLI, or XML-RPC requests
    if ((defined('REST_REQUEST') && REST_REQUEST) || (defined('WP_CLI') && WP_CLI) || (defined('XMLRPC_REQUEST') && XMLRPC_REQUEST)) {
        return $value;
    }

    // Only convert on the frontend, but allow inside Elementor editor/preview
    if (is_admin()) {
        $is_elementor = false;
        if (
            (isset($_GET['action']) && $_GET['action'] === 'elementor') ||
            isset($_GET['elementor-preview']) ||
            (defined('DOING_AJAX') && DOING_AJAX && isset($_REQUEST['action']) && strpos($_REQUEST['action'], 'elementor') === 0)
        ) {
            $is_elementor = true;
        }
        if (!$is_elementor) {
            return $value;
        }
    }

    // Prevent infinite recursion loops
    static $running = false;
    if ($running) {
        return $value;
    }

    // Skip hidden/internal meta keys (like _elementor_data, _edit_lock, etc.)
    // This prevents breaking Elementor styles and other system functionalities.
    if (strpos($meta_key, '_') === 0) {
        return $value;
    }

    /**
     * Filter whether a specific meta key should be converted to Jalali.
     *
     * @param bool   $should_convert Whether to convert this meta key. Default true.
     * @param string $meta_key       The meta key being read.
     * @param int    $object_id      The post ID.
     */
    if (!apply_filters('persca_jet_engine_should_convert_meta', true, $meta_key, $object_id)) {
        return $value;
    }

    $running = true;
    try {
        $raw_val = get_post_meta($object_id, $meta_key, $single);
    } finally {
        $running = false;
    }

    return persca_jet_engine_convert_meta_value($raw_val);
}

function persca_jet_engine_convert_meta_value($val) {
    if (is_array($val)) {
        foreach ($val as $k => $v) {
            $val[$k] = persca_jet_engine_convert_meta_value($v);
        }
        return $val;
    }

    if (!is_string($val)) {
        return $val;
    }

    // Match YYYY-MM-DD
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $val, $matches)) {
        $y = intval($matches[1]);
        $m = intval($matches[2]);
        $d = intval($matches[3]);
        if (checkdate($m, $d, $y)) {
            $converter = new PERSCA_Date_Converter();
            $jalali = $converter->gregorian_to_jalali($y, $m, $d);
            $j_date = sprintf('%04d/%02d/%02d', $jalali['y'], $jalali['m'], $jalali['d']);
            return persca_jet_engine_maybe_convert_digits($j_date);
        }
    }

    // Match YYYY-MM-DDTHH:mm:ss or YYYY-MM-DD HH:mm:ss
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/', $val, $matches)) {
        $y = intval($matches[1]);
        $m = intval($matches[2]);
        $d = intval($matches[3]);
        $hh = intval($matches[4]);
        $mi = intval($matches[5]);
        if (checkdate($m, $d, $y)) {
            $converter = new PERSCA_Date_Converter();
            $jalali = $converter->gregorian_to_jalali($y, $m, $d);
            $j_date = sprintf('%04d/%02d/%02d %02d:%02d', $jalali['y'], $jalali['m'], $jalali['d'], $hh, $mi);
            return persca_jet_engine_maybe_convert_digits($j_date);
        }
    }

    return $val;
}

function persca_jet_engine_maybe_convert_digits($str) {
    return $str;
}

