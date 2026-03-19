# Implementation Plan

- [ ] 1. Set up project structure and development environment
  - Initialize Node.js backend project with Express
  - Initialize React frontend project with Vite
  - Copy design system CSS from reference/erp_system.html to frontend project
  - Set up MySQL database connection
  - Configure environment variables
  - Set up project folder structure (backend: routes, controllers, models, middleware; frontend: components, pages, services, utils)
  - **IMPORTANT: All frontend components MUST follow the exact styling and structure from reference/erp_system.html**
  - _Requirements: All_

- [ ] 2. Create database schema and migrations
  - Create migration scripts for all tables (factories, users, customers, suppliers, products, bag_weights, inventory, sales, sale_items, purchases, purchase_items, cash_accounts, bank_accounts, payments, payment_allocations, transactions, stock_transactions, settings, document_sequences)
  - Implement foreign key constraints and indexes
  - Add unique constraints (invoice_number on sales, invoice_number on purchases, voucher_number on payments, voucher_number on transactions, username, factory_id+product_id+weight_id)
  - Add document_sequences table with unique constraint on (factory_id, document_type) for SI, PI, PV, JV types
  - Seed initial data (bag weights: 8kg, 10kg, 20kg, 40kg, 50kg)
  - _Requirements: 3.1, 3.2, 4.1, 14.1, 15.1, 29.1, 29.2, 29.3, 29.4_

- [ ] 3. Implement authentication and authorization system
  - Create User model with password hashing using bcrypt
  - Implement JWT token generation and validation
  - Create login API endpoint (POST /api/auth/login)
  - Create authentication middleware for protected routes
  - Create role-based authorization middleware (admin vs accountant)
  - Implement logout functionality
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 3.1 Write property test for authentication
  - **Property 19: Role-based authorization**
  - **Validates: Requirements 8.3, 8.4, 8.5**

- [ ] 4. Implement factory and settings management
  - Create Factory model and CRUD operations
  - Create Settings model and API endpoints
  - Implement company settings update (admin only)
  - Implement logo upload functionality
  - Create API endpoints: GET /api/settings, PUT /api/settings
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 4.1 Write property test for factory data isolation
  - **Property 21: Factory data isolation**
  - **Validates: Requirements 10.5**

- [ ] 5. Implement product and bag weight management
  - Create Product model with factory association
  - Create BagWeight model
  - Implement product CRUD APIs (GET, POST, PUT /api/products)
  - Implement product activation/deactivation (PUT /api/products/:id/status)
  - Implement bag weight APIs (GET /api/weights)
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 5.1 Write property test for product deactivation
  - **Property 16: Product deactivation preservation**
  - **Validates: Requirements 3.3**

- [ ] 5.2 Write property test for active product filtering
  - **Property 17: Active product filtering**
  - **Validates: Requirements 3.4**

- [ ] 6. Implement inventory management system
  - Create Inventory model with unique constraint on factory+product+weight
  - Create StockTransaction model for audit trail
  - Implement add stock API (POST /api/inventory/add)
  - Implement adjust stock API (POST /api/inventory/adjust)
  - Implement get inventory API (GET /api/inventory)
  - Implement low stock detection (GET /api/inventory/low-stock)
  - Ensure stock transactions are created for all inventory changes
  - _Requirements: 4.1, 4.3, 4.4, 4.5, 6.1, 6.3_

- [ ] 6.1 Write property test for stock addition
  - **Property 4: Stock addition increases inventory**
  - **Validates: Requirements 4.1**

- [ ] 6.2 Write property test for stock transaction audit trail
  - **Property 8: Stock transaction audit trail**
  - **Validates: Requirements 6.1, 6.2, 6.3**

- [ ] 7. Implement customer management
  - Create Customer model with factory association and soft delete fields
  - Implement customer CRUD APIs (GET, POST, PUT /api/customers)
  - Implement customer search functionality with name/phone filtering
  - Implement customer detail view with purchase history
  - Implement customer deletion (admin only with validation)
  - Calculate and display customer outstanding balance
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 22.1_

- [ ] 7.1 Write property test for customer search
  - **Property 22: Search functionality**
  - **Validates: Requirements 2.2, 12.2**

- [ ] 7.2 Write property test for customer outstanding balance
  - **Property 12: Customer outstanding balance accuracy**
  - **Validates: Requirements 17.4**

- [ ] 8. Implement supplier management
  - Create Supplier model with factory association and soft delete fields
  - Implement supplier CRUD APIs (GET, POST, PUT /api/suppliers)
  - Implement supplier search functionality
  - Implement supplier detail view with purchase history
  - Implement supplier deletion (admin only with validation)
  - Calculate and display supplier outstanding payable
  - _Requirements: 18.1, 18.4, 22.2_

- [ ] 8.1 Write property test for supplier payable balance
  - **Property 13: Supplier payable balance accuracy**
  - **Validates: Requirements 18.3**

- [ ] 9. Implement cash and bank account management
  - Create CashAccount model (one per factory)
  - Create BankAccount model with soft delete fields
  - Implement cash account APIs (GET /api/cash, PUT /api/cash/balance - admin only)
  - Implement bank account CRUD APIs (GET, POST, PUT, DELETE /api/banks - admin only)
  - Implement bank balance direct setting (admin only)
  - Implement bank account deletion validation
  - _Requirements: 14.1, 14.4, 14.5, 15.1, 15.4, 15.5, 22.3_

- [ ] 9.1 Write property test for cash balance consistency
  - **Property 5: Cash balance consistency**
  - **Validates: Requirements 14.2, 14.3, 16.2, 19.2**

- [ ] 9.2 Write property test for bank balance consistency
  - **Property 6: Bank balance consistency**
  - **Validates: Requirements 15.2, 15.3, 16.3, 19.3**

- [ ] 10. Implement sales and billing system
  - Create Sale and SaleItem models
  - Implement document number generation service (shared utility for SI, PI, PV, JV using document_sequences table with row-level locking)
  - Implement sales invoice number generation (SI-XXXXX) using document number service
  - Implement create sale API (POST /api/sales) with transaction management
  - Automatically reduce inventory when sale is created
  - Create stock transactions for inventory reduction
  - Update customer outstanding balance based on payment
  - Handle payment methods (CASH, BANK, NONE)
  - Update cash/bank balances based on payment
  - Create financial transaction records
  - Implement get sales APIs (GET /api/sales, GET /api/sales/:id)
  - Implement sales invoice generation API (GET /api/sales/:id/invoice)
  - Implement sales invoice PDF download API (GET /api/sales/:id/invoice/pdf)
  - _Requirements: 1.4, 1.5, 1.6, 4.2, 5.1, 6.2, 14.2, 15.2, 17.1, 17.2, 27.1, 28.1, 29.1_

- [ ] 10.1 Write property test for sale inventory reduction
  - **Property 1: Sale inventory reduction**
  - **Validates: Requirements 1.6, 4.2**

- [ ] 10.2 Write property test for customer balance tracking
  - **Property 2: Customer balance tracking**
  - **Validates: Requirements 1.6, 17.1, 17.2**

- [ ] 10.3 Write property test for invoice number uniqueness
  - **Property 9: Invoice number uniqueness**
  - **Validates: Requirements 5.1**

- [ ] 10.5 Write property test for purchase invoice number uniqueness
  - **Property 26: Purchase invoice number uniqueness**
  - **Validates: Requirement 25.1**

- [ ] 10.6 Write property test for document number sequence monotonicity
  - **Property 29: Document number sequence monotonicity**
  - **Validates: Requirements 29.1, 29.2, 29.3, 29.4**

- [ ] 10.4 Write property test for monetary calculations
  - **Property 10: Monetary calculation precision**
  - **Property 11: Sale total accuracy**
  - **Validates: Requirements 13.1, 13.2, 5.5**

- [ ] 11. Implement purchase management
  - Create Purchase and PurchaseItem models
  - Implement purchase invoice number generation (PI-XXXXX) using document number service
  - Implement create purchase API (POST /api/purchases)
  - Update supplier outstanding payable when purchase is created
  - Implement get purchases APIs (GET /api/purchases, GET /api/purchases/:id)
  - Implement purchase invoice generation API (GET /api/purchases/:id/invoice)
  - Implement purchase invoice PDF download API (GET /api/purchases/:id/invoice/pdf)
  - _Requirements: 18.2, 18.3, 18.5, 25.1, 25.2, 25.3, 25.4, 25.5, 27.2, 28.2, 29.2_

- [ ] 12. Implement payment allocation logic
  - Create Payment and PaymentAllocation models
  - Implement oldest-first payment allocation algorithm for customers
  - Implement oldest-first payment allocation algorithm for suppliers
  - Mark sales/purchases as fully paid when remaining amount reaches zero
  - _Requirements: 16.4, 16.5, 19.4, 19.5_

- [ ] 12.1 Write property test for customer payment allocation
  - **Property 3: Payment allocation oldest-first**
  - **Property 25: Payment allocation marking**
  - **Validates: Requirements 16.4, 16.5**

- [ ] 12.2 Write property test for supplier payment allocation
  - **Property 4: Supplier payment allocation oldest-first**
  - **Validates: Requirements 19.4, 19.5**

- [ ] 13. Implement payment recording system
  - Implement customer payment API (POST /api/payments/customer)
  - Implement supplier payment API (POST /api/payments/supplier)
  - Implement payment voucher number generation (PV-XXXXX) using document number service
  - Update cash/bank balances based on payment method
  - Create financial transaction records
  - Apply payment allocation logic
  - Update customer/supplier outstanding balances
  - Implement get payments API (GET /api/payments)
  - Implement payment voucher generation API (GET /api/payments/:id/voucher)
  - Implement payment voucher PDF download API (GET /api/payments/:id/voucher/pdf)
  - _Requirements: 16.1, 16.2, 16.3, 17.3, 19.1, 19.2, 19.3, 26.1, 26.2, 26.4, 26.5, 27.3, 28.3, 29.3_

- [ ] 13.1 Write property test for transaction ledger completeness
  - **Property 7: Transaction ledger completeness**
  - **Validates: Requirements 20.1, 20.2, 20.3**

- [ ] 13.2 Write property test for payment voucher number uniqueness
  - **Property 27: Payment voucher number uniqueness**
  - **Validates: Requirements 26.1, 26.2**

- [ ] 13.3 Write property test for adjustment voucher number uniqueness
  - **Property 28: Adjustment voucher number uniqueness**
  - **Validates: Requirement 26.3**

- [ ] 14. Implement transaction ledger system
  - Create Transaction model
  - Ensure all financial movements create transaction records
  - Implement adjustment voucher number generation (JV-XXXXX) for ADJUST type transactions using document number service
  - Implement transaction query API (GET /api/transactions)
  - Implement transaction filtering (date range, type, method, factory)
  - Implement adjustment voucher generation API (GET /api/transactions/:id/voucher)
  - Implement adjustment voucher PDF download API (GET /api/transactions/:id/voucher/pdf)
  - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 26.3, 26.4, 26.5, 27.4, 28.4, 29.4_

- [ ] 15. Implement reversal functionality
  - Implement sale reversal API (POST /api/sales/:id/revert)
  - Restore inventory quantities on sale reversal
  - Reverse payment allocations on sale reversal
  - Update customer balance on sale reversal
  - Implement payment reversal API (POST /api/payments/:id/revert)
  - Reverse cash/bank balance changes on payment reversal
  - Remove payment allocations on payment reversal
  - Create compensating transaction records with type REVERSAL
  - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5_

- [ ] 15.1 Write property test for sale reversal
  - **Property 14: Sale reversal completeness**
  - **Validates: Requirements 21.1**

- [ ] 15.2 Write property test for payment reversal
  - **Property 15: Payment reversal completeness**
  - **Validates: Requirements 21.2, 21.3, 21.4**

- [ ] 16. Implement reporting system
  - Implement daily sales report API (GET /api/reports/sales/daily)
  - Implement monthly sales report API (GET /api/reports/sales/monthly)
  - Implement sales by product report API (GET /api/reports/sales/by-product)
  - Implement inventory report API (GET /api/reports/inventory)
  - Implement customer dues report API (GET /api/reports/customer-dues)
  - Implement supplier payables report API (GET /api/reports/supplier-payables)
  - Implement cash flow report API (GET /api/reports/cash-flow)
  - Implement transaction ledger report API (GET /api/reports/transactions)
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 23.1, 23.2, 23.3, 23.4, 23.5_

- [ ] 16.1 Write property test for report aggregation accuracy
  - **Property 23: Report aggregation accuracy**
  - **Validates: Requirements 7.1, 7.2, 7.3, 13.5**

- [ ] 17. Implement user management (admin only)
  - Implement user CRUD APIs (GET, POST, PUT, DELETE /api/users)
  - Ensure only admins can access user management
  - Hash passwords on user creation/update
  - _Requirements: 8.1_

- [ ] 18. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise

- [ ] 19. Build frontend authentication module
  - Create LoginPage component with username/password form
  - Create AuthContext for managing authentication state
  - Implement login API call and token storage
  - Implement protected route wrapper
  - Implement logout functionality
  - _Requirements: 8.2_

- [ ] 20. Build frontend dashboard
  - Create DashboardPage component
  - Create SummaryCard component for metrics display
  - Display today's sales, bills, customers, dues, payables, cash, bank balances
  - Create RecentActivityList component for sales, purchases, payments
  - Display low stock alerts
  - Create QuickActionButtons for navigation
  - Implement factory-filtered data loading
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 20.1 Write property test for low stock alerts
  - **Property 24: Low stock alert threshold**
  - **Validates: Requirements 7.5, 10.3**

- [ ] 21. Build frontend billing/sales module
  - Create BillingPage component
  - Create CustomerSelector with search functionality
  - Create ProductCardGrid with large clickable cards
  - Create WeightCardGrid with large clickable cards
  - Create BillItemsList for cart display
  - Create PaymentForm with method selection (CASH, BANK, NONE)
  - Implement quantity and price input fields
  - Calculate line item totals and sale total
  - Implement save bill functionality
  - Filter products by active status and factory
  - Filter weights by available inventory
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.4, 3.5, 12.1, 12.3_

- [ ] 21.1 Write property test for available inventory filtering
  - **Property 18: Available inventory filtering**
  - **Validates: Requirements 3.5, 4.4**

- [ ] 22. Build frontend invoice and voucher generation
  - Create SalesInvoiceView component (SI-XXXXX)
  - Create PurchaseInvoiceView component (PI-XXXXX)
  - Create PaymentVoucherView component (PV-XXXXX)
  - Create AdjustmentVoucherView component (JV-XXXXX)
  - Create DocumentActionModal component (Print Now / Download PDF / Skip options shown after every transaction)
  - Display company information from settings on all documents
  - Display customer/supplier details, date, document number, and itemized lists
  - Display payment information (amount paid, method, remaining balance)
  - Display multiple partial payments if applicable
  - Implement browser print functionality for all document types
  - Implement PDF download functionality for all document types
  - Integrate DocumentActionModal into billing save, purchase save, payment record, and adjustment flows
  - Add view/print/download buttons to sale detail, purchase detail, payment detail, and transaction detail pages
  - _Requirements: 5.2, 5.3, 5.4, 5.5, 24.1, 24.4, 24.5, 25.2, 25.3, 25.4, 25.5, 26.4, 26.5, 27.1, 27.2, 27.3, 27.4, 27.5, 28.1, 28.2, 28.3, 28.4, 28.5, 30.1, 30.5_

- [ ] 23. Build frontend customer management
  - Create CustomerListPage with search
  - Create CustomerDetailPage with purchase history and outstanding balance
  - Create CustomerForm for add/edit
  - Display customer dues prominently
  - Implement quick-add customer during billing
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 12.4, 12.5, 17.5_

- [ ] 24. Build frontend supplier management
  - Create SupplierListPage with search
  - Create SupplierDetailPage with purchase history and payables
  - Create SupplierForm for add/edit
  - Create PurchaseForm for recording purchases
  - Display supplier payables prominently
  - _Requirements: 18.1, 18.2, 18.4, 18.5_

- [ ] 25. Build frontend inventory management
  - Create InventoryListPage displaying all product-weight combinations
  - Create StockAdjustmentForm for adding/adjusting stock
  - Create LowStockAlert component
  - Display current quantities grouped by product and weight
  - _Requirements: 4.1, 4.3, 4.5, 7.5_

- [ ] 26. Build frontend payment module
  - Create CustomerPaymentForm for recording customer payments
  - Create SupplierPaymentForm for recording supplier payments
  - Create PaymentMethodSelector (CASH/BANK)
  - Create BankAccountSelector dropdown
  - Display payment allocation results
  - _Requirements: 16.1, 19.1_

- [ ] 27. Build frontend financial management
  - Create CashAccountDisplay component
  - Create BankAccountList component
  - Create BankAccountForm (admin only)
  - Display current balances and account details
  - Implement direct balance setting (admin only)
  - _Requirements: 14.5, 15.5_

- [ ] 28. Build frontend reports module
  - Create SalesReportPage (daily/monthly)
  - Create InventoryReportPage
  - Create CustomerDuesReport
  - Create SupplierPayablesReport
  - Create CashFlowReport
  - Create TransactionLedgerReport
  - Implement date range filtering
  - Implement export functionality
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 23.1, 23.2, 23.3, 23.4, 23.5_

- [ ] 29. Build frontend settings and user management
  - Create SettingsPage for company configuration (admin only)
  - Create CompanyInfoForm for editing company details
  - Create UserManagementPage (admin only)
  - Implement logo upload functionality
  - _Requirements: 9.1, 9.4_

- [ ] 30. Implement mobile responsiveness
  - Make product and weight cards responsive (single column on mobile)
  - Implement touch-friendly sizing for all interactive elements
  - Use appropriate input types for numeric fields
  - Implement horizontal scrolling for tables on mobile
  - Create collapsible navigation menu for mobile
  - Test on various screen sizes
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ] 31. Implement reversal UI
  - Add revert button to sale detail view (accountant)
  - Add revert button to payment detail view (accountant)
  - Implement confirmation dialogs for reversals
  - Display reverted status clearly
  - _Requirements: 21.1, 21.2, 21.3, 21.5_

- [ ] 32. Implement deletion UI (admin only)
  - Add delete button to customer detail view (admin only)
  - Add delete button to supplier detail view (admin only)
  - Add delete button to bank account view (admin only)
  - Implement validation checks before deletion
  - Display appropriate error messages when deletion is prevented
  - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5_

- [ ] 32.1 Write property test for admin deletion validation
  - **Property 20: Admin deletion validation**
  - **Validates: Requirements 22.1, 22.2, 22.3**

- [ ] 32.2 Write property test for dynamic document reconstruction accuracy
  - **Property 30: Dynamic document reconstruction accuracy**
  - **Validates: Requirements 30.1, 30.5**

- [ ] 33. Implement error handling and validation
  - Add input validation on all forms
  - Display user-friendly error messages
  - Implement API error handling with consistent format
  - Add loading states for async operations
  - Implement optimistic UI updates where appropriate
  - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [ ] 34. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise

- [ ] 35. Polish and final testing
  - Test complete billing workflow end-to-end
  - Test payment allocation workflow end-to-end
  - Test reversal workflow end-to-end
  - Verify all role-based permissions work correctly
  - Verify factory data isolation works correctly
  - Test on multiple browsers
  - Test mobile responsiveness
  - Fix any remaining bugs
  - _Requirements: All_

---

## General Expense Manager

- [ ] 36. Create database tables for expense manager
  - Create `expense_groups` table: id, factory_id, name, is_active, created_at
  - Create `expense_khatas` table: id, factory_id, group_id (FK → expense_groups), name, is_active, created_at
  - Create `expenses` table: id, factory_id, group_id, khata_id, description, amount (DECIMAL 10,2), payment_method (ENUM CASH/BANK), bank_id (nullable FK → bank_accounts), expense_date (DATE), created_by (FK → users), created_at
  - Add migration script and seed a few default groups (e.g., "Utilities", "Salaries", "Maintenance") with sample khatas
  - _Requirements: 31.2, 32.1, 32.2_

- [ ] 37. Implement backend expense group and khata APIs
  - `GET /api/expenses/groups` — list all active groups with their khatas for the factory
  - `POST /api/expenses/groups` — create a new expense group (admin only)
  - `PUT /api/expenses/groups/:id` — update/deactivate a group (admin only)
  - `POST /api/expenses/khatas` — create a new khata under a group (admin only)
  - `PUT /api/expenses/khatas/:id` — update/deactivate a khata (admin only)
  - _Requirements: 32.1, 32.2, 32.4, 32.5_

- [ ] 38. Implement backend expense CRUD and financial integration
  - `GET /api/expenses` — list expenses for factory with optional filters (date range, group_id, khata_id)
  - `POST /api/expenses` — record a new expense; decrease cash or bank balance; create a transaction record (type OUT, source_type SYSTEM)
  - `DELETE /api/expenses/:id` — soft-delete or hard-delete an expense (admin only); reverse the cash/bank balance change
  - Validate that cash/bank balance does not go negative on expense recording
  - _Requirements: 31.2, 31.3, 31.4, 33.1_

- [ ] 39. Build frontend Expense Manager page
  - Create `ExpensePage.jsx` under `frontend/src/pages/`
  - Add route `/expenses` in `App.jsx` and a sidebar nav link "Expenses"
  - Layout: summary cards row at top (Total Expenses, Cash Expenses, Bank Expenses, Count), then filter bar (date from/to, group filter, khata filter), then expense entry form, then expenses table
  - Summary cards update when filters change
  - Expense table columns: Date, Group, Khata, Description, Method, Bank, Amount
  - _Requirements: 31.1, 33.1, 33.2, 33.4_

- [ ] 40. Implement searchable Group → Khata combobox
  - Create a reusable `ExpenseCombobox` component (or extend existing Combobox pattern)
  - Fetch groups+khatas from `GET /api/expenses/groups` on mount
  - Display options as "Group → Khata" in the dropdown list
  - Support keyboard typing to filter options in real time
  - On selection, store both `group_id` and `khata_id` in form state
  - _Requirements: 31.5, 32.3_

- [ ] 41. Implement expense entry form and submission
  - Form fields: date (default today), Group→Khata combobox, description (text), amount (number), payment method toggle (CASH / BANK), bank selector (shown when BANK selected)
  - On submit: call `POST /api/expenses`, refresh summary cards and table on success, show toast notification
  - Client-side validation: amount > 0, khata selected, payment method selected, bank required if BANK
  - _Requirements: 31.2, 31.3, 31.4_

- [ ] 42. Build frontend category management UI
  - Add a "Manage Categories" section or modal within ExpensePage (admin only)
  - List all groups; each group shows its khatas
  - "Add Group" button → inline form to create a new group
  - "Add Khata" button per group → inline form to create a khata under that group
  - Toggle active/inactive for groups and khatas
  - _Requirements: 32.1, 32.2, 32.4, 32.5_

- [ ] 43. Implement expense filtering and summary aggregation
  - Wire date-from / date-to inputs to re-fetch `GET /api/expenses?from=&to=&group_id=&khata_id=`
  - Compute summary card values from the returned expense list (total, cash total, bank total, count)
  - Group/khata filter dropdowns populated from the groups API
  - _Requirements: 33.2, 33.3, 33.5_

---

## Employee Management & Employee Khata System

- [x] 44. Create database tables for employee management
  - Create `employees` table: id, factory_id, name, phone, address, monthly_salary (DECIMAL 10,2), is_active (BOOLEAN DEFAULT true), created_at
  - Create `employee_khata_entries` table: id, factory_id, employee_id (FK → employees), entry_type (ENUM DEBIT/CREDIT), amount (DECIMAL 10,2), description, payment_method (ENUM CASH/BANK), bank_id (nullable FK → bank_accounts), entry_date (DATE), transaction_id (nullable FK → transactions), created_by (FK → users), created_at
  - Create `employee_salary_payments` table: id, factory_id, employee_id (FK → employees), salary_month (DATE — store as first day of month), amount (DECIMAL 10,2), payment_method (ENUM CASH/BANK), bank_id (nullable FK → bank_accounts), notes, transaction_id (nullable FK → transactions), created_by (FK → users), created_at
  - Add migration script `008_employee_management.sql`
  - _Requirements: 34.1, 35.1, 37.1_

- [x] 45. Implement backend employee CRUD APIs
  - `GET /api/employees` — list all employees for the factory (supports ?search= for name/phone filter, ?active=true/false)
  - `POST /api/employees` — create a new employee (admin only); store name, phone, address, monthly_salary
  - `PUT /api/employees/:id` — update employee details (admin only)
  - `DELETE /api/employees/:id` — soft-delete (set is_active = false) if employee has khata entries or salary records; hard-delete otherwise (admin only)
  - `GET /api/employees/:id` — get single employee with current outstanding balance
  - _Requirements: 34.1, 34.2, 34.3, 34.4, 34.5_

- [x] 46. Implement backend employee khata entry APIs
  - `GET /api/employees/:id/khata` — list all khata entries ordered by entry_date ASC, created_at ASC; include running balance column: SUM(CREDIT) - SUM(DEBIT) as a window function
  - `POST /api/employees/:id/khata` — record a new entry:
    - CREDIT (mill gives cash out): decrease cash/bank balance, increase outstanding, create OUT transaction record with PV-XXXXX
    - DEBIT with cash repayment: increase cash/bank balance, decrease outstanding, create IN transaction record with PV-XXXXX
    - DEBIT for salary-earned (no cash movement): just record the entry, no cash/bank change, no transaction record
  - `DELETE /api/employees/:id/khata/:entryId` — admin only; reverse cash/bank change if applicable; delete linked transaction record
  - Outstanding balance formula: SUM(CREDIT amounts) - SUM(DEBIT amounts)
  - _Requirements: 35.1, 35.2, 35.3, 35.4, 36.1, 36.2, 36.3, 36.4, 38.1, 38.2_

- [x] 47. Implement backend salary payment APIs
  - `GET /api/salary` — list salary payments for the factory with optional ?employee_id= and ?month= filters; include employee name
  - `POST /api/employees/:id/salary` — record a salary payment; decrease cash or bank balance; auto-post a CREDIT entry in employee's khata (mill gave cash out); create OUT transaction record with PV-XXXXX and note "Salary: [Month Year]"
  - `DELETE /api/employees/:id/salary/:paymentId` — admin only; reverse cash/bank balance; delete the linked khata CREDIT entry and transaction record
  - Validate cash/bank balance does not go negative
  - _Requirements: 37.1, 37.2, 37.3, 37.4, 37.5, 38.3_

- [x] 48. Integrate employee transactions into global payments/transactions ledger
  - Ensure `GET /api/transactions` returns employee transactions (source_type = 'EMPLOYEE') alongside customer and supplier transactions
  - Add employee name to transaction response (JOIN employees table when source_type = 'EMPLOYEE')
  - Support `?source_type=EMPLOYEE` filter on `GET /api/transactions`
  - Ensure PV-XXXXX voucher numbers for employee transactions use the same document_sequences counter as customer/supplier payments
  - _Requirements: 38.1, 38.2, 38.3, 38.4, 38.5_

- [x] 49. Build frontend Employee List page
  - Create `EmployeesPage.jsx` under `frontend/src/pages/`
  - Add route `/employees` in `App.jsx` and a sidebar nav link "Employees" (between Expenses and Settings)
  - Layout: search bar at top, summary card showing total outstanding across all employees, employee table
  - Employee table columns: Name, Phone, Monthly Salary, Outstanding Balance, Status, Actions (View, Edit, Delete — admin only)
  - "Add Employee" button (admin only) opens a modal: name, phone, address, monthly salary
  - Edit employee opens the same form pre-filled
  - Delete with confirmation dialog; show error if employee has transactions
  - _Requirements: 34.1, 34.3, 34.4, 34.5, 39.1, 39.2, 39.3_

- [x] 50. Build frontend Employee Detail page (Khata tab)
  - Create `EmployeeDetailPage.jsx` under `frontend/src/pages/`
  - Add route `/employees/:id` in `App.jsx`
  - Page header: employee name, phone, monthly salary, current outstanding balance
  - Khata entry form: date (default today), entry type toggle (DEBIT / CREDIT), amount, description
    - CREDIT only: show payment method (CASH/BANK) and bank selector — cash moves out of mill
    - DEBIT: show optional "cash repayment" toggle; if enabled show payment method — cash comes back to mill; if disabled (salary-earned) no cash movement
  - Khata table: Date, Description, Debit, Credit, Balance (running) — same style as customer individual report
  - On submit: call `POST /api/employees/:id/khata`, refresh table and outstanding balance in header
  - Delete button on each row (admin only) with confirmation
  - _Requirements: 35.1, 35.2, 35.3, 35.4, 35.5, 36.1, 36.2, 36.3, 36.4, 36.5_

- [x] 51. Build frontend Salary page (separate payroll page)
  - Create `SalaryPage.jsx` under `frontend/src/pages/`
  - Add route `/salary` in `App.jsx` and a sidebar nav link "Salary" (next to Employees)
  - Layout: search bar to find an employee, employee summary card (name, monthly salary, last payment), salary history table for selected employee, salary payment form
  - Salary payment form: month/year picker, amount (pre-filled with employee's monthly_salary, editable), payment method (CASH/BANK), bank selector if BANK, notes
  - On submit: call `POST /api/employees/:id/salary`; this auto-posts a CREDIT in the employee's khata and deducts from cash/bank
  - Salary history table columns: Month, Amount, Method, Bank, Date Recorded, Actions (Delete — admin only)
  - Delete with confirmation; reverses cash/bank balance and removes linked khata CREDIT entry
  - _Requirements: 37.1, 37.2, 37.3, 37.4, 37.5_

- [x] 52. Update global Transactions/Payments page and dashboard for employees
  - Add "Employee" as a source type filter option on TransactionsPage
  - Ensure employee transactions display employee name in the reference/source column
  - Add an "Employee Outstanding" summary card to DashboardPage (total across all employees)
  - _Requirements: 38.3, 38.4, 39.5_
