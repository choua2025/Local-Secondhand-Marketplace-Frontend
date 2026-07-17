/** @type {import('tailwindcss').Config} */
export default {
  // Tailwind scans these files for class names and emits only the CSS it finds.
  // Miss a path here and those classes silently vanish from the build.
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Make Inter the default sans, which Tailwind's preflight applies to the
      // whole document — so every existing `font-sans` / unstyled element picks
      // it up with no className changes. The system fonts stay as the fallback
      // stack, shown for the moment before the font loads and if it ever fails.
      fontFamily: {
        // Inter first for Latin; Noto Sans Lao/Thai next so those scripts render
        // (Inter has no glyphs for them, and the browser falls through to the
        // first font in the stack that does); system fonts last as the fallback.
        sans: [
          'Inter Variable',
          'Inter',
          'Noto Sans Lao Variable',
          'IBM Plex Sans Thai',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}

