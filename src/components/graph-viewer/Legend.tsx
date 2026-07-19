import styles from "./GraphViewer.module.css";

export function Legend({ hasGraph }: { hasGraph: boolean }) {
  if (!hasGraph) return null;

  return (
    <details className={styles.legend}>
      <summary>Legend</summary>
      <div className={styles.legendGrid}>
        <span className={styles.swatchCommunity} />
        <span>Color: community or node type</span>
        <span className={styles.swatchNodeSize} />
        <span>Size: node degree/weight</span>
        <span className={styles.swatchExtracted} />
        <span>Blue links: extracted/known</span>
        <span className={styles.swatchInferred} />
        <span>Brown links: inferred</span>
      </div>
    </details>
  );
}
