import { useEffect, useState } from "react";
import { initializePaddle } from "@paddle/paddle-js";
import { CheckoutEventNames } from "@paddle/paddle-js";
import { ErrorState, Skeleton, Link } from "@crawlpact/ui";

export type PayCheckoutProps = {
  transactionId: string | null;
  clientToken: string;
  environment: "sandbox" | "production";
};

type State = "loading" | "open" | "error" | "missing";

/**
 * Public, unauthenticated Paddle Checkout host for the `_ptxn` default
 * payment-link flow (payment recovery / update-payment-method emails Paddle
 * sends directly to customers). Deliberately never reads or logs
 * `transactionId` — Paddle's own overlay is the only thing that sees it
 * beyond `Checkout.open`.
 */
export function PayCheckout({ transactionId, clientToken, environment }: PayCheckoutProps) {
  const [state, setState] = useState<State>(transactionId ? "loading" : "missing");

  useEffect(() => {
    if (!transactionId) return;
    let cancelled = false;

    initializePaddle({
      token: clientToken,
      environment,
      eventCallback: (event) => {
        if (cancelled) return;
        if (event.name === CheckoutEventNames.CHECKOUT_LOADED) setState("open");
        if (
          event.name === CheckoutEventNames.CHECKOUT_ERROR ||
          event.name === CheckoutEventNames.CHECKOUT_FAILED
        ) {
          setState("error");
        }
      },
    })
      .then((paddle) => {
        if (cancelled) return;
        if (!paddle) {
          setState("error");
          return;
        }
        paddle.Checkout.open({ transactionId });
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [transactionId, clientToken, environment]);

  if (state === "missing") {
    return (
      <ErrorState
        title="No payment reference found"
        description="This page is used to complete or update a specific Paddle payment. If you followed a link from an email, please use that link again — or contact support if it isn't working."
        actions={<Link href="/">Return to CrawlPact</Link>}
      />
    );
  }

  if (state === "error") {
    return (
      <ErrorState
        title="Payment could not be loaded"
        description="We couldn't open the payment window. Please try again, or contact support if the problem continues."
        actions={<Link href="/">Return to CrawlPact</Link>}
      />
    );
  }

  return (
    <div aria-live="polite" className="flex flex-col items-center gap-3 py-12 text-center">
      <Skeleton className="h-8 w-48" aria-label="Preparing your payment" />
      <p className="text-body text-neutral-600">
        {state === "loading"
          ? "Preparing your payment…"
          : "Complete your payment in the window that opened."}
      </p>
    </div>
  );
}
