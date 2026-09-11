import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap",
  {
    variants: {
      variant: {
        neutral: "bg-navy-50 text-navy-600 ring-1 ring-navy-100 ring-inset",
        accent:
          "bg-accent-600/10 text-accent-700 ring-1 ring-accent-600/20 ring-inset",
        stock:
          "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 ring-inset",
        inverted: "bg-white/10 text-silver-100 ring-1 ring-white/15 ring-inset",
      },
      size: {
        sm: "px-2.5 py-1 text-[0.6875rem] tracking-[0.06em]",
        md: "px-3 py-1.5 text-xs",
      },
    },
    defaultVariants: { variant: "neutral", size: "sm" },
  },
);

export function Badge({
  className,
  variant,
  size,
  ...props
}: React.ComponentPropsWithoutRef<"span"> &
  VariantProps<typeof badgeVariants>) {
  return (
    <span
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}
