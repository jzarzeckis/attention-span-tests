/* eslint-disable @typescript-eslint/no-explicit-any */
// Augment Bun's test matchers with @testing-library/jest-dom matchers
declare module "bun:test" {
  interface Matchers<T> {
    toBeInTheDocument(): void;
    toBeVisible(): void;
    toBeEmptyDOMElement(): void;
    toBeDisabled(): void;
    toBeEnabled(): void;
    toBeInvalid(): void;
    toBeRequired(): void;
    toBeValid(): void;
    toContainElement(element: HTMLElement | SVGElement | null): void;
    toContainHTML(htmlText: string): void;
    toHaveAccessibleDescription(description?: string | RegExp): void;
    toHaveAccessibleName(name?: string | RegExp): void;
    toHaveAttribute(attr: string, value?: any): void;
    toHaveClass(...classNames: string[]): void;
    toHaveFocus(): void;
    toHaveFormValues(expectedValues: Record<string, any>): void;
    toHaveStyle(css: string | Record<string, any>): void;
    toHaveTextContent(text: string | RegExp, options?: { normalizeWhitespace: boolean }): void;
    toHaveValue(value?: string | string[] | number | null): void;
    toHaveDisplayValue(value?: string | RegExp | Array<string | RegExp>): void;
    toBeChecked(): void;
    toBePartiallyChecked(): void;
    toHaveErrorMessage(text?: string | RegExp): void;
  }
}
