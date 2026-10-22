# TruckWithEase Design System & Theme Rules

This rule enforces the cockpit aesthetic matching official TruckWithEase in-cab mobile & tablet hardware.

## Color Tokens
```css
--color-surface: #0a0f14;
--color-surface-container-lowest: #05080e;
--color-surface-container: #0f141c;
--color-primary: #ffe500;
--color-on-primary: #000000;
--color-tactical-green: #10b981;
--color-tactical-amber: #f59e0b;
--color-tactical-yellow: #ffe500;
--color-tactical-hazard: #ef4444;
```

## Button Standards
- Primary Action CTAs must always use `.btn-tactical-yellow` or `bg-[#FFE500] text-black font-black uppercase tracking-wider`.
- Button text must be black (`#000000`), never white or light gray on yellow backgrounds.
- Provide a subtle glowing drop-shadow `rgba(255, 229, 0, 0.45)`.

## Map Standards
- Vector maps must use dark obsidian background (`#05080E`).
- Roads and street geometry should be rendered in muted slate (`#1A2436`).
- Active route corridors must use SVG neon paths with `feGaussianBlur` filters, fading from `#10B981` (safe) to `#F59E0B` (caution) to `#EF4444` (critical bridge).
- Callout markers pointing to structures must say `BRIDGE AHEAD` with amber border `#EAB308`.
