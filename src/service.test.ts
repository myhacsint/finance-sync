import assert from "node:assert/strict";
import test from "node:test";
import { requiresUserAction } from "./service.js";

test("Bestandsfehler wird nicht als offene TAN-Anfrage klassifiziert", () => {
  assert.equal(requiresUserAction("Ungültige Dezimalzahl im DKB-Depotbestand"), false);
  assert.equal(requiresUserAction("DKB-Freigabe erforderlich"), true);
  assert.equal(requiresUserAction("TAN ist noch ausstehend"), true);
});
