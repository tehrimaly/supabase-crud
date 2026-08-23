import "./globals.css";

export const metadata = {
  title: "Supabase File Manager",
  description: "CRUD app for Supabase Storage + Edge Function validation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
