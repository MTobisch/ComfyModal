import { ComfyModalOptions, resolvePartialOptions } from "./comfyModalOptions";

interface ModalData {
  id: number;
  options: ComfyModalOptions;
  modalClosedPromiseResolve?: (value: HTMLElement | PromiseLike<HTMLElement>) => void;
  // Some state
  zIndex: number;
  isOpened: boolean;
  isClosing: boolean;
  closeIsQueued: boolean;
  elements: {
    scrollContainer?: HTMLElement;
    container?: HTMLElement;
    lockscreen?: HTMLElement;
    lockscreenPadding?: HTMLElement;
    modalWrapper?: HTMLElement;
    modalContent?: HTMLElement;
  }
  listeners?: {
    containerScroll: Function,
    containerResize: Function,
    lockscreenWheel: Function,
    lockscreenTouchStart: Function,
    lockscreenTouchMove: Function,
    lockscreenKey: Function
  }
}

export interface ModalReceipt {
  id: number;
  close: Function;
  wasOpened: Promise<HTMLElement>;
  wasClosed: Promise<HTMLElement>;
}

// State
let modalCounter: number = 0;
let openedModals: {[key: number]: ModalData} = {};
let wheelEvent: any = null;
let wheelEventOpts: any = null;
let lastTouchCoords: {x: number, y: number} = null; 
let touchScrollAxis: 'x'|'y' = null;

/**
 * Creates a modal with any content in a special lockscreen over the normal content
 *
 * @param createFunction - A function that returns the modal html. Is given a closeHandler fn as a parameter that can (for example) be used in click events within the modal to close it
 * @param options - A FlexModalOptions object that can be used to customize the behaviour of the modal
 * @param container - What container the modal lockscreen should be appended into. Defaults to the body element.
 */
export function openModal(createFunction: (closeHandler: () => void) => HTMLElement, options: ComfyModalOptions = {}, container: HTMLElement = document.body): ModalReceipt {
  const modalsInSameContainer = Object.values(openedModals).filter(modalData => modalData.elements.container === container);
  const zIndex = modalsInSameContainer.length ? Math.max(...modalsInSameContainer.map(modalData => modalData.zIndex)) + 1 : 1;

  const id = modalCounter++;
  const customCloseFn = (() => closeModal(id));
  const modal: ModalData = {
    id: id,       
    options: resolvePartialOptions(options),
    zIndex: zIndex,
    elements: {
      scrollContainer: (container === document.body ? window : container) as HTMLElement, // If container is body, scroll data can be found in window
      container: container,
      modalContent: createFunction(customCloseFn),
    },
    isOpened: false, 
    isClosing: false,
    closeIsQueued: false
  };
  modal.listeners = {
    containerScroll: containerScrollListener.bind(null, modal),
    containerResize: containerResizeListener.bind(null, modal),
    lockscreenWheel: lockscreenWheelListener.bind(null, modal),
    lockscreenTouchStart: lockscreenTouchStartListener.bind(null, modal),
    lockscreenTouchMove: lockscreenTouchMoveListener.bind(null, modal),
    lockscreenKey: lockscreenKeyListener.bind(null, modal)
  }

  // Sanity check
  if (Object.values(openedModals).map(modalData => modalData.elements.modalContent).includes(modal.elements.modalContent)) {
    console.error("A modal with this exact HTMLElement as content is already opened.");
    return;
  }

  // MultiModal check
  if (modal.options.multiModalBehaviour === 'exclusive') {
    for (const modal of Object.values(openedModals)) {
      closeModalObject(modal);
    }
  } else if (modal.options.multiModalBehaviour === 'exclusiveInContainer') {
    for (const modal of modalsInSameContainer) {
      closeModalObject(modal);
    }
  }

  openedModals[id] = modal;

  // Create lockscreen
  createLockscreen(modal);

  // Insert modal content into wrapper that can then be animated
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `<div 
    class="comfymodal-wrapper"
    style="
      width: ${ modal.options.styles.width };
      height: ${ modal.options.styles.height };
      max-width: ${ modal.options.styles.maxWidth };
      max-height: ${ modal.options.styles.maxHeight };
    "
  ></div>`;

  modal.elements.modalWrapper = wrapper.childNodes[0] as HTMLElement;
  modal.elements.modalWrapper.append(modal.elements.modalContent);
  modal.elements.lockscreenPadding!.append(modal.elements.modalWrapper);

  // Will be triggered when modal has fully opened (after animations)
  const modalOpenedPromise: Promise<HTMLElement> = new Promise(async (resolve, reject) => {
    if (modal.options.preEnterAnimationCallback) { modal.options.preEnterAnimationCallback(modal.elements.modalContent); }
    await Promise.all([
      modal.options.lockscreenEnterAnimation!(modal.elements.lockscreen!),
      modal.options.enterAnimation!(modal.elements.modalWrapper)
    ]);
    if (modal.options.postEnterAnimationCallback) { modal.options.postEnterAnimationCallback(modal.elements.modalContent); }
    
    modal.isOpened = true;

    resolve(modal.elements.modalContent);

    // Close might already have been requested before opening animation finished. If so, close modal now.
    if (modal.closeIsQueued) {
      closeModalObject(modal);
    }
  });

  // Will be triggered when modal has fully closed (after animations)
  const modalClosedPromise = new Promise((resolve, reject) => {
    modal.modalClosedPromiseResolve = resolve;
  }) as Promise<HTMLElement>;

  return {
    id: id,
    close: customCloseFn,
    wasOpened: modalOpenedPromise,
    wasClosed: modalClosedPromise
  };
}

export function closeModal(id: number) {
  const modalToClose = Object.values(openedModals).find(openedModal => openedModal.id === id);
  if (!modalToClose) {
    // Modal not found, cancel
    return;
  }

  closeModalObject(modalToClose);
}

export function closeAllModals() {
  for (const modalToClose of Object.values(openedModals)) {
    closeModalObject(modalToClose);
  }
}

/**
 *  Putting this in its own function so multiple modals can be closed in parallel
 */
async function closeModalObject(modal: ModalData) {
  // Don't allow closing a modal that is already closing
  if (modal.isClosing) {
    return;
  }

  // If closing a modal that hasn't fully opened yet, queue close request. It will then close as soon as it has fully opened.
  if (!modal.isOpened) {
    modal.closeIsQueued = true;
    return;
  }
  
  modal.isClosing = true;

  // Run animations of lockscreen and modal in parallel or sequential
  if (modal.options.preLeaveAnimationCallback) { modal.options.preLeaveAnimationCallback(modal.elements.modalContent); }
  await Promise.all([
    modal.options.leaveAnimation!(modal.elements.modalWrapper),
    modal.options.lockscreenLeaveAnimation!(modal.elements.lockscreen)
  ]);
  if (modal.options.postLeaveAnimationCallback) { modal.options.postLeaveAnimationCallback(modal.elements.modalContent); }

  // Remove lockscreen
  removeLockscreen(modal);

  // Remove modal from openedModals
  delete openedModals[modal.id!];

  // Return detached modal when all is done
  modal.modalClosedPromiseResolve!(modal.elements.modalContent);
}

// Lockscreen management
// ------------------------------------------------------

async function createLockscreen(modal: ModalData) {
  // Create lockscreen (invisible at first)
  // This hides lockscreen scrollbar beneath container scrollbar, so no horizontal content shift
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `<div 
      class='comfymodal-lockscreen' 
      tabindex="0"
      style='
        position: absolute; 
        top: 0px; 
        left: 0px; 
        display: grid;
        width: 100%; 
        height: 100%; 
        background-color: ${modal.options.styles.lockscreenColor};
        overflow: auto;
        z-index: ${1000 + modal.zIndex};
      '
    >
      <div 
        class='comfymodal-lockscreen-padding'
        style='
          display: flex; 
          align-items: center; 
          justify-content: center; 
          max-height: 100%; 
          height: 100%;
          width: 100%;
          box-sizing: border-box;
          padding: ${ modal.options.styles.scrollPadding }; 
        '
      ></div>
    </div>`;

  modal.elements.lockscreen = wrapper.childNodes[0] as HTMLElement;
  modal.elements.lockscreenPadding = modal.elements.lockscreen.querySelector('.comfymodal-lockscreen-padding') as HTMLElement;

  // Make sure container will contain absolutely positioned child
  const computedStyles = getComputedStyle(modal.elements.container);
  if (computedStyles.position === 'static') {
    modal.elements.container.style.position = 'relative';
  }

  // Position lockscreen according to current container scroll position
  repositionLockscreen(modal);

  // Append lockscreen
  modal.elements.container?.append(modal.elements.lockscreen);

  // Close on lockscreen click
  if (modal.options.closeOnLockscreenClick) {
    modal.elements.lockscreen.addEventListener('click', event => {
      // Only close on direct clicks on lockscreen, not modal itself
      if ((event.target as HTMLElement).classList.contains('comfymodal-lockscreen-padding')) {
        closeModal(modal.id);
      }
    });
  }

  // Attach event listeners
  toggleLockscreenListeners(modal, false);
}

function repositionLockscreen(modal: ModalData) {
  // y positioning
  const outerYScrollPosition = modal.elements.container === document.body ? (modal.elements.scrollContainer as any).scrollY : modal.elements.scrollContainer.scrollTop; 
  modal.elements.lockscreen.style.top = outerYScrollPosition + 'px';
  //modal.elements.lockscreen.style.height = window.innerHeight + 'px';

  // x positioning
  const outerXScrollPosition = modal.elements.container === document.body ? (modal.elements.scrollContainer as any).scrollX : modal.elements.scrollContainer.scrollLeft; 
  modal.elements.lockscreen.style.left = outerXScrollPosition + 'px';
  //modal.elements.lockscreen.style.width = window.innerWidth + 'px';
}

function removeLockscreen(modal: ModalData) {
  toggleLockscreenListeners(modal, true);
  modal.elements.container?.removeChild(modal.elements.lockscreen!);
  modal.elements.lockscreen.remove();
}

// Lockscreen listeners
// ------------------------------------------------------

function initWheelEventVars() {
  // Modern Chrome requires { passive: false } when adding event
  wheelEvent = 'onwheel' in document.createElement('div') ? 'wheel' : 'mousewheel';
  wheelEventOpts = false;
  try {
    window.addEventListener("test", null, Object.defineProperty({}, 'passive', {
      get: function () { wheelEventOpts = { passive: false } as EventListenerOptions; } 
    }));
  } catch(e) {}   
}

/**
 * Various listeners that do two things:
 * 1. Reposition the lockscreen on scroll/resize
 * 2. Lock background scrolling
 */
function toggleLockscreenListeners(modal: ModalData, state: boolean = false) {
  if (!wheelEvent) {
      initWheelEventVars();
  }

  if (!state) {
    modal.elements.scrollContainer.addEventListener('scroll', modal.listeners.containerScroll as any);
    modal.elements.scrollContainer.addEventListener('resize', modal.listeners.containerResize as any);
    modal.elements.lockscreen.addEventListener(wheelEvent, modal.listeners.lockscreenWheel as any, wheelEventOpts);
    modal.elements.lockscreen.addEventListener('touchstart', modal.listeners.lockscreenTouchStart as any);
    modal.elements.lockscreen.addEventListener('touchmove', modal.listeners.lockscreenTouchMove as any);
    modal.elements.lockscreen.addEventListener('keydown', modal.listeners.lockscreenKey as any, false);  
  } else {
    modal.elements.scrollContainer.removeEventListener('scroll', modal.listeners.containerScroll as any);
    modal.elements.scrollContainer.removeEventListener('resize', modal.listeners.containerResize as any);
    modal.elements.lockscreen.removeEventListener(wheelEvent, modal.listeners.lockscreenWheel as any, wheelEventOpts);
    modal.elements.lockscreen.removeEventListener('touchstart', modal.listeners.lockscreenTouchStart as any);
    modal.elements.lockscreen.removeEventListener('touchmove', modal.listeners.lockscreenTouchMove as any);
    modal.elements.lockscreen.removeEventListener('keydown', modal.listeners.lockscreenKey as any, false);  
  }
}

function containerScrollListener(modal: ModalData, event) {
  repositionLockscreen(modal);
}

function containerResizeListener(modal: ModalData, event) {
  repositionLockscreen(modal);
}

function lockscreenWheelListener(modal: ModalData, event) {
  let direction: any;
  if (event.deltaY < 0) { direction = 'up'; }
  if (event.deltaY > 0) { direction = 'down'; }
  if (event.deltaX < 0) { direction = 'left'; }
  if (event.deltaX > 0) { direction = 'right'; }

  if (!canStillScrollWithinLockscreen(event.target, modal, direction)) {
    event.preventDefault();
  }
}

function lockscreenTouchStartListener(modal: ModalData, event: TouchEvent) {
  lastTouchCoords = {x: event.touches[0].clientX, y: event.touches[0].clientY};
  touchScrollAxis = null;
}

function lockscreenTouchMoveListener (modal: ModalData, event: TouchEvent) {
  // Note: Have to track both TouchStart and TouchMove. Just comparing first to second TouchMove to determine scroll direction is
  // insufficient as Chrome doesn't allow blocking touch scrolling ONCE IT HAS STARTED. To fix this, would have to block initial TouchMove event.
  // However, that leads to problems with Firefox as scrolling will be disabled for all subsequent TouchMove events if you block the first one.
  // The way it works for both is to simply take the first coords from TouchStart instead and compare them to the TouchMove coords.
  // As TouchMove only triggers when having moved sufficiently far away from TouchStart coords, coords are guaranteed to be different
  const touchCoords = {x: event.touches[0].clientX, y: event.touches[0].clientY};
  const diffCoords = {x: touchCoords.x - lastTouchCoords.x, y: touchCoords.y - lastTouchCoords.y};

  // Additionally, lock the scroll axis to either x or y on touch scrolling. A touch scroll could otherwise be diagonal
  const axis = Math.abs(diffCoords.y) > Math.abs(diffCoords.x) ? 'y' : 'x';
  if (touchScrollAxis === null) {
    touchScrollAxis = axis;
  }

  if (axis !== touchScrollAxis) {
    event.preventDefault();
    return;
  }

  let direction: any;
  if (touchScrollAxis === 'x' && diffCoords.x >= 0) { direction = 'left'; }
  if (touchScrollAxis === 'x'  && diffCoords.x < 0) { direction = 'right'; }
  if (touchScrollAxis === 'y'  && diffCoords.y >= 0) { direction = 'up'; }
  if (touchScrollAxis === 'y'  && diffCoords.y < 0) { direction = 'down'; }

  if (!canStillScrollWithinLockscreen(event.target as HTMLElement, modal, direction)) {
    event.preventDefault();
  }
  lastTouchCoords = touchCoords;
}

function lockscreenKeyListener(modal: ModalData, event) {
  // .modal-lockscreen must have tabindex attr to be able to listen to keydown events
  if (event.target.classList.contains('comfymodal-lockscreen')) {
    const upKeys = [
      38, // up arrow
      33  // pageup
    ];
    const downKeys = [
      40,  // down arrow
      32,  // spacebar
      34   // pagedown
    ];
    const leftKeys = [
      37, // Left arrow
      36  // home
    ];
    const rightKeys = [
      39, // right arrow
      35  // end
    ];
    const allKeys = [...upKeys, ...downKeys, ...leftKeys, ...rightKeys];
    
    // Seems impossible to stop a keydown scroll once it really gets going, so just block any and all keydown scrolling
    if (allKeys.includes(event.keyCode)) {
      event.preventDefault();
    }

    /*
    let direction = null;
    if (upKeys.includes(event.keyCode)) {
      direction = 'up';
    }
    if (downKeys.includes(event.keyCode)) {
      direction = 'down';
    }
    
    if (direction) {
      if (!canStillScrollWithinLockscreen(event.target, modal, direction)) {
        event.preventDefault();
      }
    }
    */
  }
}




/**
 * By default, if there is nothing (further) to scroll in the modal, browsers will fall back to scrolling the next best thing in the DOM hierarchy, often window
 * To prevent that, have to find out if you can still scroll in any of the elements between (and including) that element and lockscreen. This function does that.
 */
function canStillScrollWithinLockscreen(element: HTMLElement, modal: ModalData, direction: 'up'|'down'|'left'|'right', safetyDistance: number = 5) {
  // Get all parent elements up to and including lockscreen
  let currentElement = element;
  const elementHierarchy = [];
  while (true) {
    elementHierarchy.push(currentElement);
    if (currentElement.nodeName === 'BODY') {
      return false;
    }
    if (currentElement.classList.contains('comfymodal-lockscreen')) {
      break;
    }
    currentElement = currentElement.parentElement;
  }

  // Figure out if you can still scroll into the desired direction in any of those elements
  for (const element of elementHierarchy) {
    const scrollPos = ['up', 'down'].includes(direction) ? element.scrollTop : element.scrollLeft;
    const maxScrollPos = ['up', 'down'].includes(direction) ? element.scrollHeight - element.clientHeight : element.scrollWidth - element.clientWidth;

    const canStillScrollInElement = 
      maxScrollPos !== 0 &&                                                                     // Element has a scrollbar to begin with
      (
        (['up', 'left'].includes(direction) && scrollPos > 0 + safetyDistance) ||               // If scrolling to top/left, can still scroll in to 0
        (['down', 'right'].includes(direction) && scrollPos < maxScrollPos - safetyDistance)    // If scrolling to down/right, can still scroll to max scroll pos
      )

    if (canStillScrollInElement) {
      return true;
    }
  }

  return false;
}