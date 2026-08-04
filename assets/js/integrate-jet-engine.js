(function($) {
    'use strict';



    let originalDatepicker = null;
    let originalDatetimepicker = null;

    // Check if an element belongs to JetEngine context
    function isJetEngineElement($el) {
        return $el.closest(
            '.jet-engine-meta-boxes, .cx-vui-component, .cx-control,' +
            '.jet-form, .jet-form-builder'
        ).length > 0;
    }

    // Check if an element or options represents a time-only field
    function isTimeField($el, options) {
        if (!$el || !$el.length) return false;
        const type = ($el.attr('type') || '').toLowerCase();
        if (type === 'time') {
            return true;
        }
        const dataType = ($el.attr('data-type') || $el.data('type') || '').toLowerCase();
        const dataFieldType = ($el.attr('data-field-type') || $el.data('field-type') || '').toLowerCase();
        if (dataType === 'time' || dataFieldType === 'time') {
            return true;
        }
        if ($el.hasClass('time-field') || 
            $el.hasClass('jet-form-builder__field--time') || 
            $el.hasClass('jet-form__field--time') || 
            $el.hasClass('cx-vui-time') || 
            $el.hasClass('cx-ui-time') ||
            $el.hasClass('cx-vui-time-picker') ||
            $el.hasClass('jet-time-picker') ||
            $el.closest('.cx-vui-time, .cx-vui-component--time, .jet-form-builder__field-wrap--time, .jet-form__field-wrap--time').length > 0) {
            return true;
        }
        if (options && typeof options === 'object') {
            if (options.timepickerOnly === true || options.timeOnly === true || options.datepicker === false || options.onlyTime === true) {
                return true;
            }
        }
        return false;
    }

    // Custom Datepicker Wrapper — only intercepts JetEngine elements
    const customDatepicker = function(options) {
        const args = Array.prototype.slice.call(arguments);

        // For string method calls, check if this is an initialized JetEngine field
        if (typeof options === 'string') {
            const method = options;
            if (method === 'setDate') {
                const dateVal = args[1];
                // Only intercept setDate for fields we initialized
                const self = this;
                let handled = false;
                this.each(function() {
                    const $el = $(this);
                    if ($el.data('persian-calendar-init')) {
                        if (window.PersianCalendarIntegrations) {
                            window.PersianCalendarIntegrations.updateDisplayVal($el, dateVal);
                        }
                        handled = true;
                    }
                });
                if (handled) return this;
            }
            if (originalDatepicker) {
                return originalDatepicker.apply(this, arguments);
            }
            return this;
        }

        // For initialization calls, only intercept JetEngine elements
        return this.each(function() {
            const $visibleInput = $(this);
            if (isJetEngineElement($visibleInput)) {
                if (isTimeField($visibleInput, options)) {
                    var handledTime = false;
                    if (window.PersianCalendarIntegrations && window.PersianCalendarIntegrations.setupJalaliTimePicker) {
                        var $altTime = (options && options.altField) ? $(options.altField) : null;
                        handledTime = window.PersianCalendarIntegrations.setupJalaliTimePicker($visibleInput, $altTime, $);
                    }
                    if (!handledTime && originalDatepicker) {
                        originalDatepicker.call($visibleInput, options);
                    }
                    return;
                }
                const $altInput = (options && options.altField) ? $(options.altField) : null;
                let handled = false;
                if (window.PersianCalendarIntegrations) {
                    handled = window.PersianCalendarIntegrations.setupJalaliDatePicker($visibleInput, $altInput, false, $);
                }
                if (!handled && originalDatepicker) {
                    originalDatepicker.call($visibleInput, options);
                }
            } else if (originalDatepicker) {
                originalDatepicker.call($visibleInput, options);
            }
        });
    };

    // Custom Datetimepicker Wrapper — only intercepts JetEngine elements
    const customDatetimepicker = function(options) {
        const args = Array.prototype.slice.call(arguments);

        if (typeof options === 'string') {
            const method = options;
            if (method === 'setDate') {
                const dateVal = args[1];
                const self = this;
                let handled = false;
                this.each(function() {
                    const $el = $(this);
                    if ($el.data('persian-calendar-init')) {
                        if (window.PersianCalendarIntegrations) {
                            window.PersianCalendarIntegrations.updateDisplayVal($el, dateVal);
                        }
                        handled = true;
                    }
                });
                if (handled) return this;
            }
            if (originalDatetimepicker) {
                return originalDatetimepicker.apply(this, arguments);
            }
            return this;
        }

        return this.each(function() {
            const $visibleInput = $(this);
            if (isJetEngineElement($visibleInput)) {
                if (isTimeField($visibleInput, options)) {
                    var handledTime = false;
                    if (window.PersianCalendarIntegrations && window.PersianCalendarIntegrations.setupJalaliTimePicker) {
                        var $altTime = (options && options.altField) ? $(options.altField) : null;
                        handledTime = window.PersianCalendarIntegrations.setupJalaliTimePicker($visibleInput, $altTime, $);
                    }
                    if (!handledTime && originalDatetimepicker) {
                        originalDatetimepicker.call($visibleInput, options);
                    }
                    return;
                }
                const $altInput = (options && options.altField) ? $(options.altField) : null;
                let handled = false;
                if (window.PersianCalendarIntegrations) {
                    handled = window.PersianCalendarIntegrations.setupJalaliDatePicker($visibleInput, $altInput, true, $);
                }
                if (!handled && originalDatetimepicker) {
                    originalDatetimepicker.call($visibleInput, options);
                }
            } else if (originalDatetimepicker) {
                originalDatetimepicker.call($visibleInput, options);
            }
        });
    };

    // Intercept $.fn.datepicker using defineProperty
    if (Object.defineProperty) {
        if ($.fn.datepicker && $.fn.datepicker !== customDatepicker) {
            originalDatepicker = $.fn.datepicker;
        }
        Object.defineProperty($.fn, 'datepicker', {
            get: function() {
                return customDatepicker;
            },
            set: function(val) {
                if (val !== customDatepicker) {
                    originalDatepicker = val;
                }
            },
            configurable: true,
            enumerable: true
        });

        if ($.fn.datetimepicker && $.fn.datetimepicker !== customDatetimepicker) {
            originalDatetimepicker = $.fn.datetimepicker;
        }
        Object.defineProperty($.fn, 'datetimepicker', {
            get: function() {
                return customDatetimepicker;
            },
            set: function(val) {
                if (val !== customDatetimepicker) {
                    originalDatetimepicker = val;
                }
            },
            configurable: true,
            enumerable: true
        });
    } else {
        if ($.fn.datepicker) originalDatepicker = $.fn.datepicker;
        $.fn.datepicker = customDatepicker;

        if ($.fn.datetimepicker) originalDatetimepicker = $.fn.datetimepicker;
        $.fn.datetimepicker = customDatetimepicker;
    }



    function initJetEngineFrontendFields(context) {
        const $ctx = context ? $(context) : $(document);
        const selectors = [
            'input.jet-form__field[type="date"]',
            'input.jet-form__field[type="datetime-local"]',
            'input.jet-form__field.persian-calendar-input',
            'input.jet-form-builder__field[type="date"]',
            'input.jet-form-builder__field[type="datetime-local"]',
            'input.jet-form-builder__field.persian-calendar-input',
            '.jet-form input[type="date"]',
            '.jet-form input[type="datetime-local"]',
            '.jet-form input.persian-calendar-input',
            '.jet-form-builder input[type="date"]',
            '.jet-form-builder input[type="datetime-local"]',
            '.jet-form-builder input.persian-calendar-input',
            'input.cx-vui-input[type="date"]',
            'input.cx-vui-input[type="datetime-local"]',
            'input.cx-vui-input.persian-calendar-input',
            '.cx-vui-component input[type="date"]',
            '.cx-vui-component input[type="datetime-local"]',
            '.cx-vui-component input.persian-calendar-input',
            '.cx-control input[type="date"]',
            '.cx-control input[type="datetime-local"]',
            '.cx-control input.persian-calendar-input',
            'input.jet-form__field[type="time"]',
            'input.jet-form-builder__field[type="time"]',
            '.jet-form input[type="time"]',
            '.jet-form-builder input[type="time"]',
            'input.cx-vui-input[type="time"]',
            '.cx-vui-component input[type="time"]',
            '.cx-control input[type="time"]'
        ];

        $ctx.find(selectors.join(', ')).each(function() {
            const $visibleInput = $(this);
            if (isTimeField($visibleInput)) {
                if (window.PersianCalendarIntegrations && window.PersianCalendarIntegrations.setupJalaliTimePicker) {
                    window.PersianCalendarIntegrations.setupJalaliTimePicker($visibleInput, null, $);
                }
                return;
            }
            let isTime = false;
            const dataShowTime = $visibleInput.attr('data-persian-show-time');
            if (dataShowTime !== undefined && dataShowTime !== null) {
                isTime = dataShowTime === 'true';
            } else {
                isTime = $visibleInput.attr('type') === 'datetime-local' || $visibleInput.hasClass('datetime-field');
                if ($visibleInput.attr('type') === 'date') {
                    isTime = false;
                }
            }
            if (window.PersianCalendarIntegrations) {
                window.PersianCalendarIntegrations.setupJalaliDatePicker($visibleInput, null, isTime, $);
            }
        });
    }

    // Auto-initialize on document ready and monitor DOM for dynamic fields
    $(function() {
        initJetEngineFrontendFields();

        $(document).on('elementor/popup/show', function(event, id, instance) {
            if (instance && instance.$element) {
                initJetEngineFrontendFields(instance.$element);
            } else {
                initJetEngineFrontendFields();
            }
        });

        $(document).on('jet-popup/show-event', function(event, $popup) {
            initJetEngineFrontendFields($popup);
        });

        if (typeof MutationObserver !== 'undefined') {
            const observer = new MutationObserver(function(mutations) {
                let needsInit = false;
                mutations.forEach(function(mutation) {
                    if (mutation.addedNodes && mutation.addedNodes.length) {
                        for (let i = 0; i < mutation.addedNodes.length; i++) {
                            const node = mutation.addedNodes[i];
                            if (node.nodeType === 1) {
                                const $node = $(node);
                                if ($node.find('input[type="date"], input[type="datetime-local"], input.persian-calendar-input').length || 
                                    $node.is('input[type="date"], input[type="datetime-local"], input.persian-calendar-input')) {
                                    needsInit = true;
                                    break;
                                }
                            }
                        }
                    }
                });
                if (needsInit) {
                    initJetEngineFrontendFields();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    });

})(jQuery);
