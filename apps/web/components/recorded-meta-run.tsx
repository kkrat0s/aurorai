import run from '../../../docs/meta-run-verification-2026-11-04.json';

export default function RecordedMetaRun() {
  return <section className="panel" style={{minWidth:0,maxWidth:'100%',overflowWrap:'anywhere'}} aria-label="Recorded real Muse Spark run">
    <div className="eyebrow">RECORDED REAL META RUN</div>
    <h3>Muse Spark found an evidence gap.</h3>
    <p className="fine">{run.model} · {run.recordedAtUtc} · {run.modelRequestAttempts} actual model requests · ${run.estimatedUsd.toFixed(5)} estimated usage.</p>
    <p>Spark inspected a real USGS BOU reference and found zero independent phone observations. Its request was blocked because invitation delivery is not configured. The validator concluded <strong>INCONCLUSIVE</strong>.</p>
    <details className="details"><summary>Inspect actual model-selected actions</summary>
      <ol>{run.actions.map(action=><li key={action.sequence}><code>{action.tool}</code> · {action.status}</li>)}</ol>
      <p className="fine">{run.reports[0].summary}</p>
      <a href={run.source.sourceUrl} target="_blank" rel="noreferrer">Actual USGS source · F · nT</a>
      <p className="fine">Source SHA-256: {run.source.sha256}</p>
      <ul>{run.limitations.map(item=><li className="fine" key={item}>{item}</li>)}</ul>
    </details>
    <p className="fine">Viewing this record makes no new model call. No participant was contacted. The separate policy replay below uses synthetic fixtures.</p>
  </section>;
}
