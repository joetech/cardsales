// ==UserScript==
// @name         MBB Variant Price Panel
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Shows a collapsible panel with in-stock variants and prices, with % off discounting and click-through to the original selector.
// @author       Joe Colburn
// @match        https://midwestboxbreaks.net/product/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

// DISCLAIMER:
// This was created with Claude. I am not responsible for anything that happens as a result of your use.
// https://github.com/joetech/cardsales/edit/main/tools/tm-scripts/spots-left.js

(function () {
  'use strict';

  // ─── Constants ───────────────────────────────────────────────────────────────
  const PANEL_ID = 'mbb-variant-panel';
  const STORAGE_KEY_COLLAPSED = 'mbb-panel-collapsed';
  const STORAGE_KEY_DISCOUNT = 'mbb-panel-discount';

  // ─── Pull variant data from Next.js page data ─────────────────────────────
  function getVariants() {
    try {
      const raw = document.getElementById('__NEXT_DATA__')?.textContent;
      if (!raw) return [];
      const json = JSON.parse(raw);
      const variants = json?.props?.pageProps?.ssr?.product?.productVariants ?? [];
      return variants
        .filter(v => v.state === 'ACTIVE' && v.quantity > 0)
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) {
      console.error('[MBB Panel] Failed to parse variant data:', e);
      return [];
    }
  }

  // ─── Find the dropdown <ul> that holds the variant buttons ───────────────
  function getDropdownList() {
    return document.querySelector('ul.export-csv-dropdown');
  }

  // ─── Find the button inside the dropdown list matching a team name ────────
  function findDropdownButton(teamName) {
    const list = getDropdownList();
    if (!list) return null;
    const buttons = list.querySelectorAll('li button');
    for (const btn of buttons) {
      const span = btn.querySelector('span.truncate.text-light-text-primary');
      if (span && span.textContent.trim() === teamName) return btn;
    }
    return null;
  }

  // ─── Open the dropdown by clicking the trigger button ─────────────────────
  // The trigger is the rounded-full border button that shows the current selection.
  function getDropdownTrigger() {
    // There are two (mobile + desktop). We want whichever is visible.
    const triggers = document.querySelectorAll(
      'button.flex.flex-1.w-full.justify-between.items-center.rounded-full'
    );
    for (const t of triggers) {
      if (t.offsetParent !== null) return t; // visible one
    }
    return triggers[0] ?? null;
  }

  function ensureDropdownOpen() {
    const list = getDropdownList();
    // If list is already visible and has children, we're good.
    if (list && list.children.length > 0) return Promise.resolve();
    // Click the trigger to open it.
    const trigger = getDropdownTrigger();
    if (!trigger) return Promise.reject('No trigger found');
    trigger.click();
    // Wait briefly for the dropdown to render.
    return new Promise(resolve => setTimeout(resolve, 120));
  }

  // ─── Simulate selecting a variant ────────────────────────────────────────
  async function selectVariant(teamName) {
    try {
      await ensureDropdownOpen();
      const btn = findDropdownButton(teamName);
      if (btn) {
        btn.click();
      } else {
        console.warn('[MBB Panel] Could not find dropdown button for:', teamName);
      }
    } catch (e) {
      console.error('[MBB Panel] Error selecting variant:', e);
    }
  }

  // ─── Find the main product image URL ──────────────────────────────────────
  function getProductImageUrl() {
    try {
      const raw = document.getElementById('__NEXT_DATA__')?.textContent;
      if (!raw) return null;
      const json = JSON.parse(raw);
      const medias = json?.props?.pageProps?.ssr?.product?.productMedias ?? [];
      return medias[0]?.mediaUrl ?? null;
    } catch (e) {
      console.error('[MBB Panel] Failed to get product image:', e);
      return null;
    }
  }

  // ─── Load an image, trying CORS first, falling back to no-CORS ───────────
  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Image failed to load'));
      img.src = url;
    });
  }

  // ─── Draw the export image onto a canvas ──────────────────────────────────
  // Returns a Promise<HTMLCanvasElement>
  async function buildExportCanvas(variants, discount, discountedPriceFn, formatPriceFn) {
    const SIZE = 1080;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');

    // Background: try to draw the product image (cover-fit, square).
    const imgUrl = getProductImageUrl();
    let imageDrawn = false;
    if (imgUrl) {
      try {
        const img = await loadImage(imgUrl);
        // Cover-fit square crop.
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE);
        imageDrawn = true;
      } catch (e) {
        console.warn('[MBB Panel] Could not load product image for export, using fallback background:', e);
      }
    }
    if (!imageDrawn) {
      ctx.fillStyle = '#222';
      ctx.fillRect(0, 0, SIZE, SIZE);
    }

    // Bottom 80% dark overlay (50% opaque black) for list legibility.
    const listTop = SIZE * 0.20;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, listTop, SIZE, SIZE - listTop);

    // Render list text.
    const padding = 50;
    const innerWidth = SIZE - padding * 2;
    const rowCount = variants.length;
    const availableHeight = (SIZE - listTop) - padding * 2;
    const rowHeight = Math.min(64, availableHeight / Math.max(rowCount, 1));
    const fontSize = Math.max(18, Math.min(30, rowHeight * 0.42));

    ctx.textBaseline = 'middle';

    variants.forEach((v, i) => {
      const finalPrice = discountedPriceFn(v.price, discount);
      const y = listTop + padding + rowHeight * i + rowHeight / 2;

      // Team name (left aligned)
      ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.fillText(v.name, padding, y, innerWidth * 0.6);

      // Price (right aligned)
      ctx.font = `700 ${fontSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'right';
      ctx.fillText(formatPriceFn(finalPrice), padding + innerWidth, y);

      // Thin separator line (except after last row)
      if (i < rowCount - 1) {
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, y + rowHeight / 2);
        ctx.lineTo(padding + innerWidth, y + rowHeight / 2);
        ctx.stroke();
      }
    });

    return canvas;
  }

  function canvasToBlob(canvas) {
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  }

  // ─── Build the panel ──────────────────────────────────────────────────────
  function buildPanel(variants) {
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    Object.assign(panel.style, {
      position: 'fixed',
      top: '80px',
      left: '12px',
      zIndex: '99999',
      width: '260px',
      background: '#fff',
      border: '1px solid #e2e2e2',
      borderRadius: '14px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.13)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '13px',
      color: '#111',
      overflow: 'hidden',
    });

    // ── Header ──
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 12px',
      background: '#f5f5f5',
      borderBottom: '1px solid #e2e2e2',
      cursor: 'pointer',
      userSelect: 'none',
    });

    const title = document.createElement('span');
    title.textContent = 'Variants';
    Object.assign(title.style, { fontWeight: '700', fontSize: '13px' });

    const collapseBtn = document.createElement('span');
    collapseBtn.style.fontSize = '11px';
    collapseBtn.style.color = '#666';

    header.appendChild(title);
    header.appendChild(collapseBtn);
    panel.appendChild(header);

    // ── Body ──
    const body = document.createElement('div');
    body.id = PANEL_ID + '-body';
    Object.assign(body.style, { padding: '10px 12px' });

    // % Off input row
    const discountRow = document.createElement('div');
    Object.assign(discountRow.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      marginBottom: '10px',
    });

    const discountLabel = document.createElement('label');
    discountLabel.textContent = '% Off:';
    discountLabel.style.fontWeight = '600';
    discountLabel.style.whiteSpace = 'nowrap';

    const discountInput = document.createElement('input');
    discountInput.type = 'number';
    discountInput.min = '0';
    discountInput.max = '99';
    discountInput.placeholder = '0';
    discountInput.value = localStorage.getItem(STORAGE_KEY_DISCOUNT) ?? '';
    Object.assign(discountInput.style, {
      width: '60px',
      padding: '4px 6px',
      border: '1px solid #ccc',
      borderRadius: '8px',
      fontSize: '13px',
      outline: 'none',
    });

    const clearBtn = document.createElement('button');
    clearBtn.textContent = '✕';
    Object.assign(clearBtn.style, {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: '#999',
      fontSize: '12px',
      padding: '2px 4px',
    });

    discountRow.appendChild(discountLabel);
    discountRow.appendChild(discountInput);
    discountRow.appendChild(clearBtn);
    body.appendChild(discountRow);

    // Copy all button
    const copyAllBtn = document.createElement('button');
    copyAllBtn.textContent = 'Copy All';
    Object.assign(copyAllBtn.style, {
      width: '100%',
      padding: '5px',
      marginBottom: '8px',
      background: '#111',
      color: '#fff',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      fontWeight: '600',
      fontSize: '12px',
    });
    body.appendChild(copyAllBtn);

    // Copy/Download as image button
    const imageBtn = document.createElement('button');
    imageBtn.textContent = '🖼️ Copy & Download Image';
    Object.assign(imageBtn.style, {
      width: '100%',
      padding: '5px',
      marginBottom: '8px',
      background: '#fff',
      color: '#111',
      border: '1px solid #111',
      borderRadius: '8px',
      cursor: 'pointer',
      fontWeight: '600',
      fontSize: '12px',
    });
    body.appendChild(imageBtn);

    // Variant list
    const list = document.createElement('div');
    list.id = PANEL_ID + '-list';
    Object.assign(list.style, {
      maxHeight: '320px',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    });
    body.appendChild(list);

    panel.appendChild(body);

    // ── State ──
    let collapsed = localStorage.getItem(STORAGE_KEY_COLLAPSED) === 'true';

    function applyCollapsed() {
      body.style.display = collapsed ? 'none' : 'block';
      collapseBtn.textContent = collapsed ? '▼ Show' : '▲ Hide';
    }

    header.addEventListener('click', () => {
      collapsed = !collapsed;
      localStorage.setItem(STORAGE_KEY_COLLAPSED, collapsed);
      applyCollapsed();
    });

    applyCollapsed();

    // ── Render variant rows ──
    function getDiscount() {
      const v = parseFloat(discountInput.value);
      return isNaN(v) || v <= 0 ? 0 : Math.min(v, 99);
    }

    function discountedPrice(originalPrice, discount) {
      if (discount === 0) return originalPrice;
      return originalPrice * (1 - discount / 100);
    }

    function formatPrice(p) {
      return '$' + p.toFixed(2);
    }

    function buildVariantRows() {
      list.innerHTML = '';
      const discount = getDiscount();

      variants.forEach(v => {
        const finalPrice = discountedPrice(v.price, discount);

        const row = document.createElement('button');
        Object.assign(row.style, {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 8px',
          border: '1px solid #e8e8e8',
          borderRadius: '8px',
          background: '#fafafa',
          cursor: 'pointer',
          textAlign: 'left',
          width: '100%',
          transition: 'background 0.15s',
        });
        row.addEventListener('mouseenter', () => row.style.background = '#f0f0f0');
        row.addEventListener('mouseleave', () => row.style.background = '#fafafa');

        const nameSpan = document.createElement('span');
        nameSpan.textContent = v.name;
        Object.assign(nameSpan.style, {
          fontWeight: '600',
          fontSize: '12px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '155px',
        });

        const priceSpan = document.createElement('span');
        Object.assign(priceSpan.style, {
          whiteSpace: 'nowrap',
          fontWeight: '700',
          fontSize: '12px',
          color: discount > 0 ? '#c00' : '#111',
          marginLeft: '6px',
        });

        if (discount > 0) {
          priceSpan.innerHTML =
            `<span style="text-decoration:line-through;color:#999;font-weight:400">${formatPrice(v.price)}</span> ${formatPrice(finalPrice)}`;
        } else {
          priceSpan.textContent = formatPrice(finalPrice);
        }

        row.appendChild(nameSpan);
        row.appendChild(priceSpan);

        row.addEventListener('click', () => selectVariant(v.name));

        list.appendChild(row);
      });
    }

    // ── Copy all ──
    function getCopyText() {
      const discount = getDiscount();
      return variants.map(v => {
        const finalPrice = discountedPrice(v.price, discount);
        return `${v.name}: ${formatPrice(finalPrice)}`;
      }).join('\n');
    }

    copyAllBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(getCopyText()).then(() => {
        const orig = copyAllBtn.textContent;
        copyAllBtn.textContent = '✓ Copied!';
        setTimeout(() => copyAllBtn.textContent = orig, 1500);
      });
    });

    imageBtn.addEventListener('click', async () => {
      const orig = imageBtn.textContent;
      imageBtn.disabled = true;
      imageBtn.textContent = 'Generating...';

      try {
        const discount = getDiscount();
        const canvas = await buildExportCanvas(variants, discount, discountedPrice, formatPrice);
        const blob = await canvasToBlob(canvas);

        if (!blob) throw new Error('Failed to create image blob');

        // Download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mbb-variant-prices.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        // Copy to clipboard (best effort — may fail due to canvas tainting or browser support)
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          imageBtn.textContent = '✓ Copied & Downloaded!';
        } catch (clipErr) {
          console.warn('[MBB Panel] Clipboard copy failed (downloaded only):', clipErr);
          imageBtn.textContent = '✓ Downloaded (copy failed)';
        }
      } catch (e) {
        console.error('[MBB Panel] Image export failed:', e);
        imageBtn.textContent = '✕ Failed — see console';
      } finally {
        setTimeout(() => {
          imageBtn.textContent = orig;
          imageBtn.disabled = false;
        }, 2000);
      }
    });

    // ── Discount input events ──
    discountInput.addEventListener('input', () => {
      localStorage.setItem(STORAGE_KEY_DISCOUNT, discountInput.value);
      buildVariantRows();
    });

    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      discountInput.value = '';
      localStorage.removeItem(STORAGE_KEY_DISCOUNT);
      buildVariantRows();
    });

    buildVariantRows();

    return panel;
  }

  // ─── Init ─────────────────────────────────────────────────────────────────
  function init() {
    if (document.getElementById(PANEL_ID)) return;
    const variants = getVariants();
    if (variants.length === 0) {
      // Next.js may not have hydrated yet; retry briefly.
      setTimeout(init, 800);
      return;
    }
    const panel = buildPanel(variants);
    document.body.appendChild(panel);
  }

  // Wait for the page to be ready.
  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }

  // Also handle Next.js client-side navigation between product pages.
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      const existing = document.getElementById(PANEL_ID);
      if (existing) existing.remove();
      setTimeout(init, 600);
    }
  }).observe(document.body, { childList: true, subtree: true });

})();
