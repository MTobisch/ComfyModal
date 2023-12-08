# ComfyModal
A minimal, easy-to-use modal library written in TypeScript designed to be highly adjustable without much fuss or dependencies.

## Table of contents
1. [Usage](#1-usage)
2. [Receipts](#2-receipts)
3. [Options](#3-options)
4. [Containers](#4-containers)
5. [Animations](#5-animations)
6. [Special notes](#6-special-notes)

## 1. Usage

To open a modal, you need to call the `openModal` function and give it a creation function. This creation function should simply return an `HTMLElement` that serves as the modal content:

```ts
import { openModal } from 'comfyModal';

let modalContent = document.querySelector('.modalContent');

openModal(() => modalContent);
```

Note that this library **is completely style-agnostic** for maximum flexbility, so `.modalContent` in this example should bring its own styling.

### Programmatic content

If you would rather create a modal programmatically, you can also easily do so and optionally make use of the handy `closeModal` parameter of the creation function to close the modal from within:

```ts
import { openModal } from 'comfyModal';

let createFn = closeModal => {

  // Let's create a div with the modal content
  let modalContent = document.createElement("div");
  modalContent.innerHTML = `
    <h1>Hello there!</h1>
    <p>This is the modal content. You can put literally anything here.</p>
    <button>Close me</button>
  `;

  // Add whatever styling you want for your modal
  modalContent.style.maxWidth = '400px';
  modalContent.style.backgroundColor = '#111';
  modalContent.style.padding = '10px';
  modalContent.style.borderRadius = '10px';

  // Trigger closeModal function on button click to close the modal
  modalContent.querySelector('button').addEventListener('click', () => closeModal());

  return modalContent;
};

// Open the modal
openModal(createFn);
```

## 2. Receipts

The `openModal` function always returns a `ModalReceipt` that can be used for a couple of useful things:

```ts
let modalReceipt = openModal(createFn);

// You can externally close the modal at any time via its receipt
modalReceipt.close();

// Listen to opening event (triggers after animations done)
modalReceipt.wasOpened.then(modalContent => {
  console.log('Modal was opened!');
})

// Listen to closing event (triggers after animations done)
modalReceipt.wasClosed.then(modalContent => {
  console.log('Modal was closed!');
})
```

## 3. Options

You can pass a simple object of `ComfyModalOptions` as the second parameter to the `openModal` function: 
```ts
import { closeModal } from 'comfyModal';
import { ComfyModalOptions } from "comfyModalOptions";

let options: ComfyModalOptions = { ... };

openModal(createFn, options);
```

The following options are possible:

```ts
interface ComfyModalOptions {
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
   * A callback that will be executed after running the enter animations
   */
  postEnterAnimationCallback?: ((modalContent: HTMLElement) => void)|null;

  /**
   * A callback that will be executed before running the leave animations
   */
  preLeaveAnimationCallback?: ((modalContent: HTMLElement) => void)|null;

  /**
   * A callback that will be executed after running the leave animations
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
```

## 4. Containers

The `openModal` function also accepts an optional third parameter than can be used to specify the container the lockscreen (and innner modal) is appended to. This defaults to `document.body`, but can be changed to any other `HTMLElement` in the DOM.

```ts
let modalReceipt = openModal(createFn, {}, document.querySelector('.customModalContainer');
```

Effectively, this means that the lockscreen will only fill out that specific container while the rest of your webpage is unaffected and can still be used while the modal is open. 

## 5. Animations
As can be seen in the options, you can specify different opening and closing animations for your modal. There are several ready-to-use animations available for this in the `animations` subfolder. You can change them like this:

```ts
import { closeModal } from 'comfyModal';
import { ComfyModalOptions } from "comfyModalOptions";
import { bounceEnterAnimation, bounceLeaveAnimation } from './animations/bounceAnimation';

let createFn = () => { ... };

let options: ComfyModalOptions = { 
    enterAnimation: bounceEnterAnimation(500), // Specifies the duration in ms
    leaveAnimation: bounceLeaveAnimation(300)
};

openModal(createFn, options);
```

### Custom animations

If you would like to use custom animations, you can easily create them. Animations for `ComfyModal` are simply functions that are given the modal element as a parameter and return a promise that resolves when the animation is done. 

Whatever you do to the modal to actually animate it is completely up to you and **not something this library cares about**. This is intentional to allow for maximum flexbility. You could even use your favorite third-party animation library for advanced animations, then simply resolve the promise after the animation is done.

To demonstrate how simple this is, here is a minimal example of a fade enter animation:

```ts
// Small helper function for waiting
let delay = ms => new Promise(res => setTimeout(res, ms));
let duration = 300;

let myCustomEnterAnimation = modalElement => {
  return new Promise(async (resolve, reject) => {

    // Initial styling
    modalElement.style.opacity = '0';
    await delay(1);

    // Animation
    modalElement.style.transition = `opacity ${duration}ms ease`;
    modalElement.style.opacity = '1';
    await delay(duration);

    // Cleanup    
    modalElement.style.opacity = '';
    modalElement.style.transition = '';

    resolve(true);
  });
}

let options: ComfyModalOptions = { 
    enterAnimation: myCustomEnterAnimation
};

openModal(createFn, options);
```

**Note**: Not only does the modal itself have animations, but the lockscreen in the background that contains the modal as well (`lockscreenEnterAnimation`, `lockscreenLeaveAnimation`). You may wish to adjust those animations too, especially when the lockscreen disappears faster than the modal inside it, cutting the modal animation short.

## 6. Special notes

This small library was created out of the tedium of having to create simple modal logic again and again for different projects and having to fix the same pitfalls each time.

As most of the established modal libraries didn't quite offer the degree of flexibility I needed, I decided to simply create my own and future-proof it for any upcoming project by making it both dead simple and highly adjustable.

As such, this library is mostly for personal use and I cannot guarantee advanced degrees of support for external projects. Nevertheless, I of course welcome others to try it and hope it might help you in your endeavors as well!