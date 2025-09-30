<?php
/**
 * Plugin Name: Persian Calendar
 * Description: Convert WordPress dates to Jalali calendar with Gutenberg support and Persian digits.
 * Version: 1.1.6
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
define( 'PERSCA_PLUGIN_VERSION', '1.1.6' );
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

