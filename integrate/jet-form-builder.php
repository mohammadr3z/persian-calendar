<?php
/**
 * JetFormBuilder Integration for Persian Calendar
 */

if (!defined('ABSPATH')) {
    exit;
}

/* =============================================================================
 * ASSETS & DEPENDENCIES
 * ========================================================================== */

add_action('admin_enqueue_scripts', 'persca_jet_form_builder_enqueue_assets', 20);
add_action('wp_enqueue_scripts', 'persca_jet_form_builder_enqueue_assets', 20);

// Modify dependencies to ensure integrate-jet-form-builder.js loads AFTER JetFormBuilder's frontend script
add_action('wp_default_scripts', 'persca_jet_form_builder_add_dependencies', 100);
add_action('admin_enqueue_scripts', 'persca_jet_form_builder_add_dependencies', 100);
add_action('wp_enqueue_scripts', 'persca_jet_form_builder_add_dependencies', 100);


function persca_jet_form_builder_enqueue_assets() {
    if (!persca_is_jalali_enabled() || !function_exists('jet_form_builder')) {
        return;
    }

    // Shared Jalali core script + popup styles.
    persca_enqueue_core_assets();

    // Enqueue JetFormBuilder integration overrides script
    wp_enqueue_script(
        'persca-integrate-jet-form-builder',
        PERSCA_PLUGIN_URL . 'assets/js/integrate-jet-form-builder.js',
        array('jquery', 'persian-calendar-main'),
        PERSCA_PLUGIN_VERSION,
        true
    );
}

function persca_jet_form_builder_add_dependencies() {
    if (!persca_is_jalali_enabled()) {
        return;
    }

    persca_inject_dependency(array(
        'jet-form-builder-frontend-forms',
        'jfb-records',
        'jfb-records-single',
        'jfb-payments',
        'jfb-payment',
    ), 'persca-integrate-jet-form-builder');
}
