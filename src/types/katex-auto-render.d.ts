declare module 'katex/dist/contrib/auto-render' {
  export default function renderMathInElement(
    element: HTMLElement,
    options?: {
      delimiters?: { left: string; right: string; display: boolean }[];
      throwOnError?: boolean;
      macros?: any;
    }
  ): void;
}
