/* global firebase, QRCode, Html5Qrcode */

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyC9vA-cnki4Rm-1QW8Y6GiCagw5yiu6UOs",
    authDomain: "scanpay-7a3fd.firebaseapp.com",
    projectId: "scanpay-7a3fd",
    storageBucket: "scanpay-7a3fd.firebasestorage.app",
    messagingSenderId: "979835689544",
    appId: "1:979835689544:web:d2dd608932a68a3da1167d"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// DOM
const appLoaderEl = document.getElementById("app-loader");
const appRootEl = document.getElementById("app-root");
const storeNameEl = document.getElementById("storeName");
const storeStatusEl = document.getElementById("storeStatus");
const welcomeSection = document.getElementById("welcome-section");
const scannerSection = document.getElementById("scanner-section");
const cartSection = document.getElementById("cart-section");
const startBtn = document.getElementById("startBtn");
const barcodeInput = document.getElementById("barcodeInput");
const addProductBtn = document.getElementById("addProductBtn");
const toggleCameraBtn = document.getElementById("toggleCameraBtn");
const searchSuggestionsEl = document.getElementById("search-suggestions");
const goToCartBtn = document.getElementById("goToCartBtn");
const backToScannerBtn = document.getElementById("backToScannerBtn");
const payUpiBtn = document.getElementById("payUpiBtn");
const payCashBtn = document.getElementById("payCashBtn");
const payCounterBtn = document.getElementById("payCounterBtn");
const cartStatusEl = document.getElementById("cart-status");
const cartItemsCountEl = document.getElementById("cart-items-count");
const cartPreviewEl = document.getElementById("cart-preview");
const cartDetailsEl = document.getElementById("cart-details");
const cartTotalEl = document.getElementById("cart-total");
const scanStatusEl = document.getElementById("scan-status");
const paymentSectionEl = document.getElementById("payment-section");
const successSectionEl = document.getElementById("success-section");

// State
const params = new URLSearchParams(window.location.search);
let STORE_ID = params.get("store_id") || "test_store";
let StoreData = null;
let cart = {};
let flow = "welcome"; // welcome | scanning | cart | paying | success
let isFetching = false;
let transactionLocked = false;
let html5QrCode = null;
let cameraRunning = false;
let productsCache = {};
let productsReady = false;
let searchIndex = [];
let orderListenerUnsub = null;
const BARCODE_RE = /^\d{8,14}$/;

// Global loading: never blank screen
function hideAppLoader() {
    if (!appLoaderEl) return;
    appLoaderEl.classList.add("hidden");
    if (appRootEl) appRootEl.classList.remove("hidden");
}

function showProcessing(msg) {
    if (!appLoaderEl) return;
    appLoaderEl.classList.remove("hidden");
    const label = appLoaderEl.querySelector(".loader-label");
    if (label) label.textContent = msg || "Processing...";
    if (appRootEl) appRootEl.classList.add("hidden");
}

// Strict flow: only one screen visible
function showScreen(screenId) {
    [welcomeSection, scannerSection, cartSection, paymentSectionEl, successSectionEl].forEach(el => {
        if (!el) return;
        el.classList.add("hidden");
    });
    const el = document.getElementById(screenId);
    if (el) el.classList.remove("hidden");
}

function goWelcome() {
    flow = "welcome";
    showScreen("welcome-section");
}

function goScanner() {
    if (StoreData && StoreData.status !== "ACTIVE") return;
    flow = "scanning";
    showScreen("scanner-section");
    if (barcodeInput) {
        barcodeInput.value = "";
        barcodeInput.focus();
    }
    clearSuggestions();
    if (!productsReady) {
        setScanStatus("Loading products...", false);
    } else {
        setScanStatus("", false);
    }
    renderCartPreview();
}

function goCart() {
    flow = "cart";
    showScreen("cart-section");
    setCartStatus("", false);
    renderCart();
}

function openCart() {
    goCart();
    const el = document.getElementById("cart-section");
    el?.scrollIntoView({ behavior: "smooth" });
}

function setScanStatus(msg, isError) {
    if (!scanStatusEl) return;
    scanStatusEl.textContent = msg || "";
    scanStatusEl.classList.remove("fetching", "error");
    if (msg) scanStatusEl.classList.add(isError ? "error" : "fetching");
}

function setCartStatus(msg, isError) {
    if (!cartStatusEl) return;
    cartStatusEl.textContent = msg || "";
    cartStatusEl.classList.remove("fetching", "error");
    if (msg) cartStatusEl.classList.add(isError ? "error" : "fetching");
}

function setPaymentButtonsDisabled(disabled) {
    [payUpiBtn, payCashBtn, payCounterBtn].forEach(btn => {
        if (!btn) return;
        btn.disabled = !!disabled;
    });
}

function setStoreError(msg) {
    if (storeNameEl) storeNameEl.textContent = msg || "Store not available";
    if (storeStatusEl) {
        storeStatusEl.textContent = "INACTIVE";
        storeStatusEl.className = "badge error";
    }
    if (startBtn) startBtn.disabled = true;
    hideAppLoader();
    goWelcome();
}

// Store fetch
function fetchStore() {
    db.collection("Stores").doc(STORE_ID).get()
        .then(doc => {
            if (!doc.exists) {
                setStoreError("Store not found");
                return;
            }
            StoreData = doc.data();
            const status = StoreData.status || "UNKNOWN";
            if (storeNameEl) storeNameEl.textContent = StoreData.store_name || "Store";
            if (storeStatusEl) {
                storeStatusEl.textContent = status;
                storeStatusEl.className = status === "ACTIVE" ? "badge active" : "badge error";
            }
            if (startBtn) startBtn.disabled = status !== "ACTIVE";
            hideAppLoader();
            goWelcome();
            listenProducts();
        })
        .catch(() => {
            setStoreError("Error loading store");
        });
}

function listenProducts() {
    productsReady = false;
    if (addProductBtn) addProductBtn.disabled = true;
    if (flow === "scanning") setScanStatus("Loading products...", false);
    db.collection("Products").doc(STORE_ID).collection("items").get()
        .then(snapshot => {
            const next = {};
            snapshot.forEach(doc => {
                next[doc.id] = doc.data();
            });
            productsCache = next;
            buildSearchIndex(next);
            productsReady = true;
            if (addProductBtn) addProductBtn.disabled = false;
            if (flow === "scanning") setScanStatus("", false);
        })
        .catch(() => {
            productsReady = true;
            if (addProductBtn) addProductBtn.disabled = false;
            if (flow === "scanning") setScanStatus("", false);
        });
}

// Scan -> Fetch -> Display
function handleBarcode(raw) {
    const barcode = String(raw || "").trim();
    if (!barcode) {
        setScanStatus("Enter a barcode", true);
        return;
    }
    if (transactionLocked) return;
    if (flow !== "scanning" && flow !== "cart") return;
    if (isFetching) return;
    if (StoreData && StoreData.status !== "ACTIVE") return;

    isFetching = true;
    setScanStatus("Fetching product...", false);
    if (addProductBtn) addProductBtn.disabled = true;
    if (barcodeInput) barcodeInput.disabled = true;
    clearSuggestions();

    const cached = productsCache[barcode];
    if (productsReady) {
        if (!cached) {
            setScanStatus("Product not found. Rescan or try another barcode.", true);
            if (barcodeInput) { barcodeInput.value = ""; barcodeInput.focus(); }
            doneFetching();
            return;
        }
        handleProductData(barcode, cached);
        return;
    }

    const productsRef = db.collection("Products").doc(STORE_ID).collection("items").doc(barcode);
    productsRef.get()
        .then(doc => {
            if (!doc.exists) {
                setScanStatus("Product not found. Rescan or try another barcode.", true);
                if (barcodeInput) { barcodeInput.value = ""; barcodeInput.focus(); }
                doneFetching();
                return;
            }
            handleProductData(barcode, doc.data());
        })
        .catch(() => {
            setScanStatus("Error fetching product. Rescan.", true);
            if (barcodeInput) { barcodeInput.value = ""; barcodeInput.focus(); }
            doneFetching();
        });

    function handleProductData(code, data) {
        if (data.disabled) {
            setScanStatus("Product unavailable.", true);
            if (barcodeInput) { barcodeInput.value = ""; barcodeInput.focus(); }
            doneFetching();
            return;
        }
        const price = parsePrice(data.price);
        if (price == null || price <= 0) {
            setScanStatus("Invalid price for " + (data.name || "item") + ". Rescan.", true);
            if (barcodeInput) { barcodeInput.value = ""; barcodeInput.focus(); }
            doneFetching();
            return;
        }
        addProduct(code, { name: data.name, price });
        setScanStatus("", false);
        doneFetching();
    }

    function doneFetching() {
        isFetching = false;
        if (addProductBtn) addProductBtn.disabled = false;
        if (barcodeInput) barcodeInput.disabled = false;
    }
}

function scanProduct() {
    handleInputCommit();
}

function parsePrice(raw) {
    if (typeof raw === "number" && !isNaN(raw)) return raw;
    if (typeof raw === "string") return Number(raw.replace(/,/g, "").replace(/[^\d.]/g, ""));
    return null;
}

function addProduct(barcode, data) {
    const price = typeof data.price === "number" ? data.price : parsePrice(data.price);
    if (!(price > 0)) return;
    if (cart[barcode]) cart[barcode].qty += 1;
    else cart[barcode] = { name: data.name || "Item", price, qty: 1 };
    if (barcodeInput) { barcodeInput.value = ""; barcodeInput.focus(); }
    clearSuggestions();
    renderCartPreview();
}

// Cart UI
function renderCartPreview() {
    const n = Object.keys(cart).length;
    const totalQty = Object.values(cart).reduce((s, i) => s + i.qty, 0);
    if (cartItemsCountEl) cartItemsCountEl.textContent = n ? `${n} items (${totalQty})` : "0";
    if (cartPreviewEl) {
        if (n === 0) cartPreviewEl.textContent = "Scan an item to see it here.";
        else {
            const lines = Object.entries(cart).map(([_, i]) => `${i.name} x ${i.qty}`);
            cartPreviewEl.textContent = lines.join(" • ");
        }
    }
}

function calculateTotal() {
    return Object.values(cart).reduce((s, i) => s + i.price * i.qty, 0);
}

function renderCart() {
    renderCartPreview();
    if (!cartDetailsEl || !cartTotalEl) return;
    cartDetailsEl.innerHTML = "";
    if (Object.keys(cart).length === 0) {
        cartDetailsEl.innerHTML = '<div class="empty-cart">Your cart is empty</div>';
        cartTotalEl.innerHTML = "";
        return;
    }
    let total = 0;
    Object.entries(cart).forEach(([barcode, item]) => {
        const itemTotal = item.price * item.qty;
        total += itemTotal;
        const div = document.createElement("div");
        div.className = "cart-item-detailed";
        div.innerHTML = `
            <div style="flex:1;">
                <div style="font-weight:bold; color:var(--primary);">${escapeHtml(item.name)}</div>
                <div style="color:#ccc; font-size:14px;">₹${item.price.toFixed(2)} each</div>
            </div>
            <div style="display:flex; align-items:center; gap:15px;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <button type="button" onclick="updateQuantity('${escapeAttr(barcode)}', -1)" class="qty-btn minus">-</button>
                    <span style="min-width:30px; text-align:center;">${item.qty}</span>
                    <button type="button" onclick="updateQuantity('${escapeAttr(barcode)}', 1)" class="qty-btn plus">+</button>
                </div>
                <div style="font-weight:bold; color:var(--primary); min-width:80px; text-align:right;">₹${itemTotal.toFixed(2)}</div>
            </div>
        `;
        cartDetailsEl.appendChild(div);
    });
    cartTotalEl.innerHTML = `
        <div class="cart-total-row">
            <span>Total</span>
            <span style="color:var(--primary);">₹${total.toFixed(2)}</span>
        </div>
    `;
}

function updateQuantity(barcode, delta) {
    if (transactionLocked || !cart[barcode]) return;
    cart[barcode].qty += delta;
    if (cart[barcode].qty <= 0) delete cart[barcode];
    renderCart();
}

function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
}

function escapeAttr(s) {
    return String(s).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Payment flows
function payByUPI() {
    initiatePayment("UPI");
}

function payByCash() {
    initiatePayment("CASH");
}

function payAtCounter() {
    initiatePayment("COUNTER");
}

// Create order -> Generate verification QR
function initiatePayment(mode) {
    if (transactionLocked) return;
    if (Object.keys(cart).length === 0) {
        setCartStatus("Cart is empty. Scan items first.", true);
        return;
    }
    if (!StoreData || StoreData.status !== "ACTIVE") {
        setCartStatus("Store is not active.", true);
        return;
    }
    if (!StoreData.upi_id && mode === "UPI") {
        setCartStatus("Store UPI not configured.", true);
        return;
    }
    if (mode === "UPI" && !isValidUpiId(StoreData.upi_id)) {
        setCartStatus("Invalid UPI ID. Please ask staff to update it.", true);
        return;
    }
    flow = "paying";
    transactionLocked = true;
    setCartStatus("Starting payment...", false);
    setPaymentButtonsDisabled(true);
    showProcessing("Creating order...");

    const total = calculateTotal();
    const items = Object.entries(cart).map(([barcode, item]) => ({
        barcode,
        name: item.name,
        price: item.price,
        qty: item.qty
    }));
    const orderData = {
        items,
        total: Number(total.toFixed(2)),
        payment_mode: mode,
        status: "PENDING",
        merchant_verified: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        verifiedAt: null
    };

    db.collection("Stores").doc(STORE_ID).collection("orders").add(orderData)
        .then(docRef => {
            const orderId = docRef.id;
            hideAppLoader();
            showSuccessWithQR(orderId, orderData, StoreData, mode);
        })
        .catch(err => {
            console.error("Order creation failed:", err);
            transactionLocked = false;
            hideAppLoader();
            setCartStatus("Error creating order. Please try again.", true);
            setPaymentButtonsDisabled(false);
            goCart();
        });
}

function showSuccessWithQR(orderId, orderData, store, mode) {
    flow = "success";
    [welcomeSection, scannerSection, cartSection].forEach(el => {
        if (el) el.classList.add("hidden");
    });
    if (paymentSectionEl) paymentSectionEl.classList.add("hidden");
    if (!successSectionEl) return;

    successSectionEl.classList.remove("hidden");
    successSectionEl.innerHTML = "";

    const total = orderData.total;
    const qrText = `SCANPAY_ORDER:${orderId}:${STORE_ID}`;

    const upiLink = buildUpiLink(store, total, orderId);
    const upiBtn = mode === "UPI" ? `<a href="${upiLink}" style="display:block; margin-bottom:12px;"><button class="primary">Open UPI App</button></a>` : "";
    const upiNote = mode === "UPI"
        ? `<p style="font-size:13px; color:var(--text-muted); margin:0 0 16px;">If payment fails, try another UPI app or pay at the counter.</p>`
        : `<p style="font-size:13px; color:var(--text-muted); margin:0 0 16px;">Pay at the counter and show this QR for verification.</p>`;

    const panel = document.createElement("div");
    panel.className = "glass-panel success-panel animate-fade-in";
    panel.innerHTML = `
        <h2>Order Created</h2>
        <p class="mb-4">Show this QR to the merchant for verification.</p>
        ${upiBtn}
        ${mode === "UPI" ? `<div class="qr-section">
            <div class="qr-title">Payment QR (scan to pay)</div>
            <div class="upi-qr-wrap" id="upi-qr-container"></div>
            <p style="font-size:12px; color:var(--text-muted); margin:8px 0 0;">Scan this QR in any UPI app if intent fails.</p>
        </div>` : ""}
        ${upiNote}
        <div class="qr-section">
            <div class="qr-title">Verification QR (show to staff)</div>
            <div class="verify-qr-wrap" id="verify-qr-container"></div>
            <p style="font-size:12px; color:var(--text-muted); margin:8px 0 0;">Not for payment.</p>
        </div>
        <p style="font-size:14px; color:var(--text-muted); margin:16px 0;">Order ID: ${orderId}</p>
        <p style="font-size:14px; color:var(--text-muted); margin-bottom:16px;">Total ₹${Number(total).toFixed(2)} · ${mode}</p>
        <p style="font-size:13px; color:var(--text-muted); margin-bottom:16px;">Waiting for staff verification...</p>
        <button type="button" onclick="startNewSession()" class="secondary">Start New Order</button>
    `;
    successSectionEl.appendChild(panel);

    const qrEl = document.getElementById("verify-qr-container");
    if (qrEl) {
        try {
            new QRCode(qrEl, { text: qrText, width: 200, height: 200, colorDark: "#000", colorLight: "#fff", correctLevel: QRCode.CorrectLevel.H });
        } catch (e) {
            qrEl.textContent = "QR error";
        }
    }
    const upiQrEl = document.getElementById("upi-qr-container");
    if (upiQrEl) {
        try {
            new QRCode(upiQrEl, { text: upiLink, width: 200, height: 200, colorDark: "#000", colorLight: "#fff", correctLevel: QRCode.CorrectLevel.M });
        } catch (e) {
            upiQrEl.textContent = "UPI QR error";
        }
    }

    watchOrderStatus(orderId, orderData);
}

function startNewSession() {
    transactionLocked = false;
    flow = "welcome";
    cart = {};
    setPaymentButtonsDisabled(false);
    if (orderListenerUnsub) {
        orderListenerUnsub();
        orderListenerUnsub = null;
    }
    if (successSectionEl) {
        successSectionEl.innerHTML = "";
        successSectionEl.classList.add("hidden");
    }
    if (paymentSectionEl) paymentSectionEl.classList.add("hidden");
    goWelcome();
}

function buildUpiLink(store, total, orderId) {
    const pa = String(store?.upi_id || "").trim().toLowerCase();
    const pn = toUpiSafeText(String(store?.store_name || "ScanPay Store"));
    const am = Number(total || 0).toFixed(2);
    const tn = toUpiSafeText(`ORDER ${String(orderId).slice(-6).toUpperCase()}`);
    const tr = toUpiSafeText(String(orderId || "").trim());
    return `upi://pay?pa=${pa}&pn=${pn}&am=${am}&tn=${tn}&tr=${tr}&cu=INR`;
}

function toUpiSafeText(value) {
    const raw = String(value || "").trim();
    const onlySafe = raw.replace(/[^a-zA-Z0-9 ]+/g, "");
    return onlySafe.replace(/\s+/g, "+");
}

function isValidUpiId(value) {
    const upi = String(value || "").trim().toLowerCase();
    if (!upi || upi.length < 5 || upi.length > 64) return false;
    if (/\s/.test(upi)) return false;
    const parts = upi.split("@");
    if (parts.length !== 2) return false;
    const [user, handle] = parts;
    if (!user || !handle) return false;
    return /^[a-z0-9.\-_]{2,}$/.test(user) && /^[a-z0-9._-]{2,}$/.test(handle);
}

function watchOrderStatus(orderId, orderData) {
    if (orderListenerUnsub) {
        orderListenerUnsub();
        orderListenerUnsub = null;
    }
    orderListenerUnsub = db.collection("Stores").doc(STORE_ID).collection("orders").doc(orderId)
        .onSnapshot(doc => {
            if (!doc.exists) return;
            const data = doc.data();
            if (data.status === "COMPLETED" || data.merchant_verified === true) {
                showReceipt(orderId, data);
                if (orderListenerUnsub) {
                    orderListenerUnsub();
                    orderListenerUnsub = null;
                }
            }
        }, () => {});
}

function showReceipt(orderId, data) {
    if (!successSectionEl) return;
    successSectionEl.innerHTML = "";

    const itemsList = Array.isArray(data.items) ? data.items : Object.values(data.items || {});
    const total = typeof data.total === "number" ? data.total : calculateTotal();
    const mode = data.payment_mode || "UPI";
    const verifiedAt = data.verifiedAt?.toDate ? data.verifiedAt.toDate() : new Date();
    const dateString = verifiedAt.toLocaleString();

    const itemsHtml = itemsList.map(item => `
        <div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:6px;">
            <span>${escapeHtml(item.name)} x${item.qty}</span>
            <span>₹${(item.price * item.qty).toFixed(2)}</span>
        </div>
    `).join("");

    const panel = document.createElement("div");
    panel.className = "glass-panel success-panel animate-fade-in";
    panel.innerHTML = `
        <h2>Payment Successful</h2>
        <div class="receipt">
            <div style="font-weight:700; margin-bottom:6px;">${escapeHtml(StoreData?.store_name || "Store")}</div>
            <div style="font-size:12px; margin-bottom:10px;">Order ID: ${orderId}</div>
            ${itemsHtml || "<div>No items</div>"}
            <div style="border-top:1px dashed #333; margin:10px 0;"></div>
            <div style="display:flex; justify-content:space-between; font-weight:700; margin-bottom:6px;">
                <span>Total</span>
                <span>₹${Number(total).toFixed(2)}</span>
            </div>
            <div style="font-size:12px;">Payment: ${mode}</div>
            <div style="font-size:12px;">Date: ${dateString}</div>
        </div>
        <button type="button" onclick="startNewSession()" class="secondary" style="margin-top:16px;">Start New Order</button>
    `;
    successSectionEl.appendChild(panel);
}

// Navigation
function goToCart() {
    if (transactionLocked) return;
    goCart();
}

function backToScanner() {
    if (transactionLocked) return;
    goScanner();
}

// Camera
function toggleCamera() {
    const readerEl = document.getElementById("reader");
    if (!readerEl) return;
    if (cameraRunning) {
        html5QrCode.stop().then(() => {
            readerEl.style.display = "none";
            cameraRunning = false;
            if (toggleCameraBtn) toggleCameraBtn.textContent = "📷 Scan with Camera";
        }).catch(() => {});
        return;
    }
    readerEl.style.display = "block";
    html5QrCode = new Html5Qrcode("reader");
    if (toggleCameraBtn) toggleCameraBtn.textContent = "❌ Stop Camera";
    cameraRunning = true;
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } }, onScanSuccess, onScanFailure)
        .catch(err => {
            readerEl.style.display = "none";
            cameraRunning = false;
            if (toggleCameraBtn) toggleCameraBtn.textContent = "📷 Scan with Camera";
            setScanStatus("Camera error: " + (err?.message || "unavailable"), true);
        });
}

function onScanSuccess(decodedText) {
    if (barcodeInput) barcodeInput.value = decodedText;
    clearSuggestions();
    handleBarcode(decodedText);
    toggleCamera();
}

function onScanFailure() {}

// Init
startBtn?.addEventListener("click", () => { goScanner(); });
barcodeInput?.addEventListener("input", () => { handleSearchInput(); });
barcodeInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        handleInputCommit();
    }
});

goToCartBtn?.addEventListener("click", () => { goToCart(); });
backToScannerBtn?.addEventListener("click", () => { backToScanner(); });

fetchStore();

function buildSearchIndex(cache) {
    const list = [];
    Object.entries(cache || {}).forEach(([barcode, data]) => {
        if (!data || data.disabled) return;
        const name = String(data.name || "").trim();
        const price = parsePrice(data.price);
        if (!name || !(price > 0)) return;
        list.push({ barcode, name, price });
    });
    searchIndex = list;
}

function isBarcodeInput(value) {
    return BARCODE_RE.test(String(value || "").trim());
}

function handleSearchInput() {
    if (!barcodeInput) return;
    const value = barcodeInput.value || "";
    if (!value.trim()) {
        clearSuggestions();
        return;
    }
    if (isBarcodeInput(value)) {
        clearSuggestions();
        return;
    }
    if (!productsReady) {
        clearSuggestions();
        return;
    }
    const query = value.trim().toLowerCase();
    const matches = searchIndex
        .filter(item => item.name.toLowerCase().includes(query))
        .slice(0, 5);
    renderSuggestions(matches);
}

function handleInputCommit() {
    const value = barcodeInput?.value || "";
    if (!value.trim()) {
        setScanStatus("Enter a barcode or search by name.", true);
        return;
    }
    if (isBarcodeInput(value)) {
        handleBarcode(value);
        return;
    }
    setScanStatus("Select an item from suggestions.", true);
}

function renderSuggestions(items) {
    if (!searchSuggestionsEl) return;
    if (!items || items.length === 0) {
        clearSuggestions();
        return;
    }
    searchSuggestionsEl.innerHTML = "";
    items.forEach(item => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.style.cssText = "width:100%; text-align:left; background:transparent; border:none; padding:10px 12px; color:#fff; display:flex; justify-content:space-between; gap:10px; cursor:pointer;";
        btn.innerHTML = `
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(item.name)}</span>
            <span style="color:var(--primary);">₹${item.price.toFixed(2)}</span>
        `;
        btn.addEventListener("click", () => {
            if (barcodeInput) barcodeInput.value = item.barcode;
            clearSuggestions();
            handleBarcode(item.barcode);
        });
        searchSuggestionsEl.appendChild(btn);
    });
    searchSuggestionsEl.style.display = "block";
}

function clearSuggestions() {
    if (!searchSuggestionsEl) return;
    searchSuggestionsEl.innerHTML = "";
    searchSuggestionsEl.style.display = "none";
}
