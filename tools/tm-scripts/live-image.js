// ==UserScript==
// @name         District Live Schedule Ad Generator
// @namespace    cwbreaks-tools
// @version      0.2
// @description  Generate promo image from future livestream schedule cards
// @match        https://midwestboxbreaks.net/live*
// @match        https://district.net/*/live*
// @grant        GM_addStyle
// ==/UserScript==

(function () {
  'use strict';

  const PANEL_ID = 'cw-schedule-ad-panel';
  const TOGGLE_ID = 'cw-schedule-ad-toggle';

  GM_addStyle(`
    #${TOGGLE_ID} {
      position: fixed;
      top: 90px;
      left: 0;
      z-index: 999999;
      background: #f5c542;
      color: #111;
      border: 0;
      border-radius: 0 8px 8px 0;
      padding: 12px 8px;
      cursor: pointer;
      font: 900 14px Arial, sans-serif;
      writing-mode: vertical-rl;
      text-orientation: mixed;
    }

    #${PANEL_ID} {
      position: fixed;
      top: 90px;
      left: 0;
      width: 280px;
      z-index: 999998;
      background: #111;
      color: #fff;
      border-radius: 0 12px 12px 0;
      box-shadow: 0 8px 24px rgba(0,0,0,.35);
      padding: 14px 14px 14px 39px;
      font: 14px Arial, sans-serif;
      transform: translateX(-325px);
      transition: transform .2s ease;
    }

    #${PANEL_ID}.open {
      transform: translateX(0);
    }

    #${PANEL_ID} h3 {
      margin: 0 0 12px;
      font-size: 16px;
    }

    #${PANEL_ID} label {
      display: block;
      margin: 10px 0 5px;
      font-size: 12px;
      color: #ccc;
    }

    #${PANEL_ID} select {
      width: 100%;
      box-sizing: border-box;
      border-radius: 8px;
      border: 1px solid #555;
      padding: 9px;
      font: 700 13px Arial, sans-serif;
      background: #fff;
      color: #111;
    }

    #${PANEL_ID} button {
      width: 100%;
      box-sizing: border-box;
      border-radius: 8px;
      border: 0;
      padding: 9px;
      font: 700 13px Arial, sans-serif;
      margin-top: 12px;
      background: #f5c542;
      color: #111;
      cursor: pointer;
    }

    #cw-schedule-status {
      margin-top: 10px;
      color: #bbb;
      font-size: 12px;
      line-height: 1.35;
    }
  `);

  function waitForCards() {
    const cards = getEventCards();
    if (cards.length) {
      initPanel();
      return;
    }
    setTimeout(waitForCards, 750);
  }

  function getEventCards() {
    return [...document.querySelectorAll('div.group.relative')]
      .filter(card => {
        const imgs = card.querySelectorAll('img');
        const text = cleanText(card.innerText);
        return imgs.length >= 2 &&
          !text.startsWith('Live ') &&
          /(Tomorrow|Today|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Jan|Feb|Mar|Apr|May|\d{1,2}:\d{2}\s?(am|pm))/i.test(text);
      });
  }

  function cleanText(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
  }

  function parseEvent(card) {
    const imgs = [...card.querySelectorAll('img')];

    const splash = imgs.find(img =>
      img.alt &&
      img.src &&
      !img.className.toString().includes('rounded-full')
    ) || imgs[0];

    const hostImg = imgs.find(img =>
      img !== splash &&
      img.src &&
      (
        img.className.toString().includes('rounded-full') ||
        img.src.includes('width=128')
      )
    ) || imgs[1];

    const text = cleanText(card.innerText);
    const splashAlt = cleanText(splash?.alt || '');
    const hostAlt = cleanText(hostImg?.alt || '');

    let dateTime = '';
    const dtMatch = text.match(/^((Today|Tomorrow|[A-Z][a-z]{2}\s+\d{1,2}),?\s+\d{1,2}:\d{2}\s?(am|pm))/i);
    if (dtMatch) dateTime = dtMatch[1];

    let title = splashAlt || 'Untitled Stream';
    let host = hostAlt || '';

    if (!host || host.toLowerCase() === 'livestream') {
      const withoutDate = cleanText(text.replace(dateTime, ''));
      title = splashAlt || withoutDate;
      host = hostAlt || '';
    }

    return {
      title,
      host,
      dateTime,
      dateKey: normalizeDateKey(dateTime),
      splashUrl: splash?.src,
      hostImgUrl: hostImg?.src
    };
  }

  function normalizeDateKey(dateTime) {
    const now = new Date();

    if (/^today/i.test(dateTime)) return formatDateKey(now);

    if (/^tomorrow/i.test(dateTime)) {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      return formatDateKey(d);
    }

    const m = dateTime.match(/^([A-Z][a-z]{2})\s+(\d{1,2})/);
    if (!m) return 'Unknown Date';

    const d = new Date(`${m[1]} ${m[2]}, ${now.getFullYear()}`);
    return formatDateKey(d);
  }

  function formatDateKey(d) {
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }

  function isThisWeek(event) {
    const d = dateFromKey(event.dateKey);
    if (!d) return false;
    const now = new Date();
    const end = new Date(now);
    end.setDate(now.getDate() + (7 - now.getDay()));
    end.setHours(23, 59, 59, 999);
    return d >= startOfDay(now) && d <= end;
  }

  function isNextWeek(event) {
    const d = dateFromKey(event.dateKey);
    if (!d) return false;

    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() + (7 - now.getDay()) + 1);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return d >= start && d <= end;
  }

  function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function dateFromKey(key) {
    if (!key || key === 'Unknown Date') return null;
    const now = new Date();
    const d = new Date(`${key.replace(/^[A-Z][a-z]{2},?\s*/, '')}, ${now.getFullYear()}`);
    return isNaN(d) ? null : d;
  }

  function getEvents() {
    return getEventCards()
      .map(parseEvent)
      .filter(e => e.splashUrl && e.title && e.dateTime);
  }

  function initPanel() {
    if (document.getElementById(PANEL_ID)) return;

    const toggle = document.createElement('button');
    toggle.id = TOGGLE_ID;
    toggle.textContent = 'Social Ad Maker';
    document.body.appendChild(toggle);

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <h3>Schedule Ad</h3>

      <label for="cw-schedule-filter">Streams</label>
      <select id="cw-schedule-filter"></select>

      <label for="cw-output-mode">Output</label>
      <select id="cw-output-mode">
        <option value="download">Download</option>
        <option value="copy">Copy</option>
      </select>

      <button id="cw-generate-ad">Generate Image</button>
      <button id="cw-refresh-events">Refresh Events</button>

      <div id="cw-schedule-status"></div>
    `;
    document.body.appendChild(panel);

    toggle.addEventListener('click', () => {
      panel.classList.toggle('open');
    });

    panel.querySelector('#cw-refresh-events').addEventListener('click', populateFilter);
    panel.querySelector('#cw-generate-ad').addEventListener('click', generateAd);

    populateFilter();

    const outputMode = panel.querySelector('#cw-output-mode');
    outputMode.value = localStorage.getItem('cwScheduleOutputMode') || 'download';
    outputMode.addEventListener('change', () => {
      localStorage.setItem('cwScheduleOutputMode', outputMode.value);
    });
  }

  function populateFilter() {
    const events = getEvents();
    const select = document.getElementById('cw-schedule-filter');
    const status = document.getElementById('cw-schedule-status');

    const dates = [...new Set(events.map(e => e.dateKey).filter(Boolean))];

    const thisWeekCount = events.filter(isThisWeek).length;
    const nextWeekCount = events.filter(isNextWeek).length;

    select.innerHTML = `
      <option value="all">All (${events.length})</option>
      <option value="this-week">This Week (${thisWeekCount})</option>
      <option value="next-week">Next Week (${nextWeekCount})</option>
      ${dates.map(d => {
        const count = events.filter(e => e.dateKey === d).length;
        return `<option value="date:${escapeHtml(d)}">${escapeHtml(d)} (${count})</option>`;
      }).join('')}
    `;

    status.textContent = `${events.length} stream(s) found.`;
  }

  function getFilteredEvents() {
    const filter = document.getElementById('cw-schedule-filter').value;
    const events = getEvents();

    if (filter === 'this-week') return events.filter(isThisWeek);
    if (filter === 'next-week') return events.filter(isNextWeek);

    if (filter.startsWith('date:')) {
      const date = filter.replace('date:', '');
      return events.filter(e => e.dateKey === date);
    }

    return events;
  }

  async function generateAd() {
    const events = getFilteredEvents();
    const status = document.getElementById('cw-schedule-status');

    if (!events.length) {
      status.textContent = 'No streams match that filter.';
      return;
    }

    status.textContent = 'Building image...';

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = 1080;
    canvas.height = 1350;

    drawBackground(ctx, canvas);
    drawHeader(ctx, canvas, events);

    const layout = getBestLayout(events.length);
    const gap = 24;
    const margin = 48;
    const headerH = 150;

    const cardW = (canvas.width - margin * 2 - gap * (layout.cols - 1)) / layout.cols;
    const cardH = (canvas.height - headerH - margin - gap * (layout.rows - 1)) / layout.rows;

    const imagePromises = events.map(async e => ({
      event: e,
      splash: await loadImage(e.splashUrl),
      hostImg: await loadImage(e.hostImgUrl).catch(() => null)
    }));

    const loaded = await Promise.all(imagePromises);

    loaded.forEach((item, i) => {
      const col = i % layout.cols;
      const row = Math.floor(i / layout.cols);

      const x = margin + col * (cardW + gap);
      const y = headerH + row * (cardH + gap);

      drawEventCard(ctx, item.event, item.splash, item.hostImg, x, y, cardW, cardH, events.length);
    });

    const mode = document.getElementById('cw-output-mode')?.value || 'download';

    try {
      if (mode === 'copy') {
        await copyCanvasToClipboard(canvas);
        status.textContent = `Copied ${events.length} stream(s) to clipboard.`;
      } else {
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = `livestream-schedule-${Date.now()}.png`;
        a.click();

        status.textContent = `Downloaded ${events.length} stream(s).`;
      }
    } catch (err) {
      console.error(err);
      status.textContent = `Copy failed. Try Download instead.`;
    }
  }

  function getBestLayout(count) {
    if (count <= 1) return { cols: 1, rows: 1 };
    if (count === 2) return { cols: 1, rows: 2 };
    if (count <= 4) return { cols: 2, rows: 2 };
    if (count <= 6) return { cols: 2, rows: 3 };
    if (count <= 9) return { cols: 3, rows: 3 };
    if (count <= 12) return { cols: 3, rows: 4 };
    return { cols: 4, rows: Math.ceil(count / 4) };
  }

    function getFilterDescription() {
  const filter = document.getElementById('cw-schedule-filter')?.value || 'all';

  if (filter === 'all') return '';

  if (filter === 'this-week') {
    return ' this week';
  }

  if (filter === 'next-week') {
    return ' next week';
  }

  if (filter.startsWith('date:')) {
    const dateText = filter.replace('date:', '');

    const parsed = new Date(dateText);
    if (!isNaN(parsed)) {
      const day = parsed.getDate();

      const suffix =
        day % 10 === 1 && day !== 11 ? 'st' :
        day % 10 === 2 && day !== 12 ? 'nd' :
        day % 10 === 3 && day !== 13 ? 'rd' :
        'th';

      return ` on ${parsed.toLocaleDateString(undefined, {
        month: 'long'
      })} ${day}${suffix}`;
    }

    return ` on ${dateText}`;
  }

  return '';
}

  function drawBackground(ctx, canvas) {
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#111827');
    grad.addColorStop(1, '#000000');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawHeader(ctx, canvas, events) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 42px Arial';
    ctx.fillText('Upcoming on https://midwestboxbreaks.net/live', 48, 72);

    ctx.fillStyle = '#f5c542';
    ctx.font = '700 30px Arial';
    const filterDesc = getFilterDescription();

      ctx.fillText(
          `${events.length} scheduled stream${events.length === 1 ? '' : 's'}${filterDesc}`,
          48,
          116
      );
  }

  function drawEventCard(ctx, event, splash, hostImg, x, y, w, h, count) {
    const radius = 22;
    const imgH = h * 0.62;

    roundedRect(ctx, x, y, w, h, radius, '#ffffff');

    ctx.save();
    roundedClip(ctx, x, y, w, imgH, radius);
    drawCoverImage(ctx, splash, x, y, w, imgH);
    ctx.restore();

    if (hostImg) {
      const avatar = Math.max(48, Math.min(76, h * 0.28));
      const ax = x + 18;
      const ay = y + imgH - avatar / 2 - 10;

      ctx.save();
      ctx.beginPath();
      ctx.arc(ax + avatar / 2, ay + avatar / 2, avatar / 2 + 5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(ax + avatar / 2, ay + avatar / 2, avatar / 2, 0, Math.PI * 2);
      ctx.clip();
      drawCoverImage(ctx, hostImg, ax, ay, avatar, avatar);
      ctx.restore();
    }

    const pad = 18;
    const textX = x + pad;
    const textY = y + imgH + 44;

    const titleSize = count <= 4 ? 28 : count <= 8 ? 22 : 18;
    const metaSize = count <= 4 ? 22 : count <= 8 ? 18 : 15;

    ctx.fillStyle = '#111827';
    ctx.font = `900 ${titleSize}px Arial`;
    wrapText(ctx, event.title, textX, textY, w - pad * 2, titleSize + 4, 2);

    ctx.fillStyle = '#4b5563';
    ctx.font = `700 ${metaSize}px Arial`;
    wrapText(ctx, `${event.dateTime} • ${event.host}`, textX, y + h - 26, w - pad * 2, metaSize + 4, 1);
  }

  function drawCoverImage(ctx, img, x, y, w, h) {
    const scale = Math.max(w / img.width, h / img.height);
    const sw = w / scale;
    const sh = h / scale;
    const sx = (img.width - sw) / 2;
    const sy = (img.height - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  function roundedRect(ctx, x, y, w, h, r, fill) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function roundedClip(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
    ctx.clip();
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const words = String(text || '').split(' ');
    let line = '';
    let lines = [];

    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }

    if (line) lines.push(line);

    lines = lines.slice(0, maxLines);
    if (lines.length === maxLines && words.length > 1) {
      while (ctx.measureText(lines[maxLines - 1] + '...').width > maxWidth) {
        lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1);
      }
      lines[maxLines - 1] += '...';
    }

    lines.forEach((lineText, i) => {
      ctx.fillText(lineText, x, y + i * lineHeight);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function copyCanvasToClipboard(canvas) {
    return new Promise((resolve, reject) => {
      if (!navigator.clipboard || !window.ClipboardItem) {
        reject(new Error('Clipboard image copy is not supported in this browser.'));
        return;
      }

      canvas.toBlob(async blob => {
        if (!blob) {
          reject(new Error('Could not create image blob.'));
          return;
        }

        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          resolve();
        } catch (err) {
          reject(err);
        }
      }, 'image/png');
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, s => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[s]));
  }

  waitForCards();
})();
