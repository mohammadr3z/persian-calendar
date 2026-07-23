<?php
/**
 * Shared helpers for Persian Calendar third-party integrations.
 *
 * Loaded once (from PERSCA_Plugin::init) before any integration file, so all
 * integrations reuse the same asset enqueue and dependency-injection logic.
 *
 * @package PersianCalendar
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!function_exists('persca_enqueue_core_assets')) {
    /**
     * Enqueue the shared Persian calendar core script and popup styles used by
     * every integration (JetEngine, JetFormBuilder, JetSmartFilters, JetBooking, EDD).
     */
    function persca_enqueue_core_assets(): void
    {
        wp_enqueue_script(
            'persian-calendar-main',
            PERSCA_PLUGIN_URL . 'assets/js/persian-calendar.js',
            array('jquery'),
            PERSCA_PLUGIN_VERSION,
            true
        );

        wp_enqueue_style(
            'persian-calendar-gutenberg-styles',
            PERSCA_PLUGIN_URL . 'assets/css/gutenberg-calendar.css',
            array(),
            PERSCA_PLUGIN_VERSION
        );

        wp_enqueue_style(
            'persca-integrate-jet-styles',
            PERSCA_PLUGIN_URL . 'assets/css/integrate-jet.css',
            array('persian-calendar-gutenberg-styles'),
            PERSCA_PLUGIN_VERSION
        );
    }
}

if (!function_exists('persca_inject_dependency')) {
    /**
     * Append our integration script handle to the dependency list of each given
     * registered script handle, so our overrides always load first.
     *
     * @param string[] $handles    Registered script handles to hook into.
     * @param string   $our_handle Our integration script handle.
     */
    function persca_inject_dependency(array $handles, string $our_handle): void
    {
        global $wp_scripts;
        if (!$wp_scripts) {
            return;
        }
        foreach ($handles as $handle) {
            if (isset($wp_scripts->registered[$handle])) {
                $deps = &$wp_scripts->registered[$handle]->deps;
                if (!in_array($our_handle, $deps, true)) {
                    $deps[] = $our_handle;
                }
                unset($deps);
            }
        }
    }
}

if (!function_exists('persca_get_converter')) {
    /**
     * Return a shared PERSCA_Date_Converter instance.
     *
     * The converter is stateless, so a single cached instance is reused across
     * all integration value conversions instead of rebuilding the month/weekday
     * lookup tables for every date processed in large listings.
     *
     * @return PERSCA_Date_Converter
     */
    function persca_get_converter(): PERSCA_Date_Converter
    {
        static $converter = null;
        if ($converter === null) {
            $converter = new PERSCA_Date_Converter();
        }
        return $converter;
    }
}
