# UI/UX Design System

This document outlines the color palette, glassmorphism containers, typography standards, and responsive breakpoints for Scripture Habit.

---

## 1. Color Palette & Theme Tokens

All design tokens are centralized in `src/index.css`:

- **Brand Tokens**:
  - `--pink`: Highlights and active item indicators
  - `--purple`: Primary call-to-action buttons
  - `--yellow`: Gamification badges, streaks, and coins
- **Neutral & Feedback Tokens**:
  - `--black` (`#242d49`): High-contrast primary text color
  - `--gray`: Secondary hints, borders, and muted copy
  - `--red`: Errors, alerts, and destructive actions

### Main Vibrant Gradient
```css
background: linear-gradient(106.37deg, #feac5e 29.63%, #c779d0 51.55%, #4bc0c8 90.85%);
```

---

## 2. Glassmorphism Design Elements

Soft translucent cards provide visual depth and polish:

- **`.AppGlass`**: The primary app container (`rgba(255, 255, 255, 0.54)`, `border-radius: 2rem`, and soft diffused drop shadows).
- **Implementation Note**: To prevent rendering anomalies with child `position: fixed` modals, alpha blending is preferred over nested CSS `backdrop-filter: blur()`.

---

## 3. Responsive Layouts (768px Breakpoint)

- **Desktop (>= 768px)**: Fixed persistent sidebar with centered main content card.
- **Mobile (< 768px)**:
  - Higher-opacity backgrounds (`rgba(255, 255, 255, 0.95)`) for enhanced sunlight readability.
  - Safe-area insets (`env(safe-area-inset-top)` / `env(safe-area-inset-bottom)`) to prevent notch clipping.

---

## 4. Typography & Micro-Interactions

- **Typography**: Self-hosted `@fontsource/inter` and `@fontsource/outfit` eliminate layout shift (FOUT) and CDN dependencies.
- **Micro-Interactions**:
  - `0.2s` subtle scale-up on button hover and active states.
  - Directional shake animations on validation failures.

---

## 5. Related Documentation

- [Architecture Overview](./architecture.md)
- [Network & Performance Optimization](./network-performance-optimization.md)
