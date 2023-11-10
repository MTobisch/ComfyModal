import { ComfyModalOptions, resolvePartialOptions } from "./comfyModalOptions";

interface ModalData {
  id: number;
  options: ComfyModalOptions;
  modalClosedPromiseResolve?: (value: HTMLElement | PromiseLike<HTMLElement>) => void;
  // Some state
  outerScrollPosition?: number;
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

export class ComfyModal {
  modalCounter: number = 0;
  openedModals: {[key: number]: ModalData} = {};
  // Scroll lock var
  wheelEvent: any;
  wheelEventOpts: any;
  lastTouchCoords: {x: number, y: number} = null; 

  constructor() {
    this.initWheelEventVars();
  }

  /**
   * Creates a modal with any content in a special lockscreen over the normal content
   *
   * @param createFunction - A function that returns the modal html. Is given a closeHandler fn as a parameter that can (for example) be used in click events within the modal to close it
   * @param options - A FlexModalOptions object that can be used to customize the behaviour of the modal
   * @param container - What container the modal lockscreen should be appended into. Defaults to the body element.
   */
  open(createFunction: (closeHandler: () => void) => HTMLElement, options: ComfyModalOptions = {}, container: HTMLElement = document.body): ModalReceipt {
    for (const openedModal of Object.values(this.openedModals)) {
      if (openedModal.elements.container === container) {
        console.error('A modal for this container is already opened. Make sure to close it before opening another one.')
        return;
      }
    }

    const id = this.modalCounter++;
    const customCloseFn = (() => this.close(id)).bind(this);
    const modal: ModalData = {
      id: id,       
      options: resolvePartialOptions(options),
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
      containerScroll: this.containerScrollListener.bind(this, modal),
      containerResize: this.containerResizeListener.bind(this, modal),
      lockscreenWheel: this.lockscreenWheelListener.bind(this, modal),
      lockscreenTouchStart: this.lockscreenTouchStartListener.bind(this, modal),
      lockscreenTouchMove: this.lockscreenTouchMoveListener.bind(this, modal),
      lockscreenKey: this.lockscreenKeyListener.bind(this, modal)
    }

    if (Object.values(this.openedModals).map(modalData => modalData.elements.modalContent).includes(modal.elements.modalContent)) {
      console.error("A modal with this exact HTMLElement as content is already opened.");
      return;
    }

    this.openedModals[id] = modal;

    // Create lockscreen
    this.createLockscreen(modal);

    // Insert modal content into wrapper that can then be animated
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `<div class="comfymodal-wrapper"></div>`;
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
        this.closeModal(modal);
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

  close(id: number) {
    const modalToClose = Object.values(this.openedModals).find(openedModal => openedModal.id === id);
    if (!modalToClose) {
      // Modal not found, cancel
      return;
    }

    this.closeModal(modalToClose);
  }

  closeAll() {
    for (const modalToClose of Object.values(this.openedModals)) {
      this.closeModal(modalToClose);
    }
  }

  /**
   *  Putting this in its own function so multiple modals can be closed in parallel
   */
  private async closeModal(modal: ModalData) {
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
    this.removeLockscreen(modal);

    // Remove modal from this.openedModals
    delete this.openedModals[modal.id!];

    // Return detached modal when all is done
    modal.modalClosedPromiseResolve!(modal.elements.modalContent);
  }

  // Lockscreen management
  // ------------------------------------------------------

  async createLockscreen(modal: ModalData) {
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
          background-color: ${modal.options?.lockscreenColor};
          overflow-y: scroll;
          z-index: 1000;
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
            padding-left: ${modal.options.paddingHorizontal}px; 
            padding-right: ${modal.options.paddingHorizontal}px;
            padding-top: ${modal.options.paddingVertical}px;
            padding-bottom: ${modal.options.paddingVertical}px;
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
    this.repositionLockscreen(modal);

    // Append lockscreen
    modal.elements.container?.append(modal.elements.lockscreen);

    // Close on lockscreen click
    if (modal.options.closeOnLockscreenClick) {
      modal.elements.lockscreen.addEventListener('click', event => {
        // Only close on direct clicks on lockscreen, not modal itself
        if ((event.target as HTMLElement).classList.contains('comfymodal-lockscreen-padding')) {
          this.close(modal.id);
        }
      });
    }

    // Attach event listeners
    this.toggleLockscreenListeners(modal, false);
  }

  repositionLockscreen(modal: ModalData) {
    modal.outerScrollPosition = modal.elements.container === document.body ? (modal.elements.scrollContainer as any).scrollY : modal.elements.scrollContainer.scrollTop; 
    modal.elements.lockscreen.style.top = modal.outerScrollPosition + 'px';
  }

  removeLockscreen(modal: ModalData) {
    this.toggleLockscreenListeners(modal, true);
    modal.elements.container?.removeChild(modal.elements.lockscreen!);
    modal.elements.lockscreen.remove();
  }

  // Lockscreen listeners
  // ------------------------------------------------------

  initWheelEventVars() {
    // Modern Chrome requires { passive: false } when adding event
    this.wheelEvent = 'onwheel' in document.createElement('div') ? 'wheel' : 'mousewheel';
    this.wheelEventOpts = false;
    try {
      window.addEventListener("test", null, Object.defineProperty({}, 'passive', {
        get: function () { this.wheelEventOpts = { passive: false } as EventListenerOptions; } 
      }));
    } catch(e) {}   
  }

  /**
   * Various listeners that do two things:
   * 1. Reposition the lockscreen on scroll/resize
   * 2. Lock background scrolling
   */
  toggleLockscreenListeners(modal: ModalData, state: boolean = false) {
    if (!state) {
      modal.elements.scrollContainer.addEventListener('scroll', modal.listeners.containerScroll as any);
      modal.elements.scrollContainer.addEventListener('resize', modal.listeners.containerResize as any);
      modal.elements.lockscreen.addEventListener(this.wheelEvent, modal.listeners.lockscreenWheel as any, this.wheelEventOpts);
      modal.elements.lockscreen.addEventListener('touchstart', modal.listeners.lockscreenTouchStart as any);
      modal.elements.lockscreen.addEventListener('touchmove', modal.listeners.lockscreenTouchMove as any);
      modal.elements.lockscreen.addEventListener('keydown', modal.listeners.lockscreenKey as any, false);  
    } else {
      modal.elements.scrollContainer.removeEventListener('scroll', modal.listeners.containerScroll as any);
      modal.elements.scrollContainer.removeEventListener('resize', modal.listeners.containerResize as any);
      modal.elements.lockscreen.removeEventListener(this.wheelEvent, modal.listeners.lockscreenWheel as any, this.wheelEventOpts);
      modal.elements.lockscreen.removeEventListener('touchstart', modal.listeners.lockscreenTouchStart as any);
      modal.elements.lockscreen.removeEventListener('touchmove', modal.listeners.lockscreenTouchMove as any);
      modal.elements.lockscreen.removeEventListener('keydown', modal.listeners.lockscreenKey as any, false);  
    }
  }

  containerScrollListener(modal: ModalData, event) {
    this.repositionLockscreen(modal);
  }

  containerResizeListener(modal: ModalData, event) {
    this.repositionLockscreen(modal);
  }

  lockscreenWheelListener(modal: ModalData, event) {
    const direction = (event as any).deltaY < 0 ? 'up' : 'down';
    this.preventEventIfBackgroundScroll(event, modal, direction);
  }

  lockscreenTouchStartListener(modal: ModalData, event: TouchEvent) {
    this.lastTouchCoords = {x: event.touches[0].clientX, y: event.touches[0].clientY};
  }

  lockscreenTouchMoveListener (modal: ModalData, event: TouchEvent) {
    // Note: Have to track both TouchStart and TouchMove. Just comparing first to second TouchMove to determine scroll direction is
    // insufficient as Chrome doesn't allow blocking touch scrolling ONCE IT HAS STARTED. To fix this, would have to block initial TouchMove event.
    // However, that leads to problems with Firefox as scrolling will be disabled for all subsequent TouchMove events if you block the first one.
    // The way it works for both is to simply take the first coords from TouchStart instead and compare them to the TouchMove coords.
    // As TouchMove only triggers when having moved sufficiently far away from TouchStart coords, coords are guaranteed to be different
    const touchCoords = {x: event.touches[0].clientX, y: event.touches[0].clientY};
    let direction: 'up'|'down' = touchCoords.y > this.lastTouchCoords.y ? 'up' : 'down';
    this.preventEventIfBackgroundScroll(event, modal, direction);
    this.lastTouchCoords = touchCoords;
  }

  lockscreenKeyListener(modal: ModalData, event) {
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
        this.preventEventIfBackgroundScroll(event, modal, direction);
      }
      */
    }
  }

  preventEventIfBackgroundScroll(event, modal: ModalData, direction: 'up'|'down') {
    const scrollTop = modal.elements.lockscreen.scrollTop;
    const maxScrollTop = modal.elements.lockscreen.scrollHeight - modal.elements.lockscreen.clientHeight;
    const safetyDistance = 5;

    // By default, if there is nothing (further) to scroll in the modal, browsers will fall back to scrolling the next best thing in the DOM hierarchy, often window
    // This is some logic to prevent that. If a modal is open, don't scroll anything in the background!
    const scrollDisallowed = 
      maxScrollTop === 0 ||                                                 // Always prevent scroll if nothing to scroll in modal
      (direction === 'up' && scrollTop <= 0 + safetyDistance) ||            // Don't scroll further if modal is scrolled all the way to top
      (direction === 'down' && scrollTop >= maxScrollTop - safetyDistance)  // Don't scroll further if modal is scrolled all the way to bottom
    
    // console.log(direction, scrollTop, maxScrollTop, scrollDisallowed ? 'block' : 'allow');
    if (scrollDisallowed) {
      event.preventDefault();
    }
  }
}

