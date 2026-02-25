// ==UserScript==
// @name         District Mouseover
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Adds mouseover District links to item title words on eBay orders page and strong tag words on Gmail messages
// @author       You
// @match        https://www.ebay.com/sh/ord/*
// @match        https://mail.google.com/mail/u/0/*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const DISTRICT_BASE =
    "https://district.net/dashboard/midwestboxbreaks/products?q=";

  // --- Modal ---
  let modal = null;
  let hideTimer = null;

  function createModal() {
    const el = document.createElement("div");
    el.id = "district-hover-modal";
    Object.assign(el.style, {
      position: "fixed",
      background: "#fff",
      border: "1px solid #ccc",
      borderRadius: "6px",
      padding: "8px 14px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
      zIndex: "999999",
      fontSize: "13px",
      pointerEvents: "auto",
      display: "none",
      whiteSpace: "nowrap",
    });
    document.body.appendChild(el);
    el.addEventListener("mouseenter", () => clearTimeout(hideTimer));
    el.addEventListener("mouseleave", () => scheduleHide());
    return el;
  }

  function getModal() {
    if (!modal) modal = createModal();
    return modal;
  }

  function showModal(word, anchorEl) {
    clearTimeout(hideTimer);
    const m = getModal();
    const url = DISTRICT_BASE + encodeURIComponent(word);

    while (m.firstChild) m.removeChild(m.firstChild);
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = "District";
    Object.assign(a.style, {
      color: "#1a73e8",
      textDecoration: "none",
      fontWeight: "500",
    });
    a.addEventListener(
      "mouseover",
      () => (a.style.textDecoration = "underline"),
    );
    a.addEventListener("mouseout", () => (a.style.textDecoration = "none"));
    m.appendChild(a);

    m.style.display = "block";
    const rect = anchorEl.getBoundingClientRect();
    const mRect = m.getBoundingClientRect();

    let top = rect.bottom;
    let left = rect.left;
    if (left + mRect.width > window.innerWidth - 8)
      left = window.innerWidth - mRect.width - 8;
    if (top + mRect.height > window.innerHeight - 8)
      top = rect.top - mRect.height;

    m.style.top = top + "px";
    m.style.left = left + "px";
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (modal) modal.style.display = "none";
    }, 200);
  }

  // --- Shared: wrap words in an element with hover spans ---
  function wrapWords(el) {
    if (el.dataset.districtProcessed) return;
    el.dataset.districtProcessed = "true";

    const text = el.textContent.trim();
    const tokens = text.split(/(\s+)/);

    el.textContent = "";

    tokens.forEach((token) => {
      if (token === "") return;
      if (/^\s+$/.test(token)) {
        el.appendChild(document.createTextNode(token));
      } else {
        const span = document.createElement("span");
        span.textContent = token;
        Object.assign(span.style, {
          cursor: "pointer",
          borderBottom: "1px dotted #1a73e8",
          display: "inline",
        });
        span.addEventListener("mouseenter", (e) => {
          e.stopPropagation();
          showModal(token, span);
        });
        span.addEventListener("mouseleave", () => scheduleHide());
        el.appendChild(span);
      }
    });
  }

  // --- eBay: target span.item-title > a ---
  function scanEbay() {
    document
      .querySelectorAll("span.item-title:not([data-district-processed])")
      .forEach((el) => {
        el.dataset.districtProcessed = "true";
        const anchor = el.querySelector("a") || el;
        wrapWords(anchor);
      });
  }

  // --- Gmail: target strong tags inside message body ---
  function scanGmail() {
    document
      .querySelectorAll("strong:not([data-district-processed])")
      .forEach((el) => {
        if (el.textContent.trim()) wrapWords(el);
      });
  }

  // --- Route based on current URL ---
  function scanAll() {
    const url = window.location.href;
    if (url.includes("ebay.com")) scanEbay();
    if (url.includes("mail.google.com")) scanGmail();
  }

  // --- MutationObserver for dynamically loaded content ---
  const observer = new MutationObserver(() => scanAll());
  observer.observe(document.body, { childList: true, subtree: true });

  scanAll();
  setTimeout(scanAll, 1000);
  setTimeout(scanAll, 3000);
  setTimeout(scanAll, 6000);
})();
