<?php

/**
 * Plugin Name: Persian Calendar
 * Description: Convert WordPress dates to Jalali calendar with Gutenberg support and Persian digits.
 * Version: 1.3.5
 * Author: mohammadr3z
 * Author URI: 
 * License: GPL2
 * Text Domain: persian-calendar
 */

if (! defined('ABSPATH')) {
    exit; // Exit if accessed directly.
}

// Define plugin constants.
define('PERSCA_PLUGIN_VERSION', '1.3.5');
define('PERSCA_PLUGIN_FILE', __FILE__);
define('PERSCA_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('PERSCA_PLUGIN_URL', plugin_dir_url(__FILE__));

// Load required class files.
require_once PERSCA_PLUGIN_DIR . 'includes/class-persca-date-converter.php';
require_once PERSCA_PLUGIN_DIR . 'includes/class-persca-plugin.php';
require_once PERSCA_PLUGIN_DIR . 'includes/class-persca-admin.php';


// Register WordPress activation and deactivation hooks.
PERSCA_Plugin::register_hooks(__FILE__);

// Initialize plugin on 'init' hook (after locale/RTL is determined).
add_action('init', ['PERSCA_Plugin', 'bootstrap']);
