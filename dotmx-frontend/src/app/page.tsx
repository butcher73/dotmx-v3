import { Layout } from "@/components/common";
import {
  HeroSection,
  MetricsSection,
  HighlightsSection,
  HowItWorksSection,
  AdvancedFeaturesSection,
  FAQSection,
} from "@/components/landing";

export default function Home() {
  return (
    <Layout>
      <HeroSection />
      <MetricsSection />
      <HighlightsSection />
      <HowItWorksSection />
      <AdvancedFeaturesSection />
      <FAQSection />
    </Layout>
  );
}
