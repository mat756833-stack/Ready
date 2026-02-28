// /js/withdraw.js - সম্পূর্ণ Firebase Rules অনুযায়ী
import { auth, db } from './firebase.js';
import {
  doc, runTransaction, serverTimestamp,
  getDoc, arrayUnion
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";

// Debug mode
const DEBUG = true;

// Variables
let selectedMethod = 'bkash';
let userPhone = '';
let currentBalance = 0;
let currentUser = null;

// Constants
const MIN_WITHDRAWAL = 700;
const MAX_WITHDRAWAL = 20000;

// DOM Elements
const amountInput = document.getElementById('withdraw-amount');
const submitBtn = document.getElementById('withdraw-submit');
const withdrawMsg = document.getElementById('withdraw-msg');
const withdrawTableBody = document.querySelector('#withdraw-table tbody');
const methodBtns = document.querySelectorAll('.method-btn');
const currentBalanceEl = document.getElementById('current-balance');
const phoneLoader = document.getElementById('phone-loader');
const userPhoneSpan = document.getElementById('user-phone');

// ✅ DEBUG LOG FUNCTION
function debugLog(message, data = null) {
  if (DEBUG) console.log(`🔍 ${message}`, data || '');
}

// ✅ CREATE ALL POPUPS (PROFESSIONAL)
function createAllPopups() {
  // Remove existing popups
  ['processing-popup', 'insufficient-popup', 'success-popup', 'pending-popup'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });

  // PROCESSING POPUP
  const processingPopup = document.createElement('div');
  processingPopup.id = 'processing-popup';
  processingPopup.style.cssText = `
    display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.95); z-index: 9999; align-items: center; justify-content: center;
  `;
  
  processingPopup.innerHTML = `
    <div style="background: #1a1a2e; color: white; padding: 40px; border-radius: 20px; max-width: 500px; width: 90%; text-align: center; border: 2px solid #00adb5; position: relative;">
      <button onclick="hideProcessingPopup()" style="position: absolute; top: 15px; right: 15px; background: none; border: none; color: white; font-size: 24px; cursor: pointer;">×</button>
      
      <div style="margin: 20px 0 30px;">
        <div style="display: inline-block; width: 80px; height: 80px; border: 5px solid rgba(0,173,181,0.2); border-top: 5px solid #00adb5; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      </div>
      
      <h2 style="margin: 0 0 15px 0; color: #00adb5; font-size: 28px;">Processing Withdrawal</h2>
      <p style="margin-bottom: 25px; font-size: 16px; opacity: 0.9;">Please wait while we process your request...</p>
      
      <div style="background: rgba(0,173,181,0.1); padding: 20px; border-radius: 10px; margin: 20px 0; text-align: left;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <span>Amount:</span>
          <strong id="popup-amount">৳0</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <span>Method:</span>
          <strong id="popup-method">bKash</strong>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Phone:</span>
          <strong id="popup-phone">${userPhone || 'Loading...'}</strong>
        </div>
      </div>
      
      <div style="margin: 25px 0;">
        <div style="height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden;">
          <div id="popup-progress" style="height: 100%; width: 0%; background: linear-gradient(90deg, #00adb5, #00ff88); transition: width 0.5s;"></div>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 10px; font-size: 14px;">
          <span id="popup-step">Step 1: Verifying Balance</span>
          <span id="popup-percent">0%</span>
        </div>
      </div>
      
      <button onclick="cancelWithdrawProcess()" style="background: rgba(255,99,71,0.2); color: #ff6347; border: 1px solid #ff6347; padding: 12px 30px; border-radius: 8px; font-size: 16px; cursor: pointer; margin-top: 10px; width: 100%;">
        ❌ Cancel Request
      </button>
    </div>
    
    <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
  `;

  // INSUFFICIENT BALANCE POPUP
  const insufficientPopup = document.createElement('div');
  insufficientPopup.id = 'insufficient-popup';
  insufficientPopup.style.cssText = `
    display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.95); z-index: 9999; align-items: center; justify-content: center;
  `;
  
  insufficientPopup.innerHTML = `
    <div style="background: linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%); color: white; padding: 40px; border-radius: 20px; max-width: 500px; width: 90%; text-align: center; position: relative;">
      <button onclick="hideInsufficientPopup()" style="position: absolute; top: 15px; right: 15px; background: none; border: none; color: white; font-size: 24px; cursor: pointer;">×</button>
      
      <div style="margin: 20px 0 30px; font-size: 60px;">⚠️</div>
      
      <h2 style="margin: 0 0 15px 0; font-size: 28px;">Insufficient Balance</h2>
      <p style="margin-bottom: 25px; font-size: 16px;">Your withdrawal amount exceeds your available balance.</p>
      
      <div style="background: rgba(255,255,255,0.15); padding: 25px; border-radius: 10px; margin: 20px 0; text-align: left;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <div>
            <div style="font-size: 14px; opacity: 0.7;">Requested Amount</div>
            <div id="insuf-requested" style="font-size: 28px; font-weight: bold; color: #ffeb3b;">৳0</div>
          </div>
          <div style="font-size: 24px;">→</div>
          <div>
            <div style="font-size: 14px; opacity: 0.7;">Your Balance</div>
            <div id="insuf-balance" style="font-size: 28px; font-weight: bold; color: #4cd964;">৳0</div>
          </div>
        </div>
        
        <div style="height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; margin: 20px 0;">
          <div id="balance-bar" style="height: 100%; width: 50%; background: linear-gradient(90deg, #4cd964, #ffeb3b); border-radius: 2px;"></div>
        </div>
        
        <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; text-align: center;">
          <div style="font-size: 14px; opacity: 0.7; margin-bottom: 5px;">Shortage Amount</div>
          <div id="insuf-shortage" style="font-size: 24px; font-weight: bold; color: #ff6b6b;">৳0</div>
        </div>
      </div>
      
      <div style="display: flex; gap: 15px; margin-top: 20px;">
        <button onclick="goToDeposit()" style="flex: 1; background: white; color: #ff416c; border: none; padding: 15px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">
          💰 Add Balance
        </button>
        <button onclick="hideInsufficientPopup()" style="flex: 1; background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.3); padding: 15px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">
          Cancel
        </button>
      </div>
    </div>
  `;

  // SUCCESS POPUP
  const successPopup = document.createElement('div');
  successPopup.id = 'success-popup';
  successPopup.style.cssText = `
    display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.95); z-index: 9999; align-items: center; justify-content: center;
  `;
  
  successPopup.innerHTML = `
    <div style="background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%); color: white; padding: 40px; border-radius: 20px; max-width: 500px; width: 90%; text-align: center; position: relative;">
      <button onclick="hideSuccessPopup()" style="position: absolute; top: 15px; right: 15px; background: none; border: none; color: white; font-size: 24px; cursor: pointer;">×</button>
      
      <div style="position: relative; width: 100px; height: 100px; margin: 0 auto 25px;">
        <div style="position: absolute; top: 0; left: 0; width: 100px; height: 100px; background: rgba(255,255,255,0.2); border-radius: 50%; animation: pulse 2s infinite;"></div>
        <div style="position: absolute; top: 15px; left: 15px; width: 70px; height: 70px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#27ae60" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      </div>
      
      <h2 style="margin: 0 0 10px 0; font-size: 32px; font-weight: 700;">Successful Payment Request!</h2>
      <p style="margin-bottom: 30px; font-size: 16px; opacity: 0.9;">Your withdrawal request has been submitted successfully.</p>
      
      <div style="background: rgba(255,255,255,0.15); padding: 25px; border-radius: 15px; margin: 20px 0; text-align: left; backdrop-filter: blur(10px);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.2);">
          <div>
            <div style="font-size: 14px; opacity: 0.7;">Transaction ID</div>
            <div id="success-trx" style="font-size: 18px; font-weight: 600; letter-spacing: 1px; font-family: monospace;">TRX-XXXXXX</div>
          </div>
          <div style="background: rgba(255,255,255,0.2); padding: 8px 15px; border-radius: 20px; font-size: 14px; font-weight: 600;">PENDING</div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div>
            <div style="font-size: 14px; opacity: 0.7; margin-bottom: 5px;">Amount</div>
            <div id="success-amount" style="font-size: 24px; font-weight: bold; color: #ffeb3b;">৳0</div>
          </div>
          
          <div>
            <div style="font-size: 14px; opacity: 0.7; margin-bottom: 5px;">Method</div>
            <div id="success-method" style="font-size: 16px; font-weight: 600;">bKash</div>
          </div>
          
          <div>
            <div style="font-size: 14px; opacity: 0.7; margin-bottom: 5px;">Phone Number</div>
            <div id="success-phone" style="font-size: 16px; font-weight: 600; font-family: monospace;">${userPhone || ''}</div>
          </div>
          
          <div>
            <div style="font-size: 14px; opacity: 0.7; margin-bottom: 5px;">Status</div>
            <div style="background: rgba(255,193,7,0.3); color: #ffc107; padding: 8px 15px; border-radius: 20px; font-size: 13px; font-weight: 600; display: inline-block;">PENDING</div>
          </div>
        </div>
        
        <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.2);">
          <div style="font-size: 14px; opacity: 0.7; margin-bottom: 5px;">Date & Time</div>
          <div id="success-time" style="font-size: 15px; font-weight: 600;">${new Date().toLocaleString('bn-BD')}</div>
        </div>
      </div>
      
      <button onclick="hideSuccessPopup()" style="background: white; color: #27ae60; border: none; padding: 18px; border-radius: 12px; font-size: 18px; font-weight: 600; cursor: pointer; width: 100%; margin-top: 10px;">
        ✅ Done
      </button>
    </div>
    
    <style>@keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.05); opacity: 0.8; } 100% { transform: scale(1); opacity: 1; } }</style>
  `;

  // PENDING POPUP (orange theme)
  const pendingPopup = document.createElement('div');
  pendingPopup.id = 'pending-popup';
  pendingPopup.style.cssText = `
    display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.95); z-index: 9999; align-items: center; justify-content: center;
  `;
  
  pendingPopup.innerHTML = `
    <div style="background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%); color: white; padding: 40px; border-radius: 20px; max-width: 500px; width: 90%; text-align: center; position: relative;">
      <button onclick="hidePendingPopup()" style="position: absolute; top: 15px; right: 15px; background: none; border: none; color: white; font-size: 24px; cursor: pointer;">×</button>
      
      <div style="margin: 20px 0 30px; font-size: 60px;">⏳</div>
      
      <h2 style="margin: 0 0 15px 0; font-size: 28px;">⚠️ Pending Request Found</h2>
      <p style="margin-bottom: 25px; font-size: 16px; opacity: 0.9;">You already have a pending withdrawal request. Please wait for it to be processed before submitting a new one.</p>
      
      <div style="background: rgba(255,255,255,0.15); padding: 20px; border-radius: 10px; margin: 20px 0; text-align: left;">
        <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
          <span style="font-size: 24px;">🕒</span>
          <div>
            <div style="font-size: 14px; opacity: 0.7;">Current Status</div>
            <div style="font-size: 18px; font-weight: 600; color: #f1c40f;">REQUEST PENDING</div>
          </div>
        </div>
        <div style="font-size: 14px; opacity: 0.9; text-align: center;">
          Your previous withdrawal request is still under review.<br>
          You'll be notified once it's completed.
        </div>
      </div>
      
      <button onclick="hidePendingPopup()" style="background: white; color: #e67e22; border: none; padding: 15px 30px; border-radius: 10px; font-size: 16px; font-weight: 600; cursor: pointer; width: 100%; margin-top: 10px;">
        Got It
      </button>
    </div>
  `;

  document.body.appendChild(processingPopup);
  document.body.appendChild(insufficientPopup);
  document.body.appendChild(successPopup);
  document.body.appendChild(pendingPopup);
}

// ✅ POPUP CONTROL FUNCTIONS
function showProcessingPopup(amount, method) {
  const popup = document.getElementById('processing-popup');
  if (!popup) createAllPopups();
  
  document.getElementById('popup-amount').textContent = `৳${amount.toLocaleString()}`;
  document.getElementById('popup-method').textContent = method === 'bkash' ? 'bKash' : 
                                                       method === 'nogod' ? 'Nagad' : 'Rocket';
  document.getElementById('popup-phone').textContent = userPhone || 'Loading...';
  document.getElementById('popup-step').textContent = 'Step 1: Verifying Balance';
  
  popup.style.display = 'flex';
  
  // Simulate progress
  let progress = 0;
  const interval = setInterval(() => {
    progress += 10;
    if (progress > 90) progress = 90;
    
    document.getElementById('popup-progress').style.width = `${progress}%`;
    document.getElementById('popup-percent').textContent = `${progress}%`;
    
    if (progress === 30) document.getElementById('popup-step').textContent = 'Step 2: Processing Transaction';
    if (progress === 60) document.getElementById('popup-step').textContent = 'Step 3: Updating Database';
    if (progress === 90) document.getElementById('popup-step').textContent = 'Step 4: Finalizing...';
    
    if (progress >= 90) clearInterval(interval);
  }, 300);
  
  window.progressInterval = interval;
}

function hideProcessingPopup() {
  const popup = document.getElementById('processing-popup');
  if (popup) popup.style.display = 'none';
  if (window.progressInterval) clearInterval(window.progressInterval);
}

function showSuccessPopup(amount, transactionId) {
  const popup = document.getElementById('success-popup');
  if (!popup) return;
  
  document.getElementById('success-trx').textContent = transactionId;
  document.getElementById('success-amount').textContent = `৳${amount.toLocaleString()}`;
  document.getElementById('success-method').textContent = selectedMethod === 'bkash' ? 'bKash' : 
                                                          selectedMethod === 'nogod' ? 'Nagad' : 'Rocket';
  document.getElementById('success-phone').textContent = userPhone || '';
  document.getElementById('success-time').textContent = new Date().toLocaleString('bn-BD');
  
  popup.style.display = 'flex';
}

function hideSuccessPopup() {
  const popup = document.getElementById('success-popup');
  if (popup) popup.style.display = 'none';
}

function showInsufficientPopup(requestedAmount) {
  const popup = document.getElementById('insufficient-popup');
  if (!popup) createAllPopups();
  
  const shortage = requestedAmount - currentBalance;
  const percentage = Math.min((currentBalance / requestedAmount) * 100, 100);
  
  document.getElementById('insuf-requested').textContent = `৳${requestedAmount.toLocaleString()}`;
  document.getElementById('insuf-balance').textContent = `৳${currentBalance.toLocaleString()}`;
  document.getElementById('insuf-shortage').textContent = `৳${shortage.toLocaleString()}`;
  document.getElementById('balance-bar').style.width = `${percentage}%`;
  
  popup.style.display = 'flex';
}

function hideInsufficientPopup() {
  const popup = document.getElementById('insufficient-popup');
  if (popup) popup.style.display = 'none';
}

function showPendingPopup() {
  const popup = document.getElementById('pending-popup');
  if (!popup) createAllPopups();
  popup.style.display = 'flex';
}

function hidePendingPopup() {
  const popup = document.getElementById('pending-popup');
  if (popup) popup.style.display = 'none';
}

function cancelWithdrawProcess() {
  hideProcessingPopup();
  showMsg('Withdrawal request cancelled', false);
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Withdraw Request';
  }
}

function goToDeposit() {
  hideInsufficientPopup();
  showMsg('Redirecting to deposit page...');
  // window.location.href = '/deposit.html';
}

// ✅ CHECK PENDING WITHDRAWAL (withdrawHistory array check)
async function hasPendingWithdrawal(uid) {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const history = userSnap.data().withdrawHistory || [];
      return history.some(item => item.status === 'pending');
    }
    return false;
  } catch (error) {
    debugLog('Error checking pending:', error);
    return false;
  }
}

// ✅ GET USER DATA FROM FIREBASE
async function getUserInfo(user) {
  try {
    const userDocRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      const data = userSnap.data();
      // Phone number read
      userPhone = data.phone || data.mobile || data.phoneNumber || data.contact || data.number || '';
      currentBalance = Number(data.balance) || 0;
      debugLog('User loaded:', { phone: userPhone, balance: currentBalance });
      updatePhoneDisplayInUI(userPhone);
      updateBalanceDisplay();
      return data;
    }
  } catch (error) {
    debugLog('Error getting user:', error);
    showMsg('Error loading account', true);
  }
}

// ✅ UPDATE UI
function updatePhoneDisplayInUI(phone) {
  if (phoneLoader && userPhoneSpan) {
    if (phone) {
      phoneLoader.style.display = 'none';
      userPhoneSpan.textContent = phone;
      userPhoneSpan.style.display = 'inline';
    } else {
      phoneLoader.innerHTML = '⚠️ No payment number';
    }
  }
}

function updateBalanceDisplay() {
  if (currentBalanceEl) {
    currentBalanceEl.innerHTML = `
      <div style="font-size:32px;font-weight:bold;color:${currentBalance>0?'#27ae60':'#e74c3c'}">
        ৳${currentBalance.toLocaleString()}
      </div>
      <div style="font-size:14px;color:#666">Available Balance</div>
    `;
  }
}

function showMsg(text, isError = false) {
  if (!withdrawMsg) return;
  withdrawMsg.innerHTML = `<div style="padding:15px;border-radius:10px;background:${isError?'#fee':'#e8f5e8'};color:${isError?'#c33':'#2e7d32'};text-align:center">${text}</div>`;
  setTimeout(() => withdrawMsg.innerHTML = '', 5000);
}

// ✅ PROCESS WITHDRAW TRANSACTION – Rules এর case 1 অনুযায়ী শুধু balance, withdrawHistory, updatedAt
async function processWithdrawTransaction(amount) {
  const userDocRef = doc(db, 'users', currentUser.uid);
  const transactionId = 'TRX-' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1000);

  try {
    const result = await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userDocRef);
      if (!userDoc.exists()) throw new Error('User not found');
      
      const userData = userDoc.data();
      const currentBalanceInDB = Number(userData.balance) || 0;
      
      if (currentBalanceInDB < amount) {
        throw new Error('Insufficient balance');
      }

      const newBalance = currentBalanceInDB - amount;

      // Withdraw entry – withdrawHistory তে push হবে
      const withdrawEntry = {
        amount: amount,
        phone: userPhone,
        method: selectedMethod,
        status: 'pending',
        createdAt: new Date().toISOString(),
        transactionId: transactionId
      };

      transaction.update(userDocRef, {
        balance: newBalance,
        withdrawHistory: arrayUnion(withdrawEntry),
        updatedAt: serverTimestamp()
      });

      return { success: true, newBalance, transactionId };
    });
    return result;
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// ✅ LOAD WITHDRAW HISTORY (withdrawHistory থেকে)
async function loadWithdrawHistory(uid) {
  if (!withdrawTableBody) return;
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const history = snap.data().withdrawHistory || [];
      if (history.length === 0) {
        withdrawTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:#95a5a6">📭 No withdrawal history</td></tr>`;
        return;
      }
      // Sort newest first
      history.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      withdrawTableBody.innerHTML = '';
      history.forEach(item => {
        const date = item.createdAt ? new Date(item.createdAt).toLocaleDateString('bn-BD') : '';
        const time = item.createdAt ? new Date(item.createdAt).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }) : '';
        const row = `<tr>
          <td>${date}<br><small>${time}</small></td>
          <td>${item.method === 'bkash' ? 'bKash' : item.method === 'nogod' ? 'Nagad' : 'Rocket'}</td>
          <td>${item.phone}</td>
          <td>৳${item.amount.toLocaleString()}</td>
          <td><span style="background:#fff3cd;color:#856404;padding:6px 12px;border-radius:20px">${item.status}</span></td>
        </tr>`;
        withdrawTableBody.insertAdjacentHTML('beforeend', row);
      });
    }
  } catch (error) {
    debugLog('History error:', error);
  }
}

// ✅ MAIN WITHDRAW FUNCTION
async function handleWithdraw() {
  if (!amountInput) return;
  
  const amount = parseFloat(amountInput.value.replace(/,/g, '')) || 0;
  debugLog('Withdraw amount:', amount);

  // Validation
  if (amount < MIN_WITHDRAWAL || amount > MAX_WITHDRAWAL) {
    showMsg(`Amount must be between ৳${MIN_WITHDRAWAL} and ৳${MAX_WITHDRAWAL}`, true);
    return;
  }
  
  if (!currentUser) { 
    showMsg('Please login first', true); 
    return; 
  }
  
  if (!userPhone) {
    await getUserInfo(currentUser);
    if (!userPhone) { 
      showMsg('Phone number not found in profile', true); 
      return; 
    }
  }

  // ✅ Check pending withdrawal (withdrawHistory array te pending ache ki na)
  const hasPending = await hasPendingWithdrawal(currentUser.uid);
  if (hasPending) {
    showPendingPopup(); // প্রফেশনাল পেন্ডিং পপআপ
    return;
  }

  // Check balance
  if (currentBalance < amount) {
    showInsufficientPopup(amount);
    return;
  }

  // Show processing popup
  showProcessingPopup(amount, selectedMethod);

  // Disable button
  submitBtn.disabled = true;
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = 'Processing...';

  try {
    const result = await processWithdrawTransaction(amount);
    
    if (result.success) {
      // Complete progress
      document.getElementById('popup-progress').style.width = '100%';
      document.getElementById('popup-percent').textContent = '100%';
      document.getElementById('popup-step').textContent = 'Transaction Complete!';
      
      setTimeout(() => {
        hideProcessingPopup();
        showSuccessPopup(amount, result.transactionId);
        
        // Update local balance
        currentBalance = result.newBalance;
        updateBalanceDisplay();
        
        // Clear input
        amountInput.value = '';
        
        // Reload history
        loadWithdrawHistory(currentUser.uid);
      }, 1000);
    } else {
      hideProcessingPopup();
      showMsg(`Error: ${result.message}`, true);
    }
  } catch (error) {
    hideProcessingPopup();
    showMsg('Transaction failed', true);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}

// ✅ INITIALIZE
document.addEventListener('DOMContentLoaded', () => {
  // Create popups
  createAllPopups();

  // Method buttons
  methodBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      methodBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedMethod = btn.dataset.method || btn.textContent.toLowerCase().trim().replace(' ', '');
    });
  });

  // Submit button
  if (submitBtn) submitBtn.addEventListener('click', handleWithdraw);

  // Amount input - only numbers
  if (amountInput) {
    amountInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^\d]/g, '');
    });
  }

  // Auth state
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      await getUserInfo(user);
      await loadWithdrawHistory(user.uid);
    } else {
      currentUser = null;
      userPhone = '';
      currentBalance = 0;
      if (withdrawTableBody) {
        withdrawTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px">🔒 Please login to view history</td></tr>';
      }
      updateBalanceDisplay();
    }
  });
});

// Make functions global for popup buttons
window.hideProcessingPopup = hideProcessingPopup;
window.hideSuccessPopup = hideSuccessPopup;
window.hideInsufficientPopup = hideInsufficientPopup;
window.hidePendingPopup = hidePendingPopup;
window.cancelWithdrawProcess = cancelWithdrawProcess;
window.goToDeposit = goToDeposit;