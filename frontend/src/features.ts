/**
 * Everything whose code is in this repository is simply on: there is no tier, no licence and no feature list. A pack may
 * still list "features" (older pack files do); the field is ignored. What is left here: add-ons whose logic is not in this
 * repository stay hidden unless the lab switch is on, and the fun extras are named so the extensions page can list them.
 */

/** Fun extras (pets, the holidays; Halloween is one of the holidays since #287): shown in their own section of the extensions page and switched on and off there. */
export type FunFeature = "fun_pets" | "fun_halloween" | "fun_seasons";
export const FUN: readonly FunFeature[] = ["fun_pets", "fun_seasons"];
/** Free features that are always on (they can still be listed in UNRELEASED to hide them). */
export type FreeFeature = "diagnostics" | "locate";
/** Add-ons whose logic is not in this repository ("pool"). */
export type Gated = FunFeature | FreeFeature | "pool";

/** Hidden unless the lab switch is on (localStorage "home3d.lab" = "1"): their logic is not in this repository. */
export const UNRELEASED: readonly Gated[] = ["pool"];

export function labOn(): boolean {
  try {
    // "?fp3d_lab=1" in the address bar switches it on (and "=0" off) – easier than the browser console on a tablet
    const flag = new URLSearchParams(location.search).get("fp3d_lab");
    if (flag === "1") localStorage.setItem("home3d.lab", "1");
    else if (flag === "0") localStorage.removeItem("home3d.lab");
    return localStorage.getItem("home3d.lab") === "1";
  } catch {
    return false;
  }
}

/** The parked camera projection prototype: only with its own switch ("?fp3d_projection=1", "=0" off), off by default. */
export function projectionOn(): boolean {
  try {
    const flag = new URLSearchParams(location.search).get("fp3d_projection");
    if (flag === "1") localStorage.setItem("home3d.projection", "1");
    else if (flag === "0") localStorage.removeItem("home3d.projection");
    return localStorage.getItem("home3d.projection") === "1";
  } catch {
    return false;
  }
}

/** Whether an add-on may be shown: everything is, except the unreleased ones, which need the lab switch. */
export function released(feature: Gated): boolean {
  return !UNRELEASED.includes(feature) || labOn();
}
