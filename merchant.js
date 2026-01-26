// 🔐 Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyC9vA-cnki4Rm-1QW8Y6GiCagw5yiu6UOs",
    authDomain: "scanpay-7a3fd.firebaseapp.com",
    projectId: "scanpay-7a3fd",
    storageBucket: "scanpay-7a3fd.firebasestorage.app",
    messagingSenderId: "979835689544",
    appId: "1:979835689544:web:d2dd608932a68a3da1167d"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// DOM Elements
const storeInfoEl = document.getElementById("store-info");
const ordersContainer = document.getElementById("orders-container");
const qrInput = document.getElementById("qrInput");
const verificationResult = document.getElementById("verification-result");

// State
const params = new URLSearchParams(window.location.search);
let STORE_ID = params.get("store_id");

// BYPASS QR SECURITY - Set default store ID if missing
if (!STORE_ID) {
    STORE_ID = "test_store"; // Temporary test store ID
}

// 🟢 Check Store ID
// BYPASS QR SECURITY - Commented out to allow access without valid store QR
/*
if (!STORE_ID) {
    storeInfoEl.innerText = "Error: No Store ID provided";
    ordersContainer.innerHTML = "";
    throw new Error("No Store ID");
}
*/

// Always proceed (bypassed security)

// Verify payment function
function verifyPayment() {
    const qrData = qrInput.value.trim();

    if (!qrData) {
        verificationResult.innerHTML = '<span style="color: #ff5252;">Please enter QR data</span>';
        return;
    }

    // Parse QR data (format: SCANPAY_ORDER:orderId:storeId)
    const parts = qrData.split(':');
    if (parts.length !== 3 || parts[0] !== 'SCANPAY_ORDER') {
        verificationResult.innerHTML = '<span style="color: #ff5252;">Invalid QR format</span>';
        return;
    }

    const orderId = parts[1];
    const orderStoreId = parts[2];

    console.log("Verifying order:", orderId, "from store:", orderStoreId);

    // Fetch order details
    db.collection("Stores").doc(orderStoreId).collection("orders").doc(orderId).get()
        .then(doc => {
            if (!doc.exists) {
                verificationResult.innerHTML = '<span style="color: #ff5252;">Order not found</span>';
                return;
            }

            const orderData = doc.data();

            // Mark order as verified
            db.collection("Stores").doc(orderStoreId).collection("orders").doc(orderId)
                .update({
                    merchant_verified: true,
                    verified_at: firebase.firestore.FieldValue.serverTimestamp()
                })
                .then(() => {
                    // Show verification success
                    showVerificationSuccess(orderData);
                    qrInput.value = ""; // Clear input
                })
                .catch(error => {
                    console.error("Error updating order:", error);
                    verificationResult.innerHTML = '<span style="color: #ff5252;">Error verifying payment</span>';
                });
        })
        .catch(error => {
            console.error("Error fetching order:", error);
            verificationResult.innerHTML = '<span style="color: #ff5252;">Error fetching order details</span>';
        });
}

// Show verification success with order details
function showVerificationSuccess(orderData) {
    const itemsHtml = Object.values(orderData.items || {}).map(item =>
        `<div>${item.name} x${item.qty} - ₹${(item.price * item.qty).toFixed(2)}</div>`
    ).join('');

    verificationResult.innerHTML = `
        <div style="background: #e8f5e8; border: 1px solid #00e676; border-radius: 8px; padding: 15px; margin-top: 10px;">
            <h4 style="color: #00e676; margin: 0 0 10px 0;">✅ ${orderData.payment_mode === 'CASH' ? 'Cash Received' : 'Payment Verified'}!</h4>
            <div style="font-size: 14px;">
                <strong>Order Details:</strong><br>
                ${itemsHtml}
                <hr style="border: none; border-top: 1px solid #ccc; margin: 10px 0;">
                <div style="display: flex; justify-content: space-between;">
                    <strong>Total: ₹${orderData.total?.toFixed(2) || '0.00'}</strong>
                    <span style="background: #333; color: white; padding: 2px 6px; border-radius: 4px; font-size: 12px;">${orderData.payment_mode || 'UPI'}</span>
                </div>
            </div>
        </div>
    `;

    // Auto-clear after 5 seconds
    setTimeout(() => {
        verificationResult.innerHTML = '';
    }, 5000);
}

// 🟢 Fetch Store Meta
db.collection("Stores").doc(STORE_ID).get().then(doc => {
    if (doc.exists) {
        storeInfoEl.innerText = doc.data().store_name;
    } else {
        // BYPASS: Use mock store name when store doesn't exist
        console.log("Store not found, using mock data for testing");
        storeInfoEl.innerText = "Test Store (Mock)";
    }
}).catch(() => {
    // BYPASS: Fallback to mock data on error
    console.log("Error loading store, using mock data");
    storeInfoEl.innerText = "Test Store (Mock)";
});

// 🟢 Real-time Orders Listener
db.collection("Stores")
    .doc(STORE_ID)
    .collection("orders")
    .orderBy("timestamp", "desc")
    .limit(20)
    .onSnapshot((snapshot) => {
        ordersContainer.innerHTML = "";

        if (snapshot.empty) {
            ordersContainer.innerHTML = "<div class='empty-state'>No active orders</div>";
            return;
        }

        snapshot.forEach((doc) => {
            renderOrder(doc.id, doc.data());
        });
    }, (error) => {
        console.error("Error getting orders:", error);
        ordersContainer.innerHTML = "<div class='error'>Error loading orders.</div>";
    });

function renderOrder(id, data) {
    // Calculate total from items if not present (fallback)
    const total = data.total ? data.total.toFixed(2) : "0.00";

    // Format Items
    let itemsHtml = "";
    if (data.items) {
        for (const [key, item] of Object.entries(data.items)) {
            itemsHtml += `
                <div style="display:flex; justify-content:space-between; font-size: 0.9rem;">
                    <span>${item.name} <small>x${item.qty}</small></span>
                    <span>₹${(item.price * item.qty).toFixed(2)}</span>
                </div>
            `;
        }
    }

    // Format Time
    let timeString = "Just now";
    if (data.timestamp) {
        timeString = new Date(data.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Check verification status
    let statusColor = "#ff9800"; // Orange for pending
    let statusText = "Pending Verification";

    if (data.merchant_verified) {
        statusColor = "#00e676"; // Green for verified
        statusText = "Verified ✓";
    }

    const card = document.createElement("div");
    card.className = "order-card";
    card.innerHTML = `
        <div class="order-header">
            <span>Order #${id.slice(-4).toUpperCase()}</span>
            <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span>
        </div>
        <div class="order-items">
            ${itemsHtml}
        </div>
        <div class="order-total">
            Total: ₹${total}
        </div>
    `;

    ordersContainer.appendChild(card);
}

// Add event listener for QR input
qrInput.addEventListener("keypress", e => {
    if (e.key === "Enter") {
        verifyPayment();
    }
});

// 📷 Camera Logic
let html5QrCode;
let cameraRunning = false;

function toggleCamera() {
    const readerEl = document.getElementById("reader");

    if (cameraRunning) {
        // Stop camera
        html5QrCode.stop().then(() => {
            readerEl.style.display = "none";
            cameraRunning = false;
            document.querySelector("button[onclick='toggleCamera()']").innerHTML = "📷 Scan with Camera";
        }).catch(err => {
            console.log("Failed to stop camera", err);
        });
        return;
    }

    // Start camera
    readerEl.style.display = "block";
    html5QrCode = new Html5Qrcode("reader");

    document.querySelector("button[onclick='toggleCamera()']").innerHTML = "❌ Stop Camera";
    cameraRunning = true;

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess, onScanFailure)
        .catch(err => {
            console.error("Error starting camera", err);
            alert("Camera error: " + err);
            readerEl.style.display = "none";
            cameraRunning = false;
            document.querySelector("button[onclick='toggleCamera()']").innerHTML = "📷 Scan with Camera";
        });
}

function onScanSuccess(decodedText, decodedResult) {
    console.log(`Scan result: ${decodedText}`, decodedResult);

    // Fill input and trigger verification
    qrInput.value = decodedText;
    verifyPayment();

    // Stop camera
    toggleCamera();
}

function onScanFailure(error) {
    // console.warn(`Code scan error = ${error}`);
}
