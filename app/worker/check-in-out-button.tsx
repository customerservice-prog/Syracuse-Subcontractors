"use client";

import { useTransition } from "react";

// Client-side check-in/check-out button. Captures the browser's geolocation
// (when available/granted) before invoking the server action, so
// time.service.ts can evaluate a real GPS geofence against the job's site
// coordinates - see docs/PHASE1-DESIGN.md's "scaffold GPS verification now"
// requirement. A denied/unavailable location never blocks the tap; it just
// results in a LOCATION_UNAVAILABLE geofence result recorded server-side,
// since Phase 1 MVP is manual check-in with GPS layered on top, not GPS
// required.
export function CheckInOutButton({
  assignmentId,
  mode,
  action,
}: {
  assignmentId: string;
  mode: "in" | "out";
  action: (formData: FormData) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  function submitWithLocation(position?: GeolocationPosition) {
    const formData = new FormData();
    formData.set("assignmentId", assignmentId);
    if (position) {
      formData.set("lat", String(position.coords.latitude));
      formData.set("lng", String(position.coords.longitude));
      formData.set("accuracy", String(position.coords.accuracy));
    }
    startTransition(() => {
      action(formData);
    });
  }

  function handleClick() {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      submitWithLocation();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => submitWithLocation(position),
      () => submitWithLocation(),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
    >
      {isPending ? "Getting location..." : mode === "in" ? "Check in" : "Check out"}
    </button>
  );
}
