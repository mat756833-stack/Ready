// loadInvestments.js
// Firebase থেকে লগইন ইউজারের ইনভেস্টমেন্টগুলো পড়ে টেবিলে দেখাবে

import { auth, db } from './firebase.js';
import { 
  collection, 
  doc, 
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";

// টাকা ফরম্যাট করার ফাংশন
function tk(n) {
  return '৳' + Number(n || 0).toLocaleString('en-US');
}

// তারিখ ফরম্যাট করার ফাংশন
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// স্ট্যাটাসের রঙ নির্ধারণ
function getStatusColor(status) {
  status = (status || '').toLowerCase();
  if (status === 'active') return '#059669';
  if (status === 'completed') return '#3b82f6';
  if (status === 'cancelled') return '#dc2626';
  return '#94a3b8';
}

// টেবিলে ডাটা লোড করার ফাংশন
function loadInvestmentsToTable(userId) {
  const tableBody = document.getElementById('investments-table');
  if (!tableBody) {
    console.warn('investments-table element not found');
    return;
  }

  // প্রথমে লোডিং দেখানো
  tableBody.innerHTML = `
    <tr>
      <td colspan="5" style="text-align:center;padding:20px;color:#64748b">
        Loading investments...
      </td>
    </tr>
  `;

  // Firebase থেকে ইনভেস্টমেন্ট ডাটা পড়ুন
  const investmentsRef = collection(doc(db, 'users', userId), 'investments');
  
  // ক্রিয়েটেড টাইম অনুসারে সাজানোর জন্য কুয়েরি
  const investmentsQuery = query(
    investmentsRef, 
    orderBy('createdAtClientMillis', 'desc')
  );

  // রিয়েল-টাইম লিসেনার সেটআপ
  const unsubscribe = onSnapshot(investmentsQuery, (snapshot) => {
    if (snapshot.empty) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center;padding:20px;color:#64748b">
            No investments found. Start investing from the Plans section!
          </td>
        </tr>
      `;
      return;
    }

    // টেবিল কন্টেন্ট ক্লিয়ার করুন
    tableBody.innerHTML = '';

    // প্রতিটি ডকুমেন্টের জন্য টেবিল রো তৈরি করুন
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const row = document.createElement('tr');
      
      row.innerHTML = `
        <td style="padding:10px;border-bottom:1px solid #f1f5f9">
          <div style="font-weight:600">${data.planName || data.planId || 'Plan'}</div>
          ${data.planId ? `<div style="font-size:12px;color:#64748b">${data.planId}</div>` : ''}
        </td>
        <td style="padding:10px;border-bottom:1px solid #f1f5f9;font-weight:700">
          ${tk(data.planAmount || data.amount || 0)}
        </td>
        <td style="padding:10px;border-bottom:1px solid #f1f5f9;color:#475569">
          ${formatDate(data.createdAtClientDate || data.createdAtClientISO)}
        </td>
        <td style="padding:10px;border-bottom:1px solid #f1f5f9;color:#059669;font-weight:600">
          ${tk(data.dailyProfit || 0)}/day
        </td>
        <td style="padding:10px;border-bottom:1px solid #f1f5f9">
          <span style="
            background-color:${getStatusColor(data.status)}20;
            color:${getStatusColor(data.status)};
            padding:4px 10px;
            border-radius:20px;
            font-size:12px;
            font-weight:600;
            display:inline-block;
          ">
            ${(data.status || 'active').toUpperCase()}
          </span>
          ${data.daysCredited > 0 ? 
            `<div style="font-size:11px;color:#94a3b8;margin-top:2px">${data.daysCredited} days credited</div>` 
            : ''}
        </td>
      `;
      
      tableBody.appendChild(row);
    });

    // টোটাল সারি যোগ করুন (ঐচ্ছিক)
    const totalAmount = snapshot.docs.reduce((sum, doc) => {
      return sum + Number(doc.data().planAmount || doc.data().amount || 0);
    }, 0);
    
    const totalProfit = snapshot.docs.reduce((sum, doc) => {
      return sum + Number(doc.data().dailyProfit || 0);
    }, 0);
    
    const totalRow = document.createElement('tr');
    totalRow.style.backgroundColor = '#f8fafc';
    totalRow.innerHTML = `
      <td style="padding:10px;font-weight:700;color:#0f172a">TOTAL</td>
      <td style="padding:10px;font-weight:700;color:#0b5cff">${tk(totalAmount)}</td>
      <td style="padding:10px;color:#475569">-</td>
      <td style="padding:10px;font-weight:700;color:#059669">${tk(totalProfit)}/day</td>
      <td style="padding:10px;color:#475569">
        ${snapshot.docs.length} investment${snapshot.docs.length !== 1 ? 's' : ''}
      </td>
    `;
    tableBody.appendChild(totalRow);

  }, (error) => {
    console.error('Error loading investments:', error);
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;padding:20px;color:#dc2626">
          Error loading investments. Please check console.
        </td>
      </tr>
    `;
  });

  return unsubscribe;
}

// ইউজার অথেন্টিকেশন চেক করুন
function initInvestmentsTable() {
  let unsubscribe = null;

  onAuthStateChanged(auth, (user) => {
    // আগের লিসেনার ক্লিনআপ করুন
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }

    if (!user) {
      // লগইন না থাকলে মেসেজ দেখান
      const tableBody = document.getElementById('investments-table');
      if (tableBody) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align:center;padding:20px;color:#64748b">
              Please login to view your investments
            </td>
          </tr>
        `;
      }
      return;
    }

    // ইউজার লগইন করলে ডাটা লোড করুন
    unsubscribe = loadInvestmentsToTable(user.uid);
  });
}

// পেজ লোড হলে শুরু করুন
document.addEventListener('DOMContentLoaded', () => {
  initInvestmentsTable();
  
  // ভিউ স্যুইচ করার সময়ও রিফ্রেশ করতে পারেন (যদি আপনার ভিউ স্যুইচিং সিস্টেম থাকে)
  const investmentsSection = document.getElementById('investments');
  if (investmentsSection) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'style') {
          const displayStyle = window.getComputedStyle(investmentsSection).display;
          if (displayStyle !== 'none') {
            // ইনভেস্টমেন্ট সেকশন দেখানো হলে আপডেট করুন
            setTimeout(() => {
              if (auth.currentUser) {
                initInvestmentsTable();
              }
            }, 100);
          }
        }
      });
    });
    
    observer.observe(investmentsSection, { attributes: true });
  }
});

// পেজ আনলোড হলে ক্লিনআপ
window.addEventListener('beforeunload', () => {
  // লিসেনার ক্লিনআপ (যদি প্রয়োজন)
});