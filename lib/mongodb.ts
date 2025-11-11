// lib/mongodb.ts
// Typed MongoDB connection helper for Next.js (App Router) using Mongoose.
// - Caches the connection across hot reloads to avoid creating multiple connections in development.
// - Uses strict TypeScript types (no `any`).
// - Throws early if the required environment variable is missing.

import mongoose, { type ConnectOptions, type Mongoose } from "mongoose";

// Ensure the MongoDB connection string is provided via environment variable.
// Example (local): MONGODB_URI="mongodb://127.0.0.1:27017/mydb"
// Example (Atlas): MONGODB_URI="mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/mydb"
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("Invalid/Missing environment variable: MONGODB_URI");
}

// Describe the shape of our cached connection state on the Node.js global scope.
// Using a global cache prevents creating multiple connections during Next.js' dev HMR.
interface MongooseCache {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
}

// Augment the Node.js global type with our cache (var to allow re-declaration across reloads).
declare global {
  // eslint-disable-next-line no-var
  var __mongooseCache: MongooseCache | undefined;
}

// Initialize the cache if it doesn't exist yet.
const cached: MongooseCache = global.__mongooseCache ?? (global.__mongooseCache = {
  conn: null,
  promise: null,
});

/**
 * Establishes (or reuses) a connection to MongoDB and returns the Mongoose instance.
 * - Reuses an existing connection if available.
 * - Creates a singleton connection promise to avoid races on parallel calls.
 */
export async function connectToDatabase(): Promise<Mongoose> {
  // Reuse existing connection
  if (cached.conn) return cached.conn;

  // Create the connection promise once
  if (!cached.promise) {
    const opts: ConnectOptions = {
      // Avoid buffering commands; surface errors immediately if not connected
      bufferCommands: false,
      // Reasonable pool size for most small/medium apps; adjust for your load
      maxPoolSize: 10,
      // Uncomment to enable strictQuery in Mongoose 7/8 if desired
      // strictQuery: true,
    } as ConnectOptions;

    // Initiate the connection; Mongoose has built-in TypeScript types
    cached.promise = mongoose.connect(MONGODB_URI, opts);
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    // Reset the promise so a future call can retry
    cached.promise = null;
    throw err;
  }

  return cached.conn;
}

export default connectToDatabase;
