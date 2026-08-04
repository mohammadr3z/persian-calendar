<?php

/**
 * Persian Calendar Date Converter Class
 * 
 * Provides comprehensive Jalali (Persian) and Gregorian calendar conversion
 * utilities with formatting capabilities. This class is lightweight and has
 * no external dependencies.
 * 
 * @package PersianCalendar
 * @since 1.0.0
 */

if (! defined('ABSPATH')) {
    exit;
}

class PERSCA_Date_Converter
{
    /**
     * Tehran timezone instance (cached).
     * 
     * @var \DateTimeZone|null
     */
    private static $tehran_tz = null;

    /**
     * Persian month names in full format.
     * 
     * @var string[] Array of Persian month names indexed by month number (1-12).
     */
    private $months_fa = [
        1 => 'فروردین',
        2 => 'اردیبهشت',
        3 => 'خرداد',
        4 => 'تیر',
        5 => 'مرداد',
        6 => 'شهریور',
        7 => 'مهر',
        8 => 'آبان',
        9 => 'آذر',
        10 => 'دی',
        11 => 'بهمن',
        12 => 'اسفند',
    ];

    /**
     * Persian weekday names in full format.
     * 
     * @var string[] Array indexed by PHP's date('w') values (0=Sunday, 6=Saturday).
     */
    private $weekdays_fa = [
        6 => 'شنبه',     // Saturday (Persian week starts here)
        0 => 'یکشنبه',   // Sunday
        1 => 'دوشنبه',   // Monday
        2 => 'سه‌شنبه',   // Tuesday
        3 => 'چهارشنبه', // Wednesday
        4 => 'پنجشنبه',  // Thursday
        5 => 'جمعه',     // Friday
    ];

    /**
     * Persian weekday names in abbreviated format.
     * 
     * @var string[] Array of single-character Persian weekday abbreviations.
     */
    private $weekdays_fa_short = [
        6 => 'ش',
        0 => 'ی',
        1 => 'د',
        2 => 'س',
        3 => 'چ',
        4 => 'پ',
        5 => 'ج'
    ];

    /* =========================================================================
     * CORE HELPER FUNCTIONS
     * =========================================================================
     * 
     * These are the primary functions for date/time handling in this plugin.
     * Always use these functions instead of creating DateTime objects directly.
     * 
     * - get_tehran_tz()        : Get cached Tehran timezone instance
     * - get_tehran_datetime()  : Create DateTime in Tehran timezone
     * - format_date()          : Format date to Jalali with Tehran timezone
     * ========================================================================= */

    /**
     * Get Tehran timezone instance (cached).
     * 
     * Returns a cached DateTimeZone object for 'Asia/Tehran' to avoid
     * creating multiple instances throughout the plugin lifecycle.
     * 
     * @since 1.2.3
     * @return \DateTimeZone Tehran timezone instance.
     */
    public static function get_tehran_tz(): \DateTimeZone
    {
        if (self::$tehran_tz === null) {
            self::$tehran_tz = new \DateTimeZone('Asia/Tehran');
        }
        return self::$tehran_tz;
    }

    /**
     * Get Persian month name.
     * 
     * Returns the full Persian name for a given Jalali month number.
     * 
     * @since 1.2.3
     * 
     * @param int $month Jalali month number (1-12).
     * @return string Persian month name.
     */
    public function get_persian_month_name(int $month): string
    {
        return $this->months_fa[$month] ?? '';
    }

    /**
     * Get DateTime object in Tehran timezone.
     * 
     * This is the primary method for creating DateTime objects in this plugin.
     * It ensures all dates are correctly set to the Tehran timezone,
     * handling various input types consistently.
     * 
     * @since 1.2.3
     * 
     * @param mixed $input Optional. Date input. Can be:
     *                     - null     : Returns current Tehran time.
     *                     - int      : Unix timestamp.
     *                     - string   : Date string (interpreted as Tehran time if no TZ info).
     *                     - DateTime : Will be cloned and converted to Tehran time.
     *                     Default null.
     * @return \DateTime DateTime object in Tehran timezone.
     */
    public function get_tehran_datetime($input = null, ?\DateTimeZone $timezone = null): \DateTime
    {
        // No explicit zone keeps the historical Tehran behaviour, so existing
        // callers are unaffected. wp_date() passes the caller's zone through.
        $tz = $timezone instanceof \DateTimeZone ? $timezone : self::get_tehran_tz();

        if ($input === null) {
            // Current time in Tehran
            return new \DateTime('now', $tz);
        }

        if ($input instanceof \DateTime) {
            // Clone and convert to Tehran
            $dt = clone $input;
            $dt->setTimezone($tz);
            return $dt;
        }

        if (is_numeric($input)) {
            // Unix timestamp - create from UTC and convert to Tehran
            $dt = new \DateTime('@' . (int)$input);
            $dt->setTimezone($tz);
            return $dt;
        }

        if (is_string($input)) {
            // Date string - interpret as Tehran time directly
            // This is crucial: WordPress stores dates in local time
            try {
                return new \DateTime($input, $tz);
            } catch (\Exception $e) {
                // Fallback to current time
                return new \DateTime('now', $tz);
            }
        }

        // Fallback
        return new \DateTime('now', $tz);
    }

    /**
     * Format date/time to Jalali with Tehran timezone.
     * 
     * This is the main entry point for all Jalali date formatting in this plugin.
     * It converts the input to Tehran timezone, then formats using Persian
     * month names and weekday names.
     * 
     * @since 1.2.3
     * 
     * @param string $format         PHP date format string.
     * @param mixed  $input          Optional. Date input (see get_tehran_datetime).
     *                               Default null (current time).
     * @param bool   $persian_digits Optional. Whether to convert output to Persian digits.
     *                               Default false.
     * @return string Formatted Jalali date string.
     */
    public function format_date(string $format, $input = null, bool $persian_digits = false, ?\DateTimeZone $timezone = null): string
    {
        $dt = $this->get_tehran_datetime($input, $timezone);

        // Get Gregorian components from DateTime (already in Tehran time)
        $gy = (int) $dt->format('Y');
        $gm = (int) $dt->format('n');
        $gd = (int) $dt->format('j');
        $w  = (int) $dt->format('w');

        // Convert to Jalali
        $j = $this->gregorian_to_jalali($gy, $gm, $gd);
        $jy = $j['y'];
        $jm = $j['m'];
        $jd = $j['d'];

        // Format output
        $out = '';
        $len = strlen($format);
        for ($i = 0; $i < $len; $i++) {
            $ch = $format[$i];
            if ($ch === '\\') {
                $i++;
                $out .= ($i < $len) ? $format[$i] : '';
                continue;
            }
            switch ($ch) {
                // Year
                case 'Y':
                    $out .= sprintf('%04d', $jy);
                    break;
                case 'y':
                    $out .= substr(sprintf('%04d', $jy), -2);
                    break;
                case 'L':
                    $out .= 30 === $this->days_in_jalali_month($jy, 12) ? '1' : '0';
                    break;
                // Month
                case 'm':
                    $out .= sprintf('%02d', $jm);
                    break;
                case 'n':
                    $out .= (string) $jm;
                    break;
                case 'F':
                    $out .= $this->months_fa[$jm];
                    break;
                case 'M':
                    $out .= $this->months_fa[$jm];
                    break;
                case 't':
                    $out .= (string) $this->days_in_jalali_month($jy, $jm);
                    break;
                // Day
                case 'd':
                    $out .= sprintf('%02d', $jd);
                    break;
                case 'j':
                    $out .= (string) $jd;
                    break;
                case 'z':
                    $day_of_year = $jd - 1;
                    for ($m = 1; $m < $jm; $m++) {
                        $day_of_year += $this->days_in_jalali_month($jy, $m);
                    }
                    $out .= (string) $day_of_year;
                    break;
                // Weekday
                case 'l':
                    $out .= $this->weekdays_fa[$w];
                    break;
                case 'D':
                    $out .= $this->weekdays_fa_short[$w];
                    break;
                case 'w':
                    $out .= (string) $w;
                    break;
                case 'N':
                    $out .= (string) ($w === 0 ? 7 : $w);
                    break;
                // Ordinal suffix - Persian equivalent of st, nd, rd, th
                case 'S':
                    $out .= 'ام';
                    break;
                // Time - directly from DateTime (Tehran time)
                case 'H':
                case 'G':
                case 'i':
                case 's':
                    $out .= $dt->format($ch);
                    break;
                case 'h':
                    $out .= $dt->format('h');
                    break;
                case 'g':
                    $out .= $dt->format('g');
                    break;
                // Persian has no upper/lower case distinction for the meridiem.
                case 'a':
                    $out .= 'am' === $dt->format('a') ? 'ق.ظ' : 'ب.ظ';
                    break;
                case 'A':
                    $out .= 'AM' === $dt->format('A') ? 'ق.ظ' : 'ب.ظ';
                    break;
                // Others
                default:
                    $out .= $dt->format($ch);
                    break;
            }
        }

        $out = trim(preg_replace('/\s{2,}/u', ' ', $out));
        return $persian_digits ? $this->to_persian_digits($out) : $out;
    }

    /**
     * Convert Gregorian date to Jalali (Persian) date.
     * 
     * Uses the standard algorithm for Gregorian to Jalali conversion
     * with accurate leap year calculations.
     * 
     * @param int $gy Gregorian year.
     * @param int $gm Gregorian month (1-12).
     * @param int $gd Gregorian day (1-31).
     * @return array{y:int,m:int,d:int} Array with 'y', 'm', 'd' keys for Jalali date.
     */
    public function gregorian_to_jalali(int $gy, int $gm, int $gd): array
    {
        $g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
        $gy2 = ($gm > 2) ? ($gy + 1) : $gy;
        $days = 355666 + (365 * $gy) + intdiv($gy2 + 3, 4) - intdiv($gy2 + 99, 100) + intdiv($gy2 + 399, 400) + $gd + $g_d_m[$gm - 1];
        $jy = -1595 + (33 * intdiv($days, 12053));
        $days %= 12053;
        $jy += 4 * intdiv($days, 1461);
        $days %= 1461;
        if ($days > 365) {
            $jy += intdiv($days - 1, 365);
            $days = ($days - 1) % 365;
        }
        if ($days < 186) {
            $jm = 1 + intdiv($days, 31);
            $jd = 1 + ($days % 31);
        } else {
            $jm = 7 + intdiv($days - 186, 30);
            $jd = 1 + (($days - 186) % 30);
        }
        return ['y' => $jy, 'm' => $jm, 'd' => $jd];
    }

    /**
     * Convert Jalali (Persian) date to Gregorian date.
     * 
     * Performs the reverse conversion from Jalali to Gregorian calendar
     * using precise mathematical algorithms.
     * 
     * @param int $jy Jalali year.
     * @param int $jm Jalali month (1-12).
     * @param int $jd Jalali day (1-31).
     * @return array{y:int,m:int,d:int} Array with 'y', 'm', 'd' keys for Gregorian date.
     */
    public function jalali_to_gregorian(int $jy, int $jm, int $jd): array
    {
        $jy += 1595;
        $days = -355668 + (365 * $jy) + intdiv($jy, 33) * 8 + intdiv(($jy % 33) + 3, 4) + $jd + (($jm < 7) ? ($jm - 1) * 31 : (($jm - 7) * 30) + 186);
        $gy = 400 * intdiv($days, 146097);
        $days %= 146097;
        if ($days > 36524) {
            $gy += 100 * intdiv(--$days, 36524);
            $days %= 36524;
            if ($days >= 365) {
                $days++;
            }
        }
        $gy += 4 * intdiv($days, 1461);
        $days %= 1461;
        if ($days > 365) {
            $gy += intdiv($days - 1, 365);
            $days = ($days - 1) % 365;
        }
        $gd = $days + 1;
        $sal_a = [0, 31, (($gy % 4 == 0 && $gy % 100 != 0) || ($gy % 400 == 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        for ($gm = 1; $gm <= 12 && $gd > $sal_a[$gm]; $gm++) {
            $gd -= $sal_a[$gm];
        }
        return ['y' => $gy, 'm' => $gm, 'd' => $gd];
    }

    /**
     * Convert ASCII digits (0-9) to Persian/Farsi digits (۰-۹).
     * 
     * Replaces all Latin numerals in the input string with their
     * Persian equivalents for localized display.
     * 
     * @param string $input String containing ASCII digits to convert.
     * @return string String with Persian digits replacing ASCII digits.
     */
    public function to_persian_digits(string $input): string
    {
        $en = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
        $fa = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
        return str_replace($en, $fa, $input);
    }

    /**
     * Convert Persian and Arabic-Indic digits to ASCII digits.
     *
     * Replaces all Persian (۰-۹) and Arabic-Indic (٠-٩) numerals
     * in the input string with their ASCII equivalents.
     *
     * @param string $input String containing Persian/Arabic digits.
     * @return string String with ASCII digits replacing Persian/Arabic digits.
     */
    public function to_ascii_digits(string $input): string
    {
        $fa = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
        $ar = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
        $en = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
        return str_replace(array_merge($fa, $ar), array_merge($en, $en), $input);
    }

    /**
     * Get the number of days in a given Jalali month.
     *
     * Single source of truth for Jalali month lengths and Esfand leap logic.
     *
     * @param int $jy Jalali year.
     * @param int $jm Jalali month (1-12).
     * @return int Number of days in the month (29-31).
     */
    public function days_in_jalali_month(int $jy, int $jm): int
    {
        if ($jm <= 6) {
            return 31;
        }
        if ($jm <= 11) {
            return 30;
        }
        // Esfand (month 12): 30 days in a leap year, otherwise 29.
        $leap_remainders = [1, 5, 9, 13, 17, 22, 26, 30];
        return in_array($jy % 33, $leap_remainders, true) ? 30 : 29;
    }

    /**
     * Check if a Jalali date is valid.
     * 
     * @param int $jy Jalali year.
     * @param int $jm Jalali month.
     * @param int $jd Jalali day.
     * @return bool True if valid, false otherwise.
     */
    public function is_valid_jalali(int $jy, int $jm, int $jd): bool
    {
        if ($jy < 1 || $jy > 3000 || $jm < 1 || $jm > 12 || $jd < 1) {
            return false;
        }

        return $jd <= $this->days_in_jalali_month($jy, $jm);
    }

    /**
     * Convert a single Jalali date string to its Gregorian equivalent.
     *
     * Accepts formats like YYYY/MM/DD, YYYY-MM-DD, YYYY.MM.DD (with optional
     * trailing content such as time). Returns the original value unchanged when
     * it is not a recognisable Jalali date (already Gregorian, empty, etc.).
     *
     * @param string $value Raw date string.
     * @return string Gregorian date string, or the original value if not Jalali.
     */
    public function convert_jalali_string(string $value): string
    {
        $normalized = trim($this->to_ascii_digits($value));
        if ('' === $normalized || strlen($normalized) > 40) {
            return $value;
        }

        if (!preg_match('/^(\d{4})([\/\.\-])(\d{1,2})\2(\d{1,2})(.*)$/', $normalized, $m)) {
            return $value;
        }

        $jy   = (int) $m[1];
        $jm   = (int) $m[3];
        $jd   = (int) $m[4];
        $rest = $m[5];

        if ($jy < 1300 || $jy > 1599) {
            return $value;
        }

        if (!$this->is_valid_jalali($jy, $jm, $jd)) {
            return $value;
        }

        $g = $this->jalali_to_gregorian($jy, $jm, $jd);

        if (empty($g) || empty($g['y'])) {
            return $value;
        }

        return sprintf('%04d-%02d-%02d', $g['y'], $g['m'], $g['d']) . $rest;
    }
}
