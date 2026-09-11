import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/btn relative inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-[background-color,color,box-shadow,transform] duration-200 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:
          "bg-accent-600 text-white shadow-[0_8px_24px_-8px_rgb(37_99_235/0.7)] hover:bg-accent-700",
        navy: "bg-navy-700 text-white hover:bg-navy-600",
        outline:
          "border border-navy-200 bg-white/70 text-navy-700 hover:border-navy-300 hover:bg-white",
        ghost: "text-navy-600 hover:bg-navy-50",
        inverted:
          "bg-white text-navy-700 hover:bg-mist-100 shadow-[0_8px_24px_-10px_rgb(0_0_0/0.5)]",
        outlineInverted:
          "border border-white/25 text-white hover:border-white/50 hover:bg-white/10",
      },
      size: {
        sm: "h-9 px-4 text-[0.8125rem]",
        md: "h-11 px-6 text-sm",
        lg: "h-13 px-8 text-[0.9375rem]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonBaseProps = VariantProps<typeof buttonVariants> & {
  className?: string;
  children: React.ReactNode;
};

export type ButtonProps = ButtonBaseProps &
  Omit<React.ComponentPropsWithoutRef<"button">, "children" | "className">;

export function Button({
  className,
  variant,
  size,
  ...props
}: ButtonProps): React.ReactElement {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export type ButtonLinkProps = ButtonBaseProps &
  Omit<React.ComponentPropsWithoutRef<typeof Link>, "children" | "className">;

export function ButtonLink({
  className,
  variant,
  size,
  ...props
}: ButtonLinkProps): React.ReactElement {
  return (
    <Link
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
