# DotMX Shared UI Components

## 🎨 New Component Library

A comprehensive collection of reusable UI components based on the **Security Page** design system has been added to complement the existing UI components.

### 📦 New Components Available

All new components are exported from `@/components/ui`:

#### Layout & Display

- **StatusBanner** - Prominent banners with scores and indicators
- **GradientCard** - Beautiful gradient cards with multiple variants
- **List**, **ListItem**, **ListEmptyState** - Versatile list components

#### Feedback & Notifications

- **Alert** - Inline alerts (success, error, warning, info)
- **Loader**, **FullPageLoader**, **InlineLoader** - Loading states
- **ProgressBar**, **CircularProgress** - Progress indicators

#### Information Display

- **InfoBox** - Styled information boxes
- **CodeBox** - Code snippets with copy functionality
- **StatsBox** - Metric/statistics display

#### Form Controls

- **Input** - Enhanced text inputs with icons and validation
- **Select** - Styled select dropdowns
- **Textarea** - Multi-line text inputs
- **FeatureToggle** - Toggle switches with labels
- **FeatureStatusCard** - Feature status cards with actions

#### Overlays

- **Modal**, **ModalBody**, **ModalFooter** - Dialog modals

## 🎯 Quick Access

- **Full Documentation**: [SHARED_COMPONENTS.md](./SHARED_COMPONENTS.md)
- **Quick Reference**: [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
- **Live Showcase**: Visit `/portal/components-showcase` in your browser

## 🚀 Usage Example

```tsx
import {
  GradientCard,
  GradientCardHeader,
  GradientCardTitle,
  GradientCardContent,
  Alert,
  FeatureToggle,
} from "@/components/ui";

function SecurityFeature() {
  const [enabled, setEnabled] = useState(false);

  return (
    <GradientCard variant="default" hover>
      <GradientCardHeader>
        <GradientCardTitle>Two-Factor Auth</GradientCardTitle>
      </GradientCardHeader>
      <GradientCardContent>
        <Alert variant="success" message="Ready to enable!" />
        <FeatureToggle
          title="Enable 2FA"
          enabled={enabled}
          onToggle={() => setEnabled(!enabled)}
        />
      </GradientCardContent>
    </GradientCard>
  );
}
```

## 🎨 Design System

All new components follow these principles:

- **Dark theme**: Black (#000) with zinc grays
- **Subtle borders**: 1px with zinc-800/50
- **High contrast text**: White with zinc variations
- **Semantic colors**: Blue (accent), Emerald (success), Red (error), Amber (warning)
- **Smooth animations**: 200ms transitions
- **Responsive**: Mobile-first with lg: breakpoints

## 📋 Existing Components

The following components remain available:

- **Button** - Multiple variants and sizes
- **Card** - Basic card layouts
- **Badge** - Status badges
- **PortalCard** - Portal-specific cards
- **PortalPageLayout** - Page layouts
- **ChainIcon** - Blockchain icons

---

**Note**: All components are fully typed with TypeScript and follow accessibility best practices.
