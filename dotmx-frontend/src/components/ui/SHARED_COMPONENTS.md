# DotMX Shared UI Components

A comprehensive collection of reusable UI components based on the Security Page design system. All components follow the DotMX dark theme with zinc color palette and accent colors.

## Design System Colors

### Background Colors

- `background` - #000000 (Main background)
- `background-card` - #050505 (Card background)
- `background-elevated` - #0a0a0a (Elevated elements)
- `background-hover` - #0f0f0f (Hover states)

### Border Colors (Very dark, 1px thin)

- `border` - #0a0a0a
- `border-muted` - #080808
- `border-accent` - #0d0d0d
- `border-hover` - #111111

### Text Colors (High contrast)

- `foreground` - #ffffff (Primary text)
- `foreground-muted` - #9ca3af (Secondary text)
- `foreground-subtle` - #6b7280 (Tertiary text)
- `foreground-disabled` - #4b5563 (Disabled text)

### Accent Colors

- `accent` - #3A8DFF (Primary blue)
- `positive` - #00D897 (Success/Green)
- `negative` - #FF6B6B (Error/Red)
- `warning` - #F59E0B (Warning/Amber)
- `info` - #A855F7 (Info/Purple)

## Components

### 1. StatusBanner

A prominent banner component for displaying status information with scores and indicators.

```tsx
import { StatusBanner, StatusIndicator } from "@/components/ui";
import { Shield, Lock, Key, Smartphone } from "lucide-react";

<StatusBanner
  variant="info" // 'success' | 'info' | 'warning' | 'danger'
  icon={Shield}
  title="Security Score"
  score={85}
  maxScore={100}
  description={
    <>
      <Sparkles className="h-4 w-4 text-emerald-400" />
      <span>Excellent! Your account is highly secure</span>
    </>
  }
>
  <div className="grid grid-cols-4 gap-3">
    <StatusIndicator label="2FA" enabled={true} icon={Smartphone} />
    <StatusIndicator label="Password" enabled={true} icon={Lock} />
    <StatusIndicator label="Whitelist" enabled={false} icon={Key} />
  </div>
</StatusBanner>;
```

### 2. Alert

Inline alert messages for success, error, warning, or info notifications.

```tsx
import { Alert } from "@/components/ui";
import { CheckCircle, AlertTriangle } from "lucide-react";

// Success Alert
<Alert
  variant="success"
  icon={CheckCircle}
  title="Success!"
  message="Your password has been changed successfully."
/>

// Error Alert
<Alert
  variant="error"
  icon={AlertTriangle}
  title="Error"
  message="Failed to update settings. Please try again."
/>

// With children
<Alert variant="warning" icon={AlertTriangle}>
  <div className="text-sm font-semibold text-amber-300">Warning</div>
  <div className="mt-1 text-sm text-amber-200/80">
    This action cannot be undone.
  </div>
</Alert>
```

### 3. GradientCard

Beautiful gradient cards with support for different variants and hover effects.

```tsx
import {
  GradientCard,
  GradientCardHeader,
  GradientCardTitle,
  GradientCardContent,
  GradientCardFooter,
} from "@/components/ui";

<GradientCard variant="default" hover={true}>
  <GradientCardHeader>
    <GradientCardTitle className="flex items-center gap-2">
      <Icon className="h-5 w-5" />
      Card Title
    </GradientCardTitle>
  </GradientCardHeader>
  <GradientCardContent>Your content here</GradientCardContent>
  <GradientCardFooter>Footer actions</GradientCardFooter>
</GradientCard>;

// Variants: 'default' | 'success' | 'warning' | 'danger' | 'info'
```

### 4. FeatureToggle & FeatureStatusCard

Interactive toggle switches and status cards for enabling/disabling features.

```tsx
import { FeatureToggle, FeatureStatusCard } from "@/components/ui";
import { Smartphone } from "lucide-react";

// Toggle Switch
<FeatureToggle
  icon={Smartphone}
  iconColor="text-emerald-400"
  title="Two-Factor Authentication"
  description="Add an extra layer of security"
  enabled={is2FAEnabled}
  loading={isLoading}
  onToggle={() => handle2FAToggle()}
/>

// Status Card with Action Button
<FeatureStatusCard
  icon={Smartphone}
  iconColor="text-emerald-400"
  title="Two-Factor Authentication"
  description="Protect your account with 2FA"
  enabled={is2FAEnabled}
  actionLabel={is2FAEnabled ? "Disable 2FA" : "Enable 2FA"}
  onAction={() => handle2FAToggle()}
/>
```

### 5. Input, Select, Textarea

Styled form inputs with labels, errors, and helper text.

```tsx
import { Input, Select, Textarea } from "@/components/ui";
import { Eye, EyeOff, Mail } from "lucide-react";

// Input with icon
<Input
  label="Email Address"
  type="email"
  placeholder="your@email.com"
  icon={Mail}
  iconPosition="left"
  helperText="We'll never share your email"
/>

// Input with password toggle
<Input
  label="Password"
  type={showPassword ? "text" : "password"}
  icon={showPassword ? Eye : EyeOff}
  iconPosition="right"
  iconAction={() => setShowPassword(!showPassword)}
  error={error}
/>

// Select
<Select
  label="Chain"
  options={[
    { value: "ETH", label: "Ethereum" },
    { value: "BSC", label: "Binance Smart Chain" },
  ]}
  variant="filled"
/>

// Textarea
<Textarea
  label="Description"
  rows={4}
  placeholder="Enter description..."
  helperText="Max 500 characters"
/>
```

### 6. Modal

Full-featured modal dialogs with backdrop and customizable sizes.

```tsx
import { Modal, ModalBody, ModalFooter } from "@/components/ui";
import { Button } from "@/components/ui";

<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Confirm Action"
  description="This action cannot be undone"
  size="md" // 'sm' | 'md' | 'lg' | 'xl'
>
  <ModalBody>
    <p className="text-zinc-400">Are you sure you want to proceed?</p>
  </ModalBody>
  <ModalFooter>
    <Button variant="ghost" onClick={() => setIsOpen(false)}>
      Cancel
    </Button>
    <Button variant="primary" onClick={handleConfirm}>
      Confirm
    </Button>
  </ModalFooter>
</Modal>;
```

### 7. List Components

Versatile list components for displaying items with icons, metadata, and actions.

```tsx
import {
  List,
  ListItem,
  ListItemBadge,
  ListEmptyState,
} from "@/components/ui";
import { Monitor, Trash2 } from "lucide-react";

<List>
  <ListItem
    icon={Monitor}
    iconColor="text-blue-400"
    title="Chrome on macOS"
    description="Last active: 2 minutes ago"
    metadata={
      <div className="text-right">
        <div className="text-xs text-zinc-500">San Francisco, US</div>
        <ListItemBadge label="Current" variant="success" />
      </div>
    }
    actions={
      <button className="text-red-400 hover:text-red-300">
        <Trash2 className="h-4 w-4" />
      </button>
    }
  />
</List>

// Empty State
<ListEmptyState
  icon={Monitor}
  title="No active sessions"
  description="You don't have any active sessions"
  action={<Button>Learn More</Button>}
/>
```

### 8. Loader

Loading spinners for various use cases.

```tsx
import { Loader, FullPageLoader, InlineLoader } from "@/components/ui";

// Standard loader
<Loader size="md" text="Loading..." />

// Full page loader
<FullPageLoader text="Loading your data..." />

// Inline loader for buttons
<Button disabled>
  <InlineLoader className="mr-2" />
  Processing...
</Button>
```

### 9. ProgressBar & CircularProgress

Progress indicators for tasks and scores.

```tsx
import { ProgressBar, CircularProgress } from "@/components/ui";

// Linear progress bar
<ProgressBar
  value={75}
  max={100}
  variant="success" // 'default' | 'success' | 'warning' | 'danger'
  label="Upload Progress"
  showValue={true}
  size="md" // 'sm' | 'md' | 'lg'
/>

// Circular progress
<CircularProgress
  value={85}
  max={100}
  size={120}
  strokeWidth={8}
  variant="success"
  showValue={true}
  label="Score"
/>
```

### 10. InfoBox, CodeBox, StatsBox

Information display components for various content types.

```tsx
import { InfoBox, CodeBox, StatsBox } from "@/components/ui";
import { Info, Key, TrendingUp } from "lucide-react";

// Info Box
<InfoBox
  variant="info" // 'default' | 'success' | 'warning' | 'danger' | 'info'
  icon={Info}
  title="Important"
>
  Please save your API key securely. You won't be able to see it again.
</InfoBox>

// Code Box
<CodeBox
  label="API Key"
  code="sk_live_1234567890abcdef"
  onCopy={() => handleCopy()}
  copied={isCopied}
/>

// Stats Box
<StatsBox
  label="Total Volume"
  value="$1.2M"
  icon={TrendingUp}
  variant="success"
  trend={{ value: 12.5, direction: "up" }}
/>
```

## Usage Examples

### Complete Security Feature Card

```tsx
import {
  GradientCard,
  GradientCardHeader,
  GradientCardTitle,
  GradientCardContent,
  FeatureToggle,
  Alert,
  Modal,
  ModalBody,
  ModalFooter,
  Button,
} from "@/components/ui";
import { Smartphone, CheckCircle } from "lucide-react";

function TwoFactorAuthCard() {
  const [enabled, setEnabled] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState(null);

  return (
    <>
      <GradientCard variant="default" hover>
        <GradientCardHeader>
          <GradientCardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-emerald-400" />
            Two-Factor Authentication
          </GradientCardTitle>
        </GradientCardHeader>
        <GradientCardContent>
          {message && (
            <Alert
              variant={message.type}
              icon={CheckCircle}
              message={message.text}
              className="mb-4"
            />
          )}
          <FeatureToggle
            title="Enable 2FA"
            description="Protect your account with an authenticator app"
            enabled={enabled}
            onToggle={() => setShowModal(true)}
          />
        </GradientCardContent>
      </GradientCard>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Enable Two-Factor Authentication"
        size="md"
      >
        <ModalBody>
          <p className="text-zinc-400">
            Scan the QR code with your authenticator app...
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleEnable}>
            Enable 2FA
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
```

## Component Guidelines

### Best Practices

1. **Consistent Spacing**: Use Tailwind spacing utilities (gap-3, gap-4, gap-6, p-4, p-6)
2. **Color Usage**: Stick to zinc palette for neutrals, use semantic colors for states
3. **Icons**: Use lucide-react icons at h-4/w-4 (small), h-5/w-5 (medium), h-6/w-6 (large)
4. **Borders**: Use border-zinc-800/50 for subtle borders, darker for emphasis
5. **Hover States**: Add hover:bg-zinc-800/30 for interactive elements
6. **Loading States**: Always provide loading indicators for async operations
7. **Accessibility**: Include proper ARIA labels and keyboard navigation

### Color Variants

All components with variants support these options:

- `default` - Blue/neutral theme
- `success` - Emerald/green for positive actions
- `warning` - Amber/yellow for cautions
- `danger` - Red for destructive actions
- `info` - Blue/purple for informational content

### Responsive Design

All components are mobile-first and responsive:

- Use `lg:flex-row` for desktop layouts
- Grid layouts use `grid-cols-2 lg:grid-cols-4` patterns
- Cards stack vertically on mobile, side-by-side on desktop

## Theme Integration

These components automatically integrate with your existing DotMX theme defined in:

- `tailwind.config.ts` - Color definitions
- `globals.css` - CSS variables and animations

No additional configuration needed!
