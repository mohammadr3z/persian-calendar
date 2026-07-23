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

    // Shared Jalali core script + popup styles.
    persca_enqueue_core_assets();

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
    persca_inject_dependency(array(
        'jet-engine-meta-boxes',
        'jet-engine-advanced-date-field',
        'jet-engine-cct-list',
        'jet-engine-cct-edit',
        'jet-engine-cct-quick-edit',
        'jet-engine-cct-relations',
        'jet-engine-cct-query-dialog',
    ), 'persca-integrate-jet-engine');
}

function persca_get_jet_engine_date_meta_keys() {
    static $keys = null;
    if ($keys !== null) {
        return $keys;
    }

    $keys = array();

    if (function_exists('jet_engine') && !empty(jet_engine()->meta_boxes)) {
        $registered_fields = jet_engine()->meta_boxes->get_registered_fields();

        $process_fields = function($fields) use (&$process_fields, &$keys) {
            if (!is_array($fields)) return;
            foreach ($fields as $field) {
                if (empty($field['name']) || empty($field['type'])) continue;

                if (in_array($field['type'], array('date', 'datetime-local', 'datetime'), true)) {
                    $keys[] = $field['name'];
                } elseif ($field['type'] === 'repeater' && !empty($field['repeater-fields'])) {
                    $has_date = false;
                    foreach ($field['repeater-fields'] as $subfield) {
                        if (!empty($subfield['type']) && in_array($subfield['type'], array('date', 'datetime-local', 'datetime'), true)) {
                            $has_date = true;
                            break;
                        }
                    }
                    if ($has_date) {
                        $keys[] = $field['name'];
                    }
                }
            }
        };

        if (is_array($registered_fields)) {
            foreach ($registered_fields as $object_type => $fields) {
                $process_fields($fields);
            }
        }
    }

    $keys = apply_filters('persca_jet_engine_date_meta_keys', $keys);
    $keys = array_unique($keys);

    return $keys;
}

// Hook into JetEngine metadata filters to format date custom fields on the frontend
add_filter('jet-engine/listing/data/get-post-meta', 'persca_jet_engine_filter_listing_meta', 10, 3);
add_filter('jet-engine/listing/data/get-term-meta', 'persca_jet_engine_filter_listing_meta', 10, 3);
add_filter('jet-engine/listing/data/get-user-meta', 'persca_jet_engine_filter_listing_meta', 10, 3);
add_filter('jet-engine/listing/data/get-comment-meta', 'persca_jet_engine_filter_listing_meta', 10, 3);

// Hook into JetEngine dynamic field output value to format dates to Jalali
add_filter('jet-engine/listings/dynamic-field/field-value', 'persca_jet_engine_dynamic_field_value', 10, 2);

// Hook into JetEngine custom-value filter to intercept post-fetch values for object properties and meta fields
add_filter('jet-engine/listings/dynamic-field/custom-value', 'persca_jet_engine_dynamic_field_custom_value', 10, 3);

/**
 * Whether the current request should skip Jalali conversion of display values.
 *
 * Skips machine contexts (REST, WP-CLI, XML-RPC) and admin screens other than
 * the Elementor editor/preview or AJAX. Shared by all JetEngine value filters.
 *
 * @return bool
 */
function persca_jet_engine_should_skip_conversion(): bool {
    if ((defined('REST_REQUEST') && REST_REQUEST) || (defined('WP_CLI') && WP_CLI) || (defined('XMLRPC_REQUEST') && XMLRPC_REQUEST)) {
        return true;
    }

    if (is_admin() && !wp_doing_ajax()) {
        $is_elementor = (isset($_GET['action']) && $_GET['action'] === 'elementor') || isset($_GET['elementor-preview']);
        if (!$is_elementor) {
            return true;
        }
    }

    return false;
}

function persca_jet_engine_filter_listing_meta($value, $key, $object_id) {
    if ($value === null || $value === '') {
        return $value;
    }

    if (persca_jet_engine_should_skip_conversion()) {
        return $value;
    }

    // ONLY intercept meta keys that are dynamically registered as date/datetime fields in JetEngine
    $jet_date_keys = persca_get_jet_engine_date_meta_keys();
    if (!in_array($key, $jet_date_keys, true)) {
        return $value;
    }

    /**
     * Filter whether a specific meta key should be converted to Jalali.
     *
     * @param bool   $should_convert Whether to convert this meta key. Default true.
     * @param string $key            The meta key being read.
     * @param int    $object_id      The post ID.
     */
    if (!apply_filters('persca_jet_engine_should_convert_meta', true, $key, $object_id)) {
        return $value;
    }

    return persca_jet_engine_convert_meta_value($value);
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
            $converter = persca_get_converter();
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
        $ss = isset($matches[6]) ? intval($matches[6]) : null;
        if (checkdate($m, $d, $y) && $hh >= 0 && $hh <= 23 && $mi >= 0 && $mi <= 59 && ($ss === null || ($ss >= 0 && $ss <= 59))) {
            $converter = persca_get_converter();
            $jalali = $converter->gregorian_to_jalali($y, $m, $d);
            if ($ss !== null) {
                $j_date = sprintf('%04d/%02d/%02d %02d:%02d:%02d', $jalali['y'], $jalali['m'], $jalali['d'], $hh, $mi, $ss);
            } else {
                $j_date = sprintf('%04d/%02d/%02d %02d:%02d', $jalali['y'], $jalali['m'], $jalali['d'], $hh, $mi);
            }
            return persca_jet_engine_maybe_convert_digits($j_date);
        }
    }

    return $val;
}

function persca_jet_engine_maybe_convert_digits($str) {
    $settings = get_option('persca_options', array());
    $defaults = class_exists('PERSCA_Admin') ? PERSCA_Admin::get_default_settings() : array('enable_persian_digits' => true);
    $settings = wp_parse_args($settings, $defaults);

    if (!empty($settings['enable_persian_digits'])) {
        $converter = persca_get_converter();
        return $converter->to_persian_digits($str);
    }

    return $str;
}

function persca_jet_engine_dynamic_field_value($value, $settings = null) {
    if ($value === null || $value === '') {
        return $value;
    }

    if (persca_jet_engine_should_skip_conversion()) {
        return $value;
    }

    // Prevent infinite recursion loops
    static $running = false;
    if ($running) {
        return $value;
    }

    $running = true;
    try {
        $value = persca_jet_engine_convert_meta_value($value);
    } finally {
        $running = false;
    }

    return $value;
}

function persca_jet_engine_dynamic_field_custom_value($value, $settings, $widget) {
    if (persca_jet_engine_should_skip_conversion()) {
        return $value;
    }

    // If the date callback is active, let JetEngine format it.
    // Our date_i18n and wp_date hooks will convert it correctly.
    if (persca_jet_engine_is_date_callback_active($settings)) {
        return $value;
    }

    // Prevent infinite recursion loops
    static $running = false;
    if ($running) {
        return $value;
    }

    $running = true;
    try {
        // Temporarily remove ourselves to avoid infinite recursion when fetching the field content
        remove_filter('jet-engine/listings/dynamic-field/custom-value', 'persca_jet_engine_dynamic_field_custom_value', 10);
        $result = $widget->get_field_content($settings);
    } catch (\Throwable $e) {
        $result = $value;
    } finally {
        add_filter('jet-engine/listings/dynamic-field/custom-value', 'persca_jet_engine_dynamic_field_custom_value', 10, 3);
        $running = false;
    }

    return persca_jet_engine_convert_meta_value($result);
}

function persca_jet_engine_is_date_callback_active($settings) {
    if (empty($settings) || !is_array($settings)) {
        return false;
    }

    $is_filtered = isset($settings['dynamic_field_filter']) ? $settings['dynamic_field_filter'] : false;
    $is_filtered = filter_var($is_filtered, FILTER_VALIDATE_BOOLEAN);

    if (!$is_filtered) {
        return false;
    }

    $callback = isset($settings['filter_callback']) ? $settings['filter_callback'] : '';
    if ($callback === 'format_date') {
        return true;
    }

    $callbacks = isset($settings['filter_callbacks']) ? $settings['filter_callbacks'] : array();
    if (is_array($callbacks)) {
        foreach ($callbacks as $cb_data) {
            $cb = isset($cb_data['filter_callback']) ? $cb_data['filter_callback'] : '';
            if ($cb === 'format_date') {
                return true;
            }
        }
    }

    return false;
}

