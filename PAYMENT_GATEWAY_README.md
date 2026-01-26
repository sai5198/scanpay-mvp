# ScanPay Payment Gateway System

## New Features Added

### Customer Flow:

1. **Scan products** using barcode scanner
2. **"Go to Cart"** - Review all items with quantities and prices
3. **Update quantities** - Add/remove items in cart using +/- buttons
4. **"Proceed to Payment"** - Generate QR code for payment
5. **Customer scans QR** with UPI app to complete payment
6. **Shows payment QR code** with order details encoded
7. **Session ends** after showing QR

### Cart Features:

- **Cart Preview** - Shows item count in scanner section
- **Detailed Cart View** - Full item details with quantity controls
- **Quantity Management** - +/- buttons to adjust quantities
- **Real-time Total** - Updates as quantities change
- **Empty Cart Handling** - Proper messaging when cart is empty

### Merchant Flow:

1. **Scan customer payment QR** using the merchant dashboard
2. **System fetches order details** and verifies payment
3. **Order status updates** to "Verified ✓"
4. **Shows confirmation** with all purchased items

## How to Test:

### For Customers:

1. Open `index.html`
2. Click "Ready to add to cart"
3. Scan barcode `8901234567890` (Test Product - ₹25.50)
4. Click "Go to Cart" to review items
5. Adjust quantities using +/- buttons if needed
6. Click "Proceed to Payment"
7. Copy the QR data shown (starts with "SCANPAY_ORDER:")
8. Click "Start New Session" to reset for next customer

### Emergency Reset:

If you get stuck, press **Ctrl+R** to force reset the interface.

### Debugging:

Open Developer Tools (F12) → Console tab to see debug messages during the flow.

### For Merchants:

1. Open `merchant.html`
2. Paste the QR data from customer into the "Scan customer payment QR" field
3. Click "Verify Payment" or press Enter
4. Order should show as "Verified ✓" in the live orders

## Firebase Data Structure:

```
Stores > [store_id] > orders > [order_id]
├── items: {cart object}
├── total: number
├── status: "pending"
├── customer_paid: boolean
├── merchant_verified: boolean
├── timestamp: serverTimestamp
└── verified_at: serverTimestamp (when verified)
```

## QR Code Format:

`SCANPAY_ORDER:[order_id]:[store_id]`

## Next Steps for Production:

1. Replace simple QR generator with proper QR library (qrcode.js)
2. Add real UPI payment integration
3. Add payment status tracking
4. Implement order completion workflow</content>
   <parameter name="filePath">c:\Users\kurel\OneDrive\STROMBREAKER\Scanpay\PAYMENT_GATEWAY_README.md
