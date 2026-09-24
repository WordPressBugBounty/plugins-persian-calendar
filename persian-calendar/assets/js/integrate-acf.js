/**
 * Advanced Custom Fields (ACF) Integration for Persian Calendar
 *
 * Provides Persian/Jalali calendar UI for ACF Date Picker, Date Time Picker,
 * and Time Picker fields while ensuring Gregorian dates are strictly saved
 * in the database.
 *
 * @package PersianCalendar
 */
(function($) {
    'use strict';

    let originalDatepicker = null;
    let originalDatetimepicker = null;
    let originalTimepicker = null;

    /**
     * Check if an element belongs to an ACF Date/Time field container.
     * Excludes ACF repeater clone templates (.acf-clone).
     */
    function isACFElement($el) {
        if (!$el || !$el.length) return false;
        if ($el.closest('.acf-clone').length > 0) return false;
        return $el.closest('.acf-date-picker, .acf-date-time-picker, .acf-time-picker, .acf-field-date-picker, .acf-field-date-time-picker, .acf-field-time-picker, [data-type="date_picker"], [data-type="date_time_picker"], [data-type="time_picker"]').length > 0;
    }

    /**
     * Check if element represents an ACF Time Picker field.
     */
    function isACFTimeField($el, options) {
        if (!$el || !$el.length) return false;
        if ($el.closest('.acf-time-picker, .acf-field-time-picker, [data-type="time_picker"]').length > 0) {
            return true;
        }
        if ($el.hasClass('persian-time-input') || $el.data('persian-timepicker-init')) {
            return true;
        }
        if (options && typeof options === 'object') {
            if (options.timepickerOnly === true || options.timeOnly === true || options.datepicker === false || options.time_only === true) {
                return true;
            }
        }
        return false;
    }

    /**
     * Format a JS Date object into standard ACF Gregorian formats.
     *
     * @param {Date} date
     * @param {string} type 'date' (Ymd), 'datetime' (Y-m-d H:i:s), or 'time' (H:i:s)
     * @return {string}
     */
    function formatACFGregorian(date, type) {
        if (!date || isNaN(date.getTime())) return '';
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const mi = String(date.getMinutes()).padStart(2, '0');
        const ss = String(date.getSeconds()).padStart(2, '0');

        if (type === 'date') {
            // ACF date_picker internally stores Ymd (e.g. 20260907)
            return `${y}${m}${d}`;
        }
        if (type === 'datetime') {
            // ACF date_time_picker internally stores Y-m-d H:i:s
            return `${y}-${m}-${d} ${hh}:${mi}:${ss}`;
        }
        if (type === 'time') {
            // ACF time_picker internally stores H:i:s
            return `${hh}:${mi}:${ss}`;
        }
        return `${y}-${m}-${d}`;
    }

    /**
     * Initialize Jalali calendar on an ACF field wrapper or container.
     */
    /**
     * Destroy any existing jQuery UI datepicker/datetimepicker on an input
     * so the Gregorian calendar popup doesn't compete with the Jalali one.
     */
    function destroyGregorianPicker($input) {
        if (!$input || !$input.length) return;
        try {
            if ($input.hasClass('hasDatepicker') && originalDatepicker) {
                originalDatepicker.call($input, 'destroy');
            }
        } catch (e) { /* already destroyed or never initialised */ }
        try {
            if (originalDatetimepicker && $input.data('xdsoft_datetimepicker')) {
                originalDatetimepicker.call($input, 'destroy');
            }
        } catch (e) { /* noop */ }
        try {
            if (originalTimepicker && typeof originalTimepicker === 'function') {
                originalTimepicker.call($input, 'destroy');
            }
        } catch (e) { /* noop */ }
        // Remove leftover inline datepicker containers ACF may have appended
        $input.siblings('.ui-datepicker-inline, .xdsoft_datetimepicker').remove();
    }

    /**
     * Initialize Jalali calendar on an ACF field wrapper or container.
     */
    function initACFField($fieldWrap) {
        if (!$fieldWrap || !$fieldWrap.length) return;
        if (typeof window.PersianCalendarIntegrations === 'undefined') return;

        // 1. Process Date Picker (Ymd in hidden input)
        $fieldWrap.find('.acf-date-picker, .acf-field-date-picker, [data-type="date_picker"]').addBack('.acf-date-picker, .acf-field-date-picker, [data-type="date_picker"]').each(function() {
            const $wrap = $(this);
            if ($wrap.closest('.acf-clone').length > 0) return;
            if (isACFTimeField($wrap) || $wrap.closest('.acf-time-picker, .acf-field-time-picker, [data-type="time_picker"]').length > 0) return;
            if ($wrap.closest('.acf-date-time-picker, .acf-field-date-time-picker, [data-type="date_time_picker"]').length > 0 && !$wrap.hasClass('acf-date-picker')) return;

            const $visibleInput = $wrap.find('input[type="text"].input, input[type="text"]').not('[type="hidden"]');
            const $altInput = $wrap.find('input[type="hidden"]');

            if (!$visibleInput.length || isACFTimeField($visibleInput)) return;

            // Handle ACF 6.8+ "Default to current date"
            if (1 === $visibleInput.data('default-to-today') && $altInput.length && !$altInput.val()) {
                const today = new Date();
                $altInput.val(formatACFGregorian(today, 'date'));
            }

            // Bind hidden input formatter to guarantee pure Ymd format (no dashes)
            if ($altInput.length && !$altInput.data('persca-acf-bound')) {
                $altInput.data('persca-acf-bound', true);
                $altInput.on('input change', function() {
                    const val = $(this).val();
                    if (val && /^\d{4}-\d{2}-\d{2}/.test(val)) {
                        const clean = val.replace(/-/g, '').substring(0, 8);
                        if ($(this).val() !== clean) {
                            $(this).val(clean);
                        }
                    }
                });
            }

            // Kill the Gregorian datepicker before attaching Jalali
            destroyGregorianPicker($visibleInput);

            window.PersianCalendarIntegrations.setupJalaliDatePicker($visibleInput, $altInput.length ? $altInput : null, false, $);

            // Sync hidden input to pure Gregorian Ymd (8 digits)
            if ($altInput.length && /^\d{4}-\d{2}-\d{2}/.test($altInput.val())) {
                $altInput.val($altInput.val().replace(/-/g, '').substring(0, 8));
            }
        });

        // 2. Process Date Time Picker (Y-m-d H:i:s in hidden input)
        $fieldWrap.find('.acf-date-time-picker, .acf-field-date-time-picker, [data-type="date_time_picker"]').addBack('.acf-date-time-picker, .acf-field-date-time-picker, [data-type="date_time_picker"]').each(function() {
            const $wrap = $(this);
            if ($wrap.closest('.acf-clone').length > 0) return;
            if (isACFTimeField($wrap) || $wrap.closest('.acf-time-picker, .acf-field-time-picker, [data-type="time_picker"]').length > 0) return;

            const $visibleInput = $wrap.find('input[type="text"].input, input[type="text"]').not('[type="hidden"]');
            const $altInput = $wrap.find('input[type="hidden"].input-alt, input[type="hidden"]');

            if (!$visibleInput.length || isACFTimeField($visibleInput)) return;

            // Handle ACF 6.8+ "Default to current date"
            if (1 === $visibleInput.data('default-to-today') && $altInput.length && !$altInput.val()) {
                const today = new Date();
                $altInput.val(formatACFGregorian(today, 'datetime'));
            }

            // Kill the Gregorian datetimepicker before attaching Jalali
            destroyGregorianPicker($visibleInput);

            window.PersianCalendarIntegrations.setupJalaliDatePicker($visibleInput, $altInput.length ? $altInput : null, true, $);
        });

        // 3. Process Time Picker (H:i:s in hidden input)
        $fieldWrap.find('.acf-time-picker, .acf-field-time-picker, [data-type="time_picker"]').addBack('.acf-time-picker, .acf-field-time-picker, [data-type="time_picker"]').each(function() {
            const $wrap = $(this);
            if ($wrap.closest('.acf-clone').length > 0) return;

            const $visibleInput = $wrap.find('input[type="text"].input, input[type="text"]').not('[type="hidden"]');
            const $altInput = $wrap.find('input[type="hidden"].input-alt, input[type="hidden"]');

            if (!$visibleInput.length) return;

            // Kill any Gregorian picker before attaching Jalali time picker
            destroyGregorianPicker($visibleInput);

            if (window.PersianCalendarIntegrations.setupJalaliTimePicker) {
                window.PersianCalendarIntegrations.setupJalaliTimePicker($visibleInput, $altInput.length ? $altInput : null, $);
            }
        });
    }

    /**
     * Intercept jQuery UI datepicker/datetimepicker calls for ACF elements.
     * Wrapped in a function so it can be retried on DOM ready if jQuery UI
     * was not yet loaded when our script first executed.
     */
    function interceptPickers() {
        // --- datepicker ---
        if (!$.fn.datepicker || !$.fn.datepicker._perscaIntercepted) {
            originalDatepicker = $.fn.datepicker || null;
            $.fn.datepicker = function(options) {
                const args = Array.prototype.slice.call(arguments);

                if (typeof options === 'string') {
                    if (options === 'setDate') {
                        const dateVal = args[1];
                        let handled = false;
                        this.each(function() {
                            const $el = $(this);
                            if ($el.data('persian-calendar-init')) {
                                if (window.PersianCalendarIntegrations && window.PersianCalendarIntegrations.updateDisplayVal) {
                                    window.PersianCalendarIntegrations.updateDisplayVal($el, dateVal);
                                }
                                handled = true;
                            }
                        });
                        if (handled) return this;
                    } else if (options === 'getDate') {
                        const $el = this.first();
                        if ($el.length && $el.data('persian-calendar-init')) {
                            const val = $el.data('persian-gregorian-val') || $el.next('input[type="hidden"]').val() || $el.val();
                            if (window.PersianCalendarIntegrations && window.PersianCalendarIntegrations.parseLocalDate) {
                                return window.PersianCalendarIntegrations.parseLocalDate(val);
                            }
                        }
                    }
                    // For any other string methods (e.g. 'option', 'destroy'), delegate to original datepicker
                    if (originalDatepicker) {
                        return originalDatepicker.apply(this, args);
                    }
                    return this;
                }

                return this.each(function() {
                    const $visibleInput = $(this);
                    if (isACFElement($visibleInput)) {
                        const $wrap = $visibleInput.closest('.acf-date-picker, .acf-date-time-picker, .acf-time-picker, .acf-field-date-picker, .acf-field-date-time-picker, .acf-field-time-picker, [data-type="date_picker"], [data-type="date_time_picker"], [data-type="time_picker"]');
                        if (isACFTimeField($visibleInput, options)) {
                            const $altInput = ($wrap.length) ? $wrap.find('input[type="hidden"]') : ((options && options.altField) ? $(options.altField) : null);
                            destroyGregorianPicker($visibleInput);
                            if (window.PersianCalendarIntegrations && window.PersianCalendarIntegrations.setupJalaliTimePicker) {
                                window.PersianCalendarIntegrations.setupJalaliTimePicker($visibleInput, $altInput, $);
                            }
                            return;
                        }

                        const isTime = $wrap.hasClass('acf-date-time-picker') || $wrap.hasClass('acf-field-date-time-picker') || $wrap.attr('data-type') === 'date_time_picker';
                        const $altInput = ($wrap.length) ? $wrap.find('input[type="hidden"]') : ((options && options.altField) ? $(options.altField) : null);

                        destroyGregorianPicker($visibleInput);
                        if (window.PersianCalendarIntegrations) {
                            window.PersianCalendarIntegrations.setupJalaliDatePicker($visibleInput, $altInput, isTime, $);
                            // Ensure ACF date_picker hidden input keeps Ymd
                            if (!isTime && $altInput && /^\d{4}-\d{2}-\d{2}/.test($altInput.val())) {
                                $altInput.val($altInput.val().replace(/-/g, '').substring(0, 8));
                            }
                        }
                    } else if (originalDatepicker) {
                        originalDatepicker.apply($visibleInput, args);
                    }
                });
            };
            $.fn.datepicker._perscaIntercepted = true;
            $.extend($.fn.datepicker, originalDatepicker);
        }

        // --- datetimepicker ---
        if (!$.fn.datetimepicker || !$.fn.datetimepicker._perscaIntercepted) {
            originalDatetimepicker = $.fn.datetimepicker || null;
            $.fn.datetimepicker = function(options) {
                const args = Array.prototype.slice.call(arguments);

                if (typeof options === 'string') {
                    if (originalDatetimepicker) {
                        return originalDatetimepicker.apply(this, args);
                    }
                    return this;
                }

                return this.each(function() {
                    const $visibleInput = $(this);
                    if (isACFElement($visibleInput)) {
                        const $wrap = $visibleInput.closest('.acf-date-picker, .acf-date-time-picker, .acf-time-picker, .acf-field-date-picker, .acf-field-date-time-picker, .acf-field-time-picker, [data-type="date_picker"], [data-type="date_time_picker"], [data-type="time_picker"]');
                        if (isACFTimeField($visibleInput, options)) {
                            const $altInput = ($wrap.length) ? $wrap.find('input[type="hidden"]') : ((options && options.altField) ? $(options.altField) : null);
                            destroyGregorianPicker($visibleInput);
                            if (window.PersianCalendarIntegrations && window.PersianCalendarIntegrations.setupJalaliTimePicker) {
                                window.PersianCalendarIntegrations.setupJalaliTimePicker($visibleInput, $altInput, $);
                            }
                            return;
                        }

                        const $altInput = ($wrap.length) ? $wrap.find('input[type="hidden"]') : ((options && options.altField) ? $(options.altField) : null);
                        destroyGregorianPicker($visibleInput);
                        if (window.PersianCalendarIntegrations) {
                            window.PersianCalendarIntegrations.setupJalaliDatePicker($visibleInput, $altInput, true, $);
                        }
                    } else if (originalDatetimepicker) {
                        originalDatetimepicker.apply($visibleInput, args);
                    }
                });
            };
            $.fn.datetimepicker._perscaIntercepted = true;
            $.extend($.fn.datetimepicker, originalDatetimepicker);
        }

        // --- timepicker ---
        if (!$.fn.timepicker || !$.fn.timepicker._perscaIntercepted) {
            originalTimepicker = $.fn.timepicker || null;
            $.fn.timepicker = function(options) {
                const args = Array.prototype.slice.call(arguments);

                if (typeof options === 'string') {
                    if (originalTimepicker) {
                        return originalTimepicker.apply(this, args);
                    }
                    return this;
                }

                return this.each(function() {
                    const $visibleInput = $(this);
                    if (isACFElement($visibleInput)) {
                        const $wrap = $visibleInput.closest('.acf-date-picker, .acf-date-time-picker, .acf-time-picker, .acf-field-date-picker, .acf-field-date-time-picker, .acf-field-time-picker, [data-type="date_picker"], [data-type="date_time_picker"], [data-type="time_picker"]');
                        const $altInput = ($wrap.length) ? $wrap.find('input[type="hidden"]') : ((options && options.altField) ? $(options.altField) : null);
                        destroyGregorianPicker($visibleInput);
                        if (window.PersianCalendarIntegrations && window.PersianCalendarIntegrations.setupJalaliTimePicker) {
                            window.PersianCalendarIntegrations.setupJalaliTimePicker($visibleInput, $altInput, $);
                        }
                    } else if (originalTimepicker) {
                        originalTimepicker.apply($visibleInput, args);
                    }
                });
            };
            $.fn.timepicker._perscaIntercepted = true;
            if (originalTimepicker) {
                $.extend($.fn.timepicker, originalTimepicker);
            }
        }
    }

    // Try intercepting immediately (works if jquery-ui-datepicker loaded before us)
    interceptPickers();

    /**
     * Register ACF JS Hooks if window.acf is loaded
     */
    function registerACFHooks() {
        if (typeof window.acf === 'undefined') return;

        const fieldTypes = ['date_picker', 'date_time_picker', 'time_picker'];
        const actions = ['ready_field', 'append_field', 'new_field'];

        actions.forEach(function(action) {
            fieldTypes.forEach(function(type) {
                window.acf.addAction(action + '/type=' + type, function(field) {
                    if (field && field.$el) {
                        initACFField(field.$el);
                    }
                });
            });
        });

        // Global ACF append & remount hooks (ACF Pro repeaters, flexible content, blocks)
        window.acf.addAction('append', function($el) {
            initACFField($el);
        });
        window.acf.addAction('remount', function($el) {
            initACFField($el);
        });

        // Native ACF datepicker init actions
        window.acf.addAction('date_picker_init', function($input, args, field) {
            initACFField(field ? field.$el : $input.closest('.acf-date-picker, .acf-field-date-picker, [data-type="date_picker"]'));
        });
        window.acf.addAction('date_time_picker_init', function($input, args, field) {
            initACFField(field ? field.$el : $input.closest('.acf-date-time-picker, .acf-field-date-time-picker, [data-type="date_time_picker"]'));
        });
        window.acf.addAction('time_picker_init', function($input, args, field) {
            initACFField(field ? field.$el : $input.closest('.acf-time-picker, .acf-field-time-picker, [data-type="time_picker"]'));
        });
    }

    /**
     * DOM Ready Initialization
     */
    $(function() {
        // Retry interception in case jQuery UI loaded after our script
        interceptPickers();

        initACFField($(document));
        registerACFHooks();

        // Fallback MutationObserver for dynamically inserted ACF fields (popups, AJAX modals)
        if (typeof MutationObserver !== 'undefined') {
            const observer = new MutationObserver(function(mutations) {
                let needsInit = false;
                mutations.forEach(function(mutation) {
                    if (mutation.addedNodes && mutation.addedNodes.length) {
                        for (let i = 0; i < mutation.addedNodes.length; i++) {
                            const node = mutation.addedNodes[i];
                            if (node.nodeType === 1) {
                                const $node = $(node);
                                if ($node.find('.acf-date-picker, .acf-date-time-picker, .acf-time-picker').length ||
                                    $node.is('.acf-date-picker, .acf-date-time-picker, .acf-time-picker')) {
                                    needsInit = true;
                                    break;
                                }
                            }
                        }
                    }
                });
                if (needsInit) {
                    initACFField($(document));
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    });

})(jQuery);
