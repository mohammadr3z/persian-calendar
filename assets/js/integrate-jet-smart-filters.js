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
                    handled = setupJalaliDatePickerForJSF($visibleInput, $);
                }
                if (!handled && originalDatepicker) {
                    originalDatepicker.call($visibleInput, options);
                }
            } else if (originalDatepicker) {
                originalDatepicker.call($visibleInput, options);
            }
        });
    };

    function setupJalaliDatePickerForJSF($visibleInput, $) {
        if (typeof window.PersianCalendarIntegrations === 'undefined') return false;
        
        const initialVal = $visibleInput.val();
        
        // Delegate to the main integration handler for all popup and observer logic
        const handled = window.PersianCalendarIntegrations.setupJalaliDatePicker($visibleInput, null, false, $);
        
        if (handled) {
            // Re-override the value descriptor specifically for JetSmartFilters formats
            overrideJSFValueDescriptor($visibleInput[0], $);
            
            // Re-trigger setter to ensure initial value is parsed and converted to Jalali correctly
            if (initialVal) {
                $visibleInput[0].value = initialVal;
            }
        }
        
        return handled;
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
                        const format = $container.find('.jet-date-range__input').data('date-format') || 'mm/dd/yy';
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
                    $popup = $('<div class="persian-calendar-popup" style="display:none; position:absolute; z-index:999999; background:#fff; box-shadow:0 4px 20px rgba(0,0,0,0.15); border:1px solid #edf2f7; border-radius:8px; padding:15px; width:280px;"></div>');
                    $popup.on('click mousedown mouseup pointerdown pointerup touchstart touchend', function(e) {
                        e.stopPropagation();
                    });
                    const $parentPopup = $input.closest('.elementor-popup-modal, .jet-popup, .dialog-widget, .jet-popup-container');
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
                        if (finalVal) {
                            const parts = finalVal.split('-');
                            if (parts.length >= 2) {
                                const d1 = new Date(parts[0].replace(/\./g, '/'));
                                const d2 = new Date(parts[1].replace(/\./g, '/'));
                                if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
                                    const js1 = mockApi.formatDate('', d1);
                                    const js2 = mockApi.formatDate('', d2);
                                    let sep = ' - ';
                                    try {
                                        const df = $input.data('format');
                                        if (df && df.separator) sep = df.separator;
                                    } catch (err) {}
                                    
                                    const $button = $input.closest('.jet-date-period__datepicker').find('.jet-date-period__datepicker-button');
                                    if ($button.length) {
                                        if (!$button.find('.jet-date-period-start').length) {
                                            $button.html('<div class="jet-date-period-start">' + js1 + '</div><div class="jet-date-period-separator">' + sep + '</div><div class="jet-date-period-end">' + js2 + '</div>');
                                        } else {
                                            $button.find('.jet-date-period-start').text(js1);
                                            $button.find('.jet-date-period-end').text(js2);
                                            $button.find('.jet-date-period-separator').text(sep);
                                        }
                                    }
                                }
                            } else if (parts.length === 1) {
                                const d1 = new Date(parts[0].replace(/\./g, '/'));
                                if (!isNaN(d1.getTime())) {
                                    const js1 = mockApi.formatDate('', d1);
                                    const $button = $input.closest('.jet-date-period__datepicker').find('.jet-date-period__datepicker-button');
                                    if ($button.length) {
                                        $button.text(js1);
                                    }
                                }
                            }
                        }
                    }
                };

                let initialDate = new Date();
                let initialRangeStart = null;
                let initialRangeEnd = null;
                
                const currentVal = $input.val();
                if (currentVal) {
                    const parts = currentVal.split('-');
                    if (parts[0]) {
                        const d1 = new Date(parts[0].replace(/\./g, '/'));
                        if (!isNaN(d1.getTime())) {
                            initialDate = d1;
                            initialRangeStart = d1;
                        }
                    }
                    if (parts[1]) {
                        const d2 = new Date(parts[1].replace(/\./g, '/'));
                        if (!isNaN(d2.getTime())) {
                            initialRangeEnd = d2;
                        }
                    }
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
