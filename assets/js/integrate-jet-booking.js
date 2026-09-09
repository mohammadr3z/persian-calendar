/**
 * JetBooking Integration for Persian Calendar
 *
 * Provides Jalali/Shamsi calendar support for Crocoblock's JetBooking plugin.
 *
 * Frontend:
 *   - Overrides $.fn.dateRangePicker to display Jalali months/days
 *     while keeping Gregorian date values for internal JetBooking calculations.
 *
 * Backend (Admin):
 *   - Overrides the vuejsDatepicker Vue component to show a custom Jalali picker.
 *   - Patches v-calendar to display Jalali day numbers in the Bookings Calendar.
 *   - Patches v-gantt-chart timeline headers to display Jalali date strings.
 *
 * @package PERSCA
 * @since 1.3.3
 */
(function ($) {
    'use strict';

    // ──────────────────────────────────────────
    // Utility: Jalali conversion wrappers (Delegated to Shared Utils)
    // ──────────────────────────────────────────

    function toPersianDigits(str) {
        return window.PersianDateConverter.toPersianDigits(str);
    }

    function toGregorian(jy, jm, jd) {
        return window.PersianDateConverter.jalaliToGregorian(jy, jm, jd);
    }

    function toJalali(gy, gm, gd) {
        return window.PersianDateConverter.gregorianToJalali(gy, gm, gd);
    }

    function pad(n) {
        return window.PersianDateConverter.padZero(n);
    }

    function getDaysInJalaliMonth(jy, jm) {
        return window.PersianDateConverter.getDaysInJalaliMonth(jy, jm);
    }

    function parseDate(str) {
        return window.PersianCalendarIntegrations.parseLocalDate(str);
    }

    // ── Localized (month-name) date parsing ──
    // JetBooking may hand over already-localized dates such as
    // "جولای 31, 2026" (WordPress date_i18n output) instead of
    // "2026-07-31" or a unix timestamp. parseLocalDate() cannot read those,
    // so we parse Gregorian/Jalali month names here as a fallback.
    const PERSCA_MONTH_ALIASES = (function () {
        const map = {};
        const gregorian = [
            ['january', 'jan', 'ژانویه', 'ژانویهٔ', 'ژانویە'],
            ['february', 'feb', 'فوریه', 'فبرویه'],
            ['march', 'mar', 'مارس', 'مارچ'],
            ['april', 'apr', 'آوریل', 'اوریل', 'اپریل'],
            ['may', 'مه', 'می', 'مای'],
            ['june', 'jun', 'ژوئن', 'ژون', 'جون'],
            ['july', 'jul', 'ژوئیه', 'جولای', 'جولایی'],
            ['august', 'aug', 'اوت', 'آگوست', 'اگوست'],
            ['september', 'sep', 'sept', 'سپتامبر', 'سپتامبر'],
            ['october', 'oct', 'اکتبر', 'اکتوبر'],
            ['november', 'nov', 'نوامبر'],
            ['december', 'dec', 'دسامبر', 'دسمبر']
        ];
        gregorian.forEach(function (names, idx) {
            names.forEach(function (n) { map[n] = { month: idx + 1, jalali: false }; });
        });
        const jalali = window.PersianDateConverter.PERSIAN_MONTHS || [];
        jalali.forEach(function (n, idx) {
            map[String(n)] = { month: idx + 1, jalali: true };
        });
        return map;
    })();

    function perscaToAsciiDigits(str) {
        return String(str)
            .replace(/[۰-۹]/g, function (c) { return String(c.charCodeAt(0) - 0x06f0); })
            .replace(/[٠-٩]/g, function (c) { return String(c.charCodeAt(0) - 0x0660); });
    }

    /**
     * Parse a localized date string such as "جولای 31, 2026", "31 July 2026"
     * or "۱۴۰۵/مرداد/۹" into a Date object.
     * @returns {Date|null}
     */
    function parseLocalizedDateString(raw) {
        if (!raw) return null;
        const norm = perscaToAsciiDigits(raw)
            .replace(/[,،]/g, ' ')
            .replace(/[\/\-]/g, ' ')
            .trim()
            .toLowerCase();
        const tokens = norm.split(/\s+/).filter(Boolean);

        let year = null, day = null, monthInfo = null;
        tokens.forEach(function (token) {
            const t = token.replace(/[^0-9a-z؀-ۿ]/g, '');
            if (!t) return;
            if (/^\d{3,4}$/.test(t)) {
                if (year === null) year = parseInt(t, 10);
            } else if (/^\d{1,2}$/.test(t)) {
                if (day === null) day = parseInt(t, 10);
            } else if (monthInfo === null && PERSCA_MONTH_ALIASES[t]) {
                monthInfo = PERSCA_MONTH_ALIASES[t];
            }
        });

        if (!year || !day || !monthInfo) return null;
        if (day < 1 || day > 31) return null;

        if (monthInfo.jalali || (year >= 1300 && year <= 1500)) {
            const g = toGregorian(year, monthInfo.month, day);
            if (!g || g[0] <= 0) return null;
            const jd = new Date(g[0], g[1] - 1, g[2]);
            return isNaN(jd.getTime()) ? null : jd;
        }

        const d = new Date(year, monthInfo.month - 1, day);
        return isNaN(d.getTime()) ? null : d;
    }

    function perscaJalaliMonthName(m) {
        const months = window.PersianDateConverter.PERSIAN_MONTHS || [];
        return months[m - 1] || '';
    }

    /**
     * Human readable Jalali range, e.g. "۹ مرداد - ۱۲ مرداد ۱۴۰۵".
     */
    function perscaFormatJalaliRangeHuman(j1, j2) {
        const sameYear = j1[0] === j2[0];
        const first = j1[2] + ' ' + perscaJalaliMonthName(j1[1]) + (sameYear ? '' : ' ' + j1[0]);
        const second = j2[2] + ' ' + perscaJalaliMonthName(j2[1]) + ' ' + j2[0];
        return toPersianDigits(first + ' - ' + second);
    }

    /**
     * True when a string already carries a Jalali date (converted server side).
     * Those values are shown untouched so the human wording is preserved.
     */
    function perscaIsJalaliText(val) {
        if (!val || typeof val !== 'string') return false;
        const txt = perscaToAsciiDigits(val);
        const months = window.PersianDateConverter.PERSIAN_MONTHS || [];
        for (let i = 0; i < months.length; i++) {
            if (months[i] && txt.indexOf(months[i]) !== -1) return true;
        }
        const match = txt.match(/\d{4}/);
        if (match) {
            const y = parseInt(match[0], 10);
            if (y >= 1300 && y <= 1500) return true;
        }
        return false;
    }

    /**
     * parseDate() with a localized month-name fallback.
     * @returns {Date|null}
     */
    function parseAnyDate(val) {
        if (val === null || val === undefined || val === '') return null;
        if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
        const d = parseDate(val);
        if (d) return d;
        return parseLocalizedDateString(String(val));
    }

    /**
     * Replace every localized Gregorian date inside a text node with its Jalali form.
     */
    function perscaReplaceLocalizedDatesInText(text) {
        if (!text) return text;
        const names = Object.keys(PERSCA_MONTH_ALIASES)
            .filter(function (n) { return n.length > 2 && !PERSCA_MONTH_ALIASES[n].jalali; })
            .sort(function (a, b) { return b.length - a.length; })
            .map(function (n) { return n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); })
            .join('|');
        if (!names) return text;
        const re = new RegExp(
            '(?:(?:' + names + ')\\s*[۰-۹0-9]{1,2}\\s*[,،]?\\s*[۰-۹0-9]{4})' +
            '|(?:[۰-۹0-9]{1,2}\\s+(?:' + names + ')\\s+[۰-۹0-9]{4})',
            'gi'
        );
        return text.replace(re, function (match) {
            const d = parseLocalizedDateString(match);
            if (!d) return match;
            const j = toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
            if (!j || j[0] <= 0) return match;
            return toPersianDigits(j[2] + ' ' + perscaJalaliMonthName(j[1]) + ' ' + j[0]);
        });
    }

    /**
     * Format a Gregorian Date object as Jalali display string.
     * @param {Date} date
     * @param {string} format - 'YYYY/MM/DD' (default), 'DD MMM', etc.
     * @returns {string}
     */
    function formatJalali(date, format) {
        if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
        const j = toJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
        if (!j || j[0] === 0) return '';

        const jy = j[0], jm = j[1], jd = j[2];
        if (format === 'DD MMM') {
            const monthName = window.PersianDateConverter.PERSIAN_MONTHS[jm - 1];
            return pad(jd) + ' ' + monthName;
        }
        return jy + '/' + pad(jm) + '/' + pad(jd);
    }

    /**
     * Parse a timestamp value (seconds or ms) or date string to a Date, fallback to now.
     * @param {*} val - Unix timestamp, ms timestamp, or date string.
     * @returns {Date}
     */
    function parseTimestampToDate(val) {
        if (!val) return new Date();
        if (!isNaN(val)) {
            const num = parseFloat(val);
            const d = num < 10000000000 ? new Date(num * 1000) : new Date(num);
            return isNaN(d.getTime()) ? new Date() : d;
        }
        const d = new Date(val);
        return isNaN(d.getTime()) ? new Date() : d;
    }

    /**
     * Get unix timestamp in seconds from timestamp, Date, or date string.
     * @param {*} val
     * @returns {number}
     */
    function perscaGetUnixTimestampSeconds(val) {
        const d = parseAnyDate(val);
        return d ? Math.floor(d.getTime() / 1000) : 0;
    }

    function getJalaliMonthUnixRange(jy, jm) {
        const gStart = toGregorian(jy, jm, 1);
        const startVal = Date.UTC(gStart[0], gStart[1] - 1, gStart[2], 0, 0, 0);

        const daysInMonth = getDaysInJalaliMonth(jy, jm);

        const gEnd = toGregorian(jy, jm, daysInMonth);
        const endVal = Date.UTC(gEnd[0], gEnd[1] - 1, gEnd[2], 23, 59, 59);

        return {
            start: Math.floor(startVal / 1000),
            end: Math.floor(endVal / 1000)
        };
    }

    function patchCalendarComponent(definition) {
        if (!definition) return;

        definition.template = '<div class="jet-abaf-bookings-calendar persca-bookings-calendar persca-custom-calendar">' +
            '<div class="persca-calendar-nav-header">' +
            '<button type="button" class="persca-nav-btn prev-btn" @click="prevMonth">‹</button>' +
            '<span class="persca-calendar-nav-title">{{ currentMonthName }}</span>' +
            '<button type="button" class="persca-nav-btn next-btn" @click="nextMonth">›</button>' +
            '</div>' +
            '<div class="persca-calendar-grid">' +
            '<div class="persca-calendar-weekdays">' +
            '<div class="persca-calendar-weekday" v-for="wd in weekdays">{{ wd }}</div>' +
            '</div>' +
            '<div class="persca-calendar-days">' +
            '<div class="persca-calendar-day empty-day" v-for="p in paddingDays" :key="\'pad-\' + p"></div>' +
            '<div class="persca-calendar-day" v-for="day in monthDays" :key="day.day">' +
            '<div class="jet-abaf-calendar-day-number persca-calendar-day-number">{{ toPersianDigits(day.day) }}</div>' +
            '<div class="jet-abaf-calendar-day-content">' +
            '<div' +
            ' v-for="(attr, index) in day.attributes"' +
            ' v-if="index < maxItemInCell"' +
            ' :key="attr.key"' +
            ' class="jet-abaf-calendar-day-booking"' +
            ' :data-booking-id="attr.customData.booking_id"' +
            ' @click="callPopup(\'info\', attr.customData)"' +
            ' @mouseenter="mouseEnter"' +
            ' @mouseleave="mouseLeave"' +
            '>' +
            '<div class="jet-abaf-booking-data" :class="statusClass(attr.customData.status)">' +
            '<strong>{{ getItemLabel(attr.customData.apartment_id) }}<span v-if="attr.customData.apartment_unit">, {{ getItemUnitLabel(attr.customData.apartment_id, attr.customData.apartment_unit) }}</span></strong>' +
            '<span>{{ formatJalaliRange(attr.customData.check_in_date || attr.customData.check_in_date_timestamp, attr.customData.check_out_date || attr.customData.check_out_date_timestamp) }}</span>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '<div class="jet-abaf-calendar-day-more-button" v-if="getRemainingItemCount(day.attributes)">' +
            '<span @click="showMoreJalali(day)">{{ toPersianDigits(getRemainingItemCount(day.attributes)) }} more</span>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>';

        const originalData = definition.data;
        definition.data = function () {
            let dataObj = {};
            if (typeof originalData === 'function') {
                dataObj = originalData.call(this);
            } else if (originalData) {
                dataObj = Object.assign({}, originalData);
            }
            dataObj.currentYear = 1405;
            dataObj.currentMonth = 4;
            return dataObj;
        };

        const originalCreated = definition.created;
        definition.created = function () {
            const self = this;
            if (typeof originalCreated === 'function') {
                originalCreated.apply(self, arguments);
            } else if (Array.isArray(originalCreated)) {
                originalCreated.forEach(function (fn) {
                    fn.apply(self, arguments);
                });
            }
            
            const initialVal = (self.$store && self.$store.state && self.$store.state.currentFilters && self.$store.state.currentFilters.check_in_date);
            const date = parseTimestampToDate(initialVal);
            
            const j = toJalali(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
            self.currentYear = j[0];
            self.currentMonth = j[1];

            // Fetch the items for the initial Jalali month view immediately on creation
            self.updatePeriod();
        };

        definition.watch = definition.watch || {};
        definition.watch.currentMonth = function () {
            this.updatePeriod();
        };
        definition.watch.currentYear = function () {
            this.updatePeriod();
        };

        const originalBeforeDestroy = definition.beforeDestroy;
        definition.beforeDestroy = function () {
            if (this.timer) {
                clearTimeout(this.timer);
            }
            if (typeof originalBeforeDestroy === 'function') {
                originalBeforeDestroy.apply(this, arguments);
            } else if (Array.isArray(originalBeforeDestroy)) {
                originalBeforeDestroy.forEach(function (fn) {
                    fn.apply(this, arguments);
                }, this);
            }
        };

        definition.methods = definition.methods || {};
        definition.methods.prevMonth = function () {
            this.currentMonth--;
            if (this.currentMonth < 1) {
                this.currentMonth = 12;
                this.currentYear--;
            }
        };
        definition.methods.nextMonth = function () {
            this.currentMonth++;
            if (this.currentMonth > 12) {
                this.currentMonth = 1;
                this.currentYear++;
            }
        };
        definition.methods.updatePeriod = function () {
            const range = getJalaliMonthUnixRange(this.currentYear, this.currentMonth);
            this.$store.commit('setValue', {
                key: 'currentFilters',
                value: Object.assign({}, this.currentFilters, {
                    check_in_date: range.start,
                    check_out_date: range.end,
                    date: ''
                })
            });
            if (this.timer) {
                clearTimeout(this.timer);
            }
            this.timer = setTimeout(() => {
                this.$store.dispatch('getItems');
            }, 500);
        };
        definition.methods.showMoreJalali = function (day) {
            const date = this.objectTimeToTimestamp(day.date);
            this.$store.commit('setValue', {
                key: 'currentFilters',
                value: Object.assign({}, this.currentFilters, { date: date })
            });
            this.$store.commit('setValue', {
                key: 'currentView',
                value: 'list'
            });
            this.pageUrl.searchParams.set('view', 'list');
            window.history.pushState(null, '', this.pageUrl.toString());
            this.$store.dispatch('getItems');
        };
        definition.methods.toPersianDigits = function (num) {
            return toPersianDigits(num);
        };
        definition.methods.formatJalaliRange = function (inStr, outStr) {
            if (!inStr || !outStr) return '';
            // Already Jalali (converted server side) -> keep it untouched.
            if (perscaIsJalaliText(inStr) && perscaIsJalaliText(outStr)) {
                return toPersianDigits(String(inStr) + ' - ' + String(outStr));
            }
            const d1 = parseAnyDate(inStr);
            const d2 = parseAnyDate(outStr);
            if (!d1 || !d2) return inStr + ' - ' + outStr;
            const j1 = toJalali(d1.getFullYear(), d1.getMonth() + 1, d1.getDate());
            const j2 = toJalali(d2.getFullYear(), d2.getMonth() + 1, d2.getDate());
            return perscaFormatJalaliRangeHuman(j1, j2);
        };

        definition.computed.weekdays = function () {
            return window.PersianDateConverter.PERSIAN_WEEKDAYS_LONG;
        };
        definition.computed.currentMonthName = function () {
            return window.PersianDateConverter.PERSIAN_MONTHS[this.currentMonth - 1] + ' ' + toPersianDigits(this.currentYear);
        };
        definition.computed.paddingDays = function () {
            const g = toGregorian(this.currentYear, this.currentMonth, 1);
            const jsDay = new Date(Date.UTC(g[0], g[1] - 1, g[2])).getUTCDay();
            return (jsDay + 1) % 7;
        };
        definition.computed.monthDays = function () {
            const m = this.currentMonth;
            const y = this.currentYear;
            const daysCount = getDaysInJalaliMonth(y, m);
            const days = [];
            for (let d = 1; d <= daysCount; d++) {
                const g = toGregorian(y, m, d);
                const date = new Date(g[0], g[1] - 1, g[2]);
                const dateStr = moment.utc([g[0], g[1] - 1, g[2]]).format('MMM DD YYYY');
                const attrs = this.itemsList.filter(function (item) {
                    return item.dates && item.dates.indexOf(dateStr) !== -1;
                });
                days.push({
                    day: d,
                    date: date,
                    dateStr: dateStr,
                    attributes: attrs
                });
            }
            return days;
        };
    }


    function patchTimelineComponent(definition) {
        if (!definition) return;

        definition.template = '<div class="jet-abaf-bookings-timeline persca-bookings-timeline">' +
            '<div class="persca-calendar-nav-header">' +
            '<button type="button" class="persca-nav-btn prev-btn" @click="prevMonth">‹</button>' +
            '<span class="persca-calendar-nav-title">{{ currentMonthName }}</span>' +
            '<button type="button" class="persca-nav-btn next-btn" @click="nextMonth">›</button>' +
            '</div>' +
            '<div class="persca-gantt-container" dir="rtl">' +
            ' <div class="persca-gantt-inner" :style="{ width: (monthDays.length * 75) + \'px\' }">' +
            '  <div class="persca-gantt-header">' +
            '   <div class="persca-gantt-day" v-for="day in monthDays" :key="\'hd-\'+day.day">{{ day.label }}</div>' +
            '  </div>' +
            '  <div class="persca-gantt-body">' +
            '   <div class="persca-gantt-grid">' +
            '    <div class="persca-gantt-grid-col" v-for="day in monthDays" :key="\'grid-\'+day.day"></div>' +
            '   </div>' +
            '   <div class="persca-gantt-row" v-for="item in monthItems" :key="item.id || item.key">' +
            '    <div v-if="item.gtArray && item.gtArray[0] && item.gtArray[0].customData" class="jet-abaf-gantt-block-item" :class="statusClass( item.gtArray[0].customData.status )" :style="getBlockStyle(item)" @click="callPopup( \'info\', item.gtArray[0].customData )">' +
            '     {{ getItemLabel( item.gtArray[0].customData.apartment_id ) }}' +
            '     <template v-if="item.gtArray[0].customData.apartment_unit"> | {{ getItemUnitLabel( item.gtArray[0].customData.apartment_id, item.gtArray[0].customData.apartment_unit ) }}</template>' +
            '     <span style="font-size:11px; margin-right:8px; opacity:0.8;">({{ formatJalaliRange(item.gtArray[0].customData.check_in_date_timestamp || item.gtArray[0].customData.check_in_date, item.gtArray[0].customData.check_out_date_timestamp || item.gtArray[0].customData.check_out_date) }})</span>' +
            '    </div>' +
            '   </div>' +
            '   <div v-if="monthItems.length === 0" class="persca-gantt-empty">رکوردی در این بازه زمانی یافت نشد.</div>' +
            '  </div>' +
            ' </div>' +
            '</div>' +
            '</div>';

        const originalData = definition.data;
        definition.data = function () {
            let dataObj = {};
            if (typeof originalData === 'function') {
                dataObj = originalData.call(this);
            } else if (originalData) {
                dataObj = Object.assign({}, originalData);
            }
            dataObj.currentYear = 1405;
            dataObj.currentMonth = 4;
            return dataObj;
        };

        const originalCreated = definition.created;
        definition.created = function () {
            const self = this;
            if (typeof originalCreated === 'function') {
                originalCreated.apply(self, arguments);
            } else if (Array.isArray(originalCreated)) {
                originalCreated.forEach(function (fn) {
                    fn.apply(self, arguments);
                });
            }

            const initialVal = (self.$store && self.$store.state && self.$store.state.currentFilters && self.$store.state.currentFilters.check_in_date);
            const date = parseTimestampToDate(initialVal);

            const j = toJalali(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
            self.currentYear = j[0];
            self.currentMonth = j[1];

            self.updatePeriod();
        };

        definition.watch = definition.watch || {};
        definition.watch.currentMonth = function () {
            this.updatePeriod();
        };
        definition.watch.currentYear = function () {
            this.updatePeriod();
        };

        definition.computed = definition.computed || {};
        definition.computed.monthDays = function () {
            const daysCount = getDaysInJalaliMonth(this.currentYear, this.currentMonth);
            const days = [];
            for (let d = 1; d <= daysCount; d++) {
                days.push({
                    day: d,
                    label: toPersianDigits(pad(d)) + ' ' + window.PersianDateConverter.PERSIAN_MONTHS[this.currentMonth - 1]
                });
            }
            return days;
        };
        definition.computed.monthItems = function () {
            if (!this.itemsList || !Array.isArray(this.itemsList)) return [];
            const range = getJalaliMonthUnixRange(this.currentYear, this.currentMonth);
            const monthStart = range.start;
            const monthEnd = range.end;

            return this.itemsList.filter(function (item) {
                const dataItem = item.gtArray && item.gtArray[0] ? item.gtArray[0].customData : null;
                if (!dataItem) return false;
                const start = perscaGetUnixTimestampSeconds(dataItem.check_in_date_timestamp || dataItem.check_in_date);
                const end = perscaGetUnixTimestampSeconds(dataItem.check_out_date_timestamp || dataItem.check_out_date);
                return start <= monthEnd && end >= monthStart;
            });
        };
        definition.computed.currentMonthName = function () {
            return window.PersianDateConverter.PERSIAN_MONTHS[this.currentMonth - 1] + ' ' + toPersianDigits(this.currentYear);
        };

        definition.methods = definition.methods || {};
        definition.methods.prevMonth = function () {
            this.currentMonth--;
            if (this.currentMonth < 1) {
                this.currentMonth = 12;
                this.currentYear--;
            }
        };
        definition.methods.nextMonth = function () {
            this.currentMonth++;
            if (this.currentMonth > 12) {
                this.currentMonth = 1;
                this.currentYear++;
            }
        };
        definition.methods.updatePeriod = function () {
            const range = getJalaliMonthUnixRange(this.currentYear, this.currentMonth);
            if (this.$store) {
                this.$store.commit('setValue', {
                    key: 'currentFilters',
                    value: Object.assign({}, this.currentFilters, {
                        check_in_date: range.start,
                        check_out_date: range.end,
                        date: ''
                    })
                });
                if (this.timer) {
                    clearTimeout(this.timer);
                }
                this.timer = setTimeout(() => {
                    this.$store.dispatch('getItems');
                }, 500);
            }
        };
        definition.methods.formatJalaliRange = function (inStr, outStr) {
            if (!inStr || !outStr) return '';
            // Already Jalali (converted server side) -> keep it untouched.
            if (perscaIsJalaliText(inStr) && perscaIsJalaliText(outStr)) {
                return toPersianDigits(String(inStr) + ' - ' + String(outStr));
            }
            const d1 = parseAnyDate(inStr);
            const d2 = parseAnyDate(outStr);
            if (!d1 || !d2) return inStr + ' - ' + outStr;
            const j1 = toJalali(d1.getFullYear(), d1.getMonth() + 1, d1.getDate());
            const j2 = toJalali(d2.getFullYear(), d2.getMonth() + 1, d2.getDate());
            if (!j1 || j1[0] === 0 || !j2 || j2[0] === 0) {
                return inStr + ' - ' + outStr;
            }
            return perscaFormatJalaliRangeHuman(j1, j2);
        };
        definition.methods.getBlockStyle = function (item) {
            const dataItem = item.gtArray && item.gtArray[0] ? item.gtArray[0].customData : {};
            const range = getJalaliMonthUnixRange(this.currentYear, this.currentMonth);
            const monthStart = range.start;
            const daysInMonth = getDaysInJalaliMonth(this.currentYear, this.currentMonth);
            
            const bookingStart = perscaGetUnixTimestampSeconds(dataItem.check_in_date_timestamp || dataItem.check_in_date);
            const bookingEnd = perscaGetUnixTimestampSeconds(dataItem.check_out_date_timestamp || dataItem.check_out_date);
            
            const offsetSeconds = bookingStart - monthStart;
            let offsetDays = Math.round(offsetSeconds / 86400);
            let durationDays = Math.round((bookingEnd - bookingStart) / 86400) + 1;
            
            if (offsetDays < 0) {
                durationDays += offsetDays;
                offsetDays = 0;
            }
            if (offsetDays + durationDays > daysInMonth) {
                durationDays = daysInMonth - offsetDays;
            }
            
            // JetBooking stores dates with 0 duration if same day, ensure at least 1 day duration visually
            if (durationDays < 1) {
                durationDays = 1;
            }

            return {
                right: (offsetDays * 75) + 'px',
                width: (durationDays * 75) + 'px'
            };
        };
    }

    function scanAndPatchDayjsForInstance(instance) {
        try {
            let foundProto = null;
            function checkObject(obj) {
                if (obj && typeof obj === 'object') {
                    if (typeof obj.format === 'function' && typeof obj.toDate === 'function') {
                        foundProto = obj.__proto__ || obj.constructor.prototype;
                        return true;
                    }
                }
                return false;
            }

            // 1. Scan instance properties
            for (const key in instance) {
                try {
                    const val = instance[key];
                    if (checkObject(val)) break;
                    if (Array.isArray(val)) {
                        for (let i = 0; i < val.length; i++) {
                            if (checkObject(val[i])) break;
                        }
                        if (foundProto) break;
                    }
                } catch (e) { }
            }

            // 2. Fallback check for dayjs on instance
            if (!foundProto && typeof instance.dayjs === 'function') {
                const dayjsInstance = instance.dayjs();
                if (dayjsInstance) {
                    foundProto = dayjsInstance.__proto__ || dayjsInstance.constructor.prototype;
                }
            }

            // 3. Patch prototype
            if (foundProto && !foundProto.format.isPatched) {
                const originalFormat = foundProto.format;
                foundProto.format = function (fmt) {
                    try {
                        const normalizedFmt = String(fmt).trim();
                        if (normalizedFmt === 'DD MMM' && typeof this.toDate === 'function') {
                            const d = this.toDate();
                            if (d instanceof Date && !isNaN(d.getTime())) {
                                return formatJalali(d, 'DD MMM');
                            }
                        }
                    } catch (err) { }
                    return originalFormat.apply(this, arguments);
                };
                foundProto.format.isPatched = true;
            }
        } catch (e) { }
    }

    // ──────────────────────────────────────────
    // PART 1: Frontend — Override dateRangePicker
    // ──────────────────────────────────────────

    let originalDateRangePicker = null;

    function isJetBookingElement($el) {
        const selector = '[class*="jet-abaf"], [class*="jet-booking"], [id*="jet-abaf"], [id*="jet_abaf"]';
        return $el.is(selector) || $el.closest(selector).length > 0 || $el.find(selector).length > 0;
    }

    const customDateRangePicker = function () {
        const args = Array.prototype.slice.call(arguments);
        const options = args[0];

        // String method calls (like 'clear', 'setDateRange', etc.)
        if (typeof options === 'string') {
            const dp = this.data('dateRangePicker');
            if (dp && typeof dp[options] === 'function') {
                return dp[options].apply(dp, args.slice(1));
            }
            if (originalDateRangePicker) {
                return originalDateRangePicker.apply(this, arguments);
            }
            return this;
        }

        return this.each(function () {
            const $el = $(this);

            if (!isJetBookingElement($el)) {
                if (originalDateRangePicker) originalDateRangePicker.call($el, options);
                return;
            }

            // Prevent duplicate wrappers and calendars rendering on top of each other
            const existingApi = $el.data('dateRangePicker');
            if (existingApi && typeof existingApi.destroy === 'function') {
                existingApi.destroy();
            }

            const config = $.extend(true, {}, options);
            const isSingleDay = config.singleDate || false;
            const isSingleMonth = config.singleMonth || false;
            const formatStr = config.format || 'YYYY-MM-DD';
            const separator = config.separator || ' - ';

            // State
            let startDateVal = null;
            let endDateVal = null;
            let startPicker = null;
            let endPicker = null;

            // Find inputs to hide and fake for frontend and backend forms
            let $checkInInput = $();
            let $checkOutInput = $();
            let $fakeIn = $();
            let $fakeOut = $();

            if ($el.is('input')) {
                $checkInInput = $el;
                const name = $el.attr('name');
                if (name === '_dates__in' || name === 'check_in') {
                    const $form = $el.closest('form, .jet-abaf-separate-fields, .jet-form-builder');
                    $checkOutInput = $form.find('input[name="_dates__out"], input[name="check_out"]');
                }
            } else {
                $checkInInput = $el.find('.jet-abaf-details__check-in-date input, input[name="_dates__in"], input[name="booking_dates"], input.jet-abaf-field__input').first();
                $checkOutInput = $el.find('.jet-abaf-details__check-out-date input, input[name="_dates__out"]').first();
            }

            const hasFakeIn = $checkInInput.length > 0;
            const hasFakeOut = $checkOutInput.length > 0;

            if (hasFakeIn) {
                $checkInInput.css({ position: 'absolute', opacity: 0, width: 0, height: 0, zIndex: -1, pointerEvents: 'none' });
                if (!$el.find('.persca-fake-check-in').length && !$checkInInput.siblings('.persca-fake-check-in').length) {
                    let inPlaceholder = $checkInInput.attr('placeholder') || 'انتخاب تاریخ';
                    if (inPlaceholder.toLowerCase().indexOf('dd/mm') !== -1) inPlaceholder = 'روز/ماه/سال';
                    const inClasses = $checkInInput.attr('class') || '';
                    $fakeIn = $('<input type="text" class="persca-fake-check-in ' + inClasses + '" placeholder="' + inPlaceholder + '" readonly style="cursor: pointer;" />');
                    $fakeIn.removeClass('hasDatepicker'); // Avoid conflicts
                    $checkInInput.after($fakeIn);
                } else {
                    $fakeIn = $checkInInput.siblings('.persca-fake-check-in');
                }
            }

            if (hasFakeOut) {
                $checkOutInput.css({ position: 'absolute', opacity: 0, width: 0, height: 0, zIndex: -1, pointerEvents: 'none' });
                if (!$el.find('.persca-fake-check-out').length && !$checkOutInput.siblings('.persca-fake-check-out').length) {
                    let outPlaceholder = $checkOutInput.attr('placeholder') || 'انتخاب تاریخ';
                    if (outPlaceholder.toLowerCase().indexOf('dd/mm') !== -1) outPlaceholder = 'روز/ماه/سال';
                    const outClasses = $checkOutInput.attr('class') || '';
                    $fakeOut = $('<input type="text" class="persca-fake-check-out ' + outClasses + '" placeholder="' + outPlaceholder + '" readonly style="cursor: pointer;" />');
                    $fakeOut.removeClass('hasDatepicker');
                    $checkOutInput.after($fakeOut);
                } else {
                    $fakeOut = $checkOutInput.siblings('.persca-fake-check-out');
                }
            }

            // Create wrapper
            const $wrapper = $('<div class="date-picker-wrapper no-shortcuts no-gap jet-abaf-jalali-range" style="display:none; position:absolute; z-index:999999; pointer-events:auto;"></div>');

            if (isSingleDay) {
                $wrapper.addClass('single-month');
                let $monthContainer = $('<div class="month-wrapper"><div class="month1" style="display:inline-block;"></div></div>');
                $wrapper.append($monthContainer);
            } else {
                $wrapper.addClass('two-months');
                let $monthContainer = $('<div class="month-wrapper" style="display:flex; gap:16px;">' +
                    '<div class="month1"></div><div class="month2"></div>' +
                    '</div>');
                $wrapper.append($monthContainer);
            }

            $wrapper.on('click mousedown mouseup pointerdown pointerup touchstart touchend', function(e) {
                e.stopPropagation();
            });
            const $parentPopup = $el.closest('.jet-popup__container-inner, .dialog-widget-content, .elementor-popup-modal, .jet-popup-container, .jet-popup, .dialog-widget');
            if ($parentPopup.length) {
                $parentPopup.append($wrapper);
            } else {
                $('body').append($wrapper);
            }

            // Unified Date Selection Handler
            const handleDateSelection = function (clickedDate) {
                if (isSingleDay) {
                    startDateVal = clickedDate;
                    endDateVal = clickedDate;
                    api.setDateRange(startDateVal, endDateVal, false);
                    if (config.autoClose !== false) {
                        setTimeout(function () { api.close(); }, 150);
                    }
                    $el.trigger('datepicker-change', { date1: startDateVal, date2: endDateVal, value: $el.val() });
                    return;
                }

                if (!startDateVal || endDateVal) {
                    // First click: set start date
                    startDateVal = clickedDate;
                    endDateVal = null;
                    startPicker.setOptions({ rangeStart: startDateVal, rangeEnd: null });
                    if (endPicker) {
                        endPicker.setOptions({ rangeStart: startDateVal, rangeEnd: null });
                    }
                    $el.trigger('datepicker-first-date-selected', { date1: startDateVal });
                } else {
                    // Second click: set end date
                    if (clickedDate < startDateVal) {
                        // Clicked date is before start date, make it the new start date
                        startDateVal = clickedDate;
                        endDateVal = null;
                        startPicker.setOptions({ rangeStart: startDateVal, rangeEnd: null });
                        if (endPicker) {
                            endPicker.setOptions({ rangeStart: startDateVal, rangeEnd: null });
                        }
                        $el.trigger('datepicker-first-date-selected', { date1: startDateVal });
                    } else {
                        endDateVal = clickedDate;
                        startPicker.setOptions({ rangeStart: startDateVal, rangeEnd: endDateVal });
                        if (endPicker) {
                            endPicker.setOptions({ rangeStart: startDateVal, rangeEnd: endDateVal });
                        }

                        const s1 = moment(startDateVal).format(formatStr);
                        const s2 = moment(endDateVal).format(formatStr);
                        const val = s1 + separator + s2;
                        if (config.setValue) config.setValue(val, s1, s2);

                        $el.trigger('datepicker-change', { date1: startDateVal, date2: endDateVal, value: val });
                        if (config.autoClose !== false && !config.inline) {
                            setTimeout(function () { api.close(); }, 150);
                        }
                    }
                }
            };

            // Cross-picker Hover Rendering
            $wrapper.on('mouseover', '.persian-calendar-day:not(.empty)', function () {
                if (!startDateVal || endDateVal) return;

                const day = parseInt($(this).attr('data-day'), 10);
                const isStart = $(this).closest('.month1').length > 0;
                const picker = isStart ? startPicker : endPicker;
                const [gy, gm, gd] = toGregorian(picker.currentYear, picker.currentMonth, day);
                const hoverDate = new Date(gy, gm - 1, gd);

                $wrapper.find('.persian-calendar-day:not(.empty)').each(function () {
                    const $d = $(this);
                    const dDay = parseInt($d.attr('data-day'), 10);
                    const dIsStart = $d.closest('.month1').length > 0;
                    const dPicker = dIsStart ? startPicker : endPicker;
                    const [dgy, dgm, dgd] = toGregorian(dPicker.currentYear, dPicker.currentMonth, dDay);
                    const dDate = new Date(dgy, dgm - 1, dgd);

                    $d.removeClass('in-range range-end');
                    if (dDate > startDateVal && dDate < hoverDate) {
                        $d.addClass('in-range');
                    } else if (dDate.getTime() === hoverDate.getTime() && dDate > startDateVal) {
                        $d.addClass('range-end');
                    }
                });
            });

            $wrapper.on('mouseleave', function () {
                if (!startDateVal || endDateVal) return;
                $wrapper.find('.persian-calendar-day').removeClass('in-range range-end');
            });

            // Sync month navigation
            $wrapper.on('click', '.month1 .persian-calendar-prev', function () {
                let nextMonth = startPicker.currentMonth + 1;
                let nextYear = startPicker.currentYear;
                if (nextMonth > 12) {
                    nextMonth = 1;
                    nextYear++;
                }
                endPicker.currentMonth = nextMonth;
                endPicker.currentYear = nextYear;
                endPicker.updateCalendarView();
            });

            $wrapper.on('click', '.month2 .persian-calendar-next', function () {
                let prevMonth = endPicker.currentMonth - 1;
                let prevYear = endPicker.currentYear;
                if (prevMonth < 1) {
                    prevMonth = 12;
                    prevYear--;
                }
                startPicker.currentMonth = prevMonth;
                startPicker.currentYear = prevYear;
                startPicker.updateCalendarView();
            });

            // API Polyfill
            let api = {
                clear: function () {
                    startDateVal = null;
                    endDateVal = null;
                    if (startPicker) startPicker.setOptions({ rangeStart: null, rangeEnd: null, selectedDate: new Date() });
                    if (endPicker) {
                        endPicker.setOptions({ rangeStart: null, rangeEnd: null, minDate: config.startDate ? new Date(config.startDate) : null });
                    }
                    if (config.setValue) config.setValue('', '', '');
                },
                close: function () {
                    $wrapper.hide();
                    $el.trigger('datepicker-close');
                },
                resetMonthsView: function () { },
                destroy: function () {
                    $wrapper.remove();
                    if (api._outsideClickHandler) {
                        $(document).off('click', api._outsideClickHandler);
                    }
                },
                redraw: function () { },
                setDateRange: function (d1, d2, silent) {
                    if (!d1 || !d2) return;
                    const m1 = moment(d1);
                    const m2 = moment(d2);
                    startDateVal = m1.isValid() ? m1.toDate() : new Date(d1);
                    endDateVal = m2.isValid() ? m2.toDate() : new Date(d2);
                    if (startPicker) startPicker.setOptions({ rangeStart: startDateVal, rangeEnd: endDateVal, selectedDate: startDateVal });
                    if (endPicker) endPicker.setOptions({ rangeStart: startDateVal, rangeEnd: endDateVal });

                    const s1 = moment(startDateVal).format(formatStr);
                    const s2 = moment(endDateVal).format(formatStr);
                    const val = s1 + separator + s2;
                    if (!silent && config.setValue) config.setValue(val, s1, s2);
                },
                setStart: function (d1, silent) {
                    if (!d1) return;
                    const m1 = moment(d1);
                    startDateVal = m1.isValid() ? m1.toDate() : new Date(d1);
                    endDateVal = startDateVal;
                    if (startPicker) startPicker.setOptions({ rangeStart: startDateVal, rangeEnd: endDateVal, selectedDate: startDateVal });

                    const s1 = moment(startDateVal).format(formatStr);
                    if (!silent && config.setValue) config.setValue(s1, s1, s1);
                }
            };
            $el.data('dateRangePicker', api);

            // Open logic
            const openPicker = function () {
                const offset = $el.offset();
                const height = $el.outerHeight();
                let top = offset.top + height + 5;
                let left = offset.left;

                const $parent = $wrapper.parent();
                if ($parent.length && !$parent.is('body')) {
                    const parentOffset = $parent.offset();
                    top -= parentOffset.top;
                    left -= parentOffset.left;
                }

                $wrapper.css({
                    top: top,
                    left: left,
                    display: 'block'
                });
                $el.trigger('datepicker-open');
            };

            // Bind click to open
            if (!config.inline) {
                // If it's separate fields, click on any of them should open it
                let $clickTarget = $el;
                if ($el.find('.jet-abaf-separate-fields').length) {
                    $clickTarget = $el.find('.jet-abaf-separate-fields input');
                } else if ($el.hasClass('jet-abaf-separate-fields')) {
                    $clickTarget = $el.find('input');
                }

                if ($fakeIn.length) {
                    $clickTarget = $clickTarget.add($fakeIn).add($fakeOut);
                }

                $clickTarget.on('click', function (e) {
                    e.stopPropagation();
                    openPicker();
                });

                // Hide on outside click
                api._outsideClickHandler = function (e) {
                    if (!$wrapper.is(':visible')) return;

                    // If target is inside wrapper or is wrapper itself
                    if ($wrapper[0].contains(e.target) || $(e.target).closest('.date-picker-wrapper').length > 0) {
                        return;
                    }

                    // If target was a calendar day that got detached/re-rendered
                    if ($(e.target).hasClass('persian-calendar-day') || $(e.target).closest('.persian-calendar-day').length > 0) {
                        return;
                    }

                    // If target is inside the clickTarget elements (inputs)
                    if ($clickTarget.toArray().some(el => el.contains(e.target))) {
                        return;
                    }

                    api.close();
                };
                $(document).on('click', api._outsideClickHandler);
            } else {
                // Inline calendar widget
                const $container = $(config.container);
                if ($container.length) {
                    $wrapper.css({ position: 'relative', top: 'auto', left: 'auto', display: 'block' });
                    $container.append($wrapper);
                }
            }

            const commonOpts = {
                showTime: false,
                persianDigits: true,
                showCloseButton: false,
                rangeMode: !isSingleDay,
                isTwoMonths: !isSingleMonth && !isSingleDay,
                minDate: config.startDate ? new Date(config.startDate) : null
            };

            if (typeof config.beforeShowDay === 'function') {
                commonOpts.filterDate = function (date) {
                    return config.beforeShowDay(date);
                };
            }

            // Init Pickers
            const startContainer = $wrapper.find('.month1')[0];
            startPicker = new PersianCalendar(startContainer, Object.assign({}, commonOpts, {
                onDateSelect: function (data) {
                    handleDateSelection(data.date);
                }
            }));

            if (!isSingleDay) {
                const endContainer = $wrapper.find('.month2')[0];
                endPicker = new PersianCalendar(endContainer, Object.assign({}, commonOpts, {
                    onDateSelect: function (data) {
                        handleDateSelection(data.date);
                    }
                }));

                // Decorate startPicker to automatically sync endPicker month
                const originalStartUpdate = startPicker.updateCalendarView;
                startPicker.updateCalendarView = function () {
                    originalStartUpdate.apply(this, arguments);
                    if (endPicker) {
                        let nextMonth = startPicker.currentMonth + 1;
                        let nextYear = startPicker.currentYear;
                        if (nextMonth > 12) {
                            nextMonth = 1;
                            nextYear++;
                        }
                        if (endPicker.currentMonth !== nextMonth || endPicker.currentYear !== nextYear) {
                            endPicker.currentMonth = nextMonth;
                            endPicker.currentYear = nextYear;
                            endPicker.updateCalendarView();
                        }
                    }
                };

                // Initialize next month for end picker
                let nextMonth = startPicker.currentMonth + 1;
                let nextYear = startPicker.currentYear;
                if (nextMonth > 12) {
                    nextMonth = 1;
                    nextYear++;
                }
                endPicker.currentMonth = nextMonth;
                endPicker.currentYear = nextYear;
                endPicker.updateCalendarView();
            }

            // ── Range state fix ──
            // PersianCalendar keeps its own internal rangeStart/rangeEnd state and does NOT
            // fire onDateSelect on the first click of a new range. When a range already
            // exists (editing a saved booking), that made the internal state and the
            // integration state (startDateVal/endDateVal) drift apart, so the next clicks
            // were interpreted as the wrong step and the selection was lost.
            // Make this integration the single source of truth for range selection.
            if (!isSingleDay) {
                const bindRangeSelection = function (picker) {
                    if (!picker) return;
                    picker.selectDate = function (year, month, day) {
                        const g = toGregorian(year, month, day);
                        handleDateSelection(new Date(g[0], g[1] - 1, g[2]));
                    };
                };
                bindRangeSelection(startPicker);
                bindRangeSelection(endPicker);
            }

            // Periodically sync the real inputs value (Gregorian) to fake inputs (Shamsi)
            if (hasFakeIn) {
                let lastCheckInVal = '';
                let lastCheckOutVal = '';

                const formatJalaliRangeOrDate = function (valStr) {
                    if (!valStr) return '';
                    const parts = valStr.split(separator);
                    const formatPart = function(p) {
                        const d = parseDate(p.trim());
                        if (d) {
                            const j = toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
                            if (j && j[0] > 0) {
                                return toPersianDigits(j[0] + '/' + pad(j[1]) + '/' + pad(j[2]));
                            }
                        }
                        return p;
                    };
                    if (parts.length > 1) {
                        return formatPart(parts[0]) + separator + formatPart(parts[1]);
                    }
                    return formatPart(valStr);
                };

                const syncFakeInputs = function () {
                    const inVal = $checkInInput.val();
                    if (inVal !== lastCheckInVal) {
                        lastCheckInVal = inVal;
                        $fakeIn.val(formatJalaliRangeOrDate(inVal));
                    }

                    if (hasFakeOut) {
                        const outVal = $checkOutInput.val();
                        if (outVal !== lastCheckOutVal) {
                            lastCheckOutVal = outVal;
                            $fakeOut.val(formatJalaliRangeOrDate(outVal));
                        }
                    }
                };

                const syncInterval = setInterval(syncFakeInputs, 200);

                const oldDestroy = api.destroy;
                api.destroy = function () {
                    clearInterval(syncInterval);
                    if (api._outsideClickHandler) {
                        $(document).off('click', api._outsideClickHandler);
                    }
                    $fakeIn.remove();
                    $fakeOut.remove();
                    $checkInInput.css({ position: '', opacity: '', width: '', height: '', zIndex: '', pointerEvents: '' });
                    if (hasFakeOut) $checkOutInput.css({ position: '', opacity: '', width: '', height: '', zIndex: '', pointerEvents: '' });
                    if (typeof oldDestroy === 'function') oldDestroy();
                };

                syncFakeInputs();
            }

            // If options.value is passed or input already has value, parse it
            let initialVal = config.value;
            if (!initialVal) {
                if (hasFakeIn && hasFakeOut) {
                    const v1 = $checkInInput.val();
                    const v2 = $checkOutInput.val();
                    if (v1 && v2) {
                        initialVal = v1 + separator + v2;
                    } else if (v1) {
                        initialVal = v1;
                    }
                } else if (hasFakeIn) {
                    initialVal = $checkInInput.val();
                } else {
                    initialVal = $el.is('input') ? $el.val() : $el.find('input[type="text"]').val();
                }
            }
            if (initialVal && typeof initialVal === 'string') {
                const parts = initialVal.split(separator);
                if (parts.length >= 1) {
                    const pd1 = parts[0].trim();
                    const pd2 = parts.length > 1 ? parts[1].trim() : pd1;
                    if (pd1.indexOf('-') !== -1 || pd1.indexOf('/') !== -1) {
                        api.setDateRange(pd1, pd2, true);
                    }
                }
            }

        });
    };

    if (Object.defineProperty) {
        if ($.fn.dateRangePicker && $.fn.dateRangePicker !== customDateRangePicker) {
            originalDateRangePicker = $.fn.dateRangePicker;
        }
        Object.defineProperty($.fn, 'dateRangePicker', {
            get: function () {
                return customDateRangePicker;
            },
            set: function (val) {
                if (val !== customDateRangePicker) {
                    originalDateRangePicker = val;
                }
            },
            configurable: true,
            enumerable: true
        });
    } else {
        if ($.fn.dateRangePicker) originalDateRangePicker = $.fn.dateRangePicker;
        $.fn.dateRangePicker = customDateRangePicker;
    }

    // ──────────────────────────────────────────
    // PART 2: Backend — Override vuejsDatepicker
    // ──────────────────────────────────────────
    // JetBooking uses the global `vuejsDatepicker` Vue component in its admin templates.
    // We replace it with a custom component that shows a Jalali picker popup.

    // Create Jalali wrapper component
    const JalaliDatepickerComponent = {
        name: 'vuejs-datepicker',
        template: '<div class="persca-jalali-datepicker-wrapper" style="position:relative;">' +
            '<input type="text"' +
            '  :class="inputClass || \'cx-vui-input size-fullwidth\'"' +
            '  :placeholder="computedPlaceholder"' +
            '  :value="displayValue"' +
            '  :name="name"' +
            '  :id="id"' +
            '  :required="required"' +
            '  @click="togglePopup"' +
            '  readonly' +
            '  autocomplete="off"' +
            '  style="cursor:pointer;"' +
            '/>' +
            '<div v-if="showPopup" class="persca-jalali-datepicker-popup" ref="calendarPopup"></div>' +
            '</div>',
        props: {
            value: { default: null },
            format: { default: 'dd/MM/yyyy' },
            inputClass: { default: '' },
            placeholder: { default: '' },
            minimumView: { default: 'day' },
            mondayFirst: { default: false },
            disabled: { default: false },
            name: { type: String, default: '' },
            id: { type: String, default: '' },
            required: { type: Boolean, default: false }
        },
        data: function () {
            return {
                showPopup: false,
                calendarInstance: null,
                internalDate: null
            };
        },
        computed: {
            displayValue: function () {
                const date = this.internalDate || this.resolveDate(this.value);
                if (!date) return '';
                return formatJalali(date);
            },
            computedPlaceholder: function () {
                const p = this.placeholder;
                if (!p) return 'انتخاب تاریخ';
                const pLower = p.toLowerCase();
                if (pLower === 'dd/mm/yyyy' || pLower === 'yyyy-mm-dd' || pLower === 'yyyy/mm/dd' || pLower === 'mm/dd/yyyy') {
                    return 'روز/ماه/سال';
                }
                return p;
            }
        },
        watch: {
            value: function (newVal) {
                this.internalDate = this.resolveDate(newVal);
            }
        },
        mounted: function () {
            const self = this;
            this.internalDate = this.resolveDate(this.value);

            // Close popup on outside click
            this._closeHandler = function (e) {
                if (self.$el && !self.$el.contains(e.target)) {
                    self.showPopup = false;
                }
            };
            document.addEventListener('click', this._closeHandler, true);
        },
        beforeDestroy: function () {
            if (this._closeHandler) {
                document.removeEventListener('click', this._closeHandler, true);
            }
        },
        methods: {
            resolveDate: function (val) {
                if (!val) return null;
                if (val instanceof Date) {
                    return isNaN(val.getTime()) ? null : val;
                }
                // If it's a number (timestamp in milliseconds)
                if (typeof val === 'number') {
                    if (isNaN(val)) return null;
                    let d = new Date(val);
                    return isNaN(d.getTime()) ? null : d;
                }
                // String
                let d = parseDate(val);
                return d;
            },
            togglePopup: function () {
                if (this.disabled) return;
                this.showPopup = !this.showPopup;
                if (this.showPopup) {
                    this.$nextTick(this.renderCalendar);
                }
            },
            renderCalendar: function () {
                if (typeof PersianCalendar === 'undefined') return;
                const self = this;
                const container = this.$refs.calendarPopup;
                if (!container) return;

                // Clear previous
                container.innerHTML = '';

                const initialDate = this.internalDate || new Date();

                this.calendarInstance = new PersianCalendar(container, {
                    selectedDate: initialDate,
                    showTime: false,
                    usePersianDigits: false,
                    onDateSelect: function (dateInfo) {
                        const selectedDate = dateInfo.date;
                        self.internalDate = selectedDate;
                        self.showPopup = false;
                        // Emit events like original vuejs-datepicker
                        self.$emit('selected', selectedDate);
                        self.$emit('input', selectedDate);

                        // Trigger native DOM events for jQuery/legacy compatibility
                        self.$nextTick(function () {
                            const inputEl = self.$el.querySelector('input');
                            if (inputEl) {
                                const event = new Event('input', { bubbles: true });
                                inputEl.dispatchEvent(event);
                                const changeEvent = new Event('change', { bubbles: true });
                                inputEl.dispatchEvent(changeEvent);
                            }
                        });
                    }
                });
            }
        }
    };

    function patchVue(VueInstance) {
        if (VueInstance && VueInstance.component && !VueInstance.component.isPatched) {
            const originalComponent = VueInstance.component;
            VueInstance.component = function (id, definition) {
                if (id === 'vuejs-datepicker') {
                    return originalComponent.call(VueInstance, id, JalaliDatepickerComponent);
                }
                if (id === 'jet-abaf-bookings-calendar') {
                    patchCalendarComponent(definition);
                }
                if (id === 'jet-abaf-bookings-timeline') {
                    patchTimelineComponent(definition);
                }
                return originalComponent.apply(VueInstance, arguments);
            };
            VueInstance.component.isPatched = true;

            // Global mixin to force v-calendar's first day of week to Saturday (7) and patch v-gantt-chart's dayjs
            VueInstance.mixin({
                created: function () {
                    const tag = this.$options._componentTag;
                    const name = this.$options.name;
                    if (tag === 'v-calendar' || name === 'VCalendar' || name === 'v-calendar') {
                        Object.defineProperty(this, 'firstDayOfWeek', {
                            get: function () { return 7; },
                            set: function () { },
                            configurable: true
                        });
                        if (this.$props) {
                            Object.defineProperty(this.$props, 'firstDayOfWeek', {
                                get: function () { return 7; },
                                set: function () { },
                                configurable: true
                            });
                        }
                    }
                    if (tag === 'v-gantt-chart' || name === 'v-gantt-chart' || name === 'vGanttChart' || name === 'VGanttChart') {
                        const self = this;
                        this.scanAndPatchDayjs = function () {
                            scanAndPatchDayjsForInstance(self);
                        };
                        this.scanAndPatchDayjs();
                        this.$nextTick(this.scanAndPatchDayjs);
                    }
                },
                mounted: function () {
                    if (typeof this.scanAndPatchDayjs === 'function') {
                        this.scanAndPatchDayjs();
                    }
                },
                updated: function () {
                    if (typeof this.scanAndPatchDayjs === 'function') {
                        this.scanAndPatchDayjs();
                    }
                }
            });

            // If already registered, override it in global registry
            try {
                originalComponent.call(VueInstance, 'vuejs-datepicker', JalaliDatepickerComponent);
            } catch (e) { }

            // If jet-abaf-bookings-calendar is already registered, patch its computed options immediately
            try {
                const existingCalendar = VueInstance.options.components['jet-abaf-bookings-calendar'] || VueInstance.component('jet-abaf-bookings-calendar');
                if (existingCalendar) {
                    const opts = existingCalendar.options || existingCalendar;
                    patchCalendarComponent(opts);
                }
            } catch (e) { }

            // If v-gantt-chart is already registered, patch its options immediately
            try {
                const existingGantt = VueInstance.options.components['v-gantt-chart'] || VueInstance.component('v-gantt-chart');
                if (existingGantt) {
                    const optsGantt = existingGantt.options || existingGantt;
                    if (optsGantt) {
                        if (!optsGantt.created) optsGantt.created = [];
                        if (!Array.isArray(optsGantt.created)) optsGantt.created = [optsGantt.created];
                        optsGantt.created.push(function () {
                            const self = this;
                            this.scanAndPatchDayjs = function () {
                                scanAndPatchDayjsForInstance(self);
                            };
                            this.scanAndPatchDayjs();
                            this.$nextTick(this.scanAndPatchDayjs);
                        });

                        if (!optsGantt.mounted) optsGantt.mounted = [];
                        if (!Array.isArray(optsGantt.mounted)) optsGantt.mounted = [optsGantt.mounted];
                        optsGantt.mounted.push(function () {
                            if (typeof this.scanAndPatchDayjs === 'function') {
                                this.scanAndPatchDayjs();
                            }
                        });

                        if (!optsGantt.updated) optsGantt.updated = [];
                        if (!Array.isArray(optsGantt.updated)) optsGantt.updated = [optsGantt.updated];
                        optsGantt.updated.push(function () {
                            if (typeof this.scanAndPatchDayjs === 'function') {
                                this.scanAndPatchDayjs();
                            }
                        });
                    }
                }
            } catch (e) { }

            // If jet-abaf-bookings-timeline is already registered, patch it immediately
            try {
                const existingTimeline = VueInstance.options.components['jet-abaf-bookings-timeline'] || VueInstance.component('jet-abaf-bookings-timeline');
                if (existingTimeline) {
                    const optsTimeline = existingTimeline.options || existingTimeline;
                    if (optsTimeline) {
                        patchTimelineComponent(optsTimeline);
                    }
                }
            } catch (e) { }
        }
    }

    // Intercept Vue and vuejsDatepicker immediately via safe polling and defineProperty
    function startVueInterception() {
        if (window.Vue) {
            patchVue(window.Vue);
        } else {
            let vueAttempts = 0;
            const vueInterval = setInterval(function () {
                vueAttempts++;
                if (window.Vue) {
                    patchVue(window.Vue);
                    clearInterval(vueInterval);
                }
                if (vueAttempts > 100) {
                    clearInterval(vueInterval);
                }
            }, 50);
        }

        try {
            let originalVal = window.vuejsDatepicker;
            Object.defineProperty(window, 'vuejsDatepicker', {
                get: function () {
                    return JalaliDatepickerComponent;
                },
                set: function (val) {
                    originalVal = val;
                },
                configurable: true,
                enumerable: true
            });
        } catch (e) {
            window.vuejsDatepicker = JalaliDatepickerComponent;
        }
    }
    startVueInterception();

    // ──────────────────────────────────────────
    // PART 4: Backend — Patch v-gantt-chart
    // ──────────────────────────────────────────
    // The Bookings Timeline uses v-gantt-chart with template:
    //   {{ day.format('DD MMM') }}
    // `day` is a moment object. We monkey-patch moment's format
    // to intercept 'DD MMM' calls and return Jalali strings.

    function setupGanttChartPatch() {
        if (typeof moment === 'undefined') return;
        if (moment.fn.format.isPatched) return;

        // Monkey-patch moment.fn.format for timeline rendering
        const originalMomentFormat = moment.fn.format;
        moment.fn.format = function () {
            try {
                const fmt = arguments[0];
                if (fmt === 'DD MMM' && typeof this.toDate === 'function') {
                    const d = this.toDate();
                    if (d instanceof Date && !isNaN(d.getTime())) {
                        return formatJalali(d, 'DD MMM');
                    }
                }
            } catch (err) { }

            return originalMomentFormat.apply(this, arguments);
        };
        moment.fn.format.isPatched = true;
    }

    // ──────────────────────────────────────────
    // PART 5: Backend — Patch admin date displays
    // ──────────────────────────────────────────
    // Check-in/check-out dates shown in booking info popups,
    // booking list tables, etc. These display YYYY-MM-DD dates
    // that we can convert with a DOM observer.

    function patchAdminDateDisplays() {
        const adminContainer = document.querySelector('#wpwrap') || document.body;
        if (!adminContainer) return;

        function patchDateText() {
            const selectors = [
                '.jet-abaf-booking-data span',
                '.jet-abaf-details-dates span',
                'td[data-key="check_in_date"]',
                'td[data-key="check_out_date"]',
                '.jet-abaf-days-off-schedule-slot__body'
            ].join(', ');

            adminContainer.querySelectorAll(selectors).forEach(function (el) {
                if (el.getAttribute('data-jalali-patched') === 'true') return;

                let patched = false;
                el.childNodes.forEach(function (node) {
                    if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim()) {
                        let newText = node.nodeValue.replace(/(?:(\d{4})-(\d{2})-(\d{2}))|(?:(\d{2})-(\d{2})-(\d{4}))/g, function (match, y1, m1, d1, d2, m2, y2) {
                            let y, m, d;
                            if (y1) {
                                y = parseInt(y1, 10);
                                m = parseInt(m1, 10);
                                d = parseInt(d1, 10);
                            } else {
                                y = parseInt(y2, 10);
                                const p1 = parseInt(d2, 10);
                                const p2 = parseInt(m2, 10);
                                // Guess Day vs Month for DD-MM vs MM-DD. Default to DD-MM (as in 15-07-2026).
                                if (p2 > 12) {
                                    d = p2; m = p1;
                                } else {
                                    d = p1; m = p2;
                                }
                            }
                            const j = toJalali(y, m, d);
                            if (j && j[0] > 0) {
                                return j[0] + '/' + pad(j[1]) + '/' + pad(j[2]);
                            }
                            return match;
                        });
                        // Fallback for already-localized dates like "جولای 31, 2026"
                        newText = perscaReplaceLocalizedDatesInText(newText);
                        if (newText !== node.nodeValue) {
                            node.nodeValue = newText;
                            patched = true;
                        }
                    }
                });

                if (patched) {
                    el.setAttribute('data-jalali-patched', 'true');
                }
            });
        }

        patchDateText();

        const observer = new MutationObserver(function () {
            patchDateText();
        });
        observer.observe(adminContainer, { childList: true, subtree: true });
    }

    // ──────────────────────────────────────────
    // Initialisation
    // ──────────────────────────────────────────

    // Backend: run when DOM is ready for admin pages
    $(function () {
        // Start watching for DOM immediately to avoid delays
        patchAdminDateDisplays();
    });

    // Wait for the admin page to fully render (Vue mounts async)
    $(window).on('load', function () {
        setTimeout(function () {
            setupGanttChartPatch();
        }, 500);
    });

})(jQuery);
