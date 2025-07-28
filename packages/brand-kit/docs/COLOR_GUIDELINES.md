# Promptliano Brand Color Guidelines

## Overview

The Promptliano color system is designed to create a modern, accessible, and cohesive visual experience across all touchpoints. Our palette balances vibrant brand colors with functional semantic colors and a comprehensive neutral scale.

## Core Brand Colors

### Primary - Promptliano Purple (#9333ea)

- **Usage**: Primary CTAs, key navigation elements, brand emphasis
- **Context**: Use for the most important actions and brand moments
- **Don't**: Overuse - reserve for high-priority elements only

### Secondary - Promptliano Blue (#3b82f6)

- **Usage**: Secondary actions, links, supporting UI elements
- **Context**: Complementary to primary, creates visual hierarchy
- **Don't**: Use as primary action color when purple is present

### Accent - Promptliano Teal (#14b8a6)

- **Usage**: Success states, highlights, special features
- **Context**: Draws attention without competing with primary colors
- **Don't**: Use for error or warning states

## Semantic Colors

### Success - Green (#22c55e)

- **Usage**: Positive feedback, completed actions, online status
- **Examples**: Checkmarks, success messages, completion badges

### Warning - Amber (#f59e0b)

- **Usage**: Caution states, beta features, pending actions
- **Examples**: Warning alerts, in-progress indicators

### Error - Red (#ef4444)

- **Usage**: Error messages, destructive actions, validation failures
- **Examples**: Form errors, deletion confirmations

### Info - Blue (#0ea5e9)

- **Usage**: Informational content, tips, neutral notifications
- **Examples**: Help text, tooltips, info cards

## Extended Palette Usage

### Feature-Specific Colors

- **Green-500**: Live/online indicators, success badges
- **Yellow-500**: Beta badges, development status
- **Orange-500**: Data visualizations, summaries
- **Pink-500**: Git-related features, version control
- **Purple-500**: AI/prompt-related features
- **Indigo-400**: Community features, Discord integration

## Color Combinations

### Recommended Pairings

1. **Primary + Secondary**: Hero sections, main CTAs
2. **Primary + Accent**: Feature highlights, special sections
3. **Neutral + Semantic**: Functional UI, forms, alerts

### Gradient Usage

- **Primary to Secondary**: Premium features, hero backgrounds
- **Subtle overlays**: Use 5-10% opacity for background depth
- **Glassmorphism**: Cards and floating elements with blur effect

## Accessibility Guidelines

### Contrast Requirements

- **Text on Background**: Minimum WCAG AA (4.5:1)
- **Large Text**: Minimum WCAG AA (3:1)
- **Interactive Elements**: Clear visual distinction

### Color Blind Considerations

- Don't rely solely on color to convey information
- Use icons and patterns alongside color indicators
- Test with color blindness simulators

## Theme Variations

### Dark Theme (Default)

- Background: #0a0a0a
- Foreground: #fafafa
- Muted elements: #262626
- Borders: #262626

### Light Theme

- Background: #ffffff
- Foreground: #171717
- Muted elements: #f5f5f5
- Borders: #e5e5e5

## Do's and Don'ts

### Do's

- ✅ Use brand colors consistently across all materials
- ✅ Maintain proper contrast ratios for accessibility
- ✅ Apply semantic colors for their intended purpose
- ✅ Use gradients sparingly for emphasis
- ✅ Test color combinations in both themes

### Don'ts

- ❌ Create new color variations without approval
- ❌ Use low contrast text/background combinations
- ❌ Mix semantic colors (e.g., green for errors)
- ❌ Overuse gradients or effects
- ❌ Ignore theme consistency

## Implementation Tips

### CSS Variables

Use the provided CSS custom properties for consistency:

```css
color: hsl(var(--color-primary));
background: hsl(var(--color-gray-900));
```

### Tailwind Classes

Leverage Tailwind utilities with our color tokens:

```html
<div class="bg-primary text-primary-foreground">
  <div class="border-gray-800 bg-gray-900/50"></div>
</div>
```

### React Components

Import color values from the brand kit:

```typescript
import { colors } from '@promptliano/brand-kit'
```

## Color Psychology

### Purple (Primary)

- Conveys: Innovation, creativity, premium quality
- Emotions: Confidence, imagination, wisdom

### Blue (Secondary)

- Conveys: Trust, reliability, professionalism
- Emotions: Calm, security, efficiency

### Teal (Accent)

- Conveys: Growth, balance, clarity
- Emotions: Refreshing, harmonious, progressive

## Usage Examples

### Marketing Materials

- Headlines: Primary purple on light backgrounds
- CTAs: Primary purple with white text
- Accents: Teal for highlights and special features

### Product UI

- Navigation: Gray-900 background with gray-50 text
- Buttons: Primary for main actions, secondary for support
- Status: Semantic colors for feedback

### Data Visualization

- Use extended palette for distinct data categories
- Maintain 60-30-10 rule for color distribution
- Ensure sufficient contrast between data points
