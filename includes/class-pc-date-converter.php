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

if ( ! defined( 'ABSPATH' ) ) { exit; }

class PC_Date_Converter {

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
     * Persian month names in abbreviated format.
     * 
     * @var string[] Array of shortened Persian month names.
     */
    private $months_fa_short = [
        1 => 'فرو', 2 => 'ارد', 3 => 'خرد', 4 => 'تیر', 5 => 'مرد', 6 => 'شهر',
        7 => 'مهر', 8 => 'آبا', 9 => 'آذر', 10 => 'دی', 11 => 'بهم', 12 => 'اسف'
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
        6 => 'ش', 0 => 'ی', 1 => 'د', 2 => 'س', 3 => 'چ', 4 => 'پ', 5 => 'ج'
    ];

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
    public function gregorian_to_jalali( int $gy, int $gm, int $gd ) : array {
        $g_d_m = [0,31,59,90,120,151,181,212,243,273,304,334];
        $gy2 = ($gm > 2) ? ($gy + 1) : $gy;
        $days = 355666 + (365 * $gy) + intdiv($gy2 + 3, 4) - intdiv($gy2 + 99, 100) + intdiv($gy2 + 399, 400) + $gd + $g_d_m[$gm-1];
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
    public function jalali_to_gregorian( int $jy, int $jm, int $jd ) : array {
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
        $sal_a = [0,31, (($gy % 4 == 0 && $gy % 100 != 0) || ($gy % 400 == 0)) ? 29 : 28, 31,30,31,30,31,31,30,31,30,31];
        for ($gm = 1; $gm <= 12 && $gd > $sal_a[$gm]; $gm++) {
            $gd -= $sal_a[$gm];
        }
        return ['y' => $gy, 'm' => $gm, 'd' => $gd];
    }

    /**
     * Format a Unix timestamp using Jalali date formatting.
     * 
     * Converts the given timestamp to Jalali date and formats it according
     * to the provided format string, similar to PHP's date() function but
     * with Persian calendar support.
     * 
     * @param string $format PHP date format string (Y, m, d, F, l, etc.).
     * @param int $timestamp Unix timestamp to format.
     * @param DateTimeZone|null $tz Timezone for conversion (defaults to WordPress timezone).
     * @param bool $convert_digits Whether to convert Latin digits to Persian digits.
     * @return string Formatted Jalali date string.
     */
    public function format_jalali( string $format, int $timestamp, ?\DateTimeZone $tz = null, bool $convert_digits = false ) : string {
        $tz = $tz ?: wp_timezone();
        $dt = ( new \DateTime( '@' . $timestamp ) )->setTimezone( $tz );

        $gy = (int) $dt->format('Y');
        $gm = (int) $dt->format('n');
        $gd = (int) $dt->format('j');
        $w  = (int) $dt->format('w');

        $j = $this->gregorian_to_jalali( $gy, $gm, $gd );
        $jy = $j['y']; $jm = $j['m']; $jd = $j['d'];

        $out = '';
        $len = strlen( $format );
        for ( $i = 0; $i < $len; $i++ ) {
            $ch = $format[$i];
            if ( $ch === '\\' ) { // Escape next char like PHP date
                $i++;
                $out .= ($i < $len) ? $format[$i] : '';
                continue;
            }
            switch ( $ch ) {
                // Year
                case 'Y': $out .= sprintf('%04d', $jy); break;
                case 'y': $out .= substr( sprintf('%04d', $jy), -2 ); break;
                // Month
                case 'm': $out .= sprintf('%02d', $jm); break;
                case 'n': $out .= (string) $jm; break;
                case 'F': $out .= $this->months_fa[$jm]; break;
                case 'M': $out .= $this->months_fa[$jm]; break; // force long month everywhere
                // Day
                case 'd': $out .= sprintf('%02d', $jd); break;
                case 'j': $out .= (string) $jd; break;
                // Weekday (use Gregorian weekday index mapped to Persian names)
                case 'l': $out .= $this->weekdays_fa[$w]; break;
                case 'D': $out .= $this->weekdays_fa_short[$w]; break;
                case 'w': $out .= (string) $w; break; // 0..6 Sunday..Saturday (kept Gregorian index)
                case 'N': $out .= (string) ( $w === 0 ? 7 : $w ); break; // 1..7 Mon..Sun
                // Time-related tokens are delegated to DateTime
                case 'H': case 'G':
                    $out .= $dt->format( $ch );
                    break;
                case 'h': // 24-hour enforce
                    $out .= $dt->format( 'H' );
                    break;
                case 'g': // 24-hour enforce
                    $out .= $dt->format( 'G' );
                    break;
                case 'i': case 's':
                    $out .= $dt->format( $ch );
                    break;
                case 'a': case 'A': // remove am/pm
                    // no output; keep no meridiem symbols
                    break;
                case 'u': case 'v': case 'e': case 'T':
                case 'O': case 'P': case 'Z':
                case 'U':
                    $out .= $dt->format( $ch );
                    break;
                // Other tokens fallback
                default:
                    $out .= $dt->format( $ch );
                    break;
            }
        }

        // Cleanup extra spaces possibly left by removing am/pm
        $out = trim( preg_replace( '/\s{2,}/u', ' ', $out ) );

        return $convert_digits ? $this->to_persian_digits( $out ) : $out;
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
    public function to_persian_digits( string $input ) : string {
        $en = ['0','1','2','3','4','5','6','7','8','9'];
        $fa = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
        return str_replace( $en, $fa, $input );
    }
}
