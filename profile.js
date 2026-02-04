// profile.js - Professional Profile Management with Color States
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import { doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

// DOM Elements
const nameInput = document.querySelector('#profileForm input[placeholder="Full name"]');
const emailInput = document.querySelector('#profileForm input[placeholder="Email"]');
const phoneInput = document.querySelector('#profileForm input[placeholder="Phone"]');
const saveBtn = document.querySelector('#profileForm button');
const profileStatus = document.getElementById('profileStatus') || createStatusElement();

// Create status element if not exists
function createStatusElement() {
    const statusDiv = document.createElement('div');
    statusDiv.id = 'profileStatus';
    statusDiv.style.cssText = `
        margin-top: 10px;
        padding: 10px;
        border-radius: 5px;
        font-weight: 500;
        display: none;
    `;
    document.querySelector('#profileForm').appendChild(statusDiv);
    return statusDiv;
}

// Update input field styling
function updateInputStyle(input, isValid) {
    if (isValid) {
        input.style.borderColor = '#10b981';
        input.style.backgroundColor = '#f0fdf4';
        input.style.color = '#065f46';
    } else {
        input.style.borderColor = '#ef4444';
        input.style.backgroundColor = '#fef2f2';
        input.style.color = '#991b1b';
    }
}

// Show status message
function showStatus(message, type = 'success') {
    profileStatus.textContent = message;
    profileStatus.style.display = 'block';
    
    if (type === 'success') {
        profileStatus.style.backgroundColor = '#d1fae5';
        profileStatus.style.color = '#065f46';
        profileStatus.style.border = '1px solid #10b981';
    } else if (type === 'error') {
        profileStatus.style.backgroundColor = '#fee2e2';
        profileStatus.style.color = '#991b1b';
        profileStatus.style.border = '1px solid #ef4444';
    } else if (type === 'info') {
        profileStatus.style.backgroundColor = '#dbeafe';
        profileStatus.style.color = '#1e40af';
        profileStatus.style.border = '1px solid #3b82f6';
    }
    
    setTimeout(() => {
        profileStatus.style.display = 'none';
    }, 3000);
}

// Validate name input
function validateName(name) {
    if (!name.trim()) return { valid: false, message: 'নাম পূরণ করুন' };
    if (name.length < 2) return { valid: false, message: 'নাম খুব ছোট' };
    if (name.length > 50) return { valid: false, message: 'নাম খুব বড়' };
    if (!/^[a-zA-Z\s\u0980-\u09FF]+$/.test(name)) {
        return { valid: false, message: 'শুধুমাত্র অক্ষর ব্যবহার করুন' };
    }
    return { valid: true, message: '' };
}

// Load user profile
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        showStatus('লগইন করুন', 'error');
        return;
    }

    try {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
            const data = snap.data();

            // Email & phone always from Firestore
            emailInput.value = data.email || user.email || "";
            phoneInput.value = data.phone || "";
            
            // Apply styles to email and phone (read-only, green)
            emailInput.readOnly = true;
            phoneInput.readOnly = true;
            emailInput.style.backgroundColor = '#f0fdf4';
            emailInput.style.color = '#065f46';
            phoneInput.style.backgroundColor = '#f0fdf4';
            phoneInput.style.color = '#065f46';

            // Name field logic
            if (data.fullName) {
                // Name already exists - show in green, disable editing
                nameInput.value = data.fullName;
                nameInput.readOnly = true;
                nameInput.disabled = false;
                nameInput.style.backgroundColor = '#d1fae5';
                nameInput.style.color = '#065f46';
                nameInput.style.borderColor = '#10b981';
                nameInput.style.cursor = 'not-allowed';
                
                saveBtn.style.display = "none";
                showStatus(`স্বাগতম, ${data.fullName}!`, 'success');
            } else {
                // No name yet - show in red, allow editing
                nameInput.value = "";
                nameInput.readOnly = false;
                nameInput.disabled = false;
                nameInput.style.backgroundColor = '#fee2e2';
                nameInput.style.color = '#991b1b';
                nameInput.style.borderColor = '#ef4444';
                nameInput.style.cursor = 'text';
                nameInput.placeholder = "আপনার পুরো নাম লিখুন";
                
                saveBtn.style.display = "block";
                showStatus('নাম পূরণ করুন (শুধু একবার এডিট করা যাবে)', 'info');
                
                // Add real-time validation
                nameInput.addEventListener('input', (e) => {
                    const validation = validateName(e.target.value);
                    if (e.target.value.trim()) {
                        if (validation.valid) {
                            updateInputStyle(nameInput, true);
                        } else {
                            updateInputStyle(nameInput, false);
                            showStatus(validation.message, 'error');
                        }
                    } else {
                        nameInput.style.backgroundColor = '#fee2e2';
                        nameInput.style.color = '#991b1b';
                        nameInput.style.borderColor = '#ef4444';
                    }
                });
            }
        } else {
            // User document doesn't exist yet
            emailInput.value = user.email || "";
            emailInput.readOnly = true;
            emailInput.style.backgroundColor = '#f0fdf4';
            
            nameInput.placeholder = "আপনার পুরো নাম লিখুন";
            nameInput.style.backgroundColor = '#fee2e2';
            nameInput.style.color = '#991b1b';
            nameInput.style.borderColor = '#ef4444';
            
            showStatus('নাম পূরণ করুন (শুধু একবার এডিট করা যাবে)', 'info');
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        showStatus('প্রোফাইল লোড করতে সমস্যা', 'error');
    }
});

// Save profile (Only name can be submitted once)
saveBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    
    const user = auth.currentUser;
    if (!user) {
        showStatus('লগইন করুন', 'error');
        return;
    }

    const fullName = nameInput.value.trim();
    
    // Validate name
    const validation = validateName(fullName);
    if (!validation.valid) {
        showStatus(validation.message, 'error');
        nameInput.focus();
        return;
    }

    try {
        const userRef = doc(db, "users", user.uid);
        
        // First check if name already exists
        const snap = await getDoc(userRef);
        if (snap.exists() && snap.data().fullName) {
            showStatus('নাম শুধু একবার সেট করা যায়', 'error');
            return;
        }

        // Show saving state
        saveBtn.innerHTML = '<span class="spinner"></span> সেভ হচ্ছে...';
        saveBtn.disabled = true;
        saveBtn.style.backgroundColor = '#6b7280';
        
        // Update document with name and timestamp
        await updateDoc(userRef, {
            fullName: fullName,
            nameSetAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        // Success - update UI
        showStatus(`প্রোফাইল সেভ হয়েছে! স্বাগতম ${fullName}`, 'success');
        
        nameInput.readOnly = true;
        nameInput.disabled = false;
        nameInput.style.backgroundColor = '#d1fae5';
        nameInput.style.color = '#065f46';
        nameInput.style.borderColor = '#10b981';
        nameInput.style.cursor = 'not-allowed';
        
        saveBtn.style.display = "none";
        
        // Add celebration effect
        celebrateSave(fullName);
        
    } catch (error) {
        console.error('Error saving profile:', error);
        showStatus('সেভ করতে সমস্যা: ' + error.message, 'error');
        
        // Reset button
        saveBtn.innerHTML = 'সেভ করুন';
        saveBtn.disabled = false;
        saveBtn.style.backgroundColor = '#10b981';
    }
});

// Celebration effect when name is saved
function celebrateSave(name) {
    // Add success animation
    const nameInput = document.querySelector('#profileForm input[placeholder="Full name"]');
    
    // Add pulsing animation
    nameInput.style.animation = 'pulseSuccess 1.5s ease-in-out';
    
    // Create floating success message
    const floatMsg = document.createElement('div');
    floatMsg.textContent = `✓ ${name}`;
    floatMsg.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 24px;
        font-weight: bold;
        color: #10b981;
        background: rgba(255, 255, 255, 0.9);
        padding: 20px 40px;
        border-radius: 10px;
        box-shadow: 0 10px 30px rgba(16, 185, 129, 0.3);
        z-index: 10000;
        animation: floatUp 2s ease-in-out forwards;
    `;
    
    document.body.appendChild(floatMsg);
    
    // Remove after animation
    setTimeout(() => {
        floatMsg.remove();
        nameInput.style.animation = '';
    }, 2000);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes pulseSuccess {
        0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
        50% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
        100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }
    
    @keyframes floatUp {
        0% { opacity: 0; transform: translate(-50%, -40%); }
        20% { opacity: 1; transform: translate(-50%, -50%); }
        80% { opacity: 1; transform: translate(-50%, -50%); }
        100% { opacity: 0; transform: translate(-50%, -60%); }
    }
    
    .spinner {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top-color: #fff;
        animation: spin 1s ease-in-out infinite;
        margin-right: 8px;
        vertical-align: middle;
    }
    
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    
    #profileForm input {
        transition: all 0.3s ease;
        padding: 12px 15px;
        border: 2px solid #e5e7eb;
        border-radius: 8px;
        font-size: 16px;
        width: 100%;
        margin-bottom: 15px;
        box-sizing: border-box;
    }
    
    #profileForm input:focus {
        outline: none;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    
    #profileForm button {
        background-color: #10b981;
        color: white;
        border: none;
        padding: 12px 30px;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        width: 100%;
        margin-top: 10px;
    }
    
    #profileForm button:hover:not(:disabled) {
        background-color: #0da271;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }
    
    #profileForm button:disabled {
        background-color: #9ca3af;
        cursor: not-allowed;
    }
`;
document.head.appendChild(style);

// Birthday field suggestion (optional enhancement)
function addBirthdayField() {
    const birthdayDiv = document.createElement('div');
    birthdayDiv.innerHTML = `
        <label for="birthday" style="display: block; margin-bottom: 8px; font-weight: 500; color: #4b5563;">
            জন্মদিন (ঐচ্ছিক)
        </label>
        <input 
            type="date" 
            id="birthday" 
            style="width: 100%; padding: 12px 15px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px;"
            max="${new Date().toISOString().split('T')[0]}"
        >
        <small style="display: block; margin-top: 5px; color: #6b7280; font-size: 14px;">
            জন্মদিন সেট করলে আমরা আপনাকে বিশেষ উপহার দিতে পারব
        </small>
    `;
    
    const form = document.querySelector('#profileForm');
    if (form) {
        const phoneInput = document.querySelector('#profileForm input[placeholder="Phone"]');
        if (phoneInput) {
            form.insertBefore(birthdayDiv, phoneInput.nextSibling);
        }
    }
}

// Call this function if you want to add birthday field
// addBirthdayField();

console.log('Profile.js loaded successfully');