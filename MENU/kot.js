/* ───────────────────────────────────────────────────────────
   kot.js — adds "Send to Kitchen (KOT)" to the Pinocchio AR menu.
   Put this file in the SAME folder as your menu HTML and add ONE line
   just before </body> (after the main <script> block):

       <script src="kot.js"></script>

   What it does:
   • Adds a "🍳 Send to Kitchen (KOT)" button to the order sheet
   • KOT button writes the order to your Google Sheet (dashboard reads it)
   • WhatsApp button becomes a plain share (no duplicate sheet rows)
   • "Place Order" inside AR also sends to the kitchen (KOT)
   ─────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* ---------- styles ---------- */
  var css =
    '.cart-sticky-bar{flex-wrap:wrap}' +
    '.kot-send-btn{order:-1;flex:1 1 100%;min-height:52px;border:none;border-radius:999px;' +
    'background:var(--red-grad);color:var(--gold-lt);font:800 13.5px var(--f-sans);letter-spacing:.06em;' +
    'text-transform:uppercase;cursor:pointer;box-shadow:0 12px 28px rgba(108,6,11,.4);' +
    '-webkit-tap-highlight-color:transparent}' +
    '.kot-send-btn:disabled{opacity:.6;cursor:progress}';
  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ---------- Send to Kitchen (KOT) → Google Sheet ---------- */
  var busy = false;

  window.submitKOT = async function () {
    if (busy) return false;
    var totals = getCartTotals();
    var items = totals.items;
    if (!items.length) { showToast('Please add at least one dish first'); return false; }
    if (!SERVICE_WEBHOOK_URL) { showToast('Kitchen link is not set'); return false; }

    var tbl = ensureTableNumberPrompt();
    busy = true;
    var btn = document.getElementById('kot-order-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

    try {
      await fetch(SERVICE_WEBHOOK_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          restaurant: RESTAURANT_NAME,
          timestamp: new Date().toISOString(),
          type: 'ORDER',
          table: tbl,
          total: totals.total,
          items: items.map(function (x) {
            return { id: x.dish.id, name: x.dish.name, qty: x.qty, price: x.dish.price, note: x.note };
          }),
          generalOrderNote: generalOrderNote
        })
      });
      showToast('✅ Order sent to kitchen (KOT) · Table ' + tbl);
      cart = {};
      generalOrderNote = '';
      openNotes.clear();
      saveCartState();
      refreshAllCartControls();
      closeCartModal();
      return true;
    } catch (err) {
      console.warn('KOT send failed:', err);
      showToast('❌ Could not send to kitchen. Check your internet and try again.');
      return false;
    } finally {
      busy = false;
      if (btn) { btn.disabled = false; btn.textContent = '🍳 Send to Kitchen (KOT)'; }
    }
  };

  /* ---------- WhatsApp = share only (no sheet logging) ---------- */
  window.sendOrderToKitchen = function () {
    var totals = getCartTotals();
    var items = totals.items;
    if (!items.length) { showToast('Please add at least one dish first'); return false; }
    var tbl = ensureTableNumberPrompt();
    var lines = [
      '🍽️ *NEW TABLE ORDER — ' + RESTAURANT_NAME.toUpperCase() + '*',
      '📍 *Table:* ' + tbl,
      '────────────────────'
    ];
    items.forEach(function (it, i) {
      var sub = it.dish.price * it.qty;
      lines.push((i + 1) + '. *' + it.dish.name + '* × ' + it.qty + ' — ₹' + sub.toLocaleString('en-IN'));
      if (it.note && it.note.trim()) lines.push('   _↳ Note: ' + it.note.trim() + '_');
    });
    lines.push('────────────────────');
    if (generalOrderNote && generalOrderNote.trim()) lines.push('📝 *Order Note:* ' + generalOrderNote.trim());
    lines.push('🧾 *Total (' + totals.count + ' items): ₹' + totals.total.toLocaleString('en-IN') + '*');
    openWhatsAppMessage(lines.join('\n'));
    return true;
  };

  /* ---------- add the KOT button to the order sheet ---------- */
  var bar = document.querySelector('.cart-sticky-bar');
  var kotBtn = document.getElementById('kot-order-btn');
  if (bar && !kotBtn) {
    kotBtn = document.createElement('button');
    kotBtn.type = 'button';
    kotBtn.className = 'kot-send-btn';
    kotBtn.id = 'kot-order-btn';
    kotBtn.textContent = '🍳 Send to Kitchen (KOT)';
    bar.insertBefore(kotBtn, bar.firstChild);
    kotBtn.addEventListener('click', function () { window.submitKOT(); });
  }

  /* ---------- "Place Order" inside AR → KOT ---------- */
  var arOrderBtn = document.getElementById('ar-order-btn');
  if (arOrderBtn) {
    arOrderBtn.addEventListener('click', async function (e) {
      e.stopImmediatePropagation();
      e.stopPropagation();
      if (spreadMode) {
        spreadDishes.forEach(function (d) { if (getDishQty(d.id) <= 0) changeCartQty(d.id, 1, true); });
      }
      if (!getCartTotals().count) return;
      try { globalAR.querySelector('[slot="exit-webxr-ar-button"]').click(); } catch (err) {}
      globalAR.classList.remove('ar-active');
      window.submitKOT();
      try { if (document.fullscreenElement) await document.exitFullscreen(); } catch (err) {}
    }, true);
  }
})();