"use client";

import { useState } from "react";
import styles from "./GraphViewer.module.css";

interface SettingsMenuProps {
  debugVisible: boolean;
  hoverEnabled: boolean;
  onToggleDebug: () => void;
  onToggleHover: () => void;
}

export function SettingsMenu({
  debugVisible,
  hoverEnabled,
  onToggleDebug,
  onToggleHover,
}: SettingsMenuProps) {
  const [open, setOpen] = useState(false);
  return (
    <section className={styles.settingsMenu} aria-label="Graph settings">
      <button
        type="button"
        className={styles.settingsSummary}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Settings
      </button>
      {open && (
        <div className={styles.settingsPanel}>
          <label className={styles.switchRow}>
            <span>Debug overlay</span>
            <input
              type="checkbox"
              checked={debugVisible}
              onChange={onToggleDebug}
            />
          </label>
          <label className={styles.switchRow}>
            <span>Hover highlight</span>
            <input
              type="checkbox"
              checked={hoverEnabled}
              onChange={onToggleHover}
            />
          </label>
        </div>
      )}
    </section>
  );
}
