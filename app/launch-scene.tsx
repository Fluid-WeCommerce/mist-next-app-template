import styles from "./launch-scene.module.css";

// Decorative sunrise-launch background: gradient sky, twinkling stars,
// drifting clouds, a bobbing rocket and rising mist plume. Pure CSS, no
// dependencies, no JS — respects `prefers-reduced-motion`.
export default function LaunchScene() {
  return (
    <div className={styles.scene} aria-hidden>
      <div className={styles.stars} />
      <div className={styles.starsAlt} />

      <div className={styles.clouds}>
        <div className={`${styles.cloud} ${styles.cloud1}`} />
        <div className={`${styles.cloud} ${styles.cloud2}`} />
        <div className={`${styles.cloud} ${styles.cloud3}`} />
        <div className={`${styles.cloud} ${styles.cloud4}`} />
      </div>

      <div className={styles.glow} />

      <div className={styles.plume}>
        <div className={`${styles.puff} ${styles.puff1}`} />
        <div className={`${styles.puff} ${styles.puff2}`} />
        <div className={`${styles.puff} ${styles.puff3}`} />
        <div className={`${styles.puff} ${styles.puff4}`} />
        <div className={`${styles.puff} ${styles.puff5}`} />
      </div>

      <div className={styles.rocketWrap}>
        <svg className={styles.rocket} viewBox="0 0 64 128" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Body */}
          <path d="M32 4 C 44 18, 50 42, 50 70 L 50 96 L 14 96 L 14 70 C 14 42, 20 18, 32 4 Z" fill="#f5f7fb" stroke="#dde2ec" strokeWidth="1.5"/>
          {/* Window */}
          <circle cx="32" cy="46" r="8" fill="#7fc8ff" stroke="#3a86c9" strokeWidth="1.5"/>
          <circle cx="29" cy="43" r="2.4" fill="#ffffff" opacity="0.85"/>
          {/* Fins */}
          <path d="M14 78 L 4 104 L 14 96 Z" fill="#ff7a59"/>
          <path d="M50 78 L 60 104 L 50 96 Z" fill="#ff7a59"/>
          {/* Nose tip */}
          <path d="M32 4 C 34 8, 36 14, 37 22 L 27 22 C 28 14, 30 8, 32 4 Z" fill="#ff9a76"/>
          {/* Nozzle */}
          <rect x="22" y="96" width="20" height="8" rx="2" fill="#9aa3b5"/>
        </svg>
      </div>
    </div>
  );
}
