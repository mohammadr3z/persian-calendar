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

    function isValidDate(year, month, day) {
        return year >= 1 && year <= 3000 &&
            month >= 1 && month <= 12 &&
            day >= 1 && day <= 31;
    }

    function gregorian_to_jalali(gy, gm, gd) {
        gy = safeParseInt(gy, 1400, 1, 3000);
        gm = safeParseInt(gm, 1, 1, 12);
        gd = safeParseInt(gd, 1, 1, 31);

        if (!isValidDate(gy, gm, gd)) {
            return ['1400', '01', '01']; // Return safe default
        }
        g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
        jy = (gy <= 1600) ? 0 : 979;
        gy -= (gy <= 1600) ? 621 : 1600;
        gy2 = (gm > 2) ? (gy + 1) : gy;
        days = (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100)
            + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
        jy += 33 * Math.floor(days / 12053);
        days %= 12053;
        jy += 4 * Math.floor(days / 1461);
        days %= 1461;
        jy += Math.floor((days - 1) / 365);
        if (days > 365) days = (days - 1) % 365;
        jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
        jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
        if (jm < 10) jm = '0' + String(jm);
        return [String(jy), String(jm), String(jd)];
    }

    function jalali_to_gregorian(jy, jm, jd) {
        jy = safeParseInt(jy, 1400, 1, 3000);
        jm = safeParseInt(jm, 1, 1, 12);
        jd = safeParseInt(jd, 1, 1, 31);

        if (!isValidDate(jy, jm, jd)) {
            return ['2021', '01', '01']; // Return safe default
        }
        gy = (jy <= 979) ? 621 : 1600;
        jy -= (jy <= 979) ? 0 : 979;
        days = (365 * jy) + (Math.floor(jy / 33) * 8) + Math.floor(((jy % 33) + 3) / 4)
            + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
        gy += 400 * Math.floor(days / 146097);
        days %= 146097;
        if (days > 36524) {
            gy += 100 * Math.floor(--days / 36524);
            days %= 36524;
            if (days >= 365) days++;
        }
        gy += 4 * Math.floor(days / 1461);
        days %= 1461;
        gy += Math.floor((days - 1) / 365);
        if (days > 365) days = (days - 1) % 365;
        gd = days + 1;
        sal_a = [0, 31, ((gy % 4 == 0 && gy % 100 != 0) || (gy % 400 == 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        for (gm = 0; gm < 13; gm++) {
            v = sal_a[gm];
            if (gd <= v) break;
            gd -= v;
        }
        if (gm < 10) gm = '0' + String(gm);
        return [String(gy), String(gm), String(gd)];
    }

    var jalali_month_names = ['', 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];


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

        div = '<div class="timestamp-wrap jalali">' +
            '<label><input type="text" id="jja" name="jja" value="' + day + '" size="2" maxlength="2" autocomplete="off" /></label>' +
            '<label><select id="mma" name="mma">';
        for (var i = 1; i < 13; i++) {
            if (i == mon)
                div += '<option value="' + i + '" selected="selected">' + jalali_month_names[i] + '</option>';
            else
                div += '<option value="' + i + '">' + jalali_month_names[i] + '</option>';
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
        var date = gregorian_to_jalali(jQuery('#aa').val(), jQuery('#mm').val(), jQuery('#jj').val());
        jQuery('#timestampdiv').prepend(jalaliTimestampDiv(date[0], date[1], date[2], jQuery('#hh').val(), jQuery('#mn').val()));
        jQuery('#timestampdiv .timestamp-wrap:eq(1)').hide();
    });

    jQuery('#the-list').on('click', '.editinline', function () {
        var tr = jQuery(this).closest('td');
        var year = tr.find('.aa').html();
        if (year > 1700) {
            var month = tr.find('.mm').html();
            var day = tr.find('.jj').html();
            var hour = tr.find('.hh').html();
            var minu = tr.find('.mn').html();
            var date = gregorian_to_jalali(year, month, day);
            jQuery('.inline-edit-date .timestamp-wrap').hide();
            jQuery('.jalali').remove();
            jQuery('.inline-edit-date legend').after(jalaliTimestampDiv(date[0], date[1], date[2], hour, minu));
        }
    });

    jQuery('#timestampdiv,.inline-edit-date').on('keyup', '#hha', function () {
        const hour = safeParseInt(jQuery(this).val(), 0, 0, 23);
        jQuery(this).val(hour);
        jQuery('input[name=hh]').val(hour);
    });

    jQuery('#timestampdiv,.inline-edit-date').on('keyup', '#mna', function () {
        const minute = safeParseInt(jQuery(this).val(), 0, 0, 59);
        jQuery('input[name=mn]').val(minute.toString().padStart(2, '0'));
    });

    // Apply padding only on blur (when user finishes typing)
    jQuery('#timestampdiv,.inline-edit-date').on('blur', '#mna', function () {
        const minute = safeParseInt(jQuery(this).val(), 0, 0, 59);
        jQuery(this).val(minute.toString().padStart(2, '0'));
    });

    jQuery('#timestampdiv,.inline-edit-date').on('keyup', '#aaa , #jja', function () {
        const year = safeParseInt(jQuery('#aaa').val(), 1400, 1, 3000);
        const day = safeParseInt(jQuery('#jja').val(), 1, 1, 31);
        const month = safeParseInt(jQuery('#mma').val(), 1, 1, 12);

        // Update the input values with validated data
        jQuery('#aaa').val(year);
        jQuery('#jja').val(day);

        if (isValidDate(year, month, day)) {
            date = jalali_to_gregorian(year, month, day);
            jQuery('input[name=aa]').val(date[0]);
            jQuery('select[name=mm]').val(date[1]);
            jQuery('input[name=jj]').val(date[2]);
        }
    });

    jQuery('#timestampdiv,.inline-edit-date').on('change', '#mma', function () {
        const year = safeParseInt(jQuery('#aaa').val(), 1400, 1, 3000);
        const day = safeParseInt(jQuery('#jja').val(), 1, 1, 31);
        const month = safeParseInt(jQuery(this).val(), 1, 1, 12);

        if (isValidDate(year, month, day)) {
            date = jalali_to_gregorian(year, month, day);
            jQuery('input[name=aa]').val(date[0]);
            jQuery('select[name=mm]').val(date[1]);
            jQuery('input[name=jj]').val(date[2]);
        }
    });


    /*
     * Filter on post screen dates
     */
    var timer;

    function applyJalaliDate() {
        var oldTimestamp = jQuery('#timestamp b').text();
        var newTimestamp = jQuery('#jja').val() + ' ' + jQuery('#mma option:selected').text() + ' ' + jQuery('#aaa').val() + ' در ' + jQuery('#hha').val() + ':' + jQuery('#mna').val();
        newTimestamp = newTimestamp.replace(/\d+/g, function (digit) {
            var ret = '';
            for (var i = 0, len = digit.length; i < len; i++) {
                ret += String.fromCharCode(digit.charCodeAt(i) + 1728);
            }
            return ret;
        });
        if (oldTimestamp != newTimestamp) {
            jQuery('#timestamp b').attr('dir', 'rtl');
            jQuery('#timestamp b').html(newTimestamp);
            clearInterval(timer);
        }
    }

    jQuery('#timestampdiv').on('keypress', function (e) {
        if (e.which == 13)
            timer = setInterval(function () {
                applyJalaliDate();
            }, 50);
    });

    jQuery('.save-timestamp  , #publish').on('click', function () {
        if (jQuery('#aaa').length)
            timer = setInterval(function () {
                applyJalaliDate();
            }, 50);
    });


});