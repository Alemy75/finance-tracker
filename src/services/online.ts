import { atom, onMount, readonlyType } from "nanostores";

/** `navigator.onLine`, updated by the browser's online and offline events. */
export function createOnlineAtom() {
  const $online = atom(navigator.onLine);
  onMount($online, () => {
    const update = () => $online.set(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  });
  return readonlyType($online);
}
