import type { Metadata, Viewport } from "next";
import OvenSauna from "./oven-sauna";

export const metadata: Metadata = {
  title: "OUR CORE VALUE — GOOBNE OVEN SAUNA",
  description: "먹고, 쉬고, 함께하는 따뜻한 경험. GOOBNE OVEN SAUNA의 네 가지 핵심 가치.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function OvenSaunaPage() {
  return <OvenSauna />;
}
