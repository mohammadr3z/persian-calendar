<?php
/**
 * Plugin Name: Persian Calendar
 * Description: Complete Persian/Jalali calendar conversion for WordPress with Gutenberg calendar, Persian digits conversion, Iran timezone support, Saturday week start, and Persian UI.
 * Version: 1.1.4
 * Author: mohammadr3z
 * Author URI: 
 * License: GPL2
 * Text Domain: persian-calendar
 * Domain Path: /languages
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly.
}

// Define plugin constants.
define( 'PERSCA_PLUGIN_VERSION', '1.1.4' );
define( 'PERSCA_PLUGIN_FILE', __FILE__ );
define( 'PERSCA_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'PERSCA_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

// Load required class files.
require_once PERSCA_PLUGIN_DIR . 'includes/class-persca-date-converter.php';
require_once PERSCA_PLUGIN_DIR . 'includes/class-persca-plugin.php';
require_once PERSCA_PLUGIN_DIR . 'includes/class-persca-admin.php';


// Register WordPress activation and deactivation hooks.
PERSCA_Plugin::register_hooks( __FILE__ );

// Initialize plugin when WordPress is fully loaded.
add_action( 'plugins_loaded', [ 'PERSCA_Plugin', 'bootstrap' ] );

