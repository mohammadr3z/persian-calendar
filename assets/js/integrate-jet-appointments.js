/**
 * JetAppointments Integration for Persian Calendar
 *
 * Provides Jalali/Shamsi calendar support for Crocoblock's JetAppointments Booking plugin.
 *
 * Frontend:
 *   - Configures VanillaCalendar and Flatpickr to display Jalali months and weekdays
 *     while preserving Gregorian timestamps for API requests and slot calculation.
 *   - Integrates with JetEngine and JetFormBuilder appointment forms.
 *
 * Backend (Admin):
 *   - Overrides the vuejsDatepicker Vue component to show custom Jalali date pickers (cx-vui-input).
 *   - Auto-binds Jalali DatePicker and formats visual dates to Shamsi (YYYY/MM/DD) in all .jet-apb-details__item-date fields.
 *   - Patches Vue appointments calendar and timeline/Gantt chart components.
 *   - Patches moment.js and dayjs formatters for hourly timeline views.
 *
 * @package PERSCA
 * @since 1.5.0
 */
(function ($) {
    'use strict';

    // ──────────────────────────────────────────
    // Delegated Jalali Conversion Utilities
    // ──────────────────────────────────────────

    function toPersianDigits(str) {
        return window.PersianDateConverter ? window.PersianDateConverter.toPersianDigits(str) : String(str);
    }

    function perscaToAsciiDigits(str) {
        return window.PersianDateConverter ? window.PersianDateConverter.toAsciiDigits(str) : String(str);
    }

    function toGregorian(jy, jm, jd) {
        return window.PersianDateConverter ? window.PersianDateConverter.jalaliToGregorian(jy, jm, jd) : [0, 0, 0];
    }

    function toJalali(gy, gm, gd) {
        return window.PersianDateConverter ? window.PersianDateConverter.gregorianToJalali(gy, gm, gd) : [0, 0, 0];
    }

    function pad(n) {
        return String(n).padStart(2, '0');
    }

    // Normalize a 12-hour time string ("2:30 pm", "02:30PM") to 24-hour
    // ("14:30"). Already 24-hour values are returned unchanged. Used as a
    // safety net so slot times never render in am/pm format.
    function to24hTime(str) {
        if (!str || typeof str !== 'string') return str;
        const m = String(str).trim().match(/^(\d{1,2}):(\d{2})\s*([ap]m)$/i);
        if (!m) return str;
        let h = parseInt(m[1], 10);
        const isPM = /pm/i.test(m[3]);
        if (isPM && h < 12) h += 12;
        if (!isPM && h === 12) h = 0;
        return (h < 10 ? '0' + h : String(h)) + ':' + m[2];
    }

    // Translate the vuejs-datepicker 'disabled-dates' config (used by the admin
    // Add Appointment popup to respect days off, fully booked days, working
    // days and date ranges) into the PersianCalendar widget options:
    //   { to: Date }        -> minDate (selectable from the day after 'to')
    //   { from: Date }      -> maxDate (selectable until the day before 'from')
    //   days / dates / ranges / customPredictor -> filterDate callback
    function perscaToDisabledConfig(disabledDates) {
        const cfg = { minDate: null, maxDate: null, filterDate: null };
        if (!disabledDates || typeof disabledDates !== 'object') return cfg;

        const toDate = function (val) {
            if (val instanceof Date && !isNaN(val.getTime())) return val;
            if (typeof val === 'string' && ['today', 'current', 'now'].indexOf(val) !== -1) return new Date();
            return null;
        };
        const to = toDate(disabledDates.to);
        const from = toDate(disabledDates.from);
        if (to) {
            cfg.minDate = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1);
        }
        if (from) {
            cfg.maxDate = new Date(from.getFullYear(), from.getMonth(), from.getDate() - 1);
        }

        const hasFilters =
            (Array.isArray(disabledDates.days) && disabledDates.days.length) ||
            (Array.isArray(disabledDates.dates) && disabledDates.dates.length) ||
            (Array.isArray(disabledDates.ranges) && disabledDates.ranges.length) ||
            typeof disabledDates.customPredictor === 'function';

        if (hasFilters) {
            const d = disabledDates;
            cfg.filterDate = function (date) {
                // Weekdays (JS getDay(): 0 = Sunday .. 6 = Saturday)
                if (Array.isArray(d.days) && d.days.length && d.days.indexOf(date.getDay()) !== -1) {
                    return false;
                }
                // Specific dates (Date objects or 'YYYY-MM-DD' strings)
                if (Array.isArray(d.dates) && d.dates.length) {
                    for (let i = 0; i < d.dates.length; i++) {
                        let dd = d.dates[i];
                        if (!(dd instanceof Date)) {
                            dd = parseDate(dd);
                        }
                        if (dd && !isNaN(dd.getTime()) && dd.getFullYear() === date.getFullYear() && dd.getMonth() === date.getMonth() && dd.getDate() === date.getDate()) {
                            return false;
                        }
                    }
                }
                // Date ranges
                if (Array.isArray(d.ranges) && d.ranges.length) {
                    for (let i = 0; i < d.ranges.length; i++) {
                        const r = d.ranges[i];
                        if (!r || !(r.from instanceof Date) || !(r.to instanceof Date) || isNaN(r.from.getTime()) || isNaN(r.to.getTime())) continue;
                        const from = new Date(r.from.getFullYear(), r.from.getMonth(), r.from.getDate());
                        const to = new Date(r.to.getFullYear(), r.to.getMonth(), r.to.getDate());
                        const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                        if (day >= from && day <= to) return false;
                    }
                }
                // Works-dates predictor (JetAppointments 2.5.2 customPredictor)
                if (typeof d.customPredictor === 'function' && d.customPredictor(date)) {
                    return false;
                }
                return true;
            };
        }

        return cfg;
    }

    function getDaysInJalaliMonth(jy, jm) {
        return window.PersianDateConverter ? window.PersianDateConverter.getDaysInJalaliMonth(jy, jm) : (jm <= 6 ? 31 : (jm <= 11 ? 30 : 29));
    }

    function parseDate(str) {
        if (!str) return null;
        if (str instanceof Date) return isNaN(str.getTime()) ? null : str;
        if (typeof str === 'number') {
            if (str > 100000000) {
                const d = str < 9999999999 ? new Date(str * 1000) : new Date(str);
                return isNaN(d.getTime()) ? null : d;
            }
            return null;
        }
        return window.PersianCalendarIntegrations ? window.PersianCalendarIntegrations.parseLocalDate(str) : null;
    }

    function formatJalali(date, format) {
        if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
        const j = toJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
        if (!j || j[0] === 0) return '';

        const jy = j[0], jm = j[1], jd = j[2];
        const months = (window.PersianDateConverter && window.PersianDateConverter.PERSIAN_MONTHS) || [];

        if (format === 'DD MMM') {
            return toPersianDigits(pad(jd) + ' ' + (months[jm - 1] || ''));
        }
        if (format === 'long' || format === 'D MMMM YYYY') {
            return toPersianDigits(jd + ' ' + (months[jm - 1] || '') + ' ' + jy);
        }
        // Standard Year/Month/Day format: YYYY/MM/DD (e.g. ۱۴۰۵/۰۵/۱۶)
        return toPersianDigits(jy + '/' + pad(jm) + '/' + pad(jd));
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

    // ──────────────────────────────────────────
    // Part 1: Configure Frontend Data & Persian VanillaCalendar
    // ──────────────────────────────────────────

    function configurePersianJetAPBData() {
        if (window.JetAPBData && window.PersianDateConverter) {
            const w = window.PersianDateConverter.PERSIAN_WEEKDAYS;
            window.JetAPBData.months = window.PersianDateConverter.PERSIAN_MONTHS;
            window.JetAPBData.shortWeekday = w.slice(1).concat(w[0]);
            window.JetAPBData.start_of_week = 6;
        }
    }

    const PersianVanillaCalendar = (function () {
        function PersianVanillaCalendar(options) {
            let xhr = null,
                initialized = false,
                instance = null,
                instanceContent = null,
                instanceSidebar = null,
                instanceSlots = null,
                instanceInput = null,
                serviceID = null,
                serviceField = null,
                providerID = null,
                providerField = null,
                multiBooking = false,
                notification = null,
                notificationHTML = '',
                appListWrapper = null,
                recurrenceSetingsWrapper = null,
                recurringSwitcherEl = null,
                currentTimeZone = null,
                form = null,
                order = [],
                monthsWithAvailableDates = {},
                opts = {
                    selector: null,
                    pastDates: true,
                    availableWeekDays: [],
                    excludedDates: [],
                    datesMode: 'override_full',
                    worksDates: [],
                    datesRange: {
                        start: 0,
                        end: 0
                    },
                    date: new Date(),
                    today: null,
                    layout: 'default',
                    scrollToDetails: false,
                    autoSwitchToAvailableMonth: true,
                    button_prev: null,
                    button_next: null,
                    month: null,
                    month_label: null,
                    weekDays: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
                    weekStart: 6,
                    service: 0,
                    provider: 0,
                    providerIsset: false,
                    api: '',
                    inputName: '',
                    isRequired: false,
                    allowedServices: false,
                    services: false,
                    providers: false,
                    onSelect: function (data, elem) {},
                    months: (window.PersianDateConverter && window.PersianDateConverter.PERSIAN_MONTHS) || [
                        'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
                        'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
                    ],
                    shortWeekday: (window.PersianDateConverter && window.PersianDateConverter.PERSIAN_WEEKDAYS) || [
                        'ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'
                    ],
                    namespace: '',
                    selectSlot: false,
                    bookingType: 'slot',
                    timeFormat: 'HH:mm',
                    UTCOffset: 0,
                    slotAutoCheck: false,
                    relatedServices: null,
                    relatedProviders: null,
                    formId: null,
                    accessibility_labels: {
                        previous_month: 'ماه قبل',
                        next_month: 'ماه بعد',
                        appointment_calendar: 'تقویم نوبت‌دهی',
                        increase_item_count: 'افزایش تعداد',
                        decrease_item_count: 'کاهش تعداد',
                        remove_slot: 'حذف نوبت'
                    }
                };

            if (window.sessionStorage && window.JetAPBData && window.JetAPBData.show_timezones) {
                currentTimeZone = window.sessionStorage.getItem('jet-apb-timezone');
            }

            for (let k in options) {
                if (opts.hasOwnProperty(k)) {
                    opts[k] = options[k];
                }
            }

            opts.today = Date.UTC(opts.date.getFullYear(), opts.date.getMonth(), opts.date.getDate(), 0, 0, 0) / 1000;
            opts.weekStart = 6;

            const initJ = toJalali(opts.date.getFullYear(), opts.date.getMonth() + 1, opts.date.getDate());
            opts.jYear = initJ[0] || 1405;
            opts.jMonth = initJ[1] || 1;
            opts.initial_jYear = opts.jYear;
            opts.initial_jMonth = opts.jMonth;

            instance = document.querySelector(opts.selector);
            if (!instance) return;
            if (instance.dataset.calendarInitialized === 'true') return;
            instance.dataset.calendarInitialized = 'true';

            const setNotification = function (inst, html = '') {
                if (window.jetAppNotificationInstance) {
                    return window.jetAppNotificationInstance.outerHTML;
                }
                if (!inst) return;
                let parent = inst.parentElement,
                    notificationInstance = parent.querySelector('.jet-apb-calendar-notification'),
                    output = notificationInstance ? notificationInstance.outerHTML : html;

                if (notificationInstance) {
                    window.jetAppNotificationInstance = notificationInstance.cloneNode(true);
                } else {
                    return output;
                }
                notificationInstance.remove();
                return output;
            };

            const addEvent = function (el, type, handler, trigger = false) {
                if (!el) return;
                type = (el.attachEvent) ? 'on' + type : type;
                const event = new Event(type);
                el[(el.attachEvent) ? 'attachEvent' : 'addEventListener'](type, handler);
                if (trigger) {
                    el.dispatchEvent(event);
                }
            };

            const removeEvent = function (el, type, handler) {
                if (!el) return;
                if (el.detachEvent) {
                    el.detachEvent('on' + type, handler);
                } else {
                    el.removeEventListener(type, handler);
                }
            };

            const getWeekDay = function (day) {
                return opts.weekDays[day];
            };

            const setDayAvailability = function (el, timestamp, weekDay) {
                timestamp = timestamp || parseInt(el.dataset.calendarDate, 10);
                let isAvailable = isAvailableDay({
                    date: timestamp,
                    worksDates: opts.worksDates,
                    datesRange: opts.datesRange,
                    datesMode: opts.datesMode,
                    offDates: opts.excludedDates,
                    offWeekDays: opts.availableWeekDays,
                    weekDay: weekDay || el.dataset.weekDay
                });

                el.classList.remove('jet-apb-calendar-date--disabled');

                if (timestamp <= opts.today - 1 && !opts.pastDates) {
                    el.classList.add('jet-apb-calendar-date--disabled');
                } else {
                    if (!isAvailable) {
                        el.classList.add('jet-apb-calendar-date--disabled');
                    }
                    el.setAttribute('data-status', isAvailable);
                    if (isAvailable) {
                        let fullDate = new Date(timestamp * 1000);
                        monthsWithAvailableDates[getMonthSlug(fullDate)] = true;
                    }
                }
            };

            const isAvailableDay = function (args = {}) {
                let { worksDates, offDates, datesRange, datesMode, date, offWeekDays, weekDay } = args,
                    isAvailable = true;

                if (datesRange && datesRange.start && date < datesRange.start) {
                    return false;
                }
                if (datesRange && datesRange.end && date > datesRange.end) {
                    return false;
                }

                if (offDates && offDates[0]) {
                    for (let dates in offDates) {
                        if (date >= offDates[dates].start && date <= offDates[dates].end) {
                            if (offDates[dates].service && parseInt(serviceID, 10) === offDates[dates].service) {
                                isAvailable = false;
                                if (offDates[dates].is_full) {
                                    return isAvailable;
                                }
                                if (worksDates && worksDates[0]) {
                                    for (let wD in worksDates) {
                                        if (date >= worksDates[wD].start && date <= worksDates[wD].end) {
                                            isAvailable = true;
                                        }
                                    }
                                }
                                return isAvailable;
                            }
                            if (!offDates[dates].service) {
                                isAvailable = false;
                                return isAvailable;
                            }
                        }
                    }
                }

                if (worksDates && worksDates[0]) {
                    for (let dates in worksDates) {
                        if (date >= worksDates[dates].start && date <= worksDates[dates].end) {
                            return true;
                        } else if ('override_days' !== datesMode) {
                            isAvailable = false;
                        }
                    }
                }

                if (!weekDay) {
                    weekDay = getWeekDay(new Date(date * 1000).getUTCDay());
                }

                if (!weekDay || (offWeekDays && offWeekDays.indexOf(weekDay) < 0)) {
                    isAvailable = false;
                }

                return isAvailable;
            };

            const createDay = function (jy, jm, jd) {
                const g = toGregorian(jy, jm, jd);
                const gDate = new Date(g[0], g[1] - 1, g[2]);
                const timestamp = Date.UTC(g[0], g[1] - 1, g[2], 0, 0, 0) / 1000;
                const jsWeekDay = gDate.getDay();
                const colIndex = (jsWeekDay - 6 + 7) % 7;
                const currentWeekDay = getWeekDay(jsWeekDay);

                const newDayElem = document.createElement('div');
                const newDayBody = document.createElement('div');
                newDayElem.className = 'jet-apb-calendar-date';

                if (jd === 1) {
                    const isRtl = (document.dir || 'ltr') === 'rtl' || (document.documentElement && document.documentElement.dir === 'rtl');
                    if (isRtl) {
                        newDayElem.style.marginRight = (colIndex * 14.28) + '%';
                    } else {
                        newDayElem.style.marginLeft = (colIndex * 14.28) + '%';
                    }
                }

                setDayAvailability(newDayElem, timestamp, currentWeekDay);

                newDayElem.setAttribute('data-week-day', currentWeekDay);
                newDayElem.setAttribute('data-calendar-date', timestamp);

                if (timestamp === opts.today) {
                    newDayElem.classList.add('jet-apb-calendar-date--today');
                }

                newDayBody.innerHTML = toPersianDigits(jd);
                newDayBody.className = 'jet-apb-calendar-date-body';
                newDayBody.setAttribute('role', 'gridcell');

                const monthNames = (window.PersianDateConverter && window.PersianDateConverter.PERSIAN_MONTHS) || opts.months;
                const currentDateStr = toPersianDigits(jd) + ' ' + (monthNames[jm - 1] || '') + ' ' + toPersianDigits(jy);

                if (!newDayElem.classList.contains('jet-apb-calendar-date--disabled')) {
                    newDayBody.setAttribute('aria-label', currentDateStr);
                    newDayBody.setAttribute('data-calendar-date', timestamp);
                    newDayBody.setAttribute('tabindex', 0);
                } else {
                    newDayBody.setAttribute('aria-disabled', true);
                    newDayBody.setAttribute('tabindex', -1);
                }

                if (opts.today === timestamp) {
                    newDayBody.setAttribute('aria-current', 'date');
                }

                newDayElem.appendChild(newDayBody);
                opts.month.appendChild(newDayElem);

                if (6 === colIndex && 'default' === opts.layout) {
                    opts.month.appendChild(getNewSlotsWrapper());
                }
            };

            const getNewSlotsWrapper = function () {
                const slotsEl = document.createElement('div');
                slotsEl.className = 'jet-apb-calendar-slots';
                return slotsEl;
            };

            const removeActiveClass = function () {
                instance.querySelectorAll('.jet-apb-calendar-date--selected').forEach(function (el) {
                    el.classList.remove('jet-apb-calendar-date--selected');
                });
                instance.querySelectorAll('.jet-apb-calendar-slots').forEach(function (el) {
                    el.classList.remove('jet-apb-calendar-slots--active');
                    // Also drop the loading marker: when a request is aborted
                    // (user clicked another day) the cleared wrapper must not
                    // keep matching '.jet-apb-calendar-slots--loading', or later
                    // observers would never see the end of the loading phase.
                    el.classList.remove('jet-apb-calendar-slots--loading');
                    el.innerHTML = '';
                });

                if (!multiBooking) {
                    opts.selectSlot = false;
                    if (instanceInput) {
                        instanceInput.val('').data('price', 0).trigger('change');
                    }
                    updateAppointmentList();
                }

                if ('recurring' === opts.bookingType && opts.recurringSettings) {
                    opts.recurringSettings.recurrenceApp = false;
                    if (recurrenceSetingsWrapper) {
                        recurrenceSetingsWrapper.style.display = 'none';
                    }
                }
            };

            const selectDate = function (el) {
                let activeSlots = document.querySelector('.jet-apb-calendar-slots--active'),
                    activeSlotsStyle = activeSlots ? getComputedStyle(activeSlots) : 0,
                    fullHeight = activeSlots ? (activeSlots.offsetHeight + parseFloat(activeSlotsStyle.marginTop || 0) + parseFloat(activeSlotsStyle.marginBottom || 0)) : 0;

                removeActiveClass();
                el.classList.add('jet-apb-calendar-date--selected');

                let slot = getNextSlot(el),
                    service = null,
                    provider = null,
                    datenow = new Date();

                if (!slot) return;

                slot.classList.add('jet-apb-calendar-slots--loading');
                instance.classList.add('jet-apb-calendar--loading');

                if (xhr) xhr.abort();

                if (opts.service.id) {
                    service = opts.service.id;
                } else if (opts.service.field) {
                    serviceField = document.querySelectorAll('[data-form-id="' + opts.formId + '"] input[name="' + opts.service.field + '"]');
                    if (1 === serviceField.length) {
                        if (serviceField[0].value) serviceID = serviceField[0].value;
                    } else if (1 < serviceField.length) {
                        for (let i = 0; i < serviceField.length; i++) {
                            if (serviceField[i].checked) serviceID = serviceField[i].value;
                        }
                    }
                    service = serviceID;
                } else {
                    service = serviceID;
                }

                if (opts.provider.id) {
                    provider = opts.provider.id;
                } else {
                    provider = providerID;
                }

                if (!service) {
                    showNotification('notification-service');
                    slot.classList.remove('jet-apb-calendar-slots--loading');
                    instance.classList.remove('jet-apb-calendar--loading');
                    return;
                }

                if (opts.provider.field === 'providers') {
                    let pField = document.querySelector('[data-form-id="' + opts.formId + '"] .appointment-provider');
                    if (pField && pField.getAttribute('data-args')) {
                        let providerArgs = JSON.parse(pField.getAttribute('data-args'));
                        if (providerArgs.custom_template) {
                            let selectedTemplateOption = pField.querySelector('[data-form-id="' + opts.formId + '"] input[checked]');
                            if (selectedTemplateOption && selectedTemplateOption.value === providerArgs.default) {
                                providerID = providerArgs.default;
                            }
                        } else {
                            let selectedOption = pField.querySelector('[data-form-id="' + opts.formId + '"] option[selected]');
                            if (selectedOption && selectedOption.value === providerArgs.default) {
                                providerID = providerArgs.default;
                            }
                        }
                    }
                }

                if (opts.provider.field && !providerID) {
                    if (!window.elementorFrontend || !window.elementorFrontend.isEditMode()) {
                        showNotification('notification-provider');
                        slot.classList.remove('jet-apb-calendar-slots--loading');
                        instance.classList.remove('jet-apb-calendar--loading');
                        return;
                    }
                }

                let additionalArgs = (window.wp && wp.hooks && wp.hooks.applyFilters)
                    ? wp.hooks.applyFilters('jet.apb.date_slots.additional.args', {}, form, service, provider ? provider : providerID, el.dataset.calendarDate, currentTimeZone)
                    : {};

                // Watch the loading phase only. Created after the loading class
                // was added (and past the early returns above) so it cannot fire
                // on removeActiveClass()'s innerHTML clearing and disconnect
                // before the loading class exists. Observes class attribute
                // changes too: the --loading class is added/removed via
                // classList, which is an attribute mutation, not a childList
                // one. Scoped to this calendar instance so several calendars on
                // one page (or a stale wrapper from an aborted request) cannot
                // keep it alive.
                const observer = new MutationObserver(function () {
                    const target = instance.querySelector('.jet-apb-calendar-slots--loading');
                    if (target) {
                        if (activeSlots) activeSlots.style.height = fullHeight + 'px';
                    } else {
                        if (activeSlots) activeSlots.style.height = null;
                        // The loading phase is over; stop observing so day-clicks
                        // don't accumulate observers that fire on every DOM mutation.
                        observer.disconnect();
                    }
                });
                observer.observe(instance, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

                xhr = jQuery.ajax({
                    url: opts.api.date_slots,
                    type: 'POST',
                    dataType: 'json',
                    data: {
                        service: service,
                        provider: provider ? provider : providerID,
                        date: el.dataset.calendarDate,
                        timezone: currentTimeZone,
                        selected_slots: multiBooking ? instanceInput.val() : '',
                        timestamp: Math.floor((datenow.getTime() - datenow.getTimezoneOffset() * 60 * 1000) / 1000),
                        additional_args: additionalArgs
                    }
                }).done(function (response) {
                    // Only the request that is still current may clear the shared
                    // xhr flag: a stale request completing (or aborting) after a
                    // newer one started must not blank it out, or a subsequent
                    // day-click would fail to abort the in-flight request.
                    if (xhr === this) xhr = false;
                    slot.classList.remove('jet-apb-calendar-slots--loading');
                    slot.classList.add('jet-apb-calendar-slots--active');

                    if (response && response.data) {
                        opts.bookingType = response.data.booking_type || 'slot';
                        slot.classList.add('jet-apb-calendar-type-' + opts.bookingType);

                        switch (opts.bookingType) {
                            case 'range':
                                multiBooking = false;
                                setRange(slot, response.data, instance);
                                break;
                            case 'recurring':
                                multiBooking = false;
                                if (response.data.settings) {
                                    opts.recurringSettings = response.data.settings;
                                    opts.recurringSettings.multiBooking = {
                                        max: parseInt(response.data.settings.max_recurring_count, 10),
                                        min: parseInt(response.data.settings.min_recurring_count, 10),
                                        selected: 1
                                    };
                                }
                                setRecurring(slot, response.data, instance);
                                break;
                            default:
                                let selectedCount = getSelectedSlotsCount(false, {
                                    service: service,
                                    provider: provider ? provider : providerID
                                });
                                multiBooking = response.data.multi_booking ? response.data.multi_booking : (options.multiBooking ? options.multiBooking : false);
                                if (multiBooking) {
                                    multiBooking.selected = selectedCount;
                                }
                                setSlots(slot, response.data, instance);
                                break;
                        }
                    }
                    instance.classList.remove('jet-apb-calendar--loading');
                }).fail(function () {
                    // Only the request that is still current may touch the loading
                    // state: a stale request's abort (a newer request started)
                    // must not hide the newer request's loading indicator.
                    // Clearing the loading class also lets the MutationObserver
                    // above detect the end of the phase and disconnect itself.
                    if (xhr === this) {
                        xhr = false;
                        slot.classList.remove('jet-apb-calendar-slots--loading');
                        instance.classList.remove('jet-apb-calendar--loading');
                    }
                });
            };

            const fragmentFromString = function (strHTML) {
                return document.createRange().createContextualFragment(strHTML);
            };

            const showNotification = function (notificationClass = '') {
                if (!notificationClass || !notification) return;
                notification.classList.add(notificationClass);
                notification.style.display = 'flex';
                setTimeout(function () {
                    notification.classList.remove(notificationClass);
                    notification.style.display = 'none';
                }, 2000);
            };

            const dateToUTCDate = function (date) {
                if (typeof date !== 'object') return !1;
                return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds());
            };

            const setRange = function (slotsWrapper, data, inst) {
                slotsWrapper.innerHTML = data.slots;
                initTimezonesPicker(slotsWrapper);

                let timeInput = slotsWrapper.getElementsByClassName('jet-apb-time-picker-input'),
                    startTimeInput = slotsWrapper.getElementsByClassName('jet-apb-time-picker-input-start'),
                    endTimeInput = slotsWrapper.getElementsByClassName('jet-apb-time-picker-input-end');

                if (!timeInput[0] || typeof flatpickr === 'undefined') return;

                let config = JSON.parse(timeInput[0].dataset.config || '{}');
                config.defaultDate = new Date(config.defaultDate);
                config.minuteIncrement = parseInt(config.minuteIncrement, 10) / 60;
                config.position = 'left';
                config.monthSelectorType = 'static';

                flatpickr(timeInput, config);

                if (endTimeInput[0] && endTimeInput[0]._flatpickr) {
                    endTimeInput[0]._flatpickr.setDate(new Date(endTimeInput[0].dataset.endTime), false);
                }
            };

            const timeFormat = function (date, hour12) {
                return new Date(date).toLocaleTimeString(undefined, { hour12: hour12, hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
            };

            const initTimezonesPicker = function (slotsWrapper) {
                const timezonesControl = slotsWrapper.querySelector('select[name="timezone_picker"]');
                if (timezonesControl && typeof Choices !== 'undefined') {
                    new Choices(timezonesControl, { itemSelectText: '' });
                    timezonesControl.addEventListener('change', function ($event) {
                        currentTimeZone = $event.detail.value;
                        if (window.sessionStorage) {
                            window.sessionStorage.setItem('jet-apb-timezone', currentTimeZone);
                        }
                        const currentDay = instance.querySelector('.jet-apb-calendar-date--selected');
                        if (currentDay) selectDate(currentDay);
                    });
                }
            };

            const setRecurring = function (slotsWrapper, data, inst) {
                let { slots, recurrence_settings_html } = data;
                slotsWrapper.innerHTML = slots;
                initTimezonesPicker(slotsWrapper);
                if (!recurrence_settings_html || !recurrenceSetingsWrapper) return;
                recurrenceSetingsWrapper.querySelector('.jet-apb-recurrence-app-settings').innerHTML = recurrence_settings_html;
            };

            const isCurrentInstanceEvent = function (event) {
                return instance && instance.contains(event.target);
            };

            const setSlots = function (slotsWrapper, data, inst) {
                let { slots } = data;
                slots = fragmentFromString(slots);
                slotsWrapper.appendChild(slots);
                initTimezonesPicker(slotsWrapper);

                const slotsEvent = new CustomEvent('jet-apb-calendar-slots--loaded', { el: slotsWrapper, slotHtml: slots });
                window.dispatchEvent(slotsEvent);

                const slotsCount = slotsWrapper.querySelectorAll('.jet-apb-slot');
                let listData = instanceInput.val() ? JSON.parse(instanceInput.val()) : [];

                const slotMap = new Map();
                slotsCount.forEach(function (slotEl) {
                    const { service, provider, friendlyDate, friendlyTime } = slotEl.dataset;
                    const normalizedTime = to24hTime(friendlyTime);
                    const key = `${provider}-${service}-${friendlyDate}-${normalizedTime}`;
                    slotMap.set(key, slotEl);
                });

                listData.forEach(function (item) {
                    const normalizedItemTime = to24hTime(item.friendlyTime);
                    const key = `${item.provider}-${item.service}-${item.friendlyDate}-${normalizedItemTime}`;
                    const matchedSlot = slotMap.get(key);
                    if (matchedSlot) {
                        matchedSlot.classList.add('jet-apb-slot--selected');
                    }
                });

                addEvent(slotsWrapper, 'click', slotAdd);

                if (opts.slotAutoCheck && slotsCount.length === 1) {
                    slotsWrapper.querySelector('.jet-apb-slot').click();
                }
            };

            const slotAdd = function (event) {
                if (!event.target.matches('.jet-apb-slot') && !event.target.parentNode.matches('.jet-apb-slot')) {
                    return;
                }

                let slotNode = event.target.matches('.jet-apb-slot') ? event.target : event.target.parentNode;
                opts.selectSlot = slotNode;

                if (multiBooking) {
                    if (slotNode.classList.contains('jet-apb-slot--selected')) {
                        if (multiBooking.selected >= 1) {
                            let maxCount = parseInt(slotNode.dataset.allowedCount || 0, 10);
                            if (0 >= maxCount) {
                                setValue(slotNode.dataset, multiBooking, 'remove');
                                slotNode.classList.remove('jet-apb-slot--selected');
                            } else {
                                let selectedSlots = instanceInput.val() ? JSON.parse(instanceInput.val()) : [];
                                let slotIndex = selectedSlots.findIndex(function (savedSlot) {
                                    return (savedSlot.slot == slotNode.dataset.slot && savedSlot.provider == slotNode.dataset.provider && savedSlot.service == slotNode.dataset.service);
                                });
                                if (0 <= slotIndex && appListWrapper) {
                                    let control = jQuery(appListWrapper).find('.jet-apb-appointments-item-count[data-slot="' + slotIndex + '"]');
                                    if (control.length) {
                                        changeCount(control.find('.jet-apb-appointments-item-count-controls-increase'), 'increase');
                                    }
                                }
                            }
                        }
                    } else {
                        if (getSelectedSlotsCount(false, slotNode.dataset) < parseInt(multiBooking.max, 10)) {
                            updateSelectedSlots('add', false, slotNode.dataset);
                            setValue(slotNode.dataset, multiBooking, 'add');
                            slotNode.classList.add('jet-apb-slot--selected');
                        } else {
                            showNotification('notification-max-slots');
                        }
                    }
                } else {
                    instance.querySelectorAll('.jet-apb-slot--selected').forEach(function (el) {
                        el.classList.remove('jet-apb-slot--selected');
                    });
                    slotNode.classList.add('jet-apb-slot--selected');
                    setValue(slotNode.dataset, multiBooking);
                }

                recurringSwitcherEl = instance.querySelector('.jet-apb-switcher');
                if (recurringSwitcherEl) {
                    recurringSwitcherEl.style.visibility = 'visible';
                }
            };

            const slotDelete = function (event) {
                if (!event.target.matches('.jet-apb-calendar-slot__delete') && !event.target.closest('.jet-apb-calendar-slot__delete')) {
                    return;
                }

                const delBtn = event.target.matches('.jet-apb-calendar-slot__delete') ? event.target : event.target.closest('.jet-apb-calendar-slot__delete');
                let { slotIndex } = delBtn.dataset,
                    selectedSlots = instanceInput.val() ? JSON.parse(instanceInput.val()) : [];

                if (!selectedSlots[slotIndex]) return;

                let slotButton = instance.querySelector(`[data-slot="${selectedSlots[slotIndex].slot}"][data-slot-end="${selectedSlots[slotIndex].slotEnd}"][data-date="${selectedSlots[slotIndex].date}"]`);
                if (slotButton) {
                    slotButton.classList.remove('jet-apb-slot--selected');
                }

                updateSelectedSlots('remove', slotIndex);
                setValue(selectedSlots[slotIndex], multiBooking, 'remove');
                return !1;
            };

            const isElementInViewport = function (el) {
                if (typeof jQuery === 'function' && el instanceof jQuery) {
                    el = el[0];
                }
                if (!el) return false;
                var rect = el.getBoundingClientRect();
                return rect.top >= 0 && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight);
            };

            const getCountControlHTML = function (slot, slotIndex) {
                let maxCount = parseInt(slot.allowedCount || 0, 10);
                let currentCount = slot.count || 1;
                if (0 >= maxCount) return '';

                return `<div class="jet-apb-appointments-item-count" data-slot="${slotIndex}" data-max="${maxCount}" data-current="${currentCount}">
                    <div class="jet-apb-appointments-item-count-controls">
                        <span class="jet-apb-appointments-item-count-controls-increase" role="button" aria-label="${opts.accessibility_labels.increase_item_count}" tabindex="0">+</span>
                    </div>
                    <div class="jet-apb-appointments-item-count-num">
                        <span class="jet-apb-appointments-item-count-num-prefix">&times;</span>
                        <span class="jet-apb-appointments-item-count-num-value">${currentCount}</span>
                    </div>
                    <div class="jet-apb-appointments-item-count-controls">
                        <span class="jet-apb-appointments-item-count-controls-decrease" role="button" aria-label="${opts.accessibility_labels.decrease_item_count}" tabindex="0">-</span>
                    </div>
                </div>`;
            };

            const updateAppointmentList = function (value = false, field = 'appointment') {
                if (field === 'appointment' || (field && field[0] && field[0].dataset.field === 'appointment')) {
                    if (!appListWrapper) return value;
                    let selectedSlots = instanceInput.val() ? JSON.parse(instanceInput.val()) : [],
                        slot, outputHTML = '',
                        wrapperVisibility = selectedSlots.length ? 'flex' : 'none',
                        serviceName, providerName, deleteButton;

                    for (const slotIndex in selectedSlots) {
                        slot = selectedSlots[slotIndex];
                        serviceName = !opts.services ? '' : (opts.services[slot.service] || '');
                        providerName = !opts.providers ? '' : (opts.providers[slot.provider] ? ' - ' + opts.providers[slot.provider] : '');
                        deleteButton = !multiBooking ? '' : `<span class="jet-apb-calendar-slot__delete" data-slot-index="${slotIndex}" role="button" aria-label="${opts.accessibility_labels.remove_slot}" tabindex="0"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M1.23529 0L0 1.23529L5.76477 7.00007L0.000132676 12.7647L1.23543 14L7.00007 8.23536L12.7647 14L14 12.7647L8.23536 7.00007L14.0001 1.23529L12.7648 0L7.00007 5.76477L1.23529 0Z" fill="#8A8B8D"/></svg></span>`;

                        let countControl = getCountControlHTML(slot, slotIndex);

                        outputHTML += `
                            <div class="jet-apb-appointments-item" tabindex="0">
                                ${countControl}
                                <div class="jet-apb-appointments-item-content">
                                    <div class="jet-apb-item-service-provider">${serviceName} ${providerName}</div>
                                    <div class="jet-apb-item-time">${slot.friendlyDate}</div>
                                    <div class="jet-apb-item-date">${slot.friendlyTime}</div>
                                    ${deleteButton}
                                </div>
                            </div>`;
                    }

                    const listEl = appListWrapper.querySelector('.jet-apb-calendar-appointments-list');
                    if (listEl) {
                        listEl.innerHTML = outputHTML;
                    }
                    appListWrapper.style.display = wrapperVisibility;

                    if (opts.scrollToDetails && !isElementInViewport(appListWrapper)) {
                        appListWrapper.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center',
                            inline: 'nearest'
                        });
                    }

                    return outputHTML;
                } else {
                    return value;
                }
            };

            const getNextSlot = function (el) {
                if ('default' !== opts.layout) {
                    return instanceSlots;
                } else {
                    var nextEl = el.nextSibling;
                    if (!nextEl) return null;
                    if (nextEl.classList && nextEl.classList.contains('jet-apb-calendar-slots')) {
                        return nextEl;
                    } else {
                        return getNextSlot(nextEl);
                    }
                }
            };

            const createMonth = function () {
                clearCalendar();
                const daysInMonth = getDaysInJalaliMonth(opts.jYear, opts.jMonth);
                for (let d = 1; d <= daysInMonth; d++) {
                    createDay(opts.jYear, opts.jMonth, d);
                }
                if ('default' === opts.layout) {
                    opts.month.appendChild(getNewSlotsWrapper());
                }
                const monthNames = (window.PersianDateConverter && window.PersianDateConverter.PERSIAN_MONTHS) || opts.months;
                opts.month_label.innerHTML = (monthNames[opts.jMonth - 1] || '') + ' ' + toPersianDigits(opts.jYear);
                return getMonthSlug();
            };

            const monthPrev = function () {
                opts.jMonth--;
                if (opts.jMonth < 1) {
                    opts.jMonth = 12;
                    opts.jYear--;
                }
                return createMonth();
            };

            const monthNext = function () {
                opts.jMonth++;
                if (opts.jMonth > 12) {
                    opts.jMonth = 1;
                    opts.jYear++;
                }
                return createMonth();
            };

            const clearCalendar = function () {
                if (opts.month) {
                    opts.month.innerHTML = '';
                }
            };

            const createInputs = function () {
                instanceInput = document.createElement('input');
                instanceInput.setAttribute('type', 'hidden');
                instanceInput.setAttribute('name', opts.inputName);
                instanceInput.setAttribute('data-field-name', opts.inputName);
                instanceInput.setAttribute('data-price', '0');
                instanceInput.setAttribute('data-field', 'appointment');
                instanceInput.classList.add('jet-form__field');
                instanceInput.classList.add(withNamespace('__field'));

                if (opts.isRequired) {
                    instanceInput.setAttribute('required', true);
                }

                instance.appendChild(instanceInput);
                instanceInput = jQuery(instanceInput);
            };

            const createCalendar = function () {
                instanceContent.innerHTML = notificationHTML + `
                <div class="jet-apb-calendar-header">
                    <button type="button" class="jet-apb-calendar-btn" data-calendar-toggle="previous" aria-label="${opts.accessibility_labels.previous_month}" tabindex="0"><svg height="24" version="1.1" viewbox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z"></path></svg></button>
                    <div class="jet-apb-calendar-header__label" data-calendar-label="month"></div>
                    <button type="button" class="jet-apb-calendar-btn" data-calendar-toggle="next" aria-label="${opts.accessibility_labels.next_month}" tabindex="0"><svg height="24" version="1.1" viewbox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M4,11V13H16L10.5,18.5L11.92,19.92L19.84,12L11.92,4.08L10.5,5.5L16,11H4Z"></path></svg></button>
                </div>
                <div class="jet-apb-calendar-week"></div>
                <div class="jet-apb-calendar-body" data-calendar-area="month" role="grid" aria-label="${opts.accessibility_labels.appointment_calendar}"></div>`;

                notification = instance.querySelector('.jet-apb-calendar-notification');
            };

            const setWeekDayHeader = function () {
                let result = '';
                const weekdays = (window.PersianDateConverter && window.PersianDateConverter.PERSIAN_WEEKDAYS) || opts.shortWeekday;
                for (let i = 0; i < 7; i++) {
                    result += '<span>' + weekdays[i] + '</span>';
                }
                instance.querySelector('.jet-apb-calendar-week').innerHTML = result;
            };

            const setValue = function ({ date, slot, slotEnd, price, friendlyTime, friendlyDate, provider, service, timezone, allowedCount, capacity, maxAllowedCount }, multiBooking = false, action = 'add') {
                let selectedSlots = instanceInput.val() ? JSON.parse(instanceInput.val()) : [],
                    newPrice = parseFloat(price || 0),
                    _serviceID = parseInt(service || serviceID, 10),
                    parsedDate = date ? new Date(parseInt(date, 10) * 1000) : null,
                    jalaliFriendlyDate = (parsedDate && !isNaN(parsedDate.getTime())) ? formatJalali(parsedDate) : (friendlyDate || ''),
                    jalaliFriendlyTime = friendlyTime ? to24hTime(friendlyTime) : '',
                    appointment = {
                        date,
                        slot,
                        slotEnd,
                        price,
                        friendlyTime: jalaliFriendlyTime || friendlyTime,
                        friendlyDate: jalaliFriendlyDate || friendlyDate,
                        timezone,
                        allowedCount,
                        maxAllowedCount
                    };

                if (capacity) {
                    appointment.count = parseInt(capacity, 10);
                }

                if (service) {
                    service = parseInt(service, 10);
                }

                if (serviceID && service <= 0) {
                    service = serviceID;
                }

                appointment.service = service;

                if (appointment.service && window.JetAPBData && window.JetAPBData.services) {
                    appointment.serviceTitle = window.JetAPBData.services[appointment.service];
                }

                if (provider) {
                    provider = parseInt(provider, 10);
                }

                if (providerID && provider <= 0) {
                    provider = providerID;
                }

                appointment.provider = provider;

                if (appointment.provider && window.JetAPBData && window.JetAPBData.providers) {
                    appointment.providerTitle = window.JetAPBData.providers[appointment.provider];
                }

                if (multiBooking) {
                    appointment.minSlotCount = parseInt(multiBooking.min, 10);
                    appointment.maxSlotCount = parseInt(multiBooking.max, 10);

                    if ('remove' === action) {
                        if (multiBooking.selected > 0) {
                            multiBooking.selected--;
                            selectedSlots = selectedSlots.filter(function (item) {
                                return !(item.slot == appointment.slot && item.service == appointment.service && item.provider == appointment.provider);
                            });
                            newPrice = Number(instanceInput.data('price') || 0) - Number(price || 0);
                        }
                    } else {
                        if (multiBooking.selected < appointment.maxSlotCount) {
                            multiBooking.selected++;
                            newPrice = Number(instanceInput.data('price') || 0) + Number(price || 0);
                            selectedSlots.push(appointment);
                        }
                    }
                    multiBooking.selected = getSelectedSlotsCount(selectedSlots, appointment);
                } else {
                    if ('remove' === action) {
                        selectedSlots = [];
                        newPrice = 0;
                    } else {
                        selectedSlots[0] = appointment;
                    }
                }

                instanceInput
                    .data('price', newPrice)
                    .val(JSON.stringify(selectedSlots))
                    .trigger('change');

                updateAppointmentList();
            };

            const getSelectedSlotsCount = function (selectedSlots = false, groupSlot = false) {
                selectedSlots = false === selectedSlots ? (instanceInput && instanceInput.val() ? JSON.parse(instanceInput.val()) : []) : selectedSlots;
                const isRecurringBooking = 'recurring' === opts.bookingType;

                return selectedSlots.reduce(function (count, slot) {
                    if (groupSlot && !isSameAppointmentGroup(slot, groupSlot)) {
                        return count;
                    }
                    if (isRecurringBooking) {
                        return count + 1;
                    }
                    return count + (slot.count ? parseInt(slot.count, 10) : 1);
                }, 0);
            };

            const isSameAppointmentGroup = function (slot, groupSlot) {
                if (parseInt(slot.service || 0, 10) !== parseInt(groupSlot.service || 0, 10)) {
                    return false;
                }
                if (window.JetAPBData && window.JetAPBData.providers && Object.keys(window.JetAPBData.providers).length) {
                    return parseInt(slot.provider || 0, 10) === parseInt(groupSlot.provider || 0, 10);
                }
                return true;
            };

            const refreshDates = function (newService, newProvider) {
                instance.classList.add('jet-apb-calendar--loading');
                removeActiveClass();

                // Abort a previous refresh still in flight: when the service or
                // provider is changed quickly, a late response would otherwise
                // repaint the month with stale availability data.
                if (xhr) xhr.abort();

                xhr = jQuery.ajax({
                    url: opts.api.refresh_dates,
                    type: 'GET',
                    dataType: 'json',
                    data: {
                        service: newService,
                        provider: newProvider
                    }
                }).done(function (response) {
                    if (xhr === this) xhr = false;
                    instance.classList.remove('jet-apb-calendar--loading');

                    if (response && response.data) {
                        for (let k in response.data) {
                            if (opts.hasOwnProperty(k)) {
                                opts[k] = response.data[k];
                            }
                        }
                    }

                    monthsWithAvailableDates = {};
                    opts.jYear = opts.initial_jYear;
                    opts.jMonth = opts.initial_jMonth;

                    let created = createMonth();
                    switchToNextAvailableMonth(created);
                }).fail(function () {
                    // Only the request that is still current may touch the loading
                    // state: if this refresh was aborted because a newer request
                    // started, that request owns the loading indicator now.
                    if (xhr === this) {
                        xhr = false;
                        instance.classList.remove('jet-apb-calendar--loading');
                    }
                });
            };

            const getFieldControls = function (fieldName) {
                if (!fieldName || !form) return [];
                return form.querySelectorAll('[name="' + fieldName + '"]');
            };

            const getCheckedFieldControl = function (fieldName) {
                let fields = getFieldControls(fieldName);
                if (!fields.length) return null;
                if (1 === fields.length && !['radio', 'checkbox'].includes(fields[0].type)) {
                    return fields[0];
                }
                for (let i = 0; i < fields.length; i++) {
                    if (fields[i].checked) return fields[i];
                }
                return null;
            };

            const getFieldValue = function (fieldName) {
                let field = getCheckedFieldControl(fieldName);
                return field ? field.value : '';
            };

            const maybeRefreshDatesOnInit = function () {
                if (opts.service.id) {
                    serviceID = opts.service.id;
                } else if (opts.service.field) {
                    serviceField = getFieldControls(opts.service.field);
                    serviceID = getFieldValue(opts.service.field);
                }

                if (opts.providerIsset) {
                    if (opts.provider.id) {
                        providerID = opts.provider.id;
                    } else {
                        providerField = getCheckedFieldControl(opts.provider.field);
                        providerID = providerField ? providerField.value : '';
                    }
                }

                if (serviceID) {
                    refreshDates(serviceID, providerID);
                }
            };

            const withNamespace = function (suffix = '') {
                return (opts.namespace + suffix);
            };

            const className = function (suffix = '') {
                return ('.' + withNamespace(suffix));
            };

            const changeCount = function ($control, type) {
                let $slot = $control.closest('.jet-apb-appointments-item-count');
                let max = parseInt($slot.data('max'), 10);
                let current = parseInt($slot.data('current'), 10);
                let slotIndex = parseInt($slot.data('slot'), 10);
                let selectedSlots = instanceInput.val() ? JSON.parse(instanceInput.val()) : [];
                let currentSlot = selectedSlots[slotIndex] || false;
                let slotMax = currentSlot && currentSlot.maxSlotCount ? parseInt(currentSlot.maxSlotCount, 10) : (multiBooking ? parseInt(multiBooking.max, 10) : max);

                if ('decrease' === type && 1 === current) return;
                if ('increase' === type && max === current) return;
                if ('increase' === type && multiBooking && getSelectedSlotsCount(selectedSlots, currentSlot) >= slotMax) {
                    showNotification('notification-max-slots');
                    return;
                }

                let price = parseInt(instanceInput.data('price'), 10);
                let currentDay = instance.querySelector('.jet-apb-calendar-date--selected');
                let currentDate = currentDay ? currentDay.getAttribute('data-calendar-date') : null;

                if (currentSlot) {
                    switch (type) {
                        case 'increase':
                            current++;
                            price += parseInt(currentSlot.price, 10);
                            break;
                        case 'decrease':
                            current--;
                            price -= parseInt(currentSlot.price, 10);
                            break;
                    }

                    selectedSlots[slotIndex].count = current;

                    if (multiBooking) {
                        multiBooking.selected = getSelectedSlotsCount(selectedSlots, selectedSlots[slotIndex]);
                    }

                    instanceInput
                        .data('price', price)
                        .val(JSON.stringify(selectedSlots))
                        .trigger('change');

                    if (currentDate == selectedSlots[slotIndex].date && (serviceID != selectedSlots[slotIndex].service || (opts.providerIsset && providerID != selectedSlots[slotIndex].provider))) {
                        selectDate(currentDay);
                    }

                    updateSelectedSlots(type, slotIndex);
                    updateAppointmentList();
                }
            };

            const updateSelectedSlots = function (type, slotIndex = false, selectedSlot = false) {
                let selectedSlots = instanceInput.val() ? JSON.parse(instanceInput.val()) : [],
                    checkBy = window.JetAPBData ? window.JetAPBData.check_by : '',
                    providersSlotDuplicating = window.JetAPBData ? window.JetAPBData.providers_slot_duplicating : false,
                    hasProviders = !!(window.JetAPBData && window.JetAPBData.providers && Object.keys(window.JetAPBData.providers).length),
                    compare = false;

                if (false !== slotIndex) {
                    selectedSlot = selectedSlots[slotIndex];
                }

                if (!hasProviders) {
                    compare = 'service' === checkBy ? 'provider' : 'all';
                } else {
                    if (providersSlotDuplicating && 'service' === checkBy) return;
                    if (providersSlotDuplicating && 'global' === checkBy) compare = 'service';
                    if (!providersSlotDuplicating && 'service' === checkBy) compare = 'provider';
                    if (!providersSlotDuplicating && 'global' === checkBy) compare = 'both';
                }

                for (let i = 0; i < selectedSlots.length; i++) {
                    if (i === slotIndex) continue;

                    let isRelativeSlot = checkSlotRelation(compare, selectedSlot, selectedSlots[i]);
                    if (isRelativeSlot && ((selectedSlot.slot < selectedSlots[i].slot && selectedSlots[i].slot < selectedSlot.slotEnd) || (selectedSlot.slot < selectedSlots[i].slotEnd && selectedSlots[i].slotEnd < selectedSlot.slotEnd) || (selectedSlots[i].slot < selectedSlot.slot && selectedSlot.slot < selectedSlots[i].slotEnd) || (selectedSlots[i].slot < selectedSlot.slotEnd && selectedSlot.slotEnd < selectedSlots[i].slotEnd) || (selectedSlot.slot == selectedSlots[i].slot && selectedSlots[i].slotEnd == selectedSlot.slotEnd))) {
                        let count = selectedSlots[i].count || 1;
                        if ('increase' == type && parseInt(selectedSlots[i].allowedCount, 10) > count) {
                            selectedSlots[i].allowedCount--;
                        }
                        if ('decrease' == type && selectedSlots[i].maxAllowedCount > selectedSlots[i].allowedCount) {
                            selectedSlots[i].allowedCount++;
                        }
                        if ('remove' == type) {
                            for (let j = 1; j <= selectedSlot.count; j++) {
                                if (selectedSlots[i].maxAllowedCount >= count) {
                                    selectedSlots[i].allowedCount++;
                                }
                            }
                        }
                        if ('add' == type && parseInt(selectedSlots[i].allowedCount, 10) > count) {
                            selectedSlots[i].allowedCount--;
                        }
                    }
                }

                instanceInput[0].value = JSON.stringify(selectedSlots);
            };

            const checkSlotRelation = function (compareType, comparedSlot, comparesSlot) {
                switch (compareType) {
                    case 'all':
                        return true;
                    case 'service':
                        if (parseInt(comparedSlot.provider, 10) === parseInt(comparesSlot.provider, 10)) {
                            return true;
                        }
                        break;
                    case 'provider':
                        if (comparedSlot.service === comparesSlot.service) {
                            return true;
                        }
                        break;
                    case 'both':
                        let relatedServicesList = window.JetAPBData ? window.JetAPBData.related_services : null,
                            relatedProvidersList = window.JetAPBData ? window.JetAPBData.related_providers : null,
                            comparedService = String(comparedSlot.service || ''),
                            comparedProvider = String(comparedSlot.provider || ''),
                            relatedServices = relatedServicesList && Array.isArray(relatedServicesList[comparesSlot.provider]) ? relatedServicesList[comparesSlot.provider] : [],
                            relatedProviders = relatedProvidersList && Array.isArray(relatedProvidersList[comparesSlot.service]) ? relatedProvidersList[comparesSlot.service] : [];

                        relatedServices = relatedServices.map(String);
                        relatedProviders = relatedProviders.map(String);

                        if (relatedServices.includes(comparedService) || relatedProviders.includes(comparedProvider)) {
                            return true;
                        }
                        break;
                }
                return false;
            };

            const getMonthSlug = function (date) {
                if (date instanceof Date && !isNaN(date.getTime())) {
                    // Timestamps here are UTC day boundaries (Date.UTC), so read
                    // the parts with the UTC getters to keep the slug on the same
                    // day for browsers west of UTC.
                    const j = toJalali(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
                    return '' + j[1] + '-' + j[0];
                }
                return '' + opts.jMonth + '-' + opts.jYear;
            };

            const switchToNextAvailableMonth = function (currentMonth) {
                if (!monthsWithAvailableDates[currentMonth] && opts.autoSwitchToAvailableMonth) {
                    for (let i = 1; i <= 12; i++) {
                        let newMonth = monthNext();
                        if (monthsWithAvailableDates[newMonth]) break;
                        if (12 === i) {
                            opts.jYear -= 1;
                            createMonth();
                        }
                    }
                }
            };

            this.init = function () {
                form = instance.closest('form');
                opts.formId = form ? form.getAttribute('data-form-id') : null;
                notificationHTML = setNotification(instance, notificationHTML);
                appListWrapper = instance.parentElement ? instance.parentElement.querySelector('.jet-apb-calendar-appointments-list-wrapper') : null;
                recurrenceSetingsWrapper = instance.parentElement ? instance.parentElement.querySelector('.jet-apb-recurrence-app-settings-wrapper') : null;

                if (!opts.service && notification) {
                    notification.classList.add('service-field');
                    notification.style.display = 'flex';
                }

                instance.classList.add('jet-apb-calendar-layout--' + opts.layout);

                instanceContent = document.createElement('div');
                instanceContent.classList.add('jet-apb-calendar-content');
                instance.appendChild(instanceContent);

                createCalendar();

                opts.button_prev = instance.querySelector('[data-calendar-toggle=previous]');
                opts.button_next = instance.querySelector('[data-calendar-toggle=next]');
                opts.month = instance.querySelector('[data-calendar-area=month]');
                opts.month_label = instance.querySelector('[data-calendar-label=month]');

                createInputs();
                setWeekDayHeader();
                maybeRefreshDatesOnInit();

                let createdMonth = createMonth();

                if ('default' !== opts.layout) {
                    instanceSlots = getNewSlotsWrapper();
                    instanceSidebar = document.createElement('div');
                    instanceSidebar.classList.add('jet-apb-calendar-sidebar');
                    instanceSidebar.appendChild(instanceSlots);
                    instance.appendChild(instanceSidebar);
                }

                addEvent(opts.button_prev, 'click', monthPrev);
                addEvent(opts.button_next, 'click', monthNext);
                if (form) {
                    addEvent(form, 'click', slotDelete);
                }

                switchToNextAvailableMonth(createdMonth);

                if (window.JetPlugins && window.JetPlugins.hooks) {
                    window.JetPlugins.hooks.addFilter('jet.fb.macro.field.value', 'jet-form-builder', updateAppointmentList);
                }
                if (window.wp && wp.hooks) {
                    wp.hooks.addFilter('jet.fb.macro.field.value', 'jet-form-builder', updateAppointmentList);
                }

                if (appListWrapper) {
                    jQuery(appListWrapper).on('click', '.jet-apb-appointments-item-count-controls-increase', function (event) {
                        event.preventDefault();
                        changeCount(jQuery(this), 'increase');
                    });
                    jQuery(appListWrapper).on('click', '.jet-apb-appointments-item-count-controls-decrease', function (event) {
                        event.preventDefault();
                        changeCount(jQuery(this), 'decrease');
                    });
                }

                addEvent(document, 'keydown', function (event) {
                    if ('div' === event.target.localName || 'label' === event.target.localName || 'span' === event.target.localName) {
                        if (!event.target.className || !event.target.className.includes('jet-apb')) return;
                        if (event.key === ' ') {
                            event.preventDefault();
                            event.target.click();
                        }
                    }
                });

                addEvent(document, 'click', function (event) {
                    if (!event.target.matches('.jet-apb-slot')) return;
                    const recCap = document.querySelector('.jet-apb__recurrence-capacity');
                    if (recCap) recCap.value = 1;
                });

                addEvent(document, 'click', function (event) {
                    if (!isCurrentInstanceEvent(event)) return;
                    if (!event.target.matches('.jet-apb-calendar-date-body')) return;

                    var day = event.target.parentNode;
                    if (!day.matches('[data-status="true"]')) return;
                    selectDate(day);
                });

                if (form) {
                    addEvent(form, 'click', function (event) {
                        if (!event.target.matches('.jet-apb-calendar-slots__close')) return;
                        removeActiveClass();
                    });
                }

                if (opts.service.field) {
                    if (!serviceField) {
                        serviceField = document.querySelectorAll('[data-form-id="' + opts.formId + '"] [name="' + opts.service.field + '"]');
                    }

                    if (serviceField && serviceField.length) {
                        const setServiceValue = function (eventValue, field) {
                            if (['radio', 'checkbox'].includes(field.type) && !field.checked) return;
                            if (eventValue !== serviceID) {
                                serviceID = eventValue;
                                if (!providerID && !opts.provider.id) providerID = false;
                                refreshDates(serviceID, providerID);
                            } else {
                                serviceID = eventValue;
                                if (!providerID && !opts.provider.id) providerID = false;
                            }
                        };

                        jQuery(form).on('click', '.jet-form-builder-choice--item', function (event) {
                            let choicesField = event.currentTarget.querySelector('[name="' + opts.service.field + '"]');
                            if (!choicesField) return;
                            window.setTimeout(function () {
                                let selectedField = getCheckedFieldControl(opts.service.field) || choicesField;
                                setServiceValue(selectedField.value, selectedField);
                            }, 0);
                        });

                        for (let i = 0; i < serviceField.length; i++) {
                            setServiceValue(serviceField[i].value, serviceField[i]);
                            serviceField[i].addEventListener('change', function (event) {
                                setServiceValue(event.target.value, event.target);
                            }, false);
                        }
                    }
                }

                if (opts.provider.field && opts.providerIsset) {
                    const setProviderValue = function (eventValue, field = false) {
                        if (field && ['radio', 'checkbox'].includes(field.type) && !field.checked) return;
                        if (eventValue !== providerID) {
                            providerID = eventValue;
                            refreshDates(serviceID, providerID);
                        } else {
                            providerID = eventValue;
                        }
                    };

                    jQuery(form).on('change', '[name="' + opts.provider.field + '"]', function (event) {
                        setProviderValue(event.target.value, event.target);
                    }).trigger('change');

                    jQuery(form).on('click', '.jet-form-builder-choice--item', function (event) {
                        let choicesField = event.currentTarget.querySelector('[name="' + opts.provider.field + '"]');
                        if (!choicesField) return;
                        window.setTimeout(function () {
                            let selectedField = getCheckedFieldControl(opts.provider.field) || choicesField;
                            setProviderValue(selectedField.value, selectedField);
                        }, 0);
                    });

                    jQuery(form).on('refresh', '[name="' + opts.provider.field + '"]', function () {
                        setProviderValue('');
                    });

                    jQuery(form).on('refresh', '.appointment-provider[data-field="' + opts.provider.field + '"]', function () {
                        setProviderValue('');
                    });
                }

                initialized = true;
            };

            this.destroy = function () {
                removeEvent(opts.button_prev, 'click', monthPrev);
                removeEvent(opts.button_next, 'click', monthNext);
                clearCalendar();
                instance.dataset.calendarInitialized = 'false';
                if (instanceContent) instanceContent.innerHTML = '';
                instance.innerHTML = '';
            };

            this.reset = function () {
                initialized = false;
                this.destroy();
                this.init();
            };

            this.set = function (options) {
                for (let k in options) {
                    if (opts.hasOwnProperty(k)) {
                        opts[k] = options[k];
                    }
                }
                if (initialized) {
                    this.reset();
                }
            };

            this.isFieldOrder = function (fieldName, index) {
                if (!order.length) return false;
                return index === order.indexOf(fieldName);
            };

            this.setFieldsOrder = function () {
                if (!opts.provider.field || !opts.service.field) return;
                let $form = jQuery(instance).closest('form');
                jQuery('[name="' + opts.provider.field + '"], [name="' + opts.service.field + '"]', $form).each(function (index, el) {
                    order.push(el.getAttribute('name'));
                });
            };

            let dataArgs = instance.dataset.args;
            if (dataArgs) {
                try {
                    dataArgs = JSON.parse(dataArgs);
                    this.set(dataArgs);
                } catch (err) {}
            }

            this.setFieldsOrder();
            this.init();
        }

        return PersianVanillaCalendar;
    })();

    try {
        let originalVC = window.VanillaCalendar;
        Object.defineProperty(window, 'VanillaCalendar', {
            get: function () { return PersianVanillaCalendar; },
            set: function (val) { originalVC = val; },
            configurable: true
        });
    } catch (e) {
        window.VanillaCalendar = PersianVanillaCalendar;
    }

    // ──────────────────────────────────────────
    // Part 2: Backend Vue Datepicker Component Override (cx-vui-input / vuejs-datepicker)
    // ──────────────────────────────────────────

    const JalaliDatepickerComponent = {
        name: 'vuejs-datepicker',
        props: ['value', 'format', 'inline', 'mondayFirst', 'disabledDates', 'placeholder', 'inputClass', 'name', 'id', 'required', 'disabled'],
        data: function () {
            let initialDate = this.getInitialDate();
            let initialDisplay = (initialDate && !isNaN(initialDate.getTime())) ? formatJalali(initialDate) : '';
            return {
                isOpen: false,
                slotsViewActive: false,
                internalDate: (initialDate && !isNaN(initialDate.getTime())) ? initialDate : null,
                displayValue: initialDisplay,
                dropdownCalendarInstance: null,
                inlineCalendarInstance: null
            };
        },
        computed: {
            gregorianValue: function () {
                const d = this.internalDate || this.resolveDate(this.value);
                if (!d || isNaN(d.getTime())) return '';
                return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
            },
            computedPlaceholder: function () {
                const p = this.placeholder;
                if (!p) return 'انتخاب تاریخ';
                const pLower = p.toLowerCase();
                if (pLower === 'dd/mm/yyyy' || pLower === 'yyyy-mm-dd' || pLower === 'yyyy/mm/dd' || pLower === 'mm/dd/yyyy') {
                    return 'سال/ماه/روز';
                }
                return p;
            },
            isShowingSlots: function () {
                if (this.slotsViewActive) return true;
                if (this.$parent && (this.$parent.daySlots || this.$parent.daySlotsIsLoad)) return true;
                return false;
            }
        },
        template:
            '<div class="vuejs-datepicker-wrapper-custom vdp-datepicker" :class="{ \'vdp-datepicker--inline\': inline }" style="position: relative; width: 100%;">' +
            '<div v-if="!inline" class="vdp-datepicker-input-wrapper cx-vui-component__control">' +
            '<input ref="mainInput" type="text" readonly="readonly" autocomplete="off" ' +
            ':class="inputClass || \'cx-vui-input size-default\'" ' +
            ':placeholder="computedPlaceholder" ' +
            ':value="displayValue" ' +
            ':id="id" ' +
            ':disabled="disabled" ' +
            ':required="required" ' +
            '@click.stop="toggleDropdown" style="cursor: pointer; direction: ltr !important; text-align: right !important;">' +
            '<div v-show="isOpen" ref="dropdownCalendar" class="persca-dropdown-container" ' +
            'style="position: absolute; z-index: 99999; background: #fff; box-shadow: 0 4px 20px rgba(0,0,0,0.15); border: 1px solid #edf2f7; border-radius: 8px; padding: 12px; width: 300px; top: 100%; right: 0;">' +
            '</div>' +
            '</div>' +
            '<div v-else class="persca-calendar-modal-overlay" @click.stop.self="closePopup">' +
            '<div class="persca-calendar-modal-container" @click.stop>' +
            '<div class="persca-calendar-modal-header">' +
            '<div class="persca-calendar-modal-title">' +
            '<span v-if="!isShowingSlots">انتخاب تاریخ</span>' +
            '<span v-else>انتخاب ساعت</span>' +
            '</div>' +
            '<div class="persca-calendar-modal-actions">' +
            '<button v-if="isShowingSlots" type="button" class="persca-modal-back-btn" @click.stop.prevent="backToDateSelection" title="بازگشت به تقویم">&#8594; بازگشت</button>' +
            '<button type="button" class="persca-modal-close-btn" @click.stop.prevent="closePopup" title="بستن">&times;</button>' +
            '</div>' +
            '</div>' +
            '<div class="persca-calendar-modal-body">' +
            '<div v-show="!isShowingSlots" class="persca-calendar-view-wrap">' +
            '<div ref="inlineCalendar" class="persca-modal-calendar"></div>' +
            '</div>' +
            '<div v-show="isShowingSlots" class="persca-slots-view-wrap">' +
            '<slot name="beforeCalendarHeader"></slot>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>',
        watch: {
            value: function (newVal) {
                const d = newVal ? this.resolveDate(newVal) : null;
                if (d && !isNaN(d.getTime())) {
                    this.internalDate = d;
                    this.displayValue = formatJalali(d);
                    if (this.dropdownCalendarInstance) {
                        this.dropdownCalendarInstance.setOptions({ selectedDate: d });
                    }
                    if (this.inlineCalendarInstance) {
                        this.inlineCalendarInstance.setOptions({ selectedDate: d });
                    }
                } else if (!newVal) {
                    this.internalDate = null;
                    this.displayValue = '';
                }
            },
            disabledDates: {
                deep: true,
                handler: function (newVal) {
                    const cfg = perscaToDisabledConfig(newVal);
                    const opts = { minDate: cfg.minDate, maxDate: cfg.maxDate, filterDate: cfg.filterDate };
                    if (this.dropdownCalendarInstance) {
                        this.dropdownCalendarInstance.setOptions(opts);
                    }
                    if (this.inlineCalendarInstance) {
                        this.inlineCalendarInstance.setOptions(opts);
                    }
                }
            }
        },
        mounted: function () {
            const self = this;
            if (!self.internalDate || isNaN(self.internalDate.getTime())) {
                const d = self.getInitialDate();
                if (d && !isNaN(d.getTime())) {
                    self.internalDate = d;
                    self.displayValue = formatJalali(d);
                }
            }
            if (self.inline) {
                self.$nextTick(function () {
                    self.initInlineCalendar();
                });
            } else {
                self.clickOutsideHandler = function (e) {
                    if (!$(e.target).closest(self.$el).length) {
                        self.isOpen = false;
                    }
                };
                document.addEventListener('click', self.clickOutsideHandler);
            }
        },
        beforeDestroy: function () {
            if (this.clickOutsideHandler) {
                document.removeEventListener('click', this.clickOutsideHandler);
            }
        },
        methods: {
            resolveDate: function (val) {
                return parseDate(val);
            },
            getDisabledWidgetOptions: function () {
                return perscaToDisabledConfig(this.disabledDates);
            },
            isDateDisabled: function (date) {
                if (!date || isNaN(date.getTime())) return true;
                const cfg = perscaToDisabledConfig(this.disabledDates);
                if (cfg.minDate && date < cfg.minDate) return true;
                if (cfg.maxDate && date > cfg.maxDate) return true;
                if (cfg.filterDate && cfg.filterDate(date) === false) return true;
                return false;
            },
            getInitialDate: function () {
                if (this.value) {
                    const d = this.resolveDate(this.value);
                    if (d && !isNaN(d.getTime())) return d;
                }
                let p = this.$parent;
                while (p) {
                    const item = p.appointment || p.item || p.currentItem || p.appointmentData || p.formData || (p.action && p.action.content) || p.editItem;
                    if (item) {
                        const raw = item.date_timestamp || item.date || item.slot_timestamp || item.check_in_date;
                        if (raw) {
                            const d = this.resolveDate(raw);
                            if (d && !isNaN(d.getTime())) return d;
                        }
                    }
                    if (p.value) {
                        const d = this.resolveDate(p.value);
                        if (d && !isNaN(d.getTime())) return d;
                    }
                    p = p.$parent;
                }
                return new Date();
            },
            toggleDropdown: function (e) {
                if (this.disabled) return;
                if (e) e.stopPropagation();
                this.isOpen = !this.isOpen;
                if (this.isOpen) {
                    const currentSelDate = this.internalDate || this.getInitialDate();
                    if (this.dropdownCalendarInstance) {
                        this.dropdownCalendarInstance.setOptions({ selectedDate: currentSelDate });
                    } else {
                        const self = this;
                        this.$nextTick(function () {
                            self.initDropdownCalendar();
                        });
                    }
                }
            },
            initDropdownCalendar: function () {
                const self = this;
                if (!self.$refs.dropdownCalendar || typeof PersianCalendar === 'undefined') return;
                const initialDate = self.internalDate || self.getInitialDate();
                const disabledCfg = self.getDisabledWidgetOptions();

                self.dropdownCalendarInstance = new PersianCalendar(self.$refs.dropdownCalendar, {
                    selectedDate: initialDate,
                    showTime: false,
                    minDate: disabledCfg.minDate,
                    maxDate: disabledCfg.maxDate,
                    filterDate: disabledCfg.filterDate,
                    onDateSelect: function (dateInfo) {
                        const selectedDate = dateInfo.date;
                        if (self.isDateDisabled(selectedDate)) return;
                        self.internalDate = selectedDate;
                        self.isOpen = false;
                        self.displayValue = formatJalali(selectedDate);
                        self.$emit('selected', selectedDate);
                        self.$emit('input', selectedDate);
                        self.triggerDomEvent();
                    }
                });
                $(self.$refs.dropdownCalendar).find('.persian-calendar-header').hide();
            },
            initInlineCalendar: function () {
                const self = this;
                if (!self.$refs.inlineCalendar || typeof PersianCalendar === 'undefined') return;
                const initialDate = self.internalDate || self.getInitialDate();
                const disabledCfg = self.getDisabledWidgetOptions();

                self.inlineCalendarInstance = new PersianCalendar(self.$refs.inlineCalendar, {
                    selectedDate: initialDate,
                    showTime: false,
                    minDate: disabledCfg.minDate,
                    maxDate: disabledCfg.maxDate,
                    filterDate: disabledCfg.filterDate,
                    onDateSelect: function (dateInfo) {
                        const selectedDate = dateInfo.date;
                        if (self.isDateDisabled(selectedDate)) return;
                        self.internalDate = selectedDate;
                        self.displayValue = formatJalali(selectedDate);
                        self.slotsViewActive = true;
                        self.$emit('selected', selectedDate);
                        self.$emit('input', selectedDate);
                        self.triggerDomEvent();
                    }
                });
                $(self.$refs.inlineCalendar).find('.persian-calendar-header').hide();
            },
            backToDateSelection: function (e) {
                if (e && e.stopPropagation) {
                    e.stopPropagation();
                    e.preventDefault();
                }
                this.slotsViewActive = false;
                let target = this.$parent;
                while (target) {
                    if (typeof target.hideDaySlots === 'function') {
                        target.hideDaySlots();
                        break;
                    }
                    target = target.$parent;
                }
            },
            closePopup: function (e) {
                if (e && e.stopPropagation) {
                    e.stopPropagation();
                    e.preventDefault();
                }
                this.slotsViewActive = false;
                let target = this.$parent;
                while (target) {
                    if (typeof target.hideDatepicker === 'function') {
                        target.hideDatepicker();
                        break;
                    }
                    if (target.datePickerVisibility !== undefined) {
                        target.datePickerVisibility = false;
                        if (typeof target.hideDaySlots === 'function') {
                            target.hideDaySlots();
                        }
                        break;
                    }
                    target = target.$parent;
                }
            },
            triggerDomEvent: function () {
                const self = this;
                self.$nextTick(function () {
                    if (self.$refs.mainInput) {
                        self.$refs.mainInput.dispatchEvent(new Event('input', { bubbles: true }));
                        self.$refs.mainInput.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });
            }
        }
    };

    try {
        let originalVal = window.vuejsDatepicker;
        Object.defineProperty(window, 'vuejsDatepicker', {
            get: function () { return JalaliDatepickerComponent; },
            set: function (val) { originalVal = val; },
            configurable: true
        });
    } catch (e) {
        window.vuejsDatepicker = JalaliDatepickerComponent;
    }

    // ──────────────────────────────────────────
    // Part 3: DOM Input & Details Binding (cx-vui & .jet-apb-details)
    // ──────────────────────────────────────────

    function bindCxVuiInputs() {
        const selector = '.jet-apb-details__item-date input.cx-vui-input, .jet-apb-item-date input.cx-vui-input, .vuejs-datepicker-wrapper > .cx-vui-component input, .vdp-datepicker-input-wrapper input';
        $(selector).each(function () {
            const $inp = $(this);
            if ($inp.hasClass('persca-fake-check-in') || 
                $inp.hasClass('persca-fake-check-out') ||
                $inp.hasClass('persian-calendar-year-display') ||
                $inp.hasClass('persian-calendar-day-display') ||
                $inp.hasClass('persian-calendar-hour') ||
                $inp.hasClass('persian-calendar-minute') ||
                $inp.closest('.persian-calendar, .persian-calendar-container, .persca-calendar-modal-overlay, .persca-dropdown-container').length) {
                return;
            }

            // Ensure LTR direction and right text alignment so 1405/05/16 is formatted Year/Month/Day
            $inp.css({
                'direction': 'ltr',
                'text-align': 'right',
                'unicode-bidi': 'embed'
            });

            // Enable native property interception
            if (window.PersianCalendarIntegrations && window.PersianCalendarIntegrations.overrideNativeValue) {
                if (!$inp.data('persca-native-overridden')) {
                    $inp.data('persca-native-overridden', true);
                    window.PersianCalendarIntegrations.overrideNativeValue(this, $);
                }
            }

            const rawVal = $inp.val();
            if (rawVal && typeof rawVal === 'string' && rawVal.trim()) {
                if (rawVal.indexOf('-') !== -1 || rawVal.indexOf('/') !== -1 || rawVal.length > 8) {
                    const parsed = parseDate(rawVal);
                    if (parsed && !isNaN(parsed.getTime())) {
                        $inp.data('persian-gregorian-val', rawVal);
                        $inp.val(formatJalali(parsed));
                    }
                }
            }
        });
    }

    function patchAdminDateDisplays() {
        const adminContainer = document.querySelector('#wpwrap') || document.body;
        if (!adminContainer) return;

        function patchDateText() {
            const selectors = [
                'td[data-key="date"]',
                '.cell--date',
                '.list-table-item__cell.cell--date',
                '.jet-apb-item-date',
                '.jet-apb-days-schedule__slot-date',
                '.jet-apb-days-schedule-slot__body',
                '.jet-apb-days-off-schedule-slot__body',
                // JetAppointments 2.5.2 working-hours page: days off / working
                // days slots render dates as '19-08-2026 — 21-08-2026'.
                '.jet-apb-days-schedule__slot'
            ].join(', ');

            adminContainer.querySelectorAll(selectors).forEach(function (el) {
                // Safeguard: Never touch ID fields, status selects, or inputs
                if (el.closest('.jet-apb-details__appoinment-id') || el.closest('.cell--id') || el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
                    return;
                }

                function walkAndPatch(node) {
                    if (node.nodeType === Node.TEXT_NODE && node.nodeValue && node.nodeValue.trim()) {
                        const originalText = node.nodeValue.trim();
                        const asciiText = perscaToAsciiDigits(originalText);

                        // Match date patterns: YYYY-MM-DD, YYYY/MM/DD, DD-MM-YYYY, DD/MM/YYYY, DD/MM/YY
                        const dateRegex = /\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b|\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/g;

                        const newText = asciiText.replace(dateRegex, function (match) {
                            const parsed = parseDate(match);
                            if (parsed && !isNaN(parsed.getTime())) {
                                return formatJalali(parsed);
                            }
                            return match;
                        });

                        if (newText !== asciiText) {
                            node.nodeValue = toPersianDigits(newText);
                        }
                    } else if (node.nodeType === Node.ELEMENT_NODE) {
                        node.childNodes.forEach(walkAndPatch);
                    }
                }

                el.childNodes.forEach(walkAndPatch);
            });
        }

        patchDateText();
    }

    if (typeof MutationObserver !== 'undefined') {
        const popupObserver = new MutationObserver(function (mutations) {
            let shouldBind = false;
            for (let i = 0; i < mutations.length; i++) {
                if (mutations[i].addedNodes && mutations[i].addedNodes.length > 0) {
                    shouldBind = true;
                    break;
                }
            }
            if (shouldBind) {
                bindCxVuiInputs();
                patchAdminDateDisplays();
                setTimeout(bindCxVuiInputs, 100);
                setTimeout(bindCxVuiInputs, 350);
            }
        });
        $(document).ready(function () {
            popupObserver.observe(document.body, { childList: true, subtree: true });
        });
    }

    $(document).ready(function () {
        configurePersianJetAPBData();
        bindCxVuiInputs();
        patchAdminDateDisplays();
        setTimeout(bindCxVuiInputs, 500);
        setTimeout(bindCxVuiInputs, 1500);
    });

    $(window).on('load', function () {
        configurePersianJetAPBData();
        bindCxVuiInputs();
        patchAdminDateDisplays();
        setupGanttChartPatch();
    });

    $(document).on('ajaxComplete', function () {
        setTimeout(bindCxVuiInputs, 200);
        setTimeout(patchAdminDateDisplays, 200);
    });

    $(document).on('click', '.day-slot, .persca-slots-container, .vuejs-datepicker-wrapper-custom, .day-slots, .day-slots-content, .cx-vui-popup__body', function () {
        setTimeout(bindCxVuiInputs, 50);
        setTimeout(bindCxVuiInputs, 150);
        setTimeout(bindCxVuiInputs, 350);
    });

    // ──────────────────────────────────────────
    // Part 4: Backend Vue Component Patching (Appointments Calendar & Timeline)
    // ──────────────────────────────────────────

    function patchAppointmentsCalendarComponent(definition) {
        if (!definition) return;

        definition.template = '<div class="jet-apb-appointments-calendar persca-appointments-calendar persca-custom-calendar">' +
            '<div class="persca-calendar-nav-header">' +
            '<button type="button" class="persca-nav-btn prev-btn" @click="prevMonth">‹</button>' +
            '<span class="persca-calendar-nav-title">{{ currentMonthName }}</span>' +
            '<button type="button" class="persca-nav-btn next-btn" @click="nextMonth">›</button>' +
            '</div>' +
            '<div class="persca-calendar-grid">' +
            '<div class="persca-calendar-weekdays">' +
            '<div class="persca-calendar-weekday" v-for="wd in weekdays" :key="wd">{{ wd }}</div>' +
            '</div>' +
            '<div class="persca-calendar-days">' +
            '<div class="persca-calendar-day empty-day" v-for="p in paddingDays" :key="\'pad-\' + p"></div>' +
            '<div class="persca-calendar-day" :class="{ \'today\': day.isToday }" v-for="day in monthDays" :key="day.day">' +
            '<div class="jet-apb-calendar-day-number persca-calendar-day-number">{{ toPersianDigits(day.day) }}</div>' +
            '<div class="jet-apb-calendar-day-content">' +
            '<div' +
            ' v-for="(attr, index) in day.attributes"' +
            ' v-if="index < maxItemInCell"' +
            ' :key="attr.key || index"' +
            ' class="jet-apb-calendar-day-appointment"' +
            ' @click="callPopup(\'info\', attr.customData || attr)"' +
            '>' +
            '<div class="jet-apb-scroll-text">' +
            '<span class="jet-apb-spot-status" :class="[\'jet-apb-spot-status--\' + ((attr.customData || attr).status || \'\')]"></span>' +
            '<span class="jet-apb-appointment-slot" v-if="(attr.customData || attr).slot">{{ (attr.customData || attr).slot }} - {{ (attr.customData || attr).slot_end }}</span>' +
            '<strong v-if="(attr.customData || attr).service && columns && columns.includes(\'service\')">{{ getItemValue(attr.customData || attr, \'service\') }}</strong>' +
            '<span v-if="(attr.customData || attr).provider && columns && columns.includes(\'provider\')"> - {{ getItemValue(attr.customData || attr, \'provider\') }}</span>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '<div class="jet-apb-calendar-day-more-button" v-if="getRemainingItemCount(day.attributes)">' +
            '<span @click="showMoreJalali(day)">{{ toPersianDigits(getRemainingItemCount(day.attributes)) }} more</span>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>';

        const originalData = definition.data;
        definition.data = function () {
            let dataObj = {};
            if (typeof originalData === 'function') dataObj = originalData.call(this);
            else if (originalData) dataObj = Object.assign({}, originalData);

            const now = new Date();
            const jNow = toJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
            dataObj.currentYear = jNow[0] || 1405;
            dataObj.currentMonth = jNow[1] || 1;
            return dataObj;
        };

        const originalCreated = definition.created;
        definition.created = function () {
            const self = this;
            if (typeof originalCreated === 'function') {
                originalCreated.apply(self, arguments);
            }

            const initialVal = (self.$store && self.$store.state && self.$store.state.timeline && self.$store.state.timeline.selectedDate);
            let date = parseDate(initialVal);
            if (!date) date = new Date();

            const j = toJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
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
            this.changeDate({ month: this.currentMonth, year: this.currentYear });
        };
        definition.methods.changeDate = function (page) {
            const range = getJalaliMonthUnixRange(this.currentYear, this.currentMonth);
            const d1 = new Date(range.start * 1000);
            const d2 = new Date(range.end * 1000);

            // Build the server-side date filter with English month names. The
            // admin appointments endpoint parses it with PHP strtotime(), which
            // only understands English month names (Jalali strings make month
            // navigation return an empty calendar). This deliberately bypasses
            // the Jalali moment.fn.format patch above.
            const enMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            // range.start/end are UTC day boundaries (Date.UTC), so read the date
            // parts with the UTC getters. Using local getters shifts the filter
            // string by one day for browsers west of UTC (e.g. Persian users in
            // the Americas), which would make the PHP strtotime() parser return
            // an empty calendar for that month.
            const s1 = d1.getUTCDate() + ' ' + enMonths[d1.getUTCMonth()] + ' ' + d1.getUTCFullYear();
            const s2 = d2.getUTCDate() + ' ' + enMonths[d2.getUTCMonth()] + ' ' + d2.getUTCFullYear();
            let filterValue = s1 + '-' + s2;

            const current = this.curentFilters || {};
            const newFilters = Object.assign({}, current, { ['date']: filterValue });

            if (this.$store) {
                this.$store.commit('setValue', {
                    key: 'curentFilters',
                    value: newFilters
                });
                this.$store.dispatch('getItems');
            }
        };
        definition.methods.showMoreJalali = function (day) {
            if (!this.$store) return;
            const dateStr = (typeof moment !== 'undefined') ? moment(day.date).format("D MMM YYYY") : String(day.date);
            this.$store.commit('setValue', {
                key: 'timeline',
                value: Object.assign({}, this.$store.state.timeline, { selectedDate: dateStr })
            });
            this.$store.commit('setValue', {
                key: 'curentView',
                value: 'timeline'
            });
            this.$store.dispatch('getItems');
        };
        definition.methods.toPersianDigits = function (n) {
            return toPersianDigits(n);
        };

        definition.computed = definition.computed || {};
        definition.computed.weekdays = function () {
            return (window.PersianDateConverter && window.PersianDateConverter.PERSIAN_WEEKDAYS_LONG)
                ? window.PersianDateConverter.PERSIAN_WEEKDAYS_LONG
                : ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
        };
        definition.computed.currentMonthName = function () {
            const months = (window.PersianDateConverter && window.PersianDateConverter.PERSIAN_MONTHS) || [];
            return (months[this.currentMonth - 1] || '') + ' ' + toPersianDigits(this.currentYear);
        };
        definition.computed.paddingDays = function () {
            const g = toGregorian(this.currentYear, this.currentMonth, 1);
            const jsDay = new Date(Date.UTC(g[0], g[1] - 1, g[2])).getUTCDay();
            return (jsDay + 1) % 7;
        };
        definition.computed.monthDays = function () {
            const y = this.currentYear;
            const m = this.currentMonth;
            const daysCount = getDaysInJalaliMonth(y, m);
            const days = [];
            const items = this.itemsList || [];

            const today = new Date();
            const todayJ = toJalali(today.getFullYear(), today.getMonth() + 1, today.getDate());

            for (let d = 1; d <= daysCount; d++) {
                const g = toGregorian(y, m, d);
                const date = new Date(g[0], g[1] - 1, g[2], 12, 0, 0);
                const dayStartTimestamp = Date.UTC(g[0], g[1] - 1, g[2], 0, 0, 0) / 1000;
                const dayEndTimestamp = Date.UTC(g[0], g[1] - 1, g[2], 23, 59, 59) / 1000;

                const dayAttributes = items.filter(function (attr) {
                    if (!attr) return false;
                    const cd = attr.customData || attr;
                    let itemTs = 0;
                    const rawTs = cd.date_timestamp || cd.slot_timestamp;
                    if (rawTs) {
                        const num = parseInt(rawTs, 10);
                        if (!isNaN(num) && num > 100000) {
                            itemTs = num < 10000000000 ? num : Math.floor(num / 1000);
                        }
                    }
                    if (!itemTs && cd.date) {
                        const parsed = parseDate(cd.date);
                        if (parsed && !isNaN(parsed.getTime())) {
                            itemTs = Math.floor(parsed.getTime() / 1000);
                        }
                    }
                    if (itemTs > 0) {
                        return itemTs >= dayStartTimestamp && itemTs <= dayEndTimestamp;
                    }
                    return false;
                });

                days.push({
                    day: d,
                    date: date,
                    attributes: dayAttributes,
                    isToday: (y === todayJ[0] && m === todayJ[1] && d === todayJ[2])
                });
            }
            return days;
        };
    }

    // ──────────────────────────────────────────
    // Part 5: Gantt Chart / Timeline moment.js patching
    // ──────────────────────────────────────────

    function setupGanttChartPatch() {
        if (typeof moment === 'undefined') return;
        if (moment.fn.format.isPatchedByPersca) return;

        const originalMomentFormat = moment.fn.format;
        moment.fn.format = function () {
            try {
                const fmt = arguments[0];
                if ((fmt === 'DD MMM' || fmt === 'MM/DD' || fmt === 'D MMMM YYYY') && typeof this.toDate === 'function') {
                    const d = this.toDate();
                    if (d instanceof Date && !isNaN(d.getTime())) {
                        return formatJalali(d, fmt);
                    }
                }
            } catch (err) { }

            return originalMomentFormat.apply(this, arguments);
        };
        moment.fn.format.isPatchedByPersca = true;
    }

    // ──────────────────────────────────────────
    // Part 6: Vue & Vuex Interception
    // ──────────────────────────────────────────

    function patchVue(VueInstance) {
        if (!VueInstance || VueInstance.isPatchedByPersca) return;
        VueInstance.isPatchedByPersca = true;

        const originalComponent = VueInstance.component;
        VueInstance.component = function (name, definition) {
            if (name === 'vuejs-datepicker') {
                return originalComponent.call(this, name, JalaliDatepickerComponent);
            }
            if (name === 'jet-apb-appointments-calendar') {
                patchAppointmentsCalendarComponent(definition);
            }
            return originalComponent.apply(this, arguments);
        };

        VueInstance.mixin({
            beforeCreate: function () {
                if (this.$options && this.$options.components) {
                    // JetAppointments registers the picker under both spellings
                    // (settings.js uses 'vuejsDatepicker', the integration and
                    // older builds use 'vuejs-datepicker'). Replace either so
                    // every screen renders the Jalali picker.
                    if (this.$options.components['vuejs-datepicker'] && this.$options.components['vuejs-datepicker'] !== JalaliDatepickerComponent) {
                        this.$options.components['vuejs-datepicker'] = JalaliDatepickerComponent;
                    }
                    if (this.$options.components['vuejsDatepicker'] && this.$options.components['vuejsDatepicker'] !== JalaliDatepickerComponent) {
                        this.$options.components['vuejsDatepicker'] = JalaliDatepickerComponent;
                    }
                }
                if (this.$options && this.$options.methods && this.$options.methods.getItemValue) {
                    const originalGetItemValue = this.$options.methods.getItemValue;
                    if (!originalGetItemValue.isPatched) {
                        const patchedGetItemValue = function (item, propertyName) {
                            if (propertyName === 'date' && item) {
                                const raw = item.date_timestamp || item.date;
                                const parsed = parseDate(raw);
                                if (parsed && !isNaN(parsed.getTime())) {
                                    return formatJalali(parsed);
                                }
                            }
                            if (propertyName === 'slot' || propertyName === 'slot_end') {
                                return to24hTime(item ? item[propertyName] : '');
                            }
                            return originalGetItemValue.apply(this, arguments);
                        };
                        patchedGetItemValue.isPatched = true;
                        this.$options.methods.getItemValue = patchedGetItemValue;
                    }
                }
            },
            methods: {
                getItemValue: function (item, propertyName) {
                    if (!item) return '';
                    if ('user_id' === propertyName && !item[propertyName]) {
                        return (typeof wp !== 'undefined' && wp.i18n && wp.i18n.__) ? wp.i18n.__('Guest', 'jet-appointments-booking') : 'Guest';
                    }
                    if (item[propertyName] === undefined || item[propertyName] === null || item[propertyName] === '') {
                        return '';
                    }
                    let value = item[propertyName];
                    if (propertyName === 'date') {
                        const parsed = parseDate(item.date_timestamp || value);
                        if (parsed && !isNaN(parsed.getTime())) {
                            return formatJalali(parsed);
                        }
                        return value;
                    }
                    if (propertyName === 'slot' || propertyName === 'slot_end') {
                        return to24hTime(value);
                    }
                    if (this.filters && this.filters[propertyName] && this.filters[propertyName].value) {
                        return this.filters[propertyName].value[value] || value;
                    }
                    if (propertyName === 'status' && window.JetAPBConfig && window.JetAPBConfig.statuses_list) {
                        return window.JetAPBConfig.statuses_list[value] || value;
                    }
                    return value;
                }
            }
        });

        try {
            const existingCalendar = VueInstance.options.components['jet-apb-appointments-calendar'] || VueInstance.component('jet-apb-appointments-calendar');
            if (existingCalendar) {
                const opts = existingCalendar.options || existingCalendar;
                patchAppointmentsCalendarComponent(opts);
            }
        } catch (e) { }

        try {
            originalComponent.call(VueInstance, 'vuejs-datepicker', JalaliDatepickerComponent);
        } catch (e) { }
    }

    if (typeof Vue !== 'undefined') {
        patchVue(Vue);
    } else {
        const vueInterval = setInterval(function () {
            if (typeof Vue !== 'undefined') {
                patchVue(Vue);
                clearInterval(vueInterval);
            }
        }, 50);
        setTimeout(function () { clearInterval(vueInterval); }, 5000);
    }

})(jQuery);
