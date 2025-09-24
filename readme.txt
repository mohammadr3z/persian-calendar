=== تقویم فارسی - Persian Calendar ===
Contributors: mohammadr3z
Tags: شمسی, Jalali, Calendar, Shamsi, Gutenberg
Requires at least: 5.4
Tested up to: 6.8
Requires PHP: 7.2
Stable tag: 1.1.4
License: GPL2
License URI: http://www.gnu.org/licenses/gpl-2.0.html

Complete conversion of WordPress dates to Jalali with Gutenberg support, Persian digits, and Iran timezone.

== Description ==

This powerful plugin completely converts your WordPress to the Jalali (Persian) calendar system. After installation, all Gregorian dates are converted to Jalali dates. The default Gutenberg calendar is replaced with a practical Jalali calendar, and English digits are automatically converted to Persian. With full support for Iran timezone (Tehran) and the ability to start the week from Saturday, this plugin provides a completely localized experience for you and your site visitors.

**Key Features:**

*   **Complete Jalali Conversion:** Convert all Gregorian dates in WordPress to Jalali (Persian) dates
*   **Gutenberg Jalali Calendar:** Replace the default Gutenberg date picker with a practical Jalali calendar
*   **Persian Digit Conversion:** Automatic conversion of English digits to Persian throughout the website
*   **Iran Timezone Support:** Setup and synchronization with Tehran timezone
*   **Week Starts on Saturday:** Ability to set the week to start on Saturday
*   **Persian Font for Dashboard:** Apply Persian font to improve readability in WordPress admin
*   **Quick Date Editing:** Ability to quickly edit dates in the posts list page
*   **Performance Optimization:** Optimized and lightweight coding for minimal impact on site speed

**Advanced Features:**

*   **Full Gutenberg Compatibility:** Integrated Jalali calendar in the block editor
*   **Configurable Settings:** Ability to enable/disable each feature separately
*   **Theme Support:** Compatibility with all WordPress themes
*   **Persian User Interface:** Fully Persianized admin interface
*   **Settings Backup:** Preserve settings after plugin deactivation

== Installation ==

**Automatic Installation:**
1. From WordPress admin, go to "Plugins" > "Add New"
2. Search for "Persian Calendar"
3. Click "Install" and then select "Activate"
4. Go to plugin settings and enable the desired options

**Manual Installation:**
1. Upload plugin files to the `wp-content/plugins/persian-calendar/` folder
2. Activate the plugin through the WordPress admin panel
3. Go to "Settings" > "Persian Calendar"
4. Enable the options you need

**Post-Installation Settings:**
1. **Enable Jalali Calendar:** To convert all dates to Jalali
2. **Persian Digits:** To convert English digits to Persian
3. **Regional Settings:** To set Iran timezone and start week from Saturday
4. **Dashboard Font:** To improve Persian text display in admin
5. **Gutenberg Calendar:** To replace default calendar with Jalali version

== Frequently Asked Questions ==

= Is this plugin compatible with all themes? =
Yes, this plugin is compatible with all WordPress themes and uses WordPress standard functions for date conversion.

= Can I enable only some of the features? =
Yes, all features are configurable and you can enable or disable each one separately.

= Are settings preserved after plugin deactivation? =
Yes, all your settings are preserved after plugin deactivation and will be restored when reactivated.

= Does this plugin affect site speed? =
No, this plugin is designed with optimized code and has minimal impact on site speed.

= Is the classic editor supported? =
Yes, the plugin supports both classic and Gutenberg editors.

== Screenshots ==

1. Plugin settings page with various options
2. Jalali calendar in Gutenberg editor
3. Persian dates display in dashboard
4. English to Persian digit conversion

== Changelog ==

= 1.1.3 =
* Complete removal of Jalali permalink feature for plugin simplification

= 1.1.1 =
* Security improvement: Added user permission checks in `sanitize_options` and `checkbox_field` methods in `class-persca-admin.php`
* Performance improvement: Code optimization to reduce server load and increase speed
* Security improvement: Confirmed proper use of escape functions in PHP files
* Security improvement: Confirmed use of safe JavaScript methods and absence of dangerous patterns like `innerHTML` or `eval()`
* Performance improvement: PHP code review and optimization to identify bottlenecks
* Performance improvement: JavaScript file analysis and optimization to reduce size and improve efficiency
* Performance improvement: CSS file review and optimization to remove extra code and improve loading speed
* Performance improvement: Cache and database query usage review to reduce server load

= 1.1.0 =
* Added full Gutenberg editor support
* Improved settings user interface
* Added Persian digit conversion feature
* Improved compatibility with new WordPress versions

= 1.0.0 =
* Initial plugin release
* Complete date conversion to Jalali
* Iran timezone support
* Week starts from Saturday
* Persian font for dashboard

== Upgrade Notice ==

To upgrade to the new version, simply update through the "Updates" section in WordPress admin panel. All your settings will be preserved.

== Support ==

For support or bug reports, you can contact us through the plugin page in the WordPress repository.

== License ==

This plugin is released under the GPL2 license. For more information, visit http://www.gnu.org/licenses/gpl-2.0.html
