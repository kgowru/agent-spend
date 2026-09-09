import { FAQ } from "@/lib/site";

/**
 * Native <details> rather than a JS accordion: keyboard and screen reader
 * correct with no client boundary, and it works before hydration. The shared
 * `name` makes opening one close the others, degrading to multi-open on older
 * browsers.
 */
export function Faq() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="mx-auto w-full max-w-3xl scroll-mt-24 px-6 py-20 sm:py-24"
    >
      <h2
        id="faq-heading"
        className="text-3xl font-semibold tracking-tight sm:text-4xl"
      >
        Questions
      </h2>

      <div className="mt-10 divide-y divide-white/8 border-y border-white/8">
        {FAQ.map((item) => (
          <details key={item.q} name="faq" className="group">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-base font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spark-teal-soft">
              {item.q}
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                className="mt-1 size-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180"
              >
                <path
                  d="m5 7.5 5 5 5-5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </summary>
            <p className="max-w-2xl pb-6 text-sm/7 text-muted">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
