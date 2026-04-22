import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-semibold ring-offset-background transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        whole: "bg-fish-whole text-primary-foreground hover:bg-fish-whole/90",
        treated: "bg-fish-treated text-primary-foreground hover:bg-fish-treated/90",
      },
      size: {
        default: "h-12 px-5 py-3",
        sm: "h-10 rounded-xl px-4",
        lg: "h-14 rounded-2xl px-8 text-base",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, onClick, disabled, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const [busy, setBusy] = React.useState(false);
    const lastClickRef = React.useRef(0);

    const handleClick = React.useCallback(
      async (e: React.MouseEvent<HTMLButtonElement>) => {
        if (!onClick) return;
        // Debounce hard against rapid double clicks (600ms window)
        const now = Date.now();
        if (busy || now - lastClickRef.current < 600) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        lastClickRef.current = now;
        try {
          setBusy(true);
          const result = (onClick as any)(e);
          if (result && typeof (result as Promise<unknown>).then === "function") {
            await result;
          }
        } finally {
          // Small grace period so quick UI updates after the click don't allow another fire
          setTimeout(() => setBusy(false), 250);
        }
      },
      [onClick, busy]
    );

    // Default button type to "button" to avoid accidental form submits
    const resolvedType = asChild ? type : type ?? "button";

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        onClick={onClick ? handleClick : undefined}
        disabled={disabled || busy}
        {...(asChild ? {} : { type: resolvedType })}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
