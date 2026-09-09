/**
 * Persian Calendar Standalone Component
 * A lightweight, dependency-free Jalali calendar library.
 * Supports inline rendering, input picker popover, min/max constraints, time picker, and dark mode.
 */
(function () {
  'use strict';

  // Date Converter Functions
  const G_DAYS_IN_MONTH_NON_LEAP = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const JALALI_EPOCH_DIFFERENCE = 355666;
  const JALALI_33_YEAR_CYCLE_DAYS = 12053;
  const GREGORIAN_4_YEAR_CYCLE_DAYS = 1461;
  const JALALI_YEAR_START_OFFSET = -1595;
  const GREGORIAN_EPOCH_DIFFERENCE = -355668;
  const JALALI_33_YEAR_CYCLE_LEAP_DAYS = 8;
  const GREGORIAN_400_YEAR_CYCLE_DAYS = 146097;
  const GREGORIAN_100_YEAR_CYCLE_DAYS = 36524;

  const isValidGregorian = (gy, gm, gd) => {
    if (!Number.isInteger(gy) || !Number.isInteger(gm) || !Number.isInteger(gd)) return false;
    if (gy < 1 || gy > 3000 || gm < 1 || gm > 12 || gd < 1) return false;
    const isLeap = ((gy % 4 === 0) && (gy % 100 !== 0)) || (gy % 400 === 0);
    const maxDays = [0, 31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return gd <= maxDays[gm];
  };

  const gregorianToJalali = (gy, gm, gd) => {
    if (!isValidGregorian(gy, gm, gd)) return [0, 0, 0];
    const gy2 = gm > 2 ? (gy + 1) : gy;
    let days = JALALI_EPOCH_DIFFERENCE + (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + G_DAYS_IN_MONTH_NON_LEAP[gm - 1];
    let jy = JALALI_YEAR_START_OFFSET + 33 * Math.floor(days / JALALI_33_YEAR_CYCLE_DAYS);
    days %= JALALI_33_YEAR_CYCLE_DAYS;
    jy += 4 * Math.floor(days / GREGORIAN_4_YEAR_CYCLE_DAYS);
    days %= GREGORIAN_4_YEAR_CYCLE_DAYS;
    if (days > 365) {
      jy += Math.floor((days - 1) / 365);
      days = (days - 1) % 365;
    }
    let jm, jd;
    if (days < 186) {
      jm = 1 + Math.floor(days / 31);
      jd = 1 + (days % 31);
    } else {
      jm = 7 + Math.floor((days - 186) / 30);
      jd = 1 + ((days - 186) % 30);
    }
    return [jy, jm, jd];
  };

  const isValidJalali = (jy, jm, jd) => {
    if (!Number.isInteger(jy) || !Number.isInteger(jm) || !Number.isInteger(jd)) return false;
    if (jy < 1 || jy > 3000 || jm < 1 || jm > 12 || jd < 1) return false;
    // Jalali months 1-6 have 31 days, 7-11 have 30 days, 12 has 29 or 30 (leap)
    const maxDay = jm <= 6 ? 31 : (jm <= 11 ? 30 : ([1, 5, 9, 13, 17, 22, 26, 30].includes(jy % 33) ? 30 : 29));
    if (jd > maxDay) return false;
    return true;
  };

  const jalaliToGregorian = (jy, jm, jd) => {
    if (!isValidJalali(jy, jm, jd)) return [0, 0, 0];
    const jy_adj = jy + 1595;
    let days = GREGORIAN_EPOCH_DIFFERENCE + (365 * jy_adj) + (Math.floor(jy_adj / 33) * JALALI_33_YEAR_CYCLE_LEAP_DAYS) + Math.floor(((jy_adj % 33) + 3) / 4) + jd;
    if (jm < 7) {
      days += (jm - 1) * 31;
    } else {
      days += (jm - 7) * 30 + 186;
    }
    let gy = 400 * Math.floor(days / GREGORIAN_400_YEAR_CYCLE_DAYS);
    days %= GREGORIAN_400_YEAR_CYCLE_DAYS;
    if (days > GREGORIAN_100_YEAR_CYCLE_DAYS) {
      gy += 100 * Math.floor(--days / GREGORIAN_100_YEAR_CYCLE_DAYS);
      days %= GREGORIAN_100_YEAR_CYCLE_DAYS;
      if (days >= 365) days++;
    }
    gy += 4 * Math.floor(days / GREGORIAN_4_YEAR_CYCLE_DAYS);
    days %= GREGORIAN_4_YEAR_CYCLE_DAYS;
    if (days > 365) {
      gy += Math.floor((days - 1) / 365);
      days = (days - 1) % 365;
    }
    let gd = days + 1;
    const isLeap = ((gy % 4 === 0) && (gy % 100 !== 0)) || (gy % 400 === 0);
    const G_DAYS_IN_MONTH = [0, 31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let gm;
    for (gm = 1; gm <= 12; gm++) {
      if (gd <= G_DAYS_IN_MONTH[gm]) break;
      gd -= G_DAYS_IN_MONTH[gm];
    }
    return [gy, gm, gd];
  };

  // Helper Utility Functions
  const safeParseInt = (value, defaultValue = 0, min = null, max = null) => {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) return defaultValue;
    if (min !== null && parsed < min) return min;
    if (max !== null && parsed > max) return max;
    return parsed;
  };

  const isValidJalaliDate = (year, month, day) => {
    if (year < 1 || year > 3000 || month < 1 || month > 12 || day < 1) return false;
    const maxDay = getDaysInJalaliMonth(year, month);
    return day <= maxDay;
  };

  const padZero = (num) => String(num).padStart(2, '0');

  const adjustToIranTimezone = (date) => {
    const IRAN_OFFSET_MINUTES = 210;
    const browserOffsetMinutes = -date.getTimezoneOffset();
    const diffMinutes = IRAN_OFFSET_MINUTES - browserOffsetMinutes;
    return new Date(date.getTime() + diffMinutes * 60 * 1000);
  };

  const parseDateBoundary = (value, today) => {
    if (value === 'today' || value === 'current' || value === 'now') {
      return new Date(today.getFullYear(), today.getMonth(), today.getDate());
    }
    if (value instanceof Date) {
      return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }
    return null;
  };

  const formatGregorianISO = (date, showTime) => {
    const y = date.getFullYear();
    const m = padZero(date.getMonth() + 1);
    const d = padZero(date.getDate());
    let result = y + '-' + m + '-' + d;
    if (showTime) {
      result += 'T' + padZero(date.getHours()) + ':' + padZero(date.getMinutes());
    }
    return result;
  };

  // Constants
  const PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  const PERSIAN_WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
  const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

  const toPersianDigits = (str) => String(str).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[d]);
  const toAsciiDigits = (str) => String(str).replace(/[۰-۹]/g, (d) => PERSIAN_DIGITS.indexOf(d).toString());

  const getDaysInJalaliMonth = (jy, jm) => {
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    const leapYears = [1, 5, 9, 13, 17, 22, 26, 30];
    return leapYears.includes(jy % 33) ? 30 : 29;
  };

  // Helper to format date
  const formatDate = (jy, jm, jd, hour, minute, showTime, format, usePersian) => {
    let formatted = format || (showTime ? 'YYYY/MM/DD HH:mm' : 'YYYY/MM/DD');
    formatted = formatted
      .replace('YYYY', jy)
      .replace('MM', padZero(jm))
      .replace('DD', padZero(jd));
    if (showTime) {
      formatted = formatted
        .replace('HH', padZero(hour))
        .replace('mm', padZero(minute));
    }
    return usePersian ? toPersianDigits(formatted) : formatted;
  };

  // Saturday-first to match PERSIAN_WEEKDAYS and the Persian calendar convention
  const PERSIAN_WEEKDAYS_LONG = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

  // Helper to format alt (readable Persian) date
  const formatAltDate = (jy, jm, jd, jsDay, hour, minute, showTime, format, usePersian) => {
    if (format) {
      return formatDate(jy, jm, jd, hour, minute, showTime, format, usePersian);
    }
    // Convert JS day (0=Sunday) to Persian day index (0=Saturday)
    const persianDayIndex = (jsDay + 1) % 7;
    const weekdayName = PERSIAN_WEEKDAYS_LONG[persianDayIndex];
    const monthName = PERSIAN_MONTHS[jm - 1];
    const datePart = `${weekdayName}، ${usePersian ? toPersianDigits(jd) : jd} ${monthName} ${usePersian ? toPersianDigits(jy) : jy}`;
    if (showTime) {
      return `${datePart} ساعت ${usePersian ? toPersianDigits(padZero(hour)) : padZero(hour)}:${usePersian ? toPersianDigits(padZero(minute)) : padZero(minute)}`;
    }
    return datePart;
  };

  // Helper to parse Jalali date string
  const parseJalaliString = (str) => {
    if (!str) return null;
    const asciiStr = toAsciiDigits(str);
    const parts = asciiStr.match(/\d+/g);
    if (!parts || parts.length < 3) return null;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    let hour = 0, minute = 0;
    if (parts.length >= 5) {
      hour = parseInt(parts[3], 10);
      minute = parseInt(parts[4], 10);
    }
    if (isValidJalaliDate(year, month, day)) {
      return { year, month, day, hour, minute };
    }
    return null;
  };

  class PersianCalendar {
    /**
     * Creates a new instance of PersianCalendar
     * @param {HTMLElement|HTMLInputElement} targetElement - The element to render the calendar in or input element to bind to
     * @param {Object} options - Configuration options
     */
    constructor(targetElement, options = {}) {
      if (!targetElement || !(targetElement instanceof Element)) {
        throw new Error('PersianCalendar: Invalid target element');
      }

      this.isInput = targetElement instanceof HTMLInputElement;
      this.inputElement = this.isInput ? targetElement : null;
      this.container = this.isInput ? null : targetElement;

      this.options = {
        selectedDate: (options.selectedDate instanceof Date && !isNaN(options.selectedDate.getTime())) ? options.selectedDate : new Date(),
        onDateSelect: (typeof options.onDateSelect === 'function') ? options.onDateSelect : () => { },
        showTime: (typeof options.showTime === 'boolean') ? options.showTime : true,
        useIranTimezone: (typeof options.useIranTimezone === 'boolean') ? options.useIranTimezone : false,
        persianDigits: (typeof options.persianDigits === 'boolean') ? options.persianDigits : true,
        dateFormat: options.dateFormat || null,
        minDate: options.minDate || null,
        maxDate: options.maxDate || null,
        rangeStart: options.rangeStart || null,
        rangeEnd: options.rangeEnd || null,
        altInput: (typeof options.altInput === 'boolean') ? options.altInput : false,
        altFormat: options.altFormat || null,
        onClose: (typeof options.onClose === 'function') ? options.onClose : () => { },
        theme: options.theme || 'light', // 'light' or 'dark'
        showCloseButton: (typeof options.showCloseButton === 'boolean') ? options.showCloseButton : this.isInput,
        isTwoMonths: (typeof options.isTwoMonths === 'boolean') ? options.isTwoMonths : false,
        // Preserve any extra custom options not explicitly handled above
        filterDate: options.filterDate || null,
        rangeMode: options.rangeMode || false
      };

      // Set initial date/time values
      let initialDate = this.options.selectedDate;
      if (!(initialDate instanceof Date) || isNaN(initialDate.getTime())) {
        initialDate = new Date();
      }

      // Adjust for Iran timezone if specified
      if (this.options.useIranTimezone) {
        initialDate = adjustToIranTimezone(initialDate);
      }

      // Try to parse existing value from the input field
      let parsedDate = null;
      if (this.isInput && this.inputElement.value) {
        parsedDate = parseJalaliString(this.inputElement.value);
      }

      if (parsedDate) {
        this.currentYear = parsedDate.year;
        this.currentMonth = parsedDate.month;
        this.selectedDate = { year: parsedDate.year, month: parsedDate.month, day: parsedDate.day };
        this.selectedTime = { hour: parsedDate.hour, minute: parsedDate.minute };
      } else {
        const [jy, jm, jd] = gregorianToJalali(initialDate.getFullYear(), initialDate.getMonth() + 1, initialDate.getDate());
        // Fallback must use Jalali date, not Gregorian
        let fallbackYear = jy, fallbackMonth = jm;
        if (jy <= 0 || jm <= 0) {
          const fbNow = new Date();
          const [fbJy, fbJm] = gregorianToJalali(fbNow.getFullYear(), fbNow.getMonth() + 1, fbNow.getDate());
          fallbackYear = fbJy;
          fallbackMonth = fbJm;
        }
        this.currentYear = jy > 0 ? jy : fallbackYear;
        this.currentMonth = jm > 0 ? jm : fallbackMonth;
        this.selectedDate = { year: jy, month: jm, day: jd };
        this.selectedTime = {
          hour: initialDate.getHours(),
          minute: initialDate.getMinutes()
        };
      }

      // Initialize DOM structure
      this.initDOM();
      this.attachEventListeners();
    }

    initDOM() {
      if (this.isInput) {
        // Handle altInput setup
        if (this.options.altInput) {
          this.inputElement.style.display = 'none';
          this.altInputElement = document.createElement('input');
          this.altInputElement.type = 'text';
          this.altInputElement.className = this.inputElement.className;
          this.altInputElement.placeholder = this.inputElement.placeholder;
          this.altInputElement.readOnly = true;
          this.inputElement.parentNode.insertBefore(this.altInputElement, this.inputElement.nextSibling);
        }

        // Create popover calendar
        this.popover = document.createElement('div');
        this.popover.className = `persian-calendar-wrapper persian-calendar-popover`;
        if (this.options.theme === 'dark') {
          this.popover.classList.add('persian-calendar-dark');
        }
        document.body.appendChild(this.popover);
        this.calendarWrapper = this.popover;
      } else {
        // Render inline inside container
        this.container.textContent = '';
        const wrapper = document.createElement('div');
        wrapper.className = 'persian-calendar-wrapper';
        if (this.options.theme === 'dark') {
          wrapper.classList.add('persian-calendar-dark');
        }
        this.container.appendChild(wrapper);
        this.calendarWrapper = wrapper;
      }

      this.renderStructure();
      this.cacheDOMElements();
      this.updateCalendarView();
    }

    renderStructure() {
      // Header
      const header = document.createElement('div');
      header.className = 'persian-calendar-header';
      
      const title = document.createElement('div');
      title.className = 'persian-calendar-title';
      title.textContent = this.isInput ? 'انتخاب تاریخ' : 'تقویم';
      header.appendChild(title);

      const actions = document.createElement('div');
      actions.className = 'persian-calendar-header-actions';

      const nowBtn = document.createElement('button');
      nowBtn.className = 'persian-calendar-now-btn';
      nowBtn.type = 'button';
      nowBtn.textContent = 'اکنون';
      actions.appendChild(nowBtn);

      if (this.options.showCloseButton) {
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'persian-calendar-close-btn';
        closeBtn.setAttribute('aria-label', 'بستن');
        closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M12 13.06l3.712 3.713 1.061-1.06L13.061 12l3.712-3.712-1.06-1.06L12 10.938 8.288 7.227l-1.061 1.06L10.939 12l-3.712 3.712 1.06 1.061L12 13.061z"></path></svg>';
        actions.appendChild(closeBtn);
      }

      header.appendChild(actions);
      this.calendarWrapper.appendChild(header);

      // Time picker
      if (this.options.showTime) {
        const timeTitle = document.createElement('div');
        timeTitle.className = 'persian-calendar-time-title';
        timeTitle.textContent = 'زمان';
        this.calendarWrapper.appendChild(timeTitle);

        const timeContainer = document.createElement('div');
        timeContainer.className = 'persian-calendar-time';

        const timeInputs = document.createElement('div');
        timeInputs.className = 'persian-calendar-time-inputs';

        const hourInput = document.createElement('input');
        hourInput.type = 'number';
        hourInput.className = 'persian-calendar-hour';
        hourInput.min = '0';
        hourInput.max = '23';
        hourInput.value = padZero(this.selectedTime.hour);
        timeInputs.appendChild(hourInput);

        const separator = document.createElement('span');
        separator.textContent = ':';
        timeInputs.appendChild(separator);

        const minuteInput = document.createElement('input');
        minuteInput.type = 'number';
        minuteInput.className = 'persian-calendar-minute';
        minuteInput.min = '0';
        minuteInput.max = '59';
        minuteInput.value = padZero(this.selectedTime.minute);
        timeInputs.appendChild(minuteInput);

        timeContainer.appendChild(timeInputs);
        this.calendarWrapper.appendChild(timeContainer);
      }

      // Date Picker Section
      const datePicker = document.createElement('div');
      datePicker.className = 'persian-calendar-date-picker';

      const dateTitle = document.createElement('div');
      dateTitle.className = 'persian-calendar-date-title';
      dateTitle.textContent = 'تاریخ';
      datePicker.appendChild(dateTitle);

      // Month/Year inputs
      const monthYear = document.createElement('div');
      monthYear.className = 'persian-calendar-month-year';
      
      const dayInput = document.createElement('input');
      dayInput.type = 'text';
      dayInput.className = 'persian-calendar-day-display';
      dayInput.value = toPersianDigits(this.selectedDate.day);
      dayInput.maxLength = 2;
      monthYear.appendChild(dayInput);

      const monthSelect = document.createElement('select');
      monthSelect.className = 'persian-calendar-month';
      PERSIAN_MONTHS.forEach((month, index) => {
        const opt = document.createElement('option');
        opt.value = index + 1;
        opt.textContent = month;
        if ((index + 1) === this.currentMonth) opt.selected = true;
        monthSelect.appendChild(opt);
      });
      monthYear.appendChild(monthSelect);

      const yearInput = document.createElement('input');
      yearInput.type = 'text';
      yearInput.className = 'persian-calendar-year-display';
      yearInput.value = toPersianDigits(this.currentYear);
      yearInput.maxLength = 4;
      monthYear.appendChild(yearInput);

      datePicker.appendChild(monthYear);

      // Navigation Bar
      const nav = document.createElement('div');
      nav.className = 'persian-calendar-nav';

      const prevBtn = document.createElement('button');
      prevBtn.className = 'persian-calendar-prev';
      prevBtn.type = 'button';
      prevBtn.textContent = '\u2039';
      nav.appendChild(prevBtn);

      const currentMonthSpan = document.createElement('span');
      currentMonthSpan.className = 'persian-calendar-current-month';
      currentMonthSpan.textContent = PERSIAN_MONTHS[this.currentMonth - 1] + ' ' + toPersianDigits(this.currentYear);
      nav.appendChild(currentMonthSpan);

      const nextBtn = document.createElement('button');
      nextBtn.className = 'persian-calendar-next';
      nextBtn.type = 'button';
      nextBtn.textContent = '\u203A';
      nav.appendChild(nextBtn);

      datePicker.appendChild(nav);

      // Grid for Days
      const grid = document.createElement('div');
      grid.className = 'persian-calendar-grid';

      const weekdaysRow = document.createElement('div');
      weekdaysRow.className = 'persian-calendar-weekdays';
      PERSIAN_WEEKDAYS.forEach(dayName => {
        const dayEl = document.createElement('div');
        dayEl.className = 'persian-calendar-weekday';
        dayEl.textContent = dayName;
        weekdaysRow.appendChild(dayEl);
      });
      grid.appendChild(weekdaysRow);

      const daysContainer = document.createElement('div');
      daysContainer.className = 'persian-calendar-days';
      grid.appendChild(daysContainer);

      datePicker.appendChild(grid);

      this.calendarWrapper.appendChild(datePicker);
    }

    cacheDOMElements() {
      this.dom = {
        monthSelect: this.calendarWrapper.querySelector('.persian-calendar-month'),
        dayInput: this.calendarWrapper.querySelector('.persian-calendar-day-display'),
        yearInput: this.calendarWrapper.querySelector('.persian-calendar-year-display'),
        currentMonthText: this.calendarWrapper.querySelector('.persian-calendar-current-month'),
        daysContainer: this.calendarWrapper.querySelector('.persian-calendar-days'),
        hourInput: this.calendarWrapper.querySelector('.persian-calendar-hour'),
        minuteInput: this.calendarWrapper.querySelector('.persian-calendar-minute')
      };
    }

    createDaysFragment() {
      const daysInMonth = getDaysInJalaliMonth(this.currentYear, this.currentMonth);
      const [gy, gm, gd] = jalaliToGregorian(this.currentYear, this.currentMonth, 1);
      // jsDay is Sunday=0, Monday=1, ..., Saturday=6
      const jsDay = new Date(Date.UTC(gy, gm - 1, gd)).getUTCDay();
      // startDay converts JS day to Persian day index: Saturday=0, Sunday=1, ..., Friday=6
      const startDay = (jsDay + 1) % 7;

      let today = new Date();
      if (this.options.useIranTimezone) {
        today = adjustToIranTimezone(today);
      }
      const [todayJy, todayJm, todayJd] = gregorianToJalali(today.getFullYear(), today.getMonth() + 1, today.getDate());
      const isTodayMonth = (this.currentMonth === todayJm && this.currentYear === todayJy);
      const isSelectedMonth = (this.currentMonth === this.selectedDate.month && this.currentYear === this.selectedDate.year);

      // Parse date boundaries
      const minDateObj = parseDateBoundary(this.options.minDate, today);
      const maxDateObj = parseDateBoundary(this.options.maxDate, today);

      // Setup range calculations
      const compareDateOnly = (d1, d2) => {
        if (!d1 || !d2) return false;
        return d1.getFullYear() === d2.getFullYear() &&
               d1.getMonth() === d2.getMonth() &&
               d1.getDate() === d2.getDate();
      };

      const fragment = document.createDocumentFragment();

      // Leading empty day slots
      for (let i = 0; i < startDay; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'persian-calendar-day empty';
        fragment.appendChild(emptyDay);
      }

      // Populate month days
      for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'persian-calendar-day';
        dayElement.setAttribute('data-day', day.toString());
        dayElement.textContent = this.options.persianDigits ? toPersianDigits(day) : day;

        // Verify bounds
        let isDisabled = false;
        const [dgy, dgm, dgd] = jalaliToGregorian(this.currentYear, this.currentMonth, day);
        const currentDayDate = new Date(dgy, dgm - 1, dgd);

        if (minDateObj && currentDayDate < minDateObj) {
          isDisabled = true;
        }
        if (maxDateObj && currentDayDate > maxDateObj) {
          isDisabled = true;
        }
        
        if (typeof this.options.filterDate === 'function') {
          const filterResult = this.options.filterDate(currentDayDate, { year: this.currentYear, month: this.currentMonth, day: day });
          if (filterResult === false) {
            isDisabled = true;
          } else if (Array.isArray(filterResult)) {
            if (filterResult[0] === false) {
              isDisabled = true;
            }
            if (filterResult[1] && typeof filterResult[1] === 'string') {
              const classes = filterResult[1].trim().split(/\s+/);
              classes.forEach(c => { if (c) dayElement.classList.add(c); });
            }
            if (filterResult[2] && typeof filterResult[2] === 'string') {
              dayElement.title = filterResult[2];
            }
          }
        }

        if (isDisabled) {
          dayElement.classList.add('disabled');
        } else {
          if (isTodayMonth && day === todayJd) dayElement.classList.add('today');
          const shouldAddSelected = !this.options.rangeMode || !this.options.isTwoMonths;
          if (shouldAddSelected && isSelectedMonth && day === this.selectedDate.day) {
            dayElement.classList.add('selected');
          }
        }

        // Apply static range styles
        if (this.options.rangeStart) {
          const rStart = new Date(this.options.rangeStart.getFullYear(), this.options.rangeStart.getMonth(), this.options.rangeStart.getDate());
          const isRangeStart = compareDateOnly(currentDayDate, rStart);
          if (isRangeStart) dayElement.classList.add('range-start');

          if (this.options.rangeEnd) {
            const rEnd = new Date(this.options.rangeEnd.getFullYear(), this.options.rangeEnd.getMonth(), this.options.rangeEnd.getDate());
            const isRangeEnd = compareDateOnly(currentDayDate, rEnd);
            if (isRangeEnd) dayElement.classList.add('range-end');

            if (currentDayDate > rStart && currentDayDate < rEnd) {
              dayElement.classList.add('in-range');
            }
          }
        }

        fragment.appendChild(dayElement);
      }

      return fragment;
    }

    attachEventListeners() {
      // Handle interactive click elements on wrapper
      this.calendarWrapper.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = e.target;
        if (target.matches('.persian-calendar-day:not(.empty):not(.disabled)')) {
          const day = safeParseInt(target.dataset.day, 1, 1, 31);
          if (isValidJalaliDate(this.currentYear, this.currentMonth, day)) {
            this.selectDate(this.currentYear, this.currentMonth, day);
          }
        } else if (target.matches('.persian-calendar-prev')) {
          this.previousMonth();
        } else if (target.matches('.persian-calendar-next')) {
          this.nextMonth();
        } else if (target.matches('.persian-calendar-now-btn')) {
          this.setToNow();
        } else if (target.matches('.persian-calendar-close-btn') || target.closest('.persian-calendar-close-btn')) {
          this.close();
        }
      });

      // Mouse hover event listeners for dynamic range preview
      if (this.dom.daysContainer) {
        this.dom.daysContainer.addEventListener('mouseover', (e) => {
          const target = e.target;
          if (target.matches('.persian-calendar-day:not(.empty):not(.disabled)')) {
            const day = safeParseInt(target.dataset.day, 0);
            if (day > 0) {
              this.handleDayHover(day);
            }
          }
        });

        this.dom.daysContainer.addEventListener('mouseleave', () => {
          this.clearHoverRange();
        });
      }

      // Month select dropdown handler
      if (this.dom.monthSelect) {
        this.dom.monthSelect.addEventListener('change', (e) => {
          const month = safeParseInt(e.target.value, 1, 1, 12);
          if (isValidJalaliDate(this.currentYear, month, this.selectedDate.day)) {
            this.currentMonth = month;
            this.updateCalendarView();
          }
        });
      }

      // Key/change listeners helper
      const setupInput = (input, onChange) => {
        input.addEventListener('change', onChange);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const step = e.key === 'ArrowUp' ? 1 : -1;
            const currentVal = safeParseInt(toAsciiDigits(input.value), 0);
            input.value = currentVal + step;
            onChange({ target: input });
          }
        });
      };

      // Day input field
      if (this.dom.dayInput) {
        setupInput(this.dom.dayInput, (e) => {
          const day = safeParseInt(toAsciiDigits(e.target.value), 1, 1, 31);
          const daysInMonth = getDaysInJalaliMonth(this.currentYear, this.currentMonth);
          if (day <= daysInMonth && isValidJalaliDate(this.currentYear, this.currentMonth, day)) {
            this.selectedDate.day = day;
            this.updateCalendarView();
            this.notifyDateChange();
          } else {
            e.target.value = this.options.persianDigits ? toPersianDigits(this.selectedDate.day) : this.selectedDate.day;
          }
        });
      }

      // Year input field
      if (this.dom.yearInput) {
        setupInput(this.dom.yearInput, (e) => {
          const year = safeParseInt(toAsciiDigits(e.target.value), 1400, 1, 3000);
          if (isValidJalaliDate(year, this.currentMonth, this.selectedDate.day)) {
            this.currentYear = year;
            this.updateCalendarView();
          } else {
            e.target.value = this.options.persianDigits ? toPersianDigits(this.currentYear) : this.currentYear;
          }
        });
      }

      // Time inputs
      if (this.options.showTime && this.dom.hourInput && this.dom.minuteInput) {
        setupInput(this.dom.hourInput, (e) => {
          const hour = safeParseInt(e.target.value, 0, 0, 23);
          this.selectedTime.hour = hour;
          e.target.value = padZero(hour);
          this.notifyDateChange();
        });

        setupInput(this.dom.minuteInput, (e) => {
          const minute = safeParseInt(e.target.value, 0, 0, 59);
          this.selectedTime.minute = minute;
          e.target.value = padZero(minute);
          this.notifyDateChange();
        });
      }

      // Popover Mode Event Listeners
      if (this.isInput) {
        const triggerEl = this.altInputElement || this.inputElement;

        // Toggle calendar visible on input focus/click
        triggerEl.addEventListener('focus', () => this.open());
        triggerEl.addEventListener('click', (e) => {
          e.stopPropagation();
          this.open();
        });

        // Close on clicking outside the input/calendar
        this._onDocumentClick = (e) => {
          if (!document.contains(e.target)) return;
          if (!triggerEl.contains(e.target) && !this.popover.contains(e.target)) {
            this.close();
          }
        };
        document.addEventListener('click', this._onDocumentClick);

        // Listen for scroll & window resize to adjust popover location
        this._onWindowResize = () => {
          if (this.popover.classList.contains('active')) {
            this.positionPopover();
          }
        };
        window.addEventListener('resize', this._onWindowResize);

        this._onWindowScroll = () => {
          if (this.popover.classList.contains('active')) {
            this.positionPopover();
          }
        };
        window.addEventListener('scroll', this._onWindowScroll, true);
      }
    }

    open() {
      if (!this.isInput) return;
      this.popover.classList.add('active');
      this.positionPopover();
    }

    close() {
      if (!this.isInput) return;
      if (this.popover.classList.contains('active')) {
        this.popover.classList.remove('active');
        this.options.onClose();
      }
    }

    positionPopover() {
      if (!this.isInput || !this.popover) return;
      const triggerEl = this.altInputElement || this.inputElement;
      const rect = triggerEl.getBoundingClientRect();
      const popoverRect = this.popover.getBoundingClientRect();
      
      let top = rect.bottom + window.scrollY;
      let left = (rect.right - popoverRect.width) + window.scrollX; // Align to the right bounds of the input (RTL behavior)
      
      // Boundary check left side
      if (left < window.scrollX) {
        left = rect.left + window.scrollX;
      }
      
      // Boundary check screen width
      if (left + popoverRect.width > window.innerWidth + window.scrollX) {
        left = window.innerWidth + window.scrollX - popoverRect.width - 10;
      }

      // Boundary check vertical (flip popover up if no room below)
      const viewportHeight = window.innerHeight;
      if (rect.bottom + popoverRect.height > viewportHeight && rect.top - popoverRect.height > 0) {
        top = rect.top - popoverRect.height + window.scrollY;
      }

      this.popover.style.top = `${top}px`;
      this.popover.style.left = `${left}px`;
    }

    selectDate(year, month, day) {
      if (this.options.rangeMode) {
        const [gy, gm, gd] = jalaliToGregorian(year, month, day);
        const clicked = new Date(gy, gm - 1, gd);
        
        if (!this.options.rangeStart || (this.options.rangeStart && this.options.rangeEnd)) {
          // First click: Start a new range
          this.options.rangeStart = clicked;
          this.options.rangeEnd = null;
          this.selectedDate = { year, month, day };
          this.updateCalendarView();
          this.notifyDateChange(true);
          return;
        } else {
          // Second click: End the range
          if (clicked < this.options.rangeStart) {
            this.options.rangeEnd = this.options.rangeStart;
            this.options.rangeStart = clicked;
          } else {
            this.options.rangeEnd = clicked;
          }
          this.selectedDate = { year, month, day };
          this.updateCalendarView();
          this.notifyDateChange(true);
          
          if (this.isInput) {
            this.close();
          }
          return;
        }
      }

      this.selectedDate = { year, month, day };
      this.updateCalendarView();
      this.notifyDateChange(true);
      
      // Auto close popover when date is selected
      if (this.isInput) {
        this.close();
      }
    }

    previousMonth() {
      this.currentMonth--;
      if (this.currentMonth < 1) {
        this.currentMonth = 12;
        this.currentYear--;
      }
      this.updateCalendarView();
    }

    nextMonth() {
      this.currentMonth++;
      if (this.currentMonth > 12) {
        this.currentMonth = 1;
        this.currentYear++;
      }
      this.updateCalendarView();
    }

    setToNow() {
      let now = new Date();
      if (this.options.useIranTimezone) {
        now = adjustToIranTimezone(now);
      }

      const [jy, jm, jd] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
      this.currentYear = jy;
      this.currentMonth = jm;
      this.selectedDate = { year: jy, month: jm, day: jd };
      this.selectedTime = {
        hour: now.getHours(),
        minute: now.getMinutes()
      };

      this.updateCalendarView();
      this.updateTimeDisplay();
      this.notifyDateChange(true);

      if (this.isInput) {
        this.close();
      }
    }

    updateCalendarView() {
      let monthIndex, displayYear;
      if (this.currentMonth >= 1 && this.currentMonth <= 12 && this.currentYear > 0) {
        monthIndex = this.currentMonth - 1;
        displayYear = this.currentYear;
      } else {
        const now = new Date();
        const [fjy, fjm] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
        monthIndex = fjm - 1;
        displayYear = fjy;
        this.currentMonth = fjm;
        this.currentYear = fjy;
      }
      const currentMonthTextStr = PERSIAN_MONTHS[monthIndex];

      if (this.dom.monthSelect) this.dom.monthSelect.value = monthIndex + 1;
      if (this.dom.dayInput) {
        const dVal = (this.selectedDate && this.selectedDate.day > 0) ? this.selectedDate.day : '';
        this.dom.dayInput.value = dVal !== '' ? (this.options.persianDigits ? toPersianDigits(dVal) : dVal) : '';
      }
      if (this.dom.yearInput) this.dom.yearInput.value = this.options.persianDigits ? toPersianDigits(displayYear) : displayYear;
      if (this.dom.currentMonthText) {
        this.dom.currentMonthText.textContent = `${currentMonthTextStr} ${this.options.persianDigits ? toPersianDigits(displayYear) : displayYear}`;
      }

      if (this.dom.daysContainer) {
        this.dom.daysContainer.textContent = '';
        this.dom.daysContainer.appendChild(this.createDaysFragment());
      }
    }

    updateTimeDisplay() {
      if (!this.options.showTime) return;
      if (this.dom.hourInput) this.dom.hourInput.value = padZero(this.selectedTime.hour);
      if (this.dom.minuteInput) this.dom.minuteInput.value = padZero(this.selectedTime.minute);
    }

    notifyDateChange(isDaySelect = false) {
      const [gy, gm, gd] = jalaliToGregorian(this.selectedDate.year, this.selectedDate.month, this.selectedDate.day);
      const gregorianDate = new Date(gy, gm - 1, gd, this.selectedTime.hour, this.selectedTime.minute);

      let formatted = formatDate(
        this.selectedDate.year,
        this.selectedDate.month,
        this.selectedDate.day,
        this.selectedTime.hour,
        this.selectedTime.minute,
        this.options.showTime,
        this.options.dateFormat,
        this.options.persianDigits
      );

      if (this.options.rangeMode && this.options.rangeStart) {
        const [sjy, sjm, sjd] = gregorianToJalali(this.options.rangeStart.getFullYear(), this.options.rangeStart.getMonth() + 1, this.options.rangeStart.getDate());
        const startStr = formatDate(sjy, sjm, sjd, 0, 0, false, this.options.dateFormat, this.options.persianDigits);
        if (this.options.rangeEnd) {
          const [ejy, ejm, ejd] = gregorianToJalali(this.options.rangeEnd.getFullYear(), this.options.rangeEnd.getMonth() + 1, this.options.rangeEnd.getDate());
          const endStr = formatDate(ejy, ejm, ejd, 0, 0, false, this.options.dateFormat, this.options.persianDigits);
          formatted = `${startStr} - ${endStr}`;
        } else {
          formatted = startStr;
        }
      }

      // Write output back to standard input elements if bound
      if (this.isInput) {
        this.inputElement.value = formatted;
        this.inputElement.dispatchEvent(new Event('change', { bubbles: true }));

        if (this.altInputElement) {
          const altFormatted = formatAltDate(
            this.selectedDate.year,
            this.selectedDate.month,
            this.selectedDate.day,
            gregorianDate.getDay(),
            this.selectedTime.hour,
            this.selectedTime.minute,
            this.options.showTime,
            this.options.altFormat,
            this.options.persianDigits
          );
          this.altInputElement.value = altFormatted;
          this.altInputElement.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }

      this.options.onDateSelect({
        value: formatted,
        altValue: this.altInputElement ? this.altInputElement.value : null,
        jalali: this.selectedDate,
        gregorian: { year: gy, month: gm, day: gd },
        time: this.selectedTime,
        date: gregorianDate,
        rangeStart: this.options.rangeStart,
        rangeEnd: this.options.rangeEnd,
        isDaySelect: isDaySelect
      });
    }

    /**
     * Gets the currently selected date as a native JavaScript Date object.
     * @returns {Date}
     */
    getSelectedDate() {
      const [gy, gm, gd] = jalaliToGregorian(this.selectedDate.year, this.selectedDate.month, this.selectedDate.day);
      return new Date(gy, gm - 1, gd, this.selectedTime.hour, this.selectedTime.minute);
    }

    /**
     * Updates calendar configuration options dynamically and redraws the grid.
     * @param {Object} newOptions 
     */
    setOptions(newOptions = {}) {
      this.options = { ...this.options, ...newOptions };
      if (newOptions.selectedDate === null) {
        const now = new Date();
        const [fjy, fjm, fjd] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
        this.selectedDate = { year: fjy, month: fjm, day: fjd };
      } else if (newOptions.selectedDate) {
        let initialDate = newOptions.selectedDate;
        if (initialDate instanceof Date && !isNaN(initialDate.getTime())) {
          if (this.options.useIranTimezone) {
            initialDate = adjustToIranTimezone(initialDate);
          }
          const [jy, jm, jd] = gregorianToJalali(initialDate.getFullYear(), initialDate.getMonth() + 1, initialDate.getDate());
          // Fallback must use Jalali date, not Gregorian
          let fbYear = jy, fbMonth = jm;
          if (jy <= 0 || jm <= 0) {
            const fbNow = new Date();
            const [fbJy, fbJm] = gregorianToJalali(fbNow.getFullYear(), fbNow.getMonth() + 1, fbNow.getDate());
            fbYear = fbJy;
            fbMonth = fbJm;
          }
          this.currentYear = jy > 0 ? jy : fbYear;
          this.currentMonth = jm > 0 ? jm : fbMonth;
          this.selectedDate = { year: jy, month: jm, day: jd };
          this.selectedTime = {
            hour: initialDate.getHours(),
            minute: initialDate.getMinutes()
          };
        }
      }
      this.updateCalendarView();
    }

    /**
     * Cleans up all event listeners and DOM elements created by this instance.
     */
    destroy() {
      if (this._onDocumentClick) document.removeEventListener('click', this._onDocumentClick);
      if (this._onWindowResize) window.removeEventListener('resize', this._onWindowResize);
      if (this._onWindowScroll) window.removeEventListener('scroll', this._onWindowScroll, true);
      if (this.popover) this.popover.remove();
      if (this.altInputElement) this.altInputElement.remove();
    }

    /**
     * Highlights days dynamically from rangeStart up to the hovered day.
     * @param {number} hoverDay 
     */
    handleDayHover(hoverDay) {
      if (!this.options.rangeStart || this.options.rangeEnd) return; // Highlight only if start is set but end is not

      const [hgy, hgm, hgd] = jalaliToGregorian(this.currentYear, this.currentMonth, hoverDay);
      const hoverDate = new Date(hgy, hgm - 1, hgd);

      const rStart = new Date(this.options.rangeStart.getFullYear(), this.options.rangeStart.getMonth(), this.options.rangeStart.getDate());
      if (hoverDate < rStart) return; // Do not highlight range in the past

      const dayElements = this.dom.daysContainer.querySelectorAll('.persian-calendar-day:not(.empty)');
      dayElements.forEach(el => {
        const elDay = safeParseInt(el.dataset.day, 0);
        const [egy, egm, egd] = jalaliToGregorian(this.currentYear, this.currentMonth, elDay);
        const elDate = new Date(egy, egm - 1, egd);

        // Reset temporary highlight styles
        el.classList.remove('in-range', 'range-end');

        if (elDate > rStart && elDate < hoverDate) {
          el.classList.add('in-range');
        } else if (elDate.getTime() === hoverDate.getTime()) {
          el.classList.add('range-end');
        }
      });
    }

    /**
     * Resets the temporary hover styles back to static ranges.
     */
    clearHoverRange() {
      if (!this.options.rangeStart || this.options.rangeEnd) return;

      const dayElements = this.dom.daysContainer.querySelectorAll('.persian-calendar-day:not(.empty)');
      dayElements.forEach(el => {
        el.classList.remove('in-range', 'range-end');
      });
    }
  }

  window.PersianDateConverter = {
    gregorianToJalali,
    jalaliToGregorian,
    isValidGregorian,
    isValidJalali,
    toPersianDigits,
    toAsciiDigits,
    padZero,
    getDaysInJalaliMonth,
    PERSIAN_MONTHS,
    PERSIAN_WEEKDAYS,
    PERSIAN_WEEKDAYS_LONG,
    PERSIAN_WEEKDAYS_SHORT: PERSIAN_WEEKDAYS
  };

  window.PersianCalendar = PersianCalendar;

  window.PersianCalendarIntegrations = {
    toPersianDigits: toPersianDigits,

    parseLocalDate: function(dateStr) {
        if (!dateStr) return null;
        if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
        
        const normalizedStr = toAsciiDigits(String(dateStr)).trim();
        if (!normalizedStr) return null;

        // Handle Unix timestamps (seconds 9-10 digits, or milliseconds 12-13 digits)
        // Prevent treating small numbers (like ID 1, 42, etc.) as timestamps
        if (/^\d{9,13}$/.test(normalizedStr)) {
            const num = parseInt(normalizedStr, 10);
            const d = num < 9999999999 ? new Date(num * 1000) : new Date(num);
            return isNaN(d.getTime()) ? null : d;
        }

        const parts = normalizedStr.split(/[-T \/:]/);
        if (parts.length >= 3) {
            let y, m, d;
            const p0 = parseInt(parts[0], 10);
            const p1 = parseInt(parts[1], 10);
            const p2 = parseInt(parts[2], 10);

            if (parts[0].length === 4 || p0 >= 1000) {
                // Format: YYYY-MM-DD or YYYY/MM/DD
                y = p0;
                m = p1;
                d = p2;
            } else if (parts[2].length === 4 || p2 >= 1000) {
                // Format: DD/MM/YYYY or MM/DD/YYYY or DD-MM-YYYY
                y = p2;
                m = p1;
                d = p0;
            } else if (p2 <= 99 && (p0 > 12 || p1 <= 12)) {
                // Format: DD/MM/YY (e.g. 16/05/05 -> day 16, month 05, year 1405)
                y = (p2 <= 50 ? 1400 : 1300) + p2;
                m = p1;
                d = p0;
            } else {
                y = p0;
                m = p1;
                d = p2;
            }

            const hh = parts.length > 3 ? parseInt(parts[3], 10) : 0;
            const mi = parts.length > 4 ? parseInt(parts[4], 10) : 0;
            const ss = parts.length > 5 ? parseInt(parts[5], 10) : 0;

            if (isNaN(y) || isNaN(m) || isNaN(d) || y <= 0 || m <= 0 || d <= 0) return null;

            // If it is a Jalali year (e.g. 1300 to 1500)
            if (y >= 1300 && y <= 1500) {
                const g = jalaliToGregorian(y, m, d);
                if (g && g[0] > 0) {
                    const gd = new Date(g[0], g[1] - 1, g[2], hh, mi, ss);
                    return isNaN(gd.getTime()) ? null : gd;
                }
                return null;
            }

            // 2-digit years (< 100)
            if (y < 100) {
                y = (y > 70 ? 1900 : 2000) + y;
            }

            // Otherwise assume Gregorian
            const gd = new Date(y, m - 1, d, hh, mi, ss);
            return isNaN(gd.getTime()) ? null : gd;
        }
        
        const d = new Date(normalizedStr);
        return isNaN(d.getTime()) ? null : d;
    },

    updateDisplayVal: function($visibleInput, dateVal, $altInput) {
        if (!dateVal) return;
        const d = window.PersianCalendarIntegrations.parseLocalDate(dateVal);
        if (!d) return;

        const showTime = $visibleInput.data('persian-show-time') || false;
        const rawVal = formatGregorianISO(d, showTime);
        $visibleInput.data('persian-gregorian-val', rawVal);

        if (!$altInput && $visibleInput && typeof $visibleInput.next === 'function') {
            $altInput = $visibleInput.next('input[type="hidden"]');
        }
        if ($altInput && $altInput.length) {
            $altInput.val(rawVal);
        }

        if (window.PersianDateConverter) {
            const jalali = window.PersianDateConverter.gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
            let displayVal = jalali[0] + '/' + padZero(jalali[1]) + '/' + padZero(jalali[2]);
            if (showTime) {
                displayVal += ' ' + padZero(d.getHours()) + ':' + padZero(d.getMinutes());
            }
            $visibleInput.val(window.PersianCalendarIntegrations.toPersianDigits(displayVal));
        }
    },

    overrideNativeValue: function(el, $) {
        if (!el) return;
        if ($(el).hasClass('persian-calendar-year-display') || 
            $(el).hasClass('persian-calendar-day-display') || 
            $(el).hasClass('persian-calendar-hour') || 
            $(el).hasClass('persian-calendar-minute') ||
            $(el).closest('.persian-calendar, .persian-calendar-container, .persca-calendar-modal-overlay').length) {
            return;
        }
        const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        Object.defineProperty(el, 'value', {
            get: function() {
                const gregVal = $(this).data('persian-gregorian-val');
                return (gregVal !== undefined && gregVal !== null && gregVal !== '') ? gregVal : descriptor.get.call(this);
            },
            set: function(val) {
                const valStr = String(val || '').trim();
                if (!valStr) {
                    $(this).data('persian-gregorian-val', '');
                    descriptor.set.call(this, '');
                    return;
                }
                const parsed = window.PersianCalendarIntegrations.parseLocalDate(valStr);
                if (parsed && !isNaN(parsed.getTime())) {
                    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(valStr) || /^\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(valStr) || /^\d{9,13}$/.test(valStr)) {
                        $(this).data('persian-gregorian-val', valStr);
                        window.PersianCalendarIntegrations.updateDisplayVal($(this), valStr);
                        return;
                    }
                }
                descriptor.set.call(this, val);
            },
            configurable: true,
            enumerable: true
        });
    },

    setupJalaliTimePicker: function($visibleInput, $altInput, $) {
        if ($visibleInput.data('persian-timepicker-init')) {
            return true;
        }
        $visibleInput.data('persian-timepicker-init', true);

        const isClone = $visibleInput.hasClass('persian-time-input');
        const originalVal = $visibleInput.val();

        if (!isClone) {
            const inputType = ($visibleInput.attr('type') || '').toLowerCase();
            if (inputType === 'time') {
                try {
                    $visibleInput[0].type = 'text';
                } catch (e) {
                    $visibleInput.attr('type', 'text');
                }
            }
        }

        if (!$altInput) {
            if (isClone) {
                $altInput = $visibleInput.next('input[type="hidden"]');
            } else {
                const nameAttr = $visibleInput.attr('name');
                if (nameAttr) {
                    $altInput = $('<input type="hidden">').attr('name', nameAttr).val(originalVal);
                    $visibleInput.removeAttr('name');
                    $visibleInput.after($altInput);
                }
            }
        }

        $visibleInput.attr('readonly', 'readonly');
        $visibleInput.css({ cursor: 'pointer' });
        $visibleInput.addClass('persian-time-input');

        function parseTime(val) {
            if (!val) return null;
            const s = toAsciiDigits(String(val)).trim();
            const m = s.match(/(\d{1,2})\s*:\s*(\d{1,2})/);
            if (!m) return null;
            let h = parseInt(m[1], 10);
            let mi = parseInt(m[2], 10);
            if (isNaN(h) || isNaN(mi)) return null;
            h = Math.max(0, Math.min(23, h));
            mi = Math.max(0, Math.min(59, mi));
            return { h: h, m: mi };
        }

        function safeInt(v, def, min, max) {
            let n = parseInt(v, 10);
            if (isNaN(n)) n = def;
            if (n < min) n = min;
            if (n > max) n = max;
            return n;
        }

        function setDisplay(h, mi) {
            const raw = padZero(h) + ':' + padZero(mi);
            $visibleInput.data('persian-time-val', raw);
            if ($altInput && $altInput.length) {
                $altInput.val(raw);
                if ($altInput[0]) {
                    $altInput[0].dispatchEvent(new Event('input', { bubbles: true }));
                    $altInput[0].dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
            $visibleInput.val(toPersianDigits(raw));
            if ($visibleInput[0]) {
                $visibleInput[0].dispatchEvent(new Event('input', { bubbles: true }));
                $visibleInput[0].dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        const initParsed = parseTime(($altInput && $altInput.length) ? $altInput.val() : originalVal);
        if (initParsed) {
            const raw = padZero(initParsed.h) + ':' + padZero(initParsed.m);
            $visibleInput.data('persian-time-val', raw);
            $visibleInput.val(toPersianDigits(raw));
        }

        function getCurrent() {
            const parsed = parseTime($visibleInput.data('persian-time-val'));
            if (parsed) return parsed;
            const now = new Date();
            return { h: now.getHours(), m: now.getMinutes() };
        }

        let $popup = $visibleInput.data('persian-time-popup');
        if (!$popup) {
            $popup = $('<div class="persian-calendar-popup persian-time-popup" style="display:none; position:absolute; z-index:999999; pointer-events:auto;"></div>');
            $popup.on('click mousedown mouseup pointerdown pointerup touchstart touchend', function(e) {
                e.stopPropagation();
            });
            // Render the picker as a body-level portal. Appending it inside an
            // Elementor/JetPopup container makes `position:absolute` use a transformed
            // modal ancestor as its containing block, while jQuery.offset() returns
            // document coordinates. Mixing those coordinate systems moves the picker
            // far above the field on scrolled pages and inside animated popups.
            $('body').append($popup);
            $visibleInput.data('persian-time-popup', $popup);
        }

        const eventNamespace = '.persianTimePopup_' + Math.random().toString(36).substr(2, 9);

        function positionPopup() {
            if (!$popup.is(':visible')) return;
            const offset = $visibleInput.offset();
            const inputHeight = $visibleInput.outerHeight();
            const popupHeight = $popup.outerHeight();
            const popupWidth = $popup.outerWidth();
            const windowHeight = $(window).height();
            const windowWidth = $(window).width();
            const scrollTop = $(window).scrollTop();
            const scrollLeft = $(window).scrollLeft();
            let top = offset.top + inputHeight + 5;
            let left = offset.left;
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
            // The popup is portalled to body, so these document coordinates can
            // be applied directly without subtracting a modal/container offset.
            $popup.css({ top: top + 'px', left: left + 'px' });
        }

        const scrollHandler = function() {
            if ($popup.is(':visible')) positionPopup();
        };

        const outsideClickHandler = function(e) {
            if (!$(e.target).closest($popup).length && !$(e.target).closest($visibleInput).length) {
                hidePopup();
            }
        };

        function renderPopup() {
            const cur = getCurrent();
            $popup.html(
                '<div class="persian-calendar-wrapper">' +
                  '<div class="persian-calendar-header">' +
                    '<h3 class="persian-calendar-title">انتخاب زمان</h3>' +
                    '<div class="persian-calendar-header-actions">' +
                      '<button type="button" class="persian-calendar-now-btn persian-time-now">اکنون</button>' +
                      '<button type="button" class="persian-calendar-close-btn persian-time-close" aria-label="بستن"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
                    '</div>' +
                  '</div>' +
                  '<div class="persian-time-display">' +
                    '<div class="persian-time-cell">' +
                      '<button type="button" class="persian-time-step" data-unit="hour" data-dir="1"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M18 15l-6-6-6 6"/></svg></button>' +
                      '<input type="text" inputmode="numeric" maxlength="2" class="persian-time-num persian-time-hour" />' +
                      '<button type="button" class="persian-time-step" data-unit="hour" data-dir="-1"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6"/></svg></button>' +
                      '<div class="persian-time-caption">ساعت</div>' +
                    '</div>' +
                    '<div class="persian-time-colon">:</div>' +
                    '<div class="persian-time-cell">' +
                      '<button type="button" class="persian-time-step" data-unit="minute" data-dir="1"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M18 15l-6-6-6 6"/></svg></button>' +
                      '<input type="text" inputmode="numeric" maxlength="2" class="persian-time-num persian-time-minute" />' +
                      '<button type="button" class="persian-time-step" data-unit="minute" data-dir="-1"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6"/></svg></button>' +
                      '<div class="persian-time-caption">دقیقه</div>' +
                    '</div>' +
                  '</div>' +
                '</div>'
            );
            $popup.find('.persian-time-hour').val(toPersianDigits(padZero(cur.h)));
            $popup.find('.persian-time-minute').val(toPersianDigits(padZero(cur.m)));
        }

        function commit() {
            const $h = $popup.find('.persian-time-hour');
            const $m = $popup.find('.persian-time-minute');
            const h = safeInt(toAsciiDigits($h.val()), 0, 0, 23);
            const mi = safeInt(toAsciiDigits($m.val()), 0, 0, 59);
            setDisplay(h, mi);
        }

        function showPopup() {
            if ($popup.is(':visible')) return;
            $('.persian-calendar-popup').not($popup).each(function() {
                const otherInput = $(this).data('persian-input-owner');
                if (otherInput && otherInput[0] && typeof otherInput[0].persianCalendarHide === 'function') {
                    otherInput[0].persianCalendarHide();
                } else {
                    $(this).hide();
                }
            });
            renderPopup();
            $popup.css({ display: 'block', visibility: 'hidden', top: 0, left: 0 });
            positionPopup();
            $popup.css({ visibility: 'visible' });
            $(window).on('resize' + eventNamespace, positionPopup);
            window.addEventListener('scroll', scrollHandler, true);
            $(document).on('click' + eventNamespace, outsideClickHandler);
        }

        function hidePopup() {
            if (!$popup.is(':visible')) return;
            $popup.hide();
            $(window).off('resize' + eventNamespace);
            window.removeEventListener('scroll', scrollHandler, true);
            $(document).off('click' + eventNamespace);
        }

        if ($visibleInput[0]) {
            $visibleInput[0].persianCalendarHide = hidePopup;
        }
        $popup.data('persian-input-owner', $visibleInput);

        $popup.on('click', '.persian-time-close', function(e) {
            e.stopPropagation();
            hidePopup();
        });

        $popup.on('click', '.persian-time-now', function(e) {
            e.stopPropagation();
            const now = new Date();
            setDisplay(now.getHours(), now.getMinutes());
            hidePopup();
        });

        $popup.on('click', '.persian-time-step', function(e) {
            e.stopPropagation();
            const unit = $(this).attr('data-unit');
            const dir = parseInt($(this).attr('data-dir'), 10);
            const cur = getCurrent();
            if (unit === 'hour') {
                cur.h = (cur.h + dir + 24) % 24;
            } else {
                cur.m = (cur.m + dir + 60) % 60;
            }
            setDisplay(cur.h, cur.m);
            $popup.find('.persian-time-hour').val(toPersianDigits(padZero(cur.h)));
            $popup.find('.persian-time-minute').val(toPersianDigits(padZero(cur.m)));
        });

        $popup.on('input', '.persian-time-num', function() {
            const $t = $(this);
            const isHour = $t.hasClass('persian-time-hour');
            const max = isHour ? 23 : 59;
            let ascii = toAsciiDigits($t.val()).replace(/[^0-9]/g, '');
            if (ascii.length > 2) ascii = ascii.slice(0, 2);
            let n = parseInt(ascii, 10);
            if (!isNaN(n) && n > max) {
                n = max;
                ascii = String(max);
            }
            $t.val(toPersianDigits(ascii));
            if (ascii !== '') {
                commit();
            }
            if (ascii.length === 2 && isHour) {
                $popup.find('.persian-time-minute').focus().select();
            }
        });

        $popup.on('keydown', '.persian-time-num', function(e) {
            const $t = $(this);
            const isHour = $t.hasClass('persian-time-hour');
            const cur = getCurrent();
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                const dir = (e.key === 'ArrowUp') ? 1 : -1;
                if (isHour) {
                    cur.h = (cur.h + dir + 24) % 24;
                } else {
                    cur.m = (cur.m + dir + 60) % 60;
                }
                setDisplay(cur.h, cur.m);
                $t.val(toPersianDigits(padZero(isHour ? cur.h : cur.m)));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                commit();
                hidePopup();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                hidePopup();
            }
        });

        $visibleInput.on('click focus', function(e) {
            e.stopPropagation();
            if ($popup.is(':visible')) {
                positionPopup();
                return;
            }
            showPopup();
        });

        if (typeof MutationObserver !== 'undefined') {
            const parentNode = $visibleInput.parent()[0];
            if (parentNode) {
                const observer = new MutationObserver(function() {
                    if ($visibleInput[0] && !document.contains($visibleInput[0])) {
                        hidePopup();
                        $popup.remove();
                        observer.disconnect();
                    }
                });
                observer.observe(parentNode, { childList: true, subtree: true });
            }
        }

        return true;
    },

    setupJalaliDatePicker: function($visibleInput, $altInput, showTime, $) {
        if (typeof window.PersianCalendar === 'undefined') return false;
        
        if ($visibleInput.data('persian-calendar-init')) {
            return true;
        }
        $visibleInput.data('persian-calendar-init', true);
        $visibleInput.data('persian-show-time', showTime);
        $visibleInput.attr('data-persian-show-time', showTime ? 'true' : 'false');

        const isClone = $visibleInput.hasClass('persian-calendar-input');

        const minAttr = $visibleInput.attr('min');
        const maxAttr = $visibleInput.attr('max');
        let minDate = null;
        let maxDate = null;

        if (minAttr) {
            if (minAttr === 'today' || minAttr === 'current' || minAttr === 'now') {
                minDate = 'today';
            } else {
                minDate = window.PersianCalendarIntegrations.parseLocalDate(minAttr);
            }
        }
        if (maxAttr) {
            if (maxAttr === 'today' || maxAttr === 'current' || maxAttr === 'now') {
                maxDate = 'today';
            } else {
                maxDate = window.PersianCalendarIntegrations.parseLocalDate(maxAttr);
            }
        }
        $visibleInput.data('persian-min-date', minDate);
        $visibleInput.data('persian-max-date', maxDate);

        if (!isClone) {
            const inputType = $visibleInput.attr('type');
            if (inputType === 'date' || inputType === 'datetime-local') {
                try {
                    $visibleInput[0].type = 'text';
                } catch (e) {
                    $visibleInput.attr('type', 'text');
                }
            }
        }

        const originalVal = $visibleInput.val();
        if (!$altInput) {
            if (isClone) {
                // For clones, the original script removed 'name' and placed a hidden input right after
                $altInput = $visibleInput.next('input[type="hidden"]');
            } else {
                const nameAttr = $visibleInput.attr('name');
                if (nameAttr) {
                    $altInput = $('<input type="hidden">').attr('name', nameAttr).val(originalVal);
                    $visibleInput.removeAttr('name');
                    $visibleInput.after($altInput);
                }
            }
        }

        $visibleInput.attr('readonly', 'readonly');
        $visibleInput.css({ cursor: 'pointer' });
        $visibleInput.addClass('persian-calendar-input');
        
        window.PersianCalendarIntegrations.overrideNativeValue($visibleInput[0], $);

        const initialVal = $altInput ? $altInput.val() : $visibleInput.val();
        if (initialVal) {
            if (/^\d{4}-\d{2}-\d{2}/.test(initialVal)) {
                $visibleInput.data('persian-gregorian-val', initialVal);
            }
            window.PersianCalendarIntegrations.updateDisplayVal($visibleInput, initialVal, $altInput);
        }

        let $popup = $visibleInput.data('persian-popup');
        if (!$popup) {
            $popup = $('<div class="persian-calendar-popup" style="display:none; position:absolute; z-index:999999; pointer-events:auto; background:#fff; box-shadow:0 4px 20px rgba(0,0,0,0.15); border:1px solid #edf2f7; border-radius:8px; padding:15px; width:280px;"></div>');
            $popup.on('click mousedown mouseup pointerdown pointerup touchstart touchend', function(e) {
                e.stopPropagation();
            });
            // Render the picker as a body-level portal. Appending it inside an
            // Elementor/JetPopup container makes `position:absolute` use a transformed
            // modal ancestor as its containing block, while jQuery.offset() returns
            // document coordinates. Mixing those coordinate systems moves the picker
            // far above the field on scrolled pages and inside animated popups.
            $('body').append($popup);
            $visibleInput.data('persian-popup', $popup);
        }

        const eventNamespace = '.persianCalendarPopup_' + Math.random().toString(36).substr(2, 9);

        const scrollHandler = function() {
            if ($popup.is(':visible')) {
                positionPopup();
            }
        };

        const outsideClickHandler = function(e) {
            if (!$(e.target).closest($popup).length && !$(e.target).closest($visibleInput).length) {
                hidePopup();
            }
        };

        function showPopup() {
            if ($popup.is(':visible')) return;

            // Close other popups cleanly
            $('.persian-calendar-popup').not($popup).each(function() {
                const otherInput = $(this).data('persian-input-owner');
                if (otherInput && otherInput[0] && typeof otherInput[0].persianCalendarHide === 'function') {
                    otherInput[0].persianCalendarHide();
                } else {
                    $(this).hide();
                }
            });

            $popup.css({ display: 'block', visibility: 'hidden', top: 0, left: 0 });
            positionPopup();
            $popup.css({ visibility: 'visible' });

            // Bind temporary window/document listeners
            $(window).on('resize' + eventNamespace, positionPopup);
            window.addEventListener('scroll', scrollHandler, true);
            $(document).on('click' + eventNamespace, outsideClickHandler);
        }

        function hidePopup() {
            if (!$popup.is(':visible')) return;

            $popup.hide();

            // Unbind temporary window/document listeners
            $(window).off('resize' + eventNamespace);
            window.removeEventListener('scroll', scrollHandler, true);
            $(document).off('click' + eventNamespace);
        }

        // Store reference for clean external hiding
        if ($visibleInput[0]) {
            $visibleInput[0].persianCalendarHide = hidePopup;
        }
        $popup.data('persian-input-owner', $visibleInput);

        $popup.on('click', '.persian-calendar-close-btn', function(e) {
            e.stopPropagation();
            hidePopup();
        });

        $popup.on('click', '.persian-calendar-now-btn', function(e) {
            e.stopPropagation();
            hidePopup();
        });

        function positionPopup() {
            if (!$popup.is(':visible')) return;
            const offset = $visibleInput.offset();
            const inputHeight = $visibleInput.outerHeight();
            const popupHeight = $popup.outerHeight();
            const popupWidth = $popup.outerWidth();
            const windowHeight = $(window).height();
            const windowWidth = $(window).width();
            const scrollTop = $(window).scrollTop();
            const scrollLeft = $(window).scrollLeft();

            let top = offset.top + inputHeight + 5;
            let left = offset.left;

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

            // The popup is portalled to body, so these document coordinates can
            // be applied directly without subtracting a modal/container offset.
            $popup.css({ top: top + 'px', left: left + 'px' });
        }

        $visibleInput.on('click focus', function(e) {
            e.stopPropagation();
            if ($popup.is(':visible')) {
                positionPopup();
                return;
            }

            const currentVal = $altInput ? $altInput.val() : $visibleInput.val();
            let parsedDate = new Date();
            if (currentVal) {
                const d = window.PersianCalendarIntegrations.parseLocalDate(currentVal);
                if (d) {
                    parsedDate = d;
                }
            }

            $popup.empty();
            const container = document.createElement('div');
            $popup.append(container);

            new window.PersianCalendar(container, {
                selectedDate: parsedDate,
                showTime: showTime,
                usePersianDigits: false,
                minDate: $visibleInput.data('persian-min-date'),
                maxDate: $visibleInput.data('persian-max-date'),
                onDateSelect: function(dateInfo) {
                    const rawVal = formatGregorianISO(dateInfo.date, showTime);
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

                    if (!showTime || dateInfo.isDaySelect) {
                        hidePopup();
                    }
                }
            });

            $popup.find('.persian-calendar-title').text('انتخاب تاریخ');
            showPopup();
        });

        if (typeof MutationObserver !== 'undefined') {
            const parentNode = $visibleInput.parent()[0];
            if (parentNode) {
                const observer = new MutationObserver(function(mutations) {
                    if ($visibleInput[0] && !document.contains($visibleInput[0])) {
                        hidePopup();
                        $popup.remove();
                        observer.disconnect();
                    }
                });
                observer.observe(parentNode, { childList: true, subtree: true });
            }
        }
        
        return true;
    }
  };
})();
