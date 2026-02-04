// invest.js – client-time based, no transaction
// REQUIRE: firebase.js exports { auth, db }

import { auth, db } from './firebase.js';
import {
  doc,
  collection,
  getDoc,
  updateDoc,
  addDoc,
  onSnapshot,
  arrayUnion
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js';

// ----------------- Config / assets -----------------
const ASSETS = {
  processingGif: 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif',
  successGif: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif',
  confirmIcon: 'https://img.icons8.com/emoji/48/000000/check-mark-emoji.png',
  cancelIcon: 'https://img.icons8.com/emoji/48/000000/cross-mark-emoji.png'
};

function tk(n){ return '৳' + Number(n || 0).toLocaleString('en-US'); }
function safeNum(v){ return Number(v || 0); }
function escapeHtml(s){ return String(s || '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[c]); }

// ----------------- Plans (stable ids + nice names) -----------------
const PLANS = [
  { id: 'silver',   amount: 1000,   rate: 0.10, duration: 30, title: 'Silver' },
  { id: 'gold',     amount: 2000,   rate: 0.10, duration: 30, title: 'Gold' },
  { id: 'platinum', amount: 5000,   rate: 0.10, duration: 30, title: 'Platinum' },
  { id: 'diamond',  amount: 10000,  rate: 0.09, duration: 30, title: 'Diamond' },
  { id: 'ruby',     amount: 20000,  rate: 0.08, duration: 30, title: 'Ruby' },
  { id: 'emerald',  amount: 50000,  rate: 0.06, duration: 45, title: 'Emerald' },
  { id: 'sapphire', amount: 100000, rate: 0.05, duration: 45, title: 'Sapphire' },
  { id: 'titanium', amount: 250000, rate: 0.06, duration: 45, title: 'Titanium' }
];

// ----------------- Render plans -----------------
function renderPlans() {
  const allPlansEl = document.getElementById('all-plans');
  if(!allPlansEl) {
    console.warn('invest.js: #all-plans element not found');
    return;
  }

  allPlansEl.innerHTML = '';
  PLANS.forEach((p) => {
    const perDay = Math.round(p.amount * p.rate);
    const total = perDay * p.duration;

    const div = document.createElement('div');
    div.className = 'plan-box';
    div.style = `
      background:#fff;padding:14px;border-radius:12px;margin:8px;box-shadow:0 8px 20px rgba(2,6,23,0.04);
      display:flex;flex-direction:column;align-items:center;max-width:320px;
    `;

    div.innerHTML = `
      <h4 style="margin:0 0 8px;font-weight:800;color:#0b5cff">${escapeHtml(p.title)}</h4>
      <div class="plan-amount" style="font-size:20px;font-weight:900">${tk(p.amount)}</div>
      <div class="plan-rate" style="color:#64748b;margin-top:6px">Daily Income: ${tk(perDay)}</div>
      <div style="margin-top:6px">Rate: ${(p.rate*100).toFixed(1)}% per day</div>
      <div>Duration: ${p.duration} days</div>
      <div style="margin-top:8px">Total Return: <strong>${tk(total)}</strong></div>
    `;

    const wrap = document.createElement('div');
    wrap.style = 'margin-top:12px;width:100%;display:flex;justify-content:center';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'plan-btn';
    btn.textContent = 'Invest Now';
    btn.style = `
      padding:10px 16px;border-radius:999px;border:none;background:linear-gradient(90deg,#1366ff,#0ea5e9);
      color:white;font-weight:800;cursor:pointer;box-shadow:0 8px 20px rgba(14,165,233,0.18)
    `;

    btn.dataset.id = p.id;
    btn.dataset.amount = p.amount;
    btn.dataset.rate = p.rate;
    btn.dataset.duration = p.duration;
    btn.dataset.title = p.title;

    btn.addEventListener('click', () => {
      openConfirmModal({
        planId: btn.dataset.id,
        amount: safeNum(btn.dataset.amount),
        rate: safeNum(btn.dataset.rate),
        duration: safeNum(btn.dataset.duration),
        title: btn.dataset.title || 'Plan',
      });
    });

    wrap.appendChild(btn);
    div.appendChild(wrap);
    allPlansEl.appendChild(div);
  });

  allPlansEl.style = 'display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start;justify-content:center';
}

// ----------------- Modal & invest flow (no server timestamp, no tx) -----------------
function openConfirmModal({ planId, amount, rate, duration, title }) {
  const existing = document.getElementById('invest-confirm-modal');
  if (existing) existing.remove();

  const perDay = Math.round(amount * rate);
  const total = perDay * duration;

  const modal = document.createElement('div');
  modal.id = 'invest-confirm-modal';
  modal.style = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:9999';
  modal.innerHTML = `
    <div style="position:absolute;inset:0;background:rgba(0,0,0,0.45);backdrop-filter:blur(2px)"></div>
    <div style="position:relative; width:92%; max-width:520px; border-radius:14px; padding:18px; background:linear-gradient(135deg,#ffffff,#f7fbff); box-shadow:0 12px 40px rgba(2,6,23,0.28);">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:18px;font-weight:900;color:#0b5cff">Confirm Investment</div>
          <div style="font-size:13px;color:#475569;margin-top:4px">Plan: <strong id="cm-plan">${escapeHtml(title)}</strong></div>
        </div>
        <button id="cm-close" style="border:none;background:transparent;font-size:20px;color:#64748b;cursor:pointer">✕</button>
      </div>

      <div style="display:flex;gap:12px;margin-top:12px;align-items:center">
        <div style="flex:1;padding:12px;border-radius:10px;background:#fff;border:1px solid #e6eef8">
          <div style="font-size:13px;color:#0f172a;font-weight:700">Amount</div>
          <div id="cm-amount" style="font-size:22px;font-weight:900;margin-top:6px;color:#0b5cff">${tk(amount)}</div>
        </div>
        <div style="width:160px;padding:12px;border-radius:10px;background:#fff;border:1px solid #eef2ff">
          <div style="font-size:13px;color:#0f172a;font-weight:700">Estimated Profit</div>
          <div id="cm-profit" style="font-size:18px;font-weight:800;margin-top:6px;color:#059669">${tk(total)}</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:6px">Daily: ${tk(perDay)} · ${duration}d</div>
        </div>
      </div>

      <div id="cm-msg" style="min-height:26px;margin-top:12px;color:#dc2626;font-weight:700"></div>

      <div style="display:flex;gap:12px;margin-top:12px">
        <button id="cm-confirm" style="flex:1;display:flex;align-items:center;gap:10px;padding:12px;border-radius:12px;border:none;background:linear-gradient(90deg,#06b6d4,#0ea5e9);color:white;font-weight:800;cursor:pointer">
          <img id="cm-confirm-icon" src="${ASSETS.confirmIcon}" style="width:22px;height:22px"/>
          <span id="cm-confirm-text">Confirm & Invest</span>
        </button>
        <button id="cm-cancel" style="flex:1;padding:12px;border-radius:12px;border:1px solid #e6eef8;background:white;font-weight:800;color:#0f172a;cursor:pointer">
          <img src="${ASSETS.cancelIcon}" style="width:20px;height:20px;vertical-align:middle;margin-right:6px"/> Cancel
        </button>
      </div>

      <div id="cm-extra" style="margin-top:12px;font-size:12px;color:#475569">
        Processing will use your phone time (client time). No server clock.
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const closeBtn = modal.querySelector('#cm-close');
  const cancelBtn = modal.querySelector('#cm-cancel');
  const confirmBtn = modal.querySelector('#cm-confirm');
  const msgEl = modal.querySelector('#cm-msg');
  const iconEl = modal.querySelector('#cm-confirm-icon');
  const confirmText = modal.querySelector('#cm-confirm-text');
  const extraEl = modal.querySelector('#cm-extra');

  function closeModal(){ modal.remove(); }
  closeBtn.onclick = closeModal;
  cancelBtn.onclick = closeModal;

  confirmBtn.addEventListener('click', async () => {
    confirmBtn.disabled = true;
    cancelBtn.disabled = true;
    iconEl.src = ASSETS.processingGif;
    confirmText.textContent = 'Processing...';
    msgEl.style.color = '#0f172a';
    msgEl.textContent = '';

    try {
      const user = auth.currentUser;
      if (!user) {
        msgEl.style.color = '#dc2626';
        msgEl.textContent = 'আপনি লগইন করেননি — অনুগ্রহ করে লগইন করুন।';
        iconEl.src = ASSETS.confirmIcon;
        confirmText.textContent = 'Confirm & Invest';
        confirmBtn.disabled = false;
        cancelBtn.disabled = false;
        return;
      }

      const uid = user.uid;
      const userRef = doc(db, 'users', uid);
      console.log('[INVEST] uid =', uid);

      // ---- client time (phone time) ----
      const now = new Date();
      const clientISO = now.toISOString();      // e.g. 2025-12-02T18:43:00.000Z
      const clientDate = clientISO.split('T')[0]; // yyyy-mm-dd
      const clientMillis = now.getTime();

      // ---- optional plan image from plansMeta/{planId} ----
      let planImageURL = null;
      try {
        const metaRef = doc(db, 'plansMeta', planId);
        const metaSnap = await getDoc(metaRef);
        if (metaSnap.exists()) {
          const meta = metaSnap.data();
          planImageURL = meta.imageURL ?? meta.img ?? meta.photo ?? null;
        }
      } catch (e) {
        console.warn('[INVEST] plansMeta read failed:', e);
      }

      // ---- read user doc & balance ----
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        console.error('[INVEST] USER_DOC_NOT_FOUND for', uid);
        msgEl.style.color = '#dc2626';
        msgEl.textContent = 'ইউজার তথ্য পাওয়া যায়নি।';
        iconEl.src = ASSETS.confirmIcon;
        confirmText.textContent = 'Confirm & Invest';
        confirmBtn.disabled = false;
        cancelBtn.disabled = false;
        return;
      }

      const data = snap.data() || {};
      const balance = Number(data.balance || 0);
      console.log('[INVEST] current balance =', balance, ' amount =', amount);

      if (balance < amount) {
        console.warn('[INVEST] insufficient balance');
        msgEl.style.color = '#dc2626';
        msgEl.textContent = 'Unsuccessful – আপনার ব্যালেন্স কম আছে।';
        iconEl.src = ASSETS.confirmIcon;
        confirmText.textContent = 'Confirm & Invest';
        confirmBtn.disabled = false;
        cancelBtn.disabled = false;
        return;
      }

      // ---- plan entry (will be saved in users/{uid}.plans array) ----
      const dailyProfit = Math.round(amount * rate);
      const totalExpected = dailyProfit * duration;
      const planEntry = {
        id: planId,
        title,
        amount,
        rate,
        duration,
        dailyProfit,
        totalExpected,
        imageURL: planImageURL ?? null,
        clientTimeISO: clientISO,
        clientDate: clientDate,
        clientMillis: clientMillis,
        source: 'invest-ui'
      };

      console.log('[INVEST] writing plan entry to plans[] and updating balance...');

      // ---- single update: balance decrement + plans push (NO transaction) ----
      await updateDoc(userRef, {
        balance: balance - amount,
        plans: arrayUnion(planEntry)
      });

      // ---- add investments subcollection entry (same client time) ----
      const investmentsRef = collection(doc(db, 'users', uid), 'investments');
      await addDoc(investmentsRef, {
        planId,
        planName: title,
        planAmount: amount,
        rate,
        durationDays: duration,
        dailyProfit,
        totalExpectedReturn: totalExpected,
        status: 'active',
        createdAtClientISO: clientISO,
        createdAtClientDate: clientDate,
        createdAtClientMillis: clientMillis,
        daysCredited: 0,
        source: 'invest-ui',
        imageURL: planImageURL ?? null
      });

      console.log('[INVEST] success: balance updated & plan stored');

      // ---- success UI ----
      iconEl.src = ASSETS.successGif;
      confirmText.textContent = 'Successful';
      msgEl.style.color = '#16a34a';
      msgEl.textContent = 'Investment সফল হয়েছে!';
      extraEl.textContent = 'আপনার active plan এখন My Plans-এ দেখাবে।';
      setTimeout(() => closeModal(), 1100);

    } catch (err) {
      console.error('[INVEST] error:', err);
      let show = 'কোথাও ত্রুটি হয়েছে — পরে চেষ্টা করুন।';
      if (err && err.code === 'permission-denied') {
        show = 'Permission denied: Firestore rules ব্লক করছে।';
      }
      msgEl.style.color = '#dc2626';
      msgEl.textContent = show;
      iconEl.src = ASSETS.confirmIcon;
      confirmText.textContent = 'Confirm & Invest';
      confirmBtn.disabled = false;
      cancelBtn.disabled = false;
    }
  });
}

// ----------------- Realtime UI: wallet + investments -----------------
let balanceUnsub = null;
let invUnsub = null;

function detachRealtimeListeners() {
  try { if (typeof balanceUnsub === 'function') balanceUnsub(); } catch(e){}
  try { if (typeof invUnsub === 'function') invUnsub(); } catch(e){}
  balanceUnsub = invUnsub = null;
}

function initRealtimeUI() {
  const balanceEl = document.getElementById('wallet-balance');
  const invContainer = document.getElementById('my-investments');

  onAuthStateChanged(auth, (user) => {
    detachRealtimeListeners();

    if (!user) {
      if (balanceEl) balanceEl.textContent = tk(0);
      if (invContainer) invContainer.innerHTML = '<div style="color:#64748b">No investments yet</div>';
      return;
    }

    const uid = user.uid;
    const userRef = doc(db, 'users', uid);
    console.log('[REALTIME] auth user =', uid);

    // balance listener
    try {
      balanceUnsub = onSnapshot(userRef, (snap) => {
        if (!snap.exists()) {
          if (balanceEl) balanceEl.textContent = tk(0);
          return;
        }
        const bal = Number(snap.data().balance || 0);
        if (balanceEl) balanceEl.textContent = tk(bal);
      }, (err) => console.warn('[REALTIME] balance snapshot err', err));
    } catch (e) {
      console.warn('[REALTIME] balance listener attach error', e);
    }

    // investments listener
    try {
      const investmentsRef = collection(doc(db, 'users', uid), 'investments');
      invUnsub = onSnapshot(investmentsRef, (snap) => {
        if (!invContainer) return;
        const docs = snap.docs || [];
        const active = docs.filter(d => String(d.data().status || '').toLowerCase() === 'active');

        if (active.length === 0) {
          invContainer.innerHTML = '<div style="color:#64748b">No investments yet</div>';
          return;
        }

        invContainer.innerHTML = '';
        active.sort((a,b) => {
          const ad = a.data().createdAtClientMillis || 0;
          const bd = b.data().createdAtClientMillis || 0;
          return bd - ad;
        });

        active.forEach(d => {
          const data = d.data();
          const item = document.createElement('div');
          item.style = 'background:#fff;border-radius:10px;padding:10px;margin-bottom:8px;box-shadow:0 6px 18px rgba(2,6,23,0.03);display:flex;justify-content:space-between;align-items:center';
          const thumbHtml = data.imageURL ? `<img src="${escapeHtml(data.imageURL)}" style="width:56px;height:56px;border-radius:8px;object-fit:cover;margin-right:8px">` : '';
          item.innerHTML = `
            <div style="display:flex;align-items:center">
              ${thumbHtml}
              <div>
                <div style="font-weight:800">${escapeHtml(data.planName || data.title || data.planId || 'Plan')}</div>
                <div style="color:#64748b;font-size:13px">
                  Amount: ${tk(data.planAmount || data.amount || 0)} · Daily: ${tk(data.dailyProfit || 0)}
                </div>
              </div>
            </div>
            <div style="text-align:right">
              <div style="font-weight:800;color:${(String(data.status).toLowerCase()==='active'?'#059669':'#94a3b8')}">
                ${String(data.status || '').toUpperCase()}
              </div>
              <div style="font-size:12px;color:#94a3b8">
                ${data.daysCredited ? (data.daysCredited + 'd credited') : (data.createdAtClientDate || '')}
              </div>
            </div>
          `;
          invContainer.appendChild(item);
        });
      }, (err) => console.warn('[REALTIME] investments snapshot err', err));
    } catch (e) {
      console.warn('[REALTIME] investments listener attach error', e);
    }
  });

  window.addEventListener('beforeunload', detachRealtimeListeners);
}

// ----------------- Init -----------------
document.addEventListener('DOMContentLoaded', () => {
  renderPlans();
  initRealtimeUI();
});
