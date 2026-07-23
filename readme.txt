=== تقویم فارسی - Persian Calendar ===
Contributors: mohammadr3z
Tags: شمسی, Jalali, Calendar, Shamsi, Gutenberg
Requires at least: 5.4
Tested up to: 7.0
Requires PHP: 7.2
Stable tag: 1.3.5
License: GPL2
License URI: http://www.gnu.org/licenses/gpl-2.0.html

Convert WordPress dates to Jalali calendar with Gutenberg support, Persian digits, and 3rd-party plugin integrations.

== Description ==

This plugin converts your WordPress website to the Jalali (Persian) calendar system. All dates are converted to Jalali format with Persian digits and Iran timezone support.

== Features ==

*   **Jalali Calendar:** Convert all WordPress dates to Jalali (Persian) dates.
*   **Gutenberg Calendar:** Seamless Jalali calendar integration inside the Gutenberg block editor.
*   **Persian Digits:** Convert English digits to Persian (Farsi) numerals.
*   **Iran Timezone:** Native support for Tehran timezone settings.
*   **Week Start:** Option to set Saturday as the first day of the week.
*   **Persian Font:** Beautiful, readable Persian typography for the WordPress dashboard.

== Integrations ==

This plugin features deep integration with Crocoblock JetPlugins to provide full Jalali calendar support:

*   **JetEngine Integration:** 
    *   Adds Jalali date picker support for JetEngine Meta Fields (Date, Datetime-local, Time).
    *   Full compatibility with JetEngine Custom Post Types (CPT).
    *   Enables Jalali calendar in JetEngine Custom Content Types (CCT) listing and editing panels.
*   **JetFormBuilder Integration:** 
    *   Enables Jalali calendar date pickers inside frontend form fields.
    *   Compatible with JetFormBuilder Date and Datetime field types.
*   **JetSmartFilters Integration:** 
    *   Enables Jalali calendar date pickers inside frontend date period filters.
*   **JetBooking Integration:** 
    *   Full Jalali date range picker support on frontend booking forms.
    *   Jalali calendar conversion in backend booking calendars, timelines, and booking details fields.
*   **Easy Digital Downloads (EDD) Integration:**
    *   Replaces every EDD jQuery UI date picker (`edd_datepicker`) with a Jalali (Shamsi) date picker: discount start/expiration dates, order date, customer "Date Created", the reports custom range, list-table date filters, and all CSV exporter From/To ranges.
    *   Submitted Jalali dates are converted back to Gregorian automatically, so EDD keeps storing and querying native Gregorian dates (the database is never modified).
    *   Localizes the Gregorian dates printed across EDD admin screens to the Jalali calendar, with optional Persian digits.

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

= 1.3.5 =
* Added Easy Digital Downloads (EDD) Integration: Jalali calendar and date picker support for EDD admin screens, discount codes, reports, date filters
* Bug Fix: Post publish time could show another post's date in widgets/loops outside the main query — removed the buggy get_post_time filter; date/time now resolve through the correct post via date_i18n/wp_date.
* Improvement: Integrations (JetEngine, JetSmartFilters, EDD) now reuse a single shared date-converter instance instead of creating a new one per value


= 1.3.4 =
* Added JetSmartFilters Integration: Support for frontend date period filters
* Bug Fix: Fixed JetEngine CPT/CCT fields Jalali conversion on frontend and AJAX listings
* Bug Fix: Fixed Esfand (month 12) validation check in JS date converter for leap years
* Bug Fix: Fixed admin panel classic/quick edit date validation checks
* Bug Fix: Fixed validation checks for JetEngine datetime meta fields
* Bug Fix: Fixed validation checks for invalid JetSmartFilters date inputs
* Bug Fix: Fixed JetSmartFilters date period navigation and period-shifting arithmetic
* Bug Fix: Fixed calendar popup event bubbling closing Elementor and JetPopup modals
* Bug Fix: Fixed cloned date inputs Jalali formatting inside Elementor popups

= 1.3.3 =
* Added JetBooking Integration: Full Jalali calendar support for JetBooking plugin including backend timeline, booking forms, and frontend date-range pickers
* Security: Fixed DOM XSS vulnerability by replacing HTML output methods with safe text rendering in administration scripts
* Performance: Fixed potential memory leaks and CPU usage loops by adding safety limits to polling intervals and Gutenberg dependency loading checks
* Usability: Fixed date input fields issue where clearing inputs with Backspace/Delete keys would immediately force fallback values, ensuring smooth keyboard input
* Bug Fix: Fixed a potential ReferenceError in JetEngine integration script when setting date values programmatically via datepicker method calls
* Bug Fix: Fixed a potential date rendering issue in JetBooking integration where dates could render as 0/00/00 if dependencies failed to load or loaded slowly
* Bug Fix: Fixed date parsing issue in integrations when running JetEngine in Unix timestamp mode or when hidden fields contain Persian digits, ensuring proper conversion instead of showing 0/00/00
* Optimized for performance and compatibility

= 1.3.2 =
* Added JetFormBuilder Integration: Jalali calendar and date picker support for JetFormBuilder date and datetime fields on the frontend

= 1.3.1 =
* Fixed a critical issue where JetEngine integration caused Elementor page styles and system settings to not load properly by correctly ignoring system meta keys

= 1.3.0 =
* Added JetEngine Integration: Jalali calendar and date picker support for JetEngine meta-box date fields in admin, frontend, and Elementor editor
* Improved dashboard font loading with smarter icon exclusion and RTL language detection

= 1.2.6 =
* Added compatibility with WordPress 7.0
* Updated Gutenberg calendar theme styles and color schemes to match WordPress 7.0 admin theme colors (#3858e9)

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
