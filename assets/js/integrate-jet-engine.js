(function($) {
    'use strict';

    var originalDatepicker = null;
    var originalDatetimepicker = null;

    // Check if an element belongs to JetEngine context
    function isJetEngineElement($el) {
        return $el.closest(
            '.jet-engine-meta-boxes, .cx-vui-component, .cx-control,' +
            '.jet-form, .jet-form-builder,' +
            '.field-type-date, .field-type-datetime-local,' +
            '[data-field]'
        ).length > 0;
    }

    // Custom Datepicker Wrapper — only intercepts JetEngine elements
    var customDatepicker = function(options) {
        var args = Array.prototype.slice.call(arguments);

        // For string method calls, check if this is an initialized JetEngine field
        if (typeof options === 'string') {
            var method = options;
            if (method === 'setDate') {
                var dateVal = args[1];
                // Only intercept setDate for fields we initialized
                var self = this;
                var handled = false;
                this.each(function() {
                    var $el = $(this);
                    if ($el.data('persian-calendar-init')) {
                        updateDisplayVal($el, dateVal);
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
            var $visibleInput = $(this);
            if (isJetEngineElement($visibleInput)) {
                var $altInput = (options && options.altField) ? $(options.altField) : null;
                setupJalaliDatePicker($visibleInput, $altInput, false, options);
            } else if (originalDatepicker) {
                originalDatepicker.call($visibleInput, options);
            }
        });
    };

    // Custom Datetimepicker Wrapper — only intercepts JetEngine elements
    var customDatetimepicker = function(options) {
        var args = Array.prototype.slice.call(arguments);

        if (typeof options === 'string') {
            var method = options;
            if (method === 'setDate') {
                var dateVal = args[1];
                var self = this;
                var handled = false;
                this.each(function() {
                    var $el = $(this);
                    if ($el.data('persian-calendar-init')) {
                        updateDisplayVal($el, dateVal);
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
            var $visibleInput = $(this);
            if (isJetEngineElement($visibleInput)) {
                var $altInput = (options && options.altField) ? $(options.altField) : null;
                setupJalaliDatePicker($visibleInput, $altInput, true, options);
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

    function toPersianDigits(str) {
        if (str === null || str === undefined) return '';
        return String(str);
    }

    function parseLocalDate(dateStr) {
        if (!dateStr) return null;
        if (dateStr instanceof Date) return dateStr;
        
        // Match YYYY-MM-DD or YYYY-MM-DDTHH:mm or YYYY-MM-DD HH:mm
        var parts = dateStr.split(/[-T :]/);
        if (parts.length >= 3) {
            var y = parseInt(parts[0], 10);
            var m = parseInt(parts[1], 10) - 1; // Months are 0-based
            var d = parseInt(parts[2], 10);
            var hh = parts.length > 3 ? parseInt(parts[3], 10) : 0;
            var mi = parts.length > 4 ? parseInt(parts[4], 10) : 0;
            var ss = parts.length > 5 ? parseInt(parts[5], 10) : 0;
            return new Date(y, m, d, hh, mi, ss);
        }
        
        var d = new Date(dateStr);
        return isNaN(d.getTime()) ? null : d;
    }

    function updateDisplayVal($visibleInput, dateVal) {
        if (!dateVal) return;
        var d = parseLocalDate(dateVal);
        if (!d) return;

        if (window.PersianDateConverter) {
            var showTime = $visibleInput.data('persian-show-time') || false;
            var jalali = window.PersianDateConverter.gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
            
            var jYear = jalali[0];
            var jMonth = String(jalali[1]).padStart(2, '0');
            var jDay = String(jalali[2]).padStart(2, '0');

            var displayVal = jYear + '/' + jMonth + '/' + jDay;
            if (showTime) {
                var hh = String(d.getHours()).padStart(2, '0');
                var mi = String(d.getMinutes()).padStart(2, '0');
                displayVal += ' ' + hh + ':' + mi;
            }

            var finalDisplayVal = toPersianDigits(displayVal);
            $visibleInput.val(finalDisplayVal);
        }
    }

    function setupJalaliDatePicker($visibleInput, $altInput, showTime, options) {
        if (typeof PersianCalendar === 'undefined') {
            if (showTime && originalDatetimepicker) {
                originalDatetimepicker.call($visibleInput, options);
            } else if (originalDatepicker) {
                originalDatepicker.call($visibleInput, options);
            }
            return;
        }

        if ($visibleInput.data('persian-calendar-init')) {
            return;
        }
        $visibleInput.data('persian-calendar-init', true);
        $visibleInput.data('persian-show-time', showTime);

        // Change type to text to prevent native browser datepicker and allow Jalali text display
        var inputType = $visibleInput.attr('type');
        if (inputType === 'date' || inputType === 'datetime-local') {
            try {
                $visibleInput[0].type = 'text';
            } catch (e) {
                $visibleInput.attr('type', 'text');
            }
        }

        // If there's no altInput, create one to hold the Gregorian date so that JetEngine can save it
        var originalVal = $visibleInput.val();
        if (!$altInput) {
            var nameAttr = $visibleInput.attr('name');
            if (nameAttr) {
                $altInput = $('<input type="hidden">').attr('name', nameAttr).val(originalVal);
                $visibleInput.removeAttr('name');
                $visibleInput.after($altInput);
            }
        }

        // Make the visible input read-only so they use the popup picker
        $visibleInput.attr('readonly', 'readonly');
        $visibleInput.css({ cursor: 'pointer' });
        $visibleInput.addClass('persian-calendar-input');

        // Initial display update
        if ($altInput && $altInput.val()) {
            updateDisplayVal($visibleInput, $altInput.val());
        } else if ($visibleInput.val()) {
            updateDisplayVal($visibleInput, $visibleInput.val());
        }

        // Create or reuse the popup container
        var $popup = $visibleInput.data('persian-popup');
        if (!$popup) {
            $popup = $('<div class="persian-calendar-popup" style="display:none; position:absolute; z-index:999999; background:#fff; box-shadow:0 4px 20px rgba(0,0,0,0.15); border:1px solid #edf2f7; border-radius:8px; padding:15px; width:280px;"></div>');
            $('body').append($popup);
            $visibleInput.data('persian-popup', $popup);
        }

        // Close when clicking the close button inside the calendar
        $popup.on('click', '.persian-calendar-close-btn', function(e) {
            e.stopPropagation();
            $popup.hide();
        });

        // Function to dynamically update the calendar position relative to the input
        function positionPopup() {
            if (!$popup.is(':visible')) return;

            var offset = $visibleInput.offset();
            var inputHeight = $visibleInput.outerHeight();
            var popupHeight = $popup.outerHeight();
            var popupWidth = $popup.outerWidth();

            var windowHeight = $(window).height();
            var windowWidth = $(window).width();
            var scrollTop = $(window).scrollTop();
            var scrollLeft = $(window).scrollLeft();

            var top = offset.top + inputHeight + 5;
            var left = offset.left;

            // Vertical position (check bottom overflow)
            if (top + popupHeight > scrollTop + windowHeight) {
                // If there's enough space above the input, show above
                if (offset.top - popupHeight - 5 > scrollTop) {
                    top = offset.top - popupHeight - 5;
                }
            }

            // Horizontal position (check right overflow)
            if (left + popupWidth > scrollLeft + windowWidth) {
                left = scrollLeft + windowWidth - popupWidth - 15;
            }
            if (left < scrollLeft) {
                left = scrollLeft + 15;
            }

            $popup.css({
                top: top + 'px',
                left: left + 'px'
            });
        }

        $visibleInput.on('click focus', function(e) {
            e.stopPropagation();

            // Hide other popups
            $('.persian-calendar-popup').not($popup).hide();

            // If already visible, just update position and return
            if ($popup.is(':visible')) {
                positionPopup();
                return;
            }

            // Determine initial date
            var currentVal = $altInput ? $altInput.val() : $visibleInput.val();
            var parsedDate = new Date();
            if (currentVal) {
                var d = parseLocalDate(currentVal);
                if (d) {
                    parsedDate = d;
                }
            }

            // Render calendar first
            $popup.empty();
            var container = document.createElement('div');
            $popup.append(container);

            new PersianCalendar(container, {
                selectedDate: parsedDate,
                showTime: showTime,
                usePersianDigits: false,
                onDateSelect: function(dateInfo) {
                    var selectedDate = dateInfo.date;
                    var y = selectedDate.getFullYear();
                    var m = String(selectedDate.getMonth() + 1).padStart(2, '0');
                    var d = String(selectedDate.getDate()).padStart(2, '0');
                    var hh = String(dateInfo.time.hour).padStart(2, '0');
                    var mi = String(dateInfo.time.minute).padStart(2, '0');

                    // Database value format
                    var rawVal = y + '-' + m + '-' + d;
                    if (showTime) {
                        rawVal += 'T' + hh + ':' + mi;
                    }

                    // Display format (Jalali)
                    var jYear = dateInfo.jalali.year;
                    var jMonth = String(dateInfo.jalali.month).padStart(2, '0');
                    var jDay = String(dateInfo.jalali.day).padStart(2, '0');

                    var displayVal = jYear + '/' + jMonth + '/' + jDay;
                    if (showTime) {
                        displayVal += ' ' + hh + ':' + mi;
                    }

                    // Set values
                    if ($altInput) {
                        $altInput.val(rawVal).trigger('change');
                    } else {
                        $visibleInput.val(rawVal).trigger('change');
                    }

                    var finalDisplayVal = toPersianDigits(displayVal);
                    $visibleInput.val(finalDisplayVal);

                    if (!showTime) {
                        $popup.hide();
                    }
                }
            });

            // Customize title to 'انتخاب تاریخ' instead of 'انتشار'
            $popup.find('.persian-calendar-title').text('انتخاب تاریخ');

            // Show temporary to measure dimensions
            $popup.css({
                display: 'block',
                visibility: 'hidden',
                top: 0,
                left: 0
            });

            // Make visible and position
            $popup.css({
                visibility: 'visible'
            });
            positionPopup();
        });

        var eventNamespace = '.persianCalendarPopup_' + Math.random().toString(36).substr(2, 9);

        // Reposition on window resize
        $(window).on('resize' + eventNamespace, function() {
            positionPopup();
        });

        // Listen to scroll events on any scrollable container (capture phase) to reposition the popup
        var scrollHandler = function() {
            if ($popup.is(':visible')) {
                positionPopup();
            }
        };
        window.addEventListener('scroll', scrollHandler, true);
        $visibleInput.data('persian-scroll-handler', scrollHandler);

        // Close on clicking outside
        $(document).on('click' + eventNamespace, function(e) {
            if (!$(e.target).closest($popup).length && !$(e.target).closest($visibleInput).length) {
                $popup.hide();
            }
        });

        // Cleanup when input is removed from DOM (e.g. AJAX reload)
        if (typeof MutationObserver !== 'undefined') {
            var parentNode = $visibleInput.parent()[0];
            if (parentNode) {
                var observer = new MutationObserver(function(mutations) {
                    if (!document.contains($visibleInput[0])) {
                        $popup.remove();
                        $(window).off(eventNamespace);
                        $(document).off(eventNamespace);
                        window.removeEventListener('scroll', scrollHandler, true);
                        observer.disconnect();
                    }
                });
                observer.observe(parentNode, { childList: true });
            }
        }
    }

    function initJetEngineFrontendFields() {
        var selectors = [
            'input.jet-form__field[type="date"]',
            'input.jet-form__field[type="datetime-local"]',
            'input.jet-form-builder__field[type="date"]',
            'input.jet-form-builder__field[type="datetime-local"]',
            '.jet-form input[type="date"]',
            '.jet-form input[type="datetime-local"]',
            '.jet-form-builder input[type="date"]',
            '.jet-form-builder input[type="datetime-local"]'
        ];

        $(selectors.join(', ')).each(function() {
            var $visibleInput = $(this);
            var isTime = $visibleInput.attr('type') === 'datetime-local' || $visibleInput.hasClass('datetime-field');
            setupJalaliDatePicker($visibleInput, null, isTime, {});
        });
    }

    // Auto-initialize on document ready and monitor DOM for dynamic fields
    $(function() {
        initJetEngineFrontendFields();

        if (typeof MutationObserver !== 'undefined') {
            var observer = new MutationObserver(function(mutations) {
                var needsInit = false;
                mutations.forEach(function(mutation) {
                    if (mutation.addedNodes && mutation.addedNodes.length) {
                        for (var i = 0; i < mutation.addedNodes.length; i++) {
                            var node = mutation.addedNodes[i];
                            if (node.nodeType === 1) {
                                if ($(node).find('input[type="date"], input[type="datetime-local"]').length || 
                                    $(node).is('input[type="date"], input[type="datetime-local"]')) {
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
