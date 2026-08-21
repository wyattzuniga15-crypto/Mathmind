/**
 * Minimal ambient types for React, Next, and KaTeX.
 *
 * WHY THIS EXISTS: the real types ship with @types/react, next, and katex (all
 * listed in package.json). This file lets `tsconfig.ui.json` type-check the
 * .tsx layer in an environment where those packages cannot be installed.
 *
 * It is intentionally permissive about DOM attributes and strict about
 * application code, so cross-module mistakes — wrong component props, bad hook
 * arguments, missing exports — are still caught.
 *
 * NOT referenced by tsconfig.json. Once dependencies are installed, the real
 * types are used and this file is ignored.
 */

declare namespace JSX {
  type Element = React.ReactElement;
  interface ElementClass {
    render(): unknown;
  }
  interface ElementAttributesProperty {
    props: unknown;
  }
  interface ElementChildrenAttribute {
    children: unknown;
  }
  interface IntrinsicAttributes {
    key?: string | number | null;
  }
  interface IntrinsicElements {
    [tag: string]: DOMProps;
  }

  /**
   * Permissive about attributes, precise about event handlers — handler
   * parameters are where real type errors hide.
   */
  interface DOMProps {
    [attribute: string]: unknown;
    key?: string | number | null;
    className?: string;
    style?: Record<string, string | number | undefined>;
    onClick?: (event: React.MouseEvent<HTMLElement>) => void;
    onMouseDown?: (event: React.MouseEvent<HTMLElement>) => void;
    onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onInput?: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onKeyDown?: (event: React.KeyboardEvent<HTMLElement>) => void;
    onKeyUp?: (event: React.KeyboardEvent<HTMLElement>) => void;
    onPaste?: (event: React.ClipboardEvent<HTMLElement>) => void;
    onBlur?: (event: React.SyntheticEvent<HTMLElement>) => void;
    onFocus?: (event: React.SyntheticEvent<HTMLElement>) => void;
    onSubmit?: (event: React.SyntheticEvent<HTMLElement>) => void;
  }
}

declare namespace React {
  type Key = string | number;
  type ReactNode = unknown;
  interface ReactElement {
    type: unknown;
    props: unknown;
    key: Key | null;
  }
  type FC<P = Record<string, never>> = (props: P) => ReactElement | null;
  type Dispatch<A> = (value: A) => void;
  type SetStateAction<S> = S | ((prev: S) => S);
  interface MutableRefObject<T> {
    current: T;
  }
  interface RefObject<T> {
    readonly current: T | null;
  }
  type DependencyList = readonly unknown[];

  interface SyntheticEvent<T = Element> {
    target: T & Record<string, unknown>;
    currentTarget: T & Record<string, unknown>;
    preventDefault(): void;
    stopPropagation(): void;
  }
  interface KeyboardEvent<T = Element> extends SyntheticEvent<T> {
    key: string;
    shiftKey: boolean;
  }
  interface ChangeEvent<T = Element> extends SyntheticEvent<T> {
    target: T & { value: string; files: FileList | null };
  }
  interface FormEvent<T = Element> extends SyntheticEvent<T> {}
  interface MouseEvent<T = Element> extends SyntheticEvent<T> {}
  interface ClipboardEvent<T = Element> extends SyntheticEvent<T> {
    clipboardData: { files: FileList };
  }
  interface SVGProps<T> extends Record<string, unknown> {
    className?: string;
    style?: Record<string, string | number | undefined>;
  }
}

declare module 'react' {
  export type ReactNode = React.ReactNode;
  export type ReactElement = React.ReactElement;
  export type FC<P = Record<string, never>> = React.FC<P>;
  export type SVGProps<T> = React.SVGProps<T>;
  export type MutableRefObject<T> = React.MutableRefObject<T>;
  export type RefObject<T> = React.RefObject<T>;
  export type Dispatch<A> = React.Dispatch<A>;
  export type SetStateAction<S> = React.SetStateAction<S>;
  export type KeyboardEvent<T = Element> = React.KeyboardEvent<T>;
  export type ChangeEvent<T = Element> = React.ChangeEvent<T>;
  export type MouseEvent<T = Element> = React.MouseEvent<T>;
  export type ClipboardEvent<T = Element> = React.ClipboardEvent<T>;

  export function useState<S>(initial: S | (() => S)): [S, React.Dispatch<React.SetStateAction<S>>];
  export function useState<S = undefined>(): [
    S | undefined,
    React.Dispatch<React.SetStateAction<S | undefined>>,
  ];
  export function useEffect(effect: () => void | (() => void), deps?: React.DependencyList): void;
  export function useLayoutEffect(effect: () => void | (() => void), deps?: React.DependencyList): void;
  export function useRef<T>(initial: T): React.MutableRefObject<T>;
  export function useRef<T>(initial: T | null): React.MutableRefObject<T | null>;
  export function useRef<T = undefined>(): React.MutableRefObject<T | undefined>;
  export function useCallback<T extends (...args: never[]) => unknown>(
    fn: T,
    deps: React.DependencyList,
  ): T;
  export function useMemo<T>(factory: () => T, deps: React.DependencyList): T;
  export function memo<P>(component: (props: P) => React.ReactElement | null): (props: P) => React.ReactElement | null;
  export const StrictMode: (props: { children?: React.ReactNode }) => React.ReactElement | null;
  export const Fragment: unique symbol;
}

declare module 'react/jsx-runtime' {
  export const jsx: unknown;
  export const jsxs: unknown;
  export const Fragment: unknown;
}

declare module 'react-dom/client' {
  export function createRoot(container: unknown): { render(node: unknown): void };
}

declare module 'katex' {
  interface KatexOptions {
    displayMode?: boolean;
    throwOnError?: boolean;
    strict?: boolean | string;
    trust?: boolean;
    output?: string;
    errorColor?: string;
  }
  const katex: { renderToString(expression: string, options?: KatexOptions): string };
  export default katex;
}

declare module 'next' {
  export interface Metadata {
    title?: string;
    description?: string;
    [key: string]: unknown;
  }
  export interface Viewport {
    width?: string;
    initialScale?: number;
    maximumScale?: number;
    themeColor?: unknown;
    [key: string]: unknown;
  }
}

declare module 'next/server' {
  export type NextRequest = Request;
}

declare module '*.css';
