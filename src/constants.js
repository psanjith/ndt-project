export const NDT_METHODS = [
  { code: "MT", label: "MT — Magnetic Particle" },
  { code: "PT", label: "PT — Liquid Penetrant" },
  { code: "UT", label: "UT — Ultrasonic" },
  { code: "RT", label: "RT — Radiographic" },
  { code: "PAUT", label: "PAUT — Phased Array UT" },
  { code: "DR", label: "DR — Digital Radiography" },
];

export const STATUS = {
  OPEN: "open",
  CLAIMED: "claimed",
  ASSIGNED: "assigned",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

export const statusLabel = {
  open: "Open",
  claimed: "Claimed",
  assigned: "Assigned",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const statusColor = {
  open: "bg-amber-100 text-amber-800 border-amber-200",
  claimed: "bg-sky-100 text-sky-800 border-sky-200",
  assigned: "bg-blue-100 text-blue-800 border-blue-200",
  in_progress: "bg-indigo-100 text-indigo-800 border-indigo-200",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200",
};

export const ROLES = {
  client: { label: "Client", sub: "Construction firm requesting inspections", emoji: "🏗️" },
  dispatcher: { label: "Dispatcher", sub: "Claims jobs and assigns inspectors", emoji: "📋" },
  inspector: { label: "Inspector", sub: "Performs the NDT inspection", emoji: "🔍" },
};
