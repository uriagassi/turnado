// Step 2: HTTPS (issue #36). Offers to reuse a detected paperless.node
// install's TLS cert/key when it has HTTPS turned on — the two apps are
// designed to front the same hostname, so the same cert covers both.
import type { Interface } from "node:readline/promises";
import config from "../../server/src/config.js";
import { expandHome } from "../../server/src/paths.js";
import type { PaperlessNodeDefaults } from "../../server/src/setup/detectPaperlessNode.js";
import type { ConfigTree } from "../../server/src/setup/deepMerge.js";
import { askDetected, askYesNo } from "./prompt.js";

export async function setupHttps(
  rl: Interface,
  detected: PaperlessNodeDefaults | null
): Promise<ConfigTree> {
  console.log("\n-- HTTPS --");
  const currentlyOn = config.has("https.use") && config.get<boolean>("https.use") === true;
  const use = await askYesNo(rl, "Serve over HTTPS?", currentlyOn);
  if (!use) {
    return { https: { use: false } };
  }

  if (detected?.httpsKeyPath && detected?.httpsCertPath) {
    console.log("Detected paperless.node's TLS cert — proposing it below (this app can share the same cert).");
  }
  const keyPath = await askDetected(
    rl,
    "Path to the TLS private key (e.g. privkey.pem)?",
    detected?.httpsKeyPath,
    expandHome(config.get<string>("https.keyPath"))
  );
  const certPath = await askDetected(
    rl,
    "Path to the TLS certificate (e.g. fullchain.pem)?",
    detected?.httpsCertPath,
    expandHome(config.get<string>("https.certPath"))
  );

  return { https: { use: true, keyPath, certPath } };
}
