import {
  Eye,
  FlaskConical,
  Glasses,
  SprayCan,
  Stethoscope,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { IconName } from "@/types/catalogue";

/** Keeps the data layer free of React imports — it stores a name, not a component. */
const REGISTRY: Record<IconName, LucideIcon> = {
  Eye,
  Glasses,
  SprayCan,
  FlaskConical,
  Wrench,
  Stethoscope,
};

export function CategoryIcon({
  name,
  className,
}: {
  name: IconName;
  className?: string;
}) {
  const Icon = REGISTRY[name];
  return <Icon className={className} aria-hidden />;
}
