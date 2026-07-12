(function($) {
    'use strict';

    // Override native value getter/setter to return Gregorian value for scripts
    // while keeping Jalali display in the browser.
    function overrideNativeValue(el) {
        if (!el) return;
        var descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        Object.defineProperty(el, 'value', {
            get: function() {
                var gregVal = $(this).data('persian-gregorian-val');
                return (gregVal !== undefined && gregVal !== null) ? gregVal : descriptor.get.call(this);
            },
            set: function(val) {
                var valStr = String(val);
                if (/^\d{4}-\d{2}-\d{2}/.test(valStr)) {
                    $(this).data('persian-gregorian-val', valStr);
                    updateDisplayVal($(this), valStr);
                } else {
                    if (!val) {
                        $(this).data('persian-gregorian-val', '');
                    }
                    descriptor.set.call(this, val);
                }
            },
            configurable: true,
            enumerable: true
        });
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

        var showTime = $visibleInput.data('persian-show-time') || false;

        // Sync back the Gregorian value
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        var rawVal = y + '-' + m + '-' + day;
        if (showTime) {
            var hh = String(d.getHours()).padStart(2, '0');
            var mi = String(d.getMinutes()).padStart(2, '0');
            rawVal += 'T' + hh + ':' + mi;
        }
        $visibleInput.data('persian-gregorian-val', rawVal);

        if (window.PersianDateConverter) {
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

    function setupJalaliDatePicker($visibleInput, $altInput, showTime) {
        if (typeof PersianCalendar === 'undefined') {
            return;
        }

        if ($visibleInput.data('persian-calendar-init')) {
            return;
        }
        $visibleInput.data('persian-calendar-init', true);
        $visibleInput.data('persian-show-time', showTime);

        // Read min/max attributes if present
        var minAttr = $visibleInput.attr('min');
        var maxAttr = $visibleInput.attr('max');
        var minDate = null;
        var maxDate = null;

        if (minAttr) {
            if (minAttr === 'today' || minAttr === 'current' || minAttr === 'now') {
                minDate = 'today';
            } else {
                minDate = parseLocalDate(minAttr);
            }
        }
        if (maxAttr) {
            if (maxAttr === 'today' || maxAttr === 'current' || maxAttr === 'now') {
                maxDate = 'today';
            } else {
                maxDate = parseLocalDate(maxAttr);
            }
        }
        $visibleInput.data('persian-min-date', minDate);
        $visibleInput.data('persian-max-date', maxDate);

        // Change type to text to prevent native browser datepicker and allow Jalali text display
        var inputType = $visibleInput.attr('type');
        if (inputType === 'date' || inputType === 'datetime-local') {
            try {
                $visibleInput[0].type = 'text';
            } catch (e) {
                $visibleInput.attr('type', 'text');
            }
        }

        // If there's no altInput, create one to hold the Gregorian date so that JetFormBuilder can save/validate it
        var originalVal = $visibleInput.val();
        if (!$altInput) {
            var nameAttr = $visibleInput.attr('name');
            if (nameAttr) {
                $altInput = $('<input type="hidden">').attr('name', nameAttr).val(originalVal);
                $visibleInput.removeAttr('name');
                $visibleInput.after($altInput);
            }
        }

        $visibleInput.attr('readonly', 'readonly');
        $visibleInput.css({ cursor: 'pointer' });
        $visibleInput.addClass('persian-calendar-input');
        overrideNativeValue($visibleInput[0]);

        // Initial display update
        var initialVal = $altInput ? $altInput.val() : $visibleInput.val();
        if (initialVal) {
            if (/^\d{4}-\d{2}-\d{2}/.test(initialVal)) {
                $visibleInput.data('persian-gregorian-val', initialVal);
            }
            updateDisplayVal($visibleInput, initialVal);
        }

        // Create popup container
        var $popup = $('<div class="persian-calendar-popup" style="display:none; position:absolute; z-index:999999; background:#fff; box-shadow:0 4px 20px rgba(0,0,0,0.15); border:1px solid #edf2f7; border-radius:8px; padding:15px; width:280px;"></div>');
        $('body').append($popup);
        $visibleInput.data('persian-popup', $popup);

        $popup.on('click', '.persian-calendar-close-btn', function(e) {
            e.stopPropagation();
            $popup.hide();
        });

        // Close when clicking the "Now" button
        $popup.on('click', '.persian-calendar-now-btn', function(e) {
            $popup.hide();
        });

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

            if (top + popupHeight > scrollTop + windowHeight) {
                if (offset.top - popupHeight - 5 > scrollTop) {
                    top = offset.top - popupHeight - 5;
                }
            }

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
            $('.persian-calendar-popup').not($popup).hide();

            if ($popup.is(':visible')) {
                positionPopup();
                return;
            }

            var currentVal = $altInput ? $altInput.val() : $visibleInput.val();
            var parsedDate = new Date();
            if (currentVal) {
                var d = parseLocalDate(currentVal);
                if (d) {
                    parsedDate = d;
                }
            }

            $popup.empty();
            var container = document.createElement('div');
            $popup.append(container);

            new PersianCalendar(container, {
                selectedDate: parsedDate,
                showTime: showTime,
                usePersianDigits: false,
                minDate: $visibleInput.data('persian-min-date'),
                maxDate: $visibleInput.data('persian-max-date'),
                onDateSelect: function(dateInfo) {
                    var selectedDate = dateInfo.date;
                    var y = selectedDate.getFullYear();
                    var m = String(selectedDate.getMonth() + 1).padStart(2, '0');
                    var d = String(selectedDate.getDate()).padStart(2, '0');
                    var hh = String(dateInfo.time.hour).padStart(2, '0');
                    var mi = String(dateInfo.time.minute).padStart(2, '0');

                    var rawVal = y + '-' + m + '-' + d;
                    if (showTime) {
                        rawVal += 'T' + hh + ':' + mi;
                    }

                    var jYear = dateInfo.jalali.year;
                    var jMonth = String(dateInfo.jalali.month).padStart(2, '0');
                    var jDay = String(dateInfo.jalali.day).padStart(2, '0');

                    var displayVal = jYear + '/' + jMonth + '/' + jDay;
                    if (showTime) {
                        displayVal += ' ' + hh + ':' + mi;
                    }

                    // Set values
                    $visibleInput.data('persian-gregorian-val', rawVal);
                    if ($altInput) {
                        $altInput.val(rawVal);
                        if ($altInput[0]) {
                            $altInput[0].dispatchEvent(new Event('input', { bubbles: true }));
                            $altInput[0].dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }
                    $visibleInput.val(rawVal);
                    if ($visibleInput[0]) {
                        $visibleInput[0].dispatchEvent(new Event('input', { bubbles: true }));
                        $visibleInput[0].dispatchEvent(new Event('change', { bubbles: true }));
                    }

                    if (!showTime) {
                        $popup.hide();
                    }
                }
            });

            $popup.find('.persian-calendar-title').text('انتخاب تاریخ');

            $popup.css({
                display: 'block',
                visibility: 'hidden',
                top: 0,
                left: 0
            });

            $popup.css({
                visibility: 'visible'
            });
            positionPopup();
        });

        var eventNamespace = '.persianCalendarPopup_' + Math.random().toString(36).substr(2, 9);

        $(window).on('resize' + eventNamespace, function() {
            positionPopup();
        });

        var scrollHandler = function() {
            if ($popup.is(':visible')) {
                positionPopup();
            }
        };
        window.addEventListener('scroll', scrollHandler, true);
        $visibleInput.data('persian-scroll-handler', scrollHandler);

        $(document).on('click' + eventNamespace, function(e) {
            if (!$(e.target).closest($popup).length && !$(e.target).closest($visibleInput).length) {
                $popup.hide();
            }
        });

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

    function initJFBFrontendFields() {
        var isJetEngineAdminPage = false;
        if (typeof window !== 'undefined' && window.location) {
            var search = window.location.search || '';
            var pathname = window.location.pathname || '';
            if (search.indexOf('page=jet-engine') !== -1 || 
                pathname.indexOf('post.php') !== -1 || 
                pathname.indexOf('post-new.php') !== -1) {
                isJetEngineAdminPage = true;
            }
        }

        var selectors = [
            'input.jet-form-builder__field[type="date"]',
            'input.jet-form-builder__field[type="datetime-local"]',
            '.jet-form-builder input[type="date"]',
            '.jet-form-builder input[type="datetime-local"]'
        ];

        if (!isJetEngineAdminPage) {
            selectors = selectors.concat([
                'input.cx-vui-input[type="date"]',
                'input.cx-vui-input[type="datetime-local"]',
                '.cx-vui-component input[type="date"]',
                '.cx-vui-component input[type="datetime-local"]',
                '.cx-control input[type="date"]',
                '.cx-control input[type="datetime-local"]'
            ]);
        }

        $(selectors.join(', ')).each(function() {
            var $visibleInput = $(this);
            var isTime = $visibleInput.attr('type') === 'datetime-local' || $visibleInput.hasClass('datetime-field');
            setupJalaliDatePicker($visibleInput, null, isTime);
        });
    }

    $(function() {
        initJFBFrontendFields();

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
                    initJFBFrontendFields();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    });

})(jQuery);
