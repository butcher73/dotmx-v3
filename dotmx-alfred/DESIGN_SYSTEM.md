# DotMX Alfred - Design System

## Modern SaaS 2026 Design

### Color Palette
- **Primary Background**: `bg-black` (#000000)
- **Card Background**: `bg-zinc-950` (#0a0a0a)
- **Border**: `border-zinc-900` (#18181b)
- **Text Primary**: `text-white` (#ffffff)
- **Text Secondary**: `text-zinc-400` (#a1a1aa)
- **Text Tertiary**: `text-zinc-500` (#71717a)
- **Accent**: `bg-white text-black` (for primary buttons)

### Typography
- **Page Title**: `text-2xl font-semibold tracking-tight text-white`
- **Page Subtitle**: `text-zinc-500 text-sm mt-1.5`
- **Section Heading**: `text-base font-semibold text-white mb-6`
- **Stat Label**: `text-xs font-medium text-zinc-500 uppercase tracking-wider`
- **Stat Value**: `text-3xl font-semibold text-white tracking-tight`
- **Table Header**: `text-xs font-semibold text-zinc-500 uppercase tracking-wider`
- **Body Text**: `text-sm text-zinc-300`

### Spacing
- **Page Padding**: `p-8`
- **Section Margin**: `mb-10`
- **Card Padding**: `p-6`
- **Element Gap**: `gap-3`
- **Subsection Margin**: `mb-6`

### Components

#### Cards
```tsx
className="bg-zinc-950 rounded-2xl border border-zinc-900 p-6"
```

#### Primary Button
```tsx
className="px-4 py-2.5 bg-white text-black rounded-xl hover:bg-zinc-100 transition-all duration-200 text-sm font-medium"
```

#### Secondary Button
```tsx
className="px-4 py-2.5 border border-zinc-900 text-zinc-400 rounded-xl hover:bg-zinc-900 transition-all duration-200 text-sm"
```

#### Input Fields
```tsx
className="px-4 py-2.5 bg-zinc-950 border border-zinc-900 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-zinc-800 focus:border-transparent"
```

#### Search Input
```tsx
className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-900 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-800 focus:border-transparent transition-all"
```

#### Stat Card
```tsx
<div className="bg-zinc-950 rounded-2xl border border-zinc-900 p-6">
  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Label</p>
  <p className="text-3xl font-semibold text-white mt-3 tracking-tight">Value</p>
  <p className="text-xs text-green-500 mt-3 font-medium">Change</p>
</div>
```

#### Table
```tsx
<div className="bg-zinc-950 rounded-2xl border border-zinc-900 overflow-hidden">
  <table className="w-full">
    <thead className="bg-black border-b border-zinc-900">
      <tr>
        <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
```

#### Alert Banner
```tsx
<div className="bg-amber-950/20 border border-amber-900/50 rounded-2xl p-4">
  <div className="flex items-start gap-3">
    <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5" />
    <div>
      <p className="text-sm font-medium text-amber-100">Title</p>
      <p className="text-xs text-amber-200/80 mt-1">Description</p>
    </div>
  </div>
</div>
```

### Layout Structure
- **Sidebar**: 64px width (w-64), fixed height
- **Main Content**: flex-1, responsive padding
- **Header**: Full width, border-bottom
- **Grid Layouts**: Responsive with gap-6 or gap-3

### Animations
- **Transitions**: `transition-all duration-200`
- **Hover States**: Subtle color shifts, no dramatic changes
- **Focus States**: `focus:ring-2 focus:ring-zinc-800`

### Design Principles
1. **Minimal**: Clean, uncluttered interfaces
2. **Consistent**: Same patterns throughout
3. **Readable**: High contrast, proper spacing
4. **Modern**: Rounded corners (xl), subtle shadows
5. **Responsive**: Mobile-first approach
6. **Accessible**: Proper focus states and labels
