/**
 * WooCommerce Integration for Persian Calendar
 *
 * Layer 1 - Replaces every jQuery UI datepicker WooCommerce creates
 *           (.date-picker, .date-picker-field, .range_datepicker) with the
 *           plugin's Jalali picker. The visible input shows a Jalali date,
 *           while a hidden input keeps the real Gregorian YYYY-MM-DD value,
 *           so WooCommerce keeps storing/querying Gregorian dates untouched.
 *
 * Layer 2 - Jalali X axis for the legacy WooCommerce report charts
 *           (jQuery Flot: Sales by date, Sales by product, Sales by category,
 *            Customers, Coupons by date, Taxes by date, Downloads).
 *
 * Layer 3 - Re-scans the DOM after AJAX (product variations, order items,
 *           download permissions rows) so dynamically injected date fields
 *           also get the Jalali picker.
 *
 * @package PersianCalendar
 * @since   1.4.0
 */
(function ($) {
    'use strict';

    if (!$) {
        return;
    }

    var settings = window.perscaWoo || {};
    var usePersianDigits = settings.persianDigits === '1';
    var originalDatepicker = null;

    /* -------------------------------------------------------------------
     * Reuse core date math & converters from window.PersianDateConverter
     * ---------------------------------------------------------------- */

    var converter = window.PersianDateConverter || {};
    var PERSIAN_MONTHS = converter.PERSIAN_MONTHS || [];

    /**
     * One Jalali month name.
     *
     * @param {number} jm Jalali month (1-12).
     * @return {string} The month name, or an empty string.
     */
    function jalaliMonthName(jm) {
        return PERSIAN_MONTHS[jm - 1] || '';
    }

    /**
     * @param {string|number} str Text possibly holding ASCII digits.
     * @return {string} The same text with Persian digits.
     */
    function toPersianDigits(str) {
        return converter.toPersianDigits ? converter.toPersianDigits(str) : String(str);
    }

    function maybeDigits(str) {
        return usePersianDigits ? toPersianDigits(str) : String(str);
    }

    function pad(n) {
        return converter.padZero ? converter.padZero(n) : (n < 10 ? '0' : '') + n;
    }

    /**
     * Gregorian -> Jalali conversion using core converter.
     *
     * @param {number} gy Gregorian year.
     * @param {number} gm Gregorian month (1-12).
     * @param {number} gd Gregorian day.
     * @return {number[]} [jy, jm, jd]
     */
    function gregorianToJalali(gy, gm, gd) {
        return converter.gregorianToJalali ? converter.gregorianToJalali(gy, gm, gd) : [gy, gm, gd];
    }

    /* =========================================================================
     * LAYER 1 - Jalali date pickers
     * ====================================================================== */

    /**
     * WooCommerce date field selectors.
     *
     * .date-picker           order date, coupon expiry, download access expiry
     * .date-picker-field     product & variation sale schedule dates
     * .range_datepicker      legacy report custom range (start_date / end_date)
     */
    var WC_DATE_SELECTOR = 'input.date-picker, input.date-picker-field, input.range_datepicker';

    function isWooDateField($el) {
        return $el.is(WC_DATE_SELECTOR);
    }

    function attachJalali($input) {
        if (!window.PersianCalendarIntegrations) {
            return false;
        }
        if ($input.data('persian-calendar-init')) {
            return true;
        }

        // Tear down any jQuery UI picker WooCommerce already attached.
        if ($input.hasClass('hasDatepicker') && originalDatepicker) {
            try {
                originalDatepicker.call($input, 'destroy');
            } catch (e) {}
            $input.removeClass('hasDatepicker');
        }

        // All WooCommerce pickers are date-only; the order screen keeps separate
        // hour/minute inputs, so no time component is needed here.
        return window.PersianCalendarIntegrations.setupJalaliDatePicker($input, null, false, $);
    }

    var customDatepicker = function (options) {
        if (typeof options === 'string') {
            if (originalDatepicker) {
                return originalDatepicker.apply(this, arguments);
            }
            return this;
        }

        return this.each(function () {
            var $input = $(this);
            if (isWooDateField($input)) {
                attachJalali($input);
            } else if (originalDatepicker) {
                originalDatepicker.call($input, options);
            }
        });
    };

    if (Object.defineProperty) {
        if ($.fn.datepicker && $.fn.datepicker !== customDatepicker) {
            originalDatepicker = $.fn.datepicker;
            if (Object.setPrototypeOf) {
                Object.setPrototypeOf(customDatepicker, originalDatepicker);
            }
        }
        Object.defineProperty($.fn, 'datepicker', {
            get: function () {
                return customDatepicker;
            },
            set: function (val) {
                if (val !== customDatepicker) {
                    originalDatepicker = val;
                    if (Object.setPrototypeOf) {
                        Object.setPrototypeOf(customDatepicker, originalDatepicker);
                    }
                }
            },
            configurable: true,
            enumerable: true
        });
    } else {
        if ($.fn.datepicker) {
            originalDatepicker = $.fn.datepicker;
        }
        $.fn.datepicker = customDatepicker;
    }

    /**
     * Attach the Jalali picker to every WooCommerce date input inside a context.
     *
     * @param {Element|Document} context Root node to scan.
     */
    function scanDateFields(context) {
        var $ctx = context ? $(context) : $(document);
        $ctx.find(WC_DATE_SELECTOR).each(function () {
            var $input = $(this);
            if (!$input.data('persian-calendar-init')) {
                attachJalali($input);
            }
        });
    }

    /* =========================================================================
     * LAYER 2 - Jalali axis for legacy Flot report charts
     * ====================================================================== */

    /**
     * Build the Jalali tick label for a Flot time axis value.
     *
     * Flot's time mode treats the given milliseconds as UTC (WooCommerce passes
     * already-offset local timestamps), so UTC getters are the correct readers.
     *
     * @param {number} val        Timestamp in milliseconds.
     * @param {boolean} withDay   Whether the axis shows day granularity.
     * @return {string} Jalali label.
     */
    function jalaliTick(val, withDay) {
        var d = new Date(val);
        if (isNaN(d.getTime())) {
            return '';
        }

        var j = gregorianToJalali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
        var monthName = jalaliMonthName(j[1]);

        if (withDay) {
            return maybeDigits(j[2]) + ' ' + monthName;
        }

        return monthName;
    }

    /**
     * Inject a Jalali tickFormatter into every time-mode axis of a Flot config.
     *
     * @param {Object} options Flot options object (mutated in place).
     */
    function applyJalaliAxes(options) {
        if (!options || typeof options !== 'object') {
            return;
        }

        var axes = [];

        if (options.xaxis) {
            axes.push(options.xaxis);
        }
        if ($.isArray(options.xaxes)) {
            axes = axes.concat(options.xaxes);
        }

        $.each(axes, function (_, axis) {
            if (!axis || axis.mode !== 'time' || axis.perscaJalali) {
                return;
            }

            // '%d %b' means day granularity, '%b' means month-only granularity.
            var withDay = typeof axis.timeformat === 'string' && axis.timeformat.indexOf('%d') !== -1;

            axis.perscaJalali = true;
            axis.monthNames = PERSIAN_MONTHS.slice();
            axis.tickFormatter = function (val) {
                return jalaliTick(val, withDay);
            };
        });
    }

    /**
     * Wrap jQuery.plot so every legacy WooCommerce report chart is drawn with a
     * Jalali X axis, without touching the underlying data.
     */
    function wrapFlot() {
        if (!$.plot || $.plot.perscaWrapped) {
            return;
        }

        var originalPlot = $.plot;

        var wrapped = function (placeholder, data, options) {
            try {
                applyJalaliAxes(options);
            } catch (e) {}
            return originalPlot.apply(this, arguments);
        };

        // Preserve Flot's static members (plot.plugins, plot.formatDate, ...).
        $.each(originalPlot, function (key, value) {
            wrapped[key] = value;
        });

        wrapped.perscaWrapped = true;
        $.plot = wrapped;
        jQuery.plot = wrapped;
    }

    wrapFlot();

    /* =========================================================================
     * LAYER 4 - Jalali labels for the React / D3 Analytics charts
     *
     * The WooCommerce Analytics screens are compiled React bundles that render
     * their dates through d3, so they cannot be filtered from PHP. This layer
     * rewrites the rendered labels in place:
     *
     *   - the day axis ticks (1..31 of the Gregorian month)
     *   - the month axis ticks ("July 2026")
     *   - the hover tooltip rows, legends, summary numbers and every other
     *     Gregorian date string printed inside the Analytics screens
     *
     * Only visible text is touched. aria-labels keep their original Gregorian
     * values, because they are the source used to map each tick to a real date.
     * ====================================================================== */

    var DIGIT_CLASS = '[0-9\u06F0-\u06F9\u0660-\u0669]';

    /**
     * Gregorian month names WooCommerce may print, in English and in the
     * Persian translations shipped with WordPress fa_IR.
     */
    var GREGORIAN_MONTHS = {
        'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6,
        'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12,
        'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'jun': 6, 'jul': 7,
        'aug': 8, 'sep': 9, 'sept': 9, 'oct': 10, 'nov': 11, 'dec': 12,
        'ژانویه': 1,
        'ژانویه‌': 1,
        'ژانویهٔ': 1,
        'فوریه': 2,
        'مارس': 3,
        'مارچ': 3,
        'آوریل': 4,
        'اوریل': 4,
        'آپریل': 4,
        'مه': 5,
        'می': 5,
        'ژوئن': 6,
        'ژوئیه': 7,
        'ژوییه': 7,
        'جولای': 7,
        'اوت': 8,
        'آگوست': 8,
        'اگوست': 8,
        'سپتامبر': 9,
        'اکتبر': 10,
        'نوامبر': 11,
        'دسامبر': 12
    };

    var MONTH_PATTERN = (function () {
        var names = [];
        for (var key in GREGORIAN_MONTHS) {
            if (Object.prototype.hasOwnProperty.call(GREGORIAN_MONTHS, key)) {
                names.push(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
            }
        }
        // Longest first so "sept" wins over "sep".
        names.sort(function (a, b) { return b.length - a.length; });
        return '(' + names.join('|') + ')';
    })();

    function toAsciiDigits(str) {
        return converter.toAsciiDigits ? converter.toAsciiDigits(str) : String(str);
    }

    function monthNumber(name) {
        var key = String(name).toLowerCase().trim();
        return GREGORIAN_MONTHS[key] || 0;
    }

    /**
     * Format a Gregorian date as a Jalali label.
     *
     * @param {number} gy      Gregorian year.
     * @param {number} gm      Gregorian month.
     * @param {number} gd      Gregorian day.
     * @param {boolean} withDay Include the day number.
     * @return {string}
     */
    /**
     * Format a Jalali range, collapsing the month/year when both ends share it.
     *
     * @param {number[]} from [jy, jm, jd]
     * @param {number[]} to   [jy, jm, jd]
     * @return {string}
     */
    function formatJalaliRange(from, to) {
        var fromMonth = jalaliMonthName(from[1]);
        var toMonth = jalaliMonthName(to[1]);

        if (from[0] === to[0] && from[1] === to[1]) {
            if (from[2] === to[2]) {
                return maybeDigits(from[2]) + ' ' + fromMonth + ' ' + maybeDigits(from[0]);
            }
            return maybeDigits(from[2]) + ' \u062A\u0627 ' + maybeDigits(to[2]) + ' ' +
                fromMonth + ' ' + maybeDigits(from[0]);
        }

        if (from[0] === to[0]) {
            return maybeDigits(from[2]) + ' ' + fromMonth +
                ' \u062A\u0627 ' + maybeDigits(to[2]) + ' ' + toMonth + ' ' + maybeDigits(to[0]);
        }

        return maybeDigits(from[2]) + ' ' + fromMonth + ' ' + maybeDigits(from[0]) +
            ' \u062A\u0627 ' + maybeDigits(to[2]) + ' ' + toMonth + ' ' + maybeDigits(to[0]);
    }

    function jalaliLabel(gy, gm, gd, withDay) {
        var j = gregorianToJalali(gy, gm, gd);
        var monthName = jalaliMonthName(j[1]);

        if (withDay) {
            return maybeDigits(j[2]) + ' ' + monthName + ' ' + maybeDigits(j[0]);
        }

        return monthName + ' ' + maybeDigits(j[0]);
    }

    /**
     * Extract a Gregorian [y, m, d] triple from an aria-label such as
     * "July 3, 2026 0" or its Persian translation.
     *
     * @param {string} label Raw label.
     * @return {number[]|null}
     */
    function parseDateFromLabel(label) {
        if (!label) {
            return null;
        }

        var text = toAsciiDigits(String(label));
        var re = new RegExp(MONTH_PATTERN + '\\s+(\\d{1,2})\\s*,?\\s*(\\d{4})', 'i');
        var m = text.match(re);

        if (m) {
            var mo = monthNumber(m[1]);
            if (mo) {
                return [parseInt(m[3], 10), mo, parseInt(m[2], 10)];
            }
        }

        var iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (iso) {
            return [parseInt(iso[1], 10), parseInt(iso[2], 10), parseInt(iso[3], 10)];
        }

        return null;
    }

    /**
     * Rewrite every Gregorian date inside a plain text string to Jalali.
     *
     * @param {string} text Original text.
     * @return {string}
     */
    function convertDateText(text) {
        var out = text;

        // "July 1 - 30, 2026" (range inside one month).
        out = out.replace(
            new RegExp(MONTH_PATTERN + '\\s+(' + DIGIT_CLASS + '{1,2})\\s*[-\u2013\u2014]\\s*(' + DIGIT_CLASS + '{1,2})\\s*[,\u060C]?\\s*(' + DIGIT_CLASS + '{4})', 'gi'),
            function (full, mon, d1, d2, y) {
                var mo = monthNumber(mon);
                if (!mo) { return full; }

                var year = parseInt(toAsciiDigits(y), 10);
                var from = gregorianToJalali(year, mo, parseInt(toAsciiDigits(d1), 10));
                var to = gregorianToJalali(year, mo, parseInt(toAsciiDigits(d2), 10));

                return formatJalaliRange(from, to);
            }
        );

        // "June 22 - July 21, 2026" (range spanning two months of one year).
        // The year only appears once, at the end, so the start date has to
        // borrow it - rolling back a year when the range crosses new year.
        out = out.replace(
            new RegExp(
                MONTH_PATTERN + '\\s+(' + DIGIT_CLASS + '{1,2})' +
                '\\s*[-\u2013\u2014]\\s*' +
                MONTH_PATTERN + '\\s+(' + DIGIT_CLASS + '{1,2})' +
                '\\s*[,\u060C]?\\s*(' + DIGIT_CLASS + '{4})',
                'gi'
            ),
            function (full, mon1, d1, mon2, d2, y) {
                var startMonth = monthNumber(mon1);
                var endMonth = monthNumber(mon2);

                if (!startMonth || !endMonth) {
                    return full;
                }

                var endYear = parseInt(toAsciiDigits(y), 10);
                var startYear = startMonth > endMonth ? endYear - 1 : endYear;

                var from = gregorianToJalali(startYear, startMonth, parseInt(toAsciiDigits(d1), 10));
                var to = gregorianToJalali(endYear, endMonth, parseInt(toAsciiDigits(d2), 10));

                return formatJalaliRange(from, to);
            }
        );

        // "July 3, 2026".
        out = out.replace(
            new RegExp(MONTH_PATTERN + '\\s+(' + DIGIT_CLASS + '{1,2})\\s*[,\u060C]\\s*(' + DIGIT_CLASS + '{4})', 'gi'),
            function (full, mon, d, y) {
                var mo = monthNumber(mon);
                if (!mo) { return full; }
                return jalaliLabel(parseInt(toAsciiDigits(y), 10), mo, parseInt(toAsciiDigits(d), 10), true);
            }
        );

        // "3 July 2026".
        out = out.replace(
            new RegExp('(' + DIGIT_CLASS + '{1,2})\\s+' + MONTH_PATTERN + '\\s+(' + DIGIT_CLASS + '{4})', 'gi'),
            function (full, d, mon, y) {
                var mo = monthNumber(mon);
                if (!mo) { return full; }
                return jalaliLabel(parseInt(toAsciiDigits(y), 10), mo, parseInt(toAsciiDigits(d), 10), true);
            }
        );

        // "2026-07-03".
        out = out.replace(
            new RegExp('\\b(' + DIGIT_CLASS + '{4})-(' + DIGIT_CLASS + '{2})-(' + DIGIT_CLASS + '{2})\\b', 'g'),
            function (full, y, m, d) {
                var year = parseInt(toAsciiDigits(y), 10);
                if (year < 1900 || year > 2200) { return full; }
                var j = gregorianToJalali(year, parseInt(toAsciiDigits(m), 10), parseInt(toAsciiDigits(d), 10));
                return maybeDigits(j[0]) + '/' + maybeDigits(pad(j[1])) + '/' + maybeDigits(pad(j[2]));
            }
        );

        // "July 2026" (month + year only).
        out = out.replace(
            new RegExp(MONTH_PATTERN + '\\s+(' + DIGIT_CLASS + '{4})', 'gi'),
            function (full, mon, y) {
                var mo = monthNumber(mon);
                if (!mo) { return full; }
                return jalaliLabel(parseInt(toAsciiDigits(y), 10), mo, 15, false);
            }
        );

        return out;
    }

    var SKIP_TAGS = {
        SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1, OPTION: 1, CODE: 1, PRE: 1
    };

    function shouldSkipNode(node) {
        var el = node.parentNode;

        while (el && el.nodeType === 1) {
            if (SKIP_TAGS[el.nodeName]) {
                return true;
            }
            if (el.isContentEditable) {
                return true;
            }
            if (el.getAttribute && el.getAttribute('data-persca-skip') === '1') {
                return true;
            }
            if (el.classList && (
                el.classList.contains('persian-calendar-popup') ||
                el.classList.contains('persian-calendar-container') ||
                el.classList.contains('persca-skip')
            )) {
                return true;
            }
            // Chart axes are rewritten by localizeChartAxes(), which knows the
            // real date of every tick. Letting the generic text pass touch them
            // as well produces hybrids such as a Jalali month band sitting on
            // top of Gregorian day numbers.
            if (el.classList && (
                el.classList.contains('axis') ||
                el.classList.contains('pipes')
            )) {
                return true;
            }
            el = el.parentNode;
        }

        return false;
    }

    /**
     * Walk visible text nodes and replace Gregorian dates with Jalali ones.
     *
     * @param {Element|Document} root Scan root.
     */
    function localizeTextNodes(root) {
        var scope = root || document;

        if (!scope.querySelectorAll || typeof document.createTreeWalker !== 'function') {
            return;
        }

        var walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, null, false);
        var pending = [];
        var node;

        while ((node = walker.nextNode())) {
            var value = node.nodeValue;

            if (!value || value.length > 200 || !/\d/.test(value)) {
                continue;
            }
            if (shouldSkipNode(node)) {
                continue;
            }

            pending.push(node);
        }

        for (var i = 0; i < pending.length; i++) {
            var current = pending[i];
            var converted = convertDateText(current.nodeValue);

            // Guard: only write when something actually changed, otherwise the
            // MutationObserver would keep re-triggering itself.
            if (converted !== current.nodeValue) {
                current.nodeValue = converted;
            }
        }
    }

    /**
     * Pick the Gregorian year for a bare "month day" pair: the import status
     * bar prints no year, so the closest occurrence to today is the one meant.
     *
     * @param {number} month Gregorian month (1-12).
     * @param {number} day   Gregorian day.
     * @return {number} Gregorian year.
     */
    function nearestGregorianYear(month, day) {
        var now = new Date();
        var best = now.getFullYear();
        var bestDiff = -1;

        for (var y = now.getFullYear() - 1; y <= now.getFullYear() + 1; y++) {
            var diff = Math.abs(new Date(y, month - 1, day).getTime() - now.getTime());

            if (bestDiff < 0 || diff < bestDiff) {
                bestDiff = diff;
                best = y;
            }
        }

        return best;
    }

    /**
     * Localise the Analytics import status bar ("Last updated" / "Next
     * update"). Its values read "July 30 14:50" - a month name, a day and a
     * clock, with no year - so the generic text pass never matched them.
     *
     * @param {Element|Document} scope Where to look.
     * @return {void}
     */
    var IMPORT_STATUS_PATTERN = null;

    function localizeImportStatusBar(scope) {
        var root = scope && scope.querySelectorAll ? scope : document;
        var values = root.querySelectorAll('.woocommerce-analytics-import-status-bar__value');

        if (!values.length) {
            return;
        }

        if (!IMPORT_STATUS_PATTERN) {
            IMPORT_STATUS_PATTERN = new RegExp(
                '^\\s*' + MONTH_PATTERN +
                '\\s+(' + DIGIT_CLASS + '{1,2})' +
                '\\s*(?:at|\\u062F\\u0631|\\u0633\\u0627\\u0639\\u062A)?\\s*' +
                '(' + DIGIT_CLASS + '{1,2}:' + DIGIT_CLASS + '{2})?\\s*$',
                'i'
            );
        }

        for (var i = 0; i < values.length; i++) {
            var el = values[i];
            var text = String(el.textContent || '');

            // Already converted by us and untouched by React since.
            if (el.perscaStatusText === text) {
                continue;
            }

            var m = text.match(IMPORT_STATUS_PATTERN);

            if (!m) {
                continue;
            }

            var mo = monthNumber(m[1]);

            if (!mo) {
                continue;
            }

            var day = parseInt(toAsciiDigits(m[2]), 10);

            if (!day) {
                continue;
            }

            // WooCommerce prints no year in this bar, so none is added back.
            var j = gregorianToJalali(nearestGregorianYear(mo, day), mo, day);
            var out = maybeDigits(j[2]) + ' ' + jalaliMonthName(j[1]);

            if (m[3]) {
                out += ' \u0633\u0627\u0639\u062A ' + maybeDigits(toAsciiDigits(m[3]));
            }

            if (out !== text) {
                el.textContent = out;
            }

            el.perscaStatusText = out;
        }
    }

    function tickPosition(tick) {
        var transform = tick.getAttribute('transform') || '';
        var m = transform.match(/translate\(\s*(-?[\d.]+)/);
        return m ? parseFloat(m[1]) : null;
    }

    function nearestDate(points, x, tolerance) {
        var best = null;
        var bestDistance = tolerance > 0 ? tolerance : 4;

        for (var i = 0; i < points.length; i++) {
            var distance = Math.abs(points[i].x - x);
            if (distance <= bestDistance) {
                bestDistance = distance;
                best = points[i].date;
            }
        }

        return best;
    }

    /**
     * The Gregorian date ranges this plugin last sent to the Analytics REST
     * API, filled in by rewriteAnalyticsPath(). These are the ranges the
     * charts are really plotting whenever a preset gets moved onto Jalali
     * boundaries.
     */
    var perscaEffectiveRanges = { primary: null, secondary: null, interval: '' };

    /**
     * The interval lists WooCommerce itself returned for the charts currently
     * on screen, newest first.
     *
     * Every Analytics REST response carries one entry per plotted point with
     * its own date_start, so these are the real dates behind the chart. They
     * are used before anything is worked out locally, which means no point is
     * invented, shifted or dropped by this plugin.
     */
    var perscaResponseBuckets = [];

    /**
     * Work out the bucketing from a list of plotted dates, used only when the
     * request did not spell the interval out.
     *
     * @param {Date[]} dates Plotted dates in chart order.
     * @return {string} Bucketing key.
     */
    function intervalFromDates(dates) {
        if (!dates || dates.length < 2) {
            return 'day';
        }

        var gap = daysBetween(dates[0], dates[1]);

        if (gap <= 0) {
            return 'hour';
        }

        if (1 === gap) {
            return 'day';
        }

        if (gap <= 7) {
            return 'week';
        }

        if (gap <= 31) {
            return 'month';
        }

        if (gap <= 120) {
            return 'quarter';
        }

        return 'year';
    }

    /**
     * Remember the plotted dates carried by an Analytics REST response.
     *
     * @param {Object} response Parsed REST response.
     * @param {string} interval The interval the request asked for.
     * @return {void}
     */
    function rememberResponseBuckets(response, interval) {
        if (!response || !response.intervals || !response.intervals.length) {
            return;
        }

        var dates = [];

        for (var i = 0; i < response.intervals.length; i++) {
            var row = response.intervals[i];
            var raw = row && (row.date_start || row.date_start_gmt);

            if (!raw) {
                return;
            }

            var parts = String(raw).slice(0, 10).split('-');

            if (3 !== parts.length) {
                return;
            }

            dates.push(new Date(
                parseInt(parts[0], 10),
                parseInt(parts[1], 10) - 1,
                parseInt(parts[2], 10)
            ));
        }

        perscaResponseBuckets.unshift({
            dates: dates,
            interval: interval || ''
        });

        // Only the handful of charts on screen matter.
        if (perscaResponseBuckets.length > 12) {
            perscaResponseBuckets.length = 12;
        }
    }

    /**
     * The bucketings WooCommerce can plot, tried in this order when the
     * interval is not known from the REST request.
     */
    var BUCKET_INTERVALS = ['day', 'week', 'week_sunday', 'month', 'quarter', 'year', 'hour'];

    function monthStep(interval) {
        if ('quarter' === interval) {
            return 3;
        }

        if ('year' === interval) {
            return 12;
        }

        return 1;
    }

    /**
     * The first day of every bucket a chart would plot for a range.
     *
     * WooCommerce switches bucketing with the length of the range (hour, day,
     * week, month, quarter, year), so the number of points is never fixed.
     * Building the bucket list makes the axis mapping work for every preset
     * instead of only for one-point-per-day charts.
     *
     * @param {Date} start    First day of the range.
     * @param {Date} end      Last day of the range.
     * @param {string} interval Bucketing key.
     * @return {Date[]} Bucket start dates, in chart order.
     */
    function bucketStarts(start, end, interval) {
        var out = [];
        var total = daysBetween(start, end) + 1;
        var i;

        if (total < 1 || total > 4000) {
            return out;
        }

        if ('hour' === interval) {
            for (i = 0; i < total * 24; i++) {
                out.push(addDays(start, Math.floor(i / 24)));
            }

            return out;
        }

        if ('day' === interval) {
            for (i = 0; i < total; i++) {
                out.push(addDays(start, i));
            }

            return out;
        }

        if ('week' === interval || 'week_sunday' === interval) {
            // WooCommerce follows the site's "week starts on" setting, so both
            // Monday and Sunday weeks are offered as candidates.
            var firstDay = 'week' === interval ? 1 : 0;
            var cursor = addDays(start, 0);

            out.push(cursor);

            var offset = (7 + firstDay - cursor.getDay()) % 7;
            var next = addDays(cursor, offset || 7);

            while (next <= end) {
                out.push(next);
                next = addDays(next, 7);
            }

            return out;
        }

        if ('month' === interval || 'quarter' === interval || 'year' === interval) {
            var step = monthStep(interval);

            out.push(addDays(start, 0));

            var year = start.getFullYear();
            var month = start.getMonth();

            if ('year' === interval) {
                year += 1;
                month = 0;
            } else {
                month = month - (month % step) + step;
            }

            var boundary = new Date(year, month, 1);

            while (boundary <= end) {
                out.push(boundary);
                boundary = new Date(
                    boundary.getFullYear(),
                    boundary.getMonth() + step,
                    1
                );
            }

            return out;
        }

        return out;
    }

    /**
     * Work out which range and which bucketing the chart in front of us is
     * really plotting, by matching the number of plotted points.
     *
     * @param {Element} svg Chart SVG.
     * @return {Object|null} { xs, dates, interval }
     */
    function resolvePlottedDates(svg) {
        var xs = chartPointXs(svg);

        if (xs.length < 2) {
            return null;
        }

        // 0. WooCommerce's own answer wins. Its intervals are one-per-plotted
        //    point, so when the counts line up these are literally the dates
        //    the chart drew, with nothing added or removed by this plugin.
        for (var c = 0; c < perscaResponseBuckets.length; c++) {
            if (perscaResponseBuckets[c].dates.length === xs.length) {
                return {
                    xs: xs,
                    dates: perscaResponseBuckets[c].dates,
                    interval: perscaResponseBuckets[c].interval ||
                        intervalFromDates(perscaResponseBuckets[c].dates)
                };
            }
        }

        var ranges = [];

        // 1. The range this plugin actually sent to the REST API. When Layer 5
        //    swaps a preset onto real Jalali boundaries (e.g. "last month"
        //    becomes 1-31 Tir = 22 June - 22 July), the chart aria-label still
        //    reports WooCommerce's untouched Gregorian range and must not be
        //    trusted.
        if (perscaEffectiveRanges.primary) {
            ranges.push(perscaEffectiveRanges.primary);
        }

        // 2. The range printed on the series itself. The primary (current)
        //    period is drawn last.
        var series = svg.querySelectorAll('g.lines g.line-g[aria-label], g.line-g[aria-label]');

        for (var s = series.length - 1; s >= 0; s--) {
            var parsed = parseRangeFromLabel(series[s].getAttribute('aria-label'));

            if (parsed) {
                ranges.push(parsed);
                break;
            }
        }

        // 3. The Jalali preset bounds computed from the current URL.
        var preset = currentPrimaryRange();

        if (preset) {
            ranges.push([tripleToDate(preset[0]), tripleToDate(preset[1])]);
        }

        if (!ranges.length) {
            return null;
        }

        // Prefer the interval WooCommerce asked for, then the URL, then guess.
        var intervals = [];
        var urlInterval = parseQuery(window.location.search).interval;

        if (perscaEffectiveRanges.interval) {
            intervals.push(perscaEffectiveRanges.interval);
        }

        if (urlInterval) {
            intervals.push(urlInterval);
        }

        for (var b = 0; b < BUCKET_INTERVALS.length; b++) {
            if (intervals.indexOf(BUCKET_INTERVALS[b]) === -1) {
                intervals.push(BUCKET_INTERVALS[b]);
            }
        }

        // "week" needs both week starts tried whichever way it was requested.
        if (intervals.indexOf('week_sunday') === -1) {
            intervals.push('week_sunday');
        }

        for (var r = 0; r < ranges.length; r++) {
            for (var k = 0; k < intervals.length; k++) {
                var dates = bucketStarts(ranges[r][0], ranges[r][1], intervals[k]);

                if (dates.length === xs.length) {
                    return {
                        xs: xs,
                        dates: dates,
                        interval: intervals[k]
                    };
                }
            }
        }

        return null;
    }

    /**
     * Parse the plotted Gregorian range out of a chart aria-label such as
     * "Month to date (July 1 - 30, 2026)" or its fa_IR translation
     * "\u0645\u0627\u0647 \u062A\u0627 \u062A\u0627\u0631\u06CC\u062E (\u062C\u0648\u0644\u0627\u06CC 1 - 30\u060C 2026)".
     *
     * @param {string} label Raw aria-label.
     * @return {Date[]|null} [start, end]
     */
    function parseRangeFromLabel(label) {
        if (!label) {
            return null;
        }

        var text = toAsciiDigits(String(label));

        // "June 22 - July 21, 2026"
        var two = text.match(new RegExp(
            MONTH_PATTERN + '\\s+(\\d{1,2})\\s*[-\u2013\u2014]\\s*' +
            MONTH_PATTERN + '\\s+(\\d{1,2})\\s*[,\u060C]?\\s*(\\d{4})',
            'i'
        ));

        if (two) {
            var startMonth = monthNumber(two[1]);
            var endMonth = monthNumber(two[3]);

            if (startMonth && endMonth) {
                var endYear = parseInt(two[5], 10);
                var startYear = startMonth > endMonth ? endYear - 1 : endYear;

                return [
                    new Date(startYear, startMonth - 1, parseInt(two[2], 10)),
                    new Date(endYear, endMonth - 1, parseInt(two[4], 10))
                ];
            }
        }

        // "July 1 - 30, 2026"
        var one = text.match(new RegExp(
            MONTH_PATTERN + '\\s+(\\d{1,2})\\s*[-\u2013\u2014]\\s*(\\d{1,2})\\s*[,\u060C]?\\s*(\\d{4})',
            'i'
        ));

        if (one) {
            var mo = monthNumber(one[1]);

            if (mo) {
                var year = parseInt(one[4], 10);

                return [
                    new Date(year, mo - 1, parseInt(one[2], 10)),
                    new Date(year, mo - 1, parseInt(one[3], 10))
                ];
            }
        }

        var single = parseDateFromLabel(text);

        if (single) {
            var day = new Date(single[0], single[1] - 1, single[2]);
            return [day, day];
        }

        return null;
    }

    /**
     * Build the [{ x, date }] map for LINE charts.
     *
     * Bar charts label every bar with its own date, but line charts only carry
     * one aria-label per series, holding the whole plotted range. Without this
     * fallback the day axis keeps its Gregorian numbers (1, 8, 15...) under an
     * already Jalali month band, which is the mismatch this fixes.
     *
     * @param {Element} svg Chart SVG.
     * @return {Array} [{ x, date: [y, m, d] }]
     */
    function pointsFromLineRange(svg) {
        var resolved = resolvePlottedDates(svg);

        if (!resolved) {
            return [];
        }

        var points = [];

        for (var i = 0; i < resolved.dates.length; i++) {
            var day = resolved.dates[i];

            points.push({
                x: resolved.xs[i],
                date: [day.getFullYear(), day.getMonth() + 1, day.getDate()]
            });
        }

        // The bucketing decides whether ticks read as days or as month names.
        points.perscaInterval = resolved.interval;

        return points;
    }

    /**
     * Sum every translate(x, ...) between a node and an ancestor.
     *
     * Bar charts nest each bar inside <g class="bargroup" transform="translate(x,0)">,
     * so the rect's own x attribute is relative to that group, not to the
     * chart. Axis ticks are positioned in chart coordinates, so the two only
     * line up after the ancestor transforms are added back.
     *
     * @param {Element} el   Start node (exclusive).
     * @param {Element} stop Ancestor to stop at (exclusive).
     * @return {number}
     */
    function ancestorOffsetX(el, stop) {
        var offset = 0;
        var node = el.parentNode;

        while (node && node !== stop && node.getAttribute) {
            var transform = node.getAttribute('transform');

            if (transform) {
                var m = transform.match(/translate\(\s*(-?[\d.]+)/);
                if (m) {
                    offset += parseFloat(m[1]);
                }
            }

            node = node.parentNode;
        }

        return offset;
    }

    /**
     * The chart-space centre X of a plotted shape (line point or bar).
     *
     * @param {Element} shape Circle or rect.
     * @param {Element} stop  Ancestor whose coordinate space the axis uses.
     * @return {number} NaN when it cannot be resolved.
     */
    function shapeCenterX(shape, stop) {
        var cx = parseFloat(shape.getAttribute('cx'));

        if (!isNaN(cx)) {
            return cx + ancestorOffsetX(shape, stop);
        }

        var rx = parseFloat(shape.getAttribute('x'));

        if (isNaN(rx)) {
            return NaN;
        }

        var group = shape.parentNode;

        // Inside a bargroup the tick sits at the centre of the whole group
        // (all series bars together), not at the centre of one bar.
        if (group && group.classList && group.classList.contains('bargroup')) {
            var focus = group.querySelector('rect.barfocus');
            var focusWidth = focus ? parseFloat(focus.getAttribute('width')) : NaN;

            if (!isNaN(focusWidth)) {
                return ancestorOffsetX(shape, stop) + focusWidth / 2;
            }
        }

        var rw = parseFloat(shape.getAttribute('width'));

        return rx + (isNaN(rw) ? 0 : rw / 2) + ancestorOffsetX(shape, stop);
    }

    /**
     * Compare two [y, m, d] triples.
     *
     * @param {number[]} a First date.
     * @param {number[]} b Second date.
     * @return {number}
     */
    function compareDateTriples(a, b) {
        return (a[0] - b[0]) || (a[1] - b[1]) || (a[2] - b[2]);
    }

    /**
     * Whether an axis really carries dates.
     *
     * Item-comparison charts (top products, top categories, ...) reuse the same
     * markup with product names on the X axis. Those must never be rewritten.
     *
     * @param {NodeList} ticks Day axis ticks.
     * @return {boolean}
     */
    function axisLooksLikeDates(ticks) {
        var checked = 0;
        var dateLike = 0;

        Array.prototype.forEach.call(ticks, function (tick) {
            var text = tick.querySelector('text');
            var value = text ? toAsciiDigits((text.textContent || '').trim()) : '';

            if (!value) {
                return;
            }

            checked++;

            if (/^\d{1,4}([\/\-:.]\d{1,2})*$/.test(value) ||
                new RegExp('^' + MONTH_PATTERN, 'i').test(value)) {
                dateLike++;
            }
        });

        return 0 === checked || dateLike >= Math.ceil(checked / 2);
    }

    /**
     * Rewrite the day and month axes of every Analytics d3 chart.
     *
     * Each data point circle carries an aria-label with its full Gregorian
     * date, so the ticks can be mapped to real dates by X position instead of
     * guessing from the tick number.
     *
     * @param {Element|Document} root Scan root.
     */
    function localizeChartAxes(root) {
        var scope = root && root.querySelectorAll ? root : document;
        var containers = scope.querySelectorAll('.d3-chart__container, .woocommerce-chart');

        Array.prototype.forEach.call(containers, function (container) {
            var svg = container.querySelector('svg');
            if (!svg) {
                return;
            }

            // Quarter and year ranges band the axis with month names and
            // carry no per-point aria-labels, so they need their own pass.
            try {
                if (localizeMonthBandAxis(svg)) {
                    return;
                }
            } catch (e) {}

            var dayAxis = svg.querySelector('g.axis:not(.axis-month):not(.y-axis)');
            var monthAxis = svg.querySelector('g.axis.axis-month');

            if (!dayAxis) {
                return;
            }

            var dayTicks = dayAxis.querySelectorAll('g.tick');
            var monthTicks = monthAxis ? monthAxis.querySelectorAll('g.tick') : [];

            // Product / category comparison charts share this markup but have
            // no dates on the X axis.
            if (!axisLooksLikeDates(dayTicks)) {
                return;
            }

            // Ticks live in the coordinate space of the axis' parent group, so
            // bar and point positions have to be resolved in that same space.
            var space = dayAxis.parentNode;
            var points = [];
            var byX = {};

            Array.prototype.forEach.call(svg.querySelectorAll('circle[aria-label], rect[aria-label]'), function (shape) {
                var date = parseDateFromLabel(shape.getAttribute('aria-label'));
                if (!date) {
                    return;
                }

                var x = shapeCenterX(shape, space);
                if (isNaN(x)) {
                    return;
                }

                // Several shapes share one X: the series bars of a bargroup,
                // plus the comparison series, whose aria-label carries the
                // previous period date. The latest date is the plotted one.
                var key = Math.round(x);
                var current = byX[key];

                if (!current || compareDateTriples(date, current.date) > 0) {
                    byX[key] = { x: x, date: date };
                }
            });

            Object.keys(byX).forEach(function (key) {
                points.push(byX[key]);
            });

            points.sort(function (a, b) {
                return a.x - b.x;
            });

            if (!points.length) {
                // Line charts have no per-point aria-label.
                try {
                    points = pointsFromLineRange(svg);
                } catch (e) {}
            }

            if (!points.length) {
                return;
            }
            var previousMonthKey = null;

            // Buckets are not always one per day, so a tick may sit anywhere
            // inside its bucket. Half the point spacing is the safe tolerance.
            var spacing = points.length > 1
                ? Math.abs(points[1].x - points[0].x)
                : 8;
            var tolerance = Math.max(4, spacing / 2 + 1);

            // Coarse bucketing (one point per month or longer) labels the axis
            // with month names instead of day numbers.
            var interval = points.perscaInterval || 'day';
            var monthMode = ('month' === interval || 'quarter' === interval || 'year' === interval);

            Array.prototype.forEach.call(dayTicks, function (tick, index) {
                var x = tickPosition(tick);
                if (null === x) {
                    return;
                }

                var date = nearestDate(points, x, tolerance);
                if (!date) {
                    return;
                }

                var j = gregorianToJalali(date[0], date[1], date[2]);
                var text = tick.querySelector('text');

                if (text) {
                    var dayLabel = monthMode
                        ? jalaliMonthName(j[1])
                        : maybeDigits(j[2]);

                    if (text.textContent !== dayLabel) {
                        text.textContent = dayLabel;
                    }
                }

                var monthTick = monthTicks[index];
                if (!monthTick) {
                    return;
                }

                var monthText = monthTick.querySelector('text');
                if (!monthText) {
                    return;
                }

                var key = monthMode ? String(j[0]) : (j[0] + '-' + j[1]);
                var label = '';

                if (key !== previousMonthKey) {
                    label = monthMode
                        ? maybeDigits(j[0])
                        : jalaliMonthName(j[1]) + ' ' + maybeDigits(j[0]);
                    previousMonthKey = key;
                }

                if (monthText.textContent !== label) {
                    monthText.textContent = label;
                }
            });
        });
    }

    /**
     * The X coordinate of every plotted data point, in chart order.
     *
     * Line charts carry no per-point aria-label, but every point still has a
     * focus target, and those are laid out one per bucket.
     *
     * @param {Element} svg Chart SVG.
     * @return {number[]} X coordinates.
     */
    function chartPointXs(svg) {
        var xs = [];

        Array.prototype.forEach.call(
            svg.querySelectorAll('g.focusspaces g.focus g.focus-grid line'),
            function (line) {
                var x = parseFloat(line.getAttribute('x1'));

                if (!isNaN(x)) {
                    xs.push(x);
                }
            }
        );

        return xs;
    }

    /**
     * Turn an ISO yyyy-mm-dd string into a Jalali triple.
     *
     * @param {string} value ISO date.
     * @return {number[]|null} [jy, jm, jd]
     */
    function isoToJalaliTriple(value) {
        var m = (value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);

        if (!m) {
            return null;
        }

        return gregorianToJalali(
            parseInt(m[1], 10),
            parseInt(m[2], 10),
            parseInt(m[3], 10)
        );
    }

    /**
     * The Jalali boundaries of the period the charts are currently plotting.
     *
     * @return {Array|null} [[jy,jm,jd] start, [jy,jm,jd] end]
     */
    function currentPrimaryRange() {
        var params = parseQuery(window.location.search);

        if (!isAnalyticsScreen(params)) {
            return null;
        }

        var period = params.period || 'month';

        if ('custom' === period) {
            var after = isoToJalaliTriple(params.after);
            var before = isoToJalaliTriple(params.before);

            return after && before ? [after, before] : null;
        }

        var ranges = jalaliPresetRanges(
            period,
            params.compare || 'previous_year',
            new Date()
        );

        return ranges ? ranges.primary : null;
    }

    /**
     * Grow or shrink a d3 tick group so it matches the wanted marks, then
     * reposition and relabel every tick.
     *
     * @param {Element} group   The <g> holding the ticks.
     * @param {Array} marks     [{ x, j }] in ascending X order.
     * @param {Function} labelFn Receives each mark, returns its label.
     */
    function applyAxisTicks(group, marks, labelFn) {
        var ticks = Array.prototype.slice.call(group.querySelectorAll('g.tick'));

        if (!ticks.length) {
            return;
        }

        while (ticks.length < marks.length) {
            var clone = ticks[0].cloneNode(true);
            group.appendChild(clone);
            ticks.push(clone);
        }

        while (ticks.length > marks.length) {
            var extra = ticks.pop();

            if (extra.parentNode) {
                extra.parentNode.removeChild(extra);
            }
        }

        for (var i = 0; i < marks.length; i++) {
            var transform = 'translate(' + marks[i].x + ',0)';

            if (ticks[i].getAttribute('transform') !== transform) {
                ticks[i].setAttribute('transform', transform);
            }

            var text = ticks[i].querySelector('text');
            var label = labelFn(marks[i], i);

            if (text && text.textContent !== label) {
                text.textContent = label;
            }
        }
    }

    /**
     * Long ranges (quarter, year) drop the day numbers and band the axis with
     * month names instead. Those bands start on GREGORIAN month boundaries,
     * so relabelling them in place would put "Farvardin" on 12 Farvardin.
     * The ticks are therefore MOVED onto the first day of each Jalali month,
     * and the band below them carries the Jalali year.
     *
     * @param {Element} svg Chart SVG.
     * @return {boolean} True when this chart was handled here.
     */
    function localizeMonthBandAxis(svg) {
        var dayAxis = svg.querySelector('g.axis:not(.axis-month):not(.y-axis)');

        if (!dayAxis) {
            return false;
        }

        var dayTicks = dayAxis.querySelectorAll('g.tick');

        if (dayTicks.length < 2) {
            return false;
        }

        // Month-band mode only: every label is a bare month name, no digits.
        var digits = new RegExp(DIGIT_CLASS);

        for (var t = 0; t < dayTicks.length; t++) {
            var current = (dayTicks[t].textContent || '').trim();

            if (!current || digits.test(current)) {
                return false;
            }
        }

        // The bucketing is resolved from the plotted point count, so daily,
        // weekly and monthly charts are all handled.
        var resolved = resolvePlottedDates(svg);

        if (!resolved) {
            return false;
        }

        var marks = [];
        var previousKey = null;
        var daily = ('day' === resolved.interval || 'hour' === resolved.interval);

        for (var i = 0; i < resolved.dates.length; i++) {
            var day = resolved.dates[i];
            var j = gregorianToJalali(
                day.getFullYear(),
                day.getMonth() + 1,
                day.getDate()
            );
            var key = j[0] + '-' + j[1];
            var isBoundary = daily ? (1 === j[2]) : (key !== previousKey);

            if (0 === i || isBoundary) {
                marks.push({ x: resolved.xs[i], j: j });
            }

            previousKey = key;
        }

        if (!marks.length) {
            return false;
        }

        applyAxisTicks(dayAxis, marks, function (mark) {
            return jalaliMonthName(mark.j[1]);
        });

        var monthAxis = svg.querySelector('g.axis.axis-month');

        if (monthAxis) {
            var lastYear = null;

            applyAxisTicks(monthAxis, marks, function (mark) {
                if (mark.j[0] === lastYear) {
                    return '';
                }

                lastYear = mark.j[0];

                return maybeDigits(mark.j[0]);
            });
        }

        // The separator pipes share the day axis positions.
        var pipes = svg.querySelector('g.pipes');

        if (pipes) {
            applyAxisTicks(pipes, marks, function () {
                return '';
            });
        }

        return true;
    }

    var localizeTimer = null;

    /**
     * Run every Analytics localisation pass, debounced.
     */
    function localizeAnalytics() {
        clearTimeout(localizeTimer);
        localizeTimer = setTimeout(function () {
            try {
                restorePresetLabel();
            } catch (e) {}
            try {
                localizeChartAxes(document);
            } catch (e) {}
            try {
                localizeTextNodes(document.getElementById('wpbody-content') || document.body);
            } catch (e) {}
            try {
                installJalaliCalendars(document);
            } catch (e) {}
            try {
                localizeImportStatusBar(document);
            } catch (e) {}
        }, 60);
    }

    /* =========================================================================
     * LAYER 5 - Rebuild the Analytics preset ranges on the Jalali calendar
     *
     * WooCommerce computes "Month to date", "Last month", "Quarter", "Year"
     * and the week presets on the GREGORIAN calendar. "Last month" therefore
     * resolves to 1-30 June, which is 11 Khordad - 9 Tir, instead of the real
     * Jalali month 1-31 Khordad.
     *
     * Translating the label alone is not enough: the queried DATA must move
     * too. The URL and its preset are left exactly as WooCommerce wrote them;
     * instead each outgoing Analytics REST request has its date boundaries
     * swapped for the true Jalali month / quarter / year equivalents.
     * ====================================================================== */

    function jalaliToGregorian(jy, jm, jd) {
        if (converter && typeof converter.jalaliToGregorian === 'function') {
            return converter.jalaliToGregorian(jy, jm, jd);
        }
        return [jy, jm, jd];
    }

    function tripleFromDate(date) {
        return gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
    }

    /**
     * Compute the true Jalali boundaries for a WooCommerce preset.
     *
     * @param {string} key WooCommerce period key.
     * @param {Date} now   Reference "today".
     * @return {Array|null} [[jy,jm,jd] start, [jy,jm,jd] end] or null.
     */
    function jalaliPresetBounds(key, now) {
        var today = tripleFromDate(now);
        var jy = today[0];
        var jm = today[1];
        var quarterStart;
        var previousQuarterStart;
        var previousQuarterEnd;
        var previousMonth;
        var previousYear;
        var dayOfWeek;
        var start;
        var end;

        switch (key) {
            case 'month':
                return [[jy, jm, 1], today];

            case 'last_month':
                previousMonth = jm - 1;
                previousYear = jy;
                if (previousMonth < 1) {
                    previousMonth = 12;
                    previousYear--;
                }
                return [
                    [previousYear, previousMonth, 1],
                    [previousYear, previousMonth, jalaliMonthLength(previousYear, previousMonth)]
                ];

            case 'quarter':
                quarterStart = Math.floor((jm - 1) / 3) * 3 + 1;
                return [[jy, quarterStart, 1], today];

            case 'last_quarter':
                quarterStart = Math.floor((jm - 1) / 3) * 3 + 1;
                previousQuarterStart = quarterStart - 3;
                previousYear = jy;
                if (previousQuarterStart < 1) {
                    previousQuarterStart += 12;
                    previousYear--;
                }
                previousQuarterEnd = previousQuarterStart + 2;
                return [
                    [previousYear, previousQuarterStart, 1],
                    [previousYear, previousQuarterEnd, jalaliMonthLength(previousYear, previousQuarterEnd)]
                ];

            case 'year':
                return [[jy, 1, 1], today];

            case 'last_year':
                return [[jy - 1, 1, 1], [jy - 1, 12, jalaliMonthLength(jy - 1, 12)]];

            case 'week':
                // The Jalali week starts on Saturday.
                dayOfWeek = (now.getDay() + 1) % 7;
                start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
                return [tripleFromDate(start), today];

            case 'last_week':
                dayOfWeek = (now.getDay() + 1) % 7;
                start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek - 7);
                end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek - 1);
                return [tripleFromDate(start), tripleFromDate(end)];

            default:
                // today / yesterday / custom are day based and need no shifting.
                return null;
        }
    }

    function parseQuery(search) {
        var params = {};
        var query = String(search || '').replace(/^\?/, '');

        if (!query) {
            return params;
        }

        query.split('&').forEach(function (pair) {
            if (!pair) {
                return;
            }

            var index = pair.indexOf('=');
            var key = index === -1 ? pair : pair.slice(0, index);
            var value = index === -1 ? '' : pair.slice(index + 1);

            try {
                params[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '));
            } catch (e) {
                params[key] = value;
            }
        });

        return params;
    }

    function buildQuery(params) {
        var parts = [];

        for (var key in params) {
            if (!Object.prototype.hasOwnProperty.call(params, key)) {
                continue;
            }
            if (params[key] === undefined || params[key] === null) {
                continue;
            }
            parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
        }

        return parts.join('&');
    }

    function isAnalyticsScreen(params) {
        if (params.page !== 'wc-admin') {
            return false;
        }

        var path = params.path || '';

        return path.indexOf('analytics') !== -1 || path.indexOf('customers') !== -1;
    }

    /* ---------------------------------------------------------------------
     * Gregorian mirror of WooCommerce's own preset math.
     *
     * The URL keeps the real preset (period=last_month). WooCommerce turns
     * that preset into Gregorian boundaries and puts them on the REST
     * request. The same boundaries are recomputed here so an outgoing
     * request can be recognised as "this is the primary range" or "this is
     * the comparison range", and then swapped for the Jalali equivalent.
     * ------------------------------------------------------------------ */

    // preset -> [calendar unit, 'todate' (running) or 'last' (completed)]
    var PRESET_UNITS = {
        'today': ['day', 'todate'],
        'yesterday': ['day', 'last'],
        'week': ['week', 'todate'],
        'last_week': ['week', 'last'],
        'month': ['month', 'todate'],
        'last_month': ['month', 'last'],
        'quarter': ['quarter', 'todate'],
        'last_quarter': ['quarter', 'last'],
        'year': ['year', 'todate'],
        'last_year': ['year', 'last']
    };

    function addDays(date, n) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
    }

    function daysBetween(from, to) {
        return Math.round((to.getTime() - from.getTime()) / 86400000);
    }

    function gStartOf(date, unit) {
        var y = date.getFullYear();
        var m = date.getMonth();
        var d = date.getDate();

        switch (unit) {
            case 'week':
                return addDays(new Date(y, m, d), -(new Date(y, m, d).getDay()));
            case 'month':
                return new Date(y, m, 1);
            case 'quarter':
                return new Date(y, Math.floor(m / 3) * 3, 1);
            case 'year':
                return new Date(y, 0, 1);
            default:
                return new Date(y, m, d);
        }
    }

    function gEndOf(date, unit) {
        var s = gStartOf(date, unit);

        switch (unit) {
            case 'week':
                return addDays(s, 6);
            case 'month':
                return new Date(s.getFullYear(), s.getMonth() + 1, 0);
            case 'quarter':
                return new Date(s.getFullYear(), s.getMonth() + 3, 0);
            case 'year':
                return new Date(s.getFullYear(), 11, 31);
            default:
                return s;
        }
    }

    function gShift(date, n, unit) {
        var y = date.getFullYear();
        var m = date.getMonth();
        var d = date.getDate();

        switch (unit) {
            case 'day':
                return addDays(date, n);
            case 'week':
                return addDays(date, n * 7);
            case 'month':
                return new Date(y, m + n, d);
            case 'quarter':
                return new Date(y, m + n * 3, d);
            case 'year':
                return new Date(y + n, m, d);
            default:
                return date;
        }
    }

    /**
     * Reproduce the Gregorian primary/secondary ranges WooCommerce computes.
     *
     * @param {string} key     Preset key.
     * @param {string} compare 'previous_year' or 'previous_period'.
     * @param {Date} now       Reference "today".
     * @return {Object|null} primaryStart/primaryEnd/secondaryStart/secondaryEnd.
     */
    function gregorianPresetRanges(key, compare, now) {
        var spec = PRESET_UNITS[key];

        if (!spec) {
            return null;
        }

        var unit = spec[0];
        var running = spec[1] === 'todate';
        var pStart;
        var pEnd;
        var sStart;
        var sEnd;
        var span;

        if (running) {
            pStart = gStartOf(now, unit);
            pEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            span = daysBetween(pStart, pEnd);

            if (compare === 'previous_period') {
                sStart = gShift(pStart, -1, unit);
                sEnd = gShift(pEnd, -1, unit);
            } else {
                sStart = gShift(pStart, -1, 'year');
                sEnd = addDays(sStart, span);
            }
        } else {
            pStart = gShift(gStartOf(now, unit), -1, unit);
            pEnd = gEndOf(pStart, unit);
            span = daysBetween(pStart, pEnd);

            if (compare === 'previous_period') {
                if (unit === 'year') {
                    sStart = gShift(gStartOf(now, unit), -2, unit);
                    sEnd = gEndOf(sStart, unit);
                } else {
                    sEnd = addDays(pStart, -1);
                    sStart = addDays(sEnd, -span);
                }
            } else if (unit === 'week') {
                sStart = gShift(pStart, -1, 'year');
                sEnd = gShift(pEnd, -1, 'year');
            } else {
                sStart = gShift(pStart, -1, 'year');
                sEnd = gEndOf(sStart, unit);
            }
        }

        return {
            primaryStart: pStart,
            primaryEnd: pEnd,
            secondaryStart: sStart,
            secondaryEnd: sEnd
        };
    }

    /* ---------------------------------------------------------------------
     * The Jalali counterparts.
     * ------------------------------------------------------------------ */

    function tripleToDate(triple) {
        var g = jalaliToGregorian(triple[0], triple[1], triple[2]);
        return new Date(g[0], g[1] - 1, g[2]);
    }

    function shiftJalaliMonths(triple, delta) {
        var total = triple[0] * 12 + (triple[1] - 1) + delta;
        var jy = Math.floor(total / 12);
        var jm = total - jy * 12 + 1;

        return [jy, jm, Math.min(triple[2], jalaliMonthLength(jy, jm))];
    }

    function jShift(triple, n, unit) {
        switch (unit) {
            case 'day':
                return tripleFromDate(addDays(tripleToDate(triple), n));
            case 'week':
                return tripleFromDate(addDays(tripleToDate(triple), n * 7));
            case 'month':
                return shiftJalaliMonths(triple, n);
            case 'quarter':
                return shiftJalaliMonths(triple, n * 3);
            case 'year':
                return shiftJalaliMonths(triple, n * 12);
            default:
                return triple;
        }
    }

    function jEndOf(startTriple, unit) {
        var jy = startTriple[0];
        var jm = startTriple[1];

        switch (unit) {
            case 'week':
                return tripleFromDate(addDays(tripleToDate(startTriple), 6));
            case 'month':
                return [jy, jm, jalaliMonthLength(jy, jm)];
            case 'quarter':
                return [jy, jm + 2, jalaliMonthLength(jy, jm + 2)];
            case 'year':
                return [jy, 12, jalaliMonthLength(jy, 12)];
            default:
                return startTriple;
        }
    }

    /**
     * The true Jalali primary and comparison ranges for a preset.
     *
     * @param {string} key     Preset key.
     * @param {string} compare Comparison mode.
     * @param {Date} now       Reference "today".
     * @return {Object|null} { primary: [start, end], secondary: [start, end] }
     */
    function jalaliPresetRanges(key, compare, now) {
        var spec = PRESET_UNITS[key];
        var primary = jalaliPresetBounds(key, now);

        if (!spec || !primary) {
            return null;
        }

        var unit = spec[0];
        var running = spec[1] === 'todate';
        var span = daysBetween(tripleToDate(primary[0]), tripleToDate(primary[1]));
        var sStart;
        var sEnd;

        if (running) {
            sStart = compare === 'previous_period'
                ? jShift(primary[0], -1, unit)
                : jShift(primary[0], -1, 'year');
            sEnd = tripleFromDate(addDays(tripleToDate(sStart), span));
        } else if (compare === 'previous_period') {
            sEnd = tripleFromDate(addDays(tripleToDate(primary[0]), -1));
            sStart = tripleFromDate(addDays(tripleToDate(sEnd), -span));
        } else {
            sStart = jShift(primary[0], -1, 'year');
            sEnd = unit === 'week'
                ? tripleFromDate(addDays(tripleToDate(sStart), span))
                : jEndOf(sStart, unit);
        }

        return { primary: primary, secondary: [sStart, sEnd] };
    }

    /* ---------------------------------------------------------------------
     * The apiFetch middleware.
     *
     * This is what lets the preset buttons stay untouched: the URL still
     * says period=last_month, but every Analytics REST call leaves with
     * Jalali month boundaries instead of Gregorian ones.
     * ------------------------------------------------------------------ */

    function isoDay(date) {
        return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
    }

    function tripleToIsoDay(triple) {
        var g = jalaliToGregorian(triple[0], triple[1], triple[2]);
        return g[0] + '-' + pad(g[1]) + '-' + pad(g[2]);
    }

    // Swap the date part of a request value, keeping any "T00:00:00" suffix.
    function swapDatePart(value, isoDate) {
        return isoDate + String(value).slice(10);
    }

    /**
     * Rewrite the after/before pair of an Analytics REST request.
     *
     * @param {string} path Request path including its query string.
     * @return {string} The rewritten path.
     */
    function rewriteAnalyticsPath(path) {
        if (!path || path.indexOf('wc-analytics/') === -1) {
            return path;
        }

        var split = path.indexOf('?');

        if (split === -1) {
            return path;
        }

        var params = parseQuery(path.slice(split + 1));

        if (!params.after || !params.before) {
            return path;
        }

        var urlParams = parseQuery(window.location.search);

        if (!isAnalyticsScreen(urlParams)) {
            return path;
        }

        // An explicit custom range is already exactly what the user asked for.
        var preset = urlParams.period || 'month';

        if (preset === 'custom' || !PRESET_UNITS[preset]) {
            return path;
        }

        var compare = urlParams.compare || 'previous_year';
        var now = new Date();
        var greg = gregorianPresetRanges(preset, compare, now);
        var jal = jalaliPresetRanges(preset, compare, now);

        if (!greg || !jal) {
            return path;
        }

        var after = String(params.after).slice(0, 10);
        var before = String(params.before).slice(0, 10);
        var target = null;

        if (after === isoDay(greg.primaryStart) && before === isoDay(greg.primaryEnd)) {
            target = jal.primary;
        } else if (after === isoDay(greg.secondaryStart) && before === isoDay(greg.secondaryEnd)) {
            target = jal.secondary;
        }

        // Anything unrecognised is left strictly alone.
        if (!target) {
            return path;
        }

        // Remember what was really queried so the axes can be labelled from
        // the plotted range instead of WooCommerce's original one.
        var effective = [tripleToDate(target[0]), tripleToDate(target[1])];

        // The bucketing WooCommerce asked for decides how many points land on
        // the chart, so it is remembered alongside the range.
        if (params.interval) {
            perscaEffectiveRanges.interval = String(params.interval);
        }

        if (target === jal.primary) {
            perscaEffectiveRanges.primary = effective;
        } else {
            perscaEffectiveRanges.secondary = effective;
        }

        params.after = swapDatePart(params.after, tripleToIsoDay(target[0]));
        params.before = swapDatePart(params.before, tripleToIsoDay(target[1]));

        return path.slice(0, split) + '?' + buildQuery(params);
    }

    // Install the middleware on wp.apiFetch.
    function installFetchMiddleware() {
        var apiFetch = window.wp && window.wp.apiFetch;

        if (!apiFetch || !apiFetch.use) {
            return false;
        }

        if (apiFetch.perscaWooPatched) {
            return true;
        }

        apiFetch.use(function (options, next) {
            var requested = '';

            try {
                if (options && typeof options.path === 'string') {
                    options.path = rewriteAnalyticsPath(options.path);
                    requested = options.path;
                } else if (options && typeof options.url === 'string') {
                    options.url = rewriteAnalyticsPath(options.url);
                    requested = options.url;
                }
            } catch (e) {}

            var result = next(options);

            // Read the dates straight out of WooCommerce's own answer. Each
            // returned interval is exactly one plotted point, so the axes can
            // be labelled from real data instead of a locally rebuilt list.
            try {
                if (requested && requested.indexOf('wc-analytics/') !== -1 &&
                    result && typeof result.then === 'function') {
                    var qs = requested.indexOf('?');
                    var interval = qs === -1
                        ? ''
                        : (parseQuery(requested.slice(qs + 1)).interval || '');

                    result.then(function (response) {
                        try {
                            rememberResponseBuckets(response, interval);
                        } catch (e) {}

                        return response;
                    }, function () {});
                }
            } catch (e) {}

            return result;
        });

        apiFetch.perscaWooPatched = true;

        return true;
    }

    /**
     * Keep trying until wp.apiFetch exists.
     *
     * On the Analytics screens this script can be parsed before wp-api-fetch
     * is defined. The old code gave up silently in that case, so the very
     * first page load queried the Gregorian range (1-31 July) while the axis
     * was drawn in Jalali - which is why a couple of refreshes "fixed" it.
     *
     * @return {void}
     */
    function ensureFetchMiddleware() {
        if (installFetchMiddleware()) {
            return;
        }

        // Hook the exact moment WordPress assigns wp.apiFetch.
        try {
            window.wp = window.wp || {};

            if (!window.wp.perscaApiFetchHooked &&
                !Object.getOwnPropertyDescriptor(window.wp, 'apiFetch')) {
                var stored;

                Object.defineProperty(window.wp, 'apiFetch', {
                    configurable: true,
                    enumerable: true,
                    get: function () {
                        return stored;
                    },
                    set: function (value) {
                        stored = value;

                        try {
                            installFetchMiddleware();
                        } catch (e) {}
                    }
                });

                window.wp.perscaApiFetchHooked = true;
            }
        } catch (e) {}

        // Belt and braces: poll briefly in case the property was already
        // defined by another plugin's own accessor.
        var tries = 0;
        var timer = setInterval(function () {
            tries++;

            var done = false;

            try {
                done = installFetchMiddleware();
            } catch (e) {}

            if (done || tries > 200) {
                clearInterval(timer);
            }
        }, 25);
    }

    /**
     * Rewrite Analytics requests at the network layer too.
     *
     * wc-admin does not always go through wp.apiFetch (batched and preloaded
     * calls, and anything issued before the middleware chain is built), so the
     * same rewrite is applied to fetch() and XMLHttpRequest. Non wc-analytics
     * traffic is passed straight through.
     *
     * @return {void}
     */
    function patchNetworkLayer() {
        function rewriteUrl(url) {
            try {
                if (typeof url === 'string' && url.indexOf('wc-analytics/') !== -1) {
                    return rewriteAnalyticsPath(url);
                }
            } catch (e) {}

            return url;
        }

        if (window.fetch && !window.fetch.perscaWooPatched) {
            var originalFetch = window.fetch;

            var patchedFetch = function (input, init) {
                try {
                    if (typeof input === 'string') {
                        input = rewriteUrl(input);
                    } else if (input && typeof input.url === 'string' &&
                        input.url.indexOf('wc-analytics/') !== -1 &&
                        typeof Request !== 'undefined') {
                        var next = rewriteUrl(input.url);

                        if (next !== input.url) {
                            input = new Request(next, input);
                        }
                    }
                } catch (e) {}

                return originalFetch.call(this, input, init);
            };

            patchedFetch.perscaWooPatched = true;
            window.fetch = patchedFetch;
        }

        if (window.XMLHttpRequest && window.XMLHttpRequest.prototype &&
            !window.XMLHttpRequest.prototype.open.perscaWooPatched) {
            var originalOpen = window.XMLHttpRequest.prototype.open;

            var patchedOpen = function (method, url) {
                var args = Array.prototype.slice.call(arguments);

                args[1] = rewriteUrl(url);

                return originalOpen.apply(this, args);
            };

            patchedOpen.perscaWooPatched = true;
            window.XMLHttpRequest.prototype.open = patchedOpen;
        }
    }

    /**
     * Replace the text between the outer parentheses of a caption.
     *
     * The prefix ("Month to date", "vs. Previous period") is WooCommerce's
     * own translation and is deliberately left alone - only the date range
     * inside the brackets is ours to correct.
     *
     * @param {Element} span        The caption element.
     * @param {string} replacement  The Jalali range to write.
     * @return {boolean} True when this really was a date caption.
     */
    function replaceBracketedRange(span, replacement) {
        if (!span || !replacement) {
            return false;
        }

        var text = span.textContent || '';
        var open = text.indexOf('(');
        var close = text.lastIndexOf(')');

        if (open === -1 || close <= open + 1) {
            return false;
        }

        // Guard against unrelated dropdowns: a date caption has digits.
        if (!(new RegExp(DIGIT_CLASS)).test(text.slice(open + 1, close))) {
            return false;
        }

        var next = text.slice(0, open + 1) + replacement + text.slice(close);

        if (span.textContent !== next) {
            span.textContent = next;
        }

        return true;
    }

    /**
     * Correct the date-range dropdown caption.
     *
     * The markup is a single labels wrapper holding two captions:
     *   <span>Month to date (Jul 1 - 30, 2026)</span>
     *   <span>vs. Previous period (Jun 1 - 30, 2026)</span>
     *
     * WooCommerce prints the Gregorian range it computed, but the data on
     * screen covers the Jalali range, so both brackets are rewritten.
     */
    function restorePresetLabel() {
        var params = parseQuery(window.location.search);

        if (!isAnalyticsScreen(params)) {
            return;
        }

        var preset = params.period || 'month';

        if (preset === 'custom' || !PRESET_UNITS[preset]) {
            return;
        }

        var ranges = jalaliPresetRanges(preset, params.compare || 'previous_year', new Date());

        if (!ranges) {
            return;
        }

        var texts = [
            formatJalaliRange(ranges.primary[0], ranges.primary[1]),
            formatJalaliRange(ranges.secondary[0], ranges.secondary[1])
        ];

        var groups = document.querySelectorAll('.woocommerce-dropdown-button__labels');

        Array.prototype.forEach.call(groups, function (group) {
            var spans = group.querySelectorAll('span');
            var limit = Math.min(spans.length, texts.length);
            var touched = false;
            var i;

            for (i = 0; i < limit; i++) {
                if (replaceBracketedRange(spans[i], texts[i])) {
                    touched = true;
                }
            }

            // Own these captions so the generic localizer cannot convert the
            // Gregorian original back over the top of them.
            if (touched && group.getAttribute('data-persca-skip') !== '1') {
                group.setAttribute('data-persca-skip', '1');
            }
        });

        restoreLegendLabels(texts);
    }

    /**
     * Correct the chart legend captions.
     *
     * Each legend row reads "Last month (Jun 1 - 30, 2026)". The generic text
     * pass converts that Gregorian range literally and prints
     * "11 Khordad - 9 Tir", but the series actually plots the Jalali month the
     * REST request was moved onto, so the whole bracket has to be replaced.
     *
     * @param {string[]} texts [primary, secondary] Jalali ranges.
     */
    function restoreLegendLabels(texts) {
        var lists = document.querySelectorAll('.woocommerce-legend__list');

        Array.prototype.forEach.call(lists, function (list) {
            var items = list.querySelectorAll('.woocommerce-legend__item');

            Array.prototype.forEach.call(items, function (item, index) {
                var id = item.getAttribute('id') || '';
                var which = index;

                if (id.indexOf('__secondary') !== -1) {
                    which = 1;
                } else if (id.indexOf('__primary') !== -1) {
                    which = 0;
                }

                if (which > 1 || !texts[which]) {
                    return;
                }

                var title = item.querySelector('.woocommerce-legend__item-title');

                if (!replaceBracketedRange(title, texts[which])) {
                    return;
                }

                // Own the caption so the generic localizer leaves it alone.
                if (title.getAttribute('data-persca-skip') !== '1') {
                    title.setAttribute('data-persca-skip', '1');
                }
            });
        });
    }

    /**
     * Watch SPA navigation so a preset chosen inside the app is corrected too.
     */
    function watchHistory() {
        if (!window.history || !window.history.pushState || window.history.perscaWatched) {
            return;
        }

        ['pushState', 'replaceState'].forEach(function (method) {
            var original = window.history[method];

            window.history[method] = function () {
                var result = original.apply(this, arguments);

                setTimeout(restorePresetLabel, 0);

                return result;
            };
        });

        window.addEventListener('popstate', function () {
            restorePresetLabel();
        });

        window.history.perscaWatched = true;
    }

    // Must be in place before the React app issues its first report request.
    try {
        patchNetworkLayer();
        ensureFetchMiddleware();
        watchHistory();
    } catch (e) {}

    /* =========================================================================
     * LAYER 3 - Bootstrapping and dynamic content
     * ====================================================================== */

    $(function () {
        wrapFlot();
        scanDateFields(document);
        localizeAnalytics();

        // The tooltip markup is rebuilt on every hover.
        $(document.body).on('mouseover focusin', '.d3-chart__container, .woocommerce-chart', function () {
            localizeAnalytics();
        });

        // WooCommerce re-initialises pickers through these custom events after
        // adding variations, order items or download permission rows.
        $(document.body).on(
            'wc-init-datepickers woocommerce_variations_loaded woocommerce_variations_added wc_backbone_modal_loaded',
            function () {
                setTimeout(function () {
                    scanDateFields(document);
                    localizeAnalytics();
                }, 30);
            }
        );
    });

    $(document).ajaxComplete(function () {
        setTimeout(function () {
            scanDateFields(document);
            localizeAnalytics();
        }, 60);
    });

    if (typeof MutationObserver !== 'undefined') {
        $(function () {
            var target = document.getElementById('wpbody-content') || document.body;
            if (!target) {
                return;
            }

            var pending = null;

            /**
             * Collect every element matching a selector that a batch of
             * mutations touched: walking up from the mutated node, and down
             * through whatever was added.
             *
             * @param {MutationRecord[]} mutations The batch.
             * @param {string} selector CSS selector to match.
             * @return {Element[]} Unique matches.
             */
            function collectMatching(mutations, selector) {
                var found = [];

                function push(el) {
                    if (el && -1 === found.indexOf(el)) {
                        found.push(el);
                    }
                }

                function fromNode(node) {
                    var el = node;

                    while (el && el !== target) {
                        if (1 === el.nodeType && el.matches(selector)) {
                            push(el);
                            break;
                        }

                        el = el.parentNode;
                    }

                    if (node && node.querySelectorAll) {
                        var inner = node.querySelectorAll(selector);

                        for (var q = 0; q < inner.length; q++) {
                            push(inner[q]);
                        }
                    }
                }

                for (var i = 0; i < mutations.length; i++) {
                    fromNode(mutations[i].target);

                    var addedNodes = mutations[i].addedNodes;

                    for (var a = 0; addedNodes && a < addedNodes.length; a++) {
                        if (addedNodes[a] && 1 === addedNodes[a].nodeType) {
                            fromNode(addedNodes[a]);
                        }
                    }
                }

                return found;
            }

            var observer = new MutationObserver(function (mutations) {
                var added = false;

                for (var i = 0; i < mutations.length; i++) {
                    if (mutations[i].addedNodes && mutations[i].addedNodes.length) {
                        added = true;
                        break;
                    }
                }

                // Chart tooltips are rebuilt on every hover. Converting them
                // right here - inside the observer microtask, which runs
                // BEFORE the browser paints - is what stops the Gregorian
                // text from flashing up for a frame. Anything on a timer,
                // however short, is a visible jump.
                var tooltips = collectMatching(mutations, '.d3-chart__tooltip');

                for (var k = 0; k < tooltips.length; k++) {
                    try {
                        localizeTextNodes(tooltips[k]);
                    } catch (e) {}
                }

                // A custom range is not a preset, so restorePresetLabel()
                // leaves its caption to the generic text pass. React rewrites
                // that caption the moment "Update" is pressed, and on the
                // settling timer the Gregorian range shows for a frame first.
                // Converting it here - still before the paint - removes the
                // jump. Preset captions carry data-persca-skip="1", so this
                // pass steps over them.
                var captions = collectMatching(mutations, '.woocommerce-dropdown-button__labels');

                for (var d = 0; d < captions.length; d++) {
                    try {
                        localizeTextNodes(captions[d]);
                    } catch (e) {}
                }

                if (!added) {
                    return;
                }

                // Same reasoning as the tooltips above. React mounts the date
                // picker and the status bar the instant the dropdown opens, so
                // they have to be converted here, inside the observer
                // microtask, before the browser paints. On a timer - however
                // short - the Gregorian version shows for a frame and the UI
                // visibly jumps to Jalali afterwards.
                try {
                    installJalaliCalendars(document);
                } catch (e) {}

                try {
                    localizeImportStatusBar(document);
                } catch (e) {}

                // The range dropdown caption is re-rendered by React with its
                // own Gregorian brackets, so it is rewritten here too - before
                // the paint - instead of on the settling timer.
                try {
                    restorePresetLabel();
                } catch (e) {}

                // Charts are rebuilt on every range change. Converting their
                // axes here rather than on the timer is what stops the
                // Gregorian labels from showing for a frame first.
                var charts = collectMatching(mutations, '.d3-chart__container, .woocommerce-chart');

                if (charts.length) {
                    try {
                        localizeChartAxes(document);
                    } catch (e) {}

                    for (var c = 0; c < charts.length; c++) {
                        try {
                            localizeTextNodes(charts[c]);
                        } catch (e) {}
                    }
                }

                clearTimeout(pending);
                pending = setTimeout(function () {
                    scanDateFields(document);
                    localizeAnalytics();
                }, 80);
            });

            observer.observe(target, { childList: true, subtree: true, characterData: true });
        });
    }
    /* =========================================================================
     * LAYER 6 - A Jalali range picker for the Analytics date filter
     *
     * WooCommerce draws a react-dates DayPicker there. Its week header is
     * Sunday-first, its day numbers are Gregorian and its captions come from
     * an English format string, so only the month caption was ever getting
     * localised. The widget is hidden (never unmounted, so React keeps owning
     * its own nodes) and a real Jalali grid is drawn next to it.
     *
     * The two text inputs stay exactly as WooCommerce made them, because its
     * React state is what parses them; picking a day writes the Gregorian
     * value back through the native setter so WooCommerce reacts as if the
     * user had typed it.
     * ====================================================================== */

    var PERSCA_WEEKDAYS = [
        '\u0634',
        '\u06CC',
        '\u062F',
        '\u0633',
        '\u0686',
        '\u067E',
        '\u062C'
    ];

    /**
     * @param {number} jy Jalali year.
     * @param {number} jm Jalali month (1-12).
     * @param {number} jd Jalali day.
     * @return {Date} The same day on the Gregorian calendar.
     */
    function jalaliToDate(jy, jm, jd) {
        return tripleToDate([jy, jm, jd]);
    }

    /**
     * @param {Date} date A Gregorian date.
     * @return {number[]} [jy, jm, jd]
     */
    function dateToJalali(date) {
        return gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
    }

    /**
     * Length of a Jalali month, measured rather than assumed so leap years
     * (Esfand with 30 days) come out right.
     *
     * @param {number} jy Jalali year.
     * @param {number} jm Jalali month (1-12).
     * @return {number} Number of days.
     */
    function jalaliMonthLength(jy, jm) {
        var nextYear = 12 === jm ? jy + 1 : jy;
        var nextMonth = 12 === jm ? 1 : jm + 1;

        return daysBetween(jalaliToDate(jy, jm, 1), jalaliToDate(nextYear, nextMonth, 1));
    }

    function startOfToday() {
        var now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    /**
     * The date order WooCommerce expects in its inputs, read from the
     * placeholder it rendered (mm/dd/yyyy, dd/mm/yyyy, yyyy-mm-dd ...).
     *
     * @param {Element} input The text input.
     * @return {Object} { tokens, separator }
     */
    function calendarFormat(input) {
        // The placeholder attribute itself is replaced with a Jalali hint, so
        // the original format string is kept on data-persca-format.
        var raw = (input && (
            input.getAttribute('data-persca-format') ||
            input.getAttribute('placeholder')
        )) || 'mm/dd/yyyy';

        raw = toAsciiDigits(String(raw)).toLowerCase();

        var separatorMatch = raw.match(/[^a-z]/);
        var separator = separatorMatch ? separatorMatch[0] : '/';
        var parts = raw.split(separator);
        var tokens = [];

        for (var i = 0; i < parts.length; i++) {
            var first = parts[i].charAt(0);

            if ('m' === first || 'd' === first || 'y' === first) {
                tokens.push(first);
            }
        }

        if (3 !== tokens.length) {
            return { tokens: ['m', 'd', 'y'], separator: '/' };
        }

        return { tokens: tokens, separator: separator };
    }

    /**
     * @param {Date} date    Date to write.
     * @param {Element} input Input whose format should be matched.
     * @return {string} The Gregorian value WooCommerce understands.
     */
    function formatForInput(date, input) {
        var format = calendarFormat(input);
        var out = [];

        for (var i = 0; i < format.tokens.length; i++) {
            if ('y' === format.tokens[i]) {
                out.push(String(date.getFullYear()));
            } else if ('m' === format.tokens[i]) {
                out.push(pad(date.getMonth() + 1));
            } else {
                out.push(pad(date.getDate()));
            }
        }

        return out.join(format.separator);
    }

    /**
     * Read an input back into a Date. Jalali years (1200-1700) are accepted
     * too, so a hand typed Jalali date still works.
     *
     * @param {Element} input The text input.
     * @return {Date|null} The parsed day.
     */
    function parseFromInput(input) {
        if (!input || !input.value) {
            return null;
        }

        var format = calendarFormat(input);
        var raw = toAsciiDigits(String(input.value)).split(/[^0-9]+/);
        var numbers = [];
        var i;

        for (i = 0; i < raw.length; i++) {
            if ('' !== raw[i]) {
                numbers.push(parseInt(raw[i], 10));
            }
        }

        if (3 !== numbers.length) {
            return null;
        }

        var year = 0;
        var month = 0;
        var day = 0;

        for (i = 0; i < 3; i++) {
            if ('y' === format.tokens[i]) {
                year = numbers[i];
            } else if ('m' === format.tokens[i]) {
                month = numbers[i];
            } else {
                day = numbers[i];
            }
        }

        if (!year || !month || !day || month > 12 || day > 31) {
            return null;
        }

        if (year >= 1200 && year <= 1700) {
            return jalaliToDate(year, month, day);
        }

        return new Date(year, month - 1, day);
    }

    /**
     * Write a value into a React controlled input so its state updates.
     *
     * Assigning input.value directly is swallowed by React; going through the
     * prototype setter and firing a bubbling input event is what makes
     * WooCommerce see the change.
     *
     * @param {Element} input The text input.
     * @param {string} value  The new value.
     * @param {boolean} [forceEvent] Force dispatching input event even if value matches.
     * @return {void}
     */
    function setReactInputValue(input, value, forceEvent) {
        if (!input) {
            return;
        }

        var valueChanged = input.value !== value;

        if (valueChanged) {
            var proto = window.HTMLInputElement && window.HTMLInputElement.prototype;
            var descriptor = proto ? Object.getOwnPropertyDescriptor(proto, 'value') : null;

            if (descriptor && descriptor.set) {
                descriptor.set.call(input, value);
            } else {
                input.value = value;
            }
        } else if (!forceEvent) {
            return;
        }

        var event;

        try {
            event = new Event('input', { bubbles: true });
        } catch (e) {
            event = document.createEvent('Event');
            event.initEvent('input', true, true);
        }

        input.dispatchEvent(event);
    }

    function calendarInputs(root) {
        return root.querySelectorAll('.woocommerce-calendar__input-text');
    }

    function sameDay(a, b) {
        return !!a && !!b && a.getTime() === b.getTime();
    }

    /**
     * Draw the Jalali month currently in view.
     *
     * @param {Element} root The .woocommerce-calendar element.
     * @return {void}
     */
    function renderJalaliCalendar(root) {
        var state = root.perscaCal;

        if (!state || !state.host) {
            return;
        }

        var inputs = calendarInputs(root);
        var startInput = inputs[0] || null;
        var endInput = inputs[1] || null;
        var selStart = parseFromInput(startInput);
        var selEnd = parseFromInput(endInput);

        // A day that was just clicked is drawn from the click itself, not from
        // the inputs: WooCommerce's React state lands one task later, and
        // waiting for it made the grid repaint twice - the small jump.
        if (state.forced) {
            selStart = state.forced[0];
            selEnd = state.forced[1];
        }

        // While a new range is being picked the pending day is the start and
        // the hovered day previews the end.
        if (state.pending) {
            selStart = state.pending;
            selEnd = state.hover && state.hover.getTime() > state.pending.getTime() ? state.hover : null;
        }

        var today = startOfToday();
        var view = state.view;

        if (!view) {
            view = dateToJalali(selStart || today);
            state.view = [view[0], view[1]];
            view = state.view;
        }

        var signature = [
            selStart ? selStart.getTime() : '',
            selEnd ? selEnd.getTime() : '',
            startInput ? startInput.value : '',
            endInput ? endInput.value : '',
            view[0],
            view[1],
            state.pending ? state.pending.getTime() : '',
            state.hover ? state.hover.getTime() : ''
        ].join('|');

        if (signature === state.signature) {
            return;
        }

        state.signature = signature;

        var total = jalaliMonthLength(view[0], view[1]);
        var firstDate = jalaliToDate(view[0], view[1], 1);

        // Saturday is the first column of a Jalali week.
        var lead = (firstDate.getDay() + 1) % 7;
        var html = '';
        var i;

        html += '<div class="persca-wc-cal__nav">';
        html += '<button type="button" class="persca-wc-cal__nav-btn" data-persca-nav="prev" aria-label="\u0645\u0627\u0647 \u0642\u0628\u0644">\u2039</button>';
        html += '<div class="persca-wc-cal__caption">' +
            jalaliMonthName(view[1]) + ' ' + maybeDigits(view[0]) +
            '</div>';
        html += '<button type="button" class="persca-wc-cal__nav-btn" data-persca-nav="next" aria-label="\u0645\u0627\u0647 \u0628\u0639\u062F">\u203A</button>';
        html += '</div>';

        html += '<div class="persca-wc-cal__weekdays">';

        for (i = 0; i < 7; i++) {
            html += '<div class="persca-wc-cal__weekday' + (6 === i ? ' is-holiday' : '') + '">' +
                PERSCA_WEEKDAYS[i] + '</div>';
        }

        html += '</div><div class="persca-wc-cal__grid">';

        for (i = 0; i < lead; i++) {
            html += '<span class="persca-wc-cal__day is-empty"></span>';
        }

        for (i = 1; i <= total; i++) {
            var date = jalaliToDate(view[0], view[1], i);
            var time = date.getTime();
            var classes = ['persca-wc-cal__day'];
            var future = time > today.getTime();

            // Friday is the last column of a Jalali week.
            if (6 === (date.getDay() + 1) % 7) {
                classes.push('is-holiday');
            }

            if (sameDay(date, selStart) || sameDay(date, selEnd)) {
                classes.push('is-selected');
            } else if (selStart && selEnd && time > selStart.getTime() && time < selEnd.getTime()) {
                classes.push('is-in-range');
            }

            html += '<button type="button" class="' + classes.join(' ') + '"' +
                ' data-persca-day="' + view[0] + '-' + view[1] + '-' + i + '"' +
                (future ? ' disabled' : '') + '>' + maybeDigits(i) + '</button>';
        }

        html += '</div>';

        // Skip the DOM write when the markup is unchanged, so the settling
        // pass after a click cannot flicker the grid.
        if (html !== state.lastHtml) {
            state.host.innerHTML = html;
            state.lastHtml = html;
        }

        updateInputShadows(root, selStart, selEnd);
    }

    // Jalali stand in for WooCommerce's mm/dd/yyyy placeholder.
    var PERSCA_WC_DATE_PLACEHOLDER = '\u0633\u0627\u0644/\u0645\u0627\u0647/\u0631\u0648\u0632';

    /**
     * Swap WooCommerce's mm/dd/yyyy placeholder attribute for a Jalali one,
     * keeping the original format string on data-persca-format so the value
     * written back for WooCommerce still matches its expected order.
     *
     * @param {Element} input The text input.
     * @return {void}
     */
    function jalaliPlaceholder(input) {
        if (!input || !input.getAttribute) {
            return;
        }

        var current = input.getAttribute('placeholder') || '';

        if (current === PERSCA_WC_DATE_PLACEHOLDER) {
            return;
        }

        if (current) {
            input.setAttribute('data-persca-format', current);
        }

        input.setAttribute('placeholder', PERSCA_WC_DATE_PLACEHOLDER);
    }

    /**
     * WooCommerce sometimes latches an error state on a field even though the
     * range we handed it is perfectly valid. Drop the flag unconditionally on
     * every wrapper so a stale class from a previous validation pass cannot
     * stick around.
     *
     * @param {Element} root The .woocommerce-calendar element.
     * @return {void}
     */
    function clearFalseErrors(root) {
        var inputs = calendarInputs(root);

        for (var i = 0; i < inputs.length && i < 2; i++) {
            var wrapper = inputs[i].parentNode;

            if (wrapper && wrapper.classList) {
                wrapper.classList.remove('is-error');
            }
        }
    }

    /**
     * Detect when WooCommerce (React) has cleared / reset the date inputs and
     * bring our own state + shadow overlays back in sync.
     *
     * Called from a low-frequency poll because React sets input.value via the
     * JS property setter, which does not trigger DOM attribute mutations.
     *
     * @param {Element} root The .woocommerce-calendar element.
     * @return {void}
     */
    function syncFromReact(root) {
        var state = root.perscaCal;

        if (!state) {
            return;
        }

        var inputs = calendarInputs(root);
        var startVal = inputs[0] ? inputs[0].value : '';
        var endVal = inputs[1] ? inputs[1].value : '';

        // Nothing changed since last poll → skip.
        if (startVal === state.lastSyncStart && endVal === state.lastSyncEnd) {
            return;
        }

        state.lastSyncStart = startVal;
        state.lastSyncEnd = endVal;

        // Both inputs cleared → WooCommerce reset the picker.
        if (!startVal && !endVal) {
            state.pending = null;
            state.hover = null;
            state.forced = null;
            state.signature = '';
            updateInputShadows(root, null, null);
            renderJalaliCalendar(root);
            return;
        }

        // Values changed externally (preset pick, URL nav) → refresh.
        if (!state.forced && !state.pending) {
            state.signature = '';
            renderJalaliCalendar(root);
        }
    }

    /**
     * Keep the Jalali text shown over each Gregorian input in step.
     *
     * @param {Element} root     The .woocommerce-calendar element.
     * @param {Date|null} start  Start of the range.
     * @param {Date|null} end    End of the range.
     * @return {void}
     */
    function updateInputShadows(root, start, end) {
        var inputs = calendarInputs(root);
        var values = [start, end];

        for (var i = 0; i < inputs.length && i < 2; i++) {
            var input = inputs[i];
            var wrapper = input.parentNode;

            if (!wrapper || !wrapper.classList) {
                continue;
            }

            jalaliPlaceholder(input);

            var shadow = wrapper.querySelector('.persca-wc-cal__shadow');

            if (!shadow) {
                shadow = document.createElement('span');
                shadow.className = 'persca-wc-cal__shadow';
                shadow.setAttribute('aria-hidden', 'true');
                wrapper.appendChild(shadow);
            }

            var text = '';

            if (values[i]) {
                var j = dateToJalali(values[i]);
                text = maybeDigits(j[0] + '/' + pad(j[1]) + '/' + pad(j[2]));
            }

            if (text) {
                shadow.classList.remove('is-placeholder');
            } else {
                text = PERSCA_WC_DATE_PLACEHOLDER;
                shadow.classList.add('is-placeholder');
            }

            if (shadow.textContent !== text) {
                shadow.textContent = text;
            }

            shadow.style.display = '';
        }
    }

    /**
     * Apply a clicked day to WooCommerce's own inputs.
     *
     * @param {Element} root The .woocommerce-calendar element.
     * @param {Date} date    The clicked day.
     * @return {void}
     */
    function pickJalaliDay(root, date) {
        var state = root.perscaCal;
        var inputs = calendarInputs(root);
        var startInput = inputs[0];
        var endInput = inputs[1];

        if (!startInput || !endInput) {
            return;
        }

        // WooCommerce's own React state updates asynchronously after each
        // dispatched input event. Writing both fields in the same tick lets
        // the second field's change handler run against a stale first value,
        // which is what makes WooCommerce flag a valid range with is-error
        // every once in a while. Deferring the second write to its own task
        // gives React time to finish reconciling the first one.
        if (!state.pending || date.getTime() < state.pending.getTime()) {
            state.pending = date;
            state.hover = null;
            state.forced = [date, null];

            // Clear endInput first so startInput is never evaluated as greater than a stale end date
            setReactInputValue(endInput, '', true);
            setReactInputValue(startInput, formatForInput(date, startInput), true);

            window.setTimeout(function () {
                setReactInputValue(endInput, '', true);
                root.perscaCal.forced = null;
                root.perscaCal.signature = '';
                renderJalaliCalendar(root);
                clearFalseErrors(root);
            }, 0);
        } else {
            var start = state.pending;
            var end = date;

            state.pending = null;
            state.hover = null;
            state.forced = [start, end];
            setReactInputValue(startInput, formatForInput(start, startInput), true);

            var endValue = formatForInput(end, endInput);

            window.setTimeout(function () {
                setReactInputValue(endInput, endValue, true);
                root.perscaCal.forced = null;
                root.perscaCal.signature = '';
                renderJalaliCalendar(root);
                clearFalseErrors(root);

                // React re-validates asynchronously; clear again after it
                // settles so a stale is-error cannot stick.
                window.setTimeout(function () {
                    clearFalseErrors(root);
                }, 50);
            }, 0);
        }

        state.signature = '';
        renderJalaliCalendar(root);
    }

    function parseDayAttribute(value) {
        var parts = String(value || '').split('-');

        if (3 !== parts.length) {
            return null;
        }

        return jalaliToDate(
            parseInt(parts[0], 10),
            parseInt(parts[1], 10),
            parseInt(parts[2], 10)
        );
    }

    /**
     * Put the Jalali grid in place, once per calendar.
     *
     * @param {Element} root The .woocommerce-calendar element.
     * @return {void}
     */
    /**
     * Keep the Analytics dropdown open while the Jalali grid is in charge.
     *
     * WooCommerce bounces focus back into the react-dates grid whenever it
     * leaves. That grid is hidden here, and Reset (بازگردانی) also resets
     * focusedInput, so focus lands on <body>. Gutenberg's Popover reads that
     * as "focus moved outside" and unmounts the whole dropdown - on desktop a
     * field usually still holds focus, which is why it only shows up on touch.
     * Hand focus back to the calendar instead.
     *
     * @param {Element} root Calendar root.
     * @param {Element} host Injected Jalali grid.
     * @return {void}
     */
    function installPopoverFocusGuard(root, host) {
        var popover = null;
        var node = root;

        while (node && node.classList) {
            if (node.classList.contains('woocommerce-filters-date__content') ||
                node.classList.contains('components-popover__content')) {
                popover = node;
                break;
            }

            node = node.parentNode;
        }

        if (!popover || popover.perscaFocusGuard) {
            return;
        }

        popover.perscaFocusGuard = true;

        popover.addEventListener('focusout', function (event) {
            if (event.relatedTarget && popover.contains(event.relatedTarget)) {
                return;
            }

            window.setTimeout(function () {
                var active = document.activeElement;

                if (active && active !== document.body && popover.contains(active)) {
                    return;
                }

                if (!document.body.contains(host) || !document.body.contains(popover)) {
                    return;
                }

                try {
                    host.focus({ preventScroll: true });
                } catch (e) {
                    try {
                        host.focus();
                    } catch (e2) {}
                }
            }, 0);
        });
    }

    function installJalaliCalendar(root) {
        var reactDates = root.querySelector('.woocommerce-calendar__react-dates');

        if (!reactDates) {
            return;
        }

        var state = root.perscaCal;

        if (state && state.host && state.host.parentNode) {
            renderJalaliCalendar(root);
            return;
        }

        var host = document.createElement('div');

        host.className = 'persca-wc-cal';
        host.setAttribute('dir', 'rtl');
        // Focus anchor: see the focus guard below.
        host.tabIndex = -1;
        reactDates.parentNode.insertBefore(host, reactDates.nextSibling);

        installPopoverFocusGuard(root, host);

        root.perscaCal = {
            host: host,
            view: state ? state.view : null,
            pending: null,
            hover: null,
            signature: ''
        };

        host.addEventListener('click', function (event) {
            var target = event.target;

            while (target && target !== host && !target.getAttribute) {
                target = target.parentNode;
            }

            if (!target || target === host) {
                return;
            }

            var nav = target.getAttribute('data-persca-nav');

            if (nav) {
                event.preventDefault();

                var view = root.perscaCal.view;
                var step = 'prev' === nav ? -1 : 1;
                var month = view[1] + step;
                var year = view[0];

                if (month < 1) {
                    month = 12;
                    year -= 1;
                } else if (month > 12) {
                    month = 1;
                    year += 1;
                }

                root.perscaCal.view = [year, month];
                root.perscaCal.signature = '';
                renderJalaliCalendar(root);

                return;
            }

            var day = target.getAttribute('data-persca-day');

            if (day && !target.disabled) {
                event.preventDefault();

                var date = parseDayAttribute(day);

                if (date) {
                    pickJalaliDay(root, date);
                }
            }
        });

        host.addEventListener('pointerdown', function (event) {
            if (root.perscaCal) {
                root.perscaCal.lastPointer = event.pointerType || 'mouse';
            }
        });

        // Touch has no hover, so the range preview is driven by the finger:
        // press the first day, slide over the grid, lift on the last day.
        host.addEventListener('touchmove', function (event) {
            var state2 = root.perscaCal;

            if (!state2 || !state2.pending || !event.touches || !event.touches.length) {
                return;
            }

            var touch = event.touches[0];
            var over = document.elementFromPoint(touch.clientX, touch.clientY);
            var day = over && over.getAttribute ? over.getAttribute('data-persca-day') : null;

            if (!day || (over.disabled)) {
                return;
            }

            var next = parseDayAttribute(day);

            if (!next) {
                return;
            }

            if (event.cancelable) {
                event.preventDefault();
            }

            state2.touchDragged = true;

            if (state2.hover && state2.hover.getTime() === next.getTime()) {
                return;
            }

            state2.hover = next;
            renderJalaliCalendar(root);
        }, { passive: false });

        host.addEventListener('touchend', function (event) {
            var state2 = root.perscaCal;

            if (!state2 || !state2.touchDragged) {
                return;
            }

            state2.touchDragged = false;

            var target = state2.hover;

            if (!target) {
                return;
            }

            // The finger left the grid somewhere other than where it started,
            // so the browser will not fire a usable click. Close the range here
            // and swallow the synthetic click that may follow.
            if (event.cancelable) {
                event.preventDefault();
            }

            pickJalaliDay(root, target);
        });

        host.addEventListener('mouseover', function (event) {
            var state2 = root.perscaCal;

            if (!state2.pending || !event.target || !event.target.getAttribute) {
                return;
            }

            // A tap emits a synthetic mouseover; it must not preview a range.
            if ('touch' === state2.lastPointer) {
                return;
            }

            var day = event.target.getAttribute('data-persca-day');

            if (!day) {
                return;
            }

            state2.hover = parseDayAttribute(day);
            renderJalaliCalendar(root);
        });

        // The fields are a read only display of the picked range. Dates are
        // chosen on the grid, so WooCommerce never sees half finished text
        // and can no longer flag a valid range with is-error.
        var inputs = calendarInputs(root);

        for (var i = 0; i < inputs.length; i++) {
            if (inputs[i].perscaCalBound) {
                continue;
            }

            inputs[i].perscaCalBound = true;
            inputs[i].readOnly = true;
            jalaliPlaceholder(inputs[i]);
        }

        renderJalaliCalendar(root);

        // React sets input.value through the JS property, not the DOM
        // attribute, so a MutationObserver on `value` never fires. Poll
        // the inputs at a low frequency instead. The interval self-clears
        // when the calendar is removed from the DOM (tab switch, navigation).
        if (!root.perscaSyncInterval) {
            root.perscaSyncInterval = setInterval(function () {
                // Self-clean when the calendar is no longer in the document.
                if (!document.body.contains(root)) {
                    clearInterval(root.perscaSyncInterval);
                    root.perscaSyncInterval = null;
                    return;
                }

                syncFromReact(root);
                clearFalseErrors(root);
            }, 120);
        }
    }

    /**
     * Find every Analytics calendar on the page and keep it Jalali.
     *
     * @param {Element|Document} scope Where to look.
     * @return {void}
     */
    function installJalaliCalendars(scope) {
        var roots = (scope || document).querySelectorAll('.woocommerce-calendar');

        for (var i = 0; i < roots.length; i++) {
            try {
                installJalaliCalendar(roots[i]);
            } catch (e) {}
        }
    }

})(jQuery);
