import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Themed radio group (same API shape as shadcn's, without adding a dependency). One tab stop for
 * the whole group (roving tabindex); Arrow keys move and select, Home/End jump to the ends.
 */
interface RadioGroupContextValue {
  value: string | undefined;
  onValueChange: (value: string) => void;
  name?: string;
  disabled?: boolean;
}

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(null);

export interface RadioGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange" | "defaultValue"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  disabled?: boolean;
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, value, defaultValue, onValueChange, name, disabled, onKeyDown, ...props }, ref) => {
    const [inner, setInner] = React.useState(defaultValue);
    const current = value ?? inner;
    const select = React.useCallback(
      (next: string) => {
        if (value === undefined) setInner(next);
        onValueChange?.(next);
      },
      [value, onValueChange],
    );

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) return;
      const radios = Array.from(
        event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]:not([disabled])'),
      );
      const index = radios.findIndex((radio) => radio === document.activeElement);
      if (index === -1) return;
      let nextIndex: number;
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          nextIndex = (index + 1) % radios.length;
          break;
        case "ArrowLeft":
        case "ArrowUp":
          nextIndex = (index - 1 + radios.length) % radios.length;
          break;
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = radios.length - 1;
          break;
        default:
          return;
      }
      event.preventDefault();
      const target = radios[nextIndex]!;
      target.focus();
      const next = target.getAttribute("data-value");
      if (next !== null) select(next);
    };

    return (
      <RadioGroupContext.Provider value={{ value: current, onValueChange: select, name, disabled }}>
        <div ref={ref} role="radiogroup" className={cn("grid gap-2", className)} onKeyDown={handleKeyDown} {...props} />
      </RadioGroupContext.Provider>
    );
  },
);
RadioGroup.displayName = "RadioGroup";

export interface RadioGroupItemProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value"> {
  value: string;
}

/**
 * One radio. Without children it draws the themed circle; with children (e.g. a star) the caller
 * owns the look and gets `data-state="checked" | "unchecked"` to style against.
 */
const RadioGroupItem = React.forwardRef<HTMLButtonElement, RadioGroupItemProps>(
  ({ className, value, disabled, children, onClick, ...props }, forwardedRef) => {
    const group = React.useContext(RadioGroupContext);
    if (!group) throw new Error("RadioGroupItem must be rendered inside a RadioGroup");
    const innerRef = React.useRef<HTMLButtonElement | null>(null);
    const checked = group.value === value;
    const isDisabled = disabled || group.disabled;

    // The tab stop is the checked radio; with nothing checked it is the first enabled one.
    const [isFirst, setIsFirst] = React.useState(false);
    React.useLayoutEffect(() => {
      const el = innerRef.current;
      const first = el?.closest('[role="radiogroup"]')?.querySelector('[role="radio"]:not([disabled])');
      setIsFirst(first === el);
    }, [value, isDisabled, group.value]);
    const tabbable = checked || (!group.value && isFirst);

    return (
      <button
        {...props}
        ref={(node) => {
          innerRef.current = node;
          if (typeof forwardedRef === "function") forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        type="button"
        role="radio"
        aria-checked={checked}
        data-state={checked ? "checked" : "unchecked"}
        data-value={value}
        disabled={isDisabled}
        tabIndex={tabbable ? 0 : -1}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) group.onValueChange(value);
        }}
        className={cn(
          children === undefined
            ? "relative flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-primary text-primary " +
                "after:absolute after:-inset-1.5 after:content-[''] " +
                "data-[state=checked]:border-2 disabled:cursor-not-allowed disabled:opacity-50"
            : "",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          className,
        )}
      >
        {children === undefined ? (
          checked ? <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" /> : null
        ) : (
          children
        )}
      </button>
    );
  },
);
RadioGroupItem.displayName = "RadioGroupItem";

export { RadioGroup, RadioGroupItem };
