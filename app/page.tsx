import MistMark from "./mist-mark";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <MistMark width={340} />
      <h1
        style={{
          margin: "2.5rem 0 0.75rem",
          fontSize: "1.75rem",
          fontWeight: 600,
          letterSpacing: "-0.02em",
        }}
      >
        Hello from your new Mist App
      </h1>
      <p
        style={{
          margin: 0,
          maxWidth: 440,
          fontSize: "1rem",
          lineHeight: 1.6,
          color: "rgba(255, 255, 255, 0.65)",
        }}
      >
        Everything you need to connect to Fluid is already in here. Chat with
        your agent to build your next thing.
      </p>
    </main>
  );
}
