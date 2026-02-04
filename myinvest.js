import { auth, db } from "./firebase.js";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  increment
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

/* ===== CONFIG ===== */
const DAY_MS = 86400000;

/* ===== UI TEMPLATE ===== */
function buildUI(container) {
  container.innerHTML = `
    <div style="display:flex;gap:10px;margin-bottom:12px">
      <button id="tab-active" class="inv-tab active">Active</button>
      <button id="tab-completed" class="inv-tab">Completed</button>
    </div>

    <div id="invest-grid" class="invest-grid"></div>

    <style>
      .inv-tab{
        padding:8px 14px;
        border:none;
        border-radius:8px;
        background:#eee;
        cursor:pointer;
        font-weight:600;
      }
      .inv-tab.active{
        background:#2ecc71;
        color:#fff;
      }
      .invest-grid{
        display:grid;
        grid-template-columns:repeat(auto-fill,minmax(230px,1fr));
        gap:14px;
      }
      .invest-box{
        background:linear-gradient(135deg,#1abc9c,#2ecc71);
        color:#fff;
        padding:14px;
        border-radius:14px;
        box-shadow:0 6px 16px rgba(0,0,0,.18);
        animation:fadeUp .4s ease;
      }
      .invest-box h4{margin:0 0 6px}
      .invest-box p{margin:3px 0;font-size:14px}
      @keyframes fadeUp{
        from{opacity:0;transform:translateY(10px)}
        to{opacity:1;transform:none}
      }
    </style>
  `;
}

/* ===== MAIN LOGIC ===== */
auth.onAuthStateChanged(async (user) => {
  if (!user) return;

  // hide old table
  const oldTable = document.getElementById("old-invest-table");
  if (oldTable) oldTable.style.display = "none";

  const uiRoot = document.getElementById("invest-ui");
  buildUI(uiRoot);

  const grid = document.getElementById("invest-grid");
  const tabActive = document.getElementById("tab-active");
  const tabCompleted = document.getElementById("tab-completed");

  const uid = user.uid;
  const now = Date.now();

  const snap = await getDocs(collection(db, "users", uid, "investments"));

  if (snap.empty) {
    grid.innerHTML = "<p>No active plan found</p>";
    return;
  }

  const plans = [];

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const ref = doc(db, "users", uid, "investments", docSnap.id);

    /* ===== FIELD SAFETY ===== */
    const daysCredited = data.daysCredited ?? 0;
    const status = data.status ?? "active";
    const createdMs = data.createdAtClientMillis;

    if (!createdMs || !data.dailyProfit || !data.durationDays) continue;

    /* ===== PROFIT CALC ===== */
    const totalDaysPassed = Math.floor((now - createdMs) / DAY_MS);
    let pendingDays = totalDaysPassed - daysCredited;

    if (pendingDays < 0) pendingDays = 0;

    // duration cap
    if (daysCredited + pendingDays > data.durationDays) {
      pendingDays = data.durationDays - daysCredited;
    }

    if (pendingDays > 0 && status === "active") {
      // credit profit
      await updateDoc(ref, {
        daysCredited: increment(pendingDays)
      });

      await updateDoc(doc(db, "users", uid), {
        balance: increment(pendingDays * data.dailyProfit)
      });
    }

    // complete check
    if (daysCredited + pendingDays >= data.durationDays && status !== "completed") {
      await updateDoc(ref, { status: "completed" });
      data.status = "completed";
    }

    data.daysCredited = daysCredited + pendingDays;
    plans.push(data);
  }

  /* ===== RENDER ===== */
  function render(type) {
    grid.innerHTML = "";
    plans
      .filter(p => p.status === type)
      .forEach(p => {
        const box = document.createElement("div");
        box.className = "invest-box";
        box.innerHTML = `
          <h4>${p.planName}</h4>
          <p>Amount: ৳${p.planAmount}</p>
          <p>Daily Profit: ৳${p.dailyProfit}</p>
          <p>Duration: ${p.daysCredited}/${p.durationDays} days</p>
          <p>Status: ${p.status}</p>
        `;
        grid.appendChild(box);
      });

    if (!grid.children.length) {
      grid.innerHTML = `<p>No ${type} plans</p>`;
    }
  }

  tabActive.onclick = () => {
    tabActive.classList.add("active");
    tabCompleted.classList.remove("active");
    render("active");
  };

  tabCompleted.onclick = () => {
    tabCompleted.classList.add("active");
    tabActive.classList.remove("active");
    render("completed");
  };

  render("active");
});
