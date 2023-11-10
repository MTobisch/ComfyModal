import { delay } from "./utils";

export const shiftEnterAnimation = (durationMs: number = 150, delayMs: number = 0, direction: 'top'|'right'|'bottom'|'left' = 'top', shiftDistance: number = 50) => (element: HTMLElement) => {
  return new Promise(async (resolve, reject) => {
    // Initial styling
    element.style.position = 'relative';
    element.style[direction] = shiftDistance + 'px';
    element.style.opacity = '0';
    await delay(1 + delayMs);

    // Animation
    element.style.transition = `${direction} ${durationMs}ms ease, opacity ${durationMs}ms ease`;
    element.style[direction] = '0px';
    element.style.opacity = '1';
    await delay(durationMs);

    // Cleanup    
    element.style.position = '';
    element.style[direction] = '';
    element.style.opacity = '';
    element.style.transition = '';    

    resolve(true);
  });
}

export const shiftLeaveAnimation = (durationMs: number = 150, delayMs: number = 0, direction: 'top'|'right'|'bottom'|'left' = 'bottom', shiftDistance: number = 50) => (element: HTMLElement) => {
  return new Promise(async (resolve, reject) => {
    // Initial styling
    element.style.position = 'relative';
    element.style[direction] = '0px';
    element.style.opacity = '1';
    await delay(1 + delayMs);

    // Animation
    element.style.transition = `${direction} ${durationMs}ms ease, opacity ${durationMs}ms ease`;
    element.style[direction] = shiftDistance + 'px';
    element.style.opacity = '0';
    await delay(durationMs);  

    resolve(true);
  });
}