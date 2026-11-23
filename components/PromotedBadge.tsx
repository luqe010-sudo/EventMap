// Disclosure label for paid placements (events.is_featured).
export default function PromotedBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`promotedBadge ${className}`.trim()} title="Płatne wyróżnienie organizatora">
      Promowane
    </span>
  );
}
