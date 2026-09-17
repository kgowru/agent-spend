import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { Showcase } from "@/components/Showcase";
import { Trust } from "@/components/Trust";
import { Faq } from "@/components/Faq";
import { Feedback } from "@/components/Feedback";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <Hero />
        <Showcase />
        <Trust />
        <Faq />
        <Feedback />
      </main>
      <Footer />
    </>
  );
}
