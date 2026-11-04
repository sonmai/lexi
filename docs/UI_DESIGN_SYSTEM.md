# Lexi — Minimal Lookup Design System

## Intent

Content-first, quiet, responsive dictionary UI. This is **a lookup tool, not a marketing landing page**. The only primary task is to search a headword, read its definitions, and optionally play pronunciation.

## Source

Design review used [UI UX Pro Max Skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), pinned to commit `56ea9cf174ed86786187daa9de0e6247cb0747e4`.

The generator was run with:
- Query: `bilingual English Vietnamese dictionary lookup productivity tool minimal content-first mobile web`
- Dials: variance 2/10, motion 2/10, density 5/10
- Extra checks: accessibility UX and React stack

The generator selected **Minimalism & Swiss Style**. Its automatic generic landing-page suggestion ("Product Demo + Features") is inappropriate for a dedicated dictionary and is intentionally rejected here.

## Selected tokens

| Token | Value | Purpose |
| --- | --- | --- |
| Canvas | `#FFFFFF` | Focus on text, no tinted app background |
| Primary text | `#192335` | Definition readability |
| Secondary text | `#526074` | IPA, parts of speech and supporting labels |
| Muted text | `#68758A` | Labels and meta; WCAG AA on white |
| Accent | `#4053AD` | Single indigo action/focus colour |
| Border | `#E0E5EC` | Fine structural separators |
| Selected surface | `#EEF2FF` | Autocomplete highlight |
| Focus ring | `#6578D8` | Keyboard focus |

Skill's generated palette was teal/orange and the type recommendation was Plus Jakarta Sans. **We retain the existing indigo identity and system UI font** to keep the one-accent UI coherent and avoid an external font download.

## Layout rules

- Header contains only the logo, small product context and data-source link.
- Search is first-class. Remove the previous oversized slogan, decorative cards and sidebar.
- Results are text-first, rather than nested cards: headword, IPA, pronunciation button and a divider.
- Desktop: Vietnamese meanings and English definitions in two columns with one thin separator.
- Phone/tablet: sections stack naturally, Vietnamese first.
- Maximum reading width is approximately 1024px.
- Spacing uses a 4/8px rhythm, with roomier vertical separation between senses.
- Examples are distinguished by a light left rule instead of tinted boxes.
- Offline download remains discoverable but secondary to search.

## Interaction and accessibility

- Keyboard: `Cmd/Ctrl+K` to select search, arrows to traverse autocomplete, Enter to choose, Escape to close.
- Native `form` submits search from iPhone keyboard. Combobox semantics and active-descendant are provided.
- Browser back/forward and direct links to `?q=example` are supported.
- Icon buttons have labels; interactive areas >=44px; visible focus treatment.
- Base definition size 15px desktop and 16px for the search field, respecting iOS auto-zoom guidance.
- High-contrast text, reduced-motion preference and safe-area insets for small screens.
- No additional runtime libraries, remote fonts, or backend dependencies.

## QA

Validate at 320, 375, 768, 1024 and 1440px, keyboard-only navigation, iPhone Safari, desktop Safari/Chrome, and with reduced motion. Search, suggestions, both language definitions and text-to-speech must continue to work.

This is a UI rework only: dictionary ingestion and licence information remain untouched.
