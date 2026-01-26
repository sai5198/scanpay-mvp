// � Stats & State
const params = new URLSearchParams(window.location.search);
var STORE_ID = params.get("store_id") || "test_store"; // Using var to ensure global access

// �🔐 Firebase Config
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
const auth = firebase.auth();

// DOM Elements
var logDiv = document.getElementById("log");
const productListEl = document.getElementById("product-list-body");
const storeNameHeader = document.getElementById("store-name-header");
const storeStatusBadge = document.getElementById("store-status-badge");

// Initialize
window.onload = () => {
    document.getElementById("storeId").value = STORE_ID;
    updateLinks();

    // Sign in anonymously to fix permission errors
    auth.signInAnonymously()
        .then(() => {
            log("🔐 Signed in anonymously", "success");
            fetchStoreInfo();
            fetchProducts();
        })
        .catch((error) => {
            console.error("Auth Error:", error);
            log(`❌ Auth Failed: ${error.message}. Check Firebase Console -> Authentication -> Sign-in method -> Enable Anonymous.`, "error");
            // Try fetching anyway (in case rules allows public read)
            fetchStoreInfo();
            fetchProducts();
        });
};

function log(msg, type = "info") {
    if (!logDiv) return;
    const color = type === "error" ? "#ff5252" : (type === "success" ? "#00e676" : "#aaa");
    logDiv.innerHTML += `<div style="color:${color}">[${new Date().toLocaleTimeString()}] ${msg}</div>`;
    logDiv.scrollTop = logDiv.scrollHeight;
}

function updateLinks() {
    const storeIdVal = document.getElementById("storeId").value.trim() || STORE_ID;
    const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/'));

    const cLink = `${baseUrl}/index.html?store_id=${storeIdVal}`;
    const mLink = `${baseUrl}/merchant.html?store_id=${storeIdVal}`;

    const cLinkEl = document.getElementById("customerLink");
    if (cLinkEl) {
        cLinkEl.href = cLink;
        cLinkEl.innerText = cLink;
    }

    const mLinkEl = document.getElementById("merchantLink");
    if (mLinkEl) {
        mLinkEl.href = mLink;
        mLinkEl.innerText = mLink;
    }
}

// 🟢 Fetch Store Info
function fetchStoreInfo() {
    db.collection("Stores").doc(STORE_ID).get()
        .then(doc => {
            if (doc.exists) {
                const data = doc.data();
                if (storeNameHeader) storeNameHeader.innerText = data.store_name || "Store Dashboard";

                // Populate Settings
                const nameInput = document.getElementById("settingsName");
                const upiInput = document.getElementById("settingsUpi");
                if (nameInput) nameInput.value = data.store_name || "";
                if (upiInput) upiInput.value = data.upi_id || "";

                if (storeStatusBadge) {
                    storeStatusBadge.innerText = data.status || "UNKNOWN";
                    storeStatusBadge.className = `status-badge ${data.status === 'ACTIVE' ? 'status-active' : 'status-inactive'}`;
                }
            } else {
                if (storeNameHeader) storeNameHeader.innerText = "Store Not Found (New)";
                // Pre-fill inputs for new store
                document.getElementById("settingsName").value = "My Awesome Store";
                document.getElementById("settingsUpi").value = "";
            }
        })
        .catch(err => {
            console.error("Error fetching store:", err);
            log("Error fetching store info", "error");
        });
}

// 💾 Save Store Settings
async function saveStoreSettings() {
    const name = document.getElementById("settingsName").value.trim();
    const upi = document.getElementById("settingsUpi").value.trim();

    if (!name) return alert("Store Name is required");
    if (!upi) return alert("UPI ID is required");

    try {
        await db.collection("Stores").doc(STORE_ID).set({
            store_name: name,
            upi_id: upi,
            status: "ACTIVE", // Default to active when saving
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        log("✅ Store settings saved!", "success");
        fetchStoreInfo(); // Refresh header
    } catch (err) {
        console.error(err);
        log(`❌ Error saving settings: ${err.message}`, "error");
        if (err.code === 'permission-denied') {
            log(`💡 Permission denied. Make sure you are signed in (check console) and Rules allow writes.`, "info");
        }
    }
}

// 🟢 Fetch Products
function fetchProducts() {
    if (!productListEl) return;

    productListEl.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#666;">Loading products...</td></tr>';

    db.collection("Products").doc(STORE_ID).collection("items").orderBy("name")
        .onSnapshot(snapshot => {
            if (snapshot.empty) {
                productListEl.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#666;">No products found</td></tr>';
                updateStats(0, 0, 0);
                return;
            }

            productListEl.innerHTML = "";

            // Stats Counters
            let total = 0;
            let active = 0;
            let disabled = 0;

            snapshot.forEach(doc => {
                const data = doc.data();
                renderProductRow(doc.id, data);

                // Update Stats
                total++;
                if (data.disabled) {
                    disabled++;
                } else {
                    active++;
                }
            });

            updateStats(total, active, disabled);

        }, error => {
            console.error("Error fetching products:", error);
            productListEl.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#ff5252;">Error loading products</td></tr>';
        });
}

function updateStats(total, active, disabled) {
    const elTotal = document.getElementById("stat-total");
    const elActive = document.getElementById("stat-active");
    const elDisabled = document.getElementById("stat-disabled");

    if (elTotal) elTotal.innerText = total;
    if (elActive) elActive.innerText = active;
    if (elDisabled) elDisabled.innerText = disabled;
}

function renderProductRow(id, data) {
    const row = document.createElement("tr");
    const isDisabled = data.disabled === true;

    row.innerHTML = `
        <td>${id}</td>
        <td>${data.name}</td>
        <td>
            <div class="price-display" id="price-display-${id}">
                ₹${data.price.toFixed(2)}
                <button class="icon-btn" onclick="enableEdit('${id}', ${data.price})">✏️</button>
            </div>
            <div class="price-edit" id="price-edit-${id}" style="display:none;">
                <input type="number" id="price-input-${id}" value="${data.price}" style="width: 80px; padding: 5px;">
                <button class="icon-btn success" onclick="savePrice('${id}')">✅</button>
                <button class="icon-btn error" onclick="cancelEdit('${id}')">❌</button>
            </div>
        </td>
        <td>
            <span class="status-badge ${isDisabled ? 'status-inactive' : 'status-active'}">
                ${isDisabled ? 'DISABLED' : 'ACTIVE'}
            </span>
        </td>
        <td>
            <button class="action-btn ${isDisabled ? 'btn-enable' : 'btn-disable'}" 
                onclick="toggleProductStatus('${id}', ${isDisabled})">
                ${isDisabled ? 'Enable' : 'Disable'}
            </button>
        </td>
    `;
    productListEl.appendChild(row);
}

// 🟢 Add Product
async function addProduct() {
    const barcode = document.getElementById("newBarcode").value.trim();
    const name = document.getElementById("newName").value.trim();
    const priceVal = document.getElementById("newPrice").value.trim();

    if (!barcode || !name || !priceVal) {
        alert("Please fill all fields");
        return;
    }

    const price = Number(priceVal);
    if (isNaN(price) || price <= 0) {
        alert("Invalid price");
        return;
    }

    try {
        await db.collection("Products").doc(STORE_ID).collection("items").doc(barcode).set({
            name: name,
            price: price,
            disabled: false,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Clear form
        document.getElementById("newBarcode").value = "";
        document.getElementById("newName").value = "";
        document.getElementById("newPrice").value = "";

        log(`Added product: ${name}`, "success");
    } catch (err) {
        console.error(err);
        alert("Error adding product: " + err.message);
    }
}

// 🟢 Edit Price UI
function enableEdit(id, currentPrice) {
    document.getElementById(`price-display-${id}`).style.display = "none";
    document.getElementById(`price-edit-${id}`).style.display = "flex";
    const input = document.getElementById(`price-input-${id}`);
    input.focus();
}

function cancelEdit(id) {
    document.getElementById(`price-display-${id}`).style.display = "flex";
    document.getElementById(`price-edit-${id}`).style.display = "none";
}

async function savePrice(id) {
    const input = document.getElementById(`price-input-${id}`);
    const newPrice = Number(input.value);

    if (isNaN(newPrice) || newPrice <= 0) {
        alert("Invalid price");
        return;
    }

    try {
        await db.collection("Products").doc(STORE_ID).collection("items").doc(id).update({
            price: newPrice,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        cancelEdit(id);
        log(`Updated price for ${id}`, "success");
    } catch (err) {
        console.error(err);
        alert("Error updating price");
    }
}

// 🟢 Toggle Status
async function toggleProductStatus(id, currentDisabledStatus) {
    try {
        await db.collection("Products").doc(STORE_ID).collection("items").doc(id).update({
            disabled: !currentDisabledStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        log(`${!currentDisabledStatus ? 'Disabled' : 'Enabled'} product ${id}`, "success");
    } catch (err) {
        console.error(err);
        alert("Error updating status");
    }
}

// 🟢 Original Bulk Upload Function (Preserved)
async function uploadProducts() {
    const storeId = document.getElementById("storeId").value.trim();
    const jsonStr = document.getElementById("jsonInput").value.trim();

    if (!storeId) return log("❌ Error: Store ID is required", "error");
    if (!jsonStr) return log("❌ Error: JSON input is empty", "error");

    let products;
    try {
        products = JSON.parse(jsonStr);
        if (!Array.isArray(products)) throw new Error("Input must be an array [...]");
    } catch (e) {
        return log("❌ JSON Parse Error: " + e.message, "error");
    }

    log(`Starting upload of ${products.length} products to store: ${storeId}...`);

    let successCount = 0;
    let failCount = 0;

    for (const item of products) {
        if (!item.barcode || !item.name || !item.price) {
            log(`⚠️ Skipping invalid item: ${JSON.stringify(item)}`, "error");
            failCount++;
            continue;
        }

        try {
            const price = Number(item.price);

            await db.collection("Products").doc(storeId).collection("items").doc(item.barcode).set({
                name: item.name,
                price: price,
                disabled: false, // Default to enabled
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            log(`✅ Uploaded: ${item.name} (${item.barcode})`, "success");
            successCount++;
        } catch (err) {
            console.error(err);
            log(`❌ Failed to upload ${item.barcode}: ${err.message}`, "error");
            if (err.code === 'permission-denied') {
                log(`💡 Tip: Check Firestore Rules in Firebase Console. It might be set to 'allow write: if false;'. Change to 'allow write: if request.auth != null;' or 'if true;'`, "info");
            }
            failCount++;
        }
    }

    log(`\n🎉 Upload Complete! Success: ${successCount}, Failed: ${failCount}`, "success");
}

function generateStoreQR() {
    const storeId = document.getElementById("storeId").value.trim();
    if (!storeId) return alert("Enter a Store ID");

    const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/'));
    const cLink = `${baseUrl}/index.html?store_id=${storeId}`;

    const display = document.getElementById("store-qr-display");
    const container = document.getElementById("store-qr-code");

    container.innerHTML = "";
    display.style.display = "block";

    new QRCode(container, {
        text: cLink,
        width: 150,
        height: 150
    });
}
