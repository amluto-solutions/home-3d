// Saves a plan change for a 3D view that no host (panel, card) takes it from (#363). The hosts go through a
// BuildingController, which sends the revision its plan started from and makes the change again on a newer plan when
// the backend refuses the save as stale (#149); this runs the same controller headless, so there is one implementation.

import { BuildingController, type PlanChange } from "./building-controller.ts";
import type { Building } from "./model.ts";
import type { HomeAssistant } from "./types.ts";

export class FallbackPlanSaver {
  private ctrl: BuildingController | null = null;

  /** `onPlan` shows the plan the controller holds (also the newer one after a conflict); `onFail` reports a save that could not be kept. */
  private readonly onPlan: (building: Building) => void;
  private readonly onFail: (err: unknown) => void;
  constructor(onPlan: (building: Building) => void, onFail: (err: unknown) => void) {
    this.onPlan = onPlan;
    this.onFail = onFail;
  }

  /** Make `change` on the current plan of `home` and save it from the revision that plan has. */
  async change(hass: HomeAssistant, home: string | null | undefined, change: PlanChange): Promise<void> {
    if (!this.ctrl || this.ctrl.home !== (home ?? undefined)) {
      const host = {
        addController() {},
        removeController() {},
        requestUpdate: () => {
          if (this.ctrl?.building) this.onPlan(this.ctrl.building);
        },
        updateComplete: Promise.resolve(true),
      };
      this.ctrl = new BuildingController(host);
      this.ctrl.home = home ?? undefined;
    }
    const ctrl = this.ctrl;
    ctrl.setHass(hass);
    // the first change loads the plan with its revision, so the save below is checked against it
    if (!ctrl.building) await ctrl.reopen();
    if (!ctrl.building) throw new Error(ctrl.error ?? "plan not loaded");
    ctrl.update(change);
    await ctrl.flush();
    if (ctrl.saveState === "error") {
      this.onFail(
        ctrl.conflict ? { message: "the plan was changed elsewhere meanwhile; showing the newer plan, your edit was kept as a draft" } : { message: ctrl.saveError ?? "save failed" },
      );
    }
  }
}
