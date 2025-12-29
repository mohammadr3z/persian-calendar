=== تقویم فارسی - Persian Calendar ===
Contributors: mohammadr3z
Tags: شمسی, Jalali, Calendar, Shamsi, Gutenberg
Requires at least: 5.4
Tested up to: 6.9
Requires PHP: 7.2
Stable tag: 1.2.5.2
License: GPL2
License URI: http://www.gnu.org/licenses/gpl-2.0.html

Convert WordPress dates to Jalali calendar with Gutenberg support and Persian digits.

== Description ==

This plugin converts your WordPress to the Jalali (Persian) calendar system. All dates are converted to Jalali format with Persian digits and Iran timezone support.

**Features:**

*   **Jalali Calendar:** Convert all WordPress dates to Jalali (Persian) dates
*   **Gutenberg Calendar:** Jalali calendar in block editor
*   **Persian Digits:** Convert English digits to Persian
*   **Iran Timezone:** Tehran timezone support
*   **Week Start:** Week starts on Saturday
*   **Persian Font:** Persian font for WordPress admin

== Installation ==

1. Go to "Plugins" > "Add New" in WordPress admin
2. Search for "Persian Calendar"
3. Click "Install" and then "Activate"
4. Go to "Settings" > "Persian Calendar" to configure options

== Frequently Asked Questions ==

= Is this plugin compatible with all themes? =
Yes, this plugin works with all WordPress themes.

= Can I enable only some features? =
Yes, you can enable or disable each feature separately in settings.

= Does this affect site speed? =
No, the plugin is optimized and has minimal impact on performance.

== Screenshots ==

1. Plugin settings page
2. Jalali calendar in Gutenberg editor
3. Persian dates in dashboard
4. Persian digit conversion

== Changelog ==

= 1.2.5 =
* Fixed calendar weekday calculation inconsistency between mobile and desktop devices
* Used UTC-based date calculation for consistent weekday display across all timezones
* Optimized Gutenberg calendar assets: now only load in block editor, not on frontend
* Fixed hour/minute field order in inline edit timestamp for proper RTL display

= 1.2.4 =
* Fixed Gutenberg calendar date calculation bug
* Fixed Persian ordinal suffix: now shows "ام" instead of English "th/st/nd/rd" in date formats
* Fixed admin posts filter to properly filter by Jalali month instead of Gregorian
* Fixed Media Library grid view filter to properly filter by Jalali month
* Improved Gutenberg calendar styles
* Improved code security and added caching for better performance

= 1.2.3.1 =
* Fixed get_post_time filter breaking dashboard when timestamp format is requested

= 1.2.3 =
* Extended Jalali support: relative time, comments, post dates, admin date filter dropdown
* Fixed timezone handling for correct time display
* Fixed weekday calculation in Gutenberg calendar grid
* Added year display to Gutenberg schedule button
* Removed Classic Editor feature
* Improved settings independence

= 1.2.2 =
* Improvement: Avoid conflicts with certain Gutenberg components — the plugin now enables the classic editor for posts only (using the `use_block_editor_for_post` filter) and leaves other Gutenberg functionality unchanged.

= 1.2.0 =
* Added option to completely disable Gutenberg block editor and activate classic editor.

= 1.1.6 =
* Improved texts for consistency

= 1.1.5 =
* Latest stable version with all features

= 1.1.3 =
* Removed Jalali permalink feature for simplification

= 1.1.1 =
* Security and performance improvements
* Code optimization

= 1.1.0 =
* Added Gutenberg editor support
* Improved settings interface
* Added Persian digit conversion

= 1.0.0 =
* Initial release
* Complete Jalali date conversion
* Iran timezone support

== License ==

This plugin is released under the GPL2 license.
