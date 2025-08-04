# Motion Components

This directory contains animation utilities and components powered by Framer Motion.

## Animation Variants

Pre-defined animation variants for common use cases:

- `fadeIn` - Simple fade in
- `fadeInUp` - Fade in with upward motion
- `fadeInDown` - Fade in with downward motion
- `fadeInLeft` - Fade in from left
- `fadeInRight` - Fade in from right
- `scaleIn` - Scale up with fade
- `rotateIn` - Rotate with fade
- `staggerContainer` - Container for staggered animations
- `staggerItem` - Items within staggered container

## Components

### AnimateOnScroll

Animates children when they come into viewport:

```tsx
import { AnimateOnScroll } from '@promptliano/ui'

;<AnimateOnScroll variants={fadeInUp} delay={0.2}>
  <div>Content appears on scroll</div>
</AnimateOnScroll>
```

### Parallax

Creates parallax scrolling effects:

```tsx
import { Parallax } from '@promptliano/ui'

;<Parallax speed={0.5}>
  <img src='background.jpg' />
</Parallax>
```

### AnimatedText

Animates text word by word:

```tsx
import { AnimatedText } from '@promptliano/ui'

;<AnimatedText text='Hello World' delay={0.1} />
```

### PageTransition

Wraps page content for smooth transitions:

```tsx
import { PageTransition } from '@promptliano/ui'

;<PageTransition>
  <div>Page content</div>
</PageTransition>
```

## Hover Animations

Pre-configured hover animation props:

- `hoverScale` - Scale on hover
- `hoverRotate` - Rotate on hover
- `hoverGlow` - Glow effect on hover

Usage with motion:

```tsx
import { motion, hoverScale } from '@promptliano/ui'

;<motion.button {...hoverScale}>Hover me</motion.button>
```
