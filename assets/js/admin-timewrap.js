jQuery(document).ready(function () {

    // Input validation and safe parsing functions
    function safeParseInt(value, defaultValue = 0, min = null, max = null) {
        const parsed = parseInt(value, 10);
        if (isNaN(parsed)) {
            return defaultValue;
        }
        if (min !== null && parsed < min) {
            return min;
        }
        if (max !== null && parsed > max) {
            return max;
        }
        return parsed;
    }

    function gregorian_to_jalali(gy, gm, gd) {
        gy = safeParseInt(gy, 1400, 1, 3000);
        gm = safeParseInt(gm, 1, 1, 12);
        gd = safeParseInt(gd, 1, 1, 31);

        if (!window.PersianDateConverter || !window.PersianDateConverter.isValidGregorian(gy, gm, gd)) {
            return ['1400', '01', '01'];
        }

        // Use shared converter from persian-calendar.js
        const [jy, jm, jd] = window.PersianDateConverter.gregorianToJalali(gy, gm, gd);
        return [String(jy), window.PersianDateConverter.padZero(jm), String(jd)];
    }

    function jalali_to_gregorian(jy, jm, jd) {
        jy = safeParseInt(jy, 1400, 1, 3000);
        jm = safeParseInt(jm, 1, 1, 12);
        jd = safeParseInt(jd, 1, 1, 31);

        if (!window.PersianDateConverter || !window.PersianDateConverter.isValidJalali(jy, jm, jd)) {
            return ['2021', '01', '01'];
        }

        // Use shared converter from persian-calendar.js
        const [gy, gm, gd_r] = window.PersianDateConverter.jalaliToGregorian(jy, jm, jd);
        return [String(gy), window.PersianDateConverter.padZero(gm), String(gd_r)];
    }

    /*
     * Edit inline
     */
    function jalaliTimestampDiv(year, mon, day, hour, minu) {
        // Validate and sanitize inputs
        year = safeParseInt(year, 1400, 1, 3000);
        mon = safeParseInt(mon, 1, 1, 12);
        day = safeParseInt(day, 1, 1, 31);
        hour = safeParseInt(hour, 0, 0, 23);
        minu = safeParseInt(minu, 0, 0, 59);

        let div = '<div class="timestamp-wrap jalali">' +
            '<label><input type="text" id="jja" name="jja" value="' + day + '" size="2" maxlength="2" autocomplete="off" /></label>' +
            '<label><select id="mma" name="mma">';
        for (let i = 1; i < 13; i++) {
            if (i == mon)
                div += '<option value="' + i + '" selected="selected">' + window.PersianDateConverter.PERSIAN_MONTHS[i - 1] + '</option>';
            else
                div += '<option value="' + i + '">' + window.PersianDateConverter.PERSIAN_MONTHS[i - 1] + '</option>';
        }
        div += '</select></label>' +

            '<label><input type="text" id="aaa" name="aaa" value="' + year + '" size="4" maxlength="4" autocomplete="off" /></label> در ' +
            '<input type="text" id="mna" name="mna" value="' + minu + '" size="2" maxlength="2" autocomplete="off" />:' +
            '<input type="text" id="hha" name="hha" value="' + hour + '" size="2" maxlength="2" autocomplete="off" />' +
            '</div>';
        return div;
    }

    jQuery('a.edit-timestamp').on('click', function () {
        jQuery('.jalali').remove();
        const date = gregorian_to_jalali(jQuery('#aa').val(), jQuery('#mm').val(), jQuery('#jj').val());
        jQuery('#timestampdiv').prepend(jalaliTimestampDiv(date[0], date[1], date[2], jQuery('#hh').val(), jQuery('#mn').val()));
        jQuery('#timestampdiv .timestamp-wrap:eq(1)').hide();
    });

    jQuery('#the-list').on('click', '.editinline', function () {
        const tr = jQuery(this).closest('td');
        const year = tr.find('.aa').text();
        if (year > 1700) {
            const month = tr.find('.mm').text();
            const day = tr.find('.jj').text();
            const hour = tr.find('.hh').text();
            const minu = tr.find('.mn').text();
            const date = gregorian_to_jalali(year, month, day);
            jQuery('.inline-edit-date .timestamp-wrap').hide();
            jQuery('.jalali').remove();
            jQuery('.inline-edit-date legend').after(jalaliTimestampDiv(date[0], date[1], date[2], hour, minu));
        }
    });

    jQuery('#timestampdiv,.inline-edit-date').on('keyup', '#hha', function () {
        const val = jQuery(this).val();
        if (val === '') return;
        const hour = safeParseInt(val, 0, 0, 23);
        if (jQuery(this).val() !== String(hour)) {
            jQuery(this).val(hour);
        }
        jQuery('input[name=hh]').val(hour);
    });

    jQuery('#timestampdiv,.inline-edit-date').on('blur', '#hha', function () {
        const hour = safeParseInt(jQuery(this).val(), 0, 0, 23);
        jQuery(this).val(hour);
        jQuery('input[name=hh]').val(hour);
    });

    jQuery('#timestampdiv,.inline-edit-date').on('keyup', '#mna', function () {
        const val = jQuery(this).val();
        if (val === '') return;
        const minute = safeParseInt(val, 0, 0, 59);
        jQuery('input[name=mn]').val(minute.toString().padStart(2, '0'));
    });

    // Apply padding only on blur (when user finishes typing)
    jQuery('#timestampdiv,.inline-edit-date').on('blur', '#mna', function () {
        const minute = safeParseInt(jQuery(this).val(), 0, 0, 59);
        jQuery(this).val(minute.toString().padStart(2, '0'));
    });

    jQuery('#timestampdiv,.inline-edit-date').on('keyup', '#aaa , #jja', function () {
        const valYear = jQuery('#aaa').val();
        const valDay = jQuery('#jja').val();

        // Allow user to clear fields while typing
        if (valYear === '' || valDay === '') return;

        const year = safeParseInt(valYear, 1400, 1, 3000);
        const day = safeParseInt(valDay, 1, 1, 31);
        const month = safeParseInt(jQuery('#mma').val(), 1, 1, 12);

        // Update the input values with validated data only if they changed
        if (jQuery('#aaa').val() !== String(year)) {
            jQuery('#aaa').val(year);
        }
        if (jQuery('#jja').val() !== String(day)) {
            jQuery('#jja').val(day);
        }

        if (window.PersianDateConverter && window.PersianDateConverter.isValidJalali(year, month, day)) {
            const date = jalali_to_gregorian(year, month, day);
            jQuery('input[name=aa]').val(date[0]);
            jQuery('select[name=mm]').val(date[1]);
            jQuery('input[name=jj]').val(date[2]);
        }
    });

    jQuery('#timestampdiv,.inline-edit-date').on('blur', '#aaa', function () {
        const year = safeParseInt(jQuery(this).val(), 1400, 1, 3000);
        jQuery(this).val(year);

        const month = safeParseInt(jQuery('#mma').val(), 1, 1, 12);
        let day = safeParseInt(jQuery('#jja').val(), 1, 1, 31);

        let maxDay = 31;
        if (window.PersianDateConverter && window.PersianDateConverter.getDaysInJalaliMonth) {
            maxDay = window.PersianDateConverter.getDaysInJalaliMonth(year, month);
        }
        if (day > maxDay) {
            day = maxDay;
            jQuery('#jja').val(day);
        }

        jQuery('#aaa').trigger('keyup');
    });

    jQuery('#timestampdiv,.inline-edit-date').on('blur', '#jja', function () {
        const year = safeParseInt(jQuery('#aaa').val(), 1400, 1, 3000);
        const month = safeParseInt(jQuery('#mma').val(), 1, 1, 12);

        let maxDay = 31;
        if (window.PersianDateConverter && window.PersianDateConverter.getDaysInJalaliMonth) {
            maxDay = window.PersianDateConverter.getDaysInJalaliMonth(year, month);
        }

        const day = safeParseInt(jQuery(this).val(), 1, 1, maxDay);
        jQuery(this).val(day);
        jQuery('#jja').trigger('keyup');
    });

    jQuery('#timestampdiv,.inline-edit-date').on('change', '#mma', function () {
        const year = safeParseInt(jQuery('#aaa').val(), 1400, 1, 3000);
        const month = safeParseInt(jQuery(this).val(), 1, 1, 12);
        let day = safeParseInt(jQuery('#jja').val(), 1, 1, 31);

        let maxDay = 31;
        if (window.PersianDateConverter && window.PersianDateConverter.getDaysInJalaliMonth) {
            maxDay = window.PersianDateConverter.getDaysInJalaliMonth(year, month);
        }
        if (day > maxDay) {
            day = maxDay;
            jQuery('#jja').val(day);
        }

        if (window.PersianDateConverter && window.PersianDateConverter.isValidJalali(year, month, day)) {
            const date = jalali_to_gregorian(year, month, day);
            jQuery('input[name=aa]').val(date[0]);
            jQuery('select[name=mm]').val(date[1]);
            jQuery('input[name=jj]').val(date[2]);
        }
    });


    /*
     * Filter on post screen dates
     */
    let timer;
    let timerTicks = 0;

    function applyJalaliDate() {
        timerTicks++;
        const oldTimestamp = jQuery('#timestamp b').text();
        let newTimestamp = jQuery('#jja').val() + ' ' + jQuery('#mma option:selected').text() + ' ' + jQuery('#aaa').val() + ' در ' + jQuery('#hha').val() + ':' + jQuery('#mna').val();
        newTimestamp = window.PersianDateConverter.toPersianDigits(newTimestamp);
        if (oldTimestamp !== newTimestamp) {
            jQuery('#timestamp b').attr('dir', 'rtl');
            jQuery('#timestamp b').text(newTimestamp);
            clearInterval(timer);
        } else if (timerTicks > 100) {
            clearInterval(timer);
        }
    }

    jQuery('#timestampdiv').on('keypress', function (e) {
        if (e.which === 13) {
            if (timer) {
                clearInterval(timer);
            }
            timerTicks = 0;
            timer = setInterval(function () {
                applyJalaliDate();
            }, 50);
        }
    });

    jQuery('.save-timestamp  , #publish').on('click', function () {
        if (jQuery('#aaa').length) {
            if (timer) {
                clearInterval(timer);
            }
            timerTicks = 0;
            timer = setInterval(function () {
                applyJalaliDate();
            }, 50);
        }
    });


});
