# Design System Documentation

## Color System

The entire application now uses a centralized design system with semantic color tokens defined in `app/globals.css`.

### How to Use

Instead of using direct colors like `bg-zinc-950` or `text-white`, use semantic color names:

#### Background Colors
- `bg-background` - Main background (#000000)
- `bg-surface` - Card/elevated surfaces (#0a0a0a)
- `bg-surface-elevated` - Even more elevated surfaces (#18181b)

#### Text Colors
- `text-text-primary` - Primary text (#ffffff)
- `text-text-secondary` - Secondary text (#a1a1aa)
- `text-text-tertiary` - Tertiary/muted text (#71717a)
- `text-text-muted` - Most subtle text (#52525b)

#### Brand Colors
- `bg-primary` + `text-primary-foreground` - Primary buttons (white on black)
- `bg-secondary` + `text-secondary-foreground` - Secondary elements
- `bg-accent` + `text-accent-foreground` - Accent highlights

#### Borders
- `border-border` - Standard borders (#18181b)
- `border-border-subtle` - Subtle borders (#27272a)

#### State Colors
- `text-success` or `bg-success` - Success states (#22c55e)
- `text-warning` or `bg-warning` - Warning states (#f59e0b)
- `text-error` or `bg-error` - Error states (#ef4444)
- `text-info` or `bg-info` - Info states (#3b82f6)

#### Interactive States
- `hover:bg-hover` - Hover overlay
- `bg-active` - Active state
- `focus:ring-focus-ring` - Focus ring color

### Changing the Theme

To change colors site-wide, simply edit the CSS variables in `app/globals.css`:

```css
:root {
  --primary: #ffffff;  /* Change primary button color */
  --accent: #3b82f6;   /* Change accent color */
  --success: #22c55e;  /* Change success color */
  /* etc... */
}
```

### Component Examples

#### Button - Primary
```tsx
<button className="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-all">
  Primary Action
</button>
```

#### Button - Secondary
```tsx
<button className="px-4 py-2.5 border border-border text-text-secondary rounded-xl hover:bg-hover transition-all">
  Secondary Action
</button>
```

#### Card
```tsx
<div className="bg-surface rounded-2xl border border-border p-6">
  <h2 className="text-text-primary font-semibold">Title</h2>
  <p className="text-text-secondary mt-2">Description</p>
</div>
```

#### Input
```tsx
<input 
  className="px-4 py-2.5 bg-surface border border-border rounded-xl text-text-primary placeholder-text-muted focus:ring-2 focus:ring-focus-ring"
  placeholder="Enter text..."
/>
```

### Benefits

1. **Easy Maintenance**: Change colors in one place
2. **Consistency**: Same colors across all components
3. **Semantic Naming**: Colors describe purpose, not appearance
4. **Theme Support**: Easy to add light mode or other themes later
5. **Type Safety**: Tailwind auto-completion works with custom colors
