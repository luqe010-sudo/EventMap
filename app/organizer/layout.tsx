import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Panel organizatora | MapaImprez",
  robots: {
    index: false,
    follow: false
  }
};

export default function OrganizerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
