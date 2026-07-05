# UI/UX Design System

The **scripture-habit** design language uses gradients, a translucent glass effect (glassmorphism), and simple animations to create a modern interface.

---

## Color Palette

All core styles are centralized in `src/index.css` using CSS Variables.

### Color Palette Tokens
- **Brand Colors**: 
  - `--pink`: Used for highlights and active states.
  - `--purple`: (Gradient) Used for primary actions.
  - `--yellow`: (Gradient) Used for achievements and coins.
- **Support Colors**:
  - `--black`: (#242d49) Deep navy used for text and high contrast.
  - `--gray`: Soft gray for secondary text and hints.
  - `--red`: Red for alerts and errors.

### Backgrounds & Gradients
The main app background is a 3-color gradient:
```css
background: linear-gradient(106.37deg, #feac5e 29.63%, #c779d0 51.55%, #4bc0c8 90.85%);
```

---

## Glassmorphism (The Glass Card)

The UI uses a translucent "Glass Card" effect to create layout depth.

### `.AppGlass`
The primary container for all screens:
- **Background**: `rgba(255, 255, 255, 0.54)`
- **Blur**: (Note) `backdrop-filter: blur(20px)` was previously applied, but has been disabled to prevent fixed-positioning context bugs (where child elements with `position: fixed` behave like `position: absolute` inside filters).
- **Shadow**: `--boxShadow` provides a soft, floating lift.

### Design Rule
When adding a new card or modal, use `var(--glass)` and set the border-radius to `2rem` or `16px` to keep a clean, rounded look.

---

## Mobile-First Strategy

The app is designed to be fully functional on both desktop and mobile.

### Breakpoint: 768px
- **Desktop**: Sidebar is fixed, content is center-aligned.
- **Mobile**:
  - The glass effect is often replaced with a solid or semi-opaque white background (`rgba(255, 255, 255, 0.95)`) to improve readability on mobile screens.
  - `env(safe-area-inset-top)` is used to prevent the UI from overlapping with mobile status bars or camera notches.

---

## Patterns & Animations

### 1. The "Shake" Alert
Errors (such as a failed login attempt) trigger a `shake` animation defined in `index.css` to give immediate visual feedback.

### 2. UI Transitions
- **Hover**: Icons and buttons scale or change opacity slightly using CSS transitions (`0.2s`).
- **Active**: Selected items use `var(--activeItem)`.

### 3. Typography
- **Primary Font**: `Inter`, sans-serif. It is clean and readable at small sizes.
- **Headings**: Headings (`h1`, `h2`) use line spacing that avoids crowding to make the layout clean and easy to scan.
