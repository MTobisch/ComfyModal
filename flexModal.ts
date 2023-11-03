import { FlexModalOptions, resolvePartialOptions } from "./flexModalOptions";

interface ModalData {
  id?: number;
  container?: HTMLElement;
  lockscreenElement?: HTMLElement;
  lockscreenGridElement?: HTMLElement;
  modalElement?: HTMLElement;
  options?: FlexModalOptions;
  modalClosedPromiseResolve?: (value: HTMLElement | PromiseLike<HTMLElement>) => void;
  scrollTop?: number;
  preventScrollHandler?: (event: Event) => any;
  scrollContainer?: HTMLElement;
  // Some state
  isOpened?: boolean;
  isClosing?: boolean;
}

export class FlexModal {
  modalCounter: number = 0;
  openedModals: {[key: number]: ModalData} = {};

  constructor() {
  }

  /**
   * Creates a modal with any content in a special lockscreen over the normal content
   *
   * @param createFunction - A function that returns the modal html. Is given a closeHandler fn as a parameter that can (for example) be used in click events within the modal to close it
   * @param options - A FlexModalOptions object that can be used to customize the behaviour of the modal
   * @param container - What container the modal lockscreen should be appended into. Defaults to the body element.
   */
  async open(createFunction: (closeHandler: () => void) => HTMLElement, options: FlexModalOptions = {}, container: HTMLElement = document.body) {
    for (const openedModal of Object.values(this.openedModals)) {
      if (openedModal.container === container) {
        console.error('A modal for this container is already opened. Make sure to close it before opening another one.')
        return;
      }
    }

    const id = this.modalCounter++;
    const modal: ModalData = {id: id, container: container, isOpened: false, isClosing: false};
    this.openedModals[id] = modal;

    // Assemble options
    modal.options = resolvePartialOptions(options);

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

    // Remove scroll lock immediately
    modal.scrollContainer?.removeEventListener('scroll', modal.preventScrollHandler!);

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

  async createLockscreen(modal: ModalData) {
    // Create lockscreen (invisible at first)
    // This hides lockscreen scrollbar beneath container scrollbar, so no horizontal content shift
    const scrollBarWidth = window.innerWidth - document.body.clientWidth;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `<div 
        class='modal-lockscreen' 
        style='
          position: fixed; 
          top: 0px; 
          left: 0px; 
          width: 100%; 
          height: 100%; 
          box-sizing: content-box;
          padding-right: ${scrollBarWidth}px;
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

    // Append lockscreen
    modal.container?.append(modal.lockscreenElement);

    // Close on lockscreen click
    modal.lockscreenElement.addEventListener('click', event => {
      // Only close on direct clicks on lockscreen, not modal itself
      if ((event.target as HTMLElement).classList.contains('modal-wrapper')) {
        this.close();
      }
    });

    // Prevent container scrolling
    modal.preventScrollHandler = this.createPreventScrollHandler(modal);
    modal.scrollContainer = (modal.container === document.body ? window : modal.container) as HTMLElement; // If container is body, have to listen to window scroll instead
    modal.scrollTop = modal.container === document.body ? (modal.scrollContainer as any).scrollY : modal.scrollContainer.scrollTop; 
    modal.scrollContainer.addEventListener('scroll', modal.preventScrollHandler);
  }

  removeLockscreen(modal: ModalData) {
    // Unlocking scroll again is also done in close(), but just to be sure
    modal.scrollContainer?.removeEventListener('scroll', modal.preventScrollHandler!);
    modal.container?.removeChild(modal.lockscreenElement!);
  }

  createPreventScrollHandler(modal: ModalData): (event: Event) => any {
    return (event) => {
      event.preventDefault();
      event.stopPropagation();

      const scrollTop = modal.container === document.body ? (modal.scrollContainer as any).scrollY : modal.scrollContainer!.scrollTop; // If container is body, scrollContainer is window
      if (scrollTop !== modal.scrollTop) {
        // Prevent scrolling when lockscreen is active
        modal.scrollContainer!.scrollTo(0, modal.scrollTop!);
      }

      return false
    };
  }

}