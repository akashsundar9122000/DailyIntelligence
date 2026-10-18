"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { completeOnboardingAction } from "@/lib/actions/reader";

export function FinishOnboarding() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="lg"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        const result = await completeOnboardingAction({});
        if (!result.ok) {
          setBusy(false);
          toast.error(result.message);
          return;
        }
        router.replace("/app");
        router.refresh();
      }}
    >
      Open my edition <ArrowRight className="size-4" aria-hidden />
    </Button>
  );
}
