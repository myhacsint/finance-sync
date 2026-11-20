import assert from "node:assert/strict";
import test from "node:test";
import { requiresUserAction } from "./service.js";

test("Bestandsfehler wird nicht als offene TAN-Anfrage klassifiziert", () => {
  assert.equal(requiresUserAction("Ungültige Dezimalzahl im DKB-Depotbestand"), false);
  assert.equal(requiresUserAction("DKB-Freigabe erforderlich"), true);
  assert.equal(requiresUserAction("TAN ist noch ausstehend"), true);
});

test("konkrete FinTS-Bankfehler sind Fehler, kein Warten auf Freigabe", () => {
  assert.equal(requiresUserAction("FinTSClientError: FinTS 9010: offene DKB-Freigabe ungültig"), false);
  assert.equal(requiresUserAction("X [FinTS-Rückgabecode: 9050, 9010] Freigabe"), false);
});
