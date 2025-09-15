<?php
/**
 * Persian Calendar Permalink Handler
 *
 * Handles conversion of Gregorian dates in permalinks to Jalali dates
 * and manages proper URL routing for Jalali date-based permalinks.
 *
 * @package Persian_calendar
 * @since 1.1.0
 */

// Prevent direct access
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Persian Calendar Permalink Handler Class
 *
 * @since 1.1.0
 */
class PC_Permalink {

    /**
     * Date converter instance.
     *
     * @var PC_Date_Converter
     */
    private $date_converter;

    /**
     * Initialize the permalink handler.
     *
     * @since 1.1.0
     */
    public function __construct() {
        $this->date_converter = new PC_Date_Converter();
        $this->init_hooks();
    }

    /**
     * Initialize WordPress hooks.
     *
     * @since 1.1.0
     */
    private function init_hooks() : void {
        add_filter( 'post_link', [ $this, 'filter_post_link' ], 10, 3 );
        add_filter( 'request', [ $this, 'filter_request_vars' ], 10, 1 );
        add_filter( 'year_link', [ $this, 'filter_archive_link' ], 10, 2 );
        add_filter( 'month_link', [ $this, 'filter_archive_link' ], 10, 3 );
        add_filter( 'day_link', [ $this, 'filter_archive_link' ], 10, 4 );
    }

    /**
     * Replace Gregorian date segments of a post permalink with Jalali values.
     *
     * @since 1.1.0
     *
     * @param string   $permalink The generated permalink.
     * @param \WP_Post $post      Post object.
     * @param bool     $leavename Whether to keep the post name.
     * @return string             Possibly modified permalink.
     */
    public function filter_post_link( $permalink, $post, $leavename ) {
        $opts = get_option( 'persian_calendar_options', [] );
        if ( empty( $opts['permalink_jalali_date'] ) ) {
            return $permalink;
        }

        // Validate inputs
        if ( ! is_string( $permalink ) || ! ( $post instanceof \WP_Post ) ) {
            return $permalink;
        }

        $structure = get_option( 'permalink_structure' );
        if ( false === strpos( (string) $structure, '%year%' ) ) {
            return $permalink; // Only relevant when structure contains date tags
        }

        // Determine post date in site timezone
        $tz = wp_timezone();
        $ts = get_post_time( 'U', true, $post ); // GMT unix timestamp
        try {
            $dt = (new \DateTimeImmutable('@' . (int) $ts))->setTimezone( $tz );
        } catch ( \Exception $e ) {
            return $permalink;
        }
        $gy = (int) $dt->format('Y');
        $gm = (int) $dt->format('n');
        $gd = (int) $dt->format('j');
        $jalali_date = $this->date_converter->gregorian_to_jalali( $gy, $gm, $gd );
        $jy = $jalali_date['y'];
        $jm = $jalali_date['m'];
        $jd = $jalali_date['d'];

        $orig_path = (string) wp_parse_url( $permalink, PHP_URL_PATH );
        $new_path = $orig_path;

        $g_trip = sprintf('/%04d/%02d/%02d/', $gy, $gm, $gd);
        $j_trip = sprintf('/%04d/%02d/%02d/', $jy, $jm, $jd);
        $count = 0;
        $new_path = str_replace( $g_trip, $j_trip, $new_path, $count );
        if ( $count === 0 ) {
            $g_pair = sprintf('/%04d/%02d/', $gy, $gm);
            $j_pair = sprintf('/%04d/%02d/', $jy, $jm);
            $new_path = str_replace( $g_pair, $j_pair, $new_path, $count );
            if ( $count === 0 ) {
                $g_year = sprintf('/%04d/', $gy);
                $j_year = sprintf('/%04d/', $jy);
                $new_path = str_replace( $g_year, $j_year, $new_path, $count );
            }
        }

        if ( $new_path === $orig_path ) {
            return $permalink;
        }
        // Replace path while keeping scheme, host, query, fragment intact
        return str_replace( $orig_path, $new_path, $permalink );
    }

    /**
     * Map incoming Jalali date segments in requests back to Gregorian for query parsing.
     *
     * @since 1.1.0
     *
     * @param array $vars Request vars.
     * @return array      Possibly adjusted vars.
     */
    public function filter_request_vars( $vars ) {
        $opts = get_option( 'persian_calendar_options', [] );
        if ( empty( $opts['permalink_jalali_date'] ) ) {
            return $vars;
        }

        // Validate and sanitize input vars
        if ( ! is_array( $vars ) ) {
            return $vars;
        }

        $y = isset( $vars['year'] ) ? absint( $vars['year'] ) : 0;
        $m = isset( $vars['monthnum'] ) ? absint( $vars['monthnum'] ) : 0;
        $d = isset( $vars['day'] ) ? absint( $vars['day'] ) : 0;

        // Validate date ranges
        if ( $y && ( $y < 1300 || $y > 1500 ) ) {
            return $vars; // Invalid Jalali year range
        }
        if ( $m && ( $m < 1 || $m > 12 ) ) {
            return $vars; // Invalid month
        }
        if ( $d && ( $d < 1 || $d > 31 ) ) {
            return $vars; // Invalid day
        }

        // Handle both posts and archives
        $has_name = ! empty( $vars['name'] );

        if ( $y && $m && $d ) {
            // Detect if incoming is Jalali via round-trip
            $try_gregorian = $this->date_converter->jalali_to_gregorian( $y, $m, $d );
            $try_g_y = $try_gregorian['y'];
            $try_g_m = $try_gregorian['m'];
            $try_g_d = $try_gregorian['d'];
            $back_jalali = $this->date_converter->gregorian_to_jalali( $try_g_y, $try_g_m, $try_g_d );
            $back_j_y = $back_jalali['y'];
            $back_j_m = $back_jalali['m'];
            $back_j_d = $back_jalali['d'];
            $looks_jalali = ($back_j_y === $y && $back_j_m === $m && $back_j_d === $d);
            if ( $looks_jalali ) {
                $vars['year']     = $try_g_y;
                $vars['monthnum'] = $try_g_m;
                $vars['day']      = $try_g_d;
            }
        } elseif ( $y && $m && empty( $d ) ) {
            // Year/Month structure: convert to a date range covering the full Jalali month
            $jm = max(1, min(12, $m));
            $jy = $y;
            $start_gregorian = $this->date_converter->jalali_to_gregorian( $jy, $jm, 1 );
            $gsy = $start_gregorian['y'];
            $gsm = $start_gregorian['m'];
            $gsd = $start_gregorian['d'];
            // Next month start
            $n_jy = $jy + ( $jm === 12 ? 1 : 0 );
            $n_jm = ( $jm === 12 ) ? 1 : $jm + 1;
            $end_gregorian = $this->date_converter->jalali_to_gregorian( $n_jy, $n_jm, 1 );
            $gey = $end_gregorian['y'];
            $gem = $end_gregorian['m'];
            $ged = $end_gregorian['d'];
            // Use date_query range [start, nextStart - 1 sec]
            unset( $vars['year'], $vars['monthnum'] );
            $vars['date_query'] = [ [
                'after'     => [ 'year' => $gsy, 'month' => $gsm, 'day' => $gsd, 'hour' => 0, 'minute' => 0, 'second' => 0 ],
                'before'    => [ 'year' => $gey, 'month' => $gem, 'day' => $ged, 'hour' => 0, 'minute' => 0, 'second' => 0 ],
                'inclusive' => true,
            ] ];
        } elseif ( $y && empty( $m ) && empty( $d ) ) {
            // Year-only structure: full Jalali year range
            $jy = $y;
            $start_gregorian = $this->date_converter->jalali_to_gregorian( $jy, 1, 1 );
            $gsy = $start_gregorian['y'];
            $gsm = $start_gregorian['m'];
            $gsd = $start_gregorian['d'];
            $end_gregorian = $this->date_converter->jalali_to_gregorian( $jy + 1, 1, 1 );
            $gey = $end_gregorian['y'];
            $gem = $end_gregorian['m'];
            $ged = $end_gregorian['d'];
            unset( $vars['year'] );
            $vars['date_query'] = [ [
                'after'     => [ 'year' => $gsy, 'month' => $gsm, 'day' => $gsd, 'hour' => 0, 'minute' => 0, 'second' => 0 ],
                'before'    => [ 'year' => $gey, 'month' => $gem, 'day' => $ged, 'hour' => 0, 'minute' => 0, 'second' => 0 ],
                'inclusive' => true,
            ] ];
        }

        return $vars;
    }

    /**
     * Replace Gregorian date segments in archive links with Jalali values.
     *
     * @since 1.1.0
     *
     * @param string $link The archive link.
     * @param int    $year The year.
     * @param int    $month The month (optional).
     * @param int    $day The day (optional).
     * @return string Modified archive link.
     */
    public function filter_archive_link( $link, $year, $month = null, $day = null ) {
        $opts = get_option( 'persian_calendar_options', [] );
        if ( empty( $opts['permalink_jalali_date'] ) ) {
            return $link;
        }

        // Validate inputs
        if ( ! is_string( $link ) || ! is_numeric( $year ) ) {
            return $link;
        }

        $gy = (int) $year;
        $gm = is_numeric( $month ) ? (int) $month : 1;
        $gd = is_numeric( $day ) ? (int) $day : 1;

        // Convert to Jalali
        $jalali_date = $this->date_converter->gregorian_to_jalali( $gy, $gm, $gd );
        $jy = $jalali_date['y'];
        $jm = $jalali_date['m'];
        $jd = $jalali_date['d'];

        $orig_path = (string) wp_parse_url( $link, PHP_URL_PATH );
        $new_path = $orig_path;

        // Replace year
        $new_path = str_replace( '/' . $gy . '/', '/' . $jy . '/', $new_path );

        // Replace month if present
        if ( $month !== null ) {
            $new_path = str_replace( '/' . sprintf('%02d', $gm) . '/', '/' . sprintf('%02d', $jm) . '/', $new_path );
        }

        // Replace day if present
        if ( $day !== null ) {
            $new_path = str_replace( '/' . sprintf('%02d', $gd) . '/', '/' . sprintf('%02d', $jd) . '/', $new_path );
        }

        // Reconstruct the URL
        $parsed = wp_parse_url( $link );
        $new_link = '';
        if ( isset( $parsed['scheme'] ) ) {
            $new_link .= $parsed['scheme'] . '://';
        }
        if ( isset( $parsed['host'] ) ) {
            $new_link .= $parsed['host'];
        }
        if ( isset( $parsed['port'] ) ) {
            $new_link .= ':' . $parsed['port'];
        }
        $new_link .= $new_path;
        if ( isset( $parsed['query'] ) ) {
            $new_link .= '?' . $parsed['query'];
        }
        if ( isset( $parsed['fragment'] ) ) {
            $new_link .= '#' . $parsed['fragment'];
        }

        return $new_link;
    }
}