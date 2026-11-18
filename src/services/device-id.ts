const DEVICE_KEY = "family-finance-device-id";

/** Stable id of this device, sent with every sync command. */
export function createDeviceId(storage: Storage) {
  return () => {
    const existing = storage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    storage.setItem(DEVICE_KEY, id);
    return id;
  };
}
