// The page asks "discard the program?", "really delete?" ... in its own
// dialog (confirmDialog in src/js/50_seitenleiste.js), no longer with
// the browser's confirm(). Tests answer every such question with yes,
// as page.on('dialog', d => d.accept()) did for the native ones.
export async function dialogeBestaetigen(page) {
  await page.addInitScript(() => {
    const ja = () => document.querySelectorAll('.pbc-confirm [data-dlg="yes"]').forEach((b) => b.click());
    new MutationObserver(ja).observe(document, { childList: true, subtree: true });
  });
}
