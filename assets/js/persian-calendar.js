/* global PersianCalendarSettings, wp */
(function () {
  'use strict';

  // Date Converter Functions (integrated from date-converter.js)
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
    if (!Number.isInteger(gy) || !Number.isInteger(gm) || !Number.isInteger(gd)) {
      return false;
    }
    if (gy < 1 || gy > 3000 || gm < 1 || gm > 12 || gd < 1 || gd > 31) {
      return false;
    }
    return true;
  };

  const gregorianToJalali = (gy, gm, gd) => {
    if (!isValidGregorian(gy, gm, gd)) {
      return [0, 0, 0];
    }

    const gy2 = gm > 2 ? gy : gy - 1;
    let days = JALALI_EPOCH_DIFFERENCE + (365 * gy2) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + G_DAYS_IN_MONTH_NON_LEAP[gm - 1];
    
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
    if (!Number.isInteger(jy) || !Number.isInteger(jm) || !Number.isInteger(jd)) {
      return false;
    }
    if (jy < 1 || jy > 3000 || jm < 1 || jm > 12 || jd < 1 || jd > 31) {
      return false;
    }
    return true;
  };

  const jalaliToGregorian = (jy, jm, jd) => {
    if (!isValidJalali(jy, jm, jd)) {
      return [0, 0, 0];
    }

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

  // Utility functions
  const safeParseInt = (value, defaultValue = 0, min = null, max = null) => {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) return defaultValue;
    if (min !== null && parsed < min) return min;
    if (max !== null && parsed > max) return max;
    return parsed;
  };

  const isValidJalaliDate = (year, month, day) => {
    return year >= 1 && year <= 3000 && month >= 1 && month <= 12 && day >= 1 && day <= 31;
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

  class PersianCalendar {
    constructor(container, options = {}) {
      if (!container || !(container instanceof Element)) {
        throw new Error('PersianCalendar: Invalid container element');
      }
      this.container = container;
      this.options = {
        selectedDate: (options.selectedDate instanceof Date) ? options.selectedDate : new Date(),
        onDateSelect: (typeof options.onDateSelect === 'function') ? options.onDateSelect : () => {},
        showTime: (typeof options.showTime === 'boolean') ? options.showTime : true,
        ...options
      };
      
      const initialDate = this.options.selectedDate;
      const [jy, jm, jd] = gregorianToJalali(initialDate.getFullYear(), initialDate.getMonth() + 1, initialDate.getDate());
      this.currentYear = jy;
      this.currentMonth = jm;
      this.selectedDate = { year: jy, month: jm, day: jd };
      this.selectedTime = { 
        hour: initialDate.getHours(), 
        minute: initialDate.getMinutes(), 
        ampm: initialDate.getHours() < 12 ? 'ق.ظ' : 'ب.ظ' 
      };
      
      this.render();
      this.attachEventListeners();
    }

    render() {
      this.container.textContent = '';
      const wrapper = this.createCalendarElement();
      this.container.appendChild(wrapper);
      this.cacheDOMElements();
      this.updateCalendarView();
    }

    cacheDOMElements() {
      this.dom = {
        monthSelect: this.container.querySelector('.persian-calendar-month'),
        dayInput: this.container.querySelector('.persian-calendar-day-display'),
        yearInput: this.container.querySelector('.persian-calendar-year-display'),
        currentMonthText: this.container.querySelector('.persian-calendar-current-month'),
        daysContainer: this.container.querySelector('.persian-calendar-days'),
        hourInput: this.container.querySelector('.persian-calendar-hour'),
        minuteInput: this.container.querySelector('.persian-calendar-minute')
      };
    }

    createCalendarElement() {
      const wrapper = document.createElement('div');
      wrapper.className = 'persian-calendar-wrapper';
      
      // Header
      const header = document.createElement('div');
      header.className = 'persian-calendar-header';
      header.innerHTML = '<h3 class="persian-calendar-title">انتشار</h3><button class="persian-calendar-now-btn" type="button">اکنون</button>';
      wrapper.appendChild(header);
      
      // Time picker
      if (this.options.showTime) {
        wrapper.appendChild(this.createTimePickerElement());
      }
      
      // Date picker
      wrapper.appendChild(this.createDatePickerElement());
      
      return wrapper;
    }
    
    createTimePickerElement() {
      const hour12 = this.selectedTime.hour > 12 ? this.selectedTime.hour - 12 : (this.selectedTime.hour === 0 ? 12 : this.selectedTime.hour);
      
      const fragment = document.createDocumentFragment();
      const timeTitle = document.createElement('div');
      timeTitle.className = 'persian-calendar-time-title';
      timeTitle.textContent = 'زمان';
      
      const timeContainer = document.createElement('div');
      timeContainer.className = 'persian-calendar-time';
      timeContainer.innerHTML = `
        <div class="persian-calendar-time-inputs">
          <input type="number" class="persian-calendar-hour" min="1" max="12" value="${hour12}">
          <span>:</span>
          <input type="number" class="persian-calendar-minute" min="0" max="59" value="${this.selectedTime.minute.toString().padStart(2, '0')}">
        </div>
        <div class="persian-calendar-ampm">
          <button class="persian-calendar-ampm-btn${this.selectedTime.ampm === 'ق.ظ' ? ' active' : ''}" data-ampm="ق.ظ" type="button">ق.ظ</button>
          <button class="persian-calendar-ampm-btn${this.selectedTime.ampm === 'ب.ظ' ? ' active' : ''}" data-ampm="ب.ظ" type="button">ب.ظ</button>
        </div>
      `;
      
      fragment.appendChild(timeTitle);
      fragment.appendChild(timeContainer);
      return fragment;
    }
    
    createDatePickerElement() {
      const datePicker = document.createElement('div');
      datePicker.className = 'persian-calendar-date-picker';
      
      const dateTitle = document.createElement('div');
      dateTitle.className = 'persian-calendar-date-title';
      dateTitle.textContent = 'تاریخ';
      
      // Month/Year inputs
      const monthYear = document.createElement('div');
      monthYear.className = 'persian-calendar-month-year';
      monthYear.innerHTML = `
        <input type="text" class="persian-calendar-day-display" value="${toPersianDigits(this.selectedDate.day)}" maxlength="2">
        <select class="persian-calendar-month">
          ${PERSIAN_MONTHS.map((month, index) => 
            `<option value="${index + 1}"${(index + 1) === this.currentMonth ? ' selected' : ''}>${month}</option>`
          ).join('')}
        </select>
        <input type="text" class="persian-calendar-year-display" value="${toPersianDigits(this.currentYear)}" maxlength="4">
      `;
      
      // Navigation
      const nav = document.createElement('div');
      nav.className = 'persian-calendar-nav';
      nav.innerHTML = `
        <button class="persian-calendar-prev" type="button">‹</button>
        <span class="persian-calendar-current-month">${PERSIAN_MONTHS[this.currentMonth - 1]} ${toPersianDigits(this.currentYear)}</span>
        <button class="persian-calendar-next" type="button">›</button>
      `;
      
      // Calendar grid
      const grid = document.createElement('div');
      grid.className = 'persian-calendar-grid';
      grid.innerHTML = `
        <div class="persian-calendar-weekdays">
          ${PERSIAN_WEEKDAYS.map(day => `<div class="persian-calendar-weekday">${day}</div>`).join('')}
        </div>
        <div class="persian-calendar-days"></div>
      `;
      
      datePicker.appendChild(dateTitle);
      datePicker.appendChild(monthYear);
      datePicker.appendChild(nav);
      datePicker.appendChild(grid);
      
      return datePicker;
    }

    createDaysFragment() {
      const daysInMonth = getDaysInJalaliMonth(this.currentYear, this.currentMonth);
      const [gy, gm, gd] = jalaliToGregorian(this.currentYear, this.currentMonth, 1);
      const startDay = (new Date(gy, gm - 1, gd).getDay() + 1) % 7;
      
      const today = new Date();
      const [todayJy, todayJm, todayJd] = gregorianToJalali(today.getFullYear(), today.getMonth() + 1, today.getDate());
      const isTodayMonth = (this.currentMonth === todayJm && this.currentYear === todayJy);
      const isSelectedMonth = (this.currentMonth === this.selectedDate.month && this.currentYear === this.selectedDate.year);
      
      const fragment = document.createDocumentFragment();
      
      // Empty days
      for (let i = 0; i < startDay; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'persian-calendar-day empty';
        fragment.appendChild(emptyDay);
      }
      
      // Month days
      for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'persian-calendar-day';
        dayElement.setAttribute('data-day', day.toString());
        dayElement.textContent = toPersianDigits(day);
        
        if (isTodayMonth && day === todayJd) dayElement.classList.add('today');
        if (isSelectedMonth && day === this.selectedDate.day) dayElement.classList.add('selected');
        
        fragment.appendChild(dayElement);
      }
      
      return fragment;
    }

    attachEventListeners() {
      this.container.addEventListener('click', (e) => {
        const target = e.target;
        if (target.matches('.persian-calendar-day:not(.empty)')) {
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
        } else if (target.matches('.persian-calendar-ampm-btn')) {
          this.selectedTime.ampm = target.dataset.ampm;
          let hour = this.selectedTime.hour;
          if (target.dataset.ampm === 'ب.ظ' && hour < 12) hour += 12;
          if (target.dataset.ampm === 'ق.ظ' && hour >= 12) hour -= 12;
          this.selectedTime.hour = hour;
          this.updateTimeDisplay();
          this.notifyDateChange();
        }
      });

      if (this.dom.monthSelect) {
        this.dom.monthSelect.addEventListener('change', (e) => {
          const month = safeParseInt(e.target.value, 1, 1, 12);
          if (isValidJalaliDate(this.currentYear, month, this.selectedDate.day)) {
            this.currentMonth = month;
            this.updateCalendarView();
          }
        });
      }

      // Input handlers
      const setupInput = (input, onChange) => {
        input.addEventListener('change', onChange);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            onChange({ target: input, key: e.key });
          }
        });
      };

      if (this.dom.dayInput) {
        setupInput(this.dom.dayInput, (e) => {
          const day = safeParseInt(toAsciiDigits(e.target.value), 1, 1, 31);
          const daysInMonth = getDaysInJalaliMonth(this.currentYear, this.currentMonth);
          if (day <= daysInMonth && isValidJalaliDate(this.currentYear, this.currentMonth, day)) {
            this.selectedDate.day = day;
            this.updateCalendarView();
            this.notifyDateChange();
          } else {
            e.target.value = toPersianDigits(this.selectedDate.day);
          }
        });
      }

      if (this.dom.yearInput) {
        setupInput(this.dom.yearInput, (e) => {
          const year = safeParseInt(toAsciiDigits(e.target.value), 1400, 1, 3000);
          if (isValidJalaliDate(year, this.currentMonth, this.selectedDate.day)) {
            this.currentYear = year;
            this.updateCalendarView();
          } else {
            e.target.value = toPersianDigits(this.currentYear);
          }
        });
      }

      if (this.options.showTime && this.dom.hourInput && this.dom.minuteInput) {
        setupInput(this.dom.hourInput, (e) => {
          const hour = safeParseInt(e.target.value, 1, 1, 12);
          let actualHour = hour;
          if (this.selectedTime.ampm === 'ب.ظ' && hour !== 12) actualHour += 12;
          if (this.selectedTime.ampm === 'ق.ظ' && hour === 12) actualHour = 0;
          this.selectedTime.hour = actualHour;
          this.notifyDateChange();
        });

        setupInput(this.dom.minuteInput, (e) => {
          const minute = safeParseInt(e.target.value, 0, 0, 59);
          this.selectedTime.minute = minute;
          this.notifyDateChange();
        });
      }
    }

    selectDate(year, month, day) {
      this.selectedDate = { year, month, day };
      this.updateCalendarView();
      this.notifyDateChange();
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
      const now = new Date();
      const [jy, jm, jd] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
      
      this.currentYear = jy;
      this.currentMonth = jm;
      this.selectedDate = { year: jy, month: jm, day: jd };
      this.selectedTime = { 
        hour: now.getHours(), 
        minute: now.getMinutes(), 
        ampm: now.getHours() < 12 ? 'ق.ظ' : 'ب.ظ' 
      };
      
      this.updateCalendarView();
      this.updateTimeDisplay();
      this.notifyDateChange();
    }

    updateCalendarView() {
      if (this.dom.monthSelect) this.dom.monthSelect.value = this.currentMonth;
      if (this.dom.dayInput) this.dom.dayInput.value = toPersianDigits(this.selectedDate.day);
      if (this.dom.yearInput) this.dom.yearInput.value = toPersianDigits(this.currentYear);
      if (this.dom.currentMonthText) this.dom.currentMonthText.textContent = `${PERSIAN_MONTHS[this.currentMonth - 1]} ${toPersianDigits(this.currentYear)}`;
      
      if (this.dom.daysContainer) {
        this.dom.daysContainer.textContent = '';
        this.dom.daysContainer.appendChild(this.createDaysFragment());
      }
    }

    updateTimeDisplay() {
      if (!this.options.showTime) return;
      
      const hour12 = this.selectedTime.hour > 12 ? this.selectedTime.hour - 12 : (this.selectedTime.hour === 0 ? 12 : this.selectedTime.hour);
      this.container.querySelector('.persian-calendar-hour').value = hour12;
      this.container.querySelector('.persian-calendar-minute').value = this.selectedTime.minute.toString().padStart(2, '0');
      
      this.container.querySelectorAll('.persian-calendar-ampm-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.ampm === this.selectedTime.ampm);
      });
    }

    notifyDateChange() {
      const [gy, gm, gd] = jalaliToGregorian(this.selectedDate.year, this.selectedDate.month, this.selectedDate.day);
      const gregorianDate = new Date(gy, gm - 1, gd, this.selectedTime.hour, this.selectedTime.minute);
      
      this.options.onDateSelect({
        jalali: this.selectedDate,
        gregorian: { year: gy, month: gm, day: gd },
        time: this.selectedTime,
        date: gregorianDate
      });
    }

    getSelectedDate() {
      const [gy, gm, gd] = jalaliToGregorian(this.selectedDate.year, this.selectedDate.month, this.selectedDate.day);
      return new Date(gy, gm - 1, gd, this.selectedTime.hour, this.selectedTime.minute);
    }
  }

  // Export PersianDateConverter for compatibility
  window.PersianDateConverter = {
    gregorianToJalali,
    jalaliToGregorian,
    isValidGregorian,
    isValidJalali
  };

  window.PersianCalendar = PersianCalendar;
})();
