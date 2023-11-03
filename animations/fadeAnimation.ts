import { delay } from "./utils";

export const fadeEnterAnimation = (durationMs: number = 150) => (element: HTMLElement) => {
  return new Promise(async (resolve, reject) => { 
    // Initial styling
    element.style.opacity = '0';
    await delay(1);

    // Animation
    element.style.transition = `opacity ${durationMs}ms ease`;
    element.style.opacity = '1';
    await delay(durationMs);

    // Cleanup    
    element.style.opacity = '';
    element.style.transition = '';

    resolve(true);
  });
}

export const fadeLeaveAnimation = (durationMs: number = 150) => (element: HTMLElement) => {
  return new Promise(async (resolve, reject) => {
    // Initial styling
    element.style.opacity = '1';
    await delay(1);

    // Animation
    element.style.transition = `opacity ${durationMs}ms ease`;
    element.style.opacity = '0';
    await delay(durationMs);

    resolve(true);
  });
}