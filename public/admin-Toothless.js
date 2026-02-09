// State
const params = new URLSearchParams(window.location.search);
var STORE_ID = params.get("store_id") || "test_store";

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyC9vA-cnki4Rm-1QW8Y6GiCagw5yiu6UOs",
    authDomain: "scanpay-7a3fd.firebaseapp.com",
    projectId: "scanpay-7a3fd",
    storageBucket: "scanpay-7a3fd.firebasestorage.app",
    messagingSenderId: "979835689544",
    appId: "1:979835689544:web:d2dd608932a68a3da1167d"
};

const BASE_URL = "https://scanpay-7a3fd.web.app";

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// DOM Elements
var logDiv = document.getElementById("log");
const productListEl = document.getElementById("product-list-body");
const storeNameHeader = document.getElementById("store-name-header");
const storeStatusBadge = document.getElementById("store-status-badge");

// Initialize
window.onload = () => {
    const storeIdInput = document.getElementById("storeId");
    if (storeIdInput) {
        storeIdInput.value = STORE_ID;
        storeIdInput.addEventListener("input", () => {
            const nextId = storeIdInput.value.trim() || "test_store";
            if (nextId === STORE_ID) {
                renderStoreLinks();
                generateStoreQR();
                return;
            }
            STORE_ID = nextId;
            renderStoreLinks();
            generateStoreQR();
            fetchStoreInfo();
            fetchProducts();
        });
    }

    renderStoreLinks();
    generateStoreQR();
    fetchStoreInfo();
    fetchProducts();
};

function log(msg, type = "info") {
    if (!logDiv) return;
    const color = type === "error" ? "#ff5252" : (type === "success" ? "#00e676" : "#aaa");
    logDiv.innerHTML += `<div style="color:${color}">[${new Date().toLocaleTimeString()}] ${msg}</div>`;
    logDiv.scrollTop = logDiv.scrollHeight;
}

function getCustomerLink(storeId) {
    const safeId = encodeURIComponent(storeId || "");
    return `${BASE_URL}/?store_id=${safeId}`;
}

function getMerchantLink(storeId) {
    const safeId = encodeURIComponent(storeId || "");
    return `${BASE_URL}/merchant-Toothless.html?store_id=${safeId}`;
}

function renderStoreLinks() {
    const cLink = getCustomerLink(STORE_ID);
    const mLink = getMerchantLink(STORE_ID);

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

function copyLink(linkId) {
    const linkEl = document.getElementById(linkId);
    const url = linkEl ? linkEl.href : "";
    if (!url) return alert("Link not available");

    navigator.clipboard.writeText(url)
        .then(() => log("Link copied to clipboard", "success"))
        .catch(() => alert("Copy failed. Please copy manually."));
}

function openLink(linkId) {
    const linkEl = document.getElementById(linkId);
    const url = linkEl ? linkEl.href : "";
    if (!url) return alert("Link not available");
    window.open(url, "_blank", "noopener");
}

// Fetch Store Info
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
                const nameInput = document.getElementById("settingsName");
                const upiInput = document.getElementById("settingsUpi");
                if (nameInput) nameInput.value = "My Awesome Store";
                if (upiInput) upiInput.value = "";
            }
        })
        .catch(err => {
            console.error("Error fetching store:", err);
            log("Error fetching store info", "error");
        });
}

// Save Store Settings
async function saveStoreSettings() {
    const name = document.getElementById("settingsName").value.trim();
    const upi = document.getElementById("settingsUpi").value.trim();

    if (!name) return alert("Store Name is required");
    if (!upi) return alert("UPI ID is required");

    try {
        const storeRef = db.collection("Stores").doc(STORE_ID);
        const snap = await storeRef.get();
        const createdAt = snap.exists && snap.data()?.createdAt
            ? snap.data().createdAt
            : firebase.firestore.FieldValue.serverTimestamp();

        await storeRef.set({
            store_name: name,
            upi_id: upi,
            status: "ACTIVE",
            createdAt,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        log("Store settings saved", "success");
        renderStoreLinks();
        generateStoreQR();
        fetchStoreInfo();
    } catch (err) {
        console.error(err);
        log(`Error saving settings: ${err.message}`, "error");
    }
}

// Fetch Products
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
                ₹${Number(data.price).toFixed(2)}
                <button class="icon-btn" onclick="enableEdit('${id}', ${data.price})">Edit</button>
            </div>
            <div class="price-edit" id="price-edit-${id}" style="display:none;">
                <input type="number" id="price-input-${id}" value="${data.price}" style="width: 80px; padding: 5px;">
                <button class="icon-btn success" onclick="savePrice('${id}')">Save</button>
                <button class="icon-btn error" onclick="cancelEdit('${id}')">Cancel</button>
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

// Add Product
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

        document.getElementById("newBarcode").value = "";
        document.getElementById("newName").value = "";
        document.getElementById("newPrice").value = "";

        log(`Added product: ${name}`, "success");
    } catch (err) {
        console.error(err);
        alert("Error adding product: " + err.message);
    }
}

// Edit Price UI
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

// Toggle Status
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

async function bulkUploadProducts() {
    const inputEl = document.getElementById("bulkProductsInput");
    const rawText = inputEl.value.trim();

    if (!rawText) {
        alert("Please paste product JSON");
        return;
    }

    let products;
    try {
        products = JSON.parse(rawText);
    } catch (err) {
        alert("Invalid JSON format");
        return;
    }

    if (!Array.isArray(products)) {
        alert("JSON must be an array of products");
        return;
    }

    if (products.length === 0) {
        alert("No products found in JSON");
        return;
    }

    const batch = db.batch();
    const productsRef = db.collection("Products").doc(STORE_ID).collection("items");

    let validCount = 0;

    for (let i = 0; i < products.length; i++) {
        const p = products[i];

        if (!p.barcode || !p.name || p.price == null) {
            alert(`Missing fields in item at index ${i}`);
            return;
        }

        if (typeof p.barcode !== "string") {
            alert(`Invalid barcode at index ${i}`);
            return;
        }

        if (typeof p.name !== "string") {
            alert(`Invalid name at index ${i}`);
            return;
        }

        const price = Number(p.price);
        if (isNaN(price) || price <= 0) {
            alert(`Invalid price at index ${i}`);
            return;
        }

        const docRef = productsRef.doc(p.barcode.trim());

        batch.set(docRef, {
            name: p.name.trim(),
            price: price,
            disabled: false,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        validCount++;
    }

    try {
        await batch.commit();
        log(`Successfully uploaded ${validCount} products`, "success");
        alert(`Successfully uploaded ${validCount} products`);
        inputEl.value = "";
    } catch (err) {
        console.error(err);
        log(`Error uploading products: ${err.message}`, "error");
        alert("Error uploading products. Check console.");
    }
}

function generateStoreQR() {
    if (!STORE_ID) return alert("Enter a Store ID");

    const url = getCustomerLink(STORE_ID);
    const container = document.getElementById("store-qr-code");

    container.innerHTML = "";

    new QRCode(container, {
        text: url,
        width: 250,
        height: 250,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });

    log(`Generated QR for Web: ${url}`, "success");
}
