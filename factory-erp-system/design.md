# Design Document

## Overview

The Factory ERP/Inventory & Billing System is a lightweight enterprise resource planning solution designed for small-scale manufacturing businesses, specifically flour mills and grain-based product operations. The system provides comprehensive management of sales transactions, inventory tracking, customer and supplier relationships, and financial accounting including cash and bank account management.

The system prioritizes speed, simplicity, and ease of use for non-technical staff, particularly accountants performing rapid billing operations. The design emphasizes large clickable UI elements, minimal typing requirements, and mobile compatibility to support efficient daily operations.

Key capabilities include:
- Fast sales billing with card-based product selection
- Automatic inventory reduction on sales
- Customer credit management with payment allocation
- Supplier purchase and payable tracking
- Multi-bank account management
- Cash flow tracking
- Central transaction ledger for financial audit trails
- Comprehensive reporting for business insights
- Purchase invoice generation for supplier transactions
- Financial vouchers for all payment and adjustment transactions
- Flexible print-now, print-later, and PDF download workflow
- Auto-generated document numbering (SI, PI, PV, JV) scoped per factory
- Dynamic document generation from stored transaction data (no static file storage)

## Architecture

The system follows a three-layer architecture separating presentation, business logic, and data persistence concerns.

### System Architecture

```
┌─────────────────────────────────────┐
│         Frontend Layer              │
│    (React + TailwindCSS)            │
│                                     │
│  - UI Rendering                     │
│  - User Interactions                │
│  - Client-side Validation           │
│  - Responsive Layouts               │
└──────────────┬──────────────────────┘
               │
               │ REST API (JSON)
               │
┌──────────────▼──────────────────────┐
│         Backend Layer               │
│    (Node.js + Express)              │
│                                     │
│  - Business Logic                   │
│  - Authentication & Authorization   │
│  - Payment Allocation Logic         │
│  - Inventory Management             │
│  - Financial Calculations           │
│  - API Endpoints                    │
└──────────────┬──────────────────────┘
               │
               │ SQL Queries
               │
┌──────────────▼──────────────────────┐
│         Database Layer              │
│           (MySQL)                   │
│                                     │
│  - Data Persistence                 │
│  - Relational Integrity             │
│  - Transaction Management           │
│  - Financial Records                │
└─────────────────────────────────────┘
```

### Technology Stack

**Frontend:**
- React: Component-based UI framework for building interactive interfaces
- React Router: Client-side routing for navigation
- Custom CSS: Following the design system defined in `reference/erp_system.html`
- Axios: HTTP client for API communication

**IMPORTANT: Frontend Design Constraint**
The frontend implementation MUST strictly follow the design system, styling patterns, and UI structure defined in the reference file `reference/erp_system.html`. This includes:
- CSS variables and design tokens (colors, spacing, shadows, etc.)
- Component styling (buttons, cards, forms, tables)
- Layout structure (top nav, sidebar, main content, mobile nav)
- Interactive states (hover, active, selected)
- Responsive behavior and mobile adaptations
- Typography and spacing scales

**Backend:**
- Node.js: JavaScript runtime for server-side execution
- Express.js: Web application framework for API routing and middleware
- bcrypt: Password hashing for secure authentication
- jsonwebtoken: Token-based authentication implementation

**Database:**
- MySQL: Relational database management system for structured data storage

### Communication Protocol

The frontend communicates with the backend through RESTful APIs using JSON format.

Example API endpoints:
- `POST /api/auth/login` - User authentication
- `GET /api/products` - Retrieve products
- `POST /api/sales` - Create new sale
- `POST /api/payments` - Record payment
- `GET /api/reports/sales` - Generate sales reports

## Components and Interfaces

### Frontend Components

**Authentication Module**
- LoginPage: User login interface with username/password fields
- AuthContext: React context for managing authentication state and tokens

**Dashboard Module**
- DashboardPage: Overview displaying summary cards and recent activity
- SummaryCard: Reusable component for displaying metrics (sales, dues, cash, etc.)
- RecentActivityList: Component showing recent sales, purchases, and payments
- QuickActionButtons: Navigation shortcuts to common tasks

**Sales/Billing Module**
- BillingPage: Main interface for creating sales
- CustomerSelector: Searchable dropdown for customer selection
- ProductCardGrid: Grid of large clickable product cards
- WeightCardGrid: Grid of large clickable weight cards
- BillItemsList: Cart-style display of items added to current bill
- PaymentForm: Interface for entering payment amount and method
- SalesInvoiceView: Printable sales invoice display (SI-XXXXX)
- DocumentActionModal: Post-transaction modal offering Print Now, Download PDF, or Skip options

**Customer Management Module**
- CustomerListPage: Searchable list of all customers
- CustomerDetailPage: Detailed view with purchase history and outstanding balance
- CustomerForm: Add/edit customer information
- CustomerDuesDisplay: Component showing outstanding balance breakdown

**Supplier Management Module**
- SupplierListPage: Searchable list of all suppliers
- SupplierDetailPage: Detailed view with purchase history and payables
- SupplierForm: Add/edit supplier information
- PurchaseForm: Record new purchase from supplier
- PurchaseInvoiceView: Printable purchase invoice display (PI-XXXXX)

**Inventory Module**
- InventoryListPage: Display of all product-weight combinations with quantities
- StockAdjustmentForm: Interface for adding or adjusting stock
- LowStockAlert: Component highlighting items below threshold

**Payment Module**
- CustomerPaymentForm: Record payments received from customers
- SupplierPaymentForm: Record payments made to suppliers
- PaymentMethodSelector: Choose between CASH, BANK, or NONE
- BankAccountSelector: Dropdown for selecting bank account
- PaymentVoucherView: Printable payment voucher display (PV-XXXXX)

**Financial Management Module**
- CashAccountDisplay: Show current cash balance
- BankAccountList: Display all bank accounts with balances
- BankAccountForm: Add/edit bank account (admin only)
- TransactionLedger: Display all financial transactions with filters
- AdjustmentVoucherView: Printable adjustment voucher display (JV-XXXXX)

**Reports Module**
- SalesReportPage: Daily/monthly sales reports
- InventoryReportPage: Current stock levels and low stock items
- CustomerDuesReport: Outstanding balances by customer
- SupplierPayablesReport: Outstanding payables by supplier
- CashFlowReport: Cash and bank balances with transaction history
- TransactionLedgerReport: Complete financial transaction history

**Settings Module**
- SettingsPage: Factory configuration (admin only)
- UserManagementPage: Add/edit users (admin only)
- CompanyInfoForm: Edit company details for invoices

### Backend API Structure

**Authentication APIs**
- `POST /api/auth/login` - Authenticate user and return JWT token
- `POST /api/auth/logout` - Invalidate user session
- `GET /api/auth/me` - Get current user information

**Customer APIs**
- `GET /api/customers` - List all customers for factory
- `POST /api/customers` - Create new customer
- `GET /api/customers/:id` - Get customer details with purchase history
- `PUT /api/customers/:id` - Update customer information
- `DELETE /api/customers/:id` - Delete customer (admin only, with validation)

**Supplier APIs**
- `GET /api/suppliers` - List all suppliers for factory
- `POST /api/suppliers` - Create new supplier
- `GET /api/suppliers/:id` - Get supplier details with purchase history
- `PUT /api/suppliers/:id` - Update supplier information
- `DELETE /api/suppliers/:id` - Delete supplier (admin only, with validation)

**Product APIs**
- `GET /api/products` - List all products for factory
- `POST /api/products` - Create new product (admin)
- `PUT /api/products/:id` - Update product (admin)
- `PUT /api/products/:id/status` - Activate/deactivate product (admin)

**Weight APIs**
- `GET /api/weights` - List all bag weights

**Inventory APIs**
- `GET /api/inventory` - List all inventory items for factory
- `POST /api/inventory/add` - Add stock to inventory
- `POST /api/inventory/adjust` - Adjust inventory quantity
- `GET /api/inventory/low-stock` - Get items below threshold

**Sales APIs**
- `POST /api/sales` - Create new sale with items and payment
- `GET /api/sales` - List all sales for factory
- `GET /api/sales/:id` - Get sale details with items
- `GET /api/sales/:id/invoice` - Generate sales invoice data (SI-XXXXX)
- `GET /api/sales/:id/invoice/pdf` - Download sales invoice as PDF
- `POST /api/sales/:id/revert` - Revert a sale (accountant)

**Purchase APIs**
- `POST /api/purchases` - Record new purchase from supplier
- `GET /api/purchases` - List all purchases for factory
- `GET /api/purchases/:id` - Get purchase details with items
- `GET /api/purchases/:id/invoice` - Generate purchase invoice data (PI-XXXXX)
- `GET /api/purchases/:id/invoice/pdf` - Download purchase invoice as PDF

**Payment APIs**
- `POST /api/payments/customer` - Record customer payment
- `POST /api/payments/supplier` - Record supplier payment
- `GET /api/payments` - List all payments for factory
- `GET /api/payments/:id/voucher` - Generate payment voucher data (PV-XXXXX)
- `GET /api/payments/:id/voucher/pdf` - Download payment voucher as PDF
- `POST /api/payments/:id/revert` - Revert a payment (accountant)

**Bank Account APIs**
- `GET /api/banks` - List all bank accounts for factory
- `POST /api/banks` - Create new bank account (admin only)
- `PUT /api/banks/:id` - Update bank account (admin only)
- `PUT /api/banks/:id/balance` - Set bank balance directly (admin only)
- `DELETE /api/banks/:id` - Delete bank account (admin only, with validation)

**Cash Account APIs**
- `GET /api/cash` - Get cash account balance for factory
- `PUT /api/cash/balance` - Set cash balance directly (admin only)

**Transaction APIs**
- `GET /api/transactions` - List all transactions with filters
- `GET /api/transactions/:id` - Get transaction details
- `GET /api/transactions/:id/voucher` - Generate adjustment voucher data (JV-XXXXX)
- `GET /api/transactions/:id/voucher/pdf` - Download adjustment voucher as PDF

**Report APIs**
- `GET /api/reports/sales/daily` - Daily sales report
- `GET /api/reports/sales/monthly` - Monthly sales report
- `GET /api/reports/sales/by-product` - Sales grouped by product
- `GET /api/reports/inventory` - Current inventory status
- `GET /api/reports/customer-dues` - Customer outstanding balances
- `GET /api/reports/supplier-payables` - Supplier outstanding payables
- `GET /api/reports/cash-flow` - Cash and bank balances with history
- `GET /api/reports/transactions` - Transaction ledger report

**Settings APIs**
- `GET /api/settings` - Get factory settings
- `PUT /api/settings` - Update factory settings (admin only)

**User Management APIs**
- `GET /api/users` - List all users (admin only)
- `POST /api/users` - Create new user (admin only)
- `PUT /api/users/:id` - Update user (admin only)
- `DELETE /api/users/:id` - Delete user (admin only)

## Data Models

### Factories

Represents a business location or branch.

```
factories
├── id (PK, INT, AUTO_INCREMENT)
├── name (VARCHAR(255), NOT NULL)
├── address (TEXT)
├── phone (VARCHAR(20))
└── created_at (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
```

### Users

Stores user credentials and role information.

```
users
├── id (PK, INT, AUTO_INCREMENT)
├── factory_id (FK -> factories.id, INT, NOT NULL)
├── username (VARCHAR(100), UNIQUE, NOT NULL)
├── password_hash (VARCHAR(255), NOT NULL)
├── role (ENUM('ADMIN', 'ACCOUNTANT'), NOT NULL)
└── created_at (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
```

### Customers

Stores customer records.

```
customers
├── id (PK, INT, AUTO_INCREMENT)
├── factory_id (FK -> factories.id, INT, NOT NULL)
├── name (VARCHAR(255), NOT NULL)
├── phone (VARCHAR(20))
├── address (TEXT)
├── is_deleted (BOOLEAN, DEFAULT FALSE)
├── deleted_at (TIMESTAMP, NULL)
├── deleted_by (FK -> users.id, INT, NULL)
└── created_at (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
```

### Suppliers

Stores supplier records.

```
suppliers
├── id (PK, INT, AUTO_INCREMENT)
├── factory_id (FK -> factories.id, INT, NOT NULL)
├── name (VARCHAR(255), NOT NULL)
├── phone (VARCHAR(20))
├── address (TEXT)
├── is_deleted (BOOLEAN, DEFAULT FALSE)
├── deleted_at (TIMESTAMP, NULL)
├── deleted_by (FK -> users.id, INT, NULL)
└── created_at (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
```

### Products

Stores products sold by the factory.

```
products
├── id (PK, INT, AUTO_INCREMENT)
├── factory_id (FK -> factories.id, INT, NOT NULL)
├── name (VARCHAR(255), NOT NULL)
├── status (ENUM('ACTIVE', 'INACTIVE'), DEFAULT 'ACTIVE')
└── created_at (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
```

### BagWeights

Stores standardized bag sizes (global, not factory-specific).

```
bag_weights
├── id (PK, INT, AUTO_INCREMENT)
├── weight_value (DECIMAL(10,2), NOT NULL)
└── unit (VARCHAR(10), DEFAULT 'kg')

UNIQUE KEY (weight_value, unit)
```

Examples: 8kg, 10kg, 20kg, 40kg, 50kg

### Inventory

Represents stock for a product-weight combination.

```
inventory
├── id (PK, INT, AUTO_INCREMENT)
├── factory_id (FK -> factories.id, INT, NOT NULL)
├── product_id (FK -> products.id, INT, NOT NULL)
├── weight_id (FK -> bag_weights.id, INT, NOT NULL)
├── quantity (DECIMAL(10,2), DEFAULT 0)
└── updated_at (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)

UNIQUE KEY (factory_id, product_id, weight_id)
```

### Sales

Represents a sale transaction.

```
sales
├── id (PK, INT, AUTO_INCREMENT)
├── factory_id (FK -> factories.id, INT, NOT NULL)
├── customer_id (FK -> customers.id, INT, NOT NULL)
├── invoice_number (VARCHAR(50), UNIQUE, NOT NULL)
├── total_amount (DECIMAL(10,2), NOT NULL)
├── paid_amount (DECIMAL(10,2), DEFAULT 0)
├── remaining_amount (DECIMAL(10,2), NOT NULL)
├── created_by (FK -> users.id, INT, NOT NULL)
├── status (ENUM('ACTIVE', 'REVERTED'), DEFAULT 'ACTIVE')
├── is_deleted (BOOLEAN, DEFAULT FALSE)
├── deleted_at (TIMESTAMP, NULL)
├── deleted_by (FK -> users.id, INT, NULL)
└── created_at (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
```

Sales Invoice Number Format: `SI-{5-digit sequence}`
Example: SI-00001, SI-00002
Sequence is per factory and increments globally (does not reset yearly).

### SaleItems

Items within a sale.

```
sale_items
├── id (PK, INT, AUTO_INCREMENT)
├── sale_id (FK -> sales.id, INT, NOT NULL)
├── product_id (FK -> products.id, INT, NOT NULL)
├── weight_id (FK -> bag_weights.id, INT, NOT NULL)
├── quantity (DECIMAL(10,2), NOT NULL)
├── price (DECIMAL(10,2), NOT NULL)
└── total (DECIMAL(10,2), NOT NULL)
```

### Purchases

Represents goods bought from suppliers.

```
purchases
├── id (PK, INT, AUTO_INCREMENT)
├── factory_id (FK -> factories.id, INT, NOT NULL)
├── supplier_id (FK -> suppliers.id, INT, NOT NULL)
├── invoice_number (VARCHAR(50), UNIQUE, NOT NULL)  -- PI-XXXXX format
├── total_amount (DECIMAL(10,2), NOT NULL)
├── paid_amount (DECIMAL(10,2), DEFAULT 0)
├── remaining_amount (DECIMAL(10,2), NOT NULL)
├── purchase_date (DATE, NOT NULL)
├── created_by (FK -> users.id, INT, NOT NULL)
├── status (ENUM('ACTIVE', 'REVERTED'), DEFAULT 'ACTIVE')
├── is_deleted (BOOLEAN, DEFAULT FALSE)
├── deleted_at (TIMESTAMP, NULL)
├── deleted_by (FK -> users.id, INT, NULL)
└── created_at (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
```

Purchase Invoice Number Format: `PI-{5-digit sequence}`
Example: PI-00001, PI-00002
Sequence is per factory and increments independently from sales invoices.

### PurchaseItems

Items within a purchase.

```
purchase_items
├── id (PK, INT, AUTO_INCREMENT)
├── purchase_id (FK -> purchases.id, INT, NOT NULL)
├── product_name (VARCHAR(255), NOT NULL)
├── quantity (DECIMAL(10,2), NOT NULL)
├── unit_price (DECIMAL(10,2), NOT NULL)
└── total (DECIMAL(10,2), NOT NULL)
```

Note: Purchase items store product_name as text rather than product_id to allow recording purchases of items not in the product catalog.

### CashAccount

Stores physical cash balance.

```
cash_accounts
├── id (PK, INT, AUTO_INCREMENT)
├── factory_id (FK -> factories.id, INT, UNIQUE, NOT NULL)
├── balance (DECIMAL(10,2), DEFAULT 0)
└── updated_at (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)
```

### BankAccounts

Stores bank account details.

```
bank_accounts
├── id (PK, INT, AUTO_INCREMENT)
├── factory_id (FK -> factories.id, INT, NOT NULL)
├── bank_name (VARCHAR(255), NOT NULL)
├── account_title (VARCHAR(255), NOT NULL)
├── account_number (VARCHAR(50), NOT NULL)
├── balance (DECIMAL(10,2), DEFAULT 0)
├── is_deleted (BOOLEAN, DEFAULT FALSE)
├── deleted_at (TIMESTAMP, NULL)
├── deleted_by (FK -> users.id, INT, NULL)
└── created_at (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
```

### Payments

Stores payments made or received.

```
payments
├── id (PK, INT, AUTO_INCREMENT)
├── factory_id (FK -> factories.id, INT, NOT NULL)
├── voucher_number (VARCHAR(50), UNIQUE, NOT NULL)  -- PV-XXXXX format
├── type (ENUM('CUSTOMER_PAYMENT', 'SUPPLIER_PAYMENT'), NOT NULL)
├── reference_id (INT, NOT NULL) -- customer_id or supplier_id
├── payment_method (ENUM('CASH', 'BANK'), NOT NULL)
├── bank_id (FK -> bank_accounts.id, INT, NULL)
├── amount (DECIMAL(10,2), NOT NULL)
├── notes (TEXT)
├── created_by (FK -> users.id, INT, NOT NULL)
├── status (ENUM('ACTIVE', 'REVERTED'), DEFAULT 'ACTIVE')
├── is_deleted (BOOLEAN, DEFAULT FALSE)
├── deleted_at (TIMESTAMP, NULL)
├── deleted_by (FK -> users.id, INT, NULL)
└── created_at (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
```

Payment Voucher Number Format: `PV-{5-digit sequence}`
Example: PV-00001, PV-00002
Sequence is per factory.

### PaymentAllocations

Tracks how payments are applied to sales or purchases.

```
payment_allocations
├── id (PK, INT, AUTO_INCREMENT)
├── payment_id (FK -> payments.id, INT, NOT NULL)
├── reference_type (ENUM('SALE', 'PURCHASE'), NOT NULL)
├── reference_id (INT, NOT NULL) -- sale_id or purchase_id
└── allocated_amount (DECIMAL(10,2), NOT NULL)
```

### Transactions

Central financial ledger recording all money movements.

```
transactions
├── id (PK, INT, AUTO_INCREMENT)
├── factory_id (FK -> factories.id, INT, NOT NULL)
├── voucher_number (VARCHAR(50), UNIQUE, NULL)  -- JV-XXXXX for ADJUST type; NULL for others (linked via payment)
├── transaction_type (ENUM('IN', 'OUT', 'ADJUST', 'REVERSAL'), NOT NULL)
├── source_type (ENUM('CUSTOMER', 'SUPPLIER', 'SYSTEM'), NOT NULL)
├── source_id (INT, NULL) -- customer_id, supplier_id, or NULL for system
├── payment_method (ENUM('CASH', 'BANK', 'NONE'), NOT NULL)
├── bank_id (FK -> bank_accounts.id, INT, NULL)
├── amount (DECIMAL(10,2), NOT NULL)
├── reference_id (INT, NULL) -- payment_id, sale_id, or purchase_id
├── notes (TEXT)
├── is_deleted (BOOLEAN, DEFAULT FALSE)
├── deleted_at (TIMESTAMP, NULL)
├── deleted_by (FK -> users.id, INT, NULL)
└── created_at (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
```

Adjustment Voucher Number Format: `JV-{5-digit sequence}`
Example: JV-00001, JV-00002
Sequence is per factory. Only ADJUST type transactions receive a JV number.

### DocumentSequences

Tracks per-factory auto-incrementing counters for each document type.

```
document_sequences
├── id (PK, INT, AUTO_INCREMENT)
├── factory_id (FK -> factories.id, INT, NOT NULL)
├── document_type (ENUM('SI', 'PI', 'PV', 'JV'), NOT NULL)
└── last_sequence (INT, DEFAULT 0)

UNIQUE KEY (factory_id, document_type)
```

Document number generation logic:
1. Lock the row for the factory + document_type combination
2. Increment last_sequence by 1
3. Format as `{TYPE}-{PADDED_5_DIGIT_SEQUENCE}` (e.g., SI-00001)
4. Store the formatted number on the respective record

### StockTransactions

```
stock_transactions
├── id (PK, INT, AUTO_INCREMENT)
├── factory_id (FK -> factories.id, INT, NOT NULL)
├── product_id (FK -> products.id, INT, NOT NULL)
├── weight_id (FK -> bag_weights.id, INT, NOT NULL)
├── type (ENUM('ADD', 'SALE', 'ADJUST'), NOT NULL)
├── quantity (DECIMAL(10,2), NOT NULL)
├── reference_id (INT, NULL) -- sale_id if type is SALE
├── note (TEXT)
└── created_at (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
```

### Settings

Factory-specific configuration.

```
settings
├── id (PK, INT, AUTO_INCREMENT)
├── factory_id (FK -> factories.id, INT, UNIQUE, NOT NULL)
├── company_name (VARCHAR(255))
├── company_logo (VARCHAR(500)) -- file path or URL
├── address (TEXT)
├── phone (VARCHAR(20))
└── invoice_footer (TEXT)
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Core Business Logic Properties

Property 1: Sale inventory reduction
*For any* sale transaction, when the sale is saved, the inventory quantity for each product-weight combination SHALL decrease by the exact quantity sold
**Validates: Requirements 1.6, 4.2**

Property 2: Customer balance tracking
*For any* sale with partial or no payment, the customer's outstanding balance SHALL increase by the remaining unpaid amount
**Validates: Requirements 1.6, 17.1, 17.2**

Property 3: Payment allocation oldest-first
*For any* customer payment, the system SHALL allocate the payment amount to outstanding sales in chronological order starting from the oldest unpaid sale
**Validates: Requirements 16.4, 16.5**

Property 4: Supplier payment allocation oldest-first
*For any* supplier payment, the system SHALL allocate the payment amount to outstanding purchases in chronological order starting from the oldest unpaid purchase
**Validates: Requirements 19.4, 19.5**

Property 5: Cash balance consistency
*For any* cash transaction (customer payment IN or supplier payment OUT), the cash account balance SHALL change by exactly the transaction amount in the correct direction
**Validates: Requirements 14.2, 14.3, 16.2, 19.2**

Property 6: Bank balance consistency
*For any* bank transaction (customer payment IN or supplier payment OUT), the specified bank account balance SHALL change by exactly the transaction amount in the correct direction
**Validates: Requirements 15.2, 15.3, 16.3, 19.3**

Property 7: Transaction ledger completeness
*For any* financial movement (payment, adjustment, or reversal), a corresponding transaction record SHALL be created in the central ledger
**Validates: Requirements 20.1, 20.2, 20.3**

Property 8: Stock transaction audit trail
*For any* inventory change (add, sale, or adjust), a corresponding stock transaction record SHALL be created with the correct type and quantity
**Validates: Requirements 6.1, 6.2, 6.3**

Property 9: Invoice number uniqueness
*For any* two sales within the same factory, their invoice numbers SHALL be unique
**Validates: Requirements 5.1**

Property 10: Monetary calculation precision
*For any* line item calculation, the total SHALL equal quantity multiplied by price rounded to two decimal places
**Validates: Requirements 13.1**

Property 11: Sale total accuracy
*For any* sale, the total amount SHALL equal the sum of all line item totals
**Validates: Requirements 13.2, 5.5**

Property 12: Customer outstanding balance accuracy
*For any* customer, the total outstanding balance SHALL equal the sum of remaining amounts across all unpaid sales
**Validates: Requirements 17.4**

Property 13: Supplier payable balance accuracy
*For any* supplier, the total outstanding payable SHALL equal the sum of remaining amounts across all unpaid purchases
**Validates: Requirements 18.3**

Property 14: Sale reversal completeness
*For any* sale reversal, the system SHALL restore inventory quantities, reverse payment allocations, update customer balance, and mark the sale as reverted
**Validates: Requirements 21.1**

Property 15: Payment reversal completeness
*For any* payment reversal (customer or supplier), the system SHALL reverse the cash/bank balance change, remove payment allocations, and create a compensating transaction
**Validates: Requirements 21.2, 21.3, 21.4**

Property 16: Product deactivation preservation
*For any* product deactivation, all historical sales data referencing that product SHALL remain intact and accessible
**Validates: Requirements 3.3**

Property 17: Active product filtering
*For any* billing interface display, only products with status ACTIVE and associated with the current factory SHALL be shown
**Validates: Requirements 3.4**

Property 18: Available inventory filtering
*For any* product selection during billing, only bag weights with quantity greater than zero SHALL be displayed
**Validates: Requirements 3.5, 4.4**

Property 19: Role-based authorization
*For any* protected operation, the system SHALL verify the user's role matches the required permission level before allowing execution
**Validates: Requirements 8.3, 8.4, 8.5, 22.4**

Property 20: Admin deletion validation
*For any* deletion attempt by an admin, the system SHALL prevent deletion if the entity has associated financial records or non-zero balances
**Validates: Requirements 22.1, 22.2, 22.3**

Property 21: Factory data isolation
*For any* user operation, all data queries and modifications SHALL be filtered by the user's associated factory
**Validates: Requirements 10.5**

Property 22: Search functionality
*For any* customer search query, the system SHALL return all customers whose name or phone number contains the search term
**Validates: Requirements 2.2, 12.2**

Property 23: Report aggregation accuracy
*For any* sales report, the aggregated totals SHALL match the sum of individual sale amounts within the specified period
**Validates: Requirements 7.1, 7.2, 7.3, 13.5**

Property 24: Low stock alert threshold
*For any* inventory item with quantity below the configured threshold, the system SHALL display a low stock alert
**Validates: Requirements 7.5, 10.3**

Property 25: Payment allocation marking
*For any* sale or purchase, when the remaining amount reaches zero through payment allocation, the system SHALL mark it as fully paid
**Validates: Requirements 16.5, 19.5**

Property 26: Purchase invoice number uniqueness
*For any* two purchases within the same factory, their purchase invoice numbers SHALL be unique
**Validates: Requirement 25.1**

Property 27: Payment voucher number uniqueness
*For any* two payment records within the same factory, their payment voucher numbers SHALL be unique
**Validates: Requirement 26.1, 26.2**

Property 28: Adjustment voucher number uniqueness
*For any* two ADJUST type transactions within the same factory, their adjustment voucher numbers SHALL be unique
**Validates: Requirement 26.3**

Property 29: Document number sequence monotonicity
*For any* factory and document type, each newly generated document number SHALL have a sequence value strictly greater than all previously generated numbers of the same type for that factory
**Validates: Requirements 29.1, 29.2, 29.3, 29.4**

Property 30: Dynamic document reconstruction accuracy
*For any* invoice or voucher regenerated from stored transaction data, the document content SHALL be identical to what would have been generated at the time of the original transaction
**Validates: Requirement 30.1, 30.5**

## Error Handling

### Input Validation

**Sales and Billing:**
- Validate that selected products are active and belong to the current factory
- Validate that selected bag weights have sufficient inventory
- Validate that quantity and price are positive numbers
- Validate that payment amount does not exceed sale total when payment method is not NONE
- Validate that bank account is selected when payment method is BANK

**Customer and Supplier Management:**
- Validate that name is not empty
- Validate phone number format if provided
- Prevent duplicate customer/supplier names within the same factory

**Inventory Management:**
- Validate that quantity adjustments do not result in negative inventory
- Validate that product-weight combinations are unique per factory
- Prevent stock reduction below zero during sales

**Financial Operations:**
- Validate that payment amounts are positive
- Validate that bank account exists and belongs to the factory when selected
- Validate that cash/bank balances do not go negative
- Validate that adjustment amounts are within reasonable limits

**User Management:**
- Validate that username is unique
- Validate password strength (minimum length, complexity)
- Validate that factory association exists

### Error Response Format

All API errors should return consistent JSON format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "field": "fieldName" // optional, for validation errors
  }
}
```

### Common Error Codes

- `AUTH_INVALID_CREDENTIALS` - Login failed
- `AUTH_TOKEN_EXPIRED` - Authentication token expired
- `AUTH_INSUFFICIENT_PERMISSIONS` - User lacks required permissions
- `VALIDATION_REQUIRED_FIELD` - Required field missing
- `VALIDATION_INVALID_FORMAT` - Field format invalid
- `BUSINESS_INSUFFICIENT_INVENTORY` - Not enough stock for sale
- `BUSINESS_NEGATIVE_BALANCE` - Operation would result in negative balance
- `BUSINESS_DUPLICATE_ENTRY` - Duplicate record exists
- `BUSINESS_CANNOT_DELETE` - Entity has dependencies preventing deletion
- `NOT_FOUND` - Requested resource not found
- `SERVER_ERROR` - Internal server error

### Transaction Management

**Database Transactions:**
- All sales operations (create sale, reduce inventory, update balances, create transactions) must execute within a single database transaction
- All payment operations (update balance, create payment, allocate to sales/purchases, create transaction) must execute within a single database transaction
- All reversal operations must execute within a single database transaction
- Use transaction rollback on any error to maintain data consistency

**Concurrency Control:**
- Use row-level locking when updating inventory to prevent overselling
- Use optimistic locking for balance updates to detect concurrent modifications
- Implement retry logic for transaction conflicts

## Testing Strategy

### Unit Testing

**Backend Unit Tests:**
- Test individual business logic functions in isolation
- Test payment allocation algorithm with various scenarios
- Test invoice number generation logic
- Test monetary calculation functions
- Test validation functions
- Test authentication and authorization logic

**Frontend Unit Tests:**
- Test React components in isolation
- Test form validation logic
- Test calculation functions (line item totals, sale totals)
- Test utility functions (formatting, date handling)

### Property-Based Testing

The system will use property-based testing to verify correctness properties across a wide range of inputs. We will use **fast-check** for JavaScript/TypeScript property-based testing.

**Configuration:**
- Each property-based test should run a minimum of 100 iterations
- Tests should generate random but valid data within business constraints
- Each test must be tagged with a comment referencing the design document property

**Test Tag Format:**
```javascript
// Feature: factory-erp-system, Property 1: Sale inventory reduction
```

**Key Properties to Test:**
- Property 1: Sale inventory reduction - Generate random sales and verify inventory decreases
- Property 3: Payment allocation oldest-first - Generate random payment scenarios and verify allocation order
- Property 5: Cash balance consistency - Generate random cash transactions and verify balance changes
- Property 9: Invoice number uniqueness - Generate multiple sales and verify no duplicate invoice numbers
- Property 10: Monetary calculation precision - Generate random quantities and prices and verify calculations
- Property 12: Customer outstanding balance accuracy - Generate random sales and payments and verify balance calculation
- Property 15: Payment reversal completeness - Generate random payments, reverse them, and verify complete reversal
- Property 20: Admin deletion validation - Generate entities with various states and verify deletion rules

### Integration Testing

**API Integration Tests:**
- Test complete workflows end-to-end through API endpoints
- Test authentication flow
- Test sales creation workflow (select customer, add items, process payment)
- Test payment recording and allocation workflow
- Test reversal workflows
- Test report generation

**Database Integration Tests:**
- Test database constraints (foreign keys, unique constraints)
- Test transaction rollback behavior
- Test concurrent access scenarios

### End-to-End Testing

**Critical User Workflows:**
- Complete billing workflow: login → select customer → add products → enter payment → generate invoice
- Payment recording workflow: login → select customer → record payment → verify allocation
- Inventory management workflow: login → add stock → create sale → verify inventory reduction
- Reversal workflow: login → create sale → revert sale → verify complete reversal

## Security Considerations

### Authentication

- Passwords must be hashed using bcrypt with appropriate salt rounds (minimum 10)
- JWT tokens should have reasonable expiration times (e.g., 8 hours)
- Tokens should include user ID, factory ID, and role
- Implement token refresh mechanism for better user experience

### Authorization

- All API endpoints must verify authentication token
- Role-based access control must be enforced at the API level
- Admin-only operations: user management, bank account creation, direct balance setting, deletion operations
- Accountant operations: sales, customers, suppliers, inventory, payments, reversals
- Factory isolation must be enforced - users can only access data from their associated factory

### Data Protection

- Use parameterized queries to prevent SQL injection
- Validate and sanitize all user inputs
- Implement rate limiting on authentication endpoints
- Use HTTPS for all communications in production
- Implement CORS restrictions appropriately

### Audit Trail

- Log all deletion operations with user and timestamp
- Log all balance adjustments with user and reason
- Log all reversal operations with user and timestamp
- Maintain soft delete records for financial data

## Performance Considerations

### Database Optimization

- Index foreign keys for faster joins
- Index frequently queried fields (customer name, phone, invoice number)
- Index date fields used in reports (created_at, purchase_date)
- Use composite indexes for factory_id + other fields
- Implement database connection pooling

### Query Optimization

- Use pagination for list endpoints (customers, suppliers, sales, transactions)
- Implement efficient aggregation queries for reports
- Cache factory settings to avoid repeated database queries
- Use database views for complex report queries

### Frontend Optimization

- Implement lazy loading for large lists
- Use debouncing for search inputs
- Cache product and weight data on the client
- Implement optimistic UI updates for better perceived performance
- Use React.memo and useMemo for expensive computations

## Deployment Considerations

### Environment Configuration

- Database connection strings
- JWT secret key
- File upload paths for company logos
- CORS allowed origins
- Port configuration

### Database Migration Strategy

- Use migration scripts for schema changes
- Version control all migration files
- Test migrations on staging before production
- Implement rollback scripts for each migration

### Backup Strategy

- Daily automated database backups
- Retain backups for minimum 30 days
- Test backup restoration regularly
- Store backups in secure location separate from production

## Future Enhancements

Potential features for future versions:

- Multi-currency support
- Tax calculation and reporting
- Profit margin analysis
- Barcode scanning for products
- SMS notifications for low stock
- Email invoices to customers
- Advanced analytics and dashboards
- Mobile native applications
- Integration with accounting software
- Automated backup to cloud storage
