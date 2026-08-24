import assert from "node:assert/strict";
import test from "node:test";
import { newsletterPlainText } from "./newsletter-content.js";

test("Newslettertext bevorzugt Klartext und fällt sicher auf HTML zurück", () => {
  assert.equal(newsletterPlainText({ text: " Klartext ", html: "<p>Falsch</p>" }), "Klartext");
  assert.equal(
    newsletterPlainText({ html: "<style>x</style><p>Gold &amp; Silber</p><script>evil</script><div>Ziel&nbsp;10&#37;</div>" }),
    "Gold & Silber\nZiel 10%"
  );
});
