// deposit.js - UPDATED VERSION with hidden timer and processing animation
import { auth, db } from './firebase.js';
import {
  collection, addDoc, serverTimestamp,
  doc, runTransaction, arrayUnion, increment, getDoc
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";

/* UI refs */
const amountInput = document.getElementById('deposit-amount');
const phoneInput = document.getElementById('deposit-phone');
const trxInput = document.getElementById('deposit-trxid');
const methodButtons = document.querySelectorAll('.method-btn');
const paymentNumberBox = document.getElementById('payment-number-box');
const agentNumberInput = document.getElementById('agent-number');
const copyBtn = document.getElementById('copy-number');
const depositMsg = document.getElementById('deposit-msg');
const depositTableBody = document.querySelector('#deposit-table tbody');
const depositButton = document.getElementById('deposit-submit');

let selectedMethod = null;
let currentUser = null;

/* Method selector */
methodButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    methodButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedMethod = btn.dataset.method || 'bkash';
    if (paymentNumberBox) paymentNumberBox.style.display = 'block';
    if (selectedMethod === 'bkash') agentNumberInput.value = '01701884859';
    if (selectedMethod === 'nogod') agentNumberInput.value = '0170XXXXXXX';
    if (selectedMethod === 'rocket') agentNumberInput.value = '0160XXXXXXX';
  });
});

/* Copy number */
copyBtn?.addEventListener('click', () => {
  agentNumberInput.select();
  document.execCommand('copy');
  if (depositMsg) {
    depositMsg.textContent = 'Number copied ✓';
    setTimeout(() => depositMsg.textContent = '', 2000);
  }
});

/* Auth observer */
onAuthStateChanged(auth, user => {
  currentUser = user || null;
  if (currentUser) {
    if (depositMsg) depositMsg.textContent = 'Logged in as ' + (currentUser.email || currentUser.uid);
    loadDepositHistory().catch(e => console.warn('loadDepositHistory err', e));
  } else {
    if (depositMsg) depositMsg.textContent = 'Please login to deposit';
    if (depositTableBody) depositTableBody.innerHTML = '';
  }
});

/* Helper: append to UI table */
function appendRowToTable(date, method, phone, amount, status) {
  if (!depositTableBody) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `<td>${date}</td><td>${method}</td><td>${phone}</td><td>৳${amount}</td><td>${status}</td>`;
  depositTableBody.prepend(tr);
}

/* Load deposit history */
async function loadDepositHistory() {
  if (!currentUser) return;
  try {
    const userRef = doc(db, 'users', currentUser.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const hist = data.depositHistory || [];
    if (depositTableBody) depositTableBody.innerHTML = '';
    hist.slice().reverse().forEach(h => {
      const dateStr = (h.createdAt instanceof Date) ? h.createdAt.toLocaleString()
        : (h.createdAt && typeof h.createdAt.toDate === 'function') ? h.createdAt.toDate().toLocaleString()
        : (h.createdAt ? new Date(h.createdAt).toLocaleString() : '');
      appendRowToTable(dateStr, h.method || '-', h.phone || '-', h.amount || 0, h.status || 'success');
    });
  } catch (e) {
    console.warn('loadDepositHistory error', e);
  }
}

/* Core: perform deposit transaction */
async function performDepositWrite(amount, phone, trx, method) {
  // 1) create paymentRequests doc
  const requestsCol = collection(db, 'paymentRequests');
  const reqDoc = {
    uid: currentUser.uid,
    email: currentUser.email || null,
    amount,
    method,
    phone,
    trxId: trx,
    status: 'success',
    createdAt: serverTimestamp()
  };
  const addedRef = await addDoc(requestsCol, reqDoc);
  console.log('[deposit] paymentRequests added:', addedRef.id);

  // 2) prepare deposit history entry
  const historyEntry = {
    requestId: addedRef.id,
    type: 'deposit',
    amount,
    method,
    phone,
    trxId: trx,
    status: 'success',
    createdAt: new Date()
  };

  // 3) transactionally update user doc
  const userRef = doc(db, 'users', currentUser.uid);
  await runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) {
      transaction.set(userRef, {
        balance: amount,
        depositHistory: [historyEntry],
        totalDeposit: amount,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      transaction.update(userRef, {
        balance: increment(amount),
        depositHistory: arrayUnion(historyEntry),
        totalDeposit: increment(amount),
        updatedAt: serverTimestamp()
      });
    }
  });

  // UI append
  appendRowToTable(new Date().toLocaleString(), method, phone, amount, 'success');
}

/* Payment method icons and animations */
function getPaymentMethodIcon(method) {
  const icons = {
    bkash: `
      <div class="bkash-loader">
        <div class="bkash-logo" style="width: 80px; height: 80px; background: #E2136E; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px;">
          <span style="color: white; font-weight: bold; font-size: 24px;">bKash</span>
        </div>
      </div>
    `,
    nagad: `
      <div class="nagad-loader">
        <div class="nagad-logo" style="width: 80px; height: 80px; background: #E41F26; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px;">
          <span style="color: white; font-weight: bold; font-size: 20px;">NAGAD</span>
        </div>
      </div>
    `,
    rocket: `
      <div class="rocket-loader">
        <div class="rocket-logo" style="width: 80px; height: 80px; background: #6A5ACD; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px;">
          <span style="color: white; font-weight: bold; font-size: 20px;">Rocket</span>
        </div>
      </div>
    `,
    nogod: `
      <div class="nogod-loader">
        <div class="nogod-logo" style="width: 80px; height: 80px; background: #E41F26; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px;">
          <span style="color: white; font-weight: bold; font-size: 20px;">NOGOD</span>
        </div>
      </div>
    `,
    bank: `
      <div class="bank-loader">
        <div class="bank-logo" style="width: 80px; height: 80px; background: #0066B3; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px;">
          <span style="color: white; font-weight: bold; font-size: 20px;">BANK</span>
        </div>
      </div>
    `
  };
  
  return icons[method] || icons.bkash;
}

/* NEW: Hidden timer with processing animation */
export async function startDepositFlow() {
  // Basic validation before modal
  const amount = Number(amountInput?.value);
  const phone = phoneInput?.value?.trim();
  const trx = trxInput?.value?.trim();
  const method = selectedMethod || 'bkash';

  if (!currentUser) {
    return Swal.fire({ icon: 'warning', title: 'Login required', text: 'Please sign in first.' });
  }
  if (!method) return Swal.fire({ icon: 'error', title: 'Select method', text: 'Choose a payment method.' });
  if (!amount || isNaN(amount) || amount < 500) return Swal.fire({ icon: 'error', title: 'Invalid amount', text: 'Minimum ৳500 required.' });
  if (!/^01\d{9}$/.test(phone)) return Swal.fire({ icon: 'error', title: 'Invalid phone', text: 'Use 01XXXXXXXXX' });
  if (!trx) return Swal.fire({ icon: 'error', title: 'Missing trx', text: 'Enter transaction ID.' });

  // Ensure Swal present
  if (typeof Swal === 'undefined') {
    alert('SweetAlert2 not loaded. Add CDN: <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>');
    return;
  }

  const TOTAL_SEC = 40;
  let remaining = TOTAL_SEC;
  
  // Get payment method icon
  const paymentIcon = getPaymentMethodIcon(method);
  
  // Show processing modal (NO TIMER VISIBLE)
  await Swal.fire({
    title: 'অপেক্ষা করুন...',
    html: `
      <div style="text-align: center;">
        <div style="font-size: 18px; font-weight: bold; margin-bottom: 20px; color: #2c3e50;">
          আপনার ডিপোজিট প্রসেস হচ্ছে
        </div>
        
        ${paymentIcon}
        
        <div class="processing-text" style="font-size: 24px; font-weight: bold; color: #10b981; margin: 20px 0;">
          <span class="processing-dots">প্রসেসিং</span>
        </div>
        
        <div style="font-size: 16px; color: #666; margin-top: 15px;">
          আপনার ডিপোজিট ভেরিফাই হচ্ছে...
        </div>
        
        <div style="margin-top: 25px; font-size: 14px; color: #888;">
          দয়া করে এই উইন্ডো বন্ধ করবেন না
        </div>
      </div>
      
      <style>
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
          100% { transform: scale(1); opacity: 1; }
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyprocessing dots {
          0%, 20% { content: 'প্রসেসিং.'; }
          40% { content: 'প্রসেসিং..'; }
          60%, 100% { content: 'প্রসেসিং...'; }
        }
        
        .bkash-logo, .nagad-logo, .rocket-logo, .nogod-logo, .bank-logo {
          animation: pulse 2s infinite;
          position: relative;
          overflow: hidden;
        }
        
        .bkash-logo::after, .nagad-logo::after, .rocket-logo::after, .nogod-logo::after, .bank-logo::after {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.3) 50%, transparent 70%);
          animation: spin 3s infinite linear;
        }
        
        .processing-dots::after {
          content: '...';
          animation: processing-dots 1.5s infinite;
        }
      </style>
    `,
    timer: TOTAL_SEC * 1000,
    timerProgressBar: false, // HIDE progress bar
    showCancelButton: true,
    cancelButtonText: 'বাতিল করুন ❌',
    showConfirmButton: false,
    allowOutsideClick: false,
    allowEscapeKey: false,
    showCloseButton: false,
    didOpen: () => {
      // Start hidden timer in background
      const timerInterval = setInterval(() => {
        remaining--;
        console.log(`[Hidden Timer] Remaining: ${remaining}s`); // Debug only
        
        // Update processing text every 5 seconds
        if (remaining % 5 === 0) {
          const dots = document.querySelector('.processing-dots');
          if (dots) {
            const statuses = [
              'ট্রানজেকশন চেক হচ্ছে...',
              'ব্যালেন্স আপডেট হচ্ছে...',
              'ডাটা সেভ হচ্ছে...',
              'প্রসেসিং'
            ];
            dots.textContent = statuses[Math.floor(Math.random() * statuses.length)];
          }
        }
        
        if (remaining <= 0) {
          clearInterval(timerInterval);
        }
      }, 1000);
      
      // Store interval ID to clear later
      Swal.getPopup().setAttribute('data-timer-interval', timerInterval);
    },
    willClose: () => {
      // Clear interval when modal closes
      const intervalId = Swal.getPopup().getAttribute('data-timer-interval');
      if (intervalId) {
        clearInterval(intervalId);
      }
    }
  }).then(async (result) => {
    if (result.dismiss === Swal.DismissReason.timer) {
      // Timer completed => process deposit
      try {
        // Show processing message in UI
        if (depositMsg) { 
          depositMsg.style.color = '#0a6'; 
          depositMsg.textContent = 'ডিপোজিট প্রসেস হচ্ছে...'; 
        }
        
        // Perform the actual deposit
        await performDepositWrite(amount, phone, trx, method);
        
        // Success messages
        if (depositMsg) { 
          depositMsg.style.color = '#10b981'; 
          depositMsg.textContent = 'ডিপোজিট সফল! আপনার ব্যালেন্স আপডেট করা হয়েছে।'; 
        }
        
        // Success modal
        await Swal.fire({
          icon: 'success',
          title: 'ডিপোজিট সফল!',
          html: `
            <div style="text-align: center;">
              <div style="font-size: 48px; color: #10b981; margin-bottom: 15px;">✓</div>
              <div style="font-size: 20px; font-weight: bold; color: #2c3e50; margin-bottom: 10px;">
                ৳${amount} ডিপোজিট হয়েছে
              </div>
              <div style="font-size: 16px; color: #666;">
                ${method.toUpperCase()} এর মাধ্যমে
              </div>
              <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 10px;">
                <div style="font-size: 14px; color: #888;">ট্রানজেকশন আইডি: ${trx}</div>
              </div>
            </div>
          `,
          confirmButtonText: 'ঠিক আছে',
          confirmButtonColor: '#10b981'
        });
        
        // Clear inputs
        if (amountInput) amountInput.value = '';
        if (phoneInput) phoneInput.value = '';
        if (trxInput) trxInput.value = '';
        
      } catch (err) {
        console.error('Deposit write failed', err);
        
        // Error message in UI
        if (depositMsg) { 
          depositMsg.style.color = 'red'; 
          depositMsg.textContent = 'ত্রুটি: ' + (err.message || err); 
        }
        
        // Error modal
        await Swal.fire({
          icon: 'error',
          title: 'ডিপোজিট ব্যর্থ',
          text: err.message || 'ডিপোজিট সম্পন্ন করা যায়নি। দয়া করে আবার চেষ্টা করুন।',
          confirmButtonText: 'আবার চেষ্টা করুন',
          confirmButtonColor: '#ef4444'
        });
      }
    } else {
      // User cancelled
      if (depositMsg) { 
        depositMsg.style.color = '#f59e0b'; 
        depositMsg.textContent = 'ডিপোজিট বাতিল করা হয়েছে।'; 
      }
      
      await Swal.fire({
        icon: 'info',
        title: 'বাতিল করা হয়েছে',
        text: 'ডিপোজিট প্রক্রিয়া বাতিল করা হয়েছে।',
        confirmButtonText: 'ঠিক আছে',
        confirmButtonColor: '#f59e0b'
      });
    }
  });
}

// Backward compatibility wrapper
export async function depositRequest(amountFromButton) {
  if (amountFromButton && amountInput) amountInput.value = amountFromButton;
  return startDepositFlow();
}

// window export for inline HTML onclick
window.startDepositFlow = startDepositFlow;
window.depositRequest = depositRequest;

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
  .processing-animation {
    display: inline-block;
    position: relative;
    width: 80px;
    height: 80px;
  }
  
  .processing-animation div {
    position: absolute;
    border: 4px solid #10b981;
    opacity: 1;
    border-radius: 50%;
    animation: processing-animation 1s cubic-bezier(0, 0.2, 0.8, 1) infinite;
  }
  
  .processing-animation div:nth-child(2) {
    animation-delay: -0.5s;
  }
  
  @keyframes processing-animation {
    0% {
      top: 36px;
      left: 36px;
      width: 0;
      height: 0;
      opacity: 0;
    }
    4.9% {
      top: 36px;
      left: 36px;
      width: 0;
      height: 0;
      opacity: 0;
    }
    5% {
      top: 36px;
      left: 36px;
      width: 0;
      height: 0;
      opacity: 1;
    }
    100% {
      top: 0px;
      left: 0px;
      width: 72px;
      height: 72px;
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);