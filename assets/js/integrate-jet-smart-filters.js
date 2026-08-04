(function($) {
    'use strict';

    let originalDatepicker = null;
    let originalAirDatepicker = null;

    function isJetSmartFiltersElement($el) {
        return $el.hasClass('jet-date-range__from') || $el.hasClass('jet-date-range__to');
    }

    const customDatepicker = function(options) {
        if (typeof options === 'string') {
            if (originalDatepicker) {
                return originalDatepicker.apply(this, arguments);
            }
            return this;
        }

        return this.each(function() {
            const $visibleInput = $(this);
            if (isJetSmartFiltersElement($visibleInput)) {
                let handled = false;
                if (window.PersianCalendarIntegrations) {
                    handled = setupJalaliDatePickerForJSF($visibleInput, $, options);
                }
                if (!handled && originalDatepicker) {
                    originalDatepicker.call($visibleInput, options);
                }
            } else if (originalDatepicker) {
                originalDatepicker.call($visibleInput, options);
            }
        });
    };

    function setupJalaliDatePickerForJSF($visibleInput, $, options) {
        if (typeof window.PersianCalendarIntegrations === 'undefined') return false;
        
        const initialVal = $visibleInput.val();

        // Remember the date format JetSmartFilters asked for, so the value getter
        // and the onSelect callback below hand back exactly what the filter expects.
        if (options && options.dateFormat) {
            $visibleInput.data('persca-jsf-format', options.dateFormat);
        }
        
        // Delegate to the main integration handler for all popup and observer logic
        const handled = window.PersianCalendarIntegrations.setupJalaliDatePicker($visibleInput, null, false, $);
        
        if (handled) {
            // Re-override the value descriptor specifically for JetSmartFilters formats
            overrideJSFValueDescriptor($visibleInput[0], $);

            // Replay the datepicker callbacks JetSmartFilters passed in, otherwise
            // the filter never learns about the picked date and stays unapplied.
            bindJSFDatepickerCallbacks($visibleInput, $, options);
            
            // Re-trigger setter to ensure initial value is parsed and converted to Jalali correctly
            if (initialVal) {
                $visibleInput[0].value = initialVal;
            }
        }
        
        return handled;
    }

    /**
     * Bridge our Jalali picker back into jQuery UI datepicker's contract.
     *
     * JetSmartFilters initialises the Date Range filter with
     * $input.datepicker({ dateFormat, altField, onSelect }) and only records the
     * chosen value inside that onSelect callback. Because this integration
     * replaces $.fn.datepicker and never calls the original implementation, the
     * callback used to be dropped: the visible input showed a Jalali date but
     * the filter itself received nothing, so nothing was filtered.
     *
     * Here we listen for the change event dispatched by the Jalali popup and
     * call onSelect (and fill altField) with the Gregorian date, formatted with
     * the format JetSmartFilters requested.
     */
    function bindJSFDatepickerCallbacks($visibleInput, $, options) {
        if (!options || typeof options.onSelect !== 'function') return;
        if ($visibleInput.data('persca-jsf-callbacks-bound')) return;
        $visibleInput.data('persca-jsf-callbacks-bound', true);

        const $container = $visibleInput.closest('.jet-date-range');
        const format = options.dateFormat
            || $container.find('.jet-date-range__input').data('date-format')
            || 'yy-mm-dd';

        $visibleInput.on('change.perscaJsf', function () {
            const isoVal = $(this).data('persian-gregorian-val');
            if (!isoVal) return;

            const d = window.PersianCalendarIntegrations.parseLocalDate(isoVal);
            if (!d || isNaN(d.getTime())) return;

            let dateText = isoVal;
            if (window.jQuery && window.jQuery.datepicker) {
                try {
                    dateText = window.jQuery.datepicker.formatDate(format, d);
                } catch (err) {}
            }

            if (options.altField) {
                try { $(options.altField).val(dateText); } catch (err) {}
            }

            try {
                options.onSelect.call(this, dateText, {
                    input: $(this),
                    selectedDay: d.getDate(),
                    selectedMonth: d.getMonth(),
                    selectedYear: d.getFullYear(),
                    lastVal: dateText
                });
            } catch (err) {}
        });
    }

    function overrideJSFValueDescriptor(el, $) {
        if (!el) return;
        const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        Object.defineProperty(el, 'value', {
            get: function() {
                const gregVal = $(this).data('persian-gregorian-val');
                if (gregVal) {
                    const d = new Date(gregVal);
                    if (!isNaN(d.getTime())) {
                        const $container = $(this).closest('.jet-date-range');
                        const format = $(this).data('persca-jsf-format')
                            || $container.find('.jet-date-range__input').data('date-format')
                            || 'mm/dd/yy';
                        if (window.jQuery && window.jQuery.datepicker) {
                            try {
                                return window.jQuery.datepicker.formatDate(format, d);
                            } catch (err) {}
                        }
                        return gregVal;
                    }
                }
                return descriptor.get.call(this);
            },
            set: function(val) {
                const valStr = String(val);
                if (!val) {
                    $(this).data('persian-gregorian-val', '');
                    descriptor.set.call(this, '');
                    return;
                }
                
                let parsedDate = null;
                if (/^\d{4}-\d{2}-\d{2}/.test(valStr)) {
                    parsedDate = window.PersianCalendarIntegrations.parseLocalDate(valStr);
                } else {
                    let cleanStr = valStr.replace(/\./g, '/').replace(/-/g, '/');
                    let timestamp = Date.parse(cleanStr);
                    if (!isNaN(timestamp)) {
                        parsedDate = new Date(timestamp);
                    }
                }
                
                if (parsedDate && !isNaN(parsedDate.getTime())) {
                    const isoVal = parsedDate.getFullYear() + '-' + String(parsedDate.getMonth() + 1).padStart(2, '0') + '-' + String(parsedDate.getDate()).padStart(2, '0');
                    $(this).data('persian-gregorian-val', isoVal);
                    if (window.PersianCalendarIntegrations) {
                        window.PersianCalendarIntegrations.updateDisplayVal($(this), isoVal);
                    }
                } else {
                    descriptor.set.call(this, val);
                }
            },
            configurable: true,
            enumerable: true
        });
    }

    // Intercept $.fn.datepicker using defineProperty
    if (Object.defineProperty) {
        if ($.fn.datepicker && $.fn.datepicker !== customDatepicker) {
            originalDatepicker = $.fn.datepicker;
            if (Object.setPrototypeOf) Object.setPrototypeOf(customDatepicker, originalDatepicker);
        }
        Object.defineProperty($.fn, 'datepicker', {
            get: function() { return customDatepicker; },
            set: function(val) {
                if (val !== customDatepicker) {
                    originalDatepicker = val;
                    if (Object.setPrototypeOf) Object.setPrototypeOf(customDatepicker, originalDatepicker);
                }
            },
            configurable: true,
            enumerable: true
        });
    }

    const customAirDatepicker = function(options) {
        if (typeof options === 'string') {
            if (originalAirDatepicker) {
                return originalAirDatepicker.apply(this, arguments);
            }
            return this;
        }

        return this.each(function() {
            const $input = $(this);
            if ($input.hasClass('jet-date-period__datepicker-input')) {
                if (typeof window.PersianCalendar === 'undefined') return;
                
                let $popup = $input.data('persian-popup');
                if (!$popup) {
                    $popup = $('<div class="persian-calendar-popup" style="display:none; position:absolute; z-index:999999; pointer-events:auto; background:#fff; box-shadow:0 4px 20px rgba(0,0,0,0.15); border:1px solid #edf2f7; border-radius:8px; padding:15px; width:280px;"></div>');
                    $popup.on('click mousedown mouseup pointerdown pointerup touchstart touchend', function(e) {
                        e.stopPropagation();
                    });
                    const $parentPopup = $input.closest('.jet-popup__container-inner, .dialog-widget-content, .elementor-popup-modal, .jet-popup-container, .jet-popup, .dialog-widget');
                    if ($parentPopup.length) {
                        $parentPopup.append($popup);
                    } else {
                        $('body').append($popup);
                    }
                    $input.data('persian-popup', $popup);
                }
                
                $popup.empty();
                const container = document.createElement('div');
                $popup.append(container);

                const mockApi = {
                    $el: $input,
                    el: $input[0],
                    opts: {
                        firstDay: (options && options.firstDay !== undefined) ? options.firstDay : 0
                    },
                    show: function() {
                        const $button = $input.closest('.jet-date-period__datepicker').find('.jet-date-period__datepicker-button');
                        if ($button.length) {
                            const offset = $button.offset();
                            let top = offset.top + $button.outerHeight() + 5;
                            let left = offset.left;

                            const $parent = $popup.parent();
                            if ($parent.length && !$parent.is('body')) {
                                const parentOffset = $parent.offset();
                                top -= parentOffset.top;
                                left -= parentOffset.left;
                            }

                            $popup.css({ top: top + 'px', left: left + 'px', display: 'block' });
                        }
                    },
                    hide: function() {
                        $popup.hide();
                    },
                    formatDate: function(format, dateObj) {
                        if (!dateObj) return '';
                        if (window.PersianDateConverter && window.PersianDateConverter.gregorianToJalali) {
                            const sj = window.PersianDateConverter.gregorianToJalali(dateObj.getFullYear(), dateObj.getMonth() + 1, dateObj.getDate());
                            return sj[0] + '/' + String(sj[1]).padStart(2, '0') + '/' + String(sj[2]).padStart(2, '0');
                        }
                        return dateObj.toLocaleDateString();
                    },
                    selectDate: function(date) {
                        if (!date) return;
                        if (Array.isArray(date)) {
                            updateDatesAndUI(date);
                            if (calendar) {
                                calendar.options.rangeStart = date[0];
                                calendar.options.rangeEnd = date[1];
                                calendar.render();
                            }
                        } else {
                            updateDatesAndUI([date]);
                            if (calendar) {
                                if (window.PersianDateConverter) {
                                    const jDate = window.PersianDateConverter.gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
                                    calendar.selectedDate = { year: jDate[0], month: jDate[1], day: jDate[2] };
                                    calendar.currentYear = jDate[0];
                                    calendar.currentMonth = jDate[1];
                                }
                                calendar.render();
                            }
                        }
                    },
                    selectedDates: []
                };

                /**
                 * Parse one Gregorian date or a Gregorian date range.
                 *
                 * Supported examples:
                 * 2026-08-01
                 * 2026/08/01
                 * 2026.08.01
                 * 2026-08-01 - 2026-08-10
                 *
                 * @param {string} value
                 * @return {{ start: Date|null, end: Date|null }}
                 */
                const parseGregorianDateValue = function(value) {
                    const result = {
                        start: null,
                        end: null
                    };

                    if (typeof value !== 'string' || !value.trim()) {
                        return result;
                    }

                    /*
                     * Extract dates directly so that the hyphens inside
                     * YYYY-MM-DD are not confused with the range separator.
                     */
                    const matches = value.match(/\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2}/g);

                    if (!matches || !matches.length) {
                        return result;
                    }

                    const createDate = function(dateString) {
                        const normalized = dateString
                            .replace(/[\/.]/g, '-')
                            .split('-')
                            .map(Number);

                        if (normalized.length !== 3) {
                            return null;
                        }

                        const year = normalized[0];
                        const month = normalized[1];
                        const day = normalized[2];

                        const date = new Date(year, month - 1, day);

                        /*
                         * new Date() silently normalises invalid dates, e.g.
                         * 2026-02-31 rolls over to the next month. This check
                         * catches that.
                         */
                        if (
                            date.getFullYear() !== year ||
                            date.getMonth() !== month - 1 ||
                            date.getDate() !== day
                        ) {
                            return null;
                        }

                        return date;
                    };

                    result.start = createDate(matches[0]);

                    if (matches[1]) {
                        result.end = createDate(matches[1]);
                    }

                    return result;
                };

                const updateDatesAndUI = function(dates) {
                    mockApi.selectedDates = dates;
                    if (options.onSelect) {
                        let formatStr = '';
                        let startFormat = '';
                        let endFormat = '';
                        let separator = ' - ';
                        if (dates.length >= 2 && window.PersianDateConverter && window.PersianDateConverter.gregorianToJalali) {
                            startFormat = mockApi.formatDate('', dates[0]);
                            endFormat = mockApi.formatDate('', dates[1]);
                            try {
                                const df = $input.data('format');
                                if (df && df.separator) separator = df.separator;
                            } catch (err) {}
                            formatStr = startFormat + separator + endFormat;
                        } else if (dates.length === 1 && window.PersianDateConverter) {
                            startFormat = mockApi.formatDate('', dates[0]);
                            formatStr = startFormat;
                        }
                        
                        const passedData = options.range ? mockApi.selectedDates : mockApi.selectedDates[0];
                        options.onSelect(formatStr, passedData, mockApi);
                        
                        // AFTER options.onSelect has written the computed Gregorian range or date back to $input,
                        // we read it and update the button to display the Jalali equivalent!
                        const finalVal = $input.val();
                        const parsedValue = parseGregorianDateValue(finalVal);

                        if (parsedValue.start) {
                            const js1 = mockApi.formatDate('', parsedValue.start);
                            const $button = $input
                                .closest('.jet-date-period__datepicker')
                                .find('.jet-date-period__datepicker-button');

                            if ($button.length) {
                                if (parsedValue.end) {
                                    const js2 = mockApi.formatDate('', parsedValue.end);

                                    let sep = ' - ';

                                    try {
                                        const df = $input.data('format');

                                        if (df && typeof df.separator === 'string') {
                                            sep = df.separator;
                                        }
                                    } catch (err) {}

                                    if (!$button.find('.jet-date-period-start').length) {
                                        /*
                                         * Elements are static and date values are inserted
                                         * via text(), so neither the separator nor the date
                                         * is injected as raw HTML.
                                         */
                                        const $start = $('<div>', {
                                            class: 'jet-date-period-start',
                                            text: js1
                                        });

                                        const $separator = $('<div>', {
                                            class: 'jet-date-period-separator',
                                            text: sep
                                        });

                                        const $end = $('<div>', {
                                            class: 'jet-date-period-end',
                                            text: js2
                                        });

                                        $button.empty().append($start, $separator, $end);
                                    } else {
                                        $button.find('.jet-date-period-start').text(js1);
                                        $button.find('.jet-date-period-separator').text(sep);
                                        $button.find('.jet-date-period-end').text(js2);
                                    }
                                } else {
                                    $button.text(js1);
                                }
                            }
                        }
                    }
                };

                let initialDate = new Date();
                let initialRangeStart = null;
                let initialRangeEnd = null;
                
                const currentVal = $input.val();
                const initialValue = parseGregorianDateValue(currentVal);

                if (initialValue.start) {
                    initialDate = initialValue.start;
                    initialRangeStart = initialValue.start;
                }

                if (initialValue.end) {
                    initialRangeEnd = initialValue.end;
                }

                const calendar = new window.PersianCalendar(container, {
                    selectedDate: initialDate,
                    rangeStart: initialRangeStart,
                    rangeEnd: initialRangeEnd,
                    rangeMode: !!options.range,
                    showTime: false,
                    usePersianDigits: false,
                    onDateSelect: function(dateInfo) {
                        if (options.range) {
                            if (dateInfo.rangeStart && dateInfo.rangeEnd) {
                                $popup.hide();
                                updateDatesAndUI([dateInfo.rangeStart, dateInfo.rangeEnd]);
                            }
                        } else {
                            if (dateInfo.date) {
                                $popup.hide();
                                updateDatesAndUI([dateInfo.date]);
                            }
                        }
                    }
                });

                $input.data('datepicker', mockApi);

                // Handle outside click to hide
                const eventNamespace = '.airDatepickerMock_' + Math.random().toString(36).substr(2, 9);
                $(document).on('click' + eventNamespace, function(e) {
                    if (!document.contains(e.target)) return;
                    const $button = $input.closest('.jet-date-period__datepicker').find('.jet-date-period__datepicker-button');
                    if (!$(e.target).closest($popup).length && !$(e.target).closest($button).length) {
                        mockApi.hide();
                    }
                });
            } else if (originalAirDatepicker) {
                originalAirDatepicker.call($input, options);
            }
        });
    };

    // Intercept $.fn.airDatepicker using defineProperty
    if (Object.defineProperty) {
        if ($.fn.airDatepicker && $.fn.airDatepicker !== customAirDatepicker) {
            originalAirDatepicker = $.fn.airDatepicker;
            if (Object.setPrototypeOf) Object.setPrototypeOf(customAirDatepicker, originalAirDatepicker);
        }
        Object.defineProperty($.fn, 'airDatepicker', {
            get: function() { return customAirDatepicker; },
            set: function(val) {
                if (val !== customAirDatepicker) {
                    originalAirDatepicker = val;
                    if (Object.setPrototypeOf) Object.setPrototypeOf(customAirDatepicker, originalAirDatepicker);
                }
            },
            configurable: true,
            enumerable: true
        });
    }

})(jQuery);
