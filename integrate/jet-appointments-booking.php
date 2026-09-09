<?php
/**
 * JetAppointments Integration for Persian Calendar
 *
 * Provides Persian/Jalali calendar support for Crocoblock's JetAppointments Booking plugin.
 * Handles both frontend (VanillaCalendar, Flatpickr, JetFormBuilder) and backend (Vue.js datepicker,
 * appointments list, calendar, and timeline/Gantt chart) date components.
 *
 * @package PERSCA
 * @since 1.5.0
 */

if (!defined('ABSPATH')) {
    exit;
}

/* =============================================================================
 * 24-HOUR TIME DISPLAY
 * ========================================================================== */

// JetAppointments formats slot times from two sources:
//   1. get_option( 'time_format' ) inside the admin REST endpoints
//      (appointments list, get appointment, ...) for slot / slot_end;
//   2. The JetAppointments 'slot_time_format' setting, used by the frontend
//      calendar slots (Time_Types::get_slot_view), the recurrence app and
//      the WooCommerce order details (Tools::get_verbosed_slot).
//
// Admin REST endpoints are forced to H:i for 24-hour format.
// Frontend slot times are handled client-side by to24hTime() in
// integrate-jet-appointments.js, preserving the native slot HTML rendering.

// 1. Admin REST endpoints read the WordPress time_format option directly.
add_filter('pre_option_time_format', static function ($pre, $option) {
    if (persca_rest_route_matches(persca_jet_apb_rest_needles())) {
        return 'H:i';
    }
    return $pre;
}, 10, 2);

// Frontend slot times are handled client-side by to24hTime() in
// integrate-jet-appointments.js, which converts 12-hour slot times to
// 24-hour for storage and display. Letting JetAppointments use its
// native slot_time_format avoids breaking the slot HTML rendering.

/* =============================================================================
 * ASSETS & DEPENDENCIES
 * ========================================================================== */

// Enqueue integration assets on both frontend and admin
add_action('admin_enqueue_scripts', 'persca_jet_appointments_enqueue_assets', 20);
add_action('wp_enqueue_scripts', 'persca_jet_appointments_enqueue_assets', 20);

// Inject our script as a dependency of JetAppointments scripts so it loads automatically
add_action('wp_default_scripts', 'persca_jet_appointments_add_dependencies', 100);
add_action('admin_enqueue_scripts', 'persca_jet_appointments_add_dependencies', 100);
add_action('wp_enqueue_scripts', 'persca_jet_appointments_add_dependencies', 100);

// REST API route exceptions for JetAppointments to keep dates properly localized.
//
// Since JetAppointments 2.x its endpoints extend \Jet_Engine_Base_API_Endpoint and
// are served through the JetEngine legacy API, so the REST namespace may be
// jet-engine/v1/... rather than jet-apb/v1/... . Match the concrete endpoint
// bases too, so the route check works regardless of the namespace in use.
if (!function_exists('persca_jet_apb_rest_needles')) {
    function persca_jet_apb_rest_needles(): array
    {
        return array(
            // Namespace fragments used by JetAppointments builds.
            'jet-apb',
            'jet_apb',
            'jet-appointments-booking',
            // Concrete JetAppointments endpoint bases (see includes/rest-api/*).
            'appointment-date-slots',
            'appointment-refresh-date',
            'appointment-service-providers',
            'appointment-provider-services',
            'appointments-list',
            'delete-appointment',
            'update-appointment',
            'appointment-add-appointment',
            'update-appointment-workflows',
            'appointment-meta',
            'get-appointment',
            'external-meta',
        );
    }
}


// Format date strings in REST responses to full 4-digit Jalali YYYY/MM/DD
add_filter('rest_post_dispatch', 'persca_jet_apb_format_rest_dates', 20, 3);
function persca_jet_apb_format_rest_dates($response, $server, $request) {
    if (!persca_is_jalali_enabled()) {
        return $response;
    }
    if (!persca_rest_route_matches(persca_jet_apb_rest_needles())) {
        return $response;
    }
    if (!is_a($response, 'WP_REST_Response')) {
        return $response;
    }
    $data = $response->get_data();
    if (empty($data) || !is_array($data)) {
        return $response;
    }

    $format_item = static function (&$item) {
        if (!is_array($item)) {
            return;
        }
        if (!empty($item['date_timestamp'])) {
            $ts = intval($item['date_timestamp']);
            if ($ts > 0) {
                $item['date'] = date_i18n('Y/m/d', $ts);
            }
        } elseif (!empty($item['date']) && is_numeric($item['date'])) {
            $ts = intval($item['date']);
            if ($ts > 100000) {
                $item['date_timestamp'] = $ts;
                $item['date'] = date_i18n('Y/m/d', $ts);
            }
        }
    };

    if (isset($data['items']) && is_array($data['items'])) {
        foreach ($data['items'] as &$it) {
            $format_item($it);
        }
        unset($it);
    } elseif (isset($data['item']) && is_array($data['item'])) {
        $format_item($data['item']);
    } elseif (isset($data['data']) && is_array($data['data'])) {
        $is_assoc = (array_keys($data['data']) !== range(0, count($data['data']) - 1));
        if (!$is_assoc) {
            foreach ($data['data'] as &$it) {
                $format_item($it);
            }
            unset($it);
        } else {
            $format_item($data['data']);
        }
    }
    $response->set_data($data);
    return $response;
}

/**
 * Enqueue Persian Calendar integration scripts and styles for JetAppointments.
 */
function persca_jet_appointments_enqueue_assets() {
    // Only load if Jalali calendar is enabled and JetAppointments is active
    if (!persca_is_jalali_enabled() || (!class_exists('JET_APB\\Plugin') && !defined('JET_APB_VERSION'))) {
        return;
    }

    // Shared Jalali core script + popup styles.
    persca_enqueue_core_assets();

    // Frontend stylesheet for Persian Calendar
    wp_enqueue_style(
        'persian-calendar-front',
        PERSCA_PLUGIN_URL . 'assets/css/persian-calendar-front.css',
        array(),
        PERSCA_PLUGIN_VERSION
    );

    // Enqueue the main JetAppointments integration script
    wp_enqueue_script(
        'persca-integrate-jet-appointments',
        PERSCA_PLUGIN_URL . 'assets/js/integrate-jet-appointments.js',
        array('jquery', 'persian-calendar-main'),
        PERSCA_PLUGIN_VERSION,
        true
    );
}

/**
 * Add our integration script as a dependency to JetAppointments scripts
 * so it loads before JetAppointments initialises its datepickers.
 */
function persca_jet_appointments_add_dependencies() {
    if (!persca_is_jalali_enabled()) {
        return;
    }

    // Load our overrides before JetAppointments initialises its date pickers.
    //
    // Handles verified against JetAppointments 2.5.2 (Jet_APB\Plugin registers
    // public assets on wp_enqueue_scripts:0; admin pages enqueue under their
    // page slug). Injection is a no-op for unregistered handles, so the list
    // simply has to cover every script that reads window.vuejsDatepicker or
    // instantiates VanillaCalendar before our overrides take effect.
    persca_inject_dependency(array(
        // Frontend date pickers & form init (form.php / register_public_assets)
        'vanilla-calendar',
        'flatpickr',
        'jet-ab-front-init',
        'jet-ab-choices',
        // Admin: appointments page (list, timeline, calendar, filters)
        'jet-apb-appointments',
        'jet-apb-appointments-range',
        'vue-flatpickr',
        'vuejs-datepicker',
        // Admin: settings pages (settings.js enqueued under the page slug)
        'jet-apb-set-up',
        'jet-apb-general-settings',
        'jet-apb-working-hours-settings',
        'jet-apb-labels-settings',
        'jet-apb-tools-settings',
        'jet-apb-advanced-settings',
        'jet-apb-layout-settings',
        'jet-apb-integrations',
        'jet-apb-workflows',
        'jet-apb-admin-settings',
        // Admin: providers/services CPT meta boxes (settings.js)
        'jet_apb_post_meta_box',
        // JetFormBuilder editor assets (action-manager.php)
        'jet-app-booking-form-builder-fields',
        'jet-app-booking-form-builder-actions',
        // Legacy JetFormBuilder handles from older JetAppointments builds.
        // Injection is a no-op for unregistered handles, so keeping them
        // alongside the 2.5.2 handles is free backward compatibility.
        'jet-apb-builder-actions',
        'jet-apb-builder-v2',
        'jet-apb-builder-blocks',
    ), 'persca-integrate-jet-appointments');
}
