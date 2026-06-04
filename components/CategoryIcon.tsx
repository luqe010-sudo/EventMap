import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";

type CategoryIconProps = {
  iconName?: string | null;
  className?: string;
  size?: number;
  color?: string;
};

// Build a case-insensitive map of Lucide icon names for backward compatibility
const LOWERCASE_TO_PASCAL_MAP = new Map<string, string>();
Object.keys(LucideIcons).forEach((key) => {
  LOWERCASE_TO_PASCAL_MAP.set(key.toLowerCase(), key);
});

export default function CategoryIcon({
  iconName,
  className,
  size = 18,
  color
}: CategoryIconProps) {
  let resolvedKey: string | undefined;
  if (iconName) {
    // Try exact match first
    if (iconName in LucideIcons) {
      resolvedKey = iconName;
    } else {
      // Try case-insensitive match
      resolvedKey = LOWERCASE_TO_PASCAL_MAP.get(iconName.toLowerCase());
    }
  }

  const Icon = resolvedKey
    ? (LucideIcons[resolvedKey as keyof typeof LucideIcons] as LucideIcon)
    : LucideIcons.CircleHelp;

  return <Icon className={className} size={size} style={color ? { color } : undefined} />;
}

