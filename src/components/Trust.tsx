import { TRUST } from "@/lib/site";

export function Trust() {
  return (
    <section
      aria-labelledby="trust-heading"
      className="mx-auto w-full max-w-5xl px-6 py-20 sm:py-24"
    >
      <h2
        id="trust-heading"
        className="text-3xl font-semibold tracking-tight sm:text-4xl"
      >
        Why you can trust it
      </h2>

      <div className="mt-12 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
        {TRUST.map((item) => (
          <div key={item.title}>
            <h3 className="flex items-start gap-2.5 text-base font-medium">
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                className="mt-0.5 size-4 shrink-0 text-spark-teal-soft"
              >
                <path
                  d="m4 10.5 4 4 8-9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {item.title}
            </h3>
            <p className="mt-2.5 pl-6.5 text-sm/6 text-muted">{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
