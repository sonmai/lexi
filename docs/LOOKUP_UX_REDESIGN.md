# Lexi: VDict-inspired lookup UX refresh

Reference: [VDict](https://vdict.com/) and [VDict's explanation of search features](https://vdict.com/about.php).

## What Lexi adopts

- **Search-first, no marketing copy:** Remove “Từ điển tiếng Anh” / “Tra cứu Anh–Việt và Anh–Anh trong một lần tìm.” from the visible interface. A user opening a dictionary already knows the purpose.
- **Compact persistent search on desktop:** Put the search field beside the Lexi wordmark. The search input and submit action are the first and most prominent controls. On iPhone stack the brand and search without fixing an oversized header to the small viewport.
- **Explicit submit action:** Keep Enter, live suggestions and Cmd/Ctrl+K; add a visible “Tra” submit button on desktops and an icon submit button on mobile.
- **Continuous reading:** Headword, UK/US IPA and speaker first; directly followed by the already implemented bilingual panels and grouped parts of speech.
- **Browse nearby headwords:** Where prefix matches exist, provide unobtrusive clickable entries below the definitions. Label truthfully “Các từ bắt đầu bằng” rather than asserting synonymy or etymological relationships.
- **Keep only essential metadata:** Word count and one offline download affordance remain as a subtle row.

## What Lexi deliberately rejects

- VDict's separate dictionary dropdown: Lexi's core advantage is simultaneous Anh–Việt and Anh–Anh results.
- Advertising, large feature paragraphs, images, video, language learning account and translation UI: not part of this personal lookup application.
- A crowded sidebar for related words: a compact list after the result avoids distraction.
- Claiming VDict's typo correction, fuzzy search or inside-definition lookup is implemented: these are later possible improvements, not part of this UI release.

## QA

- Check 320, 375, 768 and 1440 px viewports; no sideways scroll on phone.
- Search from the iPhone keyboard or tap submit; ensure combobox suggestions and arrow/Enter/Escape behavior remain usable.
- On desktop, searching long entries must not hide the input while scrolling; mobile header should scroll normally.
- Click related headword; ensure URL and word entry update and browser back works.
- Recheck UK/US audio controls, part-of-speech grouping, word count, source attribution link and offline controls.
- Respect reduced motion and focus visibility.

The style remains minimalist: white background, indigo accent, strong readable text; it borrows information architecture and interaction patterns, not VDict's branding or dictionary data.
