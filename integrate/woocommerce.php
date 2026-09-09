<?php

/**
 * WooCommerce integration for Persian Calendar.
 *
 * Covers every date/calendar/chart surface found in WooCommerce:
 *
 *  1. Admin date pickers (.date-picker, .date-picker-field, .range_datepicker)
 *     on order, coupon, product, variation, download-permission and report
 *     screens.
 *  2. The woocommerce_date_input_html_pattern guard, relaxed so Jalali years
 *     (13xx / 14xx) are accepted by the browser pattern validation.
 *  3. wc_date_format() / wc_time_format() so front-end and e-mail output uses
 *     a Jalali friendly format (rendered through the core date_i18n filter).
 *  4. Jalali -> Gregorian normalisation of every submitted / queried date so
 *     WooCommerce keeps writing real Gregorian values to the database.
 *  5. Jalali axis labels for the legacy Flot report charts (handled in JS).
 *
 * IMPORTANT: the database layer is deliberately untouched. All WooCommerce
 * date columns (date_created, date_created_gmt, date_paid, access_expires, ...)
 * stay Gregorian. Only the input and display layers are localised.
 *
 * @package PersianCalendar
 * @since   1.4.0
 */

if (! defined('ABSPATH')) {
    exit;
}

/**
 * Whether WooCommerce is installed and active.
 *
 * @since 1.4.0
 *
 * @return bool
 */
function persca_wc_is_active(): bool
{
    return class_exists('WooCommerce') || defined('WC_VERSION');
}

/**
 * Whether the current admin screen is a WooCommerce screen that shows dates.
 *
 * @since 1.4.0
 *
 * @return bool
 */
function persca_wc_is_context(): bool
{
    if (! is_admin()) {
        return false;
    }

    // phpcs:disable WordPress.Security.NonceVerification.Recommended
    $page      = isset($_GET['page']) ? sanitize_text_field(wp_unslash($_GET['page'])) : '';
    $post_type = isset($_GET['post_type']) ? sanitize_text_field(wp_unslash($_GET['post_type'])) : '';
    // phpcs:enable WordPress.Security.NonceVerification.Recommended

    $wc_pages = [
        'wc-reports',
        'wc-admin',
        'wc-settings',
        'wc-status',
        'wc-orders',
        'wc-orders--shop_subscription',
        'wc-admin-coupons',
    ];

    if (in_array($page, $wc_pages, true)) {
        return true;
    }

    $wc_post_types = ['product', 'shop_order', 'shop_coupon', 'shop_order_refund'];

    if (in_array($post_type, $wc_post_types, true)) {
        return true;
    }

    if (function_exists('get_current_screen')) {
        $screen = get_current_screen();

        if ($screen) {
            if (in_array($screen->post_type, $wc_post_types, true)) {
                return true;
            }

            if (false !== strpos((string) $screen->id, 'woocommerce')) {
                return true;
            }

            if (in_array($screen->id, ['edit-product_cat', 'edit-product_tag'], true)) {
                return true;
            }
        }
    }

    // Editing a single order / coupon / product via post.php.
    // phpcs:ignore WordPress.Security.NonceVerification.Recommended
    $post_id = isset($_GET['post']) ? absint($_GET['post']) : 0;

    if ($post_id) {
        $type = get_post_type($post_id);
        if (in_array($type, $wc_post_types, true)) {
            return true;
        }
    }

    return false;
}

/* =============================================================================
 * ASSETS & DEPENDENCIES
 * ========================================================================== */

/**
 * Enqueue the Jalali picker plus the WooCommerce bridge script.
 *
 * @since 1.4.0
 *
 * @return void
 */
function persca_wc_enqueue_assets(): void
{
    if (! persca_is_jalali_enabled() || ! persca_wc_is_active() || ! persca_wc_is_context()) {
        return;
    }

    persca_enqueue_core_assets();

    // Styling for the Jalali range picker that replaces WooCommerce's
    // react-dates DayPicker on the Analytics screens.
    wp_enqueue_style(
        'persca-integrate-woocommerce-calendar',
        PERSCA_PLUGIN_URL . 'assets/css/integrate-woocommerce-calendar.css',
        [],
        PERSCA_PLUGIN_VERSION
    );

    // wp-api-fetch must be a hard dependency: the Analytics bridge installs an
    // apiFetch middleware, and if the script runs before wp.apiFetch exists the
    // very first report request leaves with the untouched Gregorian range.
    $deps = ['jquery', 'persian-calendar-main'];

    if (wp_script_is('wp-api-fetch', 'registered')) {
        $deps[] = 'wp-api-fetch';
    }

    if (wp_script_is('wp-hooks', 'registered')) {
        $deps[] = 'wp-hooks';
    }

    wp_enqueue_script(
        'persca-integrate-woocommerce',
        PERSCA_PLUGIN_URL . 'assets/js/integrate-woocommerce.js',
        $deps,
        PERSCA_PLUGIN_VERSION,
        true
    );

    $options = get_option('persca_options', []);

    wp_localize_script(
        'persca-integrate-woocommerce',
        'perscaWoo',
        [
            'persianDigits' => ! empty($options['enable_persian_digits']) ? '1' : '0',
            'pickerFormat'  => 'yy/mm/dd',
            'isReportPage'  => (isset($_GET['page']) && 'wc-reports' === $_GET['page']) ? '1' : '0', // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        ]
    );
}
add_action('admin_enqueue_scripts', 'persca_wc_enqueue_assets', 20);

/**
 * Make sure our bridge loads before every WooCommerce script that builds a
 * datepicker or a report chart.
 *
 * @since 1.4.0
 *
 * @return void
 */
function persca_wc_add_dependencies(): void
{
    if (! persca_is_jalali_enabled() || ! persca_wc_is_active() || ! persca_wc_is_context()) {
        return;
    }

    persca_inject_dependency(
        [
            'wc-admin-meta-boxes',
            'wc-admin-order-meta-boxes',
            'wc-admin-product-meta-boxes',
            'wc-admin-variation-meta-boxes',
            'wc-admin-coupon-meta-boxes',
            'wc-reports',
            'woocommerce_settings',
            'wc-orders',
            'woocommerce_admin',
            // The Analytics single page app: it must never boot before the
            // bridge that rewrites its REST date ranges.
            'wc-admin-app',
            'wc-analytics',
            'wc-navigation',
            'wc-store-data',
            'wc-tracks',
        ],
        'persca-integrate-woocommerce'
    );
}
add_action('admin_enqueue_scripts', 'persca_wc_add_dependencies', 100);

/* =============================================================================
 * FORM VALIDATION & FORMATTING
 * ========================================================================== */

/**
 * Relax the HTML pattern WooCommerce puts on date inputs so a Jalali value can
 * be typed/pasted without the browser blocking the form.
 *
 * Default pattern: [0-9]{4}-(0[1-9]|1[012])-(0[1-9]|1[0-9]|2[0-9]|3[01])
 *
 * @since 1.4.0
 *
 * @param string $pattern Original pattern.
 * @return string
 */
function persca_wc_date_input_pattern($pattern): string
{
    if (! persca_is_jalali_enabled()) {
        return (string) $pattern;
    }
    return '[0-9\x{06F0}-\x{06F9}]{4}[-\/\.][0-9\x{06F0}-\x{06F9}]{1,2}[-\/\.][0-9\x{06F0}-\x{06F9}]{1,2}';
}
add_filter('woocommerce_date_input_html_pattern', 'persca_wc_date_input_pattern', 20);

/**
 * Jalali friendly date and 24 hour time formats for WooCommerce output.
 *
 * The actual Gregorian -> Jalali conversion is done by the plugin core through
 * the date_i18n / wp_date filters; here we only pick formats that read well in
 * Persian.
 *
 * @since 1.4.0
 */
add_filter('woocommerce_date_format', static function ($format): string {
    if (! persca_is_jalali_enabled()) {
        return (string) $format;
    }
    return 'j F Y';
}, 20);

add_filter('woocommerce_time_format', static function ($format): string {
    if (! persca_is_jalali_enabled()) {
        return (string) $format;
    }
    return 'H:i';
}, 20);

/* =============================================================================
 * DATETIME CONVERSION HELPERS
 * ========================================================================== */

/**
 * Convert Persian/Arabic digits to ASCII digits.
 *
 * @since 1.4.0
 *
 * @param string $value Raw value.
 * @return string
 */
function persca_wc_to_ascii_digits($value): string
{
    return persca_get_converter()->to_ascii_digits((string) $value);
}

/**
 * Convert a single Jalali date string to its Gregorian Y-m-d equivalent.
 *
 * Leaves the value untouched when it is not a Jalali date (already Gregorian,
 * empty, a timestamp, or free text), so nothing else in WooCommerce breaks.
 *
 * @since 1.4.0
 *
 * @param string $value Raw submitted value.
 * @return string
 */
function persca_wc_convert_jalali_string($value): string
{
    if (! is_string($value) || '' === $value) {
        return $value;
    }
    return persca_get_converter()->convert_jalali_string($value);
}

/**
 * Recursively normalise an array of request values.
 *
 * @since 1.4.0
 *
 * @param array      $data  Request slice.
 * @param array|null $keys  Keys that hold date values.
 * @param int        $depth Recursion guard.
 * @return array
 */
function persca_wc_convert_request_array(array $data, ?array $keys = null, int $depth = 0): array
{
    if (null === $keys) {
        $keys = persca_wc_date_request_keys();
    }

    if ($depth > 4) {
        return $data;
    }

    foreach ($data as $key => $value) {
        if (is_array($value)) {
            // Numeric arrays inherit the parent key (access_expires[], variations[]).
            $child_keys = in_array((string) $key, $keys, true) ? array_merge($keys, array_map('strval', array_keys($value))) : $keys;
            $data[$key] = persca_wc_convert_request_array($value, $child_keys, $depth + 1);
            continue;
        }

        if (! is_string($value)) {
            continue;
        }

        $match = in_array((string) $key, $keys, true);

        if (! $match) {
            // Variation fields are posted as variable_sale_price_dates_from[0].
            // Only those indexed WooCommerce fields get prefix matching: a
            // blanket strpos() over every known key also swallowed foreign
            // keys such as afterpay_token, before_tax or start_date_of_x.
            foreach (persca_wc_date_request_prefixes() as $known) {
                if (0 !== strpos((string) $key, $known)) {
                    continue;
                }

                $suffix = substr((string) $key, strlen($known));

                if ('' === $suffix) {
                    continue;
                }

                // Accept variable_sale_price_dates_from[0] and ..._0 only.
                if ('[' === $suffix[0] || ('_' === $suffix[0] && ctype_digit(substr($suffix, 1)))) {
                    $match = true;
                    break;
                }
            }
        }

        if ($match) {
            $data[$key] = persca_wc_convert_jalali_string($value);
        }
    }

    return $data;
}

/**
 * Date-bearing request keys used across WooCommerce.
 *
 * @since 1.4.0
 *
 * @return string[]
 */
function persca_wc_date_request_keys(): array
{
    return [
        // Order screen.
        'order_date',
        // Coupon screen.
        'expiry_date',
        // Download permissions.
        'access_expires',
        // Product sale schedule.
        '_sale_price_dates_from',
        '_sale_price_dates_to',
        // Variation sale schedule.
        'variable_sale_price_dates_from',
        'variable_sale_price_dates_to',
        // Legacy reports custom range.
        'start_date',
        'end_date',
        // Analytics REST / list filters.
        'after',
        'before',
        'date_after',
        'date_before',
        'date_created_after',
        'date_created_before',
        'date_paid_after',
        'date_paid_before',
        'date_completed_after',
        'date_completed_before',
        'date_modified_after',
        'date_modified_before',
        // Subscription / membership style extensions.
        'next_payment_date',
        'trial_end_date',
        'end_date_date',
    ];
}

/**
 * Date keys that may also arrive with an index suffix.
 *
 * @since 1.4.0
 *
 * @return string[]
 */
function persca_wc_date_request_prefixes(): array
{
    return [
        '_sale_price_dates_from',
        '_sale_price_dates_to',
        'variable_sale_price_dates_from',
        'variable_sale_price_dates_to',
        'access_expires',
    ];
}

/**
 * Whether the current request may have its superglobals rewritten.
 *
 * Keys such as after, before, start_date and end_date are far too generic to
 * rewrite on every front-end request: other plugins use the same names, and a
 * silently converted value is close to impossible to debug. Restrict the pass
 * to the surfaces WooCommerce actually reads dates on.
 *
 * @since 1.4.0
 *
 * @return bool
 */
function persca_wc_should_normalize_request(): bool
{
    if (defined('REST_REQUEST') && REST_REQUEST) {
        // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
        $route = isset($_SERVER['REQUEST_URI']) ? (string) wp_unslash($_SERVER['REQUEST_URI']) : '';

        return false !== strpos($route, 'wc-analytics/')
            || false !== strpos($route, 'wc-admin/')
            || false !== strpos($route, '/wc/v');
    }

    if (function_exists('wp_doing_cron') && wp_doing_cron()) {
        return false;
    }

    // admin-ajax.php reports is_admin() === true, which is what we want.
    return is_admin();
}

/* =============================================================================
 * REQUEST NORMALIZATION (Jalali -> Gregorian)
 * ========================================================================== */

/**
 * Normalise every Jalali date in the request back to Gregorian before
 * WooCommerce reads it.
 *
 * @since 1.4.0
 *
 * @return void
 */
function persca_wc_normalize_request(): void
{
    if (! persca_is_jalali_enabled() || ! persca_wc_is_active() || ! persca_wc_should_normalize_request()) {
        return;
    }

    $keys = persca_wc_date_request_keys();
    $time_keys = [
        'order_date_hour',
        'order_date_minute',
        'order_date_second',
        '_sale_price_times_from',
        '_sale_price_times_to',
        'variable_sale_price_times_from',
        'variable_sale_price_times_to',
    ];

    // phpcs:disable WordPress.Security.NonceVerification
    if (! empty($_GET) && is_array($_GET)) {
        $_GET = persca_wc_convert_request_array($_GET, $keys);
        foreach ($time_keys as $tkey) {
            if (isset($_GET[$tkey]) && is_string($_GET[$tkey])) {
                $_GET[$tkey] = persca_wc_to_ascii_digits($_GET[$tkey]);
            }
        }
    }

    if (! empty($_POST) && is_array($_POST)) {
        $_POST = persca_wc_convert_request_array($_POST, $keys);
        foreach ($time_keys as $tkey) {
            if (isset($_POST[$tkey]) && is_string($_POST[$tkey])) {
                $_POST[$tkey] = persca_wc_to_ascii_digits($_POST[$tkey]);
            }
        }
    }

    if (! empty($_REQUEST) && is_array($_REQUEST)) {
        $_REQUEST = persca_wc_convert_request_array($_REQUEST, $keys);
        foreach ($time_keys as $tkey) {
            if (isset($_REQUEST[$tkey]) && is_string($_REQUEST[$tkey])) {
                $_REQUEST[$tkey] = persca_wc_to_ascii_digits($_REQUEST[$tkey]);
            }
        }
    }
    // phpcs:enable WordPress.Security.NonceVerification
}
// admin_init fires after init, so one hook already covers the admin.
add_action('init', 'persca_wc_normalize_request', 0);

/* =============================================================================
 * REST API NORMALIZATION
 * ========================================================================== */

/**
 * Keep the WooCommerce Analytics REST layer on Gregorian input.
 *
 * The Analytics screens are React based and send ISO strings; if a Jalali value
 * ever reaches the REST layer (deep link, bookmark, manual URL) it is converted
 * here rather than being rejected.
 *
 * @since 1.4.0
 *
 * @param mixed           $result  Current short-circuit value.
 * @param mixed           $server  REST server.
 * @param WP_REST_Request $request Incoming request.
 * @return mixed
 */
function persca_wc_rest_normalize($result, $server, $request)
{
    if (! persca_is_jalali_enabled() || ! persca_wc_is_active() || ! is_object($request) || ! method_exists($request, 'get_route')) {
        return $result;
    }

    $route = (string) $request->get_route();

    if (false === strpos($route, '/wc-analytics/') && false === strpos($route, '/wc/')) {
        return $result;
    }

    foreach (persca_wc_date_request_keys() as $key) {
        $value = $request->get_param($key);

        if (is_string($value) && '' !== $value) {
            $request->set_param($key, persca_wc_convert_jalali_string($value));
        }
    }

    return $result;
}
add_filter('rest_pre_dispatch', 'persca_wc_rest_normalize', 5, 3);
