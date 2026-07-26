import { readSecret } from "../config.js";
import type { SourceConfig, SyncResult } from "../types.js";

export function preflightInteractiveSource(source: SourceConfig): SyncResult {
  if (source.kind === "comdirect") {
    const clientId = readSecret("comdirect-client-id");
    const clientSecret = readSecret("comdirect-client-secret");
    if (!clientId || !clientSecret) {
      return {
        state: "WAITING_FOR_USER",
        message: "comdirect API-Zugangsdaten fehlen; Registrierung und erste PushTAN-Sitzung erforderlich"
      };
    }
    return {
      state: "WAITING_FOR_USER",
      message: "API-Zugang vorhanden; interaktive Session-TAN-Freigabe erforderlich"
    };
  }
  if (source.kind === "dkb-fints") {
    return {
      state: "WAITING_FOR_USER",
      message: "DKB-FinTS muss mit einem echten Depot und SCA-Verfahren in Stufe 0 geprüft werden"
    };
  }
  return { state: "READY", message: "Quelle bereit" };
}
