import { ComfyModalOptions, resolvePartialOptions } from "./comfyModalOptions";

interface ModalData {
  id?: number;
  container?: HTMLElement;
  scrollContainer?: HTMLElement;
  scrollContainerPosition?: number;
  lockscreenElement?: HTMLElement;
  lockscreenGridElement?: HTMLElement;
  modalElement?: HTMLElement;
  options?: ComfyModalOptions;
  modalClosedPromiseResolve?: (value: HTMLElement | PromiseLike<HTMLElement>) => void;
  // Some state
  isOpened?: boolean;
  isClosing?: boolean;
}

export class ComfyModal {
  modalCounter: number = 0;
  openedModals: {[key: number]: ModalData} = {};
  boundScrollEventWheelListener: EventListener = this.scrollEventWheelListener.bind(this);
  boundScrollEventTouchStartListener: EventListener = this.scrollEventTouchStartListener.bind(this);
  boundScrollEventTouchMoveListener: EventListener = this.scrollEventTouchMoveListener.bind(this);
  boundScrollEventKeyListener: EventListener = this.scrollEventKeyListener.bind(this);
  // Scroll lock var
  wheelEvent: any;
  wheelEventOpts: any;
  lastTouchCoords: {x: number, y: number} = null; 

  constructor() {
    this.initWheelEventVars();
    this.initRepositionListeners();
  }

  /**
   * Creates a modal with any content in a special lockscreen over the normal content
   *
   * @param createFunction - A function that returns the modal html. Is given a closeHandler fn as a parameter that can (for example) be used in click events within the modal to close it
   * @param options - A FlexModalOptions object that can be used to customize the behaviour of the modal
   * @param container - What container the modal lockscreen should be appended into. Defaults to the body element.
   */
  async open(createFunction: (closeHandler: () => void) => HTMLElement, options: ComfyModalOptions = {}, container: HTMLElement = document.body) {
    for (const openedModal of Object.values(this.openedModals)) {
      if (openedModal.container === container) {
        console.error('A modal for this container is already opened. Make sure to close it before opening another one.')
        return;
      }
    }

    const id = this.modalCounter++;
    const modal: ModalData = {
      id: id, 
      container: container, 
      scrollContainer: (container === document.body ? window : container) as HTMLElement, // If container is body, scroll data can be found in window
      options: resolvePartialOptions(options),
      isOpened: false, 
      isClosing: false
    };
    this.openedModals[id] = modal;

    // Create lockscreen
    this.createLockscreen(modal);

    // Wrap modal in container with some necessary styling
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `<div 
        class="modal-wrapper" 
        style="
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
        "
      >     
    </div>`;
    modal.modalElement = wrapper.childNodes[0] as HTMLElement;

    // Insert user content into modal
    const customCloseFn = (() => this.close(id)).bind(this);
    const content = createFunction(customCloseFn);
    modal.modalElement.append(content);

    // Insert modal into lockscreen
    modal.lockscreenGridElement!.append(modal.modalElement);

    // Run animations of lockscreen and modal in parallel or sequential
    if (modal.options.preEnterAnimationCallback) { modal.options.preEnterAnimationCallback(modal.modalElement, modal.lockscreenElement!); }
    if (modal.options.runEntryAnimationsInParallel) {
      const lockscreenAnimationFinished = modal.options.lockscreenEnterAnimation!(modal.lockscreenElement!);
      const modalAnimationFinished = modal.options.modalEnterAnimation!(modal.modalElement);
      await Promise.all([
        lockscreenAnimationFinished,
        modalAnimationFinished
      ]);
    } else {
      await modal.options.lockscreenEnterAnimation!(modal.lockscreenElement!);
      await modal.options.modalEnterAnimation!(modal.modalElement);
    }
    if (modal.options.postEnterAnimationCallback) { modal.options.postEnterAnimationCallback(modal.modalElement, modal.lockscreenElement!); }

    // Resolve main promise to notify caller that modal is ready
    const modalClosedPromise = new Promise((resolve, reject) => {
      modal.modalClosedPromiseResolve = resolve;
    });

    modal.isOpened = true;
    
    return modalClosedPromise;
  }

  close(id: number|null = null) {
    let modalsToClose: ModalData[] = [];

    if (id === null) {
      // Close all of them
      modalsToClose = Object.values(this.openedModals);
    } else {
      const modalToClose = Object.values(this.openedModals).find(openedModal => openedModal.id === id && openedModal.isOpened && !openedModal.isClosing);
      if (modalToClose) {
        // Close a single modal
        modalsToClose.push(modalToClose);
      } else {
        // Modal not found, cancel
        return;
      }
    }

    for (const modalToClose of modalsToClose) {
      this.closeModal(modalToClose);
    }
  }

  /**
   *  Putting this in its own function so multiple modals can be closed in parallel
   */
  private async closeModal(modal: ModalData) {
    modal.isClosing = true;

    // Run animations of lockscreen and modal in parallel or sequential
    if (modal.options?.preLeaveAnimationCallback) { modal.options.preLeaveAnimationCallback(modal.modalElement!, modal.lockscreenElement!); }
    if (modal.options?.runLeaveAnimationsInParallel) {
      const modalAnimationFinished = modal.options?.modalLeaveAnimation!(modal.modalElement!);
      const lockscreenAnimationFinished = modal.options?.lockscreenLeaveAnimation!(modal.lockscreenElement!);
      await Promise.all([
        lockscreenAnimationFinished,
        modalAnimationFinished
      ]);
    } else {
      await modal.options?.modalLeaveAnimation!(modal.modalElement!);
      await modal.options?.lockscreenLeaveAnimation!(modal.lockscreenElement!);
    }
    if (modal.options?.postLeaveAnimationCallback) { modal.options.postLeaveAnimationCallback(modal.modalElement!, modal.lockscreenElement!); }

    // Remove lockscreen
    this.removeLockscreen(modal);

    // Remove modal from this.openedModals
    delete this.openedModals[modal.id!];

    // Return detached modal when all is done
    modal.modalClosedPromiseResolve!(modal.modalElement!.children[0] as HTMLElement);
  }

  // Lockscreen management
  // ------------------------------------------------------

  // Any time the global scroll position or the viewport changes, reposition lockscreen
  initRepositionListeners() {
    window.addEventListener('scroll', () => {
      for (const modal of Object.values(this.openedModals)) {
        this.repositionLockscreen(modal);
      }
    });

    window.addEventListener('resize', () => {
      for (const modal of Object.values(this.openedModals)) {
        this.repositionLockscreen(modal);
      }
    });
  }

  async createLockscreen(modal: ModalData) {
    // Create lockscreen (invisible at first)
    // This hides lockscreen scrollbar beneath container scrollbar, so no horizontal content shift
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `<div 
        class='modal-lockscreen' 
        tabindex="0"
        style='
          position: absolute; 
          top: 0px; 
          left: 0px; 
          width: 100%; 
          height: 100%; 
          background-color: ${modal.options?.lockscreenColor};
          overflow-y: scroll;
          z-index: 1000;
        '
      >
        <div 
          class='modal-lockscreen-grid'
          style='
            display: grid;
            grid-template-columns: 100%;
            width: 100%;
            height: 100%;
            box-sizing: border-box;
          '
        ></div>
      </div>`;

    modal.lockscreenElement = wrapper.childNodes[0] as HTMLElement;
    modal.lockscreenGridElement = modal.lockscreenElement.querySelector('.modal-lockscreen-grid') as HTMLElement;

    // Make sure container will contain absolutely positioned child
    const computedStyles = getComputedStyle(modal.container);
    if (computedStyles.position === 'static') {
      modal.container.style.position = 'relative';
    }

    // Position lockscreen according to current container scroll position
    this.repositionLockscreen(modal);

    // Append lockscreen
    modal.container?.append(modal.lockscreenElement);

    // Close on lockscreen click
    modal.lockscreenElement.addEventListener('click', event => {
      // Only close on direct clicks on lockscreen, not modal itself
      if ((event.target as HTMLElement).classList.contains('modal-wrapper')) {
        this.close();
      }
    });

    // Lock scrolling in parent container
    this.setBackgroundScrolling(modal, false);
  }

  repositionLockscreen(modal: ModalData) {
    modal.scrollContainerPosition = modal.container === document.body ? (modal.scrollContainer as any).scrollY : modal.scrollContainer.scrollTop; 
    modal.lockscreenElement.style.top = modal.scrollContainerPosition + 'px';
  }

  removeLockscreen(modal: ModalData) {
    this.setBackgroundScrolling(modal, true);
    modal.container?.removeChild(modal.lockscreenElement!);
    modal.lockscreenElement.remove();
  }

  // Scroll locking
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

  setBackgroundScrolling(modal: ModalData, state: boolean = false) {
    if (!state) {
      // Listen to any kind of interaction that would trigger a scroll
      modal.lockscreenElement.addEventListener(this.wheelEvent, this.boundScrollEventWheelListener, this.wheelEventOpts);
      modal.lockscreenElement.addEventListener('touchstart', this.boundScrollEventTouchStartListener, this.wheelEventOpts);
      modal.lockscreenElement.addEventListener('touchmove', this.boundScrollEventTouchMoveListener, this.wheelEventOpts);
      modal.lockscreenElement.addEventListener('keydown', this.boundScrollEventKeyListener, false);  
    } else {
      modal.lockscreenElement.removeEventListener(this.wheelEvent, this.boundScrollEventWheelListener, this.wheelEventOpts);
      modal.lockscreenElement.removeEventListener('touchstart', this.boundScrollEventTouchStartListener, this.wheelEventOpts);
      modal.lockscreenElement.removeEventListener('touchmove', this.boundScrollEventTouchMoveListener, this.wheelEventOpts);
      modal.lockscreenElement.removeEventListener('keydown', this.boundScrollEventKeyListener, false);
    }
  }

  scrollEventWheelListener(event) {
    const direction = (event as any).deltaY < 0 ? 'up' : 'down';
    this.preventEventIfBackgroundScroll(event, direction);
  }

  scrollEventTouchStartListener(event: TouchEvent) {
    this.lastTouchCoords = {x: event.touches[0].clientX, y: event.touches[0].clientY};
  }

  scrollEventTouchMoveListener (event: TouchEvent) {
    // Note: Have to track both TouchStart and TouchMove. Just comparing first to second TouchMove to determine scroll direction is
    // insufficient as Chrome doesn't allow blocking touch scrolling ONCE IT HAS STARTED. To fix this, would have to block initial TouchMove event.
    // However, that leads to problems with Firefox as scrolling will be disabled for all subsequent TouchMove events if you block the first one.
    // The way it works for both is to simply take the first coords from TouchStart instead and compare them to the TouchMove coords.
    // As TouchMove only triggers when having moved sufficiently far away from TouchStart coords, coords are guaranteed to be different
    const touchCoords = {x: event.touches[0].clientX, y: event.touches[0].clientY};
    let direction: 'up'|'down' = touchCoords.y > this.lastTouchCoords.y ? 'up' : 'down';
    this.preventEventIfBackgroundScroll(event, direction);
    this.lastTouchCoords = touchCoords;
  }

  scrollEventKeyListener(event) {
    // .modal-lockscreen must have tabindex attr to be able to listen to keydown events
    if (event.target.classList.contains('modal-lockscreen')) {
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
        this.preventEventIfBackgroundScroll(event, direction);
      }
      */
    }
  }

  preventEventIfBackgroundScroll(event, direction: 'up'|'down') {
    const lockscreenElement = event.target.closest('.modal-lockscreen');
    const scrollTop = lockscreenElement.scrollTop;
    const maxScrollTop = lockscreenElement.scrollHeight - lockscreenElement.clientHeight;
    const safetyDistance = 5;

    // By default, if there is nothing (further) to scroll in the modal, browsers will fall back to scrolling the next best thing in the DOM hierarchy, often window
    // This is some logic to prevent that. If a modal is open, don't scroll anything in the background!
    const scrollDisallowed = 
      maxScrollTop === 0 ||                                                 // Always prevent scroll if nothing to scroll in modal
      (direction === 'up' && scrollTop <= 0 + safetyDistance) ||            // Don't scroll further if modal is scrolled all the way to top
      (direction === 'down' && scrollTop >= maxScrollTop - safetyDistance)  // Don't scroll further if modal is scrolled all the way to bottom
    
    //console.log(direction, scrollTop, maxScrollTop, scrollDisallowed ? 'block' : 'allow');
    if (scrollDisallowed) {
      event.preventDefault();
    }
  }
}

