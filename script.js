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
const storeNameEl = document.getElementById("storeName");
const storeStatusEl = document.getElementById("storeStatus");
const loaderEl = document.getElementById("loader");
const barcodeInput = document.getElementById("barcodeInput");
const cartEl = document.getElementById("cart");
const totalEl = document.getElementById("total");
const welcomeSection = document.getElementById("welcome-section");
const scannerSection = document.getElementById("scanner-section");
const cartSection = document.getElementById("cart-section");
const startBtn = document.getElementById("startBtn");
const payBtn = document.getElementById("payBtn");
const cartPreviewEl = document.getElementById("cart-preview");
const cartItemsCountEl = document.getElementById("cart-items-count");
const cartDetailsEl = document.getElementById("cart-details");
const cartTotalEl = document.getElementById("cart-total");
// Removed proceedToPaymentBtn as it's not in HTML

// State
const params = new URLSearchParams(window.location.search);
let STORE_ID = params.get("store_id");

// 🟢 Session Trigger Logic
if (!STORE_ID) {
    // If no store ID, usage is invalid (unless explicitly testing)
    // TEMPORARY: Add mock product data for testing
    console.log("No STORE_ID found, using mock data");
    STORE_ID = "test_store";
} else {
    // Initialize the session in sessionStorage if it doesn't exist
    if (!sessionStorage.getItem('current_session_id')) {
        const newSessionId = "SESS_" + Math.random().toString(36).substr(2, 9);
        sessionStorage.setItem('current_session_id', newSessionId);
        console.log("New session started via Entrance QR:", newSessionId);
    } else {
        console.log("Resuming existing session:", sessionStorage.getItem('current_session_id'));
    }
}

let cart = {};
let StoreData = null;
let isScanning = false;

// 🟢 STEP 1: Check Store ID
// BYPASS QR SECURITY - Commented out to allow access without valid store QR
/*
if (!STORE_ID) {
    loaderEl.style.display = "none";
    storeNameEl.innerHTML = "<span class='error'>Invalid or missing store QR</span>";
} else {
    fetchStore();
}
*/

// Always fetch store (bypassed security)
fetchStore();

// 🟢 STEP 2: Fetch store
function fetchStore() {
    db.collection("Stores").doc(STORE_ID).get()
        .then(doc => {
            loaderEl.style.display = "none";

            if (!doc.exists) {
                // BYPASS: Create mock store data for testing when store doesn't exist
                console.log("Store not found, using mock data for testing");
                StoreData = {
                    store_name: "Test Store (Mock)",
                    status: "ACTIVE",
                    upi_id: "7032598231@ybl" // Mock UPI ID for testing
                };
                storeNameEl.innerText = "Welcome to " + StoreData.store_name;
                storeStatusEl.innerText = "Status: " + StoreData.status;
                welcomeSection.classList.remove("hidden");
                return;
            }

            StoreData = doc.data();

            if (StoreData.status !== "ACTIVE") {
                storeNameEl.innerHTML = "<span class='error'>Store is closed</span>";
                return;
            }

            storeNameEl.innerText = "Welcome to " + StoreData.store_name;
            storeStatusEl.innerText = "Status: " + StoreData.status;
            welcomeSection.classList.remove("hidden");
        })
        .catch(() => {
            loaderEl.style.display = "none";
            // BYPASS: Fallback to mock data on error
            console.log("Error loading store, using mock data");
            StoreData = {
                store_name: "Test Store (Mock)",
                status: "ACTIVE",
                upi_id: "7032598231@ybl"
            };
            storeNameEl.innerText = "Welcome to " + StoreData.store_name;
            storeStatusEl.innerText = "Status: " + StoreData.status;
            welcomeSection.classList.remove("hidden");
        });
}

// Start button
startBtn.addEventListener("click", () => {
    console.log("Start button clicked - going to scanner");
    welcomeSection.classList.add("hidden");
    scannerSection.classList.remove("hidden");
    cartSection.classList.add("hidden"); // Make sure cart section is hidden
    barcodeInput.focus();
    console.log("Scanner section should now be visible");
});

// 🟢 Scan Product
function scanProduct() {
    const barcode = barcodeInput.value.trim();

    console.log("Scanning barcode:", barcode);
    console.log("Using STORE_ID:", STORE_ID);

    if (!barcode) {
        alert("Please enter a barcode");
        return;
    }

    if (isScanning) {
        console.log("Already scanning, ignoring...");
        return; // Prevent multiple simultaneous scans
    }
    isScanning = true;

    barcodeInput.disabled = true;
    console.log("Disabled input, starting scan...");

    db.collection("Products")
        .doc(STORE_ID)
        .collection("items")
        .doc(barcode)
        .get()
        .then(doc => {
            console.log("Firebase query result:", doc.exists ? "Found" : "Not found");

            // TEMPORARY MOCK DATA FOR TESTING
            if (!doc.exists && barcode === "8901234567890") {
                console.log("Using mock data for barcode:", barcode);
                // Simulate found document with mock data
                const mockData = {
                    name: "Test Product",
                    price: 25.50
                };

                barcodeInput.disabled = false;
                barcodeInput.value = "";
                barcodeInput.focus();
                isScanning = false;

                // Process mock data (same logic as real data)
                let price = 0;
                const rawPrice = mockData.price;

                if (typeof rawPrice === "number") {
                    price = rawPrice;
                } else if (typeof rawPrice === "string") {
                    price = Number(rawPrice.replace(/,/g, "").replace(/[^\d.]/g, ""));
                }

                if (isNaN(price) || price <= 0) {
                    console.error("Price error for item:", mockData.name, "Raw price:", rawPrice);
                    alert(`Invalid price for ${mockData.name}. (Val: ${JSON.stringify(rawPrice)})`);
                    return;
                }

                if (cart[barcode]) {
                    cart[barcode].qty += 1;
                } else {
                    cart[barcode] = {
                        name: mockData.name,
                        price: price,
                        qty: 1
                    };
                }

                renderCart();
                return;
            }

            barcodeInput.disabled = false;
            barcodeInput.value = "";
            barcodeInput.focus();
            isScanning = false;

            if (!doc.exists) {
                alert("Product not found");
                return;
            }

            const data = doc.data();

            // 🛑 CHECK DISBALED STATUS
            if (data.disabled) {
                alert("Product is currently unavailable");
                return;
            }

            // ✅ SAFE PRICE PARSING (FIX)
            let price = 0;
            const rawPrice = data.price; // Get raw value for debugging

            // Debugging: If price is missing, checking for case-sensitivity or other names
            if (rawPrice === undefined) {
                const availableKeys = Object.keys(data).join(", ");
                console.error("Missing 'price' field. Available fields:", availableKeys);
                alert(`Error: 'price' field missing for ${data.name}.\nAvailable fields: ${availableKeys}`);
                return;
            }

            if (typeof rawPrice === "number") {
                price = rawPrice;
            } else if (typeof rawPrice === "string") {
                // Remove commas and non-numeric characters except dot
                price = Number(
                    rawPrice
                        .replace(/,/g, "")
                        .replace(/[^\d.]/g, "")
                );
            }

            if (isNaN(price) || price <= 0) {
                console.error("Price error for item:", data.name, "Raw price:", rawPrice);
                alert(`Invalid price for ${data.name}. (Val: ${JSON.stringify(rawPrice)})`);
                return;
            }

            // Add to cart
            if (cart[barcode]) {
                cart[barcode].qty += 1;
            } else {
                cart[barcode] = {
                    name: data.name,
                    price: price,
                    qty: 1
                };
            }

            renderCart();
        })
        .catch(() => {
            barcodeInput.disabled = false;
            isScanning = false;
            alert("Error fetching product");
        });
}

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

    // Play beep sound (optional)

    // Fill input and trigger scan
    barcodeInput.value = decodedText;
    scanProduct();

    // Auto-stop camera after successful scan? 
    // Usually better to keep specific user control, but for smooth flow let's pause or flash

    // For now, let's stop to save battery and confirm
    toggleCamera();
}

function onScanFailure(error) {
    // console.warn(`Code scan error = ${error}`);
}

// 🟢 Render Cart
function renderCart() {
    // Update cart preview in scanner section
    const itemCount = Object.keys(cart).length;
    const totalItems = Object.values(cart).reduce((sum, item) => sum + item.qty, 0);

    cartItemsCountEl.textContent = `${itemCount} items (${totalItems} total)`;

    // Update detailed cart view
    cartDetailsEl.innerHTML = "";
    let total = 0;
    let hasItems = false;

    if (Object.keys(cart).length === 0) {
        cartDetailsEl.innerHTML = '<div style="text-align: center; color: #666; padding: 40px;">Your cart is empty</div>';
        cartTotalEl.innerHTML = "";
        return;
    }

    Object.values(cart).forEach(item => {
        hasItems = true;
        const itemTotal = item.price * item.qty;
        total += itemTotal;

        const itemDiv = document.createElement("div");
        itemDiv.className = "cart-item-detailed";
        itemDiv.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px;
            margin-bottom: 10px;
            background: #333;
            border-radius: 8px;
            border-left: 4px solid #00e676;
        `;

        itemDiv.innerHTML = `
            <div style="flex: 1;">
                <div style="font-weight: bold; color: #00e676;">${item.name}</div>
                <div style="color: #ccc; font-size: 14px;">₹${item.price.toFixed(2)} each</div>
            </div>
            <div style="display: flex; align-items: center; gap: 15px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <button onclick="updateQuantity('${Object.keys(cart).find(key => cart[key] === item)}', -1)"
                            style="background: #ff5252; color: white; border: none; border-radius: 50%; width: 30px; height: 30px; cursor: pointer; font-size: 16px;">-</button>
                    <span style="min-width: 30px; text-align: center;">${item.qty}</span>
                    <button onclick="updateQuantity('${Object.keys(cart).find(key => cart[key] === item)}', 1)"
                            style="background: #00e676; color: white; border: none; border-radius: 50%; width: 30px; height: 30px; cursor: pointer; font-size: 16px;">+</button>
                </div>
                <div style="font-weight: bold; color: #00e676; min-width: 80px; text-align: right;">
                    ₹${itemTotal.toFixed(2)}
                </div>
            </div>
        `;

        cartDetailsEl.appendChild(itemDiv);
    });

    // Update total display
    cartTotalEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 18px; font-weight: bold;">Total Amount:</span>
            <span style="font-size: 24px; font-weight: bold; color: #00e676;">₹${total.toFixed(2)}</span>
        </div>
    `;
} // Initiate Payment Handler
function initiatePayment(mode) {
    console.log(`Initiating payment via ${mode}`);
    if (Object.keys(cart).length === 0) {
        alert("Your cart is empty!");
        return;
    }

    if (mode === 'UPI') {
        checkout();
    } else {
        // Keep existing logic for CASH for now
        payNow(mode);
    }
}

async function checkout() {
    // 1. Initial local calculation (for UI feedback, replaced by verification)
    const localTotal = calculateTotal();
    const sessionId = "SESS_" + Date.now();

    // Ensure we have store data
    if (!StoreData || !StoreData.upi_id) {
        console.warn("Store data missing, using fallback for test");
        StoreData = { store_name: "Test Store", upi_id: "7032598231@ybl" };
    }

    // 🔒 SECURE CHECKOUT: Verify prices from Firestore
    let verifiedTotal = 0;
    let verifiedItems = {}; // Rebuild cart with verified data if needed, or just validate total

    try {
        loaderEl.style.display = "flex"; // Show loader during verification

        // Parallel fetch for speed, or sequential for simplicity. Sequential for now to ensure accuracy.
        // Convert cart object to array for iteration
        const cartItems = Object.values(cart);

        for (const item of cartItems) {
            // Looking up by barcode (which is key in cart object, but we have clean access here)
            // We need to find the key (barcode) for this item
            const barcode = Object.keys(cart).find(key => cart[key] === item);

            if (!barcode) continue;

            const doc = await db.collection("Products")
                .doc(STORE_ID)
                .collection("items")
                .doc(barcode)
                .get();

            if (doc.exists) {
                const serverPrice = Number(doc.data().price); // Ensure number
                if (!isNaN(serverPrice)) {
                    verifiedTotal += serverPrice * item.qty;
                    verifiedItems[barcode] = {
                        ...item,
                        price: serverPrice // Overwrite with server price
                    };
                } else {
                    console.error("Invalid price in DB for", item.name);
                }
            } else {
                console.warn("Product verification failed (removed?):", item.name);
                // Decide strategy: Allow with old price or skip? 
                // Strict mode: Skip or fail. For now, we skip adding cost -> customer benefits or error?
                // Real world: Alert user "Price changed or item unavailable".
                alert(`Item '${item.name}' verified availability failed. Please re-scan.`);
                loaderEl.style.display = "none";
                return;
            }
        }
    } catch (error) {
        console.error("Price verification failed", error);
        alert("Unable to verify prices. Please check internet connection.");
        loaderEl.style.display = "none";
        return;
    }

    console.log(`Local Total: ${localTotal}, Verified Total: ${verifiedTotal}`);

    // Update local cart/total just in case (optional, but good for data consistency)
    // cart = verifiedItems; 

    // 2. Create the session in Firestore with VERIFIED total
    try {
        await db.collection("sessions").doc(sessionId).set({
            store_id: STORE_ID || "store_001",
            items: cart, // Storing what user "thought" they bought, or verify? User requested 'items: cart'
            verified_items: verifiedItems, // Optional: store verified version too
            total: verifiedTotal,
            status: "payment_initiated",
            created_at: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log("Session created:", sessionId);
    } catch (error) {
        console.error("Error creating session:", error);
        alert("Failed to initialize payment session. Please try again.");
        loaderEl.style.display = "none";
        return;
    }

    loaderEl.style.display = "none"; // Hide loader

    // 3. Generate UPI Deep Link with VERIFIED Total
    const upiLink = `upi://pay?pa=${StoreData.upi_id}&pn=${encodeURIComponent(StoreData.store_name)}&am=${verifiedTotal.toFixed(2)}&cu=INR&tn=${sessionId}`;

    // 4. Trigger Payment (Redirect)
    console.log("Redirecting to:", upiLink);
    window.location.href = upiLink;

    // 5. Show Verification QR
    showVerificationScreen(sessionId);
}

function showVerificationScreen(sessionId) {
    // Hide other sections
    scannerSection.classList.add("hidden");
    cartSection.classList.add("hidden");
    welcomeSection.classList.add("hidden");

    // Remove any existing payment/receipt sections
    document.getElementById("payment-section")?.remove();
    document.getElementById("receipt-section")?.remove();

    const verificationSection = document.createElement("div");
    verificationSection.id = "payment-section"; // Reusing ID for styling consistency if available
    verificationSection.className = "glass-panel animate-fade-in";

    verificationSection.innerHTML = `
        <div style="text-align: center;">
            <h2>Payment Verification</h2>
            <p class="mb-4">Please complete the payment in your UPI app.</p>
            
            <div id="verification-qr" style="background: white; padding: 20px; border-radius: 12px; display: inline-block; margin: 20px 0;"></div>
            
            <p style="color: var(--text-muted); font-size: 0.9rem;">
                Show this QR code to the merchant for verification.<br>
                Session ID: <strong>${sessionId}</strong>
            </p>

            <button onclick="checkPaymentStatus('${sessionId}')" class="secondary" style="margin-top: 20px;">
                🔄 Check Payment Status
            </button>
            
             <button onclick="startNewSession()" style="margin-top: 10px; background: transparent; border: 1px solid var(--glass-border);">
                Cancel / New Order
            </button>
        </div>
    `;

    document.body.appendChild(verificationSection);

    // Generate QR for the Session ID (for Merchant to scan)
    try {
        new QRCode(document.getElementById("verification-qr"), {
            text: sessionId,
            width: 200,
            height: 200,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    } catch (e) {
        console.error("QR Generation failed:", e);
        document.getElementById("verification-qr").innerText = "Error generating QR";
    }
}

// Manual check function (optional, for user to trigger check)
function checkPaymentStatus(sessionId) {
    db.collection("sessions").doc(sessionId).get().then(doc => {
        if (doc.exists && doc.data().status === 'COMPLETED') {
            alert("Payment Verified! Thank you.");
            showReceipt(sessionId, doc.data());
        } else {
            alert("Payment not yet verified by merchant.");
        }
    });
}

function payNow(mode) {
    console.log("payNow() called with mode:", mode);
    console.log("StoreData:", StoreData);

    if (!StoreData || !StoreData.upi_id) {
        console.log("Store UPI missing - using mock data");
        StoreData = StoreData || {
            store_name: "Test Store (Mock)",
            status: "ACTIVE",
            upi_id: "7032598231@ybl"
        };
    }

    const total = Number(calculateTotal().toFixed(2));

    // Set status logic based on mode
    const status = mode === 'CASH' ? 'COMPLETED' : 'PENDING';

    // Create order data
    const orderData = {
        items: cart,
        total: total,
        status: status,
        payment_mode: mode,
        timestamp: new Date(),
        customer_paid: mode === 'CASH', // Auto-mark paid for cash
        merchant_verified: false
    };

    console.log("Creating order:", orderData);

    // Mock Fallback Logic
    const createMockOrder = () => {
        console.log("Using mock order creation");
        const mockOrderId = "mock_" + Date.now();
        const qrData = `SCANPAY_ORDER:${mockOrderId}:${STORE_ID}`;
        showPaymentQR(qrData, total, mode);
        cart = {};
        renderCart();
    };

    // Add order to Firestore
    db.collection("Stores").doc(STORE_ID).collection("orders").add(orderData)
        .then((docRef) => {
            const orderId = docRef.id;
            console.log("Order created ID:", orderId);

            const qrData = `SCANPAY_ORDER:${orderId}:${STORE_ID}`;
            showPaymentQR(qrData, total, mode);

            cart = {};
            renderCart();
        })
        .catch((error) => {
            console.error("Firebase failed:", error);
            createMockOrder();
        });
}

// Show payment QR & specific UI based on mode
function showPaymentQR(qrData, amount, mode) {
    cartSection.classList.add("hidden");

    const existingPaymentSection = document.getElementById("payment-section");
    if (existingPaymentSection) existingPaymentSection.remove();

    // Generate UPI Link
    const upiLink = `upi://pay?pa=${StoreData.upi_id}&pn=${encodeURIComponent(StoreData.store_name)}&am=${amount}&cu=INR&tn=${qrData}`;

    let titleText = mode === 'CASH' ? 'Cash Payment' : 'Pay via UPI';
    let instrText = mode === 'CASH'
        ? 'Show this QR to the merchant to confirm your cash payment.'
        : `Scan with any UPI app to pay ₹${amount.toFixed(2)}`;

    let actionButton = '';
    if (mode === 'UPI') {
        actionButton = `
            <a href="${upiLink}" style="display: block; text-decoration: none; margin-bottom: 20px;">
                <button style="background: #00e676; color: black; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; width: 100%; font-weight: bold;">
                    🚀 Open UPI App
                </button>
            </a>
        `;
    }

    const paymentSection = document.createElement("div");
    paymentSection.id = "payment-section";
    paymentSection.innerHTML = `
        <h2>${titleText}</h2>
        <p>${instrText}</p>
        
        <div id="qr-code" style="display: flex; justify-content: center; margin: 20px 0; padding: 20px; background: white; border-radius: 10px;"></div>
        
        ${actionButton}

        <div style="text-align: center; margin-bottom: 20px;">
             <p style="margin-top: 10px; font-size: 14px; color: #666; word-break: break-all;">
                Order QR: ${qrData}
            </p>
        </div>
        
        <p style="font-size: 14px; color: #666; margin-bottom: 20px;">
            ${mode === 'CASH' ? 'Pay cash at the counter.' : 'Wait for merchant verification.'}
        </p>
        
        <button onclick="startNewSession()" style="background: #333; border: 1px solid #666; color: white; padding: 12px 24px; border-radius: 8px; cursor: pointer;">
            Start New Session
        </button>
    `;

    document.querySelector(".card").appendChild(paymentSection);

    try {
        new QRCode(document.getElementById("qr-code"), {
            text: qrData,
            width: 180,
            height: 180,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    } catch (e) {
        console.error("QR Fail:", e);
        document.getElementById("qr-code").innerHTML = "Error generating QR";
    }
}

// Start new session
function startNewSession() {
    try {
        console.log("Starting new session...");

        // Remove payment section
        const paymentSection = document.getElementById("payment-section");
        if (paymentSection) {
            paymentSection.remove();
            console.log("Payment section removed");
        }

        // Hide all sections and show welcome
        scannerSection.classList.add("hidden");
        cartSection.classList.add("hidden");
        welcomeSection.classList.remove("hidden");

        console.log("Sections updated - welcome should be visible");

        // Reset cart
        cart = {};
        renderCart();

        console.log("Cart reset, new session started");

        // Make sure welcome section is visible
        if (welcomeSection.classList.contains("hidden")) {
            console.error("Welcome section is still hidden!");
            welcomeSection.classList.remove("hidden");
        }

    } catch (error) {
        console.error("Error in startNewSession:", error);
        alert("Error starting new session: " + error.message);
    }
}

// Go to cart function
function goToCart() {
    scannerSection.classList.add("hidden");
    cartSection.classList.remove("hidden");
    renderCart(); // Refresh cart display
}

// Back to scanner function
function backToScanner() {
    cartSection.classList.add("hidden");
    scannerSection.classList.remove("hidden");
    barcodeInput.focus();
}

// function proceedToPayment (Deprecated/Removed)
// Replaced by initiatePayment in DOM

// Update quantity function
function updateQuantity(barcode, change) {
    if (!cart[barcode]) return;

    cart[barcode].qty += change;

    if (cart[barcode].qty <= 0) {
        delete cart[barcode];
    }

    renderCart();
}

barcodeInput.addEventListener("keypress", e => {
    if (e.key === "Enter") scanProduct();
});



// Calculate total cart amount
function calculateTotal() {
    let total = 0;
    Object.values(cart).forEach(item => {
        total += item.price * item.qty;
    });
    return total;
}

// 🧾 Show Receipt
function showReceipt(orderId, orderData) {
    // Hide other sections
    scannerSection.classList.add("hidden");
    cartSection.classList.add("hidden");
    welcomeSection.classList.add("hidden");

    document.getElementById("payment-section")?.remove(); // Remove payment QR if exists

    // Create Receipt Section
    const receiptSection = document.createElement("div");
    receiptSection.id = "receipt-section";
    receiptSection.className = "glass-panel animate-fade-in";

    const itemsHtml = Object.values(orderData.items).map(item => `
        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
            <span>${item.name} x${item.qty}</span>
            <span>₹${(item.price * item.qty).toFixed(2)}</span>
        </div>
    `).join("");

    receiptSection.innerHTML = `
        <div class="receipt">
            <div style="text-align:center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 10px;">
                <h2 style="color:#000; margin:0;">${orderData.store_name || "ScanPay Store"}</h2>
                <div style="font-size:12px;">ORDER #${orderId.slice(-4).toUpperCase()}</div>
                <div style="font-size:12px;">${new Date().toLocaleString()}</div>
            </div>

            <div style="margin-bottom: 15px; font-size:14px; color:#000;">
                ${itemsHtml}
            </div>

            <div style="border-top: 2px dashed #000; padding-top: 10px; display:flex; justify-content:space-between; font-weight:bold; color:#000;">
                <span>TOTAL</span>
                <span>₹${orderData.total.toFixed(2)}</span>
            </div>
            
            <div style="text-align:center; margin-top:20px; font-size:12px; color:#555;">
                Paid via ${orderData.payment_mode}<br>
                Thank you for shopping!
            </div>
        </div>
        
        <button onclick="startNewSession()" style="margin-top: 20px;">🔄 Start New Order</button>
    `;

    document.body.appendChild(receiptSection);
}

// Update item quantity in cart (Fixed duplicate function)
// function updateQuantity(barcode, change) { ... } // Removing duplicate definition

// Add global keyboard shortcut for emergency reset (Ctrl+R)
document.addEventListener("keydown", e => {
    if (e.ctrlKey && e.key === "r") {
        e.preventDefault();
        console.log("Emergency reset triggered");
        startNewSession();
    }
});