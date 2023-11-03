export const noAnimation: (element: HTMLElement) => Promise<boolean> = (element: HTMLElement) => {
  return new Promise((resolve, reject) => {
    resolve(true);
  });
}