import { Schema, model, models, type Document, type Model } from "mongoose";

// Event domain model (strongly typed)
export interface IEvent extends Document {
  title: string;
  slug: string;
  description: string;
  overview: string;
  image: string;
  venue: string;
  location: string;
  date: string; // ISO date string (YYYY-MM-DD)
  time: string; // Normalized time string (e.g., HH:mm or HH:mm-HH:mm)
  mode: string; // online | offline | hybrid (free-form string with validation elsewhere if needed)
  audience: string;
  agenda: string[];
  organizer: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Convert a title to a URL-safe slug. Collapses repeated dashes and trims edges.
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "") // strip accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

// Normalize date string to ISO date (YYYY-MM-DD) or throw if invalid.
function normalizeDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Invalid date format. Expect a parsable date string.");
  }
  return d.toISOString().slice(0, 10);
}

// Normalize time to 24h HH:mm or range HH:mm-HH:mm. Accepts simple AM/PM variants.
function normalizeTime(raw: string): string {
  const s = raw.trim();
  // Split range if present
  const parts = s.split(/\s*-\s*/);
  const to24h = (t: string): string => {
    let m = t.trim().match(/^(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)?$/i);
    if (!m) throw new Error("Invalid time format. Use HH:mm or h(:mm) am/pm, optionally as a range.");
    let hh = parseInt(m[1], 10);
    const mm = m[2] ? parseInt(m[2], 10) : 0;
    const ap = m[3]?.toLowerCase();
    if (ap === "am") {
      if (hh === 12) hh = 0;
    } else if (ap === "pm") {
      if (hh !== 12) hh += 12;
    }
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) throw new Error("Invalid time value.");
    const hhStr = hh.toString().padStart(2, "0");
    const mmStr = mm.toString().padStart(2, "0");
    return `${hhStr}:${mmStr}`;
  };
  if (parts.length === 1) return to24h(parts[0]);
  if (parts.length === 2) return `${to24h(parts[0])}-${to24h(parts[1])}`;
  throw new Error("Invalid time range format.");
}

const requiredString = (label: string) => ({
  type: String,
  required: [true, `${label} is required`],
  trim: true,
  validate: {
    validator: (v: string) => v.trim().length > 0,
    message: `${label} cannot be empty`,
  },
});

const EventSchema = new Schema<IEvent, Model<IEvent>>(
  {
    title: requiredString("title"),
    slug: {
      type: String,
      unique: true,
      index: true,
      required: true,
      trim: true,
    },
    description: requiredString("description"),
    overview: requiredString("overview"),
    image: requiredString("image"),
    venue: requiredString("venue"),
    location: requiredString("location"),
    date: requiredString("date"), // normalized to YYYY-MM-DD in pre-save
    time: requiredString("time"), // normalized to HH:mm or HH:mm-HH:mm in pre-save
    mode: requiredString("mode"),
    audience: requiredString("audience"),
    agenda: {
      type: [String],
      required: [true, "agenda is required"],
      validate: {
        validator: (arr: string[]) => Array.isArray(arr) && arr.length > 0 && arr.every((s) => typeof s === "string" && s.trim().length > 0),
        message: "agenda must be a non-empty array of strings",
      },
    },
    organizer: requiredString("organizer"),
    tags: {
      type: [String],
      required: [true, "tags are required"],
      validate: {
        validator: (arr: string[]) => Array.isArray(arr) && arr.length > 0 && arr.every((s) => typeof s === "string" && s.trim().length > 0),
        message: "tags must be a non-empty array of strings",
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: true,
  }
);

// Unique index for slug (in addition to field-level unique for robustness)
EventSchema.index({ slug: 1 }, { unique: true });

// Pre-save: generate/refresh slug on title changes; normalize date/time formats.
EventSchema.pre("save", function (next) {
  try {
    if (this.isNew || this.isModified("title")) {
      this.slug = slugify(this.title);
    }

    // Normalize date and time for consistency
    if (this.isModified("date") || this.isNew) {
      this.date = normalizeDate(this.date);
    }
    if (this.isModified("time") || this.isNew) {
      this.time = normalizeTime(this.time);
    }

    next();
  } catch (err) {
    next(err as Error);
  }
});

export const Event: Model<IEvent> = models.Event || model<IEvent>("Event", EventSchema);
