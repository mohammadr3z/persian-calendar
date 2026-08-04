/**
 * Easy Digital Downloads (EDD) Integration for Persian Calendar
 *
 * Built against EDD 3.6.9 source. Three independent layers:
 *
 *  1. DATE PICKERS - every "input.edd_datepicker" (discount start/expiration,
 *     order date, customer "Customer Since", reports custom From/To, list-table
 *     and exporter From/To fields) is replaced with the plugin's Jalali picker.
 *     The visible field shows Jalali; a hidden field submits Gregorian ISO, so
 *     EDD keeps storing/querying real Gregorian dates.
 *
 *  2. CHARTS - EDD renders every report graph through window.edd.renderChart()
 *     which builds a Chart.js v2 chart with a type:"time" x-axis formatted by
 *     the bundled Moment date adapter. We wrap renderChart and override
 *     Chart._adapters._date.format so axis ticks AND tooltips print Jalali.
 *     (The Moment adapter registers itself at the end of chartjs.min.js load,
 *     so we must apply our override right before a chart is created - hence the
 *     renderChart wrapper rather than a plain window.Chart trap.)
 *
 *  3. TEXT - the reports date-range labels ("July 1, 2026 - July 20, 2026") are
 *     printed server-side via Carbon->format(), bypassing WP date_i18n, so we
 *     localize those printed Gregorian dates to Jalali in the DOM.
 *
 * Depends on: jquery, persian-calendar.js (window.PersianCalendarIntegrations).
 */
(function ($) {
    'use strict';

    var settings = window.perscaEdd || {};
    var usePersianDigits = settings.persianDigits === '1';
    var isEddPage = settings.isEddPage === '1';

    var originalDatepicker = null;

    var converter = window.PersianDateConverter || {};
    var PERSIAN_MONTHS = converter.PERSIAN_MONTHS || [];

    function toPersianDigits(str) {
        return converter.toPersianDigits ? converter.toPersianDigits(str) : String(str);
    }

    function pad(n) {
        return converter.padZero ? converter.padZero(n) : (String(n).length < 2 ? '0' + n : String(n));
    }

    function maybeDigits(str) {
        return usePersianDigits ? toPersianDigits(str) : str;
    }

    // Gregorian -> Jalali conversion using core converter.
    function gregorianToJalali(gy, gm, gd) {
        return converter.gregorianToJalali ? converter.gregorianToJalali(gy, gm, gd) : [gy, gm, gd];
    }

    /* =========================================================================
     * Layer 1 - Datepicker override for input.edd_datepicker
     * ====================================================================== */
    function isEddDateField($el) {
        return $el.hasClass('edd_datepicker');
    }

    function attachJalali($input) {
        if (!window.PersianCalendarIntegrations) {
            return false;
        }
        if ($input.data('persian-calendar-init')) {
            return true;
        }
        if ($input.hasClass('hasDatepicker') && originalDatepicker) {
            try {
                originalDatepicker.call($input, 'destroy');
            } catch (e) {}
            $input.removeClass('hasDatepicker');
        }
        // EDD date pickers are date-only (no time component).
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
            if (isEddDateField($input)) {
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
            get: function () { return customDatepicker; },
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

    function scanDateFields(context) {
        var $ctx = context ? $(context) : $(document);
        $ctx.find('input.edd_datepicker').each(function () {
            var $input = $(this);
            if (!$input.data('persian-calendar-init')) {
                attachJalali($input);
            }
        });
    }

    /* =========================================================================
     * Layer 2 - Jalali axis + tooltips for EDD report charts (Chart.js v2).
     * ====================================================================== */
    function jalaliChartFormat(time, fmt) {
        var gy, gm, gd, hh, mm;
        if (window.moment) {
            var m = window.moment(time);
            if (!m || !m.isValid()) { return String(time); }
            gy = m.year(); gm = m.month() + 1; gd = m.date();
            hh = m.hour(); mm = m.minute();
        } else {
            var d = new Date(time);
            if (isNaN(d.getTime())) { return String(time); }
            gy = d.getFullYear(); gm = d.getMonth() + 1; gd = d.getDate();
            hh = d.getHours(); mm = d.getMinutes();
        }

        var j = gregorianToJalali(gy, gm, gd);
        var f = String(fmt || '');
        var hasTime = /[HhmsAa]/.test(f);
        var hasDay = /[Dd]/.test(f);
        var hasMonth = /M/.test(f);
        var hasYear = /[Yy]/.test(f);
        var out;

        if (hasTime && !hasDay && !hasMonth && !hasYear) {
            out = pad(hh) + ':' + pad(mm);
        } else if (hasDay) {
            out = j[2] + ' ' + PERSIAN_MONTHS[j[1] - 1];
            if (hasYear) { out += ' ' + j[0]; }
            if (hasTime) { out += ' ' + pad(hh) + ':' + pad(mm); }
        } else if (hasMonth) {
            out = PERSIAN_MONTHS[j[1] - 1];
            if (hasYear) { out += ' ' + j[0]; }
        } else if (hasYear) {
            out = String(j[0]);
        } else {
            out = j[0] + '/' + pad(j[1]) + '/' + pad(j[2]);
        }

        return maybeDigits(out);
    }

    // Override the Chart.js date adapter's format() so time axes render Jalali.
    // Force the Persian font on the canvas-drawn chart text (axis ticks incl.
    // the day-of-month numbers, tooltips and legend). Canvas text ignores CSS,
    // so the dashboard-font.css `!important` rule never reaches the chart. The
    // only way to style it is through Chart.js's own font defaults.
    function applyChartFont(C) {
        try {
            var fontStack = "'VazirmatnVF', Tahoma, sans-serif";
            if (C && C.defaults) {
                if (C.defaults.global) {            // Chart.js v2
                    C.defaults.global.defaultFontFamily = fontStack;
                }
                if (C.defaults.font) {              // Chart.js v3+
                    C.defaults.font.family = fontStack;
                }
            }
        } catch (e) {}
    }

    function applyChartAdapter() {
        try {
            var C = window.Chart;
            applyChartFont(C);
            if (C && C._adapters && C._adapters._date &&
                typeof C._adapters._date.override === 'function') {
                var proto = C._adapters._date.prototype;
                if (proto && proto.__perscaJalali) {
                    return true;
                }
                C._adapters._date.override({
                    format: function (time, fmt) {
                        return jalaliChartFormat(time, fmt);
                    }
                });
                if (proto) { proto.__perscaJalali = true; }
                return true;
            }
        } catch (e) {}
        return false;
    }

    // Wrap window.edd.renderChart so the adapter override is guaranteed to be in
    // place immediately before each chart is instantiated. reports.js defines
    // renderChart after this script, so we trap the assignment.
    if (isEddPage) {
        var realRenderChart = null;
        function perscaRenderChart() {
            applyChartAdapter();
            return realRenderChart.apply(this, arguments);
        }
        try {
            window.edd = window.edd || {};
            if (window.edd.renderChart && typeof window.edd.renderChart === 'function') {
                realRenderChart = window.edd.renderChart;
            }
            Object.defineProperty(window.edd, 'renderChart', {
                configurable: true,
                enumerable: true,
                get: function () {
                    return realRenderChart ? perscaRenderChart : undefined;
                },
                set: function (fn) {
                    realRenderChart = fn;
                }
            });
        } catch (e) {
            // Fallback: poll for renderChart and wrap it once available.
            var wrapTries = 0;
            var wrapTimer = setInterval(function () {
                wrapTries++;
                if (window.edd && typeof window.edd.renderChart === 'function' &&
                    !window.edd.renderChart.__persca) {
                    var orig = window.edd.renderChart;
                    var wrapped = function () {
                        applyChartAdapter();
                        return orig.apply(this, arguments);
                    };
                    wrapped.__persca = true;
                    window.edd.renderChart = wrapped;
                    clearInterval(wrapTimer);
                } else if (wrapTries > 100) {
                    clearInterval(wrapTimer);
                }
            }, 100);
        }
    }

    /* =========================================================================
     * Layer 3 - Localize printed Gregorian dates to Jalali (EDD admin screens).
     * ====================================================================== */
    var EN_MONTHS = {
        january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
        july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
        jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12
    };

    function slashOrder() {
        var fmt = String(settings.pickerFormat || 'mm/dd/yy').toLowerCase();
        var order = [];
        fmt.replace(/(yyyy|yy|mm|dd)/g, function (tok) {
            order.push(tok.charAt(0));
            return tok;
        });
        if (order.length !== 3) {
            order = ['m', 'd', 'y'];
        }
        return order;
    }
    var SLASH_ORDER = slashOrder();

    function isValidGregorian(gy, gm, gd) {
        if (gy < 1900 || gy > 2200 || gm < 1 || gm > 12 || gd < 1) {
            return false;
        }
        var leap = ((gy % 4 === 0) && (gy % 100 !== 0)) || (gy % 400 === 0);
        var max = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        return gd <= max[gm];
    }

    function jalaliNumeric(gy, gm, gd) {
        var j = gregorianToJalali(gy, gm, gd);
        return maybeDigits(j[0] + '/' + pad(j[1]) + '/' + pad(j[2]));
    }

    function jalaliLong(gy, gm, gd) {
        var j = gregorianToJalali(gy, gm, gd);
        return maybeDigits(j[2] + ' ' + PERSIAN_MONTHS[j[1] - 1] + ' ' + j[0]);
    }

    function convertText(text) {
        var changed = false;

        // Day-first long month names: "1 July 2026" / "30 June 2026" / "20 Jul 2026".
        // EDD's reports date-range labels use this order (day month year).
        text = text.replace(/\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\b/g, function (full, d, mon, y) {
            var m = EN_MONTHS[mon.toLowerCase()];
            if (!m) { return full; }
            var gy = +y, gd = +d;
            if (!isValidGregorian(gy, m, gd)) { return full; }
            changed = true;
            return jalaliLong(gy, m, gd);
        });

        // Month-first long month names: "July 20, 2026" / "Jul 20 2026".
        text = text.replace(/\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})\b/g, function (full, mon, d, y) {
            var m = EN_MONTHS[mon.toLowerCase()];
            if (!m) { return full; }
            var gy = +y, gd = +d;
            if (!isValidGregorian(gy, m, gd)) { return full; }
            changed = true;
            return jalaliLong(gy, m, gd);
        });

        // ISO: 2026-07-20.
        text = text.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, function (full, y, m, d) {
            var gy = +y, gm = +m, gd = +d;
            if (!isValidGregorian(gy, gm, gd)) { return full; }
            changed = true;
            return jalaliNumeric(gy, gm, gd);
        });

        // Numeric slashes in the localized picker order: e.g. 07/20/2026.
        text = text.replace(/\b(\d{1,4})\/(\d{1,4})\/(\d{1,4})\b/g, function (full, a, b, c) {
            var parts = {};
            parts[SLASH_ORDER[0]] = +a;
            parts[SLASH_ORDER[1]] = +b;
            parts[SLASH_ORDER[2]] = +c;
            if (String(parts.y).length !== 4) { return full; }
            if (!isValidGregorian(parts.y, parts.m, parts.d)) { return full; }
            changed = true;
            return jalaliNumeric(parts.y, parts.m, parts.d);
        });

        return changed ? text : null;
    }

    var SKIP_TAGS = { INPUT: 1, TEXTAREA: 1, SELECT: 1, OPTION: 1, SCRIPT: 1, STYLE: 1, BUTTON: 1 };

    function shouldSkip(node) {
        var el = node.parentNode;
        while (el && el.nodeType === 1) {
            if (SKIP_TAGS[el.tagName]) { return true; }
            var cls = el.className;
            if (typeof cls === 'string' && cls.indexOf('persian-calendar') !== -1) { return true; }
            if (el.getAttribute && el.getAttribute('data-persca-skip') === '1') { return true; }
            if (el.isContentEditable) { return true; }
            el = el.parentNode;
        }
        return false;
    }

    function localizeDates(context) {
        if (!isEddPage) { return; }
        var root = document.getElementById('wpbody-content');
        if (!root) { return; }
        if (context && context.nodeType === 1 && root.contains(context)) {
            root = context;
        }
        if (typeof document.createTreeWalker !== 'function') { return; }

        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
        var pending = [];
        var node;
        while ((node = walker.nextNode())) {
            var val = node.nodeValue;
            if (!val || val.length < 8) { continue; }
            if (!/\d/.test(val)) { continue; }
            if (shouldSkip(node)) { continue; }
            pending.push(node);
        }
        for (var i = 0; i < pending.length; i++) {
            var out = convertText(pending[i].nodeValue);
            if (out !== null) {
                pending[i].nodeValue = out;
            }
        }
    }

    var localizeTimer = null;
    function debounceLocalize() {
        if (localizeTimer) { clearTimeout(localizeTimer); }
        localizeTimer = setTimeout(function () { localizeDates(document); }, 120);
    }

    /* =========================================================================
     * Layer 4 - Rebuild EDD report preset ranges on the Jalali calendar.
     *
     * EDD computes "this month / quarter / year" on the Gregorian calendar, so
     * "Month to Date" starts on 1 July (= 10 Tir) instead of 1 Tir. Here we
     * recompute the calendar-based preset LABELS on the Jalali calendar; the
     * matching DATA query is recomputed server-side via the edd_get_dates_filter
     * hook in edd.php so the chart and the label stay consistent.
     * ====================================================================== */
    function jIsLeap(jy) {
        var conv = window.PersianDateConverter;
        if (conv && conv.jalaliToGregorian && conv.gregorianToJalali) {
            var g = conv.jalaliToGregorian(jy, 12, 30);
            var b = conv.gregorianToJalali(g[0], g[1], g[2]);
            return b[0] === jy && b[1] === 12 && b[2] === 30;
        }
        var rem = ((jy % 33) + 33) % 33;
        return [1, 5, 9, 13, 17, 22, 26, 30].indexOf(rem) !== -1;
    }

    function jMonthLen(jy, jm) {
        if (jm <= 6) { return 31; }
        if (jm <= 11) { return 30; }
        return jIsLeap(jy) ? 30 : 29;
    }

    function tripleFromDate(d) {
        return gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    }

    function jalaliRangeBounds(key, now) {
        var jnow = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
        var jy = jnow[0], jm = jnow[1], jd = jnow[2];
        var qs, lqs, lqe, pm, py, ly, dow, s, e;
        switch (key) {
            case 'this_month':
                return [[jy, jm, 1], [jy, jm, jd]];
            case 'last_month':
                pm = jm - 1; py = jy; if (pm < 1) { pm = 12; py--; }
                return [[py, pm, 1], [py, pm, jMonthLen(py, pm)]];
            case 'this_quarter':
                qs = Math.floor((jm - 1) / 3) * 3 + 1;
                return [[jy, qs, 1], [jy, jm, jd]];
            case 'last_quarter':
                qs = Math.floor((jm - 1) / 3) * 3 + 1;
                lqs = qs - 3; ly = jy; if (lqs < 1) { lqs += 12; ly--; }
                lqe = lqs + 2;
                return [[ly, lqs, 1], [ly, lqe, jMonthLen(ly, lqe)]];
            case 'this_year':
                return [[jy, 1, 1], [jy, jm, jd]];
            case 'last_year':
                return [[jy - 1, 1, 1], [jy - 1, 12, jMonthLen(jy - 1, 12)]];
            case 'this_week':
                dow = (now.getDay() + 1) % 7; // Saturday = start of week
                s = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow);
                return [tripleFromDate(s), [jy, jm, jd]];
            case 'last_week':
                dow = (now.getDay() + 1) % 7;
                s = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow - 7);
                e = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow - 1);
                return [tripleFromDate(s), tripleFromDate(e)];
            default:
                return null; // today / yesterday / last_30_days / other are day-based
        }
    }

    function fmtJTriple(t) {
        return maybeDigits(t[2] + ' ' + PERSIAN_MONTHS[t[1] - 1] + ' ' + t[0]);
    }

    function sameTriple(a, b) {
        return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
    }

    function relabelRanges() {
        if (!isEddPage) { return; }
        var now = new Date();
        var spans = document.querySelectorAll('.edd-date-range-selected-date span[data-range]');
        for (var i = 0; i < spans.length; i++) {
            var key = spans[i].getAttribute('data-range');
            var b = jalaliRangeBounds(key, now);
            if (!b) { continue; }
            var label = sameTriple(b[0], b[1])
                ? fmtJTriple(b[0])
                : (fmtJTriple(b[0]) + ' - ' + fmtJTriple(b[1]));
            // Guard so the MutationObserver relabel cannot loop against itself.
            if (spans[i].textContent !== label) { spans[i].textContent = label; }
        }
    }

    /* ---- Relative comparison dropdown ("compared to") ---- */
    function jTripleToDate(t) {
        var conv = window.PersianDateConverter;
        if (conv && conv.jalaliToGregorian) {
            var g = conv.jalaliToGregorian(t[0], t[1], t[2]);
            return new Date(g[0], g[1] - 1, g[2]);
        }
        return null;
    }

    function addDaysToTriple(t, n) {
        var d = jTripleToDate(t);
        if (!d) { return t; }
        d.setDate(d.getDate() + n);
        return gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    }

    function daysBetweenTriples(a, b) {
        var da = jTripleToDate(a), db = jTripleToDate(b);
        if (!da || !db) { return 0; }
        return Math.round((db.getTime() - da.getTime()) / 86400000);
    }

    function shiftTripleMonths(t, n) {
        var y = t[0], m = t[1] + n;
        while (m < 1) { m += 12; y--; }
        while (m > 12) { m -= 12; y++; }
        return [y, m, Math.min(t[2], jMonthLen(y, m))];
    }

    function relativeBounds(selectedRange, relKey, now) {
        var base = jalaliRangeBounds(selectedRange, now);
        if (!base) { return null; }
        var s = base[0], e = base[1];
        switch (relKey) {
            case 'previous_period':
                var span = daysBetweenTriples(s, e) + 1;
                var pe = addDaysToTriple(s, -1);
                var ps = addDaysToTriple(pe, -(span - 1));
                return [ps, pe];
            case 'previous_month':
                return [shiftTripleMonths(s, -1), shiftTripleMonths(e, -1)];
            case 'previous_quarter':
                return [shiftTripleMonths(s, -3), shiftTripleMonths(e, -3)];
            case 'previous_year':
                return [shiftTripleMonths(s, -12), shiftTripleMonths(e, -12)];
            default:
                return null;
        }
    }

    function relabelRelative() {
        if (!isEddPage) { return; }
        var now = new Date();
        var forced = settings.forcedRange || '';
        var lists = document.querySelectorAll('.edd-date-range-relative-dropdown ul[data-range]');
        for (var u = 0; u < lists.length; u++) {
            var selectedRange = lists[u].getAttribute('data-range');
            // After the preset->custom rewrite, the list reports 'other'. Fall
            // back to the logical preset so the relative ranges (previous period
            // / month / quarter / year) are computed on the Jalali calendar in a
            // DAY-PRESERVING way, instead of being left to the strict
            // Gregorian->Jalali text conversion (which rolls e.g. day 30 into the
            // 1st of the next Jalali month).
            if ((!selectedRange || selectedRange === 'other') && forced) {
                selectedRange = forced;
            }
            var items = lists[u].querySelectorAll('li[data-range]');
            for (var i = 0; i < items.length; i++) {
                var relKey = items[i].getAttribute('data-range');
                var span = items[i].querySelector('.date-range-dates');
                if (!span) { continue; }
                var rb = relativeBounds(selectedRange, relKey, now);
                if (!rb) { continue; }
                var rlabel = fmtJTriple(rb[0]) + ' - ' + fmtJTriple(rb[1]);
                // Guard so the MutationObserver relabel cannot loop against itself.
                if (span.textContent !== rlabel) { span.textContent = rlabel; }
                // Own these labels so the strict date localizer does not rewrite
                // them back into exact (day-rolling) Gregorian conversions.
                if (span.getAttribute('data-persca-skip') !== '1') {
                    span.setAttribute('data-persca-skip', '1');
                }
            }
        }
    }

    /* ---- Cosmetic: keep the preset name in the range dropdown ----
     * When PHP rewrites a report preset (this month, this year, ...) into a
     * Jalali custom range, EDD renders the dropdown as "Custom". This restores
     * the original preset label in the UI and hides the custom from/to inputs.
     * It is purely cosmetic: the chart/table data already uses the Jalali
     * bounds computed server-side, so even if this fails the data is correct.
     */
    function restorePresetDisplay() {
        if (!isEddPage) { return; }
        var preset = settings.forcedRange || '';
        if (!preset) { return; }

        // Show the preset name in the range <select> without firing change.
        var sel = document.querySelector('select.edd-graphs-date-options');
        if (sel) {
            var hasOption = false;
            for (var i = 0; i < sel.options.length; i++) {
                if (sel.options[i].value === preset) { hasOption = true; break; }
            }
            if (hasOption) { sel.value = preset; }
        }

        // Hide the "custom" from/to date inputs that EDD reveals for 'other'.
        var opts = document.querySelectorAll('.edd-date-range-options');
        for (var j = 0; j < opts.length; j++) {
            opts[j].classList.add('screen-reader-text');
        }

        // Reveal the preset's label span, hide the others (incl. the 'other' one).
        var spans = document.querySelectorAll('.edd-date-range-selected-date span[data-range]');
        for (var k = 0; k < spans.length; k++) {
            if (spans[k].getAttribute('data-range') === preset) {
                spans[k].classList.remove('hidden');
            } else {
                spans[k].classList.add('hidden');
            }
        }

        // Keep the picker's data-range in sync with the displayed preset.
        var picker = document.querySelector('.edd-date-range-picker');
        if (picker) { picker.setAttribute('data-range', preset); }
    }

    /* =========================================================================
     * Bootstrap
     * ====================================================================== */
    // Reveal the date-range label (hidden by inline CSS to avoid the Gregorian
    // flash) only after it has been localized to Jalali above.
    function markDatesReady() {
        if (document.body) { document.body.classList.add('persca-dates-ready'); }
    }

    // Ask the browser to fetch VazirmatnVF up front so it is ready in the font
    // cache before Chart.js paints the canvas (canvas can only draw an
    // already-loaded font). Harmless if the API is unavailable.
    try {
        if (document.fonts && typeof document.fonts.load === 'function') {
            document.fonts.load("14px VazirmatnVF");
        }
    } catch (e) {}

    $(function () {
        scanDateFields(document);
        localizeDates(document);
        relabelRanges();
        relabelRelative();
        restorePresetDisplay();
        markDatesReady();
    });

    $(document).on('ajaxComplete', function () {
        setTimeout(function () {
            scanDateFields(document);
            debounceLocalize();
            relabelRanges();
            relabelRelative();
            // NOTE: restorePresetDisplay() is intentionally NOT called here.
            // EDD fires an AJAX request when the user changes the range dropdown
            // (to load relative-comparison options). Re-running the restore on
            // ajaxComplete would force the <select> back to the currently loaded
            // preset and visibly override the user's fresh selection (the
            // "jumps to this month" flicker). The restore only runs once on load.
        }, 60);
    });

    if (typeof MutationObserver !== 'undefined') {
        $(function () {
            var target = document.getElementById('wpbody-content') || document.body;
            if (!target) { return; }
            var observer = new MutationObserver(function (mutations) {
                var added = false;
                for (var i = 0; i < mutations.length; i++) {
                    if (mutations[i].addedNodes && mutations[i].addedNodes.length) { added = true; break; }
                }
                if (added) {
                    scanDateFields(document);
                    // Re-apply the day-preserving Jalali labels BEFORE the strict
                    // localizer runs, so relative ranges ("compared to previous
                    // period/month/quarter/year") stay aligned to the same
                    // weekday/day-number even when EDD swaps the dropdown markup
                    // via $.ajax .html(...). Both relabel helpers no-op when the
                    // value already matches, so this cannot loop the observer.
                    relabelRanges();
                    relabelRelative();
                    debounceLocalize();
                }
            });
            observer.observe(target, { childList: true, subtree: true });
        });
    }
})(jQuery);
