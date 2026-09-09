import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { ProofPanel } from "@/components/ProofPanel";
import { Download } from "@/components/Download";
import { Trust } from "@/components/Trust";
import { Faq } from "@/components/Faq";
import { Support } from "@/components/Support";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <Hero />
        <ProofPanel />
        <Download />
        <Trust />
        <Faq />
        <Support />
      </main>
      <Footer />
    </>
  );
}
