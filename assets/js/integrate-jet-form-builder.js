(function($) {
    'use strict';

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

    function initJFBFrontendFields(context) {
        const $ctx = context ? $(context) : $(document);
        let isJetEngineAdminPage = false;
        if (typeof window !== 'undefined' && window.location) {
            const search = window.location.search || '';
            const pathname = window.location.pathname || '';
            if (search.indexOf('page=jet-engine') !== -1 || 
                pathname.indexOf('post.php') !== -1 || 
                pathname.indexOf('post-new.php') !== -1) {
                isJetEngineAdminPage = true;
            }
        }

        let selectors = [
            'input.jet-form-builder__field[type="date"]',
            'input.jet-form-builder__field[type="datetime-local"]',
            'input.jet-form-builder__field.persian-calendar-input',
            '.jet-form-builder input[type="date"]',
            '.jet-form-builder input[type="datetime-local"]',
            '.jet-form-builder input.persian-calendar-input',
            'input.jet-form-builder__field[type="time"]',
            '.jet-form-builder input[type="time"]'
        ];

        if (!isJetEngineAdminPage) {
            selectors = selectors.concat([
                'input.cx-vui-input[type="date"]',
                'input.cx-vui-input[type="datetime-local"]',
                'input.cx-vui-input.persian-calendar-input',
                '.cx-vui-component input[type="date"]',
                '.cx-vui-component input[type="datetime-local"]',
                '.cx-vui-component input.persian-calendar-input',
                '.cx-control input[type="date"]',
                '.cx-control input[type="datetime-local"]',
                '.cx-control input.persian-calendar-input',
                'input.cx-vui-input[type="time"]',
                '.cx-vui-component input[type="time"]',
                '.cx-control input[type="time"]'
            ]);
        }

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
                isTime = $visibleInput.attr('type') === 'datetime-local' || $visibleInput.hasClass('datetime-field') || $visibleInput.data('persian-show-time');
                if ($visibleInput.attr('type') === 'date') {
                    isTime = false;
                }
            }
            if (window.PersianCalendarIntegrations) {
                window.PersianCalendarIntegrations.setupJalaliDatePicker($visibleInput, null, isTime, $);
            }
        });
    }

    $(function() {
        initJFBFrontendFields();

        $(document).on('elementor/popup/show', function(event, id, instance) {
            if (instance && instance.$element) {
                initJFBFrontendFields(instance.$element);
            } else {
                initJFBFrontendFields();
            }
        });

        $(document).on('jet-popup/show-event', function(event, $popup) {
            initJFBFrontendFields($popup);
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
                                if ($node.find('input[type="date"], input[type="datetime-local"], input[type="time"], input.persian-calendar-input').length || 
                                    $node.is('input[type="date"], input[type="datetime-local"], input[type="time"], input.persian-calendar-input')) {
                                    needsInit = true;
                                    break;
                                }
                            }
                        }
                    }
                });
                if (needsInit) {
                    initJFBFrontendFields();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    });

})(jQuery);
