# UI Components Documentation

This directory contains reusable UI components for the dotmx website.

## Components

### Button

A versatile button component with multiple variants and sizes.

#### Props
- `children`: React.ReactNode - Button content
- `variant?: 'primary' | 'secondary' | 'outline'` - Button style variant
- `size?: 'sm' | 'md' | 'lg'` - Button size
- `className?: string` - Additional CSS classes
- `onClick?: () => void` - Click handler
- `disabled?: boolean` - Disabled state
- `type?: 'button' | 'submit' | 'reset'` - Button type

#### Usage Examples

```tsx
import { Button } from '@/components/ui';

// Primary button (default)
<Button variant="primary" size="lg">
  Trade Now
</Button>

// Outline button
<Button variant="outline" size="md">
  Connect Wallet
</Button>

// Secondary button with click handler
<Button 
  variant="secondary" 
  size="sm"
  onClick={() => console.log('clicked')}
>
  Get USD1
</Button>
```

### Card

A flexible card component for displaying content with different layouts.

#### Props
- `children?: React.ReactNode` - Card content
- `variant?: 'default' | 'highlight' | 'feature' | 'faq'` - Card style variant
- `className?: string` - Additional CSS classes
- `hover?: boolean` - Enable hover effects (default: true)
- `icon?: React.ReactNode` - Icon element
- `title?: string` - Card title
- `description?: string` - Card description

#### Usage Examples

```tsx
import { Card } from '@/components/ui';

// Highlight card with icon, title, and description
<Card 
  variant="highlight"
  icon={
    <svg className="w-10 h-10 text-black" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="..." />
    </svg>
  }
  title="CEX feel, DEX core"
  description="Non-custodial by design; you trade directly from your own wallet."
/>

// Feature card
<Card 
  variant="feature"
  title="Simple $USD1 markets"
  description="Quote everything against $USD1 for clarity and consistent pricing."
/>

// FAQ card
<Card 
  variant="faq"
  title="Is dotmx custodial?"
  description="No. You trade directly from your wallet with complete control over your funds."
/>

// Custom card with children
<Card variant="default">
  <h3>Custom Content</h3>
  <p>Any custom content can go here</p>
</Card>
```

### Badge

A badge component for displaying numbers, icons, or small content.

#### Props
- `children: React.ReactNode` - Badge content
- `variant?: 'default' | 'golden' | 'numbered'` - Badge style variant
- `size?: 'sm' | 'md' | 'lg'` - Badge size
- `className?: string` - Additional CSS classes
- `number?: number` - Number for numbered variant
- `animate?: boolean` - Enable animation effects

#### Usage Examples

```tsx
import { Badge } from '@/components/ui';

// Simple badge
<Badge variant="golden" size="md">
  $1
</Badge>

// Numbered badge with animation
<Badge 
  variant="numbered" 
  size="lg" 
  number={1}
  animate={true}
/>

// Custom badge
<Badge variant="default" size="sm">
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
    <path d="..." />
  </svg>
</Badge>
```

## Styling

All components use the dotmx design system with:
- **Primary color**: `#d4af37` (gold)
- **Hover color**: `#f4c47f` (light gold)
- **Background**: Dark gradients with gray borders
- **Typography**: Sora font family
- **Animations**: Smooth transitions and hover effects

## Design Variants

### Button Variants
- **Primary**: Gold background, black text, glow effect
- **Secondary**: Gold gradient background, black text
- **Outline**: Transparent background, gold border and text

### Card Variants
- **Default**: Basic card with dark gradient background
- **Highlight**: Centered layout with icon, title, and description
- **Feature**: Left-aligned layout with icon, title, and description
- **FAQ**: Simple layout with title and description

### Badge Variants
- **Default**: Basic golden badge
- **Golden**: Enhanced golden styling
- **Numbered**: Badge with number and animated ping effect

## Integration

Components are designed to be drop-in replacements for existing UI elements while maintaining the dotmx brand consistency. They include:

- Responsive design
- Accessibility features
- Hover and focus states
- Consistent spacing and typography
- Theme-aware colors
