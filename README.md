# Factory ERP System

A lightweight ERP system designed for small-scale manufacturing businesses, specifically flour mills and grain-based product operations. The system provides comprehensive management of sales transactions, inventory tracking, customer and supplier relationships, and financial accounting.

## 🎯 Features

- **Fast Sales Billing** - Card-based product selection with minimal typing
- **Inventory Management** - Automatic stock tracking and low stock alerts
- **Customer Credit Management** - Track outstanding balances with automatic payment allocation
- **Supplier Management** - Purchase tracking and payables management
- **Multi-Bank Account Support** - Manage multiple bank accounts and cash flow
- **Financial Ledger** - Complete transaction audit trail
- **Comprehensive Reports** - Sales, inventory, customer dues, and financial reports
- **Mobile Responsive** - Works seamlessly on tablets and mobile devices
- **Role-Based Access** - Admin and Accountant roles with specific permissions

## 🏗️ Architecture

The system follows a three-layer architecture:

- **Frontend**: React + Custom CSS (following reference design system)
- **Backend**: Node.js + Express.js
- **Database**: MySQL

## 📋 Project Structure

```
.
├── factory-erp-system/
│   ├── requirements.md           # Detailed requirements with acceptance criteria
│   ├── design.md                 # System design and architecture
│   ├── tasks.md                  # Implementation task list
│   └── frontend-reference.md     # Frontend design reference notes
├── reference/
│   └── erp_system.html           # Reference UI design and styling
├── backend/                       # Node.js backend (to be created)
├── frontend/                      # React frontend (to be created)
├── .gitignore
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- MySQL (v8 or higher)
- npm or yarn

### Installation

Instructions will be added once the implementation begins.

## 📖 Documentation

- **Requirements**: See `factory-erp-system/requirements.md`
- **Design**: See `factory-erp-system/design.md`
- **Tasks**: See `factory-erp-system/tasks.md`
- **Frontend Reference**: See `factory-erp-system/frontend-reference.md`

## 🎨 Design System

The frontend strictly follows the design system defined in `reference/erp_system.html`, including:
- CSS variables and design tokens
- Component styling patterns
- Layout structure
- Interactive states
- Responsive behavior

## 👥 User Roles

- **Admin**: Full system access including user management, bank account management, and deletion permissions
- **Accountant**: Operational access to sales, customers, inventory, payments, and transaction reversals

## 🔐 Security Features

- Password hashing with bcrypt
- JWT-based authentication
- Role-based authorization
- Factory data isolation
- Audit trail for all financial transactions

## 📊 Key Modules

1. Authentication & User Management
2. Dashboard with Business Metrics
3. Sales & Billing (POS-style interface)
4. Customer Management
5. Supplier Management
6. Inventory Management
7. Payment Processing
8. Financial Management (Cash & Bank Accounts)
9. Transaction Ledger
10. Comprehensive Reporting
11. System Settings

## 🧪 Testing

The system includes:
- Unit tests for business logic
- Property-based tests for correctness properties
- Integration tests for API endpoints
- End-to-end tests for critical workflows

## 📝 License

[Add your license here]

## 👨‍💻 Development Status

Currently in specification phase. Implementation will follow the task list in `factory-erp-system/tasks.md`.

## 🤝 Contributing

[Add contribution guidelines if applicable]

## 📧 Contact

[Add contact information]
