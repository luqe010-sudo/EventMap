import NavbarClient from "@/components/NavbarClient";

export default function Navbar() {
  return <NavbarClient auth={{ isLoggedIn: false }} />;
}
