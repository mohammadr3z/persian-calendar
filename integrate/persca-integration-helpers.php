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

/* =============================================================================
 * ASSETS & DEPENDENCIES
 * ========================================================================== */

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

/* =============================================================================
 * REST ROUTE HELPERS
 * ========================================================================== */

if (!function_exists('persca_rest_route_matches')) {
    /**
     * Whether the current REST request targets one of the given route fragments.
     *
     * @param string[] $needles Lower-case route fragments, e.g. array('jet-abaf').
     * @return bool
     */
    function persca_rest_route_matches(array $needles): bool
    {
        if (!defined('REST_REQUEST') || !REST_REQUEST) {
            return false;
        }

        $route = '';

        if (isset($GLOBALS['wp']) && isset($GLOBALS['wp']->query_vars['rest_route'])) {
            $route = (string) $GLOBALS['wp']->query_vars['rest_route'];
        }

        if ('' === $route && isset($_SERVER['REQUEST_URI'])) {
            // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
            $route = (string) wp_unslash($_SERVER['REQUEST_URI']);
        }

        if ('' === $route) {
            return false;
        }

        $route = strtolower($route);

        foreach ($needles as $needle) {
            if ('' !== $needle && false !== strpos($route, $needle)) {
                return true;
            }
        }

        return false;
    }
}

if (!function_exists('persca_keep_jalali_on_rest_routes')) {
    /**
     * Re-enable Jalali conversion for a plugin's own display oriented REST routes.
     *
     * Since 1.4.0 every REST request is treated as a machine context, so
     * date_i18n()/wp_date() stop converting. That is correct for core routes
     * (wp/v2), WooCommerce Analytics and exporters, which must stay Gregorian,
     * but it also silenced the Jalali output of admin screens that are rendered
     * from a plugin's own REST endpoints (JetBooking bookings calendar and
     * timeline, JetEngine listings, JetFormBuilder records).
     *
     * Machine formats (c, r, U, DATE_ATOM ...) are still excluded upstream by
     * PERSCA_Plugin::should_convert_date(), and only the passed route fragments
     * are re-enabled.
     *
     * @param string[]      $needles     Lower-case route fragments to allow.
     * @param callable|null $is_active   Optional callback that must return true.
     * @return void
     */
    function persca_keep_jalali_on_rest_routes(array $needles, ?callable $is_active = null): void
    {
        add_filter(
            'persca_should_convert_date',
            static function ($should_convert, $format, $timestamp, $context) use ($needles, $is_active) {
                if ($should_convert || 'rest' !== $context) {
                    return $should_convert;
                }

                if (null !== $is_active && !$is_active()) {
                    return $should_convert;
                }

                if (!persca_rest_route_matches($needles)) {
                    return $should_convert;
                }

                return true;
            },
            10,
            4
        );
    }
}

/* =============================================================================
 * SHARED CONVERTER & SETTINGS HELPERS
 * ========================================================================== */

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

if (!function_exists('persca_is_jalali_enabled')) {
    /**
     * Whether Jalali calendar conversion is globally enabled in plugin settings.
     *
     * @return bool
     */
    function persca_is_jalali_enabled(): bool
    {
        $opts = get_option('persca_options', array());
        if (class_exists('PERSCA_Admin')) {
            $defaults = PERSCA_Admin::get_default_settings();
            $opts     = wp_parse_args($opts, $defaults);
        }
        return !empty($opts['enable_jalali']);
    }
}
