import { Schema, model, models, type Document, type Model, Types } from "mongoose";
import { Event, type IEvent } from "./event.model";

// Booking domain model (strongly typed)
export interface IBooking extends Document {
  eventId: Types.ObjectId; // Reference to Event _id
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const BookingSchema = new Schema<IBooking, Model<IBooking>>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: [true, "eventId is required"],
      index: true, // speeds up queries filtering by eventId
    },
    email: {
      type: String,
      required: [true, "email is required"],
      trim: true,
      lowercase: true,
      validate: {
        validator: (v: string) => emailPattern.test(v),
        message: "email must be a valid email address",
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: true,
  }
);

// Pre-save: verify the referenced event exists before creating a booking.
BookingSchema.pre("save", async function (next) {
  try {
    if (!this.isModified("eventId") && !this.isNew) return next();

    const exists = await Event.exists({ _id: this.eventId });
    if (!exists) {
      return next(new Error("Referenced event does not exist"));
    }

    next();
  } catch (err) {
    next(err as Error);
  }
});

export const Booking: Model<IBooking> = models.Booking || model<IBooking>("Booking", BookingSchema);
