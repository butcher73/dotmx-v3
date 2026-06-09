# Quick Reference - DotMX UI Components

## Import Statement

```tsx
import {
  // Banners & Alerts
  StatusBanner,
  StatusIndicator,
  Alert,

  // Cards
  GradientCard,
  GradientCardHeader,
  GradientCardTitle,
  GradientCardContent,
  GradientCardFooter,

  // Feature Controls
  FeatureToggle,
  FeatureStatusCard,

  // Forms
  Input,
  Select,
  Textarea,

  // Modals
  Modal,
  ModalBody,
  ModalFooter,

  // Lists
  List,
  ListItem,
  ListItemBadge,
  ListEmptyState,

  // Progress
  ProgressBar,
  CircularProgress,
  Loader,

  // Info
  InfoBox,
  CodeBox,
  StatsBox,
} from "@/components/ui";
```

## Common Patterns

### Security Feature Card

```tsx
<GradientCard variant="default" hover>
  <GradientCardHeader>
    <GradientCardTitle className="flex items-center gap-2">
      <Icon className="h-5 w-5 text-blue-400" />
      Feature Name
    </GradientCardTitle>
  </GradientCardHeader>
  <GradientCardContent>
    {message && <Alert variant="success" message={message} />}
    <FeatureToggle
      title="Enable Feature"
      enabled={enabled}
      onToggle={handleToggle}
    />
  </GradientCardContent>
</GradientCard>
```

### Form with Validation

```tsx
<Input
  label="Email"
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  error={errors.email}
  icon={Mail}
  iconPosition="left"
/>
```

### Modal Confirmation

```tsx
<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Confirm"
  size="md"
>
  <ModalBody>
    <Alert variant="warning" message="This cannot be undone" />
  </ModalBody>
  <ModalFooter>
    <Button variant="ghost" onClick={() => setIsOpen(false)}>
      Cancel
    </Button>
    <Button variant="primary" onClick={handleConfirm}>
      Confirm
    </Button>
  </ModalFooter>
</Modal>
```

### Session List

```tsx
<List>
  {sessions.map((session) => (
    <ListItem
      key={session.id}
      icon={Monitor}
      title={session.device}
      description={session.lastActive}
      metadata={<ListItemBadge label="Active" variant="success" />}
      actions={
        <button onClick={() => revoke(session.id)}>
          <Trash2 className="h-4 w-4" />
        </button>
      }
    />
  ))}
</List>
```

## Color Classes

### Background

- `bg-zinc-900` - Card background
- `bg-zinc-800` - Elevated elements
- `bg-zinc-800/50` - Semi-transparent

### Borders

- `border-zinc-800/50` - Standard border
- `border-zinc-700/50` - Stronger border

### Text

- `text-white` - Primary text
- `text-zinc-400` - Secondary text
- `text-zinc-500` - Tertiary text

### Status Colors

- `text-emerald-400` - Success
- `text-red-400` - Error
- `text-amber-400` - Warning
- `text-blue-400` - Info

## Icon Sizes

- `h-4 w-4` - Small (16px)
- `h-5 w-5` - Medium (20px)
- `h-6 w-6` - Large (24px)
- `h-8 w-8` - XLarge (32px)

## Spacing

- `gap-2` - 0.5rem (8px)
- `gap-3` - 0.75rem (12px)
- `gap-4` - 1rem (16px)
- `gap-6` - 1.5rem (24px)
- `p-4` - 1rem padding
- `p-6` - 1.5rem padding

## Responsive Breakpoints

- Mobile first: Default styling
- `lg:` - 1024px and up (desktop)
- Example: `grid-cols-2 lg:grid-cols-4`

## Component Showcase

View all components: `/portal/components-showcase`
