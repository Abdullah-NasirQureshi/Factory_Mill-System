# Requirements Document

## Introduction

This document specifies the requirements for a Factory ERP/Inventory & Billing System designed for small-scale manufacturing businesses, specifically flour mills and grain-based product operations. The system manages sales transactions, inventory tracking, customer records, and billing operations with emphasis on speed, simplicity, and ease of use for non-technical staff. The primary user is an accountant or manager performing rapid billing operations at a sales desk.

## Glossary

- **System**: The Factory ERP/Inventory & Billing System
- **Admin**: A user role with full system access including configuration, user management, bank account management, and deletion permissions
- **Accountant**: A user role with operational access to sales, customers, inventory, payments, and the ability to revert transactions
- **Factory**: A business location or branch that maintains its own inventory and sales records
- **Product**: A commodity sold by the factory (e.g., Flour, Besan, Maida)
- **Bag Weight**: A standardized package size for products (e.g., 8kg, 20kg, 40kg)
- **Inventory Item**: A specific combination of product and bag weight with quantity tracking
- **Sale**: A billing transaction recording products sold to a customer
- **Sale Item**: An individual line item within a sale containing product, weight, quantity, and price
- **Stock Transaction**: A record of inventory changes including additions, sales, and adjustments
- **Invoice**: A printable document generated from a sale transaction
- **Cash Account**: A record tracking physical cash held by the factory
- **Bank Account**: A financial account representing factory funds held at a banking institution
- **Customer Credit**: Outstanding amount owed by a customer to the factory (accounts receivable)
- **Supplier**: A vendor from whom the factory purchases raw materials or goods
- **Purchase**: A transaction recording goods bought from a supplier
- **Supplier Payable**: Outstanding amount the factory owes to a supplier (accounts payable)
- **Payment**: A financial transaction recording money received from customers or paid to suppliers
- **Transaction**: A central ledger entry recording all financial movements in the system
- **Payment Allocation**: The process of applying payments to outstanding dues starting from oldest records first

## Requirements

### Requirement 1

**User Story:** As an accountant, I want to create sales bills quickly using large clickable cards, so that I can process customer transactions efficiently without excessive typing.

#### Acceptance Criteria

1. WHEN the accountant accesses the billing interface, THE System SHALL display all active products as large clickable cards
2. WHEN the accountant selects a product card, THE System SHALL display available bag weights as large clickable cards
3. WHEN the accountant selects a bag weight, THE System SHALL present input fields for quantity and price with focus on quantity field
4. WHEN the accountant adds an item to the bill, THE System SHALL display the item in a cart-style list showing product, weight, quantity, price, and calculated total
5. WHEN the accountant enters payment information, THE System SHALL provide options for payment method including CASH, BANK, or NONE for credit sales
6. WHEN the accountant saves the bill, THE System SHALL create a sale record, reduce inventory quantities automatically, and update customer outstanding balance if payment is partial or none

### Requirement 2

**User Story:** As an accountant, I want to manage customer records with their contact information, purchase history, and outstanding balances, so that I can track customer relationships, sales patterns, and credit status.

#### Acceptance Criteria

1. WHEN an accountant adds a new customer, THE System SHALL store the customer name, phone number, address, factory association, and creation timestamp
2. WHEN an accountant searches for customers, THE System SHALL return matching results based on name or phone number
3. WHEN an accountant views customer details, THE System SHALL display the customer information, complete purchase history, and total outstanding balance
4. WHEN an accountant edits customer information, THE System SHALL update the customer record and maintain referential integrity with existing sales
5. WHEN displaying customer purchase history, THE System SHALL show sale date, products purchased, quantities, total amounts, paid amounts, and remaining balances

### Requirement 3

**User Story:** As an admin, I want to define products and their available bag weights, so that the billing system reflects the actual product catalog.

#### Acceptance Criteria

1. WHEN an admin creates a product, THE System SHALL store the product name, factory association, and active status
2. WHEN an admin creates a bag weight, THE System SHALL store the weight value and unit of measurement
3. WHEN an admin deactivates a product, THE System SHALL prevent the product from appearing in billing interfaces while preserving historical sales data
4. WHEN displaying products for billing, THE System SHALL show only active products associated with the current factory
5. WHEN a product is selected during billing, THE System SHALL display only bag weights that have inventory available for that product

### Requirement 4

**User Story:** As an admin, I want to manage inventory levels for each product-weight combination, so that I can track stock availability and prevent overselling.

#### Acceptance Criteria

1. WHEN an admin adds stock, THE System SHALL increase the inventory quantity for the specified product, weight, and factory combination
2. WHEN a sale is completed, THE System SHALL automatically reduce inventory quantity by the sold amount
3. WHEN an admin adjusts inventory, THE System SHALL update the quantity and create a stock transaction record with the adjustment reason
4. WHEN inventory quantity reaches zero, THE System SHALL prevent that product-weight combination from being selected in new sales
5. WHEN displaying inventory, THE System SHALL show current quantities grouped by product and weight with factory context

### Requirement 5

**User Story:** As an accountant, I want to generate and print invoices for completed sales, so that I can provide customers with official transaction records.

#### Acceptance Criteria

1. WHEN a sale is saved, THE System SHALL generate a unique invoice number for that transaction
2. WHEN an invoice is viewed, THE System SHALL display company information, customer details, sale date, and itemized product list with totals
3. WHEN an invoice is printed, THE System SHALL format the document with company logo, address, phone number, and custom footer text
4. WHEN displaying sale items on an invoice, THE System SHALL show product name, bag weight, quantity, unit price, and line total
5. WHEN calculating invoice totals, THE System SHALL sum all line item totals and display the grand total amount

### Requirement 6

**User Story:** As an admin, I want to track all inventory changes through stock transactions, so that I can audit inventory movements and identify discrepancies.

#### Acceptance Criteria

1. WHEN stock is added to inventory, THE System SHALL create a stock transaction record with type ADD, quantity, and timestamp
2. WHEN a sale reduces inventory, THE System SHALL create a stock transaction record with type SALE, quantity, and reference to the sale
3. WHEN an admin adjusts inventory, THE System SHALL create a stock transaction record with type ADJUST, quantity change, and explanatory note
4. WHEN viewing stock transactions, THE System SHALL display transaction type, product, weight, quantity, date, and associated notes
5. WHEN filtering stock transactions, THE System SHALL support filtering by date range, product, transaction type, and factory

### Requirement 7

**User Story:** As an accountant, I want to view business reports showing sales performance and inventory status, so that I can make informed operational decisions.

#### Acceptance Criteria

1. WHEN an accountant requests a daily sales report, THE System SHALL display total sales amount, number of bills, and itemized product sales for the current date
2. WHEN an accountant requests a monthly sales report, THE System SHALL aggregate sales data by day for the specified month
3. WHEN an accountant views sales by product, THE System SHALL show total quantity sold and revenue for each product within the specified period
4. WHEN an accountant views inventory reports, THE System SHALL display current stock levels for all product-weight combinations
5. WHEN inventory levels fall below a configurable threshold, THE System SHALL highlight those items as low stock alerts

### Requirement 8

**User Story:** As an admin, I want to manage user accounts with role-based permissions, so that I can control system access and maintain security.

#### Acceptance Criteria

1. WHEN an admin creates a user account, THE System SHALL store username, hashed password, role, factory association, and creation timestamp
2. WHEN a user logs in, THE System SHALL verify credentials against stored hashed passwords and return an authentication token upon success
3. WHEN a user attempts to access a protected resource, THE System SHALL validate the authentication token and verify role permissions
4. WHEN an admin assigns the Admin role, THE System SHALL grant full access including user management, bank account creation, direct balance setting, and deletion of customers, suppliers, and banks
5. WHEN an admin assigns the Accountant role, THE System SHALL grant operational access to sales, customers, inventory, payments, and the ability to revert bills, sales, and payments

### Requirement 9

**User Story:** As an admin, I want to configure factory-specific settings including company information and invoice customization, so that generated documents reflect the correct business identity.

#### Acceptance Criteria

1. WHEN an admin updates company settings, THE System SHALL store company name, logo, address, phone number, and invoice footer text
2. WHEN generating an invoice, THE System SHALL retrieve settings for the factory associated with the sale
3. WHEN displaying the dashboard, THE System SHALL show the company name from factory settings
4. WHEN an admin uploads a company logo, THE System SHALL store the logo file and display it on invoices and system headers
5. WHEN multiple factories exist, THE System SHALL maintain separate settings for each factory

### Requirement 10

**User Story:** As an accountant, I want to view a dashboard with key business metrics and quick actions, so that I can quickly assess daily operations and access common tasks.

#### Acceptance Criteria

1. WHEN a user accesses the dashboard, THE System SHALL display summary cards showing today's total sales amount, number of bills, total customers, customer dues, supplier payables, cash in hand, and bank balances
2. WHEN displaying recent activity on the dashboard, THE System SHALL show recent sales, recent purchases, and recent payments with relevant details
3. WHEN inventory items have low stock, THE System SHALL display alerts on the dashboard highlighting products below the threshold
4. WHEN a user clicks quick action buttons, THE System SHALL navigate to create bill, add customer, record payment, or add stock interfaces
5. WHEN dashboard data is loaded, THE System SHALL filter all metrics by the user's associated factory

### Requirement 11

**User Story:** As a manager, I want the system to be responsive and mobile-compatible, so that I can access billing and inventory functions from tablets or mobile devices.

#### Acceptance Criteria

1. WHEN the system is accessed on a mobile device, THE System SHALL adapt the layout to fit smaller screen sizes while maintaining functionality
2. WHEN product and weight cards are displayed on mobile, THE System SHALL arrange them in a single column with touch-friendly sizing
3. WHEN forms are displayed on mobile, THE System SHALL use appropriate input types for numeric fields to trigger numeric keyboards
4. WHEN tables are displayed on mobile, THE System SHALL provide horizontal scrolling or responsive column hiding to maintain readability
5. WHEN navigation is accessed on mobile, THE System SHALL provide a collapsible menu or hamburger icon for space efficiency

### Requirement 12

**User Story:** As an accountant, I want to select customers quickly during billing, so that I can associate sales with the correct customer account.

#### Acceptance Criteria

1. WHEN the accountant starts a new bill, THE System SHALL provide a customer selection interface with search capability
2. WHEN the accountant searches for a customer, THE System SHALL filter results in real-time as characters are typed
3. WHEN the accountant selects a customer, THE System SHALL associate that customer with the current bill and display their name prominently
4. WHEN the accountant needs to add a new customer during billing, THE System SHALL provide a quick-add form without leaving the billing interface
5. WHEN a customer is selected, THE System SHALL display their recent purchase history as reference information

### Requirement 13

**User Story:** As a system user, I want all monetary calculations to be accurate and consistent, so that financial records are reliable and trustworthy.

#### Acceptance Criteria

1. WHEN calculating line item totals, THE System SHALL multiply quantity by price and round to two decimal places
2. WHEN calculating sale totals, THE System SHALL sum all line item totals with consistent rounding
3. WHEN displaying monetary values, THE System SHALL format amounts with appropriate currency symbols and decimal precision
4. WHEN storing monetary values in the database, THE System SHALL use appropriate decimal data types to prevent precision loss
5. WHEN aggregating sales for reports, THE System SHALL maintain calculation accuracy across all summation operations

### Requirement 14

**User Story:** As an admin, I want to manage the factory's cash account to track physical cash holdings, so that I can monitor cash flow and maintain accurate cash balances.

#### Acceptance Criteria

1. WHEN an admin initializes a cash account, THE System SHALL create a cash account record for the factory with an initial balance
2. WHEN a customer pays cash for a sale, THE System SHALL increase the cash account balance by the payment amount
3. WHEN the factory pays a supplier in cash, THE System SHALL decrease the cash account balance by the payment amount
4. WHEN an admin directly sets the cash balance, THE System SHALL update the cash account balance and create a transaction record with type ADJUST
5. WHEN displaying the cash account, THE System SHALL show the current balance and timestamp of last update

### Requirement 15

**User Story:** As an admin, I want to manage multiple bank accounts for the factory, so that I can track funds across different banking institutions.

#### Acceptance Criteria

1. WHEN an admin creates a bank account, THE System SHALL store bank name, account title, account number, factory association, and current balance
2. WHEN a customer pays via bank transfer, THE System SHALL increase the specified bank account balance by the payment amount
3. WHEN the factory pays a supplier via bank, THE System SHALL decrease the specified bank account balance by the payment amount
4. WHEN an admin directly sets a bank balance, THE System SHALL update the bank account balance and create a transaction record with type ADJUST
5. WHEN displaying bank accounts, THE System SHALL show all accounts for the factory with current balances and account details

### Requirement 16

**User Story:** As an accountant, I want to record customer payments with flexible payment methods, so that I can track money received and reduce customer outstanding balances.

#### Acceptance Criteria

1. WHEN an accountant records a customer payment, THE System SHALL accept payment amount, payment method (CASH or BANK), and optional bank selection
2. WHEN a customer payment is recorded with CASH method, THE System SHALL increase the cash account balance and create a transaction record
3. WHEN a customer payment is recorded with BANK method, THE System SHALL increase the selected bank account balance and create a transaction record
4. WHEN a customer payment is recorded, THE System SHALL allocate the payment to the customer's outstanding sales starting from the oldest unpaid sale first
5. WHEN a payment fully covers a sale's remaining balance, THE System SHALL mark that sale as fully paid and apply remaining payment to the next oldest sale

### Requirement 17

**User Story:** As an accountant, I want the system to automatically track customer credit balances, so that I can identify which customers owe money and how much.

#### Acceptance Criteria

1. WHEN a sale is created with partial payment, THE System SHALL calculate the remaining amount and add it to the customer's outstanding balance
2. WHEN a sale is created with no payment, THE System SHALL add the full sale amount to the customer's outstanding balance
3. WHEN a customer makes a payment, THE System SHALL reduce the customer's outstanding balance by the payment amount after allocation
4. WHEN viewing customer details, THE System SHALL display the total outstanding balance as the sum of all unpaid amounts across all sales
5. WHEN displaying a list of customers, THE System SHALL show each customer's total outstanding balance alongside their contact information

### Requirement 18

**User Story:** As an accountant, I want to manage supplier records and track purchases, so that I can maintain supplier relationships and monitor what the factory owes.

#### Acceptance Criteria

1. WHEN an accountant creates a supplier, THE System SHALL store supplier name, phone number, address, factory association, and creation timestamp
2. WHEN an accountant records a purchase from a supplier, THE System SHALL store supplier reference, purchase date, product details, quantity, unit price, and total amount
3. WHEN a purchase is recorded, THE System SHALL add the purchase amount to the supplier's outstanding payable balance
4. WHEN viewing supplier details, THE System SHALL display supplier information, purchase history, and total outstanding payable amount
5. WHEN displaying supplier purchase history, THE System SHALL show purchase date, product details, total amount, paid amount, and remaining balance

### Requirement 19

**User Story:** As an accountant, I want to record payments to suppliers with flexible payment methods, so that I can track money paid out and reduce supplier payable balances.

#### Acceptance Criteria

1. WHEN an accountant records a supplier payment, THE System SHALL accept payment amount, payment method (CASH or BANK), and optional bank selection
2. WHEN a supplier payment is recorded with CASH method, THE System SHALL decrease the cash account balance and create a transaction record
3. WHEN a supplier payment is recorded with BANK method, THE System SHALL decrease the selected bank account balance and create a transaction record
4. WHEN a supplier payment is recorded, THE System SHALL allocate the payment to the supplier's outstanding purchases starting from the oldest unpaid purchase first
5. WHEN a payment fully covers a purchase's remaining balance, THE System SHALL mark that purchase as fully paid and apply remaining payment to the next oldest purchase

### Requirement 20

**User Story:** As an admin, I want all financial movements to be recorded in a central transaction ledger, so that I can audit money flows and maintain financial transparency.

#### Acceptance Criteria

1. WHEN a customer payment is received, THE System SHALL create a transaction record with type IN, source type CUSTOMER, payment method, amount, and reference to the customer
2. WHEN a supplier payment is made, THE System SHALL create a transaction record with type OUT, source type SUPPLIER, payment method, amount, and reference to the supplier
3. WHEN an admin adjusts cash or bank balances, THE System SHALL create a transaction record with type ADJUST, payment method, amount, and explanatory notes
4. WHEN viewing transactions, THE System SHALL display transaction type, source, payment method, bank name if applicable, amount, reference details, and timestamp
5. WHEN filtering transactions, THE System SHALL support filtering by date range, transaction type, payment method, and factory

### Requirement 21

**User Story:** As an accountant, I want to revert incorrectly recorded bills, sales, or payments, so that I can correct mistakes without compromising data integrity.

#### Acceptance Criteria

1. WHEN an accountant reverts a sale, THE System SHALL restore the inventory quantities that were reduced, reverse any payment allocations, and mark the sale as reverted
2. WHEN an accountant reverts a customer payment, THE System SHALL reverse the cash or bank balance change, remove payment allocations from sales, and mark the payment as reverted
3. WHEN an accountant reverts a supplier payment, THE System SHALL reverse the cash or bank balance change, remove payment allocations from purchases, and mark the payment as reverted
4. WHEN a transaction is reverted, THE System SHALL create a compensating transaction record in the ledger with type REVERSAL
5. WHEN displaying reverted transactions, THE System SHALL clearly indicate the reverted status and maintain the original record for audit purposes

### Requirement 22

**User Story:** As an admin, I want exclusive permissions to delete customers, suppliers, and bank accounts, so that critical data removal is controlled and protected.

#### Acceptance Criteria

1. WHEN an admin attempts to delete a customer, THE System SHALL verify admin role and prevent deletion if the customer has associated sales or outstanding balance
2. WHEN an admin attempts to delete a supplier, THE System SHALL verify admin role and prevent deletion if the supplier has associated purchases or outstanding payables
3. WHEN an admin attempts to delete a bank account, THE System SHALL verify admin role and prevent deletion if the account has a non-zero balance or associated transactions
4. WHEN an accountant attempts to delete customers, suppliers, or banks, THE System SHALL deny the operation and return an authorization error
5. WHEN an admin successfully deletes a customer, supplier, or bank, THE System SHALL remove the record and log the deletion action with timestamp and admin user reference

### Requirement 23

**User Story:** As an accountant, I want to view comprehensive financial reports including customer dues, supplier payables, and cash flow, so that I can understand the factory's financial position.

#### Acceptance Criteria

1. WHEN an accountant requests a customer dues report, THE System SHALL display all customers with outstanding balances, showing customer name, total dues, and aging of oldest unpaid sale
2. WHEN an accountant requests a supplier payables report, THE System SHALL display all suppliers with outstanding balances, showing supplier name, total payables, and aging of oldest unpaid purchase
3. WHEN an accountant requests a cash flow report, THE System SHALL display cash and bank account balances with recent transaction history
4. WHEN an accountant requests a payment history report, THE System SHALL display all payments received from customers and made to suppliers within a specified date range
5. WHEN an accountant requests a transaction ledger report, THE System SHALL display all financial transactions with filtering options for type, method, and date range

### Requirement 24

**User Story:** As an accountant, I want to generate invoices that show payment status and outstanding balances, so that customers receive complete financial information.

#### Acceptance Criteria

1. WHEN an invoice is generated for a sale, THE System SHALL display the total sale amount, amount paid, payment method used, and remaining balance
2. WHEN an invoice is generated for a customer, THE System SHALL display all sales with their payment status and the customer's total outstanding balance
3. WHEN an invoice is generated for a supplier, THE System SHALL display all purchases with their payment status and the supplier's total outstanding payable
4. WHEN displaying payment information on an invoice, THE System SHALL show payment date, payment method, and bank name if applicable
5. WHEN a sale has multiple partial payments, THE System SHALL list all payments with dates and amounts on the invoice
