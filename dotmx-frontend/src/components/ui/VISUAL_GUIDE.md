# Visual Component Guide

## Color Swatches

### Backgrounds

```
█ #000000  background (pure black)
█ #050505  background-card
█ #0a0a0a  background-elevated
█ #0f0f0f  background-hover
```

### Semantic Colors

```
🔵 #3A8DFF  accent (blue)
🟢 #00D897  positive (emerald)
🔴 #FF6B6B  negative (red)
🟡 #F59E0B  warning (amber)
🟣 #A855F7  info (purple)
```

### Text Colors

```
⚪ #ffffff  foreground (white)
⚫ #9ca3af  foreground-muted (zinc-400)
⚫ #6b7280  foreground-subtle (zinc-500)
⚫ #4b5563  foreground-disabled
```

## Component Visual Reference

### StatusBanner

```
╔════════════════════════════════════════════════════════╗
║  🛡️  Security Score  85  /100                          ║
║     ✨ Excellent! Your account is highly secure        ║
║                                                        ║
║  [2FA✓]  [Pass✓]  [List✗]  [Session✓]               ║
╚════════════════════════════════════════════════════════╝
Gradient: blue-500/10 → purple-500/10 → pink-500/10
```

### Alert

```
╔═══════════════════════════════════════════════╗
║ ✓  Success!                                   ║
║    Your password has been changed             ║
╚═══════════════════════════════════════════════╝
Variants: success (emerald), error (red), warning (amber), info (blue)
```

### GradientCard

```
╔════════════════════════════════════════════════╗
║ 🔒 Two-Factor Authentication                   ║
╠════════════════════════════════════════════════╣
║                                                ║
║  Content goes here...                          ║
║                                                ║
╠════════════════════════════════════════════════╣
║  [Cancel]  [Save Changes]                      ║
╚════════════════════════════════════════════════╝
Border: zinc-800/50 (1px)
Background: gradient from zinc-900 to zinc-900/80
```

### FeatureToggle

```
╔════════════════════════════════════════════════╗
║  📱  Two-Factor Authentication  [Active]       ║
║      Add an extra layer of security      ⚪⚫  ║
╚════════════════════════════════════════════════╝
Toggle: Off = zinc-700, On = emerald-500
```

### Input

```
Email Address
╔════════════════════════════════════════════════╗
║ 📧  your@email.com                             ║
╚════════════════════════════════════════════════╝
Helper text here
```

### Modal

```
     ╔═══════════════════════════════════════╗
     ║ Confirm Action               ✕        ║
     ╠═══════════════════════════════════════╣
     ║                                       ║
     ║  Are you sure you want to proceed?    ║
     ║                                       ║
     ╠═══════════════════════════════════════╣
     ║             [Cancel]  [Confirm]       ║
     ╚═══════════════════════════════════════╝
Backdrop: black/80 with blur
```

### List

```
╔════════════════════════════════════════════════╗
║ 🖥️  Chrome on macOS              [Current]  🗑 ║
║     Last active: 2 minutes ago                ║
╠════════════════════════════════════════════════╣
║ 🖥️  Firefox on Windows                      🗑 ║
║     Last active: 1 hour ago                   ║
╚════════════════════════════════════════════════╝
Divider: zinc-800/50
```

### ProgressBar

```
Upload Progress                           75/100
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░
Variants: default (blue), success (emerald), warning (amber), danger (red)
```

### CircularProgress

```
     ⚪⚪⚪⚪⚪
    ⚪       ⚪
   ⚪    85   ⚪
    ⚪       ⚪
     ⚪⚪⚪⚪⚪
   Score
Background: zinc-900 (dark)
Progress: Color based on variant
```

### InfoBox

```
╔════════════════════════════════════════════════╗
║ ℹ️  Important                                  ║
║    Please save your API key securely          ║
╚════════════════════════════════════════════════╝
Variants: default, success, warning, danger, info
```

### CodeBox

```
API Key
╔════════════════════════════════════════════════╗
║ sk_live_1234567890abcdef          [Copy]     ║
╚════════════════════════════════════════════════╝
Background: zinc-900
Border: zinc-700/50
```

### StatsBox

```
╔══════════════════════════════╗
║ Total Volume                  ║
║ $1.2M              📈        ║
║ ↑ 12.5%                      ║
╚══════════════════════════════╝
Icon background: zinc-800/50
Value color: Based on variant
```

## Icon Sizes Reference

```
h-4 w-4   ⬜  16px (small)
h-5 w-5   ⬜  20px (medium - default)
h-6 w-6   ⬜  24px (large)
h-8 w-8   ⬜  32px (xlarge)
```

## Spacing Reference

```
gap-2   ⬜⬜  8px
gap-3   ⬜⬜⬜  12px
gap-4   ⬜⬜⬜⬜  16px (standard)
gap-6   ⬜⬜⬜⬜⬜⬜  24px (large)

p-4     📦  16px padding
p-6     📦  24px padding (standard card)
```

## Border Radius

```
rounded-lg    ⬜  8px
rounded-xl    ⬜  12px (standard)
rounded-2xl   ⬜  16px (large cards)
rounded-full  ⭕  999px (circles, badges)
```

## Hover States

```
Normal:  border-zinc-800/50
Hover:   border-zinc-700/50

Normal:  bg-transparent
Hover:   bg-zinc-800/30
```

## Component Combinations

### Security Feature (Common Pattern)

```
GradientCard
├── GradientCardHeader
│   └── GradientCardTitle (with icon)
├── GradientCardContent
│   ├── Alert (optional)
│   └── FeatureToggle
└── GradientCardFooter (optional)
    └── Button
```

### Form Section

```
GradientCard
├── GradientCardHeader
│   └── GradientCardTitle
└── GradientCardContent
    ├── Input (label + field + helper)
    ├── Select
    ├── Textarea
    └── Button
```

### List View

```
GradientCard
├── GradientCardHeader
│   └── GradientCardTitle
└── GradientCardContent (no padding)
    └── List
        ├── ListItem
        ├── ListItem
        └── ListItem
```

## Responsive Breakpoints

```
Mobile    ≤ 1023px    Stack vertically, full width
Desktop   ≥ 1024px    Side-by-side, grid layouts

Use: grid-cols-1 lg:grid-cols-2
     flex-col lg:flex-row
```
