/* global wp, PersianCalendar */
(function () {
  'use strict';

  const PERSIAN_DIGITS_MAP = { '0': '۰', '1': '۱', '2': '۲', '3': '۳', '4': '۴', '5': '۵', '6': '۶', '7': '۷', '8': '۸', '9': '۹' };
  const JALALI_MONTH_NAMES = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  const SELECTORS_TO_CONVERT = [
    '.edit-post-post-schedule__text',
    '.components-datetime__time',
    '.components-datetime__date',
    '.block-editor-post-schedule',
    '.editor-post-schedule',
    '.editor-post-schedule__dialog-toggle',
    '.components-datetime-picker',
    '.block-editor-publish-date-time-picker'
  ];

  const toPersianDigits = (str) => {
    if (str === null || str === undefined) return '';
    return str.toString().replace(/[0-9]/g, (digit) => PERSIAN_DIGITS_MAP[digit]);
  };

  const isGutenbergEditor = () => {
    return document.body.classList.contains('block-editor-page') ||
      document.querySelector('.block-editor') !== null ||
      (window.wp && wp.data && wp.data.select('core/editor'));
  };

  const parseWpDatetimeString = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    let d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;

    // Apply Iran timezone offset (+3:30 = 210 minutes)
    const iranOffsetMinutes = 210;
    const browserOffsetMinutes = -d.getTimezoneOffset();
    const diffMinutes = iranOffsetMinutes - browserOffsetMinutes;
    d = new Date(d.getTime() + diffMinutes * 60 * 1000);

    return {
      y: d.getFullYear(),
      m: d.getMonth() + 1,
      d: d.getDate(),
      hh: d.getHours(),
      mi: d.getMinutes()
    };
  };

  const replaceDatePicker = (pickerNode) => {
    if (pickerNode.dataset.persianReplaced) return;
    pickerNode.dataset.persianReplaced = 'true';
    pickerNode.style.display = 'none';

    const persianContainer = document.createElement('div');
    persianContainer.className = 'persian-calendar-container';
    pickerNode.parentNode.insertBefore(persianContainer, pickerNode.nextSibling);

    let currentDate = new Date();
    if (window.wp && wp.data) {
      const dateStr = wp.data.select('core/editor').getEditedPostAttribute('date');
      if (dateStr) currentDate = new Date(dateStr);
    }

    new PersianCalendar(persianContainer, {
      selectedDate: currentDate,
      showTime: true,
      onDateSelect: (dateInfo) => {
        if (window.wp && wp.data) {
          wp.data.dispatch('core/editor').editPost({ date: dateInfo.date.toISOString() });
        }
      }
    });
  };

  const updateScheduleButton = (button) => {
    if (!window.wp || !wp.data || !window.PersianDateConverter) return;
    const dateStr = wp.data.select('core/editor').getEditedPostAttribute('date');
    const dateParts = parseWpDatetimeString(dateStr);
    if (!dateParts) return;

    const [jy, jm, jd] = window.PersianDateConverter.gregorianToJalali(dateParts.y, dateParts.m, dateParts.d);
    const persianMonth = JALALI_MONTH_NAMES[jm - 1] || jm;
    const hours = dateParts.hh.toString().padStart(2, '0');
    const minutes = dateParts.mi.toString().padStart(2, '0');

    const newText = `${jd} ${persianMonth} ${jy} ${hours}:${minutes}`;
    const persianText = toPersianDigits(newText);

    if (button.textContent.trim() !== persianText) {
      button.textContent = persianText;
      button.setAttribute('aria-label', toPersianDigits(`تغییر تاریخ: ${newText}`));
    }
  };

  const convertElementDigits = (el) => {
    if (!el || el.dataset.persianDigits) return;
    el.dataset.persianDigits = 'true';

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while (node = walker.nextNode()) {
      if (node.nodeValue && /[0-9]/.test(node.nodeValue)) {
        node.nodeValue = toPersianDigits(node.nodeValue);
      }
    }

    const inputs = el.querySelectorAll('input[type="number"], input[type="text"]');
    inputs.forEach(input => {
      if (input.value && /[0-9]/.test(input.value)) {
        input.value = toPersianDigits(input.value);
      }
    });

    setTimeout(() => delete el.dataset.persianDigits, 100);
  };

  const addJalaliHint = (scheduleEl) => {
    if (!window.wp || !wp.data || !window.PersianDateConverter) return;
    const dateStr = wp.data.select('core/editor').getEditedPostAttribute('date');
    const dateParts = parseWpDatetimeString(dateStr);
    if (!dateParts) return;

    const [jy, jm, jd] = window.PersianDateConverter.gregorianToJalali(dateParts.y, dateParts.m, dateParts.d);
    const faHint = `${jd} ${JALALI_MONTH_NAMES[jm - 1]} ${jy}`;

    let hintEl = scheduleEl.querySelector('.persian-calendar-schedule');
    if (!hintEl) {
      hintEl = document.createElement('span');
      hintEl.className = 'persian-calendar-schedule';
      hintEl.dir = 'rtl';
      hintEl.style.cssText = 'margin-inline-start: 0.5em; opacity: 0.85; font-size: 12px; color: #757575;';
      scheduleEl.appendChild(hintEl);
    }
    hintEl.textContent = `(${toPersianDigits(faHint)})`;
  };

  const initUnifiedObserver = () => {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const processNode = (node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;

          if (node.matches('.components-datetime-picker, .block-editor-publish-date-time-picker')) {
            replaceDatePicker(node);
          }
          node.querySelectorAll('.components-datetime-picker, .block-editor-publish-date-time-picker').forEach(replaceDatePicker);

          if (node.matches('.editor-post-schedule__dialog-toggle')) {
            updateScheduleButton(node);
          }
          node.querySelectorAll('.editor-post-schedule__dialog-toggle').forEach(updateScheduleButton);

          if (node.matches('.edit-post-post-schedule__text')) {
            addJalaliHint(node);
          }
          node.querySelectorAll('.edit-post-post-schedule__text').forEach(addJalaliHint);

          SELECTORS_TO_CONVERT.forEach(selector => {
            if (node.matches(selector)) {
              convertElementDigits(node);
            }
            node.querySelectorAll(selector).forEach(convertElementDigits);
          });
        };

        mutation.addedNodes.forEach(processNode);

        if (mutation.type === 'attributes' || mutation.type === 'characterData') {
          processNode(mutation.target);
        }
      }
    });

    const targetNode = document.body;
    observer.observe(targetNode, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
      attributeFilter: ['value', 'aria-label']
    });
  };

  const initGutenbergIntegration = () => {
    if (!isGutenbergEditor()) return;

    const waitForDeps = () => {
      if (window.wp && wp.data && wp.data.select('core/editor') && window.PersianCalendar && window.PersianDateConverter) {
        document.querySelectorAll(SELECTORS_TO_CONVERT.join(', ')).forEach(el => {
          if (el.matches('.components-datetime-picker, .block-editor-publish-date-time-picker')) replaceDatePicker(el);
          if (el.matches('.editor-post-schedule__dialog-toggle')) updateScheduleButton(el);
          if (el.matches('.edit-post-post-schedule__text')) addJalaliHint(el);
          convertElementDigits(el);
        });

        initUnifiedObserver();
      } else {
        setTimeout(waitForDeps, 100);
      }
    };

    waitForDeps();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGutenbergIntegration);
  } else {
    initGutenbergIntegration();
  }

})();