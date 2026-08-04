<?php
/**
 * JetBooking Integration for Persian Calendar
 *
 * Provides Persian/Jalali calendar support for Crocoblock's JetBooking plugin.
 * Handles both frontend (date range picker) and backend (Vue.js datepicker,
 * calendar, and timeline) date components.
 *
 * @package PERSCA
 * @since 1.3.3
 */

if (!defined('ABSPATH')) {
    exit;
}

/* =============================================================================
 * ASSETS & DEPENDENCIES
 * ========================================================================== */

// Enqueue integration assets on both frontend and admin
add_action('admin_enqueue_scripts', 'persca_jet_booking_enqueue_assets', 20);
add_action('wp_enqueue_scripts', 'persca_jet_booking_enqueue_assets', 20);

// Inject our script as a dependency of JetBooking scripts so it loads automatically
add_action('wp_default_scripts', 'persca_jet_booking_add_dependencies', 100);
add_action('admin_enqueue_scripts', 'persca_jet_booking_add_dependencies', 100);
add_action('wp_enqueue_scripts', 'persca_jet_booking_add_dependencies', 100);

// The bookings calendar, timeline and details panel are rendered from
// JetBooking's own REST endpoints, so those responses must stay Jalali.
if (function_exists('persca_keep_jalali_on_rest_routes')) {
    persca_keep_jalali_on_rest_routes(
        array('jet-abaf', 'jet_abaf', 'jet-booking'),
        static function () {
            return class_exists('JET_ABAF\\Plugin') || defined('JET_ABAF_VERSION');
        }
    );
}

/**
 * Enqueue Persian Calendar integration scripts and styles for JetBooking.
 */
function persca_jet_booking_enqueue_assets() {
    // Only load if Jalali calendar is enabled and JetBooking is active
    if (!persca_is_jalali_enabled() || (!class_exists('JET_ABAF\\Plugin') && !defined('JET_ABAF_VERSION'))) {
        return;
    }

    // Shared Jalali core script + popup styles.
    persca_enqueue_core_assets();

    // Frontend range-picker stylesheet (JetBooking only).
    wp_enqueue_style(
        'persian-calendar-front',
        PERSCA_PLUGIN_URL . 'assets/css/persian-calendar-front.css',
        array(),
        PERSCA_PLUGIN_VERSION
    );



    // Enqueue the main JetBooking integration script
    wp_enqueue_script(
        'persca-integrate-jet-booking',
        PERSCA_PLUGIN_URL . 'assets/js/integrate-jet-booking.js',
        array('jquery', 'persian-calendar-main'),
        PERSCA_PLUGIN_VERSION,
        true
    );
}

/**
 * Add our integration script as a dependency to JetBooking scripts
 * so it loads before JetBooking initialises its datepickers.
 */
function persca_jet_booking_add_dependencies() {
    if (!persca_is_jalali_enabled()) {
        return;
    }

    // Load our overrides before JetBooking initialises its date pickers.
    persca_inject_dependency(array(
        // Original date range picker library.
        'jquery-date-range-picker',
        'jquery-date-range-picker-js',
        // Frontend: date range picker initialisation
        'jet-booking-init',
        'jet-abaf-booking-init',
        // Backend: bookings page (timeline, filters, calendar)
        'jet-abaf-bookings-page',
        'jet-abaf-bookings',
        // Backend: settings page (schedule manager with vuejs-datepicker)
        'jet-abaf-settings-page',
        'jet-abaf-schedule-manager',
        'jet-abaf-meta-extras',
        // Backend: post meta (price seasons with vuejs-datepicker)
        'jet-abaf-post-meta-price',
        'jet-abaf-post-meta-configuration',
        // Backend: calendars page
        'jet-abaf-calendars-page',
    ), 'persca-integrate-jet-booking');
}
