import { zoomEnterAnimation } from "./animations/zoomAnimation";
import { shiftEnterAnimation, shiftLeaveAnimation } from "./animations/shiftAnimation";
import { fadeEnterAnimation, fadeLeaveAnimation } from "./animations/fadeAnimation";
import { delay } from "./animations/utils";
import { noAnimation } from "./animations/noAnimation";

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

  /**
   * Various CSS values that can be applied to modal elements
   */
  styles?: {

    /**
     * A CSS color value to use for the lockscreen. Usually a semi-transparent tone of black.
     */
    lockscreenColor?: string;

    /**
     * The minimum distance the modal should have from the edges of the screen when scrolled all the way in any direction. Default: 30px
     */
    scrollPadding?: string;            

    /**
     * A fixed width for the modal
     */
    width?: string;

    /**
     * A fixed height for the modal
     */
    height?: string;

    /**
     * A fixed max width for the modal
     */
    maxWidth?: string;

    /**
     * A fixed max height for the modal
     */
    maxHeight?: string;

  }
}

export const flexModalOptionDefaults: ComfyModalOptions = {
  enterAnimation: shiftEnterAnimation(),
  leaveAnimation: shiftLeaveAnimation(),
  lockscreenEnterAnimation: fadeEnterAnimation(),
  lockscreenLeaveAnimation: fadeLeaveAnimation(),
  closeOnLockscreenClick: true,
  multiModalBehaviour: 'onTop',
  preEnterAnimationCallback: null,
  postEnterAnimationCallback: null,
  preLeaveAnimationCallback: null,
  postLeaveAnimationCallback: null,
  styles: {
    lockscreenColor: "#232426cc",
    scrollPadding: "30px 30px",
    width: 'initial',
    height: 'initial',
    maxWidth: 'initial',
    maxHeight: 'initial'
  }
}

export function resolvePartialOptions(partialOptions: ComfyModalOptions, defaultOptions: ComfyModalOptions = flexModalOptionDefaults): ComfyModalOptions {
  const combinedOptions: ComfyModalOptions = combineWithDefaults(partialOptions, defaultOptions);

  // Some special logic
  combinedOptions.enterAnimation = combinedOptions.enterAnimation || noAnimation;
  combinedOptions.leaveAnimation = combinedOptions.leaveAnimation || noAnimation;
  combinedOptions.lockscreenEnterAnimation = combinedOptions.lockscreenEnterAnimation || noAnimation;
  combinedOptions.lockscreenLeaveAnimation = combinedOptions.lockscreenLeaveAnimation || noAnimation;

  return combinedOptions;
}

/**
 * Merges default values with custom values that overwrite them. But only accepts custom values for properties that also exist in the defaults.
 */
function combineWithDefaults(customValues: {[key: string]: any}, defaultValues: {[key: string]: any}): {[key: string]: any} {
  const combinedValues = {};

  for (const [key, defaultValue] of Object.entries(defaultValues)) {

    // There is a custom value for this property. Use it.
    if (customValues.hasOwnProperty(key)) {
      
      // Might be nested object literal
      if (defaultValue && Object.getPrototypeOf(defaultValue) === Object.prototype) {
        combinedValues[key] = combineWithDefaults(customValues[key], defaultValue);
      } else {
        combinedValues[key] = customValues[key];
      }

    // There is no custom value for this property. Use default.
    } else {      
      combinedValues[key] = defaultValue;
    }
  }

  return combinedValues;
}