import { delay } from "./utils";

export const zoomEnterAnimation = (durationMs: number = 150, fromScale: number = 0.8) => (element: HTMLElement) => {
  return new Promise(async (resolve, reject) => {
    // Initial styling
    element.style.transform = `scale(${fromScale})`;
    await delay(1);

    // Animation
    element.style.transition = `transform ${durationMs}ms ease`;
    element.style.transform = 'scale(1)';
    await delay(durationMs);

    // Cleanup    
    element.style.transform = '';
    element.style.transition = '';

    resolve(true);
  });
}

export const zoomLeaveAnimation = (durationMs: number = 150, toScale: number = 0.8) => (element: HTMLElement) => {
  return new Promise(async (resolve, reject) => {
    // Initial styling
    element.style.transform = 'scale(1)';
    await delay(1);

    // Animation
    element.style.transition = `transform ${durationMs}ms ease`;
    element.style.transform = `scale(${toScale})`;
    await delay(durationMs);

    resolve(true);
  });
}