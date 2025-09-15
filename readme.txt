=== Persian Calendar ===
Contributors: mohammadr3z
Tags: Persian, Jalali, Calendar, WordPress, Gutenberg
Requires at least: 5.4
Tested up to: 6.8
Requires PHP: 7.2
Stable tag: 1.1.0
License: GPL2
License URI: http://www.gnu.org/licenses/gpl-2.0.html

A complete Jalali (Persian) calendar integration for WordPress with Gutenberg calendar support, Persian number conversion, Iran timezone support, week starting from Saturday, and full Persian UI.

== Description ==

This powerful plugin fully converts your WordPress to the Jalali (Persian) calendar system. Once installed, all Gregorian dates are converted to Jalali dates. The default Gutenberg calendar is replaced with a practical Jalali calendar, and English numbers are automatically converted to Persian. With full support for the Iran (Tehran) timezone and the ability to start the week on Saturday, this plugin delivers a fully localized Persian experience for both you and your site visitors.

**Key Features:**
*   **Full Jalali Conversion:** Convert all Gregorian dates in WordPress to Jalali (Persian) dates.
*   **Gutenberg Jalali Calendar:** Replace the default Gutenberg date picker with a practical Jalali calendar.
*   **Persian Number Conversion:** Automatically convert English digits to Persian across the entire website.
*   **Iran Timezone Support:** Adjust and synchronize with Tehran timezone.
*   **Week Start on Saturday:** Option to set the week start from Saturday.
*   **Persian Font for Dashboard:** Apply a Persian font to improve readability in the WordPress admin area.

== Installation ==

1.  Upload the plugin files to the `wp-content/plugins/persian-calendar/` directory.
2.  Activate the plugin through the WordPress admin panel.
3.  Go to the plugin settings and enable the options you need.

== Frequently Asked Questions ==

(Currently, no FAQs are available.)

== Screenshots ==

(Currently, no screenshots are available.)

== Changelog ==

= 1.1.0 =
* بهبود امنیت: افزودن بررسی‌های مجوز کاربر به متدهای `sanitize_options` و `checkbox_field` در `class-pc-admin.php`.
* بهبود امنیت: پیاده‌سازی هدرهای امنیتی CSP و سایر هدرها از طریق متد `add_security_headers` در `class-pc-plugin.php` برای جلوگیری از حملات XSS.
* بهبود امنیت: تأیید استفاده صحیح از توابع escaping در فایل‌های PHP.
* بهبود امنیت: تأیید استفاده از متدهای امن JavaScript و عدم وجود الگوهای پرخطر مانند `innerHTML` یا `eval()`.
* بهبود عملکرد: بررسی و بهینه‌سازی کد PHP برای شناسایی bottleneckها.
* بهبود عملکرد: تحلیل و بهینه‌سازی فایل‌های JavaScript برای کاهش حجم و بهبود کارایی.
* بهبود عملکرد: بررسی و بهینه‌سازی فایل‌های CSS برای حذف کدهای اضافی و بهبود سرعت بارگذاری.
* بهبود عملکرد: بررسی استفاده از caching و database queries برای کاهش بار سرور.

= 1.0.0 =
* Initial release of the plugin.
