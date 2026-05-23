import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
};

interface AvatarProps {
  src?: string | null;
  firstName: string;
  lastName: string;
  size?: keyof typeof sizeClasses;
  className?: string;
}

export default function Avatar({ src, firstName, lastName, size = "md", className }: AvatarProps) {
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();

  if (src) {
    return (
      <img
        src={src}
        alt={`${firstName} ${lastName}`}
        className={cn("rounded-full object-cover", sizeClasses[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)] font-medium",
        sizeClasses[size],
        className
      )}
    >
      {initials}
    </div>
  );
}
