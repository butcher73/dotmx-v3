# DotMX Alfred - Exchange Management Dashboard

An internal admin dashboard for managing the DotMX crypto exchange. Built with Next.js 16, TypeScript, and Tailwind CSS.

## 🚀 Features

### Core Management Pages
- **Dashboard** - Overview with key metrics, trading volume charts, and recent transactions
- **User Management** - Monitor and manage platform users, KYC status, and account balances
- **Transactions** - Real-time transaction monitoring with filtering and export capabilities
- **Trading Pairs** - Manage available trading pairs, view 24h performance and volumes
- **Deposits & Withdrawals** - Monitor all deposits and withdrawals with approval workflows
- **Analytics** - Comprehensive analytics with charts, revenue breakdown, and system health
- **KYC Management** - Review and process user verification applications
- **Audit Logs** - Complete audit trail of all administrative actions
- **Settings** - Configure trading fees, security, withdrawals, and notifications

### UI Components
- **Sidebar Navigation** - Easy navigation between all management sections
- **Header** - Global search, notifications, and admin profile
- **StatCard** - Reusable metric cards with trend indicators
- **DataTable** - Flexible table component with sorting and actions
- **Charts** - Line charts, bar charts, and pie charts for data visualization

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Icons**: Lucide React
- **Charts**: Recharts
- **Fonts**: Geist Sans & Geist Mono

## 📦 Installation

```bash
npm install
```

## 🏃 Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## 📁 Project Structure

```
dotmx-alfred/
├── app/
│   ├── page.tsx                    # Dashboard overview
│   ├── users/page.tsx              # User management
│   ├── transactions/page.tsx       # Transaction monitoring
│   ├── trading-pairs/page.tsx      # Trading pair management
│   ├── deposits-withdrawals/page.tsx # Deposit/withdrawal management
│   ├── analytics/page.tsx          # Analytics & reporting
│   ├── kyc/page.tsx                # KYC verification
│   ├── audit-logs/page.tsx         # Audit trail
│   ├── settings/page.tsx           # System settings
│   ├── layout.tsx                  # Root layout
│   └── globals.css                 # Global styles
├── components/
│   ├── Sidebar.tsx                 # Navigation sidebar
│   ├── Header.tsx                  # Top header bar
│   ├── StatCard.tsx                # Metric display card
│   └── DataTable.tsx               # Data table component
└── public/                         # Static assets
```

## 🔒 Security Features

- Two-factor authentication support
- IP whitelist configuration
- Session timeout management
- Manual approval for large withdrawals
- Comprehensive audit logging

## 📊 Key Metrics Tracked

- Total users and growth
- 24h trading volume
- Total platform balance
- Active trades
- Transaction success rates
- KYC application status
- System health indicators

## 🎨 Design

- Dark sidebar with cyan accent colors
- Clean, professional interface
- Responsive design
- Consistent component styling
- Real-time data updates

## 🚀 Production Build

```bash
npm run build
npm start
```

## 📝 License

Internal use only - DotMX crypto exchange

---

**Note**: This is an internal tool for authorized operators only. All actions are logged and audited.

