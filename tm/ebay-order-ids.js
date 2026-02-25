// ==UserScript==
// @name         eBay Bulk Ship -> Copy Order/Item/Price
// @namespace    https://ebay.com/ship/
// @version      1.0.0
// @description  Adds a top-right button that scrapes order #, item title, and item price from ebay.com/ship/* and copies tab-separated rows to clipboard.
// @match        https://www.ebay.com/ship/*
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @run-at       document-idle
// ==/UserScript==

(() => {
  "use strict";

  const BTN_ID = "tm-ebay-copy-orders-btn";
  const STATE = {
    lastError: null,
    lastRowsText: "",
    lastRowCount: 0,
  };

  GM_addStyle(`
    #${BTN_ID} {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 999999;
      padding: 14px 18px;
      font-size: 16px;
      font-weight: 700;
      border-radius: 12px;
      border: 2px solid rgba(0,0,0,0.15);
      box-shadow: 0 8px 22px rgba(0,0,0,0.18);
      cursor: pointer;
      user-select: none;
      min-width: 220px;
      text-align: center;
    }
    #${BTN_ID}.ok {
      background: #0a8a3a;
      color: #fff;
    }
    #${BTN_ID}.err {
      background: #c81e1e;
      color: #fff;
    }
  `);

  function normalizeMoney(text) {
    // "$7.00" -> "7.00"
    const t = (text || "").trim();
    const m = t.match(/-?\$?\s*([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)(\.[0-9]{2})?/);
    if (!m) return null;
    const whole = (m[1] || "").replace(/,/g, "");
    const dec = m[2] || ".00";
    return `${whole}${dec}`;
  }

  function scrapeRows() {
    const orders = Array.from(document.querySelectorAll(".orders-list .orders-list__item"));
    if (orders.length === 0) {
      throw new Error("No orders found. Expected elements: .orders-list .orders-list__item");
    }

    const rows = [];

    for (const orderEl of orders) {
      // Order number(s)
      const orderIdLinks = Array.from(
        orderEl.querySelectorAll(".unique_order_id_container a[href*='orderId=']")
      );

      if (orderIdLinks.length === 0) {
        throw new Error("Could not find order id link(s) inside .unique_order_id_container");
      }

      const orderNumber = orderIdLinks
        .map(a => (a.textContent || "").replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join(", ");

      // Items (can be multiple per order if combined)
      const itemEls = Array.from(orderEl.querySelectorAll(".tcell__item .item"));
      if (itemEls.length === 0) {
        throw new Error(`No .item blocks found for order ${orderNumber}`);
      }

      for (const itemEl of itemEls) {
        const titleAnchor = itemEl.querySelector(".item__description h2 a");
        const itemTitle = (titleAnchor?.textContent || "").trim();
        if (!itemTitle) {
          throw new Error(`Missing item title for order ${orderNumber}`);
        }

        // Find "Item price:" line and its .currency span
        const liNodes = Array.from(itemEl.querySelectorAll(".item__details li"));
        const priceLi = liNodes.find(li => (li.textContent || "").includes("Item price"));
        const priceCurrency = priceLi?.querySelector(".currency");
        const rawPrice = (priceCurrency?.textContent || "").trim();
        const price = normalizeMoney(rawPrice);

        if (!price) {
          throw new Error(`Missing/invalid item price for order ${orderNumber} (${itemTitle})`);
        }

        // Tab-separated so it pastes cleanly into Google Sheets columns
        rows.push([orderNumber, itemTitle, price].join("\t"));
      }
    }

    return rows;
  }

  async function copyToClipboard(text) {
    // Prefer GM_setClipboard if available/granted; fallback to navigator.clipboard.
    try {
      if (typeof GM_setClipboard === "function") {
        GM_setClipboard(text, "text");
        return;
      }
    } catch (_) {}

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    // Last resort
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }

  function ensureButton() {
    let btn = document.getElementById(BTN_ID);
    if (btn) return btn;

    btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.type = "button";
    btn.textContent = "Loading…";
    btn.className = "err";

    btn.addEventListener("click", async () => {
      if (STATE.lastError) {
        alert(`TM ERROR:\n\n${STATE.lastError}`);
        return;
      }
      try {
        await copyToClipboard(STATE.lastRowsText);
        // Keep it simple: brief visual confirmation without changing requirements
        btn.textContent = `Copied ${STATE.lastRowCount} row(s)`;
        setTimeout(() => refreshState(), 900);
      } catch (e) {
        STATE.lastError = `Clipboard copy failed: ${e?.message || String(e)}`;
        refreshButton(btn);
        alert(`TM ERROR:\n\n${STATE.lastError}`);
      }
    });

    document.body.appendChild(btn);
    return btn;
  }

  function refreshButton(btn) {
    if (STATE.lastError) {
      btn.classList.remove("ok");
      btn.classList.add("err");
      btn.textContent = "ERROR (click)";
      return;
    }

    btn.classList.remove("err");
    btn.classList.add("ok");
    btn.textContent = `COPY ${STATE.lastRowCount} ROW(S)`;
  }

  function refreshState() {
    const btn = ensureButton();

    try {
      const rows = scrapeRows();
      STATE.lastError = null;
      STATE.lastRowsText = rows.join("\n");
      STATE.lastRowCount = rows.length;
    } catch (e) {
      STATE.lastError = e?.message || String(e);
      STATE.lastRowsText = "";
      STATE.lastRowCount = 0;
    }

    refreshButton(btn);
  }

  function startObservers() {
    // eBay bulk ship is SPA-ish; watch for updates.
    const target = document.querySelector("#bulk-labels-app") || document.body;
    const mo = new MutationObserver(() => {
      // Debounce via microtask-ish
      clearTimeout(startObservers._t);
      startObservers._t = setTimeout(refreshState, 200);
    });
    mo.observe(target, { childList: true, subtree: true });
  }

  // Boot
  ensureButton();
  refreshState();
  startObservers();
})();
