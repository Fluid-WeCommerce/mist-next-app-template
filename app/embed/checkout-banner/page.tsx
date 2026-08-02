import { EmbedGuard } from "../../embed-guard";

export default function CheckoutBannerPage() {
  return (
    <EmbedGuard>
      <main style={containerStyle}>
        <p style={eyebrowStyle}>Mist Drop Zone</p>
        <h1 style={headingStyle}>Your checkout banner is ready to customize</h1>
        <p style={bodyStyle}>
          Edit this page to add the message, offer, or customer experience you
          want to show above fast checkout.
        </p>
      </main>
    </EmbedGuard>
  );
}

const containerStyle: React.CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  minHeight: 180,
  padding: "1.5rem",
  border: "1px solid #e2e8f0",
  borderRadius: "1rem",
  background: "linear-gradient(135deg, #f8fafc, #eef2ff)",
  color: "#0f172a",
  fontFamily: "system-ui, sans-serif",
};

const eyebrowStyle: React.CSSProperties = {
  margin: 0,
  color: "#4f46e5",
  fontSize: "0.75rem",
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const headingStyle: React.CSSProperties = {
  margin: "0.5rem 0",
  fontSize: "1.25rem",
  lineHeight: 1.3,
};

const bodyStyle: React.CSSProperties = {
  margin: 0,
  color: "#475569",
  fontSize: "0.9375rem",
  lineHeight: 1.5,
};
