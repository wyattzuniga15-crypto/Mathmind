// Diagnostic only: the smallest script that proves the module loaded and bound
// to @minecraft/server 1.16.0 — the same version the cannon asks for.
import { world, system } from "@minecraft/server";

system.runTimeout(() => {
  try {
    world.sendMessage("§aTEST B OK — script modules work on this version");
  } catch {}
}, 100);
