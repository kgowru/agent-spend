import { ProofMetrics } from "./ProofMetrics";

/**
 * The app's thesis in one glance: one number is arithmetic, the other is a
 * model with a wide range. The figures shown are illustrative — the real ones
 * come from the visitor's own logs. The cards themselves (count-up numbers and
 * usage bars) live in the client `ProofMetrics` island.
 */
export function ProofPanel() {
  return (
    <section
      aria-labelledby="proof-heading"
      className="mx-auto w-full max-w-5xl px-6 py-20 sm:py-28"
    >
      <figure>
        <h2
          id="proof-heading"
          className="text-center text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
        >
          AgentSpend estimates your cost and energy
        </h2>

        <ProofMetrics />
      </figure>
    </section>
  );
}
