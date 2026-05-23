# UI/UX Design System: Premium Aesthetics

The **scripture-habit** design language is built around the "Modern Premium" aesthetic, utilizing vibrant gradients, glassmorphism, and smooth micro-animations.

---

## 🎨 Design Tokens

All core styles are centralized in `src/index.css` using CSS Variables.

### Color Palette
- **Brand Colors**: 
  - `--pink`: Used for highlights and active states.
  - `--purple`: (Gradient) Used for primary actions.
  - `--yellow`: (Gradient) Used for achievements and coins.
- **Support Colors**:
  - `--black`: (#242d49) Deep navy used for text and heavy contrast.
  - `--gray`: Soft gray for secondary text and hints.
  - `--red`: Vibrant red for alerts and errors.

### Backgrounds & Gradients
The main application background is a dynamic 3-color gradient:
```css
background: linear-gradient(106.37deg, #feac5e 29.63%, #c779d0 51.55%, #4bc0c8 90.85%);
```

---

## 💎 Glassmorphism (The Glass Card)

The defining feature of the UI is the "Glass Card" effect, which provides depth without sacrificing focus.

### `.AppGlass`
The primary container for all screens:
- **Background**: `rgba(255, 255, 255, 0.54)`
- **Blur**: `backdrop-filter: blur(20px)` (applied via containers).
- **Shadow**: `--boxShadow` provides a soft, floating lift.

### Design Rule
When adding a new card or modal, always use `var(--glass)` and ensure it has a soft border-radius (`2rem` or `16px`) to keep the "friendly and premium" feel.

---

## 📱 Mobile-First Strategy

The app is designed to be fully functional on both desktop and mobile (via Capacitor).

### Breakpoint: 768px
- **Desktop**: Sidebar is fixed, content is center-aligned.
- **Mobile**:
  - The glass effect is often replaced with a solid or semi-opaque white background (`rgba(255, 255, 255, 0.95)`) to improve readability and fix positioning issues on some mobile browsers.
  - `env(safe-area-inset-top)` is used to ensure UI doesn't overlap with status bars or camera notches.

---

## ✨ Patterns & Animations

### 1. The "Shake" Alert
Errors (like failed login) trigger a `shake` animation defined in `index.css` to provide immediate, non-verbal feedback.

### 2. Micro-interactions
- **Hover**: Icons and buttons should subtly scale or change opacity using CSS transitions (`0.2s`).
- **Active**: Items use `var(--activeItem)` to indicate selection.

### 3. Typography
- **Primary**: `Inter`, sans-serif. It provides a clean, modern look that remains readable at small sizes.
- **Rule**: Headings (`h1`, `h2`) should have a `letter-spacing` and `line-height` that avoids crowding, ensuring a "breathable" layout.
