import { zoomEnterAnimation } from "./animations/zoomAnimation";
import { shiftEnterAnimation, shiftLeaveAnimation } from "./animations/shiftAnimation";
import { fadeEnterAnimation, fadeLeaveAnimation } from "./animations/fadeAnimation";
import { delay } from "./animations/utils";

export interface FlexModalOptions {
  /**
   * An animation that will be applied to the modal as it enters the screen. This is simply a function that is given the modal element, applies animations with any custom logic and returns a promise that resolves when done.
   */
  modalEnterAnimation?: (modal: HTMLElement) => Promise<any>;

  /**
   * An animation that will be applied to the modal as it leaves the screen. This is simply a function that is given the modal element, applies animations with any custom logic and returns a promise that resolves when done.
   */
  modalLeaveAnimation?: (modal: HTMLElement) => Promise<any>;

  /**
   * An animation that will be applied to the lockscreen as it enters the screen. This is simply a function that is given the lockscreen element, applies animations with any custom logic and returns a promise that resolves when done.
   */
  lockscreenEnterAnimation?: (lockscreen: HTMLElement) => Promise<any>;

  /**
   * An animation that will be applied to the lockscreen as it leaves the screen. This is simply a function that is given the lockscreen element, applies animations with any custom logic and returns a promise that resolves when done.
   */
  lockscreenLeaveAnimation?: (lockscreen: HTMLElement) => Promise<any>;  
  
  /**
   * Whether or not to run the lockscreen and modal animations in parallel when opening the modal. Default: true
   */
  runEntryAnimationsInParallel?: boolean;

  /**
   * Whether or not to run the lockscreen and modal animations in parallel when closing the modal. Default: true
   */
  runLeaveAnimationsInParallel?: boolean;
  
  /**
   * The minimum horizontal padding when the modal dimensions wou.ld exceed the screen size. Default: 30px
   */
  paddingHorizontal?: number;              

  /**
   * The minimum vertical padding when the modal dimensions wou.ld exceed the screen size. Default: 30px                 
   */
  paddingVertical?: number;

  /**
   * A CSS color value to use for the lockscreen. Usually a semi-transparent tone of black.
   */
  lockscreenColor?: string;
  
  /**
   * A callback that will be executed before running the enter animations
   */
  preEnterAnimationCallback?: ((modal: HTMLElement, lockscreen: HTMLElement) => void)|null;

  /**
   * A callback that will be executed before running the enter animations
   */
  postEnterAnimationCallback?: ((modal: HTMLElement, lockscreen: HTMLElement) => void)|null;

  /**
   * A callback that will be executed before running the enter animations
   */
  preLeaveAnimationCallback?: ((modal: HTMLElement, lockscreen: HTMLElement) => void)|null;

  /**
   * A callback that will be executed before running the enter animations
   */
  postLeaveAnimationCallback?: ((modal: HTMLElement, lockscreen: HTMLElement) => void)|null;
}

export const flexModalOptionDefaults: FlexModalOptions = {
  modalEnterAnimation: shiftEnterAnimation(),
  modalLeaveAnimation: shiftLeaveAnimation(),
  lockscreenEnterAnimation: fadeEnterAnimation(),
  lockscreenLeaveAnimation: fadeLeaveAnimation(300),
  runEntryAnimationsInParallel: true,
  runLeaveAnimationsInParallel: true,
  paddingHorizontal: 30,
  paddingVertical: 30,
  lockscreenColor: "#272727cc",
  preEnterAnimationCallback: null,
  postEnterAnimationCallback: null,
  preLeaveAnimationCallback: null,
  postLeaveAnimationCallback: null
}

export function resolvePartialOptions(partialOptions): FlexModalOptions {
  const finalOptions = {};

  for (const [key, defaultValue] of Object.entries(flexModalOptionDefaults)) {
    finalOptions[key] = partialOptions.hasOwnProperty(key) ? partialOptions[key] : defaultValue;
  }

  return finalOptions;
}