import { delay } from "./utils";

export const bounceEnterAnimation = (durationMs: number = 350, delayMs: number = 0, animationFunction: string = 'cubic-bezier(0, 0, 0, 1.4)') => (element: HTMLElement) => {
  return new Promise(async (resolve, reject) => {
    // Initial styling
    element.style.position = 'absolute';
    element.style.top = `calc(0% - ${ element.clientHeight }px)`;
    element.style.transition = `top ${durationMs}ms ${animationFunction}`;
    await delay(1 + delayMs);

    // Animation
    element.style.top = `calc(50% - ${ element.clientHeight / 2 }px)`;
    await delay(durationMs);

    // Cleanup    
    element.style.position = '';
    element.style.top = '';
    element.style.transition = '';

    resolve(true);
  });
}

export const bounceLeaveAnimation = (durationMs: number = 400, delayMs: number = 0) => (element: HTMLElement) => {
  return new Promise(async (resolve, reject) => {
    // Initial styling
    element.style.position = 'absolute';
    element.style.top = `calc(50% - ${ element.clientHeight / 2 }px)`;
    element.style.transition = `top ${durationMs}ms ease`;
    await delay(1 + delayMs);

    // Animation
    element.style.top = `calc(0% - ${ element.clientHeight }px)`;
    await delay(durationMs);

    // Cleanup    
    element.style.position = '';
    element.style.top = '';
    element.style.transition = '';

    resolve(true);
  });
}