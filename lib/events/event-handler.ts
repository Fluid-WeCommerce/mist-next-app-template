// Event router.
//
// Maps webhook event types ("resource.event", optionally versioned) to handler
// functions. Handlers are async and receive the payload the webhook route
// extracted. Registration happens once at module load via lib/handlers.

export type EventHandlerFn = (payload: unknown) => Promise<void>;

const handlers = new Map<string, EventHandlerFn>();

// Registers a handler for an event type. Pass a version to register a
// versioned variant, keyed as "{version}.{eventType}".
export function registerHandler(
  eventType: string,
  handler: EventHandlerFn,
  version?: string,
): void {
  handlers.set(key(eventType, version), handler);
}

export function hasHandler(eventType: string, version?: string): boolean {
  return handlers.has(key(eventType, version)) || handlers.has(eventType);
}

// Routes an event to its handler. Returns true if a handler ran, false if none
// was registered. Falls back to the unversioned handler when a versioned one
// isn't found.
export async function routeEvent(
  eventType: string,
  payload: unknown,
  version?: string,
): Promise<boolean> {
  const handler =
    (version && handlers.get(key(eventType, version))) || handlers.get(eventType);
  if (!handler) return false;
  await handler(payload);
  return true;
}

// Test/reset helper.
export function clearHandlers(): void {
  handlers.clear();
}

function key(eventType: string, version?: string): string {
  return version ? `${version}.${eventType}` : eventType;
}
