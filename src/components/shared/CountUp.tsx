function format(value: number, decimals: number): string {
  return value.toLocaleString("en-PK", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Render the final value on the server with no hydration cost. */
export function CountUp({
  value,
  decimals = 0,
}: {
  value: number;
  decimals?: number;
}) {
  return <span>{format(value, decimals)}</span>;
}
