// dashboard.js (Fully Fixed + No Plan Duplication)
// Uses ONLY doc-level plans array → no duplicate from subcollections
// Safe for Firebase Spark plan

import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
  doc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

/* ---------------- Utilities ---------------- */
function $id(id) { return document.getElementById(id) || null; }
function safeTextSet(el, value) { if (!el) return; if (el.tagName === "TBODY") el.innerHTML = value; else el.textContent = value; }
function escapeHtml(str) { return String(str ?? "").replace(/[&<>"']/g, (m)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m])); }
function formatCurrency(num) {
  const n = Number(num) || 0;
  const opts = Number.isInteger(n) ? { maximumFractionDigits: 0 } : { maximumFractionDigits: 2 };
  return `৳${n.toLocaleString(undefined, opts)}`;
}
function formatDate(value) {
  try {
    if (!value) return "-";
    if (typeof value === "object" && "seconds" in value) {
      const d = new Date(value.seconds * 1000); return d.toISOString().split("T")[0];
    }
    const d = new Date(value); if (isNaN(d)) return "-"; return d.toISOString().split("T")[0];
  } catch (e) { return "-"; }
}

/* ------------- Numeric & Plan helpers ------------- */
function extractDailyProfitFromPlan(plan) {
  if (!plan || typeof plan !== "object") return 0;
  const norm = {};
  for (const k of Object.keys(plan)) norm[k.toString().trim().toLowerCase()] = plan[k];

  const keys = ["dailyprofit","daily_profit","daily-profit","daily","perday","per_day","dailyrate","profitperday","profit","rate","amount","planamount"];
  for (const key of keys) {
    if (key in norm) {
      const n = Number(norm[key]);
      if (!isNaN(n)) return n;
    }
  }
  return 0;
}

function sumDailyProfits(plans) {
  if (!plans || !plans.length) return 0;
  let total = 0;
  for (const p of plans) {
    const n = extractDailyProfitFromPlan(p);
    if (!isNaN(n)) total += n;
  }
  return total;
}

/* ---------- Withdraw helpers ---------- */
function sumAmountsFromItems(items) {
  if (!items) return 0;
  let arr = Array.isArray(items) ? items : [];
  let total = 0;
  for (const it of arr) {
    if (!it) continue;
    const n = Number(it.amount ?? it.value ?? 0);
    if (!isNaN(n)) total += n;
  }
  return total;
}

/* ---------- UI renderers ---------- */
function updateOverviewFields(data = {}) {
  const balanceEl = $id("dash-balance");
  const profitEl = $id("dash-profit");
  const activeEl = $id("dash-active");
  const depositsEl = $id("dash-deposits");
  const withdrawalsEl = $id("dash-withdrawals");

  const balance = data.balance ?? 0;
  const totalProfit = data.totalProfit ?? 0;
  const totalDeposit = data.totalDeposit ?? 0;
  const totalWithdraw = data.totalWithdraw ?? 0;

  const plansArr = Array.isArray(data.plans) ? data.plans : [];

  if (balanceEl) safeTextSet(balanceEl, formatCurrency(balance));
  if (profitEl) safeTextSet(profitEl, formatCurrency(totalProfit));
  if (activeEl) safeTextSet(activeEl, String(plansArr.length));
  if (depositsEl) safeTextSet(depositsEl, formatCurrency(totalDeposit));
  if (withdrawalsEl) safeTextSet(withdrawalsEl, formatCurrency(totalWithdraw));
}

function renderPlans(plans) {
  const container = $id("user-plans");
  if (!container) return;
  let arr = Array.isArray(plans) ? plans : [];

  if (!arr.length) {
    container.innerHTML = `<div style="padding:12px">No plans</div>`;
    return;
  }

  container.innerHTML = arr.map(p => {
    const name = p?.planName ?? p?.title ?? p?.id ?? "Plan";
    const amount = p?.planAmount ?? p?.amount ?? 0;
    const rate = extractDailyProfitFromPlan(p) ?? 0;
    const status = p?.status ?? "active";
    const days = p?.duration ?? "";
    return `<div class="plan-box">
      <h4>${escapeHtml(name)}</h4>
      <div class="plan-amount">${formatCurrency(amount)}</div>
      <div class="plan-rate">Per day: ${formatCurrency(rate)}</div>
      <div style="margin-top:8px">${escapeHtml(String(status))}${days ? ` • ${escapeHtml(String(days))} days` : ""}</div>
    </div>`;
  }).join("");
}

function renderRecentActivityFromArrays(depositHistory = [], withdrawHistory = []) {
  const tbody = $id("recent-activity");
  if (!tbody) return;

  const normalize = (item, type) => ({
    date: item?.date ?? item?.createdAt ?? item?.clientDate ?? null,
    type,
    amount: item?.amount ?? 0,
    status: item?.status ?? "Unknown"
  });

  const combined = [
    ...depositHistory.map(i => normalize(i, "Deposit")),
    ...withdrawHistory.map(i => normalize(i, "Withdraw"))
  ];

  combined.sort((a,b) => {
    const da = (a.date && a.date.seconds) ? a.date.seconds*1000 : (new Date(a.date).getTime()||0);
    const db = (b.date && b.date.seconds) ? b.date.seconds*1000 : (new Date(b.date).getTime()||0);
    return db - da;
  });

  const rows = combined.slice(0,50).map(item => `<tr><td>${escapeHtml(formatDate(item.date))}</td><td>${escapeHtml(item.type)}</td><td>${escapeHtml(formatCurrency(item.amount))}</td><td>${escapeHtml(item.status)}</td></tr>`);
  tbody.innerHTML = rows.join("") || `<tr><td colspan="4">No recent activity</td></tr>`;
}

/* ---------- Firestore listener (main) ---------- */
let unsubUser = null;
function detachUserListener() { if (typeof unsubUser === "function") { try { unsubUser(); } catch (e) {} unsubUser = null; } }

function listenUserDoc(uid) {
  if (!uid) return;
  detachUserListener();
  const userRef = doc(db, "users", uid);

  unsubUser = onSnapshot(userRef, (snap) => {
    if (!snap.exists()) {
      updateOverviewFields({});
      renderPlans([]);
      renderRecentActivityFromArrays([], []);
      return;
    }

    const data = snap.data() || {};

    /* -------- USE ONLY DOC-LEVEL PLANS (NO SUBCOLLECTION MERGE) -------- */
    const docPlans = data.plans ?? [];
    const plansArr = Array.isArray(docPlans) ? docPlans : [];

    /* Withdraw */
    const withdraws = Array.isArray(data.withdrawHistory) ? data.withdrawHistory : [];

    const totalProfit = sumDailyProfits(plansArr);
    const totalWithdraw = sumAmountsFromItems(withdraws);

    data.totalProfit = totalProfit;
    data.totalWithdraw = totalWithdraw;
    data.plans = plansArr;

    updateOverviewFields(data);
    renderPlans(plansArr);
    renderRecentActivityFromArrays(data.depositHistory || [], withdraws);

  }, (err) => {
    console.error("user onSnapshot error:", err);
  });
}

/* ---------- Auth watcher & init ---------- */
function clearUI() {
  safeTextSet($id("dash-balance"), "৳0");
  safeTextSet($id("dash-profit"), "৳0");
  safeTextSet($id("dash-active"), "0");
  safeTextSet($id("dash-deposits"), "৳0");
  safeTextSet($id("dash-withdrawals"), "৳0");
  const tbody = $id("recent-activity"); if (tbody) tbody.innerHTML = `<tr><td colspan="4">No data</td></tr>`;
  const plansEl = $id("user-plans"); if (plansEl) plansEl.innerHTML = "";
}

function initAuth() {
  try {
    onAuthStateChanged(auth, (user) => {
      if (user) listenUserDoc(user.uid);
      else { detachUserListener(); clearUI(); }
    });
  } catch (e) {
    console.error("initAuth error:", e);
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAuth);
else initAuth();

export function dashboard() { try { initAuth(); } catch (e) {} }
