// referral.js - শুরুতে যোগ করুন
console.log('Referral.js loaded successfully');

// DOM element খুঁজে নিন
if (!document.getElementById('referral-section')) {
  console.error('referral-section element not found in DOM');
}
/* ===== referral.js ===== */
/* ===== Imports ===== */
import { auth, db } from "./firebase.js";
import {
  doc,
  getDoc,
  runTransaction,
  increment,
  arrayUnion,
  collection,
  query,
  where,
  getDocs,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";

/* ===== Utils ===== */
const num = v => Number(v ?? 0);
const formatCurrency = amount => `৳${amount.toLocaleString()}`;

/* ===== Milestones ===== */
const MILESTONES = [
  { ref: 2, amount: 200, icon: "🥈" },
  { ref: 5, amount: 500, icon: "🎯" },
  { ref: 10, amount: 1000, icon: "🏆" },
  { ref: 20, amount: 2000, icon: "👑" },
  { ref: 50, amount: 5000, icon: "💎" },
  { ref: 100, amount: 10000, icon: "🚀" }
];

let UID = null;
let userData = null;
let eligibleReferrals = { count: 0, amount: 0, uids: [], users: [] };

/* ===== DOM refs ===== */
let totalRefEl, eligibleRefCountEl, totalRefBonusEl, totalClaimedEl, refCodeEl;
let claimableAmountEl, progressTxt, progressBar, progressCurrent, progressTotal;
let milestonesDiv, copyBtn, claimDepositBtn, claimInfo, debugInfo;

/* ===== Initialize Referral System ===== */
export function initReferralSystem() {
  // Check if already initialized
  if (document.getElementById('referral-section-container')) {
    return;
  }

  // Create and inject HTML
  const html = `
<style>
/* Reset conflicts */
#referral-section * {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.referral-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background: transparent;
  position: relative;
  z-index: 10;
}

/* Header Section */
.referral-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20px;
  padding: 30px;
  color: white;
  margin-bottom: 25px;
  box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
  position: relative;
  overflow: hidden;
}

.referral-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #ff7e5f, #feb47b);
}

.referral-header h1 {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 10px;
  line-height: 1.3;
}

.referral-header p {
  opacity: 0.9;
  font-size: 16px;
  margin-bottom: 5px;
}

/* Stats Cards */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 25px;
}

.stat-card {
  background: white;
  border-radius: 16px;
  padding: 25px;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid #eef2f7;
  transition: all 0.3s ease;
  position: relative;
  z-index: 1;
}

.stat-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.12);
}

.stat-card.primary {
  border-top: 4px solid #4CAF50;
}

.stat-card.success {
  border-top: 4px solid #2196F3;
}

.stat-card.warning {
  border-top: 4px solid #FF9800;
}

.stat-label {
  font-size: 14px;
  color: #666;
  font-weight: 500;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: #333;
  line-height: 1.2;
}

.stat-subtext {
  font-size: 13px;
  color: #888;
  margin-top: 5px;
}

/* Referral Code Section */
.referral-code-section {
  background: white;
  border-radius: 16px;
  padding: 25px;
  margin-bottom: 25px;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.08);
  position: relative;
  z-index: 1;
}

.code-container {
  display: flex;
  align-items: center;
  gap: 15px;
  background: #f8f9fa;
  padding: 15px 20px;
  border-radius: 12px;
  border: 2px dashed #dee2e6;
}

.code-value {
  font-family: 'Courier New', monospace;
  font-size: 20px;
  font-weight: 700;
  color: #2c3e50;
  letter-spacing: 2px;
  flex: 1;
}

.btn {
  padding: 12px 24px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 14px;
  border: none;
  cursor: pointer;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  position: relative;
  z-index: 2;
}

.btn-primary {
  background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
  color: white;
}

.btn-primary:hover {
  background: linear-gradient(135deg, #43A047 0%, #1B5E20 100%);
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(76, 175, 80, 0.4);
}

.btn-secondary {
  background: #2196F3;
  color: white;
}

.btn-secondary:hover {
  background: #1976D2;
  transform: translateY(-2px);
}

.btn-disabled {
  background: #e0e0e0;
  color: #9e9e9e;
  cursor: not-allowed;
}

.btn-disabled:hover {
  transform: none;
  box-shadow: none;
}

/* Progress Section */
.progress-section {
  background: white;
  border-radius: 16px;
  padding: 25px;
  margin-bottom: 25px;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.08);
  position: relative;
  z-index: 1;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.progress-label {
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.progress-percent {
  font-size: 24px;
  font-weight: 700;
  color: #4CAF50;
}

.progress-bar-container {
  height: 16px;
  background: #f0f0f0;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 15px;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #4CAF50 0%, #8BC34A 100%);
  border-radius: 10px;
  transition: width 0.5s ease;
  position: relative;
}

.progress-bar::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, 
    transparent 0%, 
    rgba(255,255,255,0.3) 50%, 
    transparent 100%);
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: #666;
}

/* Milestones Grid */
.milestones-section {
  background: white;
  border-radius: 16px;
  padding: 25px;
  margin-bottom: 25px;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.08);
  position: relative;
  z-index: 1;
}

.section-title {
  font-size: 22px;
  font-weight: 700;
  color: #333;
  margin-bottom: 10px;
}

.section-subtitle {
  color: #666;
  margin-bottom: 25px;
  font-size: 14px;
}

.milestones-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.milestone-card {
  background: #f8f9fa;
  border-radius: 14px;
  padding: 20px;
  border: 2px solid #e9ecef;
  transition: all 0.3s ease;
  position: relative;
}

.milestone-card.reached {
  border-color: #4CAF50;
  background: linear-gradient(135deg, #f8fff8 0%, #f0f9f0 100%);
}

.milestone-card.claimed {
  border-color: #2196F3;
  background: linear-gradient(135deg, #f5fbff 0%, #e3f2fd 100%);
}

.milestone-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.milestone-count {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.milestone-amount {
  font-size: 24px;
  font-weight: 700;
  color: #e53935;
  margin-bottom: 10px;
}

.milestone-progress {
  font-size: 13px;
  color: #666;
  margin-bottom: 15px;
}

.status-badge {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 15px;
}

.status-pending {
  background: #fff3cd;
  color: #856404;
}

.status-ready {
  background: #d4edda;
  color: #155724;
}

.status-claimed {
  background: #d1ecf1;
  color: #0c5460;
}

/* Claim Section */
.claim-section {
  background: white;
  border-radius: 16px;
  padding: 30px;
  margin-bottom: 25px;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.08);
  text-align: center;
  position: relative;
  z-index: 1;
}

.claim-amount {
  font-size: 42px;
  font-weight: 800;
  color: #4CAF50;
  margin: 20px 0;
  text-shadow: 0 2px 10px rgba(76, 175, 80, 0.2);
}

.claim-info {
  color: #666;
  margin: 15px 0 25px;
  font-size: 14px;
  line-height: 1.5;
}

.claim-btn {
  width: 100%;
  max-width: 400px;
  padding: 18px;
  font-size: 18px;
  margin: 0 auto;
  position: relative;
  z-index: 2;
}

/* Debug Info */
.debug-info {
  margin-top: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 10px;
  font-size: 12px;
  color: #666;
  border-left: 4px solid #2196F3;
  position: relative;
  z-index: 1;
}

/* Icons */
.icon {
  font-size: 18px;
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .referral-container {
    padding: 15px;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .milestones-grid {
    grid-template-columns: 1fr;
  }
  
  .code-container {
    flex-direction: column;
    text-align: center;
    gap: 10px;
  }
  
  .btn {
    width: 100%;
  }
  
  .referral-header {
    padding: 20px;
  }
  
  .referral-header h1 {
    font-size: 24px;
  }
  
  .claim-amount {
    font-size: 32px;
  }
}
</style>

<div id="referral-section-container" class="referral-container">
  <!-- Header -->
  <div class="referral-header">
    <h1>🚀 রেফারেল প্রোগ্রাম</h1>
    <p>বন্ধুদের আমন্ত্রণ করুন এবং সীমাহীন পুরস্কার অর্জন করুন!</p>
    <p>প্রতিটি সফল রেফারেল ডিপোজিটের জন্য ৳২০০ পান</p>
  </div>

  <!-- Stats Grid -->
  <div class="stats-grid">
    <!-- Total Referrals -->
    <div class="stat-card primary">
      <div class="stat-label">📊 মোট রেফারেল</div>
      <div class="stat-value" id="totalRef">0</div>
      <div class="stat-subtext" id="eligibleRefCount">0 জন ডিপোজিট করেছেন</div>
    </div>

    <!-- Available Bonus -->
    <div class="stat-card success">
      <div class="stat-label">💰 উপলব্ধ বোনাস</div>
      <div class="stat-value" id="totalRefBonus">৳ 0</div>
      <div class="stat-subtext">ক্লেইম করার জন্য প্রস্তুত</div>
    </div>

    <!-- Total Claimed -->
    <div class="stat-card warning">
      <div class="stat-label">🎯 মোট ক্লেইম করা</div>
      <div class="stat-value" id="totalClaimed">৳ 0</div>
      <div class="stat-subtext">ইতিমধ্যে উত্তোলন করা হয়েছে</div>
    </div>
  </div>

  <!-- Referral Code -->
  <div class="referral-code-section">
    <div class="stat-label">📋 আপনার রেফারেল কোড</div>
    <div class="code-container">
      <div class="code-value" id="refCode">লোড হচ্ছে...</div>
      <button class="btn btn-primary" id="copyBtn">
        📋 কোড কপি করুন
      </button>
    </div>
    <div class="stat-subtext" style="margin-top: 10px;">
      এই কোডটি বন্ধুদের সাথে শেয়ার করুন। তারা ডিপোজিট করলে আপনি আয় করবেন।
    </div>
  </div>

  <!-- Claim Section -->
  <div class="claim-section">
    <div class="stat-label">💸 ক্লেইম করার জন্য প্রস্তুত</div>
    <div class="claim-amount" id="claimableAmount">৳ 0</div>
    <div class="claim-info" id="claimInfo">
      শুধুমাত্র ডিপোজিট করা রেফারেল ইউজারদের বোনাস ক্লেইম করা যাবে
    </div>
    <button class="btn btn-primary claim-btn" id="claimDepositBtn" disabled>
      কোন রেফারেল নেই
    </button>
  </div>

  <!-- Progress Section -->
  <div class="progress-section">
    <div class="progress-header">
      <div class="progress-label">📈 ডিপোজিট রেফারেল প্রোগ্রেস</div>
      <div class="progress-percent"><span id="progressTxt">0</span>%</div>
    </div>
    <div class="progress-bar-container">
      <div class="progress-bar" id="progressBar"></div>
    </div>
    <div class="progress-info">
      <span id="progressCurrent">0</span>
      <span id="progressTotal">/ 100 জন রেফারেল</span>
    </div>
  </div>

  <!-- Milestones Section -->
  <div class="milestones-section">
    <div class="section-title">🎯 মাইলস্টোন রিওয়ার্ড</div>
    <div class="section-subtitle">ডিপোজিট রেফারেল মাইলস্টোন অর্জন করে অতিরিক্ত বোনাস পান</div>
    <div class="milestones-grid" id="milestones"></div>
  </div>

  <!-- Debug Info -->
  <div class="debug-info" id="debugInfo">
    <strong>সিস্টেম স্ট্যাটাস:</strong> রেফারেল ডেটা লোড হচ্ছে...
  </div>
</div>
`;

  // Inject into referral-section div
  const referralSection = document.getElementById('referral-section');
  if (referralSection) {
    referralSection.innerHTML = html;
    
    // Get DOM references
    totalRefEl = document.getElementById("totalRef");
    eligibleRefCountEl = document.getElementById("eligibleRefCount");
    totalRefBonusEl = document.getElementById("totalRefBonus");
    totalClaimedEl = document.getElementById("totalClaimed");
    refCodeEl = document.getElementById("refCode");
    claimableAmountEl = document.getElementById("claimableAmount");
    progressTxt = document.getElementById("progressTxt");
    progressBar = document.getElementById("progressBar");
    progressCurrent = document.getElementById("progressCurrent");
    progressTotal = document.getElementById("progressTotal");
    milestonesDiv = document.getElementById("milestones");
    copyBtn = document.getElementById("copyBtn");
    claimDepositBtn = document.getElementById("claimDepositBtn");
    claimInfo = document.getElementById("claimInfo");
    debugInfo = document.getElementById("debugInfo");
    
    // Initialize auth listener
    setupAuthListener();
  } else {
    console.error('referral-section element not found');
  }
}

/* ===== Setup Auth Listener ===== */
function setupAuthListener() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      console.log("কোন ইউজার লগইন নেই");
      return;
    }

    UID = user.uid;

    try {
      // Ensure required fields exist
      const userRef = doc(db, "users", UID);
      const snap = await getDoc(userRef);
      
      if (!snap.exists()) return;

      userData = snap.data();
      
      // Create missing fields
      const updates = {};
      if (!userData.claimedDepositReferrals) updates.claimedDepositReferrals = [];
      if (!userData.totalClaimed) updates.totalClaimed = 0;
      if (!userData.claimedMilestones) updates.claimedMilestones = [];
      
      if (Object.keys(updates).length > 0) {
        await updateDoc(userRef, updates);
        userData = { ...userData, ...updates };
      }

      await renderUI();
      
    } catch (error) {
      console.error("Error loading user data:", error);
      if (debugInfo) {
        debugInfo.innerHTML = `<strong>ত্রুটি:</strong> ${error.message}`;
      }
    }
  });
}

/* ===== Check Eligible Referrals ===== */
async function checkEligibleReferrals() {
  if (!userData || !userData.referralCode) {
    return { count: 0, amount: 0, uids: [], users: [] };
  }
  
  try {
    const q = query(
      collection(db, "users"),
      where("referredBy", "==", userData.referralCode)
    );
    
    const querySnapshot = await getDocs(q);
    let eligibleCount = 0;
    const eligibleUIDs = [];
    const eligibleUsers = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const depositHistory = data.depositHistory || [];
      
      const hasSuccessfulDeposit = depositHistory.some(deposit => {
        const status = String(deposit.status || '').toLowerCase();
        return ['success', 'completed', 'approved', 'confirm', 'done', 's', '1', 'true']
          .some(condition => status.includes(condition));
      });
      
      if (hasSuccessfulDeposit) {
        eligibleCount++;
        eligibleUIDs.push(doc.id);
        eligibleUsers.push({
          uid: doc.id,
          email: data.email || data.username || 'N/A',
          depositCount: depositHistory.length
        });
      }
    });
    
    const claimableAmount = eligibleCount * 200;
    
    return {
      count: eligibleCount,
      amount: claimableAmount,
      uids: eligibleUIDs,
      users: eligibleUsers
    };
  } catch (error) {
    console.error("Error checking referrals:", error);
    return { count: 0, amount: 0, uids: [], users: [] };
  }
}

/* ===== Calculate Total Claimed ===== */
function calculateTotalClaimed() {
  if (!userData) return 0;
  
  if (userData.totalClaimed !== undefined) {
    return num(userData.totalClaimed);
  }
  
  return 0;
}

/* ===== Calculate Actual Claimable ===== */
function calculateActualClaimable() {
  if (!userData || !eligibleReferrals.uids) return 0;
  
  const claimedUsers = userData.claimedDepositReferrals || [];
  const newEligible = eligibleReferrals.uids.filter(uid => !claimedUsers.includes(uid));
  
  return newEligible.length * 200;
}

/* ===== Render UI ===== */
async function renderUI() {
  if (!userData) return;

  // Eligible referrals check
  eligibleReferrals = await checkEligibleReferrals();
  
  const totalRef = num(userData.totalReferrals);
  const eligibleCount = eligibleReferrals.count;
  const bonus = num(userData.referralBonus);
  const totalClaimed = calculateTotalClaimed();
  const actualClaimable = calculateActualClaimable();

  // Update stats
  if (totalRefEl) totalRefEl.textContent = totalRef;
  if (eligibleRefCountEl) eligibleRefCountEl.textContent = `${eligibleCount} জন ডিপোজিট করেছেন`;
  if (totalRefBonusEl) totalRefBonusEl.textContent = formatCurrency(bonus);
  if (totalClaimedEl) totalClaimedEl.textContent = formatCurrency(totalClaimed);
  if (refCodeEl) refCodeEl.textContent = userData.referralCode || "কোড নেই";
  if (claimableAmountEl) claimableAmountEl.textContent = formatCurrency(actualClaimable);

  // Progress bar
  const percent = Math.min(eligibleCount, 100);
  if (progressTxt) progressTxt.textContent = percent;
  if (progressBar) progressBar.style.width = percent + "%";
  if (progressCurrent) progressCurrent.textContent = eligibleCount;

  // Copy button
  if (copyBtn) {
    copyBtn.onclick = () => {
      if (userData.referralCode) {
        navigator.clipboard.writeText(userData.referralCode);
        copyBtn.innerHTML = "✅ কপি হয়েছে!";
        setTimeout(() => {
          copyBtn.innerHTML = "📋 কোড কপি করুন";
        }, 2000);
      }
    };
  }

  // Update claim button
  updateClaimButton();

  // Render milestones
  renderMilestones();

  // Update debug info
  if (debugInfo) {
    const claimedUsers = userData.claimedDepositReferrals || [];
    debugInfo.innerHTML = `
      <strong>সিস্টেম স্ট্যাটাস:</strong> সক্রিয় | 
      <strong>যোগ্য:</strong> ${eligibleCount} জন | 
      <strong>ক্লেইম করা:</strong> ${claimedUsers.length} জন | 
      <strong>নতুন ক্লেইমযোগ্য:</strong> ${eligibleCount - claimedUsers.length} জন
    `;
  }
}

/* ===== Update Claim Button ===== */
function updateClaimButton() {
  if (!claimDepositBtn || !claimInfo) return;
  
  const actualClaimable = calculateActualClaimable();
  const claimedUsers = userData.claimedDepositReferrals || [];
  const newCount = eligibleReferrals.count - claimedUsers.length;
  
  if (actualClaimable > 0) {
    claimDepositBtn.disabled = false;
    claimDepositBtn.className = "btn btn-primary claim-btn";
    claimDepositBtn.innerHTML = `💸 ${formatCurrency(actualClaimable)} ক্লেইম করুন`;
    claimInfo.textContent = `আপনি ${newCount} জন নতুন ডিপোজিট রেফারেল থেকে বোনাস ক্লেইম করতে পারেন`;
    
    claimDepositBtn.onclick = () => claimDepositBonus();
  } else {
    claimDepositBtn.disabled = true;
    claimDepositBtn.className = "btn btn-disabled claim-btn";
    claimDepositBtn.innerHTML = "কোন নতুন রেফারেল নেই";
    claimInfo.textContent = "রেফারেল ইউজারদের কমপক্ষে একটি সফল ডিপোজিট করতে হবে";
  }
}

/* ===== Claim Bonus ===== */
async function claimDepositBonus() {
  if (!UID) {
    alert("দয়া করে প্রথমে লগইন করুন!");
    return;
  }

  const userRef = doc(db, "users", UID);

  try {
    const result = await runTransaction(db, async (tx) => {
      const snap = await tx.get(userRef);
      const d = snap.data();

      if (!d) throw "ইউজার ডেটা পাওয়া যায়নি";

      // Get fresh eligible data
      const freshEligible = await checkEligibleReferrals();
      const claimedUsers = d.claimedDepositReferrals || [];
      
      // Calculate new eligible users
      const newEligibleUIDs = freshEligible.uids.filter(uid => !claimedUsers.includes(uid));
      
      if (newEligibleUIDs.length === 0) {
        throw "ক্লেইম করার জন্য কোন নতুন রেফারেল নেই!";
      }

      const actualClaimableAmount = newEligibleUIDs.length * 200;
      
      // Check if user has enough bonus
      if (num(d.referralBonus) < actualClaimableAmount) {
        throw `পর্যাপ্ত বোনাস নেই! প্রয়োজন: ${formatCurrency(actualClaimableAmount)}, আছে: ${formatCurrency(d.referralBonus)}`;
      }

      // Prepare update data
      const updateData = {
        referralBonus: num(d.referralBonus) - actualClaimableAmount,
        balance: increment(actualClaimableAmount),
        claimedDepositReferrals: arrayUnion(...newEligibleUIDs),
        lastDepositClaim: {
          amount: actualClaimableAmount,
          date: new Date().toISOString(),
          users: newEligibleUIDs,
          count: newEligibleUIDs.length
        }
      };

      // Update totalClaimed (increment properly)
      const currentTotalClaimed = num(d.totalClaimed || 0);
      updateData.totalClaimed = currentTotalClaimed + actualClaimableAmount;

      // Check for auto-claim milestones
      const claimedMilestones = d.claimedMilestones || [];
      const totalClaimedUsersAfter = [...claimedUsers, ...newEligibleUIDs].length;
      
      const eligibleMilestones = MILESTONES.filter(m => 
        totalClaimedUsersAfter >= m.ref && 
        !claimedMilestones.includes(m.ref)
      );

      if (eligibleMilestones.length > 0) {
        const totalMilestoneBonus = eligibleMilestones.reduce((sum, m) => sum + m.amount, 0);
        
        updateData.balance = increment(totalMilestoneBonus);
        updateData.totalClaimed = (updateData.totalClaimed || 0) + totalMilestoneBonus;
        updateData.claimedMilestones = arrayUnion(...eligibleMilestones.map(m => m.ref));
        
        updateData.lastMilestoneAutoClaim = {
          milestones: eligibleMilestones.map(m => m.ref),
          amount: totalMilestoneBonus,
          date: new Date().toISOString()
        };
      }

      tx.update(userRef, updateData);
      
      return {
        amount: actualClaimableAmount,
        users: newEligibleUIDs.length,
        milestoneBonus: eligibleMilestones.length > 0 ? eligibleMilestones.reduce((sum, m) => sum + m.amount, 0) : 0
      };
    });

    let successMessage = `🎉 সফল! ${result.users} জন রেফারেল থেকে ${formatCurrency(result.amount)} ক্লেইম করা হয়েছে!`;
    
    if (result.milestoneBonus > 0) {
      successMessage += `\n➕ ${formatCurrency(result.milestoneBonus)} মাইলস্টোন বোনাস প্রাপ্ত!`;
    }
    
    alert(successMessage);

    // Refresh data
    const snap = await getDoc(userRef);
    userData = snap.data();
    await renderUI();
    
  } catch (error) {
    console.error("Claim error:", error);
    alert(`ত্রুটি: ${error}`);
  }
}

/* ===== Render Milestones ===== */
function renderMilestones() {
  if (!milestonesDiv) return;
  
  milestonesDiv.innerHTML = "";
  
  const claimedUsers = userData.claimedDepositReferrals || [];
  const totalClaimedUsers = claimedUsers.length;
  const claimedMilestones = userData.claimedMilestones || [];

  MILESTONES.forEach(m => {
    const alreadyClaimed = claimedMilestones.includes(m.ref);
    const milestoneReached = totalClaimedUsers >= m.ref;
    
    let cardClass = "milestone-card";
    if (alreadyClaimed) cardClass += " claimed";
    else if (milestoneReached) cardClass += " reached";

    let statusText, statusClass;
    if (alreadyClaimed) {
      statusText = "✅ ক্লেইম করা হয়েছে";
      statusClass = "status-claimed";
    } else if (milestoneReached) {
      statusText = "🎁 ক্লেইম করুন";
      statusClass = "status-ready";
    } else {
      statusText = "⏳ অপেক্ষমান";
      statusClass = "status-pending";
    }

    const box = document.createElement("div");
    box.className = cardClass;
    
    box.innerHTML = `
      <div class="milestone-header">
        <div class="milestone-count">${m.icon} ${m.ref} জন ডিপোজিট রেফারেল</div>
        <span class="status-badge ${statusClass}">${statusText}</span>
      </div>
      <div class="milestone-amount">${formatCurrency(m.amount)}</div>
      <div class="milestone-progress">
        প্রোগ্রেস: <strong>${totalClaimedUsers}/${m.ref}</strong> জন
      </div>
    `;

    if (milestoneReached && !alreadyClaimed) {
      const btn = document.createElement("button");
      btn.className = "btn btn-primary";
      btn.style.width = "100%";
      btn.textContent = `${formatCurrency(m.amount)} ক্লেইম করুন`;
      
      btn.onclick = async () => {
        await claimMilestoneBonus(m.ref, m.amount);
      };
      
      box.appendChild(btn);
    } else if (!milestoneReached) {
      const needed = m.ref - totalClaimedUsers;
      const btn = document.createElement("button");
      btn.className = "btn btn-disabled";
      btn.style.width = "100%";
      btn.disabled = true;
      btn.textContent = `${needed} জন আরো প্রয়োজন`;
      box.appendChild(btn);
    }

    milestonesDiv.appendChild(box);
  });
}

/* ===== Claim Milestone Bonus ===== */
async function claimMilestoneBonus(refCount, amount) {
  if (!UID) return;

  const userRef = doc(db, "users", UID);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(userRef);
      const d = snap.data();

      if (!d) throw "ইউজার ডেটা পাওয়া যায়নি";

      const claimed = d.claimedMilestones || [];
      if (claimed.includes(refCount)) {
        throw "এই মাইলস্টোন ইতিমধ্যে ক্লেইম করা হয়েছে!";
      }

      const claimedUsers = d.claimedDepositReferrals || [];
      if (claimedUsers.length < refCount) {
        throw `কমপক্ষে ${refCount} জন ডিপোজিট রেফারেল প্রয়োজন!`;
      }

      const currentTotalClaimed = num(d.totalClaimed || 0);
      
      tx.update(userRef, {
        balance: increment(amount),
        claimedMilestones: arrayUnion(refCount),
        totalClaimed: currentTotalClaimed + amount,
        lastMilestoneClaim: {
          milestone: refCount,
          amount: amount,
          date: new Date().toISOString()
        }
      });
    });

    alert(`🎉 অভিনন্দন! ${refCount} জন মাইলস্টোন অর্জিত! ${formatCurrency(amount)} আপনার ব্যালেন্সে যোগ করা হয়েছে!`);
    
    const snap = await getDoc(userRef);
    userData = snap.data();
    await renderUI();
    
  } catch (error) {
    console.error("Milestone claim error:", error);
    alert(`ত্রুটি: ${error}`);
  }
}