<?php
/**
 * Plugin Name: Persian Calendar
 * Description: شمسی‌سازی کامل تاریخ‌های وردپرس با تقویم گوتنبرگ، تبدیل اعداد فارسی، پشتیبانی از منطقه‌زمانی ایران، شروع هفته از شنبه و رابط کاربری فارسی.
 * Version: 1.1.0
 * Author: mohammadr3z
 * Author URI: 
 * Text Domain: persian-calendar
 * License: GPL2
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly.
}

// Define plugin constants.
define( 'PC_PLUGIN_VERSION', '1.1.0' );
define( 'PC_PLUGIN_FILE', __FILE__ );
define( 'PC_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'PC_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

// Load required class files.
require_once PC_PLUGIN_DIR . 'includes/class-pc-date-converter.php';
require_once PC_PLUGIN_DIR . 'includes/class-pc-plugin.php';
require_once PC_PLUGIN_DIR . 'includes/class-pc-admin.php';
require_once PC_PLUGIN_DIR . 'includes/class-pc-permalink.php';
require_once PC_PLUGIN_DIR . 'includes/class-pc-edd-compatibility.php';

// Register WordPress activation and deactivation hooks.
PC_Plugin::register_hooks( __FILE__ );

// Initialize plugin when WordPress is fully loaded.
add_action( 'plugins_loaded', [ 'PC_Plugin', 'bootstrap' ] );

