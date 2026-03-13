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
  - Create migration scripts for all tables (factories, users, customers, suppliers, products, bag_weights, inventory, sales, sale_items, purchases, purchase_items, cash_accounts, bank_accounts, payments, payment_allocations, transactions, stock_transactions, settings)
  - Implement foreign key constraints and indexes
  - Add unique constraints (invoice_number, username, factory_id+product_id+weight_id)
  - Seed initial data (bag weights: 8kg, 10kg, 20kg, 40kg, 50kg)
  - _Requirements: 3.1, 3.2, 4.1, 14.1, 15.1_

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
  - Implement invoice number generation (INV-{YEAR}-{SEQUENCE})
  - Implement create sale API (POST /api/sales) with transaction management
  - Automatically reduce inventory when sale is created
  - Create stock transactions for inventory reduction
  - Update customer outstanding balance based on payment
  - Handle payment methods (CASH, BANK, NONE)
  - Update cash/bank balances based on payment
  - Create financial transaction records
  - Implement get sales APIs (GET /api/sales, GET /api/sales/:id)
  - _Requirements: 1.4, 1.5, 1.6, 4.2, 5.1, 6.2, 14.2, 15.2, 17.1, 17.2_

- [ ] 10.1 Write property test for sale inventory reduction
  - **Property 1: Sale inventory reduction**
  - **Validates: Requirements 1.6, 4.2**

- [ ] 10.2 Write property test for customer balance tracking
  - **Property 2: Customer balance tracking**
  - **Validates: Requirements 1.6, 17.1, 17.2**

- [ ] 10.3 Write property test for invoice number uniqueness
  - **Property 9: Invoice number uniqueness**
  - **Validates: Requirements 5.1**

- [ ] 10.4 Write property test for monetary calculations
  - **Property 10: Monetary calculation precision**
  - **Property 11: Sale total accuracy**
  - **Validates: Requirements 13.1, 13.2, 5.5**

- [ ] 11. Implement purchase management
  - Create Purchase and PurchaseItem models
  - Implement create purchase API (POST /api/purchases)
  - Update supplier outstanding payable when purchase is created
  - Implement get purchases APIs (GET /api/purchases, GET /api/purchases/:id)
  - _Requirements: 18.2, 18.3, 18.5_

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
  - Update cash/bank balances based on payment method
  - Create financial transaction records
  - Apply payment allocation logic
  - Update customer/supplier outstanding balances
  - Implement get payments API (GET /api/payments)
  - _Requirements: 16.1, 16.2, 16.3, 17.3, 19.1, 19.2, 19.3_

- [ ] 13.1 Write property test for transaction ledger completeness
  - **Property 7: Transaction ledger completeness**
  - **Validates: Requirements 20.1, 20.2, 20.3**

- [ ] 14. Implement transaction ledger system
  - Create Transaction model
  - Ensure all financial movements create transaction records
  - Implement transaction query API (GET /api/transactions)
  - Implement transaction filtering (date range, type, method, factory)
  - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5_

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

- [ ] 22. Build frontend invoice generation
  - Create InvoiceView component
  - Display company information from settings
  - Display customer details
  - Display sale date and invoice number
  - Display itemized product list with totals
  - Display payment information (amount paid, method, remaining balance)
  - Display multiple partial payments if applicable
  - Implement print functionality
  - _Requirements: 5.2, 5.3, 5.4, 5.5, 24.1, 24.4, 24.5_

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
