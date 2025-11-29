# TMS Pro - Multi-Tenant Transportation Management System

A comprehensive, modern Transportation Management System built with React, TypeScript, and Tailwind CSS. Designed for multi-company deployment with subdomain-based tenant isolation.

## 🚀 Project Overview

TMS Pro is a scalable, multi-tenant TMS that can serve multiple companies independently. Each company accesses via their subdomain (e.g., `company1.mydomain.com`) with complete data isolation.

**Key Capabilities:**
- **Load Management** - Track loads from dispatch to delivery
- **Driver Management** - Comprehensive driver profiles and payment configurations
- **Fleet Management** - Truck inventory, maintenance, and profitability tracking
- **Expense Tracking** - Detailed expense management with categorization
- **Invoice Management** - Automated invoice generation and tracking
- **Driver Settlements** - Weekly settlement calculations and payments
- **Reports & Analytics** - Comprehensive business intelligence and reporting

## ✨ Key Features

### ✅ Recently Implemented

- **Auto-Save Functionality** - All changes are automatically saved to localStorage
- **Settlement System** - Complete driver settlement generation with load filtering
- **Invoice Automation** - Auto-generates invoices for delivered loads
- **Fleet Management** - Truck profitability analysis and maintenance tracking
- **Driver Profiles** - Comprehensive driver management with payment configurations
- **Responsive Design** - Mobile-friendly interface with modern UI/UX

### Core Features

1. **Load Management**
   - Create, edit, and track loads
   - Automatic mileage calculation
   - Status tracking (Dispatched, In Transit, Delivered, etc.)
   - Customer and driver assignment
   - Rate confirmation upload (simulated OCR)

2. **Driver Settlements**
   - Weekly settlement generation
   - Automatic load filtering (only unsettled loads)
   - Driver pay calculation (Owner Operator vs Company Driver)
   - Deduction management (fuel, other expenses)
   - Settlement PDF generation

3. **Expense Management**
   - Categorized expenses (Fuel, Maintenance, Insurance, etc.)
   - Receipt upload support
   - Driver and truck assignment
   - Expense status tracking

4. **Invoice Management**
   - Automatic invoice creation for delivered loads
   - Invoice status tracking (Pending, Paid, Overdue)
   - PDF generation and printing
   - Payment date tracking

5. **Fleet Management**
   - Truck inventory management
   - Ownership tracking (Owned, Leased, Financed, Owner Operator)
   - Maintenance scheduling
   - Profitability analysis
   - Insurance and compliance tracking

6. **Driver Management**
   - Comprehensive driver profiles
   - License and medical card tracking
   - Payment configuration (Per Mile, Percentage, Flat Rate)
   - Owner Operator deduction preferences
   - Employment information

7. **Reports & Analytics**
   - Revenue and expense reports
   - Driver performance metrics
   - Customer analysis
   - Profit/loss statements
   - Custom date range filtering

## 🛠️ Technology Stack

- **Frontend Framework**: React 18.2 with TypeScript
- **Build Tool**: Vite 5.0
- **Styling**: Tailwind CSS 3.4
- **Icons**: Lucide React
- **Charts**: Recharts
- **State Management**: React Context API
- **Data Persistence**: localStorage (auto-save)

## 📦 Installation

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/ats-freight-tms.git
   cd ats-freight-tms
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Build for production**
   ```bash
   npm run build
   ```

5. **Preview production build**
   ```bash
   npm run preview
   ```

## 📁 Project Structure

```
TMS-PRO-GOOGLE-/
├── src/
│   ├── components/          # Reusable React components
│   │   ├── Layout.tsx       # Main layout wrapper
│   │   ├── Sidebar.tsx      # Navigation sidebar
│   │   ├── Header.tsx       # Top header bar
│   │   └── AddLoadModal.tsx # Load creation modal
│   ├── pages/               # Page components
│   │   ├── Dashboard.tsx   # Main dashboard
│   │   ├── Loads.tsx       # Load management
│   │   ├── Drivers.tsx     # Driver management
│   │   ├── Fleet.tsx       # Fleet management
│   │   ├── Expenses.tsx    # Expense tracking
│   │   ├── Invoices.tsx   # Invoice management
│   │   ├── Settlements.tsx # Driver settlements
│   │   └── Reports.tsx     # Reports & analytics
│   ├── context/            # React Context providers
│   │   └── TMSContext.tsx  # Global state management
│   ├── services/           # Utility services
│   │   ├── mockData.ts    # Mock data for development
│   │   └── utils.ts       # Helper functions
│   ├── types.ts            # TypeScript type definitions
│   ├── App.tsx            # Main app component
│   └── main.tsx           # Entry point
├── public/                 # Static assets
├── docs/                   # Documentation
├── legacy/                 # Legacy HTML files (reference)
└── package.json           # Dependencies and scripts
```

## 🔧 Key Features Implementation

### Auto-Save System

All data is automatically saved to localStorage whenever changes are made:
- **Loads**: Saved to `tms_loads`
- **Drivers**: Saved to `tms_drivers`
- **Invoices**: Saved to `tms_invoices`
- **Settlements**: Saved to `tms_settlements`
- **Trucks**: Saved to `tms_trucks`

No manual save required - all changes persist automatically!

### Settlement Logic

The settlement system follows this logic:
1. **Load Filtering**: Only shows delivered loads that haven't been settled
2. **Driver Pay Calculation**: 
   - Owner Operators: Uses percentage (e.g., 88%)
   - Company Drivers: Full rate (paid separately)
3. **Deductions**: Fuel and other expenses
4. **Auto-Marking**: Loads are marked with `settlementId` after settlement creation

### Invoice Automation

- Automatically creates invoices when loads are marked as "Delivered"
- Tracks invoice status (Pending, Paid, Overdue)
- Auto-detects overdue invoices based on due date
- Supports multiple loads per invoice

## 🎯 Development Roadmap

### Completed ✅
- [x] React/TypeScript migration
- [x] Auto-save functionality
- [x] Settlement system implementation
- [x] Invoice automation
- [x] Fleet management
- [x] Driver management
- [x] Expense tracking
- [x] Reports and analytics

### In Progress 🚧
- [ ] Backend API integration
- [ ] User authentication
- [ ] Multi-user support
- [ ] Real-time updates

### Planned 📋
- [ ] Mobile app
- [ ] Advanced reporting
- [ ] Integration with accounting systems
- [ ] GPS tracking integration
- [ ] Document management system
- [ ] Email notifications

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👥 Authors

- **ATS FREIGHT LLC** - Initial work

## 🙏 Acknowledgments

- Built with modern React and TypeScript best practices
- UI components styled with Tailwind CSS
- Charts powered by Recharts

## 📞 Support

For support, email support@atsfreight.com or open an issue in the GitHub repository.

---

**Version**: 2.0.0  
**Last Updated**: 2025-01-27  
**Status**: Active Development
