/*
 * Ids one component sets and another watches. Kept out of both so neither has
 * to import the other: Nav is a client component, and a server component that
 * dots into one gets a module proxy rather than the value.
 */

/** The hero's pair of buttons. The header floats back in once they are behind
 *  you — see Nav. */
export const HERO_CTA_ID = "hero-cta";
