# GCP Compute Engine Pricing Calculator

A modern, Excel-like web application for calculating and comparing Google Cloud Platform (GCP) Compute Engine costs. Built with Next.js 15, TypeScript, and shadcn/ui.

## 🚀 Features

### Excel-like Interface

- **Spreadsheet-style table** with inline editing
- **Real-time cost calculations** as you modify parameters
- **Bulk selection and operations** for multiple configurations
- **Hover actions** for quick duplicate and delete operations

### Quick Configuration

- **One-click presets** for common use cases (Web Server, Database, Compute Intensive)
- **Smart auto-updates** when changing machine series or types
- **Validation** for vCPUs (1-96), memory (1-384 GB), and disk size (10-65536 GB)

### Powerful Management

- **Bulk operations**: duplicate or delete multiple configurations
- **Real-time statistics**: total configs, average cost, total savings
- **Selection management** with master checkbox and individual selection

### Modern UI/UX

- **Smooth animations** with Framer Motion
- **Responsive design** with horizontal scroll on smaller screens
- **Accessible** with proper keyboard navigation and ARIA labels
- **Clean design** using shadcn/ui components

## 🛠 Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **UI Components**: shadcn/ui (Radix UI + Tailwind CSS)
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Icons**: Lucide React

## 📦 Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd gcp-pricing-calculator
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Run the development server**

   ```bash
   npm run dev
   ```

4. **Open in browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🎯 Usage

### Adding Configurations

- **Quick Presets**: Use sidebar presets for common configurations
- **Manual Addition**: Click "Add Configuration" button
- **Inline Editing**: Click any editable cell to modify values

### Managing Configurations

- **Selection**: Use checkboxes to select multiple configurations
- **Bulk Operations**: Duplicate or delete selected configurations
- **Individual Actions**: Hover over rows to see duplicate/delete buttons

### Cost Analysis

- **Real-time Updates**: Costs recalculate automatically
- **Discount Models**: Choose from On-Demand, Spot VM, 1-Year CUD, 3-Year CUD
- **Savings Display**: See discount savings with badges
- **Statistics Panel**: View total costs, average costs, and savings

## 🏗 Architecture

### Component Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout with metadata
│   ├── page.tsx           # Main page combining components
│   └── globals.css        # Global styles and CSS variables
├── components/
│   ├── SpreadsheetCalculator.tsx  # Main table component
│   ├── QuickActions.tsx          # Sidebar with presets & actions
│   └── ui/                       # shadcn/ui components
├── store/
│   └── vmStore.ts               # Zustand state management
└── lib/
    ├── calculator.ts            # Cost calculation logic
    └── utils.ts                # Utility functions
```

### State Management

The application uses Zustand for state management with the following key features:

- **Configuration CRUD**: Add, update, delete VM configurations
- **Selection Management**: Handle multiple selections and bulk operations
- **Preset Integration**: Quick addition of predefined configurations
- **Cost Calculations**: Real-time cost updates using mock pricing

### Cost Calculation

Mock pricing algorithm includes:

- **Regional multipliers**: Different costs per region
- **Series multipliers**: E2 (0.8x), N2 (1.0x), C3 (1.3x), M3 (1.5x)
- **Base compute cost**: vCPUs × $24 + Memory × $3.2
- **Storage cost**: Disk size × disk type multiplier
- **Discount application**: Spot (80% off), CUD (30-60% off)

## 🎨 Design Principles

### User Experience

- **Minimize clicks**: Excel-like inline editing reduces form interactions
- **Visual feedback**: Hover states, animations, and real-time updates
- **Bulk efficiency**: Select and operate on multiple configurations
- **Familiar interface**: Spreadsheet-like table for easy adoption

### Performance

- **Real-time calculations**: Sub-100ms cost updates
- **Smooth animations**: 60fps transitions with Framer Motion
- **Efficient rendering**: Optimized React components
- **Memory management**: Proper cleanup and subscriptions

## 🔧 Configuration

### Machine Types by Series

- **E2**: General-purpose, cost-optimized (e2-micro to e2-standard-32)
- **N2**: Balanced performance (n2-standard-2 to n2-standard-80)
- **N2D**: AMD-based balanced performance
- **C3**: Compute-optimized for intensive workloads
- **M3**: Memory-optimized for large datasets

### Pricing Regions

- **US**: us-central1, us-east1, us-west1
- **Europe**: europe-west1, europe-west4
- **Asia**: asia-southeast1, asia-east1

### Discount Models

- **On-Demand**: Pay-as-you-go pricing
- **Spot VM**: 80% discount with preemption risk
- **1-Year CUD**: 35% discount with 1-year commitment
- **3-Year CUD**: 55% discount with 3-year commitment

## 🚀 Future Enhancements

- [ ] **CSV Import/Export**: Bulk data management
- [ ] **Cost Visualization**: Charts and graphs for analysis
- [ ] **Configuration Templates**: Save and reuse custom templates
- [ ] **Usage Patterns**: Factor in actual usage (24/7, business hours)
- [ ] **Multi-cloud Comparison**: AWS and Azure pricing integration
- [ ] **Cost Optimization**: AI-powered recommendations

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

For support, please open an issue on the GitHub repository or contact the development team.

---
