import { Spinner } from "@/components/ui/bits";

export default function Loading() {
  return (
    <div className="flex justify-center py-20 text-parchment">
      <Spinner label="Si sfogliano i registri…" />
    </div>
  );
}
