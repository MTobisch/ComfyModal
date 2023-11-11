import { zoomEnterAnimation } from "./animations/zoomAnimation";
import { shiftEnterAnimation, shiftLeaveAnimation } from "./animations/shiftAnimation";
import { fadeEnterAnimation, fadeLeaveAnimation } from "./animations/fadeAnimation";
import { delay } from "./animations/utils";

export interface ComfyModalOptions {
  /**
   * An animation that will be applied to the modal as it enters the screen. This is simply a function that is given the modal element, applies animations with any custom logic and returns a promise that resolves when done.
   */
  enterAnimation?: (modal: HTMLElement) => Promise<any>;

  /**
   * An animation that will be applied to the modal as it leaves the screen. This is simply a function that is given the modal element, applies animations with any custom logic and returns a promise that resolves when done.
   */
  leaveAnimation?: (modal: HTMLElement) => Promise<any>;

  /**
   * An animation that will be applied to the lockscreen as it enters the screen. This is simply a function that is given the lockscreen element, applies animations with any custom logic and returns a promise that resolves when done.
   */
  lockscreenEnterAnimation?: (lockscreen: HTMLElement) => Promise<any>;

  /**
   * An animation that will be applied to the lockscreen as it leaves the screen. This is simply a function that is given the lockscreen element, applies animations with any custom logic and returns a promise that resolves when done.
   */
  lockscreenLeaveAnimation?: (lockscreen: HTMLElement) => Promise<any>;  

  /**
   * Whether to allow closing the modal by clicking on the lockscreen surrounding the modal. If false, can only programmatically close it.
   */
  closeOnLockscreenClick?: boolean;

  /**
   * Determines how opening this modal affects other, already opened modals
   * 
   * onTop (default): The new modal will simply be shown over older modals
   * exclusive: The new modal will cause all other modals to close globally
   * exclusiveInContainer: The new modal will cause all other modals in the same container element to close
   */
  multiModalBehaviour?: 'onTop'|'exclusive'|'exclusiveInContainer';
  
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
  preEnterAnimationCallback?: ((modalContent: HTMLElement) => void)|null;

  /**
   * A callback that will be executed before running the enter animations
   */
  postEnterAnimationCallback?: ((modalContent: HTMLElement) => void)|null;

  /**
   * A callback that will be executed before running the enter animations
   */
  preLeaveAnimationCallback?: ((modalContent: HTMLElement) => void)|null;

  /**
   * A callback that will be executed before running the enter animations
   */
  postLeaveAnimationCallback?: ((modalContent: HTMLElement) => void)|null;
}

export const flexModalOptionDefaults: ComfyModalOptions = {
  enterAnimation: shiftEnterAnimation(),
  leaveAnimation: shiftLeaveAnimation(),
  lockscreenEnterAnimation: fadeEnterAnimation(),
  lockscreenLeaveAnimation: fadeLeaveAnimation(),
  closeOnLockscreenClick: true,
  multiModalBehaviour: 'onTop',
  paddingHorizontal: 30,
  paddingVertical: 30,
  lockscreenColor: "#272727cc",
  preEnterAnimationCallback: null,
  postEnterAnimationCallback: null,
  preLeaveAnimationCallback: null,
  postLeaveAnimationCallback: null
}

export function resolvePartialOptions(partialOptions): ComfyModalOptions {
  const finalOptions = {};

  for (const [key, defaultValue] of Object.entries(flexModalOptionDefaults)) {
    finalOptions[key] = partialOptions.hasOwnProperty(key) ? partialOptions[key] : defaultValue;
  }

  return finalOptions;
}